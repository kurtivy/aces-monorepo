/**
 * useRealtimeTrades Hook
 *
 * Real-time WebSocket connection for trade data streaming.
 * Replaces REST API polling with instant WebSocket updates.
 */

import { useEffect, useState, useRef, useCallback } from 'react';

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

const WS_BASE_URL = (() => {
  if (typeof window === 'undefined') return 'ws://localhost:3002';

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    try {
      const url = new URL(apiUrl);
      const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${url.host}`;
    } catch {
      // Fallback
    }
  }

  // Derive from window.location
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:3002`;
})();

export const useRealtimeTrades = (
  tokenAddress: string | undefined,
  options: UseRealtimeTradesOptions = {},
): UseRealtimeTradesResult => {
  const { maxTrades = 100, autoReconnect = true, reconnectDelay = 5000, debug = false } = options;

  const [trades, setTrades] = useState<RealtimeTrade[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const log = useCallback(
    (message: string, data?: any) => {
      if (debug) {
        console.log(`[useRealtimeTrades] ${message}`, data || '');
      }
    },
    [debug],
  );

  const clearTrades = useCallback(() => {
    setTrades([]);
  }, []);

  const disconnect = useCallback(() => {
    log('Disconnecting...');

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, [log]);

  const connect = useCallback(() => {
    if (!tokenAddress) {
      log('No token address provided, skipping connection');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      log('Already connected');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      log('Connection already in progress');
      return;
    }

    disconnect();
    setIsConnecting(true);
    setError(null);

    const wsUrl = `${WS_BASE_URL}/api/v1/ws/trades/${tokenAddress}`;
    log('Connecting to:', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        log('Connected!');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;

        try {
          const message = JSON.parse(event.data);
          log('Received message:', message.type);

          if (message.type === 'subscribed') {
            log('Subscription confirmed:', message.data);
          } else if (message.type === 'trade') {
            const trade = message.data as RealtimeTrade;
            log('New trade received:', {
              id: trade.id,
              isBuy: trade.isBuy,
              tokenAmount: trade.tokenAmount,
              sequenceNumber: trade.sequenceNumber,
            });

            setTrades((prev) => {
              const newTrades = [trade, ...prev].slice(0, maxTrades);
              return newTrades;
            });
          } else if (message.type === 'error') {
            console.error('[useRealtimeTrades] Server error:', message.message);
            setError(message.message);
          }
        } catch (err) {
          console.error('[useRealtimeTrades] Error parsing message:', err);
        }
      };

      ws.onerror = (event) => {
        if (!mountedRef.current) return;
        console.error('[useRealtimeTrades] WebSocket error:', {
          event,
          readyState: ws.readyState,
          url: wsUrl,
          error: (event as any).error || 'Unknown error',
        });
        setError(`WebSocket connection error: ${(event as any).message || 'Failed to connect'}`);
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;

        log('Disconnected', { code: event.code, reason: event.reason });
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;

        // Auto-reconnect if enabled and not a normal closure
        if (autoReconnect && event.code !== 1000) {
          log(`Reconnecting in ${reconnectDelay}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current && tokenAddress) {
              connect();
            }
          }, reconnectDelay);
        }
      };
    } catch (err) {
      console.error('[useRealtimeTrades] Failed to create WebSocket:', err);
      setError('Failed to create WebSocket connection');
      setIsConnecting(false);
    }
  }, [tokenAddress, maxTrades, autoReconnect, reconnectDelay, log, disconnect]);

  // Auto-connect when tokenAddress changes
  useEffect(() => {
    if (tokenAddress) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [tokenAddress, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [disconnect]);

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
