# The 8-Week V1 Build Plan: From Marketing Page to Audit-Ready dApp

## Phase 0: Project Ignition & Marketing Launch (Week 1)

**Goal**: Deploy the interactive Infinite Canvas homepage to the live domain to serve as the marketing entry point. This is a high-intensity setup and deployment week.

- **Monorepo Foundation**:
  - [ ] Initialize the project directory. Run `pnpm init`.
  - [ ] Configure `pnpm-workspace.yaml` to recognize `apps/*` and `packages/*`.
  - [ ] Install and configure TurboRepo (`pnpm add -w turbo`).
  - [ ] Set up root `tsconfig.json`, eslint, and prettier configurations for consistent code quality.
- **Project Hosting & Git**:
  - [ ] Create the GitHub repository and push the initial monorepo structure.
  - [ ] Create the Vercel project, link it to the GitHub repo, and configure it to target the `apps/frontend` directory.
- **Porting The Canvas**:
  - [ ] Create the Next.js app inside `apps/frontend`.
  - [ ] Carefully move your existing `infinite-canvas.tsx` and its related components, hooks, and types into the new structure as shown in the folder map.
  - [ ] Create a temporary `public/images.json` file to act as the data source for the canvas images.
  - [ ] Adjust all imports to work within the new monorepo structure.
- **Deployment**:
  - [ ] Test the canvas locally to ensure everything works.
  - [ ] Push the code to a `develop` branch to trigger a Vercel preview deployment.
  - [ ] **Milestone**: Once confirmed, merge to `main`. The live domain (`www.aces.fun`) now serves the interactive marketing homepage.

---

## Phase 1: The "Headless" Engine (Weeks 2-4)

**Goal**: Build the core backend and smart contract infrastructure in parallel. The frontend team is unblocked by the mock contracts.

### Sprint 1: Contracts Blueprint & Backend Foundation (Weeks 2-3)

- **Smart Contract Blueprint (The Most Important Meeting)**:
  - [ ] As a team, finalize the exact function signatures, arguments, return values, and events for all smart contracts.
  - [ ] Create the interface files (e.g., `IBondingCurve.sol`, `IRwaDeedNft.sol`) inside `packages/contracts/contracts/interfaces`. This is the unbreakable contract between developers.
- **Mock Contracts & Testnet Deployment**:
  - [ ] Create "dumb" mock implementations of the interfaces in `packages/contracts/contracts/mocks`.
  - [ ] Deploy these mock contracts to the Base Sepolia testnet.
  - [ ] Extract the ABIs and addresses and place them in `packages/utils` so the entire monorepo can access them.
- **Backend & Database Foundation**:
  - [ ] Set up the Fastify/Express server in `apps/backend`.
  - [ ] Set up the Railway project and provision the PostgreSQL database.
  - [ ] Define your database models in `prisma/schema.prisma` (User, RwaSubmission, Token, Bid).
  - [ ] Build the `POST /api/submissions` endpoint for users to submit new RWAs.

### Sprint 2: Real Contracts & Admin Logic (Week 4)

- **Real Contract Development**:
  - [ ] In a separate branch, begin the slow, careful development of the real, production-grade contracts, ensuring they perfectly match the agreed-upon interfaces. This includes writing exhaustive tests.
- **Backend Admin Logic**:
  - [ ] Build the critical `POST /api/admin/approve-submission/:id` endpoint.
  - [ ] This endpoint's logic will call the `createRwa` function on the Mock Factory Contract using the secure minter wallet pattern.

---

## Phase 2: The dApp Frontend Integration (Weeks 5-7)

**Goal**: Build out the full user-facing application, connecting it to the mock backend and contracts.

### Sprint 3: Core dApp UI & Wallet Integration (Weeks 5-6)

- **Wallet Authentication**:
  - [ ] Integrate Privy.io into the root layout (`apps/frontend/app/layout.tsx`) to provide authentication context to the entire application.
- **Token Creation & Browsing**:
  - [ ] Build the "Create Token" form page, connecting it to the backend's `/api/submissions` endpoint.
  - [ ] Build the main token list page that fetches approved tokens from your backend.
- **Token Detail & Trading Page**:
  - [ ] Build the dynamic `[address]` page for individual tokens.
  - [ ] Fetch static data from your backend.
  - [ ] Use wagmi/viem to fetch live on-chain data (price, supply) from the mock bonding curve contract.
  - [ ] Build the full "Buy/Sell" trading widget, making calls to the mock contract.

### Sprint 4: Secondary Features & Canvas Integration (Week 7)

- **NFT Owner Features**:
  - [ ] Build the `/admin` sub-page for token owners, using `ownerOf` on the mock NFT contract to control access.
  - [ ] Implement the "Claim Fees" button, which calls the `claimFees` function on the mock bonding curve contract.
- **Bidding System**:
  - [ ] Build the UI for placing and viewing bids.
  - [ ] Implement the "Accept Bid" functionality, which calls your backend to trigger the off-chain email notifications.
- **Integrating the Marketing Site**:
  - [ ] Modify the `infinite-canvas.tsx` component to fetch its data from your live `/api/tokens` backend endpoint instead of the static JSON file.
  - [ ] Make each image on the canvas a clickable link that navigates to its corresponding `/tokens/[address]` page.

---

## Phase 3: The Swap-Out & Hardening (Week 8)

**Goal**: Replace all mock components with their final, production-ready counterparts and conduct rigorous end-to-end testing.

- **Finalize & Deploy Real Contracts**:
  - [ ] Complete development and internal testing of the real smart contracts.
  - [ ] Deploy the final, V1.0 contracts to the Base Sepolia testnet.
- **The Swap-Out**:
  - [ ] In a new feature branch, update the `packages/utils` file with the new contract addresses and ABIs.
  - [ ] Because you built against a perfect interface, the application should continue to function with minimal changes.
- **End-to-End Testing & Bug Squashing**:
  - [ ] This is now the only priority. Test every single user flow from start to finish: Create -> Admin Approve -> View -> Trade -> Claim Fees -> Bid.
  - [ ] Identify and fix all integration bugs and subtle differences between the mock and real implementations.
- **Milestone: Audit-Ready**:
  - [ ] At the end of the week, freeze the code for the contracts, frontend, and backend packages. You now have a feature-complete dApp on testnet, ready to be handed over for a professional security audit.
