// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRwaFactory
 * @author ACES
 * @dev Interface for the RWA Factory contract
 */
interface IRwaFactory {
    /**
     * @dev Creates a new RWA token with an associated deed NFT.
     * @param name The name of the new RWA token
     * @param symbol The symbol of the new RWA token
     * @param deedId The ID of the deed NFT
     * @param feeCollector The address that will collect fees
     * @return The address of the newly created RWA token
     */
    function createRwa(
        string memory name,
        string memory symbol,
        uint256 deedId,
        address feeCollector
    ) external returns (address);

    /**
     * @dev Emergency stop for a specific RWA token.
     * @param token The address of the RWA token
     * @param stopped Whether to stop or resume the token
     */
    function emergencyStop(address token, bool stopped) external;

    /**
     * @dev Returns all RWA tokens created by this factory.
     * @param offset The starting index
     * @param limit The maximum number of tokens to return
     * @return tokens The array of token addresses
     */
    function getAllTokens(uint256 offset, uint256 limit) external view returns (address[] memory tokens);

    /**
     * @dev Returns the total number of RWA tokens.
     * @return The total count of tokens
     */
    function getTotalTokens() external view returns (uint256);
} 