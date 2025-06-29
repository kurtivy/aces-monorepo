// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
 
interface IRwaDeedNft is IERC721 {
    function mintDeed(address to, string calldata tokenURI) external returns (uint256);
} 