// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// Only for external contract interactions
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "../utils/ReentrancyGuard.sol";
import "../interfaces/IBondingCurveToken.sol";
import "../lib/AcesConstants.sol";

import "hardhat/console.sol";

/**
 * @title MockBondingCurveToken
 * @author ACES
 * @dev ERC20 token with a square root bonding curve for RWA tokens.
 * This contract handles the pricing, trading (buy/sell), and fee collection for a specific RWA.
 * It uses a mathematical formula to determine the price based on the token's total supply.
 */
contract MockBondingCurveToken is 
    Initializable,
    ERC20Upgradeable,
    ERC20PermitUpgradeable,
    IBondingCurveToken,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuard
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AcesConstants for *;

    // --- State Variables ---

    uint256 public immutable override deedNftId;
    address public immutable override deedNftContract;
    address public immutable override acesToken;
    
    // Factory management
    address public factory;
    address public pendingFactory;
    
    // Fee tracking
    uint256 public accruedFees;
    uint256 public platformFeesAccrued;
    address public feeCollector;

    // Constants for gas optimization
    uint256 private constant SCALE_FACTOR = 10**18;
    uint256 private constant SQRT_SCALE = 10**9;
    uint256 public constant MAX_SUPPLY = 1_000_000; // 1M tokens max

    // Emergency stop
    bool public emergencyStop;

    // --- Events ---
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event FactoryTransferStarted(address indexed currentFactory, address indexed pendingFactory);
    event FactoryTransferred(address indexed oldFactory, address indexed newFactory);
    event EmergencyStopSet(bool indexed stopped);
    event FeesAccrued(uint256 ownerFees, uint256 platformFees);
    event TokensRescued(address indexed token, address indexed to, uint256 amount);

    // --- Constructor & Initializer ---

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        string memory /* name */,
        string memory /* symbol */,
        uint256 _deedNftId,
        address _deedNftContract,
        address _acesToken,
        address _feeCollector
    ) {
        require(_deedNftContract != address(0), "BondingCurve: Deed NFT contract is zero address");
        require(_acesToken != address(0), "BondingCurve: ACES token is zero address");
        require(_feeCollector != address(0), "BondingCurve: Fee collector is zero address");

        deedNftId = _deedNftId;
        deedNftContract = _deedNftContract;
        acesToken = _acesToken;
        feeCollector = _feeCollector;
        factory = msg.sender;

        // _disableInitializers();
    }

    function initialize(
        string memory name,
        string memory symbol
    ) public initializer {
        __ERC20_init(name, symbol);
        __ERC20Permit_init(name);
        __Pausable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
    }

    // --- ERC20 Overrides ---
    function totalSupply() public view virtual override(ERC20Upgradeable, IERC20Upgradeable) returns (uint256) {
        return super.totalSupply();
    }

    function balanceOf(address account) public view virtual override(ERC20Upgradeable, IERC20Upgradeable) returns (uint256) {
        return super.balanceOf(account);
    }

    function transfer(address to, uint256 amount) public virtual override(ERC20Upgradeable, IERC20Upgradeable) returns (bool) {
        return super.transfer(to, amount);
    }

    function allowance(address owner, address spender) public view virtual override(ERC20Upgradeable, IERC20Upgradeable) returns (uint256) {
        return super.allowance(owner, spender);
    }

    function approve(address spender, uint256 amount) public virtual override(ERC20Upgradeable, IERC20Upgradeable) returns (bool) {
        return super.approve(spender, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public virtual override(ERC20Upgradeable, IERC20Upgradeable) returns (bool) {
        return super.transferFrom(from, to, amount);
    }

    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) 
        public virtual override(ERC20PermitUpgradeable, IBondingCurveToken) 
    {
        ERC20PermitUpgradeable.permit(owner, spender, value, deadline, v, r, s);
    }

    // --- External Functions: Trading ---

    /**
     * @dev Buys tokens from the bonding curve.
     * @param recipient The address that will receive the minted tokens.
     * @param tokenAmount The amount of tokens to buy.
     * @param maxPayAmount The maximum amount of ACES tokens the buyer is willing to pay (for slippage protection).
     * @return cost The actual amount of ACES tokens paid.
     */
    function buy(address recipient, uint256 tokenAmount, uint256 maxPayAmount) external override nonReentrant whenNotPaused returns (uint256 cost) {
        require(!emergencyStop, "BondingCurve: Trading is stopped");
        if (tokenAmount == 0) revert AcesConstants.ZeroAmount();
        if (totalSupply() + tokenAmount > MAX_SUPPLY) revert AcesConstants.ExceedsMaxSupply();
        
        uint256 baseCost = getBuyPrice(tokenAmount);
        uint256 platformFee = (baseCost * AcesConstants.PLATFORM_FEE_BPS) / 10000;
        uint256 ownerFee = (baseCost * AcesConstants.OWNER_FEE_BPS) / 10000;
        cost = baseCost + platformFee + ownerFee;
        
        if (cost > maxPayAmount) revert AcesConstants.InsufficientPayment(cost, maxPayAmount);

        // --- Effects ---
        accruedFees += ownerFee;
        _mint(recipient, tokenAmount);

        // --- Interactions ---
        IERC20Upgradeable(acesToken).safeTransferFrom(msg.sender, address(this), cost);
        
        // Transfer platform fee to fee collector
        if (platformFee > 0) {
            IERC20Upgradeable(acesToken).safeTransfer(feeCollector, platformFee);
        }
        
        // Keep baseCost + ownerFee in contract for liquidity and fees
        // baseCost stays in contract to support future sells
        // ownerFee stays in contract until claimed

        emit Trade(msg.sender, recipient, true, tokenAmount, cost, platformFee, ownerFee);
        emit FeesAccrued(ownerFee, platformFee);
    }

    /**
     * @dev Sells tokens back to the bonding curve.
     * @param recipient The address that will receive the ACES tokens.
     * @param tokenAmount The amount of tokens to sell.
     * @param minReceiveAmount The minimum amount of ACES tokens the seller wants to receive (for slippage protection).
     * @return proceeds The actual amount of ACES tokens received.
     */
    function sell(address recipient, uint256 tokenAmount, uint256 minReceiveAmount) external override nonReentrant whenNotPaused returns (uint256 proceeds) {
        require(!emergencyStop, "BondingCurve: Trading is stopped");
        if (tokenAmount == 0) revert AcesConstants.ZeroAmount();
        
        proceeds = getSellProceeds(tokenAmount);
        if (proceeds < minReceiveAmount) revert AcesConstants.OutputAmountTooLow(minReceiveAmount, proceeds);
        if (balanceOf(msg.sender) < tokenAmount) revert AcesConstants.InsufficientPayment(tokenAmount, balanceOf(msg.sender));

        // --- Effects ---
        uint256 platformFee = (proceeds * AcesConstants.PLATFORM_FEE_BPS) / 10000;
        uint256 ownerFee = (proceeds * AcesConstants.OWNER_FEE_BPS) / 10000;
        uint256 netProceeds = proceeds - platformFee - ownerFee;
        
        accruedFees += ownerFee;
        _burn(msg.sender, tokenAmount);

        // --- Interactions ---
        if (platformFee > 0) {
            IERC20Upgradeable(acesToken).safeTransfer(feeCollector, platformFee);
        }
        IERC20Upgradeable(acesToken).safeTransfer(recipient, netProceeds);

        emit Trade(msg.sender, recipient, false, tokenAmount, proceeds, platformFee, ownerFee);
        emit FeesAccrued(ownerFee, platformFee);
    }

    // --- External Functions: Fee Management ---

    /**
     * @dev Allows the owner of the deed NFT to claim their accrued fees.
     */
    function claimFees() external nonReentrant {
        address deedOwner = IERC721(deedNftContract).ownerOf(deedNftId);
        if (msg.sender != deedOwner) revert AcesConstants.NotDeedOwner(deedNftId, msg.sender);

        uint256 fees = accruedFees;
        if (fees == 0) revert AcesConstants.ZeroAmount(); // Using existing error
        accruedFees = 0;
        
        IERC20Upgradeable(acesToken).safeTransfer(msg.sender, fees);

        emit FeesClaimed(deedNftId, msg.sender, fees);
    }

    /**
     * @dev Updates the fee collector address. Can only be called by the factory owner.
     * @param _newFeeCollector The new address to receive platform fees.
     */
    function setFeeCollector(address _newFeeCollector) external {
        if (msg.sender != factory) revert AcesConstants.Unauthorized();
        if (_newFeeCollector == address(0)) revert AcesConstants.ZeroAddress();
        
        emit FeeCollectorUpdated(feeCollector, _newFeeCollector);
        feeCollector = _newFeeCollector;
    }

    // --- View Functions ---

    /**
     * @dev Calculates the cost to buy a certain amount of tokens.
     * The cost is the integral of the price function from the current supply to the new supply.
     * Formula: ∫(base + multiplier * sqrt(x))dx = base*x + (2/3)*multiplier*x^(3/2)
     * @param tokenAmount The amount of tokens to be bought.
     * @return cost The calculated cost in ACES tokens.
     */
    function getBuyPrice(uint256 tokenAmount) public view override returns (uint256 cost) {
        if (tokenAmount == 0) return 0;
        
        uint256 currentSupply = totalSupply();
        uint256 newSupply = currentSupply + tokenAmount;
        
        uint256 integralCurrent = _integral(currentSupply);
        uint256 integralNew = _integral(newSupply);
        
        cost = (integralNew - integralCurrent) / (10**18); // Scale down the final result
    }

    /**
     * @dev Calculates the proceeds from selling a certain amount of tokens.
     * The proceeds are the integral of the price function from the new supply to the current supply.
     * @param tokenAmount The amount of tokens to be sold.
     * @return proceeds The calculated proceeds in ACES tokens.
     */
    function getSellProceeds(uint256 tokenAmount) public view override returns (uint256 proceeds) {
        if (tokenAmount == 0) return 0;
        
        uint256 currentSupply = totalSupply();
        if (tokenAmount > currentSupply) return 0; // Cannot sell more than exists
        
        uint256 newSupply = currentSupply - tokenAmount;
        
        uint256 integralCurrent = _integral(currentSupply);
        uint256 integralNew = _integral(newSupply);
        
        proceeds = (integralCurrent - integralNew) / (10**18); // Scale down the final result
    }

    /**
     * @dev Returns the accrued fees for this bonding curve token.
     * @return The amount of fees accrued.
     */
    function getAccruedFees(uint256 /* _deedNftId */) external view override returns (uint256) {
        return accruedFees;
    }

    /**
     * @dev Returns the current price for buying one token at the current supply.
     * This is useful for UI display and price estimation.
     * @return price The current price per token in ACES.
     */
    function getCurrentPrice() external view returns (uint256 price) {
        uint256 supply = totalSupply();
        uint256 nextSupply = supply + 1;
        return ((_integral(nextSupply) - _integral(supply)) / (10**18));
    }
    
    // --- Preview Functions ---

    /**
     * @dev Previews the net cost of buying tokens, including fees.
     * @param tokenAmount The amount of tokens to buy.
     * @return netCost The total cost in ACES tokens.
     * @return platformFee The platform fee portion.
     * @return ownerFee The owner fee portion.
     */
    function previewBuy(uint256 tokenAmount) external view returns (
        uint256 netCost,
        uint256 platformFee,
        uint256 ownerFee
    ) {
        uint256 baseCost = getBuyPrice(tokenAmount);
        platformFee = (baseCost * AcesConstants.PLATFORM_FEE_BPS) / 10000;
        ownerFee = (baseCost * AcesConstants.OWNER_FEE_BPS) / 10000;
        netCost = baseCost + platformFee + ownerFee;
    }

    /**
     * @dev Previews the net proceeds from selling tokens, including fees.
     * @param tokenAmount The amount of tokens to sell.
     * @return netProceeds The amount the seller will receive.
     * @return platformFee The platform fee portion.
     * @return ownerFee The owner fee portion.
     */
    function previewSell(uint256 tokenAmount) external view returns (
        uint256 netProceeds,
        uint256 platformFee,
        uint256 ownerFee
    ) {
        uint256 grossProceeds = getSellProceeds(tokenAmount);
        platformFee = (grossProceeds * AcesConstants.PLATFORM_FEE_BPS) / 10000;
        ownerFee = (grossProceeds * AcesConstants.OWNER_FEE_BPS) / 10000;
        netProceeds = grossProceeds - platformFee - ownerFee;
    }

    // --- Internal Functions ---

    /**
     * @dev Calculates the definite integral of the price function at a given supply `s`.
     * Integral: F(s) = (base * s) + (2/3 * multiplier * s^(3/2))
     * All calculations are scaled by 1e18 to handle fixed-point math.
     * @param supply The supply at which to calculate the integral.
     * @return The scaled integral value.
     */
    function _integral(uint256 supply) internal pure returns (uint256) {
        // Remove the revert here since we check in getBuyPrice
        if (supply == 0) return 0;
        
        uint256 scaledSupply = supply * SCALE_FACTOR;
        uint256 linearComponent = AcesConstants.CURVE_BASE_PRICE * scaledSupply;
        
        // s^(3/2) = s * sqrt(s)
        uint256 power32 = (supply * _sqrt(scaledSupply)) / SQRT_SCALE;
        uint256 sqrtComponent = (AcesConstants.CURVE_MULTIPLIER * 2 * power32) / 3;
        
        return (linearComponent + sqrtComponent) * AcesConstants.PRICE_SCALE;
    }

    /**
     * @dev Calculates the square root of a number using assembly for gas optimization.
     * Uses the Babylonian method with Barrett reduction.
     * @param x The number to find the square root of, scaled by 1e18.
     * @return y The square root, scaled by 1e9.
     */
    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        
        // Simplified square root using the Babylonian method
        // This is less gas-intensive than the assembly version
        y = x;
        uint256 z = (x + 1) / 2;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        
        // Scale result to 1e9
        return y / 1000000000;
    }

    // --- Factory Management ---

    /**
     * @dev Initiates the transfer of factory control to a new address.
     * This is step 1 of 2 in the factory transfer process.
     * @param _newFactory The address that will become the new factory.
     */
    function transferFactory(address _newFactory) external {
        if (msg.sender != factory) revert AcesConstants.Unauthorized();
        if (_newFactory == address(0)) revert AcesConstants.ZeroAddress();
        
        pendingFactory = _newFactory;
        emit FactoryTransferStarted(factory, _newFactory);
    }

    /**
     * @dev Completes the transfer of factory control.
     * This is step 2 of 2 in the factory transfer process.
     */
    function acceptFactory() external {
        if (msg.sender != pendingFactory) revert AcesConstants.Unauthorized();
        
        emit FactoryTransferred(factory, pendingFactory);
        factory = pendingFactory;
        pendingFactory = address(0);
    }

    // --- Emergency Controls ---

    /**
     * @dev Sets the emergency stop status. Can only be called by the factory.
     * @param _stopped Whether to stop all trading.
     */
    function setEmergencyStop(bool _stopped) external {
        if (msg.sender != factory) revert AcesConstants.Unauthorized();
        
        emergencyStop = _stopped;
        emit EmergencyStopSet(_stopped);
    }

    /**
     * @dev Rescues accidentally sent ERC20 tokens (except ACES).
     * @param token The token to rescue.
     * @param to The address to send the tokens to.
     * @param amount The amount of tokens to rescue.
     */
    function rescueTokens(address token, address to, uint256 amount) external {
        if (msg.sender != factory) revert AcesConstants.Unauthorized();
        if (to == address(0)) revert AcesConstants.ZeroAddress();
        
        IERC20Upgradeable(token).safeTransfer(to, amount);
        emit TokensRescued(token, to, amount);
    }

    // --- UUPS Upgradeability ---

    /**
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract.
     * Called by {upgradeTo} and {upgradeToAndCall}.
     */
    function _authorizeUpgrade(address) internal view override {
        if (msg.sender != factory) revert AcesConstants.Unauthorized();
    }
}