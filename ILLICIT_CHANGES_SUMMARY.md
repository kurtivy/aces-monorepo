# ILLICIT Token - Changes Complete ✅

## Summary
The ILLICIT token (Banksy – The Illicit Collaboration) is now configured to go live on ACES.fun.

---

## Changes Made

### ✅ 1. Updated `live-trading.ts`
**File**: `apps/frontend/src/constants/live-trading.ts`

Added `'ILLICIT'` to the live trading symbols set:
```typescript
export const LIVE_TRADING_SYMBOLS = new Set(['APKAWS', 'RMILLE', 'ILLICIT']);
```

### ✅ 2. Updated `metadata.ts`
**File**: `apps/frontend/src/data/metadata.ts`

Added `symbol: 'ILLICIT'` to the Banksy metadata (ID: '27'):
```typescript
{
  id: '27',
  title: 'Banksy – The Illicit Collaboration',
  // ... description ...
  ticker: '$BANKSYCHIMP',
  symbol: 'ILLICIT',  // ← ADDED
  image: '/canvas-images/banksy-x-chimp.webp',
  rrp: 420000,
  // ...
}
```

---

## What This Enables

### On the Canvas
- ✅ Green pulsing "live" badge on the Banksy image

### In the Modal (when clicked)
- ✅ Green "Trading live" badge below the title
- ✅ TRADE button is enabled (gold gradient)
- ✅ AUCTION button is enabled (dark with gold border)

### Navigation
- ✅ TRADE button → navigates to `/rwa/illicit`
- ✅ AUCTION button → navigates to `/rwa/illicit?openAuction=true`

---

## Testing

To verify everything works:

1. **View the canvas** → Look for green live badge on Banksy image
2. **Click the Banksy image** → Modal should show "Trading live"
3. **Click TRADE button** → Should navigate to `/rwa/illicit`
4. **Click AUCTION button** → Should navigate to `/rwa/illicit?openAuction=true`

---

## No Additional Changes Needed

✅ The RWA page at `/rwa/[symbol]/page.tsx` is already set up as a dynamic route
✅ No linter errors
✅ Ready to deploy

---

## Route Information

- **Symbol**: `ILLICIT`
- **Ticker Display**: `$BANKSYCHIMP`
- **Trade Page**: `/rwa/illicit`
- **Auction Page**: `/rwa/illicit?openAuction=true`

---

## Next Steps (Optional)

If you want to add real token metrics later, you can update these values in `metadata.ts`:

```typescript
tokenPrice: 4.2,        // Current token price
marketCap: 420000,      // Current market cap
tokenSupply: 100000,    // Total token supply
```

Currently set to `0` (not required for go-live).


