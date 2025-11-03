import { useEffect, useMemo, useState } from 'react';
import { TokensApi, type TradeData } from '@/lib/api/tokens';
import { DexApi, type DexTradeResponse } from '@/lib/api/dex';
import type { DatabaseListing } from '@/types/rwa/section.types';

export type TradeSource = 'BONDING' | 'DEX';

export interface TradeHistoryEntry {
  id: string;
  source: TradeSource;
  direction: 'buy' | 'sell';
  tokenAmount: string;
  counterAmount: string;
  timestamp: number;
  txHash?: string;
  trader?: string;
  priceInCounter?: number;
  priceUsd?: string | number | null;
  totalUsd?: string | number | null;
  acesUsdAtExecution?: string | number | null;
  marginalPriceInAces?: string; // 🔥 NEW: Marginal price per token (price for next token after trade)
}

interface TradeHistoryOptions {
  intervalMs?: number;
  dexMeta?: DatabaseListing['dex'] | null;
}

export const useTradeHistory = (tokenAddress: string, options: TradeHistoryOptions = {}) => {
  // 🔥 PHASE 4: 5s polling for real-time feel (matches backend 5s cache)
  // Webhooks invalidate cache immediately on trades, so data stays fresh
  const { intervalMs = 5000, dexMeta } = options;

  // Track graduation state dynamically - can change mid-session
  const [detectedGraduationState, setDetectedGraduationState] = useState<{
    isDexLive: boolean;
    bondingCutoff: string | null;
  }>({
    isDexLive: Boolean(dexMeta?.isDexLive),
    bondingCutoff: dexMeta?.bondingCutoff || null,
  });

  // Use detected state instead of prop - this allows mid-session updates
  const shouldUseDex = detectedGraduationState.isDexLive;

  const [trades, setTrades] = useState<TradeHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const bondingCutoffMs = useMemo(() => {
    if (!detectedGraduationState.bondingCutoff) return null;
    const parsed = Date.parse(detectedGraduationState.bondingCutoff);
    return Number.isNaN(parsed) ? null : parsed;
  }, [detectedGraduationState.bondingCutoff]);

  const fetchTrades = async () => {
    if (!tokenAddress) {
      return;
    }

    try {
      // Only show loading on first load or after an error
      if (trades.length === 0 || error) {
        setIsLoading(true);
      }
      setError(null);

      // Fetch bonding curve trades
      const bondingResult = await TokensApi.getTrades(tokenAddress, 100);
      let bondingTrades: TradeHistoryEntry[] = [];

      if (bondingResult.success) {
        const payload = bondingResult.data as any;

        const tradePayload: TradeData[] = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
            ? (payload as TradeData[])
            : [];

        bondingTrades = tradePayload.map((trade) => ({
          id: `bonding-${trade.id}`,
          source: 'BONDING' as TradeSource,
          direction: trade.isBuy ? 'buy' : 'sell',
          tokenAmount: trade.tokenAmount,
          counterAmount: trade.acesTokenAmount,
          timestamp: Number(trade.createdAt) * 1000,
          txHash: trade.id,
          trader: trade.trader?.id,
          marginalPriceInAces: (trade as any).marginalPriceInAces, // 🔥 NEW: From backend
        }));
      } else if (bondingResult.error) {
        setError(bondingResult.error);
      }

      let dexTrades: TradeHistoryEntry[] = [];

      // Always check DEX trades if we're not already using them
      // This allows us to detect graduation mid-session
      const checkDex = shouldUseDex || !detectedGraduationState.isDexLive;

      if (checkDex) {
        const dexResult = await DexApi.getTrades(tokenAddress, 100);

        if (dexResult.success) {
          const payload = dexResult.data as any;

          const dexArray: DexTradeResponse[] = Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload)
              ? (payload as DexTradeResponse[])
              : [];

          dexTrades = dexArray.map((trade) => ({
            id: `dex-${trade.txHash ?? trade.timestamp}`,
            source: 'DEX' as TradeSource,
            direction: trade.direction,
            tokenAmount: trade.amountToken,
            counterAmount: trade.amountCounter,
            timestamp: Number(trade.timestamp),
            txHash: trade.txHash,
            trader: trade.trader,
            priceInCounter: trade.priceInCounter,
            priceUsd: trade.priceInUsd,
          }));

          // Detect graduation: if we got DEX trades but weren't expecting them
          if (!detectedGraduationState.isDexLive && dexTrades.length > 0) {
            console.log('[TradeHistory] 🎓 Token graduated! Detected DEX trades', {
              dexTradeCount: dexTrades.length,
              firstDexTrade: dexTrades[0],
            });

            // Update graduation state - use the earliest DEX trade as bondingCutoff
            const earliestDexTimestamp = Math.min(...dexTrades.map((t) => t.timestamp));
            setDetectedGraduationState({
              isDexLive: true,
              bondingCutoff: new Date(earliestDexTimestamp).toISOString(),
            });

            // Clear trades to force a clean refresh with the new state
            setTrades([]);
          }
        } else if (dexResult.error) {
          // DEX trades fetch failed, continue without them
        }
      }

      if (bondingCutoffMs) {
        //  const beforeFilter = bondingTrades.length;
        bondingTrades = bondingTrades.filter((trade) => trade.timestamp < bondingCutoffMs);
      }

      const combinedTrades = [...dexTrades, ...bondingTrades]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 100);

      setTrades((prevTrades) => {
        if (prevTrades.length === 0) {
          return combinedTrades;
        }

        const prevIds = new Set(prevTrades.map((trade) => trade.id));
        const newEntries = combinedTrades.filter((trade) => !prevIds.has(trade.id));

        if (newEntries.length === 0) {
          return prevTrades;
        }

        const merged = [...newEntries, ...prevTrades].sort((a, b) => b.timestamp - a.timestamp);
        return merged.slice(0, 100);
      });

      setIsConnected(true);
      setError(null);
    } catch (error) {
      setError('Network error while fetching trades');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync with prop changes (for initial load or external updates)
  useEffect(() => {
    if (dexMeta?.isDexLive !== detectedGraduationState.isDexLive) {
      setDetectedGraduationState({
        isDexLive: Boolean(dexMeta?.isDexLive),
        bondingCutoff: dexMeta?.bondingCutoff || null,
      });
    }
  }, [dexMeta?.isDexLive, dexMeta?.bondingCutoff]);

  useEffect(() => {
    if (!tokenAddress) {
      setTrades([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check if polling should be disabled (useful for development)
    const disablePolling = process.env.NEXT_PUBLIC_DISABLE_TRADE_POLLING === 'true';

    if (disablePolling) {
      setTrades([]);
      setIsLoading(false);
      setIsConnected(false);
      return;
    }

    let intervalId: NodeJS.Timeout | null = null;

    // Initial fetch
    fetchTrades();

    // Set up interval for continuous updates
    intervalId = setInterval(fetchTrades, intervalMs);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      setIsConnected(false);
    };
  }, [tokenAddress, intervalMs, shouldUseDex, bondingCutoffMs]);

  return {
    trades,
    isLoading,
    error,
    isConnected,
    refresh: fetchTrades,
  };
};
