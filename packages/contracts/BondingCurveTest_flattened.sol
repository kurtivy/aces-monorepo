

// Sources flattened with hardhat v2.25.0 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/utils/Context.sol@v4.9.3

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (utils/Context.sol)

pragma solidity ^0.8.0;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }
}


// File @openzeppelin/contracts/access/Ownable.sol@v4.9.3

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (access/Ownable.sol)

pragma solidity ^0.8.0;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() {
        _transferOwnership(_msgSender());
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}


// File @openzeppelin/contracts/security/ReentrancyGuard.sol@v4.9.3

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (security/ReentrancyGuard.sol)

pragma solidity ^0.8.0;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be _NOT_ENTERED
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");

        // Any calls to nonReentrant after this point will fail
        _status = _ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == _ENTERED;
    }
}


// File contracts/BondingCurveTest.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.19;


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
