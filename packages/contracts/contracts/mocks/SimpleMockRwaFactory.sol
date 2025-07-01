// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/IRwaFactory.sol";
import "../interfaces/IRwaDeedNft.sol";
import "./MockBondingCurveToken.sol";

/**
 * @title SimpleMockRwaFactory
 * @author ACES
 * @dev Simplified factory contract for creating new RWA tokens with associated deed NFTs.
 * This is a non-upgradeable version for testing purposes.
 */
contract SimpleMockRwaFactory is AccessControl, IRwaFactory {
    // --- Constants ---
    bytes32 public constant RWA_CREATOR_ROLE = keccak256("RWA_CREATOR_ROLE");

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

    // --- Constructor ---
    constructor(address _acesToken, address _deedNftContract) {
        require(_acesToken != address(0), "SimpleMockRwaFactory: ACES token cannot be zero address");
        require(_deedNftContract != address(0), "SimpleMockRwaFactory: Deed NFT contract cannot be zero address");

        acesToken = _acesToken;
        deedNftContract = _deedNftContract;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RWA_CREATOR_ROLE, msg.sender);
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
    ) external onlyRole(RWA_CREATOR_ROLE) returns (address) {
        require(deedToToken[deedId] == address(0), "SimpleMockRwaFactory: Deed already has token");
        require(feeCollector != address(0), "SimpleMockRwaFactory: Fee collector cannot be zero address");

        // First mint the deed NFT
        IRwaDeedNft(deedNftContract).mintDeed(feeCollector, "");

        // Deploy the bonding curve token
        MockBondingCurveToken token = new MockBondingCurveToken(
            name,
            symbol,
            deedId,
            deedNftContract,
            acesToken,
            feeCollector
        );

        // Initialize the token
        token.initialize(name, symbol);

        address tokenAddress = address(token);

        // Update state
        deedToToken[deedId] = tokenAddress;
        isValidToken[tokenAddress] = true;
        allTokens.push(tokenAddress);

        emit RwaTokenCreated(tokenAddress, deedId, name, symbol);
        return tokenAddress;
    }

    /**
     * @dev Emergency stop for a specific RWA token.
     * Only accounts with DEFAULT_ADMIN_ROLE can call this function.
     */
    function emergencyStop(address token, bool stopped) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isValidToken[token], "SimpleMockRwaFactory: Invalid token");
        MockBondingCurveToken(token).setEmergencyStop(stopped);
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
} 