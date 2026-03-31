import { useQuery as useTanstackQuery } from "@tanstack/react-query";
import { useQuery as useConvexQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  fetchPoolAddress,
  fetchOhlcv,
  type Timeframe,
  type OhlcvCandle,
} from "~/lib/gecko-terminal";

/**
 * Enforce candle continuity: open[i] = close[i-1].
 * Prevents vertical gaps between candles.
 * From pumpbot chart realism postmortem: enforce in data, not renderer.
 */
function enforceContinuity(candles: OhlcvCandle[]): OhlcvCandle[] {
  if (candles.length <= 1) return candles;
  return candles.map((candle, i) => {
    if (i === 0) return candle;
    const prevClose = candles[i - 1].close;
    const adjusted = { ...candle, open: prevClose };
    // Ensure high/low still encompass the adjusted open
    adjusted.high = Math.max(adjusted.high, adjusted.open, adjusted.close);
    adjusted.low = Math.min(adjusted.low, adjusted.open, adjusted.close);
    return adjusted;
  });
}

/**
 * Two-source OHLCV hook:
 * 1. Primary: Convex trade data (real-time WebSocket push, no polling)
 * 2. Fallback: GeckoTerminal (free API, covers gaps when Convex has no data yet)
 *
 * Convex is preferred because it gives us instant updates via WebSocket
 * subscription — no polling needed. GeckoTerminal is only used when
 * Convex has zero candles (e.g. before backfill completes).
 */
export function useOhlcv(
  tokenAddress: string | undefined,
  timeframe: Timeframe,
  geckoPoolAddress?: string,
) {
  // ── Source 1 (primary): Convex trade data ──────────────
  // Real-time WebSocket subscription — updates push instantly when
  // new trades land via the tradeListener or tradeSyncer.
  const convexCandles = useConvexQuery(
    api.ohlcv.fromTrades,
    tokenAddress ? { tokenAddress, timeframe } : "skip",
  );

  // ── Source 2 (fallback): GeckoTerminal ─────────────────
  // Only fetched when Convex has resolved but returned zero candles.
  // This covers the cold-start case before historical backfill runs.
  const convexResolved = convexCandles !== undefined;
  const needGeckoFallback = convexResolved && convexCandles.length === 0;

  const poolQuery = useTanstackQuery({
    queryKey: ["gecko-pool", tokenAddress],
    queryFn: () => fetchPoolAddress(tokenAddress!),
    // Only look up the pool if we actually need GeckoTerminal data
    enabled: needGeckoFallback && !!tokenAddress && !geckoPoolAddress,
    staleTime: Infinity,
  });

  const poolAddress = geckoPoolAddress ?? poolQuery.data;

  const geckoQuery = useTanstackQuery({
    queryKey: ["gecko-ohlcv", poolAddress, timeframe],
    queryFn: () => fetchOhlcv(poolAddress!, timeframe),
    // Only fetch OHLCV if we need the fallback AND have a pool address
    enabled: needGeckoFallback && !!poolAddress,
    staleTime: 30_000,
    gcTime: 15 * 60_000,
  });

  // ── Merge: prefer Convex, fall back to GeckoTerminal ───
  const geckoCandles = geckoQuery.data ?? [];
  const candles = convexCandles && convexCandles.length > 0
    ? convexCandles
    : geckoCandles;

  const convexLoading = !convexResolved;
  const geckoLoading = needGeckoFallback && (
    (!geckoPoolAddress && poolQuery.isLoading) || geckoQuery.isLoading
  );

  return {
    candles: enforceContinuity(candles),
    isLoading: convexLoading || geckoLoading,
    isError: needGeckoFallback && (
      (!geckoPoolAddress && poolQuery.isError) || geckoQuery.isError
    ),
    hasPool: (convexCandles && convexCandles.length > 0) ||
      poolAddress != null,
    poolResolved: true, // Convex always resolves immediately
  };
}
