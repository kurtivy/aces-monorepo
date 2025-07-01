// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "../interfaces/IRwaFactory.sol";
import "../interfaces/IRwaDeedNft.sol";
import "../lib/AcesConstants.sol";
import "./MockBondingCurveToken.sol";

/**
 * @title MockRwaFactory
 * @author ACES
 * @dev Factory contract for creating new RWA tokens with associated deed NFTs.
 * This contract uses role-based access control for better security and decentralization.
 */
contract MockRwaFactory is 
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    IRwaFactory
{
    using AcesConstants for *;

    // --- Constants ---
    bytes32 public constant RWA_CREATOR_ROLE = keccak256("RWA_CREATOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    // --- State Variables ---
    address public acesToken;
    address public deedNftContract;
    address[] public allTokens;
    mapping(uint256 => address) public deedToToken;
    mapping(address => bool) public isValidToken;

    // --- Events ---
    event RwaTokenCreated(
        address indexed token,
        uint256 indexed deedId,
        string name,
        string symbol
    );
    event EmergencyStop(address indexed token, bool stopped);

    // --- Constructor & Initializer ---

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // For testing purposes, allow direct initialization
        // In production, this would use _disableInitializers() for proxy pattern
    }

    function initialize(
        address _acesToken,
        address _deedNftContract
    ) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        if (_acesToken == address(0)) revert AcesConstants.ZeroAddress();
        if (_deedNftContract == address(0)) revert AcesConstants.ZeroAddress();

        acesToken = _acesToken;
        deedNftContract = _deedNftContract;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RWA_CREATOR_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
    }

    // --- External Functions ---

    /**
     * @dev Creates a new RWA token with an associated deed NFT.
     * Only accounts with RWA_CREATOR_ROLE can call this function.
     */
    function createRwa(
        string memory name,
        string memory symbol,
        uint256 deedId,
        address feeCollector
    ) external nonReentrant onlyRole(RWA_CREATOR_ROLE) returns (address) {
        if (deedToToken[deedId] != address(0)) revert AcesConstants.InvalidTokenId();
        if (feeCollector == address(0)) revert AcesConstants.ZeroAddress();

        address tokenAddress;
        try new MockBondingCurveToken(
            name,
            symbol,
            deedId,
            deedNftContract,
            acesToken,
            feeCollector
        ) returns (MockBondingCurveToken token) {
            try token.initialize(name, symbol) {
                tokenAddress = address(token);
            } catch {
                revert AcesConstants.InitializationFailed();
            }
        } catch {
            revert AcesConstants.DeploymentFailed();
        }

        // Update state
        deedToToken[deedId] = tokenAddress;
        isValidToken[tokenAddress] = true;
        allTokens.push(tokenAddress);

        emit RwaTokenCreated(tokenAddress, deedId, name, symbol);
        return tokenAddress;
    }

    /**
     * @dev Emergency stop for a specific RWA token.
     * Only accounts with EMERGENCY_ROLE can call this function.
     */
    function emergencyStop(address token, bool stopped) external onlyRole(EMERGENCY_ROLE) {
        if (!isValidToken[token]) revert AcesConstants.InvalidTokenId();
        MockBondingCurveToken(token).setEmergencyStop(stopped);
        emit EmergencyStop(token, stopped);
    }

    /**
     * @dev Returns all RWA tokens created by this factory.
     * Implements pagination to prevent out-of-gas errors.
     */
    function getAllTokens(uint256 offset, uint256 limit) external view returns (address[] memory tokens) {
        uint256 total = allTokens.length;
        if (offset >= total) return new address[](0);
        
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 length = end - offset;
        
        tokens = new address[](length);
        for (uint256 i = 0; i < length; i++) {
            tokens[i] = allTokens[offset + i];
        }
        return tokens;
    }

    /**
     * @dev Returns the total number of RWA tokens.
     */
    function getTotalTokens() external view returns (uint256) {
        return allTokens.length;
    }

    // --- Internal Functions ---

    /**
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract.
     * Called by {upgradeTo} and {upgradeToAndCall}.
     */
    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}
}