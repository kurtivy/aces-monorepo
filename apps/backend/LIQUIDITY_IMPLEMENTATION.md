# DEX Liquidity Implementation

## Overview
Direct blockchain contract query for accurate, real-time DEX pool liquidity.

## Implementation Details

### Location
`apps/backend/src/routes/v1/tokens.ts` - Lines 788-886

### How It Works

1. **Query Pool Contract**
   - Uses ethers.js to query Aerodrome/Uniswap V2 pool directly
   - Fetches reserves, token0, and token1 addresses in parallel
   - No external APIs needed (BitQuery, QuickNode addons, etc.)

2. **Identify ACES Token**
   - Checks if token0 or token1 is ACES
   - Uses ACES token address: `0x55337650856299363c496065C836B9C6E9dE0367`

3. **Calculate Liquidity**
   ```
   ACES Reserve = reserves[0 or 1] / 10^18
   ACES Reserve USD = ACES Reserve × ACES Price
   Total Liquidity = ACES Reserve USD × 2  (50/50 pool)
   ```

4. **Caching**
   - Backend caches metrics for 5 seconds (see line 414)
   - Frontend polls every 5 seconds (use-token-metrics.ts)
   - Result: ~5-10 second fresh data for users

### Performance

- **RPC Calls**: 3 parallel calls (getReserves, token0, token1)
- **Execution Time**: ~100-200ms per pool query
- **Cache Hit Rate**: High (5s cache with 5s polling)
- **Cost**: Minimal RPC usage (cached for all users)

### Fallbacks

Multiple layers of fallback for reliability:
1. DEX pool reserves (primary)
2. Bonding curve liquidity (if pool query fails)
3. Null (if all methods fail)

### Error Handling

- Validates RPC URL exists
- Catches pool contract errors
- Logs warnings for non-ACES pools
- Falls back gracefully to bonding liquidity

## Testing

Test the implementation with:
```bash
npx ts-node apps/backend/test-pool-reserves-direct.ts <POOL_ADDRESS>
```

Example:
```bash
npx ts-node apps/backend/test-pool-reserves-direct.ts 0xf417266144036d539ffea594bc6653a89ecfad45
```

## Frontend Integration

**No changes needed!** Frontend already:
- Polls `/api/v1/tokens/:address/metrics` every 5 seconds
- Displays `liquidityUsd` in TokenHealthPanel
- Shows loading states appropriately

## Monitoring

Watch logs for:
- `✅ Calculated DEX liquidity from pool reserves` - Success
- `⚠️ ACES token not found in pool` - Pool mismatch
- `❌ Failed to query DEX pool reserves` - RPC error

## Example Response

```json
{
  "liquidityUsd": 3345520.41,
  "liquiditySource": "dex",
  "acesReserve": "6691040.83",
  "acesUsdPrice": 0.499
}
```

## Benefits vs Previous Approach

| Feature | BitQuery | Direct Contract |
|---------|----------|-----------------|
| Speed | 1-2s | ~100ms |
| Cost | API credits | RPC calls (cheaper) |
| Reliability | Depends on API | Direct blockchain |
| Real-time | 5-10s delay | Current block |
| Complexity | High | Low |

## Notes

- Works with any Uniswap V2 compatible pool (Aerodrome, etc.)
- Assumes 18 decimals for both tokens (standard for Base)
- Handles both token0=ACES and token1=ACES cases
- Doubles ACES value for total liquidity (50/50 assumption)

