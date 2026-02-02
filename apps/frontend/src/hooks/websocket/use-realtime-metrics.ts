/**
 * useRealtimeMetrics Hook
 *
 * Real-time token metrics via Next.js API (frontend-only, no backend).
 * Prefers SSE stream (/api/tokens/:address/health/stream) for live updates;
 * falls back to polling GET /api/tokens/:address/health if SSE is unavailable.
 */

import { useEffect, useState, useRef, useCallback } from 'react';

export interface RealtimeMetrics {
  tokenAddress: string;
  marketCapUsd?: number;
  currentPriceUsd?: number;
  volume24hUsd?: number;
  volume24hAces?: string;
  liquidityUsd?: number | null;
  liquiditySource?: 'bonding_curve' | 'dex' | null;
  circulatingSupply?: number | null;
  rewardSupply?: number | null; // Actual circulating for reward calculations (excludes LP tokens)
  // Fee breakdown (may not be present in all payloads)
  totalFeesUsd?: number;
  totalFeesAces?: string;
  dexFeesUsd?: number;
  dexFeesAces?: string;
  bondingFeesUsd?: number;
  bondingFeesAces?: string;
  bondingData?: {
    isBonded: boolean;
    bondingPercentage: number;
    currentSupply: string;
    tokensBondedAt: string;
  };
  timestamp: number;
}

interface UseRealtimeMetricsOptions {
  /** Enable debug logging (default: false) */
  debug?: boolean;
  /** Use SSE stream for real-time updates (default: true) */
  useSSE?: boolean;
  /** Use polling when SSE is not used or fails (default: true) */
  fallbackToPolling?: boolean;
  /** Polling interval in ms when not using SSE (default: 30000) */
  pollingInterval?: number;
  /** SSE push interval in ms (default: 5000, aligned with server cache for Alchemy rate limits) */
  sseIntervalMs?: number;
}

interface UseRealtimeMetricsResult {
  metrics: RealtimeMetrics | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
}

function payloadToRealtimeMetrics(
  tokenAddress: string,
  payload: Record<string, unknown>,
): RealtimeMetrics {
  const timestamp = (payload.timestamp as number) || Date.now();
  const metrics: RealtimeMetrics = {
    tokenAddress: tokenAddress.toLowerCase(),
    timestamp,
  };
  if (payload.marketCapUsd !== undefined) metrics.marketCapUsd = payload.marketCapUsd as number;
  if (payload.currentPriceUsd !== undefined)
    metrics.currentPriceUsd = payload.currentPriceUsd as number;
  if (payload.volume24hUsd !== undefined) metrics.volume24hUsd = payload.volume24hUsd as number;
  if (payload.volume24hAces !== undefined) metrics.volume24hAces = String(payload.volume24hAces);
  if (payload.liquidityUsd !== undefined)
    metrics.liquidityUsd = payload.liquidityUsd as number | null;
  if (payload.liquiditySource !== undefined)
    metrics.liquiditySource = payload.liquiditySource as 'bonding_curve' | 'dex' | null;
  if (payload.circulatingSupply !== undefined)
    metrics.circulatingSupply = payload.circulatingSupply as number | null;
  if (payload.rewardSupply !== undefined)
    metrics.rewardSupply = payload.rewardSupply as number | null;
  if (payload.bondingData !== undefined)
    metrics.bondingData = payload.bondingData as RealtimeMetrics['bondingData'];
  return metrics;
}

