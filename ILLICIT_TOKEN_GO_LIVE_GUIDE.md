# ILLICIT Token Go-Live Guide

This guide will help you make the ILLICIT token (Banksy – The Illicit Collaboration) go live on ACES.fun.

## Overview

The Banksy piece (ID: '27') needs to be made "live" so that:
- ✅ It shows a green "Trading live" badge in the modal
- ✅ It shows a green live dot on the canvas
- ✅ The TRADE button becomes enabled and clickable
- ✅ Clicking TRADE navigates to `/rwa/illicit`
- ✅ The AUCTION button becomes enabled

---

## Step-by-Step Instructions

### Step 1: Update `live-trading.ts` (Add ILLICIT to live symbols)

**File**: `apps/frontend/src/constants/live-trading.ts`

**Current code**:
```typescript
export const LIVE_TRADING_SYMBOLS = new Set(['APKAWS', 'RMILLE']);
```

**Change to**:
```typescript
export const LIVE_TRADING_SYMBOLS = new Set(['APKAWS', 'RMILLE', 'ILLICIT']);
```

---

### Step 2: Update `metadata.ts` (Add symbol property)

**File**: `apps/frontend/src/data/metadata.ts`

**Current code** (lines 442-462):
```typescript
{
  id: '27',
  title: 'Banksy – The Illicit Collaboration',
  description: `A one-of-one historic street art artifact...`,
  date: '2024-03-30',
  countdownDate: '2025-10-06T13:00:00.000Z',
  ticker: '$BANKSYCHIMP',
  image: '/canvas-images/banksy-x-chimp.webp',
  rrp: 420000,
  tokenPrice: 0,
  marketCap: 0,
  tokenSupply: 0,
},
```

**Change to**:
```typescript
{
  id: '27',
  title: 'Banksy – The Illicit Collaboration',
  description: `A one-of-one historic street art artifact...`,
  date: '2024-03-30',
  countdownDate: '2025-10-06T13:00:00.000Z',
  ticker: '$BANKSYCHIMP',
  symbol: 'ILLICIT',  // ← ADD THIS LINE
  image: '/canvas-images/banksy-x-chimp.webp',
  rrp: 420000,
  tokenPrice: 0,
  marketCap: 0,
  tokenSupply: 0,
},
```

**Important**: Add the `symbol: 'ILLICIT'` property (without the `$` prefix)

---

### Step 3: Verify the RWA page exists

**File**: `apps/frontend/src/app/rwa/[symbol]/page.tsx`

Since you have a dynamic route `[symbol]`, this page will automatically handle the ILLICIT token when users navigate to `/rwa/illicit`.

**No changes needed** - the dynamic route will automatically work for ILLICIT.

---

## How the Code Works

### 1. Symbol Resolution Flow

```typescript
// image-details-modal.tsx (lines 236-242)
const normalizedSymbol = useMemo(() => {
  if (isDrvn) return '';
  return normalizeSymbol(metadataSymbol) ?? normalizeSymbol(metadataTicker) ?? '';
}, [isDrvn, metadataSymbol, metadataTicker]);
```

- Tries `metadata.symbol` first (ILLICIT)
- Falls back to `metadata.ticker` ($BANKSYCHIMP) if symbol is missing
- Normalizes by removing `$` and converting to uppercase

### 2. Live Badge Display

```typescript
// image-details-modal.tsx (lines 304-310)
const computedIsLive = useMemo(() => {
  if (isDrvn) return false;
  if (hookIsLive) return true;
  return isSymbolTradingLive(normalizedSymbol);
}, [hookIsLive, isDrvn, normalizedSymbol]);
```

- Checks if `ILLICIT` is in `LIVE_TRADING_SYMBOLS` set
- Shows green badge if true

### 3. Route Navigation

```typescript
// image-details-modal.tsx (lines 398-413)
const handleTradeClick = useCallback(() => {
  // ... special cases ...
  else if (normalizedSymbol) {
    router.push(`/rwa/${normalizedSymbol.toLowerCase()}`);
  }
}, [router, normalizedSymbol, stableOnClose, isDrvn]);
```

- Navigates to `/rwa/illicit` (lowercase)

### 4. Canvas Live Badge

```typescript
// use-canvas-renderer.ts (lines 1675-1676)
const metadataSymbol = getSymbolFromMetadata(element.original.image.metadata);
const showLiveBadge = metadataSymbol ? isSymbolTradingLive(metadataSymbol) : false;
```

- Shows green pulsing dot on canvas if symbol is live

---

## Testing Checklist

After making the changes above, test the following:

### 1. Canvas View
- [ ] Green pulsing live badge appears on Banksy image

### 2. Modal View (click on Banksy image)
- [ ] Green "Trading live" badge shows below title
- [ ] TRADE button is enabled (gold gradient, not grayed out)
- [ ] AUCTION button is enabled (dark with gold border)

### 3. TRADE Button
- [ ] Click TRADE button
- [ ] Should navigate to `/rwa/illicit`
- [ ] Page should load successfully

### 4. AUCTION Button
- [ ] Click AUCTION button
- [ ] Should navigate to `/rwa/illicit?openAuction=true`
- [ ] Page should load with auction modal open

---

## Summary of Changes

| File | Line(s) | Change |
|------|---------|--------|
| `apps/frontend/src/constants/live-trading.ts` | Line 1 | Add `'ILLICIT'` to `LIVE_TRADING_SYMBOLS` set |
| `apps/frontend/src/data/metadata.ts` | After line 456 | Add `symbol: 'ILLICIT',` to the Banksy metadata object |

---

## Why Both `ticker` and `symbol`?

- **`ticker`**: Display name with `$` prefix (e.g., `$BANKSYCHIMP`)
  - Used for UI display in modals, cards, etc.
  
- **`symbol`**: Route identifier without `$` (e.g., `ILLICIT`)
  - Used for navigation routes (`/rwa/illicit`)
  - Used for live trading checks
  - Cleaner, more readable URL

---

## Optional: Update Token Metrics

If you want to add real token metrics (not required for go-live):

```typescript
{
  id: '27',
  // ... other properties ...
  rrp: 420000,
  tokenPrice: 4.2,        // ← Add actual token price if available
  marketCap: 420000,      // ← Add actual market cap if available
  tokenSupply: 100000,    // ← Add actual supply if available
},
```

---

## Questions?

If anything doesn't work as expected:
1. Check browser console for errors
2. Verify all changes were saved
3. Clear browser cache and reload
4. Check that the symbol is uppercase in `LIVE_TRADING_SYMBOLS`
5. Check that the symbol is added to the correct metadata object (id: '27')

---

## Quick Copy-Paste Code

### For `live-trading.ts`:
```typescript
export const LIVE_TRADING_SYMBOLS = new Set(['APKAWS', 'RMILLE', 'ILLICIT']);
```

### For `metadata.ts` (add after line 456):
```typescript
symbol: 'ILLICIT',
```


