'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

interface PriceData {
  ethPrice: number;
  acesPrice: number;
  wethUsdPrice: number;
  usdcUsdPrice: number;
  usdtUsdPrice: number;
  acesPerWeth: number;
  lastUpdated: number;
  isStale: boolean;
}

interface PriceContextValue extends PriceData {
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const PriceContext = createContext<PriceContextValue | undefined>(undefined);

// Exponential backoff configuration
const INITIAL_BACKOFF = 1000; // 1 second
const MAX_BACKOFF = 30000; // 30 seconds
const MAX_FAILURES = 5;

interface PriceProviderProps {
  children: React.ReactNode;
  pollInterval?: number; // Default 10 seconds
}

export function PriceProvider({ children, pollInterval = 10000 }: PriceProviderProps) {
  const [priceData, setPriceData] = useState<PriceData>({
    ethPrice: 0,
    acesPrice: 0,
    wethUsdPrice: 0,
    usdcUsdPrice: 0,
    usdtUsdPrice: 0,
    acesPerWeth: 0,
    lastUpdated: 0,
    isStale: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const consecutiveFailures = useRef(0);
  const backoffDelay = useRef(INITIAL_BACKOFF);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPaused = useRef(false);
  const isMounted = useRef(true);

  const resolveApiBaseUrl = useCallback(() => {
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return '';
  }, []);

  const fetchPrices = useCallback(async () => {
    if (isPaused.current || !isMounted.current) {
      return;
    }

    try {
      const apiUrl = resolveApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/v1/prices/aces-usd`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('RATE_LIMITED');
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error('Invalid response format');
      }

      const data = result.data;

      if (isMounted.current) {
        setPriceData({
          ethPrice: Number(data.wethUsdPrice || 0),
          acesPrice: Number(data.acesUsdPrice || 0),
          wethUsdPrice: Number(data.wethUsdPrice || 0),
          usdcUsdPrice: Number(data.usdcUsdPrice || 1),
          usdtUsdPrice: Number(data.usdtUsdPrice || 1),
          acesPerWeth: Number(data.acesPerWeth || 0),
          lastUpdated: Date.now(),
          isStale: Boolean(data.isStale),
        });
        setError(null);
        setLoading(false);

        // Reset failure counters on success
        consecutiveFailures.current = 0;
        backoffDelay.current = INITIAL_BACKOFF;
      }
    } catch (err) {
      console.error('[PriceContext] Fetch error:', err);

      if (!isMounted.current) return;

      consecutiveFailures.current += 1;

      // Check if it's a rate limit error
      if (err instanceof Error && err.message === 'RATE_LIMITED') {
        // Double the backoff on rate limit
        backoffDelay.current = Math.min(backoffDelay.current * 2, MAX_BACKOFF);
        console.warn(`[PriceContext] Rate limited. Backing off for ${backoffDelay.current}ms`);
      } else {
        // Regular exponential backoff
        backoffDelay.current = Math.min(
          INITIAL_BACKOFF * Math.pow(2, consecutiveFailures.current - 1),
          MAX_BACKOFF,
        );
      }

      // Pause polling after MAX_FAILURES
      if (consecutiveFailures.current >= MAX_FAILURES) {
        console.error(
          '[PriceContext] Max failures reached. Pausing until tab focus or manual refresh.',
        );
        isPaused.current = true;
      }

      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
      setLoading(false);
    }
  }, [resolveApiBaseUrl]);

  const refresh = useCallback(() => {
    console.log('[PriceContext] Manual refresh triggered');
    isPaused.current = false;
    consecutiveFailures.current = 0;
    backoffDelay.current = INITIAL_BACKOFF;
    fetchPrices();
  }, [fetchPrices]);

  // Initial fetch
  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Set up polling interval
  useEffect(() => {
    const startPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      intervalRef.current = setInterval(
        () => {
          // Use backoff delay if we have failures, otherwise use normal interval
          const delay = consecutiveFailures.current > 0 ? backoffDelay.current : pollInterval;

          if (Date.now() - (priceData.lastUpdated || 0) >= delay) {
            fetchPrices();
          }
        },
        Math.min(pollInterval, backoffDelay.current),
      );
    };

    startPolling();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchPrices, pollInterval, priceData.lastUpdated]);

  // Handle visibility changes - pause when hidden, resume when visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[PriceContext] Tab hidden, pausing polling');
        isPaused.current = true;
      } else {
        console.log('[PriceContext] Tab visible, resuming polling');
        isPaused.current = false;
        // Fetch immediately when tab becomes visible
        fetchPrices();
      }
    };

    const handleFocus = () => {
      console.log('[PriceContext] Window focused');
      isPaused.current = false;
      fetchPrices();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchPrices]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const value: PriceContextValue = {
    ...priceData,
    loading,
    error,
    refresh,
  };

  return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>;
}

export function usePriceContext() {
  const context = useContext(PriceContext);
  if (context === undefined) {
    throw new Error('usePriceContext must be used within a PriceProvider');
  }
  return context;
}
