/**
 * useRealtimeMetrics Hook
 *
 * Real-time WebSocket connection for token metrics streaming.
 * Replaces REST API polling with instant WebSocket updates.
 * Respects rate limits by batching updates.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { getReconnectDelay, shouldReconnect, formatReconnectDelay } from '@/lib/websocket/reconnection-utils';

export interface RealtimeMetrics {
  tokenAddress: string;
  marketCapUsd?: number;
  currentPriceUsd?: number;
  volume24hUsd?: number;
  volume24hAces?: string;
  liquidityUsd?: number | null;
  liquiditySource?: 'bonding_curve' | 'dex' | null;
  circulatingSupply?: number | null;
  // Fee breakdown (may not be present in all WS payloads)
  totalFeesUsd?: number;
  totalFeesAces?: string;
  dexFeesUsd?: number;
  dexFeesAces?: string;
  bondingFeesUsd?: number;
  bondingFeesAces?: string;
  // 🔥 NEW: Bonding data fields
  bondingData?: {
    isBonded: boolean;
    bondingPercentage: number;
    currentSupply: string;
    tokensBondedAt: string;
  };
  timestamp: number;
}

interface UseRealtimeMetricsOptions {
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnect delay in ms (default: 5000) */
  reconnectDelay?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
  /** Fallback to REST polling if WebSocket fails (default: true) */
  fallbackToPolling?: boolean;
  /** Polling interval in ms when using fallback (default: 30000) */
  pollingInterval?: number;
}

