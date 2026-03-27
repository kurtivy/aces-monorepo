# ACES Greenfield

Real-world asset tokenization platform on Base. Users speculate on RWA sale prices by trading RWA tokens paired with ACES on Aerodrome DEX.

## Tech Stack

**Frontend**

- React 19 + TypeScript 5.8
- Vite 7 (build tool)
- TanStack Router (file-based routing)
- TanStack React Query (server state)
- Tailwind CSS 4 (via Vite plugin, no config file)
- Radix UI (headless components: dialog, dropdown, tabs, tooltip)
- Framer Motion (animations)
- Lightweight Charts (OHLCV charting)

**Web3**

- wagmi 2 + viem 2 (Ethereum hooks and client)
- Privy (wallet authentication)
- Base Mainnet (Chain ID: 8453)

**Backend**

- Convex (serverless database + functions + cron jobs)

## External Services

| Service | Purpose |
|---|---|
| **Aerodrome DEX** | On-chain trading — V2 and Concentrated Liquidity (Slipstream) pools paired with ACES |
| **GeckoTerminal** | OHLCV chart data for pools that have a `geckoPoolAddress` configured |
| **Chainlink** | ETH/USD price feed (`0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70`) |
| **Privy** | Wallet connection and authentication |
| **QuickNode** | RPC provider for on-chain metrics syncer, trade backfill, and client-side reads (via `VITE_QUICKNODE_BASE_URL`) |
| **Public RPCs** | Client-side fallback pool: `mainnet.base.org`, `publicnode.com`, `tenderly.co`, `1rpc.io`. **Dev only** — QuickNode is the primary RPC in production. Public endpoints have aggressive rate limits and no SLA. |

## Running the App

### Prerequisites

- Node.js 18+
- A Convex account ([convex.dev](https://convex.dev))

### Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
# Convex backend URL (required)
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud/

# Convex deployment ID (required for convex dev/deploy)
CONVEX_DEPLOYMENT=dev:<your-deployment>

# Privy app ID (optional — leave empty until auth is needed)
VITE_PRIVY_APP_ID=

# QuickNode Base Mainnet RPC (client-side reads)
VITE_QUICKNODE_BASE_URL=https://your-endpoint.base.quiknode.pro/your-key

# Server-side (set in Convex dashboard):
# QUICKNODE_BASE_URL=https://your-endpoint.base.quiknode.pro/your-key
# QUICKNODE_WS_URL=wss://your-endpoint.base.quiknode.pro/your-key
```

### Install

```bash
npm install
```

### Development

Runs Vite dev server + Convex backend in parallel via `concurrently`:

```bash
npm run dev
```

Frontend: http://localhost:3000

To run them separately:

```bash
npm run dev:vite     # Frontend only
npm run convex:dev   # Convex backend only
```

### Build

```bash
npm run build        # TypeScript check + production build → dist/
npm run preview      # Preview production build locally
```

### Deploy Convex

```bash
npm run convex:deploy
```

## Reseeding Tokens

Token data lives in `convex/tokenData.ts` — the single source of truth for all RWA tokens (symbols, contract addresses, pool config, images, metadata).

To seed or re-seed tokens into a new Convex database:

1. **From the Convex dashboard:** Navigate to Functions → `tokens:reseedTokens` → Run
2. **From code:** `useMutation(api.tokens.reseedTokens)` and call it

The mutation is idempotent — it upserts all active tokens from the `RWA_TOKENS` registry. Existing records are updated, new ones are created. Returns `{ symbol, action: "created" | "updated" }[]`.

### Adding a New Token

1. Add an entry to `RWA_TOKENS[]` in `convex/tokenData.ts`
2. Fill in required fields: `symbol`, `name`, `contractAddress`, `decimals`, `chainId`, `dexPool`, `image`, `images`, `phase`, `isActive`
3. Optionally set `geckoPoolAddress` for chart data
4. Call `reseedTokens()` — the token is then automatically picked up by the trade syncer, metrics cron, and all UI pages
