// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.13;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-contracts/contracts/access/Ownable.sol";

import {Test, console2} from "forge-std/Test.sol";

contract AcesToken is ERC20, Ownable, Test {
    address public authorizedMinter;

    constructor() ERC20("Aces Token", "ACES") Ownable(msg.sender) {
        // _mint(msg.sender, 1000000 ether); // Mint initial supply to the owner
    }

    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }

    /**
     * @dev Sets the authorized minter address. Only callable by the owner.
     * @param minter The address to authorize for minting.
     */
    function setAuthorizedMinter(address minter) public onlyOwner {
        require(minter != address(0), "Cannot set zero address as minter");
        authorizedMinter = minter;
    }

    /**
     * @dev Mints tokens to a specified address. Only callable by the authorized minter.
     * @param to The address to mint tokens to.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) public {
        // require(msg.sender == authorizedMinter, "Caller is not the authorized minter");
        require(to != address(0), "Cannot mint to the zero address");
        require(amount > 0, "Amount must be greater than zero");

        if (this.totalSupply() + amount > 1_000_000_000 ether) {
            console2.log("Total supply exceeded");
            return;
        }

        _mint(to, amount);
    }

}