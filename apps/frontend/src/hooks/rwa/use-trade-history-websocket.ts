/**
 * Hybrid Trade History Hook
 * 
 * Uses WebSocket for real-time updates, with REST API fallback for historical data.
 * Drop-in replacement for use-trade-history.ts with backward compatibility.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRealtimeTrades, type RealtimeTrade } from '@/hooks/websocket/use-realtime-trades';
import type { DatabaseListing } from '@/types/rwa/section.types';
import { TokensApi, type TradeData } from '@/lib/api/tokens';
import { DexApi } from '@/lib/api/dex';

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
  marginalPriceInAces?: string;
}

interface TradeHistoryOptions {
  intervalMs?: number; // Ignored for WebSocket, kept for compatibility
  dexMeta?: DatabaseListing['dex'] | null;
}

/**
 * Transform WebSocket RealtimeTrade to TradeHistoryEntry
 */
const transformTrade = (trade: RealtimeTrade): TradeHistoryEntry => {
  return {
    id: trade.id || trade.transactionHash,
    source: 'BONDING', // Goldsky trades are from bonding curve
    direction: trade.isBuy ? 'buy' : 'sell',
    tokenAmount: trade.tokenAmount || '0',
    counterAmount: trade.acesAmount || '0',
    timestamp: trade.timestamp,
    txHash: trade.transactionHash,
    trader: trade.trader,
    priceInCounter: parseFloat(trade.pricePerToken) || 0,
    priceUsd: trade.priceUsd,
    totalUsd: null, // Will be calculated in the component
    marginalPriceInAces: trade.pricePerToken,
  };
};

export const useTradeHistory = (tokenAddress: string, options: TradeHistoryOptions = {}) => {
  const { dexMeta } = options;
  const [historicalTrades, setHistoricalTrades] = useState<TradeHistoryEntry[]>([]);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);
  const [historicalError, setHistoricalError] = useState<string | null>(null);

  // Connect to WebSocket for real-time trades
  const {
    trades: realtimeTrades,
    isConnected,
    isConnecting,
    error: wsError,
  } = useRealtimeTrades(tokenAddress, {
    maxTrades: 100,
    autoReconnect: true,
    debug: false,
  });

  // Fetch historical trades from REST API when WebSocket is empty
  useEffect(() => {
    const fetchHistoricalTrades = async () => {
      // Only fetch if WebSocket is connected but returned no trades
      if (!isConnected || realtimeTrades.length > 0 || isConnecting) {
        return;
      }

      console.log('[TradeHistory] 📚 WebSocket empty, fetching historical trades from REST API...');
      setIsLoadingHistorical(true);
      setHistoricalError(null);

      try {
        // Check if token is graduated
        const isDexLive = dexMeta?.isDexLive;
        
        if (isDexLive) {
          // Token is graduated - fetch DEX trades
          console.log('[TradeHistory] Token graduated, fetching DEX trades...');
          const dexResult = await DexApi.getTrades(tokenAddress, 100);
          
          if (dexResult.success && dexResult.data) {
            const dexTrades: TradeHistoryEntry[] = (dexResult.data as any[]).map((trade: any, index: number) => ({
              id: `dex-${trade.id || trade.hash || trade.transactionHash || `${trade.timestamp}-${index}`}`,
              source: 'DEX' as TradeSource,
              direction: (trade.isBuy ? 'buy' : 'sell') as 'buy' | 'sell',
              tokenAmount: trade.amount0 || trade.tokenAmount || '0',
              counterAmount: trade.amount1 || trade.acesAmount || '0',
              timestamp: trade.timestamp * 1000,
              txHash: trade.hash || trade.transactionHash,
              trader: trade.sender || trade.trader,
              priceUsd: trade.priceUsd,
              totalUsd: trade.totalUsd,
            }));
            
            setHistoricalTrades(dexTrades);
            console.log(`[TradeHistory] ✅ Loaded ${dexTrades.length} DEX trades from REST API`);
          }
        } else {
          // Token still bonding - fetch bonding curve trades
          console.log('[TradeHistory] Token bonding, fetching bonding curve trades...');
          const bondingResult = await TokensApi.getTrades(tokenAddress, 100);
          
          if (bondingResult.success && bondingResult.data) {
            const payload = bondingResult.data as any;
            const tradePayload = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
            
            const bondingTrades: TradeHistoryEntry[] = tradePayload.map((trade: any) => ({
              id: `bonding-${trade.id}`,
              source: 'BONDING' as TradeSource,
              direction: (trade.isBuy ? 'buy' : 'sell') as 'buy' | 'sell',
              tokenAmount: trade.tokenAmount || '0',
              counterAmount: trade.acesTokenAmount || '0',
              timestamp: Number(trade.createdAt) * 1000,
              txHash: trade.id,
              trader: trade.trader?.id,
              marginalPriceInAces: trade.marginalPriceInAces,
            }));
            
            setHistoricalTrades(bondingTrades);
            console.log(`[TradeHistory] ✅ Loaded ${bondingTrades.length} bonding trades from REST API`);
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch historical trades';
        setHistoricalError(errorMsg);
        console.error('[TradeHistory] ❌ Error fetching historical trades:', err);
      } finally {
        setIsLoadingHistorical(false);
      }
    };

    fetchHistoricalTrades();
  }, [tokenAddress, isConnected, isConnecting, realtimeTrades.length, dexMeta?.isDexLive]);

  // Combine WebSocket trades (transformed) with historical REST trades
  const trades = useMemo(() => {
    // If we have real-time trades from WebSocket, use those
    if (realtimeTrades.length > 0) {
      return realtimeTrades.map(transformTrade);
    }
    
    // Otherwise use historical trades from REST API
    return historicalTrades;
  }, [realtimeTrades, historicalTrades]);

  // Log connection status changes
  useEffect(() => {
    if (isConnected) {
      console.log('[TradeHistory] ✅ WebSocket connected for', tokenAddress);
    } else if (isConnecting) {
      console.log('[TradeHistory] 🔄 WebSocket connecting...', tokenAddress);
    } else {
      console.log('[TradeHistory] ❌ WebSocket disconnected for', tokenAddress);
    }
  }, [isConnected, isConnecting, tokenAddress]);

  const isLoading = (isConnecting || isLoadingHistorical) && trades.length === 0;
  const error = wsError || historicalError;

  return {
    trades,
    isLoading,
    error,
    isConnected,
    refresh: () => {
      console.log('[TradeHistory] Refreshing from REST API...');
      setHistoricalTrades([]);
      // This will trigger the useEffect to re-fetch
    },
  };
};




