import { useState, useEffect, useCallback, useRef } from 'react';

// Message type for WebSocket messages
interface RawCandle {
  timestamp: number | string | Date;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  openUsd?: number | string | null;
  highUsd?: number | string | null;
  lowUsd?: number | string | null;
  closeUsd?: number | string | null;
  volume?: number | string | null;
  volumeUsd?: number | string | null;
  trades?: number | string | null;
  circulationSupply?: number | string | null; // Legacy typo safeguard
  circulatingSupply?: number | string | null;
  totalSupply?: number | string | null;
  marketCapAces?: number | string | null;
  marketCapUsd?: number | string | null;
  dataSource?: 'bonding_curve' | 'dex' | string;
  [key: string]: unknown;
}

interface WebSocketMessage {
  type: string;
  clientId?: string;
  candles?: RawCandle[];
  candle?: RawCandle;
  graduationState?: GraduationState;
  acesUsdPrice?: string;
  error?: string;
  [key: string]: unknown;
}

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  openUsd: number;
  highUsd: number;
  lowUsd: number;
  closeUsd: number;
  volume: number;
  volumeUsd: number;
  trades: number;
  dataSource: 'bonding_curve' | 'dex';
  circulatingSupply: number | null;
  totalSupply: number | null;
  marketCapAces: number | null;
  marketCapUsd: number | null;
}

interface GraduationState {
  isBonded: boolean;
  poolAddress: string | null;
  poolReady: boolean;
  dexLiveAt: number | null;
}

interface UseUnifiedChartDataProps {
  tokenAddress: string;
  timeframe: string;
  enabled?: boolean;
}

interface UseUnifiedChartDataResult {
  candles: Candle[];
  latestCandle: Candle | null;
  graduationState: GraduationState | null;
  acesUsdPrice: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  connectionAttempts: number;
}

const toNumeric = (value: number | string | null | undefined, fallback = 0): number => {
  if (value === null || value === undefined) return fallback;
  const num = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
};

const toNullableNumeric = (
  value: number | string | null | undefined,
): number | null => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeCandle = (rawCandle: RawCandle): Candle => {
  const timestamp =
    typeof rawCandle.timestamp === 'number'
      ? rawCandle.timestamp
      : typeof rawCandle.timestamp === 'string'
        ? Number(rawCandle.timestamp)
        : rawCandle.timestamp?.valueOf() ?? Date.now();

  return {
    timestamp,
    open: toNumeric(rawCandle.open),
    high: toNumeric(rawCandle.high),
    low: toNumeric(rawCandle.low),
    close: toNumeric(rawCandle.close),
    openUsd: toNumeric(rawCandle.openUsd),
    highUsd: toNumeric(rawCandle.highUsd),
    lowUsd: toNumeric(rawCandle.lowUsd),
    closeUsd: toNumeric(rawCandle.closeUsd),
    volume: toNumeric(rawCandle.volume),
    volumeUsd: toNumeric(rawCandle.volumeUsd),
    trades: Math.round(toNumeric(rawCandle.trades)),
    dataSource: rawCandle.dataSource === 'dex' ? 'dex' : 'bonding_curve',
    circulatingSupply:
      toNullableNumeric(rawCandle.circulatingSupply ?? rawCandle.circulationSupply) ?? null,
    totalSupply: toNullableNumeric(rawCandle.totalSupply),
    marketCapAces: toNullableNumeric(rawCandle.marketCapAces),
    marketCapUsd: toNullableNumeric(rawCandle.marketCapUsd),
  };
};

/**
 * Unified chart data hook with WebSocket real-time updates
 * Automatically handles bonding curve → DEX transition
 */