export const useRealtimeMetrics = (
  tokenAddress: string | undefined,
  options: UseRealtimeMetricsOptions = {},
): UseRealtimeMetricsResult => {
  const {
    debug = false,
    useSSE = true,
    fallbackToPolling = true,
    pollingInterval = 30000,
    sseIntervalMs = 5000,
  } = options;

  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const mountedRef = useRef(true);
  const usePollingRef = useRef(false);

  const log = useCallback(
    (message: string, data?: unknown) => {
      if (debug) {
        console.log(`[useRealtimeMetrics] ${message}`, data ?? '');
      }
    },
    [debug],
  );

  const getHealthUrl = useCallback(() => {
    return `/api/tokens/${tokenAddress}/health?chainId=8453&currency=usd`;
  }, [tokenAddress]);

  const getStreamUrl = useCallback(() => {
    return `/api/tokens/${tokenAddress}/health/stream?chainId=8453&currency=usd&intervalMs=${sseIntervalMs}`;
  }, [tokenAddress, sseIntervalMs]);

  const startPolling = useCallback(() => {
    if (!tokenAddress || !fallbackToPolling) return;

    const fetchMetrics = async () => {
      if (!mountedRef.current) return;

      try {
        const response = await fetch(getHealthUrl());
        const data = await response.json();
        // Health endpoint returns { success, data: { metricsData, marketCapData, bondingData } }
        const payload = data.success && data.data ? data.data : null;

        if (payload && mountedRef.current) {
          const metricsUpdate: RealtimeMetrics = {
            tokenAddress: tokenAddress.toLowerCase(),
            timestamp: Date.now(),
          };

          if (payload.metricsData) {
            metricsUpdate.marketCapUsd = payload.metricsData.marketCapUsd;
            metricsUpdate.volume24hUsd = payload.metricsData.volume24hUsd;
            metricsUpdate.volume24hAces = payload.metricsData.volume24hAces;
            metricsUpdate.liquidityUsd = payload.metricsData.liquidityUsd;
            metricsUpdate.liquiditySource = payload.metricsData.liquiditySource;
          }

          if (payload.marketCapData) {
            metricsUpdate.currentPriceUsd = payload.marketCapData.currentPriceUsd;
            if (
              payload.marketCapData.circulatingSupply !== undefined &&
              payload.marketCapData.circulatingSupply !== null &&
              Number.isFinite(payload.marketCapData.circulatingSupply)
            ) {
              metricsUpdate.circulatingSupply = payload.marketCapData.circulatingSupply;
            }
            if (
              payload.marketCapData.rewardSupply !== undefined &&
              payload.marketCapData.rewardSupply !== null
            ) {
              metricsUpdate.rewardSupply = payload.marketCapData.rewardSupply;
            }
          }

          if (payload.bondingData?.currentSupply) {
            const supply = parseFloat(payload.bondingData.currentSupply);
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
  }, [tokenAddress, fallbackToPolling, pollingInterval, log, getHealthUrl]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      log('Stopped REST polling');
    }
  }, [log]);

  const closeSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      log('Closed SSE stream');
    }
  }, [log]);

  const disconnect = useCallback(() => {
    log('Disconnecting...');
    closeSSE();
    stopPolling();
    setIsConnected(false);
    setIsConnecting(false);
  }, [log, closeSSE, stopPolling]);

  const connect = useCallback(async () => {
    if (!tokenAddress) {
      log('No token address provided');
      return;
    }

    setIsConnecting(true);
    setError(null);
    usePollingRef.current = false;
    closeSSE();

    const tryPolling = () => {
      if (!mountedRef.current || !fallbackToPolling) return;
      usePollingRef.current = true;
      startPolling();
      setIsConnecting(false);
    };

    // Prefer SSE when in browser and useSSE is true
    if (typeof window !== 'undefined' && useSSE) {
      const streamUrl = getStreamUrl();
      log('Connecting to SSE stream', streamUrl);
      try {
        const es = new EventSource(streamUrl);
        eventSourceRef.current = es;

        es.onopen = () => {
          if (mountedRef.current) {
            setIsConnected(true);
            setIsConnecting(false);
            log('✅ SSE stream open');
          }
        };

        es.onmessage = (event: MessageEvent) => {
          if (!mountedRef.current) return;
          try {
            const raw = typeof event.data === 'string' ? event.data : '';
            const payload = JSON.parse(raw) as Record<string, unknown>;
            if (payload.success === false) {
              setError((payload.error as string) || 'Stream error');
              return;
            }
            const next = payloadToRealtimeMetrics(tokenAddress, payload);
            setMetrics(next);
            setError(null);
          } catch (e) {
            log('SSE message parse error', e);
          }
        };

        es.onerror = () => {
          if (!mountedRef.current) return;
          log('SSE error, falling back to polling');
          es.close();
          eventSourceRef.current = null;
          setIsConnected(false);
          setError(null);
          tryPolling();
        };
      } catch (err) {
        log('SSE connect failed, falling back to polling', err);
        if (mountedRef.current) {
          setError(null);
          tryPolling();
        }
      }
      return;
    }

    // No SSE: initial fetch + polling
    const healthPath = getHealthUrl();
    try {
      const response = await fetch(healthPath);
      const data = await response.json();
      const payload = data.success && data.data ? data.data : null;

      if (payload && mountedRef.current) {
        const initialMetrics: RealtimeMetrics = {
          tokenAddress: tokenAddress.toLowerCase(),
          timestamp: Date.now(),
        };
        if (payload.metricsData) {
          initialMetrics.marketCapUsd = payload.metricsData.marketCapUsd;
          initialMetrics.volume24hUsd = payload.metricsData.volume24hUsd;
          initialMetrics.volume24hAces = payload.metricsData.volume24hAces;
          initialMetrics.liquidityUsd = payload.metricsData.liquidityUsd;
          initialMetrics.liquiditySource = payload.metricsData.liquiditySource;
        }
        if (payload.marketCapData) {
          initialMetrics.currentPriceUsd = payload.marketCapData.currentPriceUsd;
          if (
            payload.marketCapData.circulatingSupply !== undefined &&
            payload.marketCapData.circulatingSupply !== null &&
            Number.isFinite(payload.marketCapData.circulatingSupply)
          ) {
            initialMetrics.circulatingSupply = payload.marketCapData.circulatingSupply;
          }
          if (
            payload.marketCapData.rewardSupply !== undefined &&
            payload.marketCapData.rewardSupply !== null
          ) {
            initialMetrics.rewardSupply = payload.marketCapData.rewardSupply;
          }
        }
        if (payload.bondingData?.currentSupply) {
          const supply = parseFloat(payload.bondingData.currentSupply);
          if (Number.isFinite(supply) && supply > 0) {
            initialMetrics.circulatingSupply = supply;
          }
        }
        setMetrics(initialMetrics);
        setError(null);
        log('✅ Initial data loaded from Next.js API');
      }
    } catch (err) {
      log('Initial fetch failed', err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load metrics');
      }
    }

    if (!mountedRef.current) return;
    if (fallbackToPolling && !usePollingRef.current) {
      usePollingRef.current = true;
      startPolling();
    }
    setIsConnecting(false);
  }, [
    tokenAddress,
    useSSE,
    fallbackToPolling,
    log,
    getHealthUrl,
    getStreamUrl,
    startPolling,
    closeSSE,
    sseIntervalMs,
  ]);

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
