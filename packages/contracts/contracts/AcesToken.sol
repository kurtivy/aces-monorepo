// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title AcesToken
 * @author ACES
 * @dev ERC20 token used as the platform currency for RWA trading.
 * Implements supply cap and role-based access control for better security.
 */
contract AcesToken is ERC20, ERC20Permit, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**18; // 100M tokens

    event SupplyCapReached(uint256 attemptedMintAmount);

    constructor(address initialAdmin) ERC20("ACES Token", "ACES") ERC20Permit("ACES Token") {
        require(initialAdmin != address(0), "AcesToken: Admin cannot be zero address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(MINTER_ROLE, initialAdmin);
        _grantRole(BURNER_ROLE, initialAdmin);
    }

    /**
     * @dev Mints new tokens, respecting the max supply cap.
     * @param to The address that will receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(to != address(0), "AcesToken: Mint to zero address");
        
        uint256 currentSupply = totalSupply();
        require(currentSupply + amount <= MAX_SUPPLY, "AcesToken: Max supply exceeded");
        
        _mint(to, amount);
        
        // Emit event if we're getting close to the cap
        if (currentSupply + amount > (MAX_SUPPLY * 90) / 100) {
            emit SupplyCapReached(amount);
        }
    }

    /**
     * @dev Burns tokens, can only be called by addresses with BURNER_ROLE.
     * @param amount The amount of tokens to burn.
     */
    function burn(uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(msg.sender, amount);
    }

    /**
     * @dev Burns tokens from a specific address, requires approval.
     * @param from The address to burn tokens from.
     * @param amount The amount of tokens to burn.
     */
    function burnFrom(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        uint256 currentAllowance = allowance(from, msg.sender);
        require(currentAllowance >= amount, "AcesToken: Burn amount exceeds allowance");
        unchecked {
            _approve(from, msg.sender, currentAllowance - amount);
        }
        _burn(from, amount);
    }

    /**
     * @dev Returns the remaining amount that can be minted before reaching max supply.
     */
    function remainingMintableSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
} 