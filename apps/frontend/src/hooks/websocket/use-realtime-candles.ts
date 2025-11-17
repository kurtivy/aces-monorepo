/**
 * useRealtimeCandles Hook
 * 
 * Real-time WebSocket connection for chart candle data streaming.
 * Provides instant candle updates for TradingView charts.
 */

import { useEffect, useState, useRef, useCallback } from 'react';

export interface RealtimeCandle {
  timestamp: number;
  timeframe: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  trades: number;
  openUsd: string;
  highUsd: string;
  lowUsd: string;
  closeUsd: string;
  volumeUsd: string;
}

interface UseRealtimeCandlesOptions {
  /** Timeframe for candles: 1m, 5m, 15m, 1h, 4h, 1d (default: 5m) */
  timeframe?: string;
  /** Maximum number of candles to keep in memory (default: 500) */
  maxCandles?: number;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnect delay in ms (default: 5000) */
  reconnectDelay?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

interface UseRealtimeCandlesResult {
  candles: RealtimeCandle[];
  lastCandle: RealtimeCandle | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  clearCandles: () => void;
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
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:3002`;
})();

export const useRealtimeCandles = (
  tokenAddress: string | undefined,
  options: UseRealtimeCandlesOptions = {}
): UseRealtimeCandlesResult => {
  const {
    timeframe = '5m',
    maxCandles = 500,
    autoReconnect = true,
    reconnectDelay = 5000,
    debug = false,
  } = options;

  const [candles, setCandles] = useState<RealtimeCandle[]>([]);
  const [lastCandle, setLastCandle] = useState<RealtimeCandle | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const log = useCallback(
    (message: string, data?: any) => {
      if (debug) {
        console.log(`[useRealtimeCandles] ${message}`, data || '');
      }
    },
    [debug]
  );

  const clearCandles = useCallback(() => {
    setCandles([]);
    setLastCandle(null);
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

    const wsUrl = `${WS_BASE_URL}/api/v1/ws/candles/${tokenAddress}?timeframe=${timeframe}`;
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
          } else if (message.type === 'candle') {
            const candle = message.data as RealtimeCandle;
            log('New candle received:', {
              timestamp: new Date(candle.timestamp * 1000).toISOString(),
              timeframe: candle.timeframe,
              close: candle.close,
            });

            setLastCandle(candle);

            setCandles((prev) => {
              // Check if we're updating an existing candle or adding a new one
              const existingIndex = prev.findIndex(c => c.timestamp === candle.timestamp);
              
              if (existingIndex >= 0) {
                // Update existing candle
                const updated = [...prev];
                updated[existingIndex] = candle;
                return updated;
              } else {
                // Add new candle and maintain sort order (newest first)
                const newCandles = [candle, ...prev]
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .slice(0, maxCandles);
                return newCandles;
              }
            });
          } else if (message.type === 'error') {
            console.error('[useRealtimeCandles] Server error:', message.message);
            setError(message.message);
          }
        } catch (err) {
          console.error('[useRealtimeCandles] Error parsing message:', err);
        }
      };

      ws.onerror = (event) => {
        if (!mountedRef.current) return;
        console.error('[useRealtimeCandles] WebSocket error:', event);
        setError('WebSocket connection error');
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
      console.error('[useRealtimeCandles] Failed to create WebSocket:', err);
      setError('Failed to create WebSocket connection');
      setIsConnecting(false);
    }
  }, [tokenAddress, timeframe, maxCandles, autoReconnect, reconnectDelay, log, disconnect]);

  // Auto-connect when tokenAddress or timeframe changes
  useEffect(() => {
    if (tokenAddress) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [tokenAddress, timeframe, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [disconnect]);

  return {
    candles,
    lastCandle,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    clearCandles,
  };
};