interface UseRealtimeMetricsResult {
  metrics: RealtimeMetrics | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
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

export const useRealtimeMetrics = (
  tokenAddress: string | undefined,
  options: UseRealtimeMetricsOptions = {},
): UseRealtimeMetricsResult => {
  const {
    autoReconnect = true,
    reconnectDelay = 5000,
    debug = false,
    fallbackToPolling = true,
    pollingInterval = 30000,
  } = options;

  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔥 NEW: Heartbeat monitoring for connection health
  const [connectionHealth, setConnectionHealth] = useState({
    lastHeartbeat: 0,
    isHealthy: true,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0); // Track reconnection attempts for exponential backoff
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatMonitorRef = useRef<NodeJS.Timeout | null>(null); // 🔥 NEW: Heartbeat monitor
  const mountedRef = useRef(true);
  const usePollingRef = useRef(false);

  const log = useCallback(
    (message: string, data?: any) => {
      if (debug) {
        console.log(`[useRealtimeMetrics] ${message}`, data || '');
      }
    },
    [debug],
  );

  // Fallback REST API polling
  const startPolling = useCallback(() => {
    if (!tokenAddress || !fallbackToPolling) return;

    const fetchMetrics = async () => {
      if (!mountedRef.current) return;

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
        const response = await fetch(
          `${apiUrl}/api/v1/tokens/${tokenAddress}/health?chainId=8453&currency=usd`,
        );
        const data = await response.json();

        if (data.success && mountedRef.current) {
          const metricsUpdate: RealtimeMetrics = {
            tokenAddress: tokenAddress.toLowerCase(),
            timestamp: Date.now(),
          };

          if (data.metricsData) {
            metricsUpdate.marketCapUsd = data.metricsData.marketCapUsd;
            metricsUpdate.volume24hUsd = data.metricsData.volume24hUsd;
            metricsUpdate.volume24hAces = data.metricsData.volume24hAces;
            metricsUpdate.liquidityUsd = data.metricsData.liquidityUsd;
            metricsUpdate.liquiditySource = data.metricsData.liquiditySource;
          }

          if (data.marketCapData) {
            metricsUpdate.currentPriceUsd = data.marketCapData.currentPriceUsd;
          }

          if (data.bondingData?.currentSupply) {
            const supply = parseFloat(data.bondingData.currentSupply);
            if (Number.isFinite(supply) && supply > 0) {
              metricsUpdate.circulatingSupply = supply;
            }
          }

          setMetrics(metricsUpdate);
          setError(null);
        }
      } catch (err) {
        if (mountedRef.current) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to fetch metrics';
          log('Polling error', errorMessage);
          setError(errorMessage);
        }
      }
    };

    // Initial fetch
    fetchMetrics();

    // Set up polling interval
    pollingIntervalRef.current = setInterval(fetchMetrics, pollingInterval);
    log('Started REST polling fallback', { interval: pollingInterval });
  }, [tokenAddress, fallbackToPolling, pollingInterval, log]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      log('Stopped REST polling');
    }
  }, [log]);

  // 🔥 NEW: Stop heartbeat monitoring
  const stopHeartbeatMonitor = useCallback(() => {
    if (heartbeatMonitorRef.current) {
      clearInterval(heartbeatMonitorRef.current);
      heartbeatMonitorRef.current = null;
      log('Stopped heartbeat monitor');
    }
  }, [log]);

  const disconnect = useCallback(() => {
    log('Disconnecting...');

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopPolling();
    stopHeartbeatMonitor(); // 🔥 NEW: Stop heartbeat monitor on disconnect

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, [log, stopPolling, stopHeartbeatMonitor]);

  const connect = useCallback(async () => {
    if (!tokenAddress) {
      log('No token address provided');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      log('Already connected');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      log('Already connecting');
      return;
    }

    setIsConnecting(true);
    setError(null);
    usePollingRef.current = false;

    // 🔥 FIX: Fetch initial data via REST BEFORE WebSocket connects
    // This ensures initial data loads first, then WebSocket streams updates
    // Prevents race condition where WebSocket messages arrive before initial state
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      const response = await fetch(
        `${apiUrl}/api/v1/tokens/${tokenAddress}/health?chainId=8453&currency=usd`,
      );
      const data = await response.json();

      if (data.success && mountedRef.current) {
        const initialMetrics: RealtimeMetrics = {
          tokenAddress: tokenAddress.toLowerCase(),
          timestamp: Date.now(),
        };

        if (data.metricsData) {
          initialMetrics.marketCapUsd = data.metricsData.marketCapUsd;
          initialMetrics.volume24hUsd = data.metricsData.volume24hUsd;
          initialMetrics.volume24hAces = data.metricsData.volume24hAces;
          initialMetrics.liquidityUsd = data.metricsData.liquidityUsd;
          initialMetrics.liquiditySource = data.metricsData.liquiditySource;
        }

        if (data.marketCapData) {
          initialMetrics.currentPriceUsd = data.marketCapData.currentPriceUsd;
        }

        if (data.bondingData?.currentSupply) {
          const supply = parseFloat(data.bondingData.currentSupply);
          if (Number.isFinite(supply) && supply > 0) {
            initialMetrics.circulatingSupply = supply;
          }
        }

        if (mountedRef.current) {
          setMetrics(initialMetrics);
          setError(null);
        }
        log('✅ Initial data loaded, now connecting WebSocket');
      }
    } catch (err) {
      // Don't set error here - let WebSocket attempt connection first
      log('Initial data fetch failed, will retry via WebSocket', err);
    }

    // 🔥 FIX: Only connect to WebSocket after initial data is loaded
    if (!mountedRef.current) return;

    try {
      const wsUrl = `${WS_BASE_URL}/api/v1/ws/metrics/${tokenAddress}`;
      log('Connecting to', wsUrl);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        usePollingRef.current = false;
        reconnectAttemptRef.current = 0; // Reset reconnection counter on success
        stopPolling(); // Stop polling when WebSocket connects

        // 🔥 NEW: Start heartbeat monitoring
        setConnectionHealth({ lastHeartbeat: Date.now(), isHealthy: true });
        stopHeartbeatMonitor(); // Clear any existing monitor

        const HEARTBEAT_INTERVAL = 30000; // Backend sends every 30s
        const HEARTBEAT_TIMEOUT = 60000; // 60s timeout (2x interval + grace period)

        heartbeatMonitorRef.current = setInterval(() => {
          if (!mountedRef.current) return;

          setConnectionHealth((prev) => {
            if (prev.lastHeartbeat === 0) {
              return prev; // Haven't received first heartbeat yet
            }

            const timeSinceLastHeartbeat = Date.now() - prev.lastHeartbeat;

            // If no heartbeat for 60s, connection is likely dead
            if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
              log('❌ Heartbeat timeout (60s+), zombie connection detected, forcing reconnect');
              // Force immediate reconnect
              if (ws.readyState === WebSocket.OPEN) {
                ws.close();
              }
              return { ...prev, isHealthy: false };
            }

            // If no heartbeat for 45s, log warning but don't reconnect yet
            if (timeSinceLastHeartbeat > 45000 && prev.isHealthy) {
              log('⚠️ Heartbeat delayed (45s+), connection may be degraded');
              return { ...prev, isHealthy: false };
            }

            return prev;
          });
        }, 10000); // Check every 10s

        log('Started heartbeat monitoring');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // 🔥 IMPROVEMENT: Handle heartbeat ping/pong
          if (message.type === 'ping') {
            // Respond to server ping with pong
            ws.send(JSON.stringify({ type: 'pong' }));

            // 🔥 NEW: Track heartbeat health
            setConnectionHealth({
              lastHeartbeat: Date.now(),
              isHealthy: true,
            });
            log('✅ Heartbeat received, connection healthy');
            return;
          }

          if (message.type === 'metrics') {
            if (mountedRef.current) {
              // 🔥 FIX: Always create new object reference to ensure React detects changes
              // Even if values are the same, creating a new object ensures re-renders
              const metricsData = message.data as RealtimeMetrics;
              setMetrics({
                ...metricsData,
                timestamp: metricsData.timestamp || Date.now(),
              });
              setError(null);
            }
          } else if (message.type === 'subscribed') {
            log('Subscribed to metrics updates', message.data);
          } else if (message.type === 'error') {
            const errorMsg = message.message || 'WebSocket error';
            log('Server error', errorMsg);
            if (mountedRef.current) {
              setError(errorMsg);
              // Fallback to polling on error
              if (fallbackToPolling && !usePollingRef.current) {
                usePollingRef.current = true;
                startPolling();
              }
            }
          } else if (message.type === 'warning') {
            log('Warning', message.message);
          }
        } catch (err) {
          log('Error parsing message', err);
        }
      };

      ws.onerror = (event) => {
        log('WebSocket error', event);
        if (mountedRef.current) {
          setError('WebSocket connection error');
          // Fallback to polling on error
          if (fallbackToPolling && !usePollingRef.current) {
            usePollingRef.current = true;
            startPolling();
          }
        }
      };

      ws.onclose = (event) => {
        log('WebSocket closed', { code: event.code, reason: event.reason });
        setIsConnected(false);
        setIsConnecting(false);

        if (mountedRef.current) {
          // Auto-reconnect with exponential backoff if enabled and appropriate
          if (autoReconnect && shouldReconnect(event.code)) {
            const delay = getReconnectDelay(reconnectAttemptRef.current);
            reconnectAttemptRef.current += 1;
            
            log(`Reconnecting in ${formatReconnectDelay(delay)} (attempt ${reconnectAttemptRef.current})...`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) {
                connect();
              }
            }, delay);
          } else if (fallbackToPolling && !usePollingRef.current) {
            // Fallback to polling if reconnect is disabled
            log('Not reconnecting, falling back to polling');
            usePollingRef.current = true;
            startPolling();
          }
        }
      };

      wsRef.current = ws;
    } catch (err) {
      log('Failed to create WebSocket', err);
      setIsConnecting(false);
      setError('Failed to create WebSocket connection');
      // Fallback to polling
      if (fallbackToPolling && !usePollingRef.current) {
        usePollingRef.current = true;
        startPolling();
      }
    }
  }, [tokenAddress, autoReconnect, reconnectDelay, fallbackToPolling, log, startPolling, stopPolling]);

  useEffect(() => {
    mountedRef.current = true;

    if (tokenAddress) {
      // 🔥 NEW: Clear old token data immediately when switching
      setMetrics(null);
      setError(null);
      setIsConnected(false);
      setIsConnecting(true);

      // Connect to new token
      connect();
    } else {
      // Clear everything if no token
      setMetrics(null);
      setError(null);
      setIsConnected(false);
      setIsConnecting(false);
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [tokenAddress, connect, disconnect]);

  return {
    metrics,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
  };
};
