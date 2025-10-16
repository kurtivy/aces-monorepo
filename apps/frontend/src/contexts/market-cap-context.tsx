'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { isValidEthereumAddress } from '@/lib/validation/address';

interface MarketCapData {
  marketCapAces: number;
  marketCapUsd: number;
  circulatingSupply: number;
  currentPriceAces: number;
  currentPriceUsd: number;
  lastUpdated: number;
}

interface TokenMarketCapState {
  data: MarketCapData | null;
  loading: boolean;
  error: string | null;
  lastFetch: number;
}

interface MarketCapContextValue {
  getTokenMarketCap: (tokenAddress: string, currency?: 'usd' | 'aces') => TokenMarketCapState;
  refreshToken: (tokenAddress: string, currency?: 'usd' | 'aces') => void;
}

const MarketCapContext = createContext<MarketCapContextValue | undefined>(undefined);

const POLL_INTERVAL = 30000; // 30 seconds
const MAX_FAILURES = 5;
const INITIAL_BACKOFF = 1000;
const MAX_BACKOFF = 30000;

interface MarketCapProviderProps {
  children: React.ReactNode;
}

export function MarketCapProvider({ children }: MarketCapProviderProps) {
  const [tokenDataMap, setTokenDataMap] = useState<Map<string, TokenMarketCapState>>(new Map());

  const pollingTokens = useRef<Set<string>>(new Set());
  const pollIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const failureCounters = useRef<Map<string, number>>(new Map());
  const backoffDelays = useRef<Map<string, number>>(new Map());
  const isPaused = useRef(false);

  const resolveApiBaseUrl = useCallback(() => {
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return '';
  }, []);

  const getCacheKey = useCallback((tokenAddress: string, currency: 'usd' | 'aces' = 'usd') => {
    return `${tokenAddress.toLowerCase()}-${currency}`;
  }, []);

  const fetchMarketCap = useCallback(
    async (tokenAddress: string, currency: 'usd' | 'aces' = 'usd') => {
      const cacheKey = getCacheKey(tokenAddress, currency);

      if (isPaused.current) {
        return;
      }

      // Validate token address format (must be 40-char Ethereum address)
      if (!isValidEthereumAddress(tokenAddress)) {
        console.warn(`[MarketCapContext] Invalid token address format: ${tokenAddress}`);
        setTokenDataMap((prev) => {
          const newMap = new Map(prev);
          newMap.set(cacheKey, {
            data: null,
            loading: false,
            error: 'Invalid token address format',
            lastFetch: Date.now(),
          });
          return newMap;
        });
        return;
      }

      try {
        const apiUrl = resolveApiBaseUrl();
        const response = await fetch(
          `${apiUrl}/api/v1/chart/${tokenAddress}/market-cap?timeframe=5m&limit=1&currency=${currency}`,
          {
            signal: AbortSignal.timeout(5000),
          },
        );

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('RATE_LIMITED');
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (!result.success || !result.data?.candles || result.data.candles.length === 0) {
          throw new Error('No market cap data available');
        }

        // Get the most recent candle
        const latestCandle = result.data.candles[result.data.candles.length - 1];
        const marketCap = parseFloat(latestCandle.close || '0');
        const supply = parseFloat(latestCandle.circulatingSupply || '0');
        const priceInCurrency = supply > 0 ? marketCap / supply : 0;
        const acesUsdPrice = parseFloat(result.data.acesUsdPrice || '1');

        let marketCapAces: number;
        let marketCapUsd: number;
        let currentPriceAces: number;
        let currentPriceUsd: number;

        if (currency === 'usd') {
          marketCapUsd = marketCap;
          marketCapAces = acesUsdPrice > 0 ? marketCap / acesUsdPrice : 0;
          currentPriceUsd = priceInCurrency;
          currentPriceAces = acesUsdPrice > 0 ? priceInCurrency / acesUsdPrice : 0;
        } else {
          marketCapAces = marketCap;
          marketCapUsd = marketCap * acesUsdPrice;
          currentPriceAces = priceInCurrency;
          currentPriceUsd = priceInCurrency * acesUsdPrice;
        }

        // Update state
        setTokenDataMap((prev) => {
          const newMap = new Map(prev);
          newMap.set(cacheKey, {
            data: {
              marketCapAces,
              marketCapUsd,
              circulatingSupply: supply,
              currentPriceAces,
              currentPriceUsd,
              lastUpdated: Date.now(),
            },
            loading: false,
            error: null,
            lastFetch: Date.now(),
          });
          return newMap;
        });

        // Reset failure counters on success
        failureCounters.current.set(cacheKey, 0);
        backoffDelays.current.set(cacheKey, INITIAL_BACKOFF);
      } catch (err) {
        console.error(`[MarketCapContext] Fetch error for ${tokenAddress}:`, err);

        const currentFailures = (failureCounters.current.get(cacheKey) || 0) + 1;
        failureCounters.current.set(cacheKey, currentFailures);

        // Exponential backoff
        if (err instanceof Error && err.message === 'RATE_LIMITED') {
          const currentBackoff = backoffDelays.current.get(cacheKey) || INITIAL_BACKOFF;
          backoffDelays.current.set(cacheKey, Math.min(currentBackoff * 2, MAX_BACKOFF));
        } else {
          backoffDelays.current.set(
            cacheKey,
            Math.min(INITIAL_BACKOFF * Math.pow(2, currentFailures - 1), MAX_BACKOFF),
          );
        }

        // Pause this token after max failures
        if (currentFailures >= MAX_FAILURES) {
          console.error(`[MarketCapContext] Max failures reached for ${tokenAddress}. Pausing.`);
          stopPollingToken(tokenAddress, currency);
        }

        setTokenDataMap((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(cacheKey);
          newMap.set(cacheKey, {
            data: existing?.data || null,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to fetch market cap',
            lastFetch: Date.now(),
          });
          return newMap;
        });
      }
    },
    [getCacheKey, resolveApiBaseUrl],
  );

  const startPollingToken = useCallback(
    (tokenAddress: string, currency: 'usd' | 'aces' = 'usd') => {
      const cacheKey = getCacheKey(tokenAddress, currency);

      // Validate token address format before starting to poll
      if (!isValidEthereumAddress(tokenAddress)) {
        console.warn(`[MarketCapContext] Cannot poll invalid token address: ${tokenAddress}`);
        return;
      }

      if (pollingTokens.current.has(cacheKey)) {
        return; // Already polling
      }

      pollingTokens.current.add(cacheKey);

      // Initial fetch
      fetchMarketCap(tokenAddress, currency);

      // Set up interval
      const interval = setInterval(() => {
        if (isPaused.current) return;

        const backoff = backoffDelays.current.get(cacheKey) || INITIAL_BACKOFF;
        const effectiveInterval = Math.max(POLL_INTERVAL, backoff);

        const lastFetch = tokenDataMap.get(cacheKey)?.lastFetch || 0;
        if (Date.now() - lastFetch >= effectiveInterval) {
          fetchMarketCap(tokenAddress, currency);
        }
      }, POLL_INTERVAL);

      pollIntervals.current.set(cacheKey, interval);
    },
    [getCacheKey, fetchMarketCap, tokenDataMap],
  );

  const stopPollingToken = useCallback(
    (tokenAddress: string, currency: 'usd' | 'aces' = 'usd') => {
      const cacheKey = getCacheKey(tokenAddress, currency);

      const interval = pollIntervals.current.get(cacheKey);
      if (interval) {
        clearInterval(interval);
        pollIntervals.current.delete(cacheKey);
      }

      pollingTokens.current.delete(cacheKey);
    },
    [getCacheKey],
  );

  const getTokenMarketCap = useCallback(
    (tokenAddress: string, currency: 'usd' | 'aces' = 'usd'): TokenMarketCapState => {
      const cacheKey = getCacheKey(tokenAddress, currency);

      // Start polling if not already
      if (!pollingTokens.current.has(cacheKey)) {
        startPollingToken(tokenAddress, currency);
      }

      return (
        tokenDataMap.get(cacheKey) || {
          data: null,
          loading: true,
          error: null,
          lastFetch: 0,
        }
      );
    },
    [getCacheKey, startPollingToken, tokenDataMap],
  );

  const refreshToken = useCallback(
    (tokenAddress: string, currency: 'usd' | 'aces' = 'usd') => {
      const cacheKey = getCacheKey(tokenAddress, currency);
      console.log(`[MarketCapContext] Manual refresh for ${tokenAddress}`);

      // Reset failure counters
      failureCounters.current.set(cacheKey, 0);
      backoffDelays.current.set(cacheKey, INITIAL_BACKOFF);

      fetchMarketCap(tokenAddress, currency);
    },
    [getCacheKey, fetchMarketCap],
  );

  // Handle visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[MarketCapContext] Tab hidden, pausing polling');
        isPaused.current = true;
      } else {
        console.log('[MarketCapContext] Tab visible, resuming polling');
        isPaused.current = false;

        // Refresh all active tokens
        pollingTokens.current.forEach((cacheKey) => {
          const [tokenAddress, currency] = cacheKey.split('-');
          fetchMarketCap(tokenAddress, currency as 'usd' | 'aces');
        });
      }
    };

    const handleFocus = () => {
      isPaused.current = false;
      pollingTokens.current.forEach((cacheKey) => {
        const [tokenAddress, currency] = cacheKey.split('-');
        fetchMarketCap(tokenAddress, currency as 'usd' | 'aces');
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchMarketCap]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pollIntervals.current.forEach((interval) => clearInterval(interval));
      pollIntervals.current.clear();
      pollingTokens.current.clear();
    };
  }, []);

  const value: MarketCapContextValue = {
    getTokenMarketCap,
    refreshToken,
  };

  return <MarketCapContext.Provider value={value}>{children}</MarketCapContext.Provider>;
}

export function useMarketCapContext() {
  const context = useContext(MarketCapContext);
  if (context === undefined) {
    throw new Error('useMarketCapContext must be used within a MarketCapProvider');
  }
  return context;
}
