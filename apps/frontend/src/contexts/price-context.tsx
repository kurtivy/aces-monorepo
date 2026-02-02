'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';

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
/** Client timeout for price fetch; must be longer than server-side refresh (CoinGecko + RPC). */
const FETCH_TIMEOUT_MS = 15000;

interface PriceProviderProps {
  children: React.ReactNode;
  pollInterval?: number; // Default 10 seconds
}

/** Only fetch/poll prices on RWA token pages (desktop and mobile use same /rwa/[symbol] route). */
function isRwaPriceRoute(pathname: string | null): boolean {
  return typeof pathname === 'string' && pathname.startsWith('/rwa/');
}

export function PriceProvider({ children, pollInterval = 10000 }: PriceProviderProps) {
  const pathname = usePathname();
  const shouldFetchPrices = isRwaPriceRoute(pathname);

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

  // Use frontend's own Next.js API route (same origin); no backend call
  const getPricesUrl = useCallback(() => {
    if (typeof window !== 'undefined') {
      return '/api/prices/aces-usd';
    }
    const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || '';
    return base ? `${base}/api/prices/aces-usd` : '/api/prices/aces-usd';
  }, []);

  const fetchPrices = useCallback(async () => {
    if (isPaused.current || !isMounted.current || !shouldFetchPrices) {
      return;
    }

    try {
      const response = await fetch(getPricesUrl(), {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
  }, [getPricesUrl, shouldFetchPrices]);

  const refresh = useCallback(() => {
    console.log('[PriceContext] Manual refresh triggered');
    isPaused.current = false;
    consecutiveFailures.current = 0;
    backoffDelay.current = INITIAL_BACKOFF;
    fetchPrices();
  }, [fetchPrices]);

  // Initial fetch only on RWA token pages (desktop + mobile use /rwa/[symbol])
  useEffect(() => {
    if (shouldFetchPrices) {
      setLoading(true);
      fetchPrices();
    } else {
      setLoading(false);
    }
  }, [fetchPrices, shouldFetchPrices]);

  // Set up polling interval only on RWA token pages
  useEffect(() => {
    if (!shouldFetchPrices) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

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
  }, [fetchPrices, pollInterval, priceData.lastUpdated, shouldFetchPrices]);

  // Handle visibility changes - pause when hidden, resume when visible (only on RWA)
  useEffect(() => {
    if (!shouldFetchPrices) return;

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
  }, [fetchPrices, shouldFetchPrices]);

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
