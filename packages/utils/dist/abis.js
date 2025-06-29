"use strict";
// Contract ABIs - These will be populated from compiled contracts
// Following the interfaces defined in smart-contract.md
Object.defineProperty(exports, "__esModule", { value: true });
exports.ABIS = exports.BONDING_CURVE_TOKEN_ABI = exports.FACTORY_ABI = exports.DEED_NFT_ABI = exports.ACES_TOKEN_ABI = void 0;
exports.getABI = getABI;
// AcesToken.sol - Standard ERC20 ABI
exports.ACES_TOKEN_ABI = [
    // Standard ERC20 functions
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) returns (bool)',
    // Events
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)',
];
// IRwaDeedNft.sol - Following the interface from smart-contract.md
exports.DEED_NFT_ABI = [
    // ERC721 standard functions
    'function balanceOf(address owner) view returns (uint256)',
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function safeTransferFrom(address from, address to, uint256 tokenId)',
    'function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)',
    'function transferFrom(address from, address to, uint256 tokenId)',
    'function approve(address to, uint256 tokenId)',
    'function setApprovalForAll(address operator, bool approved)',
    'function getApproved(uint256 tokenId) view returns (address)',
    'function isApprovedForAll(address owner, address operator) view returns (bool)',
    // Custom functions from IRwaDeedNft
    'function mintDeed(address to, string tokenURI) returns (uint256)',
    // Events
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
    'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
    'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)',
];
// IRwaFactory.sol - Following the interface from smart-contract.md
exports.FACTORY_ABI = [
    // Factory functions
    'function createRwa(string name, string symbol, string tokenURI, address initialOwner)',
    // Events
    'event RwaCreated(address indexed tokenProxyAddress, address indexed owner, uint256 indexed deedNftId, string name, string symbol)',
];
// IBondingCurveToken.sol - Following the interface from smart-contract.md
exports.BONDING_CURVE_TOKEN_ABI = [
    // ERC20 standard functions
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) returns (bool)',
    // Bonding curve functions
    'function buy(address recipient, uint256 tokenAmount, uint256 maxPayAmount) returns (uint256 cost)',
    'function sell(address recipient, uint256 tokenAmount, uint256 minReceiveAmount) returns (uint256 proceeds)',
    // View functions for UI
    'function getBuyPrice(uint256 tokenAmount) view returns (uint256 cost)',
    'function getSellProceeds(uint256 tokenAmount) view returns (uint256 proceeds)',
    'function getAccruedFees(uint256 deedNftId) view returns (uint256)',
    // State accessors
    'function deedNftId() view returns (uint256)',
    'function deedNftContract() view returns (address)',
    'function acesToken() view returns (address)',
    // EIP-2612 Permit
    'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
    // Events
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)',
    'event Trade(address indexed trader, address indexed subject, bool isBuy, uint256 tokenAmount, uint256 quoteAmount, uint256 platformFee, uint256 ownerFee)',
    'event FeesClaimed(uint256 indexed deedNftId, address indexed owner, uint256 amount)',
];
// Export all ABIs as a single object for convenience
exports.ABIS = {
    acesToken: exports.ACES_TOKEN_ABI,
    deedNft: exports.DEED_NFT_ABI,
    factory: exports.FACTORY_ABI,
    bondingCurveToken: exports.BONDING_CURVE_TOKEN_ABI,
};
// Helper function to get ABI by contract type
function getABI(contractType) {
    return exports.ABIS[contractType];
}
