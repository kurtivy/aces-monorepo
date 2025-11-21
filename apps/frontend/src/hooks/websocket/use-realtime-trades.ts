/**
 * useRealtimeTrades Hook
 *
 * Real-time WebSocket connection for trade data streaming.
 * Uses shared WebSocket manager to prevent duplicate connections.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { sharedTradeWebSocket } from '@/lib/websocket/shared-trade-websocket';

export interface RealtimeTrade {
  id: string;
  tokenAddress: string;
  trader: string;
  isBuy: boolean;
  tokenAmount: string;
  acesAmount: string;
  pricePerToken: string;
  priceUsd: string;
  supply: string;
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
  source: 'goldsky' | 'bitquery'; // WebSocket data source
  sequenceNumber?: number;
}

interface UseRealtimeTradesOptions {
  /** Maximum number of trades to keep in memory (default: 100) */
  maxTrades?: number;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnect delay in ms (default: 5000) */
  reconnectDelay?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

interface UseRealtimeTradesResult {
  trades: RealtimeTrade[];
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  clearTrades: () => void;
}

export const useRealtimeTrades = (
  tokenAddress: string | undefined,
  options: UseRealtimeTradesOptions = {},
): UseRealtimeTradesResult => {
  const { maxTrades = 100, debug = false } = options;

  const [trades, setTrades] = useState<RealtimeTrade[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  const clearTrades = useCallback(() => {
    setTrades([]);
  }, []);

  const disconnect = useCallback(() => {
    // No-op: disconnect is now handled automatically by shared manager
  }, []);

  const connect = useCallback(() => {
    // No-op: connect is now handled automatically by shared manager
  }, []);

  // Auto-connect using shared WebSocket manager
  useEffect(() => {
    // Set mounted to true at the start of each effect (handles React Strict Mode double render)
    mountedRef.current = true;

    if (debug) {
      console.log('[useRealtimeTrades] 🔄 useEffect triggered:', {
        tokenAddress,
        mounted: mountedRef.current,
        maxTrades,
        debug,
      });
    }

    if (!tokenAddress) {
      if (debug) {
        console.log('[useRealtimeTrades] ⚠️ No tokenAddress, clearing state');
      }
      setIsConnected(false);
      setIsConnecting(false);
      setError(null);
      setTrades([]);
      return;
    }

    if (debug) {
      console.log('[useRealtimeTrades] 📡 Subscribing to shared WebSocket...');
    }

    // Subscribe to shared WebSocket
    const unsubscribe = sharedTradeWebSocket.subscribe(
      tokenAddress,
      // Trade callback
      (trade) => {
        if (debug) {
          console.log('[useRealtimeTrades] 🔔 Trade callback invoked:', {
            mounted: mountedRef.current,
            tradeId: trade?.id,
            source: trade?.source,
            hasTrade: !!trade,
          });
        }

        if (!mountedRef.current) {
          console.warn('[useRealtimeTrades] ⚠️ Component unmounted, ignoring trade');
          return;
        }

        if (!trade) {
          console.warn('[useRealtimeTrades] ⚠️ Received null/undefined trade');
          return;
        }

        if (debug) {
          console.log('[useRealtimeTrades] 📥 Received trade:', {
            id: trade.id,
            source: trade.source,
            isBuy: trade.isBuy,
            tokenAmount: trade.tokenAmount,
            acesAmount: trade.acesAmount,
            txHash: trade.transactionHash,
            timestamp: trade.timestamp,
            timestampDate: new Date(trade.timestamp).toISOString(),
          });
        }

        setTrades((prev) => {
          const newTrades = [trade as RealtimeTrade, ...prev].slice(0, maxTrades);

          if (debug) {
            console.log('[useRealtimeTrades] 📊 Updated trades array:', {
              previousCount: prev.length,
              newCount: newTrades.length,
              source: trade.source,
              bitqueryCount: newTrades.filter((t) => t.source === 'bitquery').length,
              goldskyCount: newTrades.filter((t) => t.source === 'goldsky').length,
              firstTradeId: newTrades[0]?.id,
            });
          }

          return newTrades;
        });
      },
      // Status callback
      (status) => {
        if (!mountedRef.current) return;

        setIsConnected(status.isConnected);
        setIsConnecting(status.isConnecting);
        setError(status.error);

        if (debug) {
          // console.log('[useRealtimeTrades] Status update:', status);
        }
      },
    );

    if (debug) {
      console.log('[useRealtimeTrades] ✅ Subscription complete, unsubscribe function returned');
    }

    return () => {
      if (debug) {
        console.log('[useRealtimeTrades] 🧹 Cleaning up subscription for:', tokenAddress);
      }
      mountedRef.current = false;
      unsubscribe();
    };
  }, [tokenAddress, maxTrades, debug]);

  return {
    trades,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    clearTrades,
  };
};
