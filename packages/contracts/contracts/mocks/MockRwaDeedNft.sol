// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../interfaces/IRwaDeedNft.sol";

/**
 * @title MockRwaDeedNft
 * @author ACES
 * @dev ERC721A NFT contract representing ownership deeds for Real World Assets (RWAs).
 * This contract uses the ERC721A standard for gas-efficient batch minting.
 * It uses AccessControl for flexible role management, allowing multiple factories.
 */
contract MockRwaDeedNft is ERC721A, AccessControl {
    using Strings for uint256;

    // --- Constants ---
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    // --- State Variables ---
    string private _baseTokenURI;
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => bool) private _isPermanentURI;

    // --- Events ---
    event PermanentURI(string _value, uint256 indexed _id);
    event BaseURIUpdated(string oldBaseURI, string newBaseURI);

    // --- Constructor ---

    /**
     * @dev Initializes the NFT contract.
     * @param initialOwner The initial owner of the contract who gets admin role.
     */
    constructor(address initialOwner) ERC721A("ACES RWA Deed", "ACES-DEED") {
        require(initialOwner != address(0), "DeedNft: Owner cannot be zero address");
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(MINTER_ROLE, initialOwner);
    }

    // --- External Functions ---

    /**
     * @dev Mints a new deed NFT. Can only be called by addresses with MINTER_ROLE.
     * @param to The address to which the new NFT will be minted.
     * @param uri The URI suffix for the NFT's metadata.
     * @return tokenId The ID of the newly minted token.
     */
    function mintDeed(address to, string calldata uri) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(to != address(0), "DeedNft: Mint to zero address");
        
        uint256 tokenId = _nextTokenId();
        _mint(to, 1);
        _setTokenURI(tokenId, uri);
        
        // Mark URI as permanent for OpenSea
        _isPermanentURI[tokenId] = true;
        emit PermanentURI(uri, tokenId);
        
        return tokenId;
    }

    /**
     * @dev Sets the base URI for all tokens. Only callable by admin.
     * @param newBaseURI The new base URI to set.
     */
    function setBaseURI(string calldata newBaseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit BaseURIUpdated(_baseTokenURI, newBaseURI);
        _baseTokenURI = newBaseURI;
    }

    // --- View Functions ---

    /**
     * @dev Returns the base URI for token metadata.
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @dev Returns the token URI for a given token ID.
     * Combines base URI with token-specific URI if set.
     * @param tokenId The ID of the token to query.
     * @return The token URI string.
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "DeedNft: URI query for nonexistent token");

        string memory baseURI = _baseURI();
        string memory tokenSpecificURI = _tokenURIs[tokenId];

        // If there's no base URI, return the token-specific URI
        if (bytes(baseURI).length == 0) {
            return tokenSpecificURI;
        }
        // If there's no token-specific URI, return the base URI + token ID
        if (bytes(tokenSpecificURI).length == 0) {
            return string(abi.encodePacked(baseURI, tokenId.toString()));
        }
        // If both exist, concatenate them
        return string(abi.encodePacked(baseURI, tokenSpecificURI));
    }

    /**
     * @dev Returns whether a token's URI is permanent.
     * @param tokenId The ID of the token to query.
     */
    function isPermanentURI(uint256 tokenId) external view returns (bool) {
        require(_exists(tokenId), "DeedNft: Query for nonexistent token");
        return _isPermanentURI[tokenId];
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721A, AccessControl) returns (bool) {
        return
            interfaceId == type(IRwaDeedNft).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    // --- Internal Functions ---

    /**
     * @dev Sets the token URI for a specific token ID.
     * @param tokenId The token ID to set the URI for.
     * @param uri The URI to set.
     */
    function _setTokenURI(uint256 tokenId, string memory uri) internal {
        require(_exists(tokenId), "DeedNft: URI set for nonexistent token");
        _tokenURIs[tokenId] = uri;
    }

    /**
     * @dev Overrides the default starting token ID to begin at 1 instead of 0.
     * @return The starting token ID.
     */
    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }
}
 