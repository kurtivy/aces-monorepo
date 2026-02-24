# Frontend deployment (aces.fun)

## Why `/api/prices/aces-usd` returns 500

The price API depends on **environment variables** and a **QuickNode RPC** with the Aerodrome add-on. If any of these are missing or wrong in production, the route returns 500.

### Required for `/api/prices/aces-usd`

| Variable | Purpose |
|----------|--------|
| `AERODROME_ACES_WETH_POOL` | Aerodrome ACES/WETH pool address (Base mainnet). **Required** – no fallback. |
| `ACES_TOKEN_ADDRESS` | ACES token contract address. **Required** – no fallback. |
| `QUICKNODE_BASE_URL` or `NEXT_PUBLIC_QUICKNODE_BASE_URL` or `BASE_MAINNET_RPC_URL` | Base mainnet RPC. **Must be a QuickNode URL** that has the Aerodrome Swap API add-on (addon 1051). The public RPC `https://mainnet.base.org` does **not** support the add-on, so prices will fail if this is unset. |

After fixing env vars, redeploy. If it still 500s, call `GET /api/prices/aces-usd` and check the JSON `error` field (e.g. "Missing AERODROME_ACES_WETH_POOL", "Aerodrome API failed", "Price refresh timed out").

---

## Why `/api/listings/symbol/:symbol` returns 500

The listing API uses **Prisma** and optional token health. Common causes of 500:

- **`DATABASE_URL`** missing or invalid in production (Prisma can’t connect).
- **Token health** (e.g. RPC or price service) failing when `includeHealth=1`; the route catches this and still returns the listing, so a 500 here is usually **database or Prisma** related.

Check your deployment logs for `[Listings] Error getting listing by symbol:` and the stack trace. The API response body includes a `message` field with the error message when status is 500.
