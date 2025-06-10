# Smart Contract Development Guide (packages/contracts)

## Core Philosophy

Interface-first architecture, security-centric design, and explicit economic parameters to enable immediate, parallel, and unambiguous development. All smart contract work MUST adhere to the rules in this document.

## 1. Architectural Rules

These high-level patterns govern our entire contract system.

- **Interfaces are Final**: The interfaces in `contracts/interfaces/` are the non-negotiable API. They MUST be implemented exactly as specified.
- **Constants are Law**: `contracts/lib/AcesConstants.sol` is the single source of truth for all economic parameters and custom errors. There MUST be no magic numbers in the codebase.
- **Upgradability Pattern**: You MUST use OpenZeppelin's UUPS proxy pattern for the `BondingCurveToken.sol` contract.
- **Factory Pattern**: You MUST use a **Beacon Proxy** in `RwaFactory.sol` for gas-efficient deployment of new `BondingCurveToken.sol` instances.

---

## 2. The Blueprint: Interfaces & Constants

This section contains the exact, non-negotiable API for our smart contracts.

### `AcesConstants.sol`

This library is the single source of truth for all economic parameters.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library AcesConstants {
    // Fee Structure (Basis Points: 100 = 1%)
    uint256 public constant PLATFORM_FEE_BPS = 50; // 0.5%
    uint256 public constant OWNER_FEE_BPS = 50; // 0.5%

    // Linear Bonding Curve Parameters
    uint256 public constant CURVE_BASE_PRICE = 0.001 ether;
    uint256 public constant CURVE_SLOPE = 0.00001 ether;

    // Custom Errors for Gas Efficiency
    error InsufficientPayment(uint256 required, uint256 provided);
    error OutputAmountTooLow(uint256 expected, uint256 actual);
    error NotDeedOwner(uint256 deedId, address caller);
    error ZeroAmount();
    error TransferFailed();
}
```

### `IBondingCurveToken.sol`

The complete interface for the RWA's ERC-20 token.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBondingCurveToken is IERC20 {
    event Trade(address indexed trader, address indexed subject, bool isBuy, uint256 tokenAmount, uint256 quoteAmount, uint256 platformFee, uint256 ownerFee);
    event FeesClaimed(uint256 indexed deedNftId, address indexed owner, uint256 amount);

    function buy(address recipient, uint256 tokenAmount, uint256 maxPayAmount) external returns (uint256 cost);
    function sell(address recipient, uint256 tokenAmount, uint256 minReceiveAmount) external returns (uint256 proceeds);

    function getBuyPrice(uint256 tokenAmount) external view returns (uint256 cost);
    function getSellProceeds(uint256 tokenAmount) external view returns (uint256 proceeds);
    function getAccruedFees(uint256 deedNftId) external view returns (uint256);

    function deedNftId() external view returns (uint256);
    function deedNftContract() external view returns (address);
    function acesToken() external view returns (address); // The token used for pricing

    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
}
```

### `IRwaDeedNft.sol`

The interface for the ownership NFT.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IRwaDeedNft is IERC721 {
    function mintDeed(address to, string calldata tokenURI) external returns (uint256);
}
```

### `IRwaFactory.sol`

The interface for the factory that deploys new RWA pairs.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRwaFactory {
    event RwaCreated(address indexed tokenProxyAddress, address indexed owner, uint256 indexed deedNftId, string name, string symbol);
    function createRwa(string calldata name, string calldata symbol, string calldata tokenURI, address initialOwner) external;
}
```

---

## 3. Contract Implementation Rules

### `BondingCurveToken.sol` Implementation

- **Mathematics**: You MUST use the analytical integral of the linear curve for all cost/proceeds calculations.
  - **Formula for Buy Cost**: `Cost(n) = n * BASE_PRICE + (SLOPE * n * (2*S + n - 1)) / 2`, where S is the current supply and n is the amount to buy.
- **Fee Logic**: Fees MUST be calculated using constants from `AcesConstants.sol`. The platform fee is sent to the treasury, and the owner fee is added to the `accruedFees[deedNftId]` mapping.
- **Features**: MUST include EIP-2612 `permit()` functionality for gasless approvals.

### `RwaFactory.sol` Implementation

- **Access Control**: The `createRwa` function MUST be access-controlled (e.g., `Ownable`).
- **Workflow**: The factory MUST first mint the `RwaDeedNft` to the initial owner, then deploy the `BondingCurveToken` Beacon Proxy.

### `ZapRouter.sol` Implementation

- **Non-Custodial**: The router MUST NOT hold any funds. Any leftover "dust" from swaps must be returned to the user immediately.
- **DEX Integration**: MUST integrate with the Uniswap V3 Router on Base for ETH <-> $ACES swaps.

---

## 4. Mandatory Security Checklist & Patterns

### Error Handling Pattern

You MUST use custom errors for gas efficiency and clear signaling.

```solidity
// CORRECT: Gas-efficient custom error
if (msg.value < requiredAmount) {
    revert InsufficientPayment(requiredAmount, msg.value);
}

// AVOID: Inefficient and costly string messages
// require(msg.value >= requiredAmount, "Insufficient payment provided");
```

### Security Checklist

Every contract PR MUST be checked against this list.

- **Access Control & Permissions**:
  - Robust access control (`Ownable`, `onlyFactory`).
  - `claimFees()` verifies `msg.sender` is the current owner of the deed NFT.
  - Only the factory can mint new deed NFTs.
- **Re-entrancy & State Management**:
  - Re-entrancy guards (`nonReentrant`) on all relevant external functions.
  - The checks-effects-interactions pattern is used for all fund transfers.
  - Solidity `^0.8.20` is used to prevent overflow/underflow.
- **Financial Security**:
  - Slippage protection is enforced on all swaps via `minReceiveAmount` / `maxPayAmount` parameters.
- **Operational Security**:
  - Core contracts are `Pausable`.
  - `initialize` functions are protected by the `initializer` modifier.

---

## 5. Integration & Network Details

### Base Network Specifics

- **Testnet**: Base Sepolia
- **Mainnet**: Base
- **Uniswap V3 Router (Base Mainnet)**: `0x2626664c2603336E57B271c5C0b26F421741e481`
- **$ACES Token**: `0x...` (To be deployed and updated here)
- **Gas Optimization**: Always consider the L2 environment; write gas-conscious code.

### Frontend Integration Points

This maps UI functionality to the required on-chain functions.

- **Trade Widget Price Quote**: `getBuyPrice(amount)` or `getSellProceeds(amount)`
- **Execute Trade**: `buyRwaTokenWithEth(...)` or `sellRwaTokenForEth(...)` via `ZapRouter.sol`
- **Gasless Approval**: `permit(...)` on `BondingCurveToken.sol`
- **Owner Dashboard Fee Display**: `getAccruedFees(deedNftId)`
- **Claim Fees Button**: `claimFees(deedNftId)`

---

## 6. Development & Testing Standards

### Documentation

- Every public/external function MUST have complete NatSpec documentation (`@notice`, `@param`, `@return`).

### Testing

- Test coverage MUST be >95%, especially for financial logic.
- Fuzz testing MUST be used for all mathematical calculations.

### Audit Prep

- Critical sections of code MUST be tagged with `// [AUDIT]` comments.
- Final gas usage reports MUST be generated and reviewed before an audit.
