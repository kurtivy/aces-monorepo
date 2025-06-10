# Smart Contract Development Plan (V2.0 - Final)

## Core Philosophy

Interface-first architecture, security-centric design, and explicit economic parameters to enable immediate, parallel, and unambiguous development.

---

## Part 1: The Blueprint - Contract Interfaces (The Unbreakable API)

**Goal**: Create the final, complete, and non-negotiable "API" for our contracts. This is Step 1 for the entire project.

### Step 1.1: Define Global Constants & Custom Errors

**File**: `packages/contracts/contracts/lib/AcesConstants.sol`
**Purpose**: A single, importable source of truth for all economic parameters and custom errors. This prevents magic numbers and ensures gas-efficient reverts.

```solidity
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

library AcesConstants {

// --- Fee Structure (Basis Points: 100 = 1%) ---

uint256 public constant PLATFORM_FEE_BPS = 50; // 0.5%

uint256 public constant OWNER_FEE_BPS = 50; // 0.5% (Total 1% fee)

// --- Linear Bonding Curve Parameters ---

// Price = BASE_PRICE + (SLOPE \* totalSupply)

uint256 public constant CURVE_BASE_PRICE = 0.001 ether;

uint256 public constant CURVE_SLOPE = 0.00001 ether; // Price increases by this much for each token minted

// --- Custom Errors for Gas Efficiency ---

error InsufficientPayment(uint256 required, uint256 provided);

error OutputAmountTooLow(uint256 expected, uint256 actual); // For slippage

error NotDeedOwner(uint256 deedId, address caller);

error ZeroAmount();

error TransferFailed();

}
```

### Step 1.2: Create `IBondingCurveToken.sol`

**File**: `packages/contracts/contracts/interfaces/IBondingCurveToken.sol`
**Purpose**: Defines the complete interface for an RWA token, incorporating your feedback.

```solidity
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBondingCurveToken is IERC20 {

// --- Events ---

event Trade(address indexed trader, address indexed subject, bool isBuy, uint256 tokenAmount, uint256 quoteAmount, uint256 platformFee, uint256 ownerFee);

event FeesClaimed(uint256 indexed deedNftId, address indexed owner, uint256 amount);

// --- Bonding Curve Functions ---

// Note: payable is on the Router, not here, as all trades go through $ACES

function buy(address recipient, uint256 tokenAmount, uint256 maxPayAmount) external returns (uint256 cost);

function sell(address recipient, uint256 tokenAmount, uint256 minReceiveAmount) external returns (uint256 proceeds);

// --- View Functions (For UI) ---

function getBuyPrice(uint256 tokenAmount) external view returns (uint256 cost);

function getSellProceeds(uint256 tokenAmount) external view returns (uint256 proceeds);

function getAccruedFees(uint256 deedNftId) external view returns (uint256);

// --- State Accessors ---

function deedNftId() external view returns (uint256);

function deedNftContract() external view returns (address);

function acesToken() external view returns (address); // The token used for pricing

// --- EIP-2612 Permit Function ---

function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;

}
```

### Step 1.3: Create `IRwaDeedNft.sol`

(No changes needed, your original feedback was perfect)

```solidity
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IRwaDeedNft is IERC721 {

function mintDeed(address to, string calldata tokenURI) external returns (uint256);

}
```

### Step 1.4: Create `IRwaFactory.sol`

(No changes needed, your original feedback was perfect)

```solidity
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface IRwaFactory {

event RwaCreated(

address indexed tokenProxyAddress,

address indexed owner,

uint256 indexed deedNftId,

string name,

string symbol

);

function createRwa(

string calldata name,

string calldata symbol,

string calldata tokenURI,

address initialOwner

) external;

}
```

---

## Part 2: The Core Engine - Contract Implementations

**Goal**: Build the secure, upgradable, and feature-complete implementations of our finalized interfaces.

