import { useState, useEffect, useCallback, useRef } from 'react';

interface RealtimeChartData {
  candles: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
  }>;
  volume: Array<{
    time: number;
    value: number;
    color: string;
  }>;
  lastUpdate: number;
  isLive: boolean;
  error?: string;
}

interface SmartPollingSubscription {
  tokenAddress: string;
  timeframe: string;
  data: any;
  timestamp: number;
  isLive: boolean;
  error?: string;
}

/**
 * Real-time chart data hook that integrates with SmartPollingManager
 * Provides centralized, efficient real-time data management
 */
export const useRealtimeChart = (tokenAddress: string, timeframe: string = '1h') => {
  const [data, setData] = useState<RealtimeChartData>({
    candles: [],
    volume: [],
    lastUpdate: 0,
    isLive: false,
  });

  const [isPolling, setIsPolling] = useState(false);
  const subscriptionIdRef = useRef<string | null>(null);
  const pollingManagerRef = useRef<any>(null);

  // Initialize Smart Polling Manager (simulated client-side)
  const initializePollingManager = useCallback(() => {
    if (pollingManagerRef.current) return pollingManagerRef.current;

    // Create a client-side polling manager that coordinates with backend
    pollingManagerRef.current = {
      subscriptions: new Map(),

      subscribe: (tokenAddr: string, tf: string, callback: (data: any) => void) => {
        const subscriptionId = `${Date.now()}-${tokenAddr}-${tf}`;

        // Store subscription
        pollingManagerRef.current.subscriptions.set(subscriptionId, {
          tokenAddress: tokenAddr,
          timeframe: tf,
          callback,
          lastUpdate: 0,
        });

        // Start polling for this token/timeframe combination
        const interval = setInterval(async () => {
          try {
            const response = await fetch(
              `/api/v1/tokens/${tokenAddr}/live?timeframe=${tf}&since=${Math.floor((Date.now() - 300000) / 1000)}`,
            );

            if (!response.ok) {
              throw new Error(`API request failed: ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.data) {
              const subscription = pollingManagerRef.current.subscriptions.get(subscriptionId);
              if (subscription) {
                subscription.callback({
                  tokenAddress: tokenAddr,
                  timeframe: tf,
                  data: result.data,
                  timestamp: Date.now(),
                  isLive: true,
                });
                subscription.lastUpdate = Date.now();
              }
            }
          } catch (error) {
            console.error(`[useRealtimeChart] Polling error for ${tokenAddr}:`, error);
            const subscription = pollingManagerRef.current.subscriptions.get(subscriptionId);
            if (subscription) {
              subscription.callback({
                tokenAddress: tokenAddr,
                timeframe: tf,
                error: 'Live data unavailable',
                timestamp: Date.now(),
                isLive: false,
              });
            }
          }
        }, 10000); // 10-second polling to reduce subgraph pressure

        // Store interval for cleanup
        pollingManagerRef.current.subscriptions.get(subscriptionId).interval = interval;

        return subscriptionId;
      },

      unsubscribe: (subscriptionId: string) => {
        const subscription = pollingManagerRef.current.subscriptions.get(subscriptionId);
        if (subscription && subscription.interval) {
          clearInterval(subscription.interval);
          pollingManagerRef.current.subscriptions.delete(subscriptionId);
          console.log(`[useRealtimeChart] Unsubscribed: ${subscriptionId}`);
        }
      },

      getStats: () => {
        return {
          activeSubscriptions: pollingManagerRef.current.subscriptions.size,
          subscriptions: Array.from(pollingManagerRef.current.subscriptions.keys()),
        };
      },
    };

    return pollingManagerRef.current;
  }, []);

  // Start polling when hook is used
  const startPolling = useCallback(() => {
    if (isPolling || !tokenAddress) return;

    console.log(`[useRealtimeChart] Starting polling for ${tokenAddress} ${timeframe}`);
    setIsPolling(true);

    const pollingManager = initializePollingManager();

    // Subscribe to real-time updates through Smart Polling Manager
    const subscriptionId = pollingManager.subscribe(
      tokenAddress,
      timeframe,
      (update: SmartPollingSubscription) => {
        if (update.error) {
          setData((prev) => ({
            ...prev,
            error: update.error,
            isLive: false,
            lastUpdate: update.timestamp,
          }));
        } else if (update.data) {
          setData((prev) => ({
            candles: update.data.candles || [],
            volume: update.data.volume || [],
            lastUpdate: update.timestamp,
            isLive: update.isLive,
            error: undefined,
          }));
        }
      },
    );

    subscriptionIdRef.current = subscriptionId;

    // Also fetch initial data
    fetchInitialData();
  }, [tokenAddress, timeframe, isPolling, initializePollingManager]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (!isPolling || !subscriptionIdRef.current) return;

    console.log(`[useRealtimeChart] Stopping polling for ${tokenAddress} ${timeframe}`);

    const pollingManager = pollingManagerRef.current;
    if (pollingManager && subscriptionIdRef.current) {
      pollingManager.unsubscribe(subscriptionIdRef.current);
    }

    subscriptionIdRef.current = null;
    setIsPolling(false);
  }, [tokenAddress, timeframe, isPolling]);

  // Fetch initial historical data
  const fetchInitialData = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/v1/tokens/${tokenAddress}/chart?timeframe=${timeframe}&mode=hybrid&limit=1000`,
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch initial data: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        setData((prev) => ({
          ...prev,
          candles: result.data.candles || [],
          volume: result.data.volume || [],
          lastUpdate: Date.now(),
        }));
      }
    } catch (error) {
      console.error('[useRealtimeChart] Error fetching initial data:', error);
      setData((prev) => ({
        ...prev,
        error: 'Failed to load initial chart data',
      }));
    }
  }, [tokenAddress, timeframe]);

  // Manual refresh function
  const refreshData = useCallback(async () => {
    await fetchInitialData();
  }, [fetchInitialData]);

  // Get polling manager stats for debugging
  const getPollingStats = useCallback(() => {
    return pollingManagerRef.current?.getStats() || { activeSubscriptions: 0, subscriptions: [] };
  }, []);

  // Auto-start polling when dependencies change
  useEffect(() => {
    if (tokenAddress && timeframe) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [tokenAddress, timeframe, startPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    // Data
    data,
    isPolling,

    // Controls
    startPolling,
    stopPolling,
    refreshData,

    // Debug
    getPollingStats,

    // Computed values
    hasData: data.candles.length > 0,
    isConnected: data.isLive && !data.error,
    lastUpdateTime: new Date(data.lastUpdate),
  };
};
