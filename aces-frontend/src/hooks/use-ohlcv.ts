import { useQuery as useTanstackQuery } from "@tanstack/react-query";
import { useQuery as useConvexQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  fetchPoolAddress,
  fetchOhlcv,
  type Timeframe,
} from "~/lib/gecko-terminal";

/**
 * Two-source OHLCV hook:
 * 1. Primary: GeckoTerminal (free, no infra, covers most V2 pools)
 * 2. Fallback: Convex trade data (self-hosted, covers CL pools GeckoTerminal doesn't index)
 *
 * GeckoTerminal is tried first. If it returns zero candles, the hook
 * falls back to computing OHLCV from our own synced trade history.
 */
export function useOhlcv(
  tokenAddress: string | undefined,
  timeframe: Timeframe,
  geckoPoolAddress?: string,
) {
  // ── Source 1: GeckoTerminal ────────────────────────────
  const poolQuery = useTanstackQuery({
    queryKey: ["gecko-pool", tokenAddress],
    queryFn: () => fetchPoolAddress(tokenAddress!),
    enabled: !!tokenAddress && !geckoPoolAddress,
    staleTime: Infinity,
  });

  const poolAddress = geckoPoolAddress ?? poolQuery.data;

  const geckoQuery = useTanstackQuery({
    queryKey: ["gecko-ohlcv", poolAddress, timeframe],
    queryFn: () => fetchOhlcv(poolAddress!, timeframe),
    enabled: !!poolAddress,
    staleTime: 30_000,
    gcTime: 15 * 60_000,
  });

  // ── Source 2: Convex trade data (fallback) ─────────────
  // Always runs so Convex can push reactive updates over websocket.
  // Only used when GeckoTerminal returns empty.
  const convexCandles = useConvexQuery(
    api.ohlcv.fromTrades,
    tokenAddress ? { tokenAddress, timeframe } : "skip",
  );

  // ── Merge: prefer GeckoTerminal, fall back to Convex ──
  const geckoCandles = geckoQuery.data ?? [];
  const geckoResolved = geckoPoolAddress
    ? geckoQuery.isFetched
    : poolQuery.isFetched && (poolAddress ? geckoQuery.isFetched : true);

  // Use Convex candles when GeckoTerminal has resolved but returned nothing
  const useConvexFallback = geckoResolved && geckoCandles.length === 0;
  const candles = useConvexFallback ? (convexCandles ?? []) : geckoCandles;

  const geckoLoading = (!geckoPoolAddress && poolQuery.isLoading) || geckoQuery.isLoading;
  const convexLoading = useConvexFallback && convexCandles === undefined;

  return {
    candles,
    isLoading: geckoLoading || convexLoading,
    isError: (!geckoPoolAddress && poolQuery.isError) || geckoQuery.isError,
    hasPool: poolAddress != null || (convexCandles !== undefined && convexCandles.length > 0),
    poolResolved: geckoPoolAddress ? true : poolQuery.isFetched,
  };
}
