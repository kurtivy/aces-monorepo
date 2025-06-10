# Aces.fun: Core Philosophy, Stack & Development Plan

This document is the master brief and the ultimate source of truth for the Aces.fun project's architecture and engineering standards. It is designed to be a living document for both human and AI developers. All work must adhere to the standards and architecture defined herein.

## AI Development Guidelines (For Cursor IDE)

To ensure the AI (me) provides the most accurate and context-aware assistance, follow these rules:

- **Reference this Document**: When prompting for architectural decisions, start with "According to our master plan (@00-philosophy-and-stack.md)..."
- **Be Specific with Constraints**: When requesting code, include technology constraints. For example: "Generate a new component using Tailwind for styling and Framer Motion for animations." or "Create a new Zustand store for..."
- **Reference the Folder Structure**: When asking for new files, be precise: "Create a new shared component in `apps/frontend/components/shared/` named `Modal.tsx`."
- **Use the AI Review Checklist**: Before committing any AI-generated code, ensure it meets this checklist:
  - [ ] Follows the "Interface-First" principle.
  - [ ] Includes explicit, typed error handling (e.g., `AppError`, custom Solidity errors).
  - [ ] Is placed in the correct folder according to our structure.
  - [ ] Includes full TypeScript/Zod types.
  - [ ] Respects the performance budgets defined in this document.

## 1. Core Concept & Scope

- **Project**: Aces.fun
- **Concept**: A platform to transform high-value Real-World Assets (RWAs) into liquid, tradable digital tokens on the **Base blockchain**.
- **User Flow**: An approved RWA is tokenized into a tradable ERC-20 and an ownership "Deed" ERC-721 NFT. The token trades on a perpetual bonding curve, and the NFT owner earns a share of trading fees.
- **Out of Scope for V1**: Direct fiat on-ramps, secondary NFT marketplaces beyond bidding, mobile-native apps.

## 2. Guiding Philosophies & Quality Standards

These are the non-negotiable principles that guide all development decisions.

- **Interface-First with Mock Contracts**: We define Solidity interfaces and Zod API schemas first, then create "mock" implementations. This unblocks parallel development.
- **Security is Paramount**: All code must be written defensively. A professional security audit is the final gate before mainnet.
- **Monitoring & Observability**: The architecture must be "monitoring-friendly."
- **UX & Performance is a Feature**: The application must be fast, intuitive, and accessible.

### 2.1. Performance Standards & Budgets

- **Frontend Performance Budgets (CI/CD Gates)**:
  - **Core Web Vitals**: LCP < 2.5s, FID < 100ms, CLS < 0.1.
  - **Bundle Size**: Initial JS bundle < 250KB gzipped.
  - **Image Optimization**: All images must use the Next.js `<Image>` component.
  - **Lighthouse Score**: CI will check for a minimum score of 90 for Performance and Accessibility.
- **Smart Contract Gas Budgets (CI/CD Warnings)**:
  - Token Purchase: < 150k gas
  - Token Sale: < 120k gas
  - Claim Fees: < 80k gas
  - Deploy New Token (Factory): < 2M gas (using Beacon Proxy).

### 2.2. Explicit Error Handling Standards

- **Smart Contracts**: Use custom errors (`error InsufficientPayment(...)`) instead of `require()` strings for gas efficiency and clarity. Emit events for state changes.
- **Backend**: All errors returned via the API must be an instance of the `AppError` type. All logged errors must include a `correlationId` for tracing. Implement circuit breakers (`opossum`) for all critical external dependencies.
- **Frontend**: User-facing errors must be clean and actionable. The full technical error must be logged to Sentry with full web3 context (chainId, address, txHash).

### 2.3. A Rigorous Testing Philosophy

- **Smart Contracts**:
  - **Unit Tests**: For all public/external functions.
  - **Integration Tests**: For complex cross-contract interactions.
  - **Fuzz Testing**: For all mathematical operations (bonding curve).
  - **Gas Regression Tests**: To prevent unexpected gas cost spikes.
- **Backend**:
  - **API Contract Tests**: Using Zod schemas to validate request/response shapes.
  - **Database Integration Tests**: With a dedicated test database.
  - **Mock External Dependencies**: Isolate tests from live RPCs/IPFS.
- **Frontend**:
  - **Component Tests**: With React Testing Library, focusing on user interaction.
  - **E2E Tests**: With Playwright for critical user flows.
  - **Visual Regression Tests**: For core shared UI components.

## 3. Core Technical Architecture & Stack

- **Monorepo Manager**: **TurboRepo** with **pnpm** workspaces.
- **Code Quality**: Enforced via **ESLint** and **Prettier** configs at the root level.
- **Deployment Targets**: **Vercel** for Frontend, **Railway** for Backend.
- **Stack-at-a-Glance**:
  - **`apps/frontend`**: Next.js (App Router), Tailwind CSS/ShadCN, Privy.io (Auth), viem & wagmi (Web3).
  - **`apps/backend`**: Fastify, PostgreSQL, Prisma ORM.
  - **`packages/contracts`**: Hardhat, Solidity `>0.8.20`, OpenZeppelin.
  - **`packages/ui`**: Shared React components built with ShadCN.
  - **`packages/utils`**: Shared, non-React code (types, Zod schemas, contract ABIs).

## 4. Configuration & Environment Management

- **Environment Variables**: All env vars must be prefixed with `VITE_` for frontend and `ACES_` for backend. Every package must include a `.env.example` file.
- **Startup Validation**: All backend environment variables must be validated with a Zod schema on application startup. The server will fail to start if any variable is missing or invalid.
- **Chain Configuration**: All chain-specific configurations (contract addresses, RPC URLs, explorers) must be centralized in `packages/utils/src/chain-config.ts`.

