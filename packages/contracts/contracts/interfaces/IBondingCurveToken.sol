// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IBondingCurveToken is IERC20Upgradeable {
    // --- Events ---
    event Trade(
        address indexed trader, 
        address indexed subject, 
        bool isBuy, 
        uint256 tokenAmount, 
        uint256 quoteAmount, 
        uint256 platformFee, 
        uint256 ownerFee
    );
    
    event FeesClaimed(uint256 indexed deedNftId, address indexed owner, uint256 amount);

    // --- Bonding Curve Functions ---
    // Note: payable is on the Router, not here, as all trades go through $ACES
    function buy(address recipient, uint256 tokenAmount, uint256 maxPayAmount) external returns (uint256 cost);
    function sell(address recipient, uint256 tokenAmount, uint256 minReceiveAmount) external returns (uint256 proceeds);

    // --- View Functions (For UI) ---
    function getBuyPrice(uint256 tokenAmount) external view returns (uint256 cost);
    function getSellProceeds(uint256 tokenAmount) external view returns (uint256 proceeds);
    function getAccruedFees(uint256 deedNftId) external view returns (uint256);
    function getCurrentPrice() external view returns (uint256 price);

    // --- State Accessors ---
    function deedNftId() external view returns (uint256);
    function deedNftContract() external view returns (address);
    function acesToken() external view returns (address); // The token used for pricing

    // --- EIP-2612 Permit Function ---
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
} 