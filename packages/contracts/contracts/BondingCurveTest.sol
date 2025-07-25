// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IAcesTest {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

contract BondingCurveTest is ReentrancyGuard, Ownable {
    IAcesTest public token;
    
    // Scaled down parameters
    uint256 public constant MAX_SUPPLY = 10_000_000 * 1e18; // 10M tokens total
    uint256 public constant BONDING_CURVE_SUPPLY = 8_000_000 * 1e18; // 8M tokens in bonding curve
    uint256 public constant TARGET_RAISE_USD = 1000; // $1,000 target
    
    // ETH price for USD conversion (can be updated)
    uint256 public ethPriceUSD = 3000; // $3,000 per ETH
    
    // Exponential curve parameters
    uint256 public constant BASE_PRICE = 1e12; // 0.000001 ETH (1000 gwei) starting price
    uint256 public constant GROWTH_RATE = 1000000001157920892; // ~1.0001^1 in fixed point (18 decimals)
    
    // Track state per room (using roomNumber as key)
    struct Room {
        uint256 tokenSupply;
        uint256 totalETHRaised;
        mapping(address => uint256) balances;
    }
    
    // sharesSubject => roomNumber => Room
    mapping(address => mapping(uint256 => Room)) public rooms;
    
    // Events
    event SharesPurchased(address indexed buyer, address indexed sharesSubject, uint256 roomNumber, uint256 amount, uint256 ethCost);
    event SharesSold(address indexed seller, address indexed sharesSubject, uint256 roomNumber, uint256 amount, uint256 ethReceived);
    event ETHPriceUpdated(uint256 newPrice);
    
    constructor(address _token) Ownable() {
        require(_token != address(0), "Invalid token address");
        token = IAcesTest(_token);
    }
    
    /**
     * @dev Calculate price using exponential bonding curve
     * @param supply Current token supply
     * @return price in ETH (18 decimals)
     */
    function calculatePrice(uint256 supply) public pure returns (uint256) {
        if (supply >= BONDING_CURVE_SUPPLY) {
            // Fixed price after bonding curve is complete
            return BASE_PRICE * 2; // 2x the base price
        }
        
        // Exponential curve: price = BASE_PRICE * (GROWTH_RATE)^supply
        // For simplicity, using approximation: price = BASE_PRICE * (1 + supply/BONDING_CURVE_SUPPLY)^2
        uint256 progress = (supply * 1e18) / BONDING_CURVE_SUPPLY; // Progress as percentage (18 decimals)
        uint256 multiplier = 1e18 + progress; // 1 + progress
        uint256 price = (BASE_PRICE * multiplier * multiplier) / (1e18 * 1e18); // Square for exponential effect
        
        return price;
    }
    
    /**
     * @dev Get price for buying/selling tokens (matches your dev's interface)
     * @param sharesSubject The token contract address
     * @param roomNumber Room identifier (always 0 for your case)
     * @param amount Amount of tokens to buy/sell
     * @param isBuy True for buying, false for selling
     * @return Total ETH cost/received
     */
    function getPrice(
        address sharesSubject,
        uint256 roomNumber,
        uint256 amount,
        bool isBuy
    ) public view returns (uint256) {
        require(sharesSubject == address(token), "Invalid shares subject");
        require(amount > 0, "Amount must be greater than 0");
        
        Room storage room = rooms[sharesSubject][roomNumber];
        uint256 currentSupply = room.tokenSupply;
        
        if (isBuy) {
            // Calculate cost to buy 'amount' tokens
            uint256 totalCost = 0;
            for (uint256 i = 0; i < amount; i += 1e18) { // Iterate by 1 token
                uint256 tokensToBuy = (i + 1e18 <= amount) ? 1e18 : (amount - i);
                uint256 pricePerToken = calculatePrice(currentSupply + i);
                totalCost += (pricePerToken * tokensToBuy) / 1e18;
            }
            return totalCost;
        } else {
            // Calculate ETH received for selling 'amount' tokens
            require(currentSupply >= amount, "Not enough tokens in circulation");
            uint256 totalReceived = 0;
            for (uint256 i = 0; i < amount; i += 1e18) { // Iterate by 1 token
                uint256 tokensToSell = (i + 1e18 <= amount) ? 1e18 : (amount - i);
                uint256 pricePerToken = calculatePrice(currentSupply - i - tokensToSell);
                totalReceived += (pricePerToken * tokensToSell) / 1e18;
            }
            return totalReceived;
        }
    }
    
    /**
     * @dev Buy shares (matches your dev's interface)
     * @param sharesSubject The token contract address
     * @param roomNumber Room identifier (always 0 for your case)
     * @param amount Amount of tokens to buy
     */
    function buyShares(
        address sharesSubject,
        uint256 roomNumber,
        uint256 amount
    ) external payable nonReentrant {
        require(sharesSubject == address(token), "Invalid shares subject");
        require(amount > 0, "Amount must be greater than 0");
        
        Room storage room = rooms[sharesSubject][roomNumber];
        require(room.tokenSupply + amount <= BONDING_CURVE_SUPPLY, "Exceeds bonding curve supply");
        
        uint256 cost = getPrice(sharesSubject, roomNumber, amount, true);
        require(msg.value >= cost, "Insufficient ETH sent");
        
        // Update room state
        room.tokenSupply += amount;
        room.totalETHRaised += cost;
        room.balances[msg.sender] += amount;
        
        // Mint tokens to user
        token.mint(msg.sender, amount);
        
        // Refund excess ETH
        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }
        
        emit SharesPurchased(msg.sender, sharesSubject, roomNumber, amount, cost);
    }
    
    /**
     * @dev Sell shares back to the curve
     * @param sharesSubject The token contract address
     * @param roomNumber Room identifier
     * @param amount Amount of tokens to sell
     */
    function sellShares(
        address sharesSubject,
        uint256 roomNumber,
        uint256 amount
    ) external nonReentrant {
        require(sharesSubject == address(token), "Invalid shares subject");
        require(amount > 0, "Amount must be greater than 0");
        
        Room storage room = rooms[sharesSubject][roomNumber];
        require(room.balances[msg.sender] >= amount, "Insufficient balance");
        require(token.balanceOf(msg.sender) >= amount, "Insufficient token balance");
        
        uint256 ethToReceive = getPrice(sharesSubject, roomNumber, amount, false);
        require(address(this).balance >= ethToReceive, "Insufficient contract ETH balance");
        
        // Update room state
        room.tokenSupply -= amount;
        room.totalETHRaised -= ethToReceive;
        room.balances[msg.sender] -= amount;
        
        // Burn tokens from user
        token.burn(msg.sender, amount);
        
        // Send ETH to user
        payable(msg.sender).transfer(ethToReceive);
        
        emit SharesSold(msg.sender, sharesSubject, roomNumber, amount, ethToReceive);
    }
    
    /**
     * @dev Get token balance for a user (matches your dev's interface)
     * @param sharesSubject The token contract address
     * @param roomNumber Room identifier
     * @param holder Address of the token holder
     * @return User's token balance
     */
    function getTokenBalance(
        address sharesSubject,
        uint256 roomNumber,
        address holder
    ) external view returns (uint256) {
        require(sharesSubject == address(token), "Invalid shares subject");
        return rooms[sharesSubject][roomNumber].balances[holder];
    }
    
    /**
     * @dev Get total token supply (matches your dev's interface)
     * @param sharesSubject The token contract address
     * @param roomNumber Room identifier
     * @return Total tokens sold in this room
     */
    function getTokenSupply(
        address sharesSubject,
        uint256 roomNumber
    ) external view returns (uint256) {
        require(sharesSubject == address(token), "Invalid shares subject");
        return rooms[sharesSubject][roomNumber].tokenSupply;
    }
    
    /**
     * @dev Get current price per token (helper function for your UI)
     * @param sharesSubject The token contract address
     * @param roomNumber Room identifier
     * @return Current price per token in ETH
     */
    function getCurrentPrice(
        address sharesSubject,
        uint256 roomNumber
    ) external view returns (uint256) {
        return getPrice(sharesSubject, roomNumber, 1e18, true); // Price for 1 token
    }
    
    /**
     * @dev Get room statistics (helper for your UI)
     * @param sharesSubject The token contract address
     * @param roomNumber Room identifier
     * @return tokenSupply Total tokens sold
     * @return totalETHRaised Total ETH raised
     * @return currentPrice Current price per token
     * @return progress Progress percentage (0-100)
     */
    function getRoomStats(
        address sharesSubject,
        uint256 roomNumber
    ) external view returns (
        uint256 tokenSupply,
        uint256 totalETHRaised,
        uint256 currentPrice,
        uint256 progress
    ) {
        require(sharesSubject == address(token), "Invalid shares subject");
        
        Room storage room = rooms[sharesSubject][roomNumber];
        tokenSupply = room.tokenSupply;
        totalETHRaised = room.totalETHRaised;
        currentPrice = getPrice(sharesSubject, roomNumber, 1e18, true);
        progress = (tokenSupply * 100) / BONDING_CURVE_SUPPLY;
    }
    
    /**
     * @dev Update ETH price for USD calculations (only owner)
     * @param newPrice New ETH price in USD
     */
    function updateETHPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Price must be greater than 0");
        ethPriceUSD = newPrice;
        emit ETHPriceUpdated(newPrice);
    }
    
    /**
     * @dev Withdraw contract ETH (only owner, for emergency)
     */
    function withdrawETH() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    /**
     * @dev Get contract ETH balance
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
} 