## 5. Development Workflows & Checklists

### Daily Development Workflow

1.  **Pull latest `develop`**: `git checkout develop && git pull`.
2.  **Create a feature branch**: `git checkout -b feature/my-new-feature`.
3.  **Before coding, check for existing definitions**:
    - Does an interface already exist in `packages/contracts/interfaces/`?
    - Does a type already exist in `packages/utils/src/types.ts`?
    - Does a Zod schema already exist for the API endpoint?
4.  **Code, test, and lint.**
5.  **Submit a Pull Request** against the `develop` branch.

### Code Review Checklist

A PR will not be merged unless it passes this checklist:

- [ ] Does it adhere to the core philosophies?
- [ ] Is it fully type-safe from end-to-end?
- [ ] Does it include its own tests (unit, integration)?
- [ ] Does it handle errors and edge cases gracefully?
- [ ] Does it include structured logging for new backend logic?
- [ ] Have performance and gas budgets been considered?

## 6. Monitoring & Observability Implementation

- **Frontend Monitoring**:
  - **Sentry**: For error tracking with custom contexts (wallet address, chainId, txHash).
  - **PostHog**: For product analytics and user behavior tracking.
  - **Vercel Analytics**: For Real User Monitoring (RUM) of Web Vitals.
- **Backend Monitoring**:
  - **Winston**: For structured logging with a `correlationId` in every log entry.
  - **Railway Health Checks**: Configured to monitor the `/api/v1/health/ready` endpoint.
  - **Prisma Metrics**: For tracking query performance and potential bottlenecks.
- **Smart Contract Monitoring**:
  - **Event Indexing**: A custom subgraph using **The Graph Protocol** for efficient querying of on-chain data.
  - **Alert System**: A monitoring service (e.g., Tenderly) to send Discord/Slack notifications for unusual on-chain activity (e.g., large-volume trades, paused contracts).

## 7. Deployment Procedures

- **Frontend Deployment (Vercel)**:
  1.  Merge to `main` branch triggers an automatic deployment to production.
  2.  Preview deployments are automatically generated for all Pull Requests.
  3.  Environment variables are managed securely via the Vercel project dashboard.
- **Backend Deployment (Railway)**:
  1.  Deployment is triggered by a merge to the `main` branch.
  2.  Database migrations (`prisma migrate deploy`) are run automatically as part of the deployment process.
  3.  Health check endpoints are continuously monitored by Railway to manage service health.
- **Smart Contract Deployment**:
  1.  Deploy contracts to **Base Sepolia** testnet using Hardhat scripts.
  2.  Verify the contracts on Basescan to make source code public.
  3.  Update the contract addresses in `packages/utils/src/chain-config.ts` for the `testnet` environment.
  4.  Run the full E2E test suite against the newly deployed testnet contracts.
  5.  Deploy to **Base mainnet** _only after_ full testing is complete and the professional security audit has been passed.

## 8. Security Quick Reference

### Pre-Audit Checklist

This checklist must be fully completed before submitting contracts for an external audit.

- [ ] All contracts have complete NatSpec documentation for every function.
- [ ] Test coverage is >95% on all financial and access-control logic.
- [ ] Slither static analysis passes with no high/medium severity issues.
- [ ] All external calls are protected with re-entrancy guards (`nonReentrant` modifier).
- [ ] All user-provided inputs are validated (e.g., non-zero address checks).
- [ ] Economic parameters in `AcesConstants.sol` have been reviewed and finalized.

## 9. Monorepo Folder Structure

This is the canonical folder structure. Do not deviate from it.
Use code with caution.
Markdown
/aces-monorepo/
├── apps/
│ ├── frontend/ # Next.js dApp (Vercel target)
│ │ ├── app/
│ │ │ ├── (canvas)/
│ │ │ └── tokens/[address]/
│ │ ├── components/
│ │ │ ├── canvas/
│ │ │ └── shared/
│ │ ├── hooks/
│ │ └── lib/ # viem, wagmi, privy setup
│ └── backend/ # Fastify API (Railway target)
│ ├── prisma/
│ │ └── schema.prisma
│ └── src/
│ ├── routes/
│ └── services/
└── packages/
├── contracts/ # Hardhat Smart Contracts
│ ├── contracts/
│ │ ├── interfaces/ # THE BLUEPRINT
│ │ ├── mocks/ # Mock implementations for fast dev
│ │ └── ... # Real contracts
│ └── test/
├── ui/ # Shared React components (ShadCN)
└── utils/ # Shared, non-React code
├── src/
│ ├── abis.ts
│ ├── types.ts
│ └── zod-schemas.ts

## 10. The 8-Week V1 Development Plan

This is the official project timeline and phased plan.

- **Phase 0: Project Ignition (Week 1)**
  - **Goal**: Deploy the marketing homepage (Infinite Canvas) to the live domain.
- **Phase 1: The "Headless" Engine (Weeks 2-4)**
  - **Goal**: Build the core backend and smart contract infrastructure in parallel.
  - **Key Tasks**: Finalize interfaces, deploy **mock contracts**, build the DB schema and submission API.
- **Phase 2: The dApp Frontend Integration (Weeks 5-7)**
  - **Goal**: Build the full user-facing application, connecting to the **mock** backend and contracts.
- **Phase 3: The Swap-Out & Hardening (Week 8)**
  - **Goal**: Replace all mock components with final contracts and conduct rigorous E2E testing.
  - **Milestone**: Code freeze. The dApp is now feature-complete and ready for a professional security audit.