export function useUnifiedChartData({
  tokenAddress,
  timeframe,
  enabled = true,
}: UseUnifiedChartDataProps): UseUnifiedChartDataResult {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [latestCandle, setLatestCandle] = useState<Candle | null>(null);
  const [graduationState, setGraduationState] = useState<GraduationState | null>(null);
  const [acesUsdPrice, setAcesUsdPrice] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscribedRef = useRef(false);

  const getWebSocketUrl = useCallback(() => {
    if (typeof window === 'undefined') return '';

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    // Use NEXT_PUBLIC_API_URL if available (replaced at build time by Next.js)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) {
      const url = new URL(apiUrl);
      return `${protocol}//${url.host}/ws/chart`;
    }

    // Fallback to current host
    return `${protocol}//${window.location.host}/ws/chart`;
  }, []);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    if (!enabled || !tokenAddress) return;

    const wsUrl = getWebSocketUrl();
    console.log('[useUnifiedChartData] Connecting to:', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[useUnifiedChartData] WebSocket connected');
        setIsConnected(true);
        setError(null);
        setConnectionAttempts(0);

        // Subscribe to token updates
        ws.send(
          JSON.stringify({
            type: 'subscribe',
            tokenAddress,
            timeframe,
          }),
        );
        subscribedRef.current = true;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (err) {
          console.error('[useUnifiedChartData] Failed to parse message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[useUnifiedChartData] WebSocket error:', err);
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        console.log('[useUnifiedChartData] WebSocket closed');
        setIsConnected(false);
        subscribedRef.current = false;
        wsRef.current = null;

        // Attempt reconnection with exponential backoff
        if (enabled) {
          const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 30000);
          console.log(`[useUnifiedChartData] Reconnecting in ${delay}ms...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            setConnectionAttempts((prev) => prev + 1);
            connect();
          }, delay);
        }
      };

      // Send ping every 30 seconds
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);

      return () => {
        clearInterval(pingInterval);
      };
    } catch (err) {
      console.error('[useUnifiedChartData] Connection failed:', err);
      setError('Failed to connect to data stream');
    }
  }, [enabled, tokenAddress, timeframe, connectionAttempts, getWebSocketUrl]);

  /**
   * Handle WebSocket messages
   */
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'connected':
        console.log('[useUnifiedChartData] Connected:', message.clientId);
        break;

      case 'initial_data':
        console.log('[useUnifiedChartData] Received initial data:', message.candles?.length ?? 0);
        {
          const normalizedCandles = (message.candles ?? []).map(normalizeCandle);
          setCandles(normalizedCandles);
          setLatestCandle(
            normalizedCandles.length > 0 ? normalizedCandles[normalizedCandles.length - 1] : null,
          );
        }
        setGraduationState(message.graduationState ?? null);
        setAcesUsdPrice(message.acesUsdPrice ?? null);
        setIsLoading(false);
        break;

      case 'candle_update':
        if (message.candle) {
          console.log('[useUnifiedChartData] Candle update:', message.candle.timestamp);
          const normalizedCandle = normalizeCandle(message.candle);
          setLatestCandle(normalizedCandle);

          // Update candles array
          setCandles((prev) => {
            const updated = [...prev];
            const existingIndex = updated.findIndex(
              (c) => c.timestamp === normalizedCandle.timestamp,
            );

            if (existingIndex >= 0) {
              // Update existing candle
              updated[existingIndex] = normalizedCandle;
            } else {
              // Add new candle
              updated.push(normalizedCandle);
            }

            // Keep only last 1000 candles
            return updated.slice(-1000);
          });
        }
        break;

      case 'pong':
        // Heartbeat response
        break;

      case 'error':
        console.error('[useUnifiedChartData] Server error:', message.error);
        setError(message.error ?? 'Unknown error');
        break;

      default:
        console.warn('[useUnifiedChartData] Unknown message type:', message.type);
    }
  }, []);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN && subscribedRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: 'unsubscribe',
            tokenAddress,
            timeframe,
          }),
        );
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    subscribedRef.current = false;
    setIsConnected(false);
  }, [tokenAddress, timeframe]);

  /**
   * Connect on mount, disconnect on unmount
   */
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  /**
   * Resubscribe when token/timeframe changes
   */
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Unsubscribe from old
      if (subscribedRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: 'unsubscribe',
            tokenAddress,
            timeframe,
          }),
        );
      }

      // Subscribe to new
      wsRef.current.send(
        JSON.stringify({
          type: 'subscribe',
          tokenAddress,
          timeframe,
        }),
      );
      subscribedRef.current = true;
      setIsLoading(true);
    }
  }, [tokenAddress, timeframe]);

  return {
    candles,
    latestCandle,
    graduationState,
    acesUsdPrice,
    isConnected,
    isLoading,
    error,
    connectionAttempts,
  };
}
