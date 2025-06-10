# Frontend Development Guide (apps/frontend)

## Core Philosophy

Our frontend is a resilient, performant, and secure web3-native application designed for **operational maturity**. It is built on a robust state management architecture, prioritizes a mobile-first responsive design, and is supported by a comprehensive observability and testing strategy. The system is designed not just to function, but to be monitored, maintained, and scaled with confidence.

---

## 1. Foundation & Architectural Decisions

These are the non-negotiable architectural patterns that govern the entire application.

### Concrete File Structure

All new files and folders MUST adhere to this structure.

```
apps/frontend/
├── app/
│ ├── (main)/ # Public-facing routes (e.g., marketing, token list)
│ │ └── page.tsx
│ ├── (dashboard)/ # Authenticated user routes (e.g., my submissions, admin)
│ │ └── layout.tsx # Layout with wallet checks
│ └── layout.tsx # Root layout with providers
├── components/
│ ├── shared/ # Generic, reusable components (e.g., button.tsx, modal.tsx)
│ ├── web3/ # Web3-specific components (e.g., wallet-connect-button.tsx, tx-status-indicator.tsx)
│ └── ui/ # Low-level design system components from ShadCN
├── hooks/
│ ├── web3/ # Core web3 logic hooks (e.g., use-transaction-manager.ts, use-chain-manager.ts)
│ └── api/ # TanStack Query hooks for backend API calls
└── stores/ # Zustand client-state stores (e.g., ui-store.ts)
```

### State Management Architecture

The separation of state is strict and must be followed.

- **Server State (TanStack Query)**: MUST be used for all backend API interactions.

  ```typescript
  // hooks/api/use-token-balance.ts
  // [PATTERN] TanStack Query for on-chain reads
  import { useQuery } from "@tanstack/react-query";
  import { readContract } from "@wagmi/core";

  export const useTokenBalance = (
    address?: `0x${string}`,
    tokenAddress?: `0x${string}`
  ) => {
    return useQuery({
      queryKey: ["tokenBalance", address, tokenAddress],
      queryFn: () =>
        readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address!],
        }),
      enabled: !!address && !!tokenAddress,
      refetchInterval: 30000, // Refresh balance every 30 seconds
      staleTime: 15000,
    });
  };
  ```

- **Client State (Zustand)**: MUST be used for ephemeral, global UI state.
- **Web3 State (`useWeb3State`)**: This composed hook is the single source of truth for wallet state, defined in `hooks/web3/use-web3-state.ts`.

  ```typescript
  // hooks/web3/use-web3-state.ts
  // [PATTERN] Composing a clean Web3 state hook
  import { useAccount, useNetwork } from "wagmi";
  import { usePrivy } from "@privy-io/react-auth";
  import { base as baseChain } from "wagmi/chains";

  export const useWeb3State = () => {
    const { address, isConnected: isWagmiConnected } = useAccount();
    const { chain } = useNetwork();
    const { user } = usePrivy();

    return {
      address,
      isConnected: isWagmiConnected && !!user,
      chainId: chain?.id,
      isWrongNetwork: isWagmiConnected && chain?.id !== baseChain.id,
    };
  };
  ```

### Next.js App Router & Component Strategy

- **Server Components by Default**: Components MUST be Server Components unless they require interactivity.
- **Performance Patterns**:
  - **Code Splitting**: Routes are automatically code-split. For large, non-critical components, you MUST use dynamic imports with `next/dynamic`. The component file should be kebab-case, e.g. `trading-widget.tsx`.
    ```typescript
    import dynamic from "next/dynamic";
    const TradingWidget = dynamic(() => import("./trading-widget"), {
      ssr: false,
    });
    ```
  - **Streaming UI**: You MUST use `<Suspense>` boundaries to stream UI from the server.

---

## 2. Core Web3 Architecture & Patterns

### `useTransactionManager` Hook (`hooks/web3/use-transaction-manager.ts`)

