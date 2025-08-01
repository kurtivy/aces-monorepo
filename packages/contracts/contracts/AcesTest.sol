// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AcesTest is ERC20, Ownable {
    address public bondingCurve;
    
    constructor() ERC20("AcesTest", "ACEST") Ownable() {
        // Total supply will be minted through bonding curve
        // No initial supply minted here
    }
    
    /**
     * @dev Set the bonding curve contract address
     * @param _bondingCurve Address of the bonding curve contract
     */
    function setBondingCurve(address _bondingCurve) external onlyOwner {
        require(_bondingCurve != address(0), "Invalid bonding curve address");
        bondingCurve = _bondingCurve;
    }
    
    /**
     * @dev Mint tokens - only callable by bonding curve contract
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external {
        require(msg.sender == bondingCurve, "Only bonding curve can mint");
        require(to != address(0), "Cannot mint to zero address");
        _mint(to, amount);
    }
    
    /**
     * @dev Burn tokens - only callable by bonding curve contract
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burn(address from, uint256 amount) external {
        require(msg.sender == bondingCurve, "Only bonding curve can burn");
        require(from != address(0), "Cannot burn from zero address");
        _burn(from, amount);
    }
    
    /**
     * @dev Get decimals (18 for standard ERC20)
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
} 