- **`AcesToken.sol` ($ACES Platform Token)**: No changes. A standard OZ ERC20 contract.
- **`RwaDeedNft.sol` (The Deed NFT)**: Key Implementation Detail: The `mintDeed` function must have an `onlyOwner` or `onlyFactory` modifier to ensure only your `RwaFactory` contract can mint new NFTs.
- **`BondingCurveToken.sol` (The RWA Token Implementation)**:
  - **Upgradability**: Use OpenZeppelin's UUPS proxy pattern (`ERC20Upgradeable`, `PausableUpgradeable`, etc.).
  - **Initialization**: The `initialize` function will set up the token's name, symbol, `deedNftId`, `deedNftContract`, and `acesToken` address. It must be protected by an `initializer` modifier.
  - **Mathematics**:
    - The implementation must use the analytical integral of the linear curve defined in `AcesConstants.sol` for cost/proceeds calculations.
    - **Formula for Cost**: `Cost(n) = n * BASE_PRICE + (SLOPE * n * (2*S + n - 1)) / 2` where `S` is current supply and `n` is amount to buy. Your dev must derive and test this.
  - **Fee Logic**: On every trade, calculate fees based on `PLATFORM_FEE_BPS` and `OWNER_FEE_BPS` from the total cost/proceeds. The platform fee is sent to the fee wallet, and the owner fee is added to an `accruedFees[deedNftId]` mapping.
  - **Security**: `claimFees` function must verify `msg.sender == deedNftContract.ownerOf(deedNftId)` before transferring funds. Use checks-effects-interactions pattern to prevent re-entrancy.
- **`RwaFactory.sol` (The Factory)**:
  - **Key Implementation Detail**: It will use `BeaconProxy` for deploying new `BondingCurveToken` instances. This is a highly gas-efficient way to deploy multiple upgradable contracts that share the same implementation logic. The factory holds the "beacon," and each RWA token is a simple proxy pointing to it.
- **`ZapRouter.sol` (The User-Friendly Router)**:
  - **DEX Integration**: The contract will interact with the Uniswap V3 Router on Base. It needs to handle `exactInputSingle` and `exactOutputSingle` swaps between ETH and `$ACES`.
  - **Oracle/Price Feed**: For calculating slippage against `$ACES`, the router does not need a Chainlink oracle. The required price information (`sqrtPriceLimitX96`) is a parameter you provide to the Uniswap V3 functions directly. Your frontend will calculate this parameter based on the user's desired slippage tolerance (e.g., 0.5%) just before calling the transaction.
  - **Functions**:
    - `buyRwaTokenWithEth(address tokenAddress, uint256 tokenAmount, uint256 maxEthAmount)`: This function will be `payable`. It performs ETH -> $ACES -> RWA-Token. It reverts if `msg.value > maxEthAmount`.
    - `sellRwaTokenForEth(address tokenAddress, uint256 tokenAmount, uint256 minEthAmount)`: This performs RWA-Token -> $ACES -> ETH. It reverts if the final ETH received is less than `minEthAmount`.
  - **Security**: The router must be non-custodial. Any leftover "dust" from swaps should be immediately returned to the user. All external calls must be trusted (i.e., only to the official Uniswap contract).

---

## Part 3: Audit Readiness & Best Practices (Ongoing Tasks)

(This section remains the same as it represents best-in-class development practices.)

- **NatSpec Documentation**: Complete for every public/external function.
- **Static Analysis**: Regularly run Slither.
- **Test Coverage**: Maintain >95% coverage, especially for mathematical and financial logic. Use `solidity-coverage`.
- **Code Tagging**: Use `// [AUDIT]` comments to highlight critical sections.
- **Final Reports**: Generate and review gas usage and final ABI specs before submitting to auditors.

This revised plan is now complete, unambiguous, and technically sound. It provides your development team with everything they need to start building immediately and in parallel, with a clear and shared understanding of the final product. This is a 10/10 technical specification for the smart contract build-out.