- **Centralized Logic**: ALL on-chain write transactions MUST be managed by this hook.
- **State Interface**: The hook will return an object matching this shape:
  ```typescript
  interface TransactionManagerState {
    status:
      | "IDLE"
      | "AWAITING_SIGNATURE"
      | "PENDING_CONFIRMATION"
      | "SUCCESS"
      | "ERROR";
    txHash?: string;
    error?: Web3Error; // Our custom typed error
    gasEstimate?: bigint;
  }
  ```

### Error Handling & Resilience

- **Typed Errors**: We use a custom error enum to categorize web3 issues.
  ```typescript
  export enum Web3ErrorType {
    USER_REJECTED = "USER_REJECTED",
    INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",
    NETWORK_ERROR = "NETWORK_ERROR",
    CONTRACT_ERROR = "CONTRACT_ERROR",
    UNKNOWN = "UNKNOWN",
  }
  ```
- **User-Friendly Messages**: We map error types to clean, user-facing messages.
  ```typescript
  export const WEB3_ERROR_MESSAGES: Record<Web3ErrorType, string> = {
    [Web3ErrorType.USER_REJECTED]: "Transaction was cancelled by user.",
    [Web3ErrorType.INSUFFICIENT_FUNDS]:
      "You have insufficient balance for this transaction.",
    // ... other messages
  };
  ```

### Frontend Security Hardening

- **Pre-flight Checks**: Before initiating a transaction, you MUST check for sufficient balance and approvals.
- **Transaction Simulation**: Before requesting a signature, you SHOULD simulate the transaction using `viem`'s public client to catch potential reverts early.
- **Slippage Protection**: The UI MUST allow users to set a slippage tolerance (e.g., 0.5%), which is then used to calculate the `minReceiveAmount` or `maxPayAmount` for the transaction.

---

## 3. Implementation, Testing & Observability

### Performance Budgets & CI/CD

- **Budgets**: LCP < 2.5s, Initial JS < 250KB gzipped. These are enforced in the CI pipeline.
- **Bundle Analysis**: The `pnpm build:analyze` command MUST be used to investigate bundle size regressions.

### Accessibility (A11y)

- **ARIA Standards**: All interactive elements MUST have appropriate ARIA labels (e.g., `aria-label="Connect your wallet"`).
- **Keyboard Navigation**: All core user flows MUST be fully navigable using only the keyboard.
- **Screen Readers**: Use `aria-live` regions to announce dynamic status changes (e.g., "Transaction confirmed").
- **Color Contrast**: All text must meet WCAG AA contrast ratios.

### Testing Strategy

- **Full Pyramid**: Unit (Vitest), Integration (RTL), and E2E (Playwright) tests are required.
- **Wallet Mocking**: You MUST use wallet provider mocking in CI for reliable testing of web3 interactions.

### Observability & Monitoring

- **Error Tracking**: **Sentry** MUST be configured to capture the full web3 context.
- **Web3 Analytics**: We MUST track key user events using the following constants:
  ```typescript
  export const WEB3_ANALYTICS_EVENTS = {
    WALLET_CONNECTED: "Wallet Connected",
    TRANSACTION_INITIATED: "Transaction Initiated",
    TRANSACTION_SIGNED: "Transaction Signed",
    TRANSACTION_CONFIRMED: "Transaction Confirmed",
    TRANSACTION_FAILED: "Transaction Failed",
    RPC_ERROR: "RPC Provider Error",
  } as const;
  ```

---

## 4. Development Workflow

### Standard Commands

```bash
# Start the development server with hot reload
pnpm dev

# Run all tests (unit and integration)
pnpm test

# Run Playwright E2E tests against a forked network
pnpm test:e2e

# Check for linting and formatting errors
pnpm lint

# Analyze the production bundle size
pnpm build:analyze
```

### Creating a New Component

- **Check for Existing Components**: Look in `components/shared`, `components/web3`, and `packages/ui`.
- **Use the Template**: When creating a new file, use the template at `@templates/react-component.tsx` as a base.
- **Determine Component Type**: Default to Server Components; use `'use client'` only when state or event listeners are needed.
- **Incorporate Core Hooks**: Use our custom hooks (e.g., `useWeb3State` from `use-web3-state.ts`, `useTransactionManager` from `use-transaction-manager.ts`, etc.) for all web3 logic.
