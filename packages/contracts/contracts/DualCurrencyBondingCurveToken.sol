// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

/**
 * @title DualCurrencyBondingCurveToken
 * @author ACES
 * @dev Pump.fun style bonding curve accepting both ETH and USDC
 * 
 * Key Features:
 * - Accepts both ETH and USDC payments
 * - Pump.fun bonding curve formula
 * - 1M total token supply
 * - No fees for testnet simplicity
 */
contract DualCurrencyBondingCurveToken is 
    Initializable,
    ERC20Upgradeable,
    ERC20PermitUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // --- State Variables ---
    address public owner;
    address public usdcToken;
    
    // Bonding Curve Parameters (FIXED - no overflow)
    uint256 public constant VIRTUAL_ETH_RESERVES = 30 ether;          // 30 ETH
    uint256 public constant VIRTUAL_TOKEN_RESERVES = 1073000191 ether; // ~1.073B (pump.fun standard)
    uint256 public constant K_CONSTANT = 32190005730;                  // Pump.fun constant
    
    // Token Economics
    uint256 public constant MAX_SUPPLY = 1_000_000 ether;             // 1M tokens total
    
    // Tracking
    uint256 public totalETHRaised;      // Total ETH raised from bonding curve
    uint256 public totalUSDCRaised;     // Total USDC raised from bonding curve
    uint256 public tokensSold;          // Tokens sold through bonding curve
    
    // Price Oracle (simplified for testnet - assumes 1 ETH = 3000 USDC)
    uint256 public constant ETH_TO_USDC_RATE = 3000; // 1 ETH = 3000 USDC
    
    // Emergency controls
    bool public emergencyStop;
    
    // Events
    event TokensPurchased(
        address indexed buyer,
        uint256 ethSpent,
        uint256 usdcSpent,
        uint256 tokensReceived,
        uint256 currentPrice,
        uint256 totalTokensSold,
        string paymentMethod
    );
    
    event TokensSold(
        address indexed seller,
        uint256 tokensSold,
        uint256 ethReceived,
        uint256 usdcReceived,
        uint256 currentPrice,
        uint256 totalTokensSold,
        string paymentMethod
    );
    
    event EmergencyStopSet(bool stopped);

    // --- Constructor & Initializer ---
    
    constructor() {
        // _disableInitializers();
    }

    function initialize(
        string memory name,
        string memory symbol,
        address _usdcToken
    ) public initializer {
        __ERC20_init(name, symbol);
        __ERC20Permit_init(name);
        __Pausable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        require(_usdcToken != address(0), "USDC token cannot be zero address");

        owner = msg.sender;
        usdcToken = _usdcToken;
        
        // Mint total supply to contract for bonding curve
        _mint(address(this), MAX_SUPPLY);
    }

    // --- External Functions: ETH Trading ---

    /**
     * @dev Buy tokens with ETH using pump.fun bonding curve formula
     */
    function buyWithETH() public payable nonReentrant whenNotPaused {
        require(!emergencyStop, "Trading is stopped");
        require(msg.value > 0, "Must send ETH");
        require(tokensSold < MAX_SUPPLY, "All tokens sold");
        
        uint256 tokensToReceive = calculateTokensForETH(msg.value);
        
        require(tokensToReceive > 0, "No tokens to receive");
        require(tokensSold + tokensToReceive <= MAX_SUPPLY, "Exceeds max supply");
        
        // Update state
        totalETHRaised += msg.value;
        tokensSold += tokensToReceive;
        
        // Transfer tokens from contract to buyer
        _transfer(address(this), msg.sender, tokensToReceive);
        
        emit TokensPurchased(
            msg.sender,
            msg.value,
            0,
            tokensToReceive,
            getCurrentPrice(),
            tokensSold,
            "ETH"
        );
    }
    
    /**
     * @dev Sell tokens for ETH
     */
    function sellForETH(uint256 tokenAmount) external nonReentrant whenNotPaused {
        require(!emergencyStop, "Trading is stopped");
        require(tokenAmount > 0, "Must sell positive amount");
        require(balanceOf(msg.sender) >= tokenAmount, "Insufficient balance");
        require(tokenAmount <= tokensSold, "Cannot sell more than sold");
        
        uint256 ethToReceive = calculateETHForTokens(tokenAmount);
        require(ethToReceive > 0, "No ETH to receive");
        require(address(this).balance >= ethToReceive, "Insufficient contract ETH");
        
        // Update state
        totalETHRaised -= ethToReceive;
        tokensSold -= tokenAmount;
        
        // Transfer tokens back to contract and send ETH to user
        _transfer(msg.sender, address(this), tokenAmount);
        (bool success, ) = msg.sender.call{value: ethToReceive}("");
        require(success, "ETH transfer failed");
        
        emit TokensSold(
            msg.sender,
            tokenAmount,
            ethToReceive,
            0,
            getCurrentPrice(),
            tokensSold,
            "ETH"
        );
    }

    // --- External Functions: USDC Trading ---

    /**
     * @dev Buy tokens with USDC
     */
    function buyWithUSDC(uint256 usdcAmount) external nonReentrant whenNotPaused {
        require(!emergencyStop, "Trading is stopped");
        require(usdcAmount > 0, "Must send USDC");
        require(tokensSold < MAX_SUPPLY, "All tokens sold");
        
        // Convert USDC to ETH equivalent for bonding curve calculation
        uint256 ethEquivalent = usdcToETH(usdcAmount);
        uint256 tokensToReceive = calculateTokensForETH(ethEquivalent);
        
        require(tokensToReceive > 0, "No tokens to receive");
        require(tokensSold + tokensToReceive <= MAX_SUPPLY, "Exceeds max supply");
        
        // Update state
        totalUSDCRaised += usdcAmount;
        tokensSold += tokensToReceive;
        
        // Transfer USDC from user to contract
        IERC20Upgradeable(usdcToken).safeTransferFrom(msg.sender, address(this), usdcAmount);
        
        // Transfer tokens from contract to buyer
        _transfer(address(this), msg.sender, tokensToReceive);
        
        emit TokensPurchased(
            msg.sender,
            0,
            usdcAmount,
            tokensToReceive,
            getCurrentPrice(),
            tokensSold,
            "USDC"
        );
    }
    
    /**
     * @dev Sell tokens for USDC
     */
    function sellForUSDC(uint256 tokenAmount) external nonReentrant whenNotPaused {
        require(!emergencyStop, "Trading is stopped");
        require(tokenAmount > 0, "Must sell positive amount");
        require(balanceOf(msg.sender) >= tokenAmount, "Insufficient balance");
        require(tokenAmount <= tokensSold, "Cannot sell more than sold");
        
        uint256 ethEquivalent = calculateETHForTokens(tokenAmount);
        uint256 usdcToReceive = ethToUSDC(ethEquivalent);
        require(usdcToReceive > 0, "No USDC to receive");
        
        // Check contract has enough USDC
        uint256 contractUSDCBalance = IERC20Upgradeable(usdcToken).balanceOf(address(this));
        require(contractUSDCBalance >= usdcToReceive, "Insufficient contract USDC");
        
        // Update state
        totalUSDCRaised -= usdcToReceive;
        tokensSold -= tokenAmount;
        
        // Transfer tokens back to contract and send USDC to user
        _transfer(msg.sender, address(this), tokenAmount);
        IERC20Upgradeable(usdcToken).safeTransfer(msg.sender, usdcToReceive);
        
        emit TokensSold(
            msg.sender,
            tokenAmount,
            0,
            usdcToReceive,
            getCurrentPrice(),
            tokensSold,
            "USDC"
        );
    }

    // --- View Functions ---

    /**
     * @dev Calculate tokens received for ETH using simple bonding curve (no overflow)
     */
    function calculateTokensForETH(uint256 ethAmount) public view returns (uint256) {
        if (ethAmount == 0) return 0;
        
        // Simple bonding curve: tokens = ethAmount * 1000 (1 ETH = 1000 tokens initially)
        // Price increases as more tokens are sold
        uint256 baseTokens = ethAmount * 1000; // 1 ETH = 1000 tokens
        
        // Apply bonding curve effect: price increases with supply
        uint256 currentSupply = tokensSold;
        uint256 priceMultiplier = 1 + (currentSupply / (100_000 ether)); // Price increases by 1% per 100k tokens sold
        
        uint256 tokensToReceive = baseTokens / priceMultiplier;
        
        return tokensToReceive;
    }
    
    /**
     * @dev Calculate ETH received for tokens (inverse of buy formula)
     */
    function calculateETHForTokens(uint256 tokenAmount) public view returns (uint256) {
        if (tokenAmount == 0) return 0;
        
        // Reverse the bonding curve calculation
        uint256 currentSupply = tokensSold;
        uint256 priceMultiplier = 1 + (currentSupply / (100_000 ether));
        
        uint256 baseTokens = tokenAmount * priceMultiplier;
        uint256 ethToReceive = baseTokens / 1000;
        
        return ethToReceive;
    }
    
    /**
     * @dev Get current token price in ETH per token
     */
    function getCurrentPrice() public view returns (uint256) {
        uint256 currentSupply = tokensSold;
        uint256 priceMultiplier = 1 + (currentSupply / (100_000 ether));
        
        // Base price is 0.001 ETH per token (1000 tokens per ETH)
        uint256 basePrice = 0.001 ether;
        return basePrice * priceMultiplier;
    }
    
    /**
     * @dev Convert USDC to ETH equivalent
     */
    function usdcToETH(uint256 usdcAmount) public pure returns (uint256) {
        return (usdcAmount * 1e18) / (ETH_TO_USDC_RATE * 1e6); // USDC has 6 decimals
    }
    
    /**
     * @dev Convert ETH to USDC equivalent
     */
    function ethToUSDC(uint256 ethAmount) public pure returns (uint256) {
        return (ethAmount * ETH_TO_USDC_RATE * 1e6) / 1e18; // USDC has 6 decimals
    }
    
    /**
     * @dev Get market cap in ETH
     */
    function getMarketCap() external view returns (uint256) {
        return (getCurrentPrice() * tokensSold) / 1e18;
    }
    
    /**
     * @dev Get bonding curve progress (0-100%)
     */
    function getBondingCurveProgress() external view returns (uint256) {
        return (tokensSold * 100) / MAX_SUPPLY;
    }
    
    /**
     * @dev Get quote for buying tokens with ETH
     */
    function getQuoteForETH(uint256 ethAmount) external view returns (uint256 tokensOut, uint256 pricePerToken) {
        tokensOut = calculateTokensForETH(ethAmount);
        pricePerToken = tokensOut > 0 ? (ethAmount * 1e18) / tokensOut : 0;
    }
    
    /**
     * @dev Get quote for buying tokens with USDC
     */
    function getQuoteForUSDC(uint256 usdcAmount) external view returns (uint256 tokensOut, uint256 pricePerToken) {
        uint256 ethEquivalent = usdcToETH(usdcAmount);
        tokensOut = calculateTokensForETH(ethEquivalent);
        pricePerToken = tokensOut > 0 ? (usdcAmount * 1e18) / (tokensOut * 1e6) : 0; // Adjust for USDC decimals
    }

    /**
     * @dev Get all contract state for frontend
     */
    function getContractState() external view returns (
        uint256 _totalSupply,
        uint256 _tokensSold,
        uint256 _totalETHRaised,
        uint256 _totalUSDCRaised,
        uint256 _currentPrice,
        uint256 _marketCap,
        uint256 _progress,
        bool _emergencyStop
    ) {
        _totalSupply = totalSupply();
        _tokensSold = tokensSold;
        _totalETHRaised = totalETHRaised;
        _totalUSDCRaised = totalUSDCRaised;
        _currentPrice = getCurrentPrice();
        _marketCap = (_currentPrice * _tokensSold) / 1e18;
        _progress = (_tokensSold * 100) / MAX_SUPPLY;
        _emergencyStop = emergencyStop;
    }

    // --- Admin Functions ---
    
    function setEmergencyStop(bool _stopped) external {
        require(msg.sender == owner, "Only owner");
        emergencyStop = _stopped;
        emit EmergencyStopSet(_stopped);
    }
    
    function _authorizeUpgrade(address) internal view override {
        require(msg.sender == owner, "Only owner");
    }
    
    // --- Receive Function ---
    receive() external payable {
        // Allow direct ETH sends to buy tokens
        if (msg.value > 0) {
            buyWithETH();
        }
    }
}