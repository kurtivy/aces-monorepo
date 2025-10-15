'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';

interface BondingData {
  curve: number;
  currentSupply: string;
  tokensBondedAt: string;
  acesBalance: string;
  floorWei: string;
  floorPriceACES: string;
  steepness: string;
  isBonded: boolean;
  bondingPercentage: number;
  chainId: number;
  lastUpdated: number;
}

interface TokenBondingState {
  data: BondingData | null;
  loading: boolean;
  error: string | null;
  lastFetch: number;
}

interface BondingDataContextValue {
  getTokenData: (tokenAddress: string, chainId?: number) => TokenBondingState;
  refreshToken: (tokenAddress: string, chainId?: number) => void;
}

const BondingDataContext = createContext<BondingDataContextValue | undefined>(undefined);

// Exponential backoff configuration
const INITIAL_BACKOFF = 1000;
const MAX_BACKOFF = 30000;
const MAX_FAILURES = 5;

// Polling intervals
const ACTIVE_TRADING_INTERVAL = 5000; // 5 seconds when actively trading
const BACKGROUND_INTERVAL = 30000; // 30 seconds when in background
const INTERACTION_TIMEOUT = 30000; // Consider inactive after 30s of no interaction

interface BondingDataProviderProps {
  children: React.ReactNode;
}

export function BondingDataProvider({ children }: BondingDataProviderProps) {
  const pathname = usePathname();

  // Map of tokenAddress-chainId to BondingData
  const [tokenDataMap, setTokenDataMap] = useState<Map<string, TokenBondingState>>(new Map());

  // Track which tokens are actively being polled
  const pollingTokens = useRef<Set<string>>(new Set());
  const pollIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());
  // Switch to timeout-based scheduler per token to avoid runaway intervals
  const pollTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const failureCounters = useRef<Map<string, number>>(new Map());
  const backoffDelays = useRef<Map<string, number>>(new Map());
  const lastInteraction = useRef<number>(Date.now());
  const isPaused = useRef(false);
  // Track per-token last attempt timestamps (to avoid stale-closure on state)
  const lastAttemptAt = useRef<Map<string, number>>(new Map());
  // Track in-flight requests to prevent overlap
  const inFlight = useRef<Map<string, boolean>>(new Map());

  const resolveApiBaseUrl = useCallback(() => {
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return '';
  }, []);

  const getCacheKey = useCallback((tokenAddress: string, chainId: number = 8453) => {
    return `${tokenAddress.toLowerCase()}-${chainId}`;
  }, []);

  const isActiveTrading = useCallback(() => {
    // Check if we're on a token page (/rwa/[symbol])
    const isOnTokenPage = pathname?.includes('/rwa/');

    // Check if there was recent interaction
    const recentInteraction = Date.now() - lastInteraction.current < INTERACTION_TIMEOUT;

    return isOnTokenPage && recentInteraction;
  }, [pathname]);

  const fetchBondingData = useCallback(
    async (tokenAddress: string, chainId: number = 8453) => {
      const cacheKey = getCacheKey(tokenAddress, chainId);

      if (isPaused.current) {
        return;
      }

      // Prevent overlapping requests for the same token
      if (inFlight.current.get(cacheKey)) {
        return;
      }

      // Record attempt time immediately so scheduler respects backoff even if request is slow
      lastAttemptAt.current.set(cacheKey, Date.now());
      inFlight.current.set(cacheKey, true);

      try {
        const apiUrl = resolveApiBaseUrl();
        const response = await fetch(
          `${apiUrl}/api/v1/bonding/${tokenAddress}/data?chainId=${chainId}`,
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

        if (!result.success || !result.data) {
          throw new Error('Invalid response format');
        }

        // Update state
        setTokenDataMap((prev) => {
          const newMap = new Map(prev);
          newMap.set(cacheKey, {
            data: result.data,
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
        console.error(`[BondingDataContext] Fetch error for ${tokenAddress}:`, err);

        const currentFailures = (failureCounters.current.get(cacheKey) || 0) + 1;
        failureCounters.current.set(cacheKey, currentFailures);

        // Exponential backoff
        if (err instanceof Error && err.message === 'RATE_LIMITED') {
          const currentBackoff = backoffDelays.current.get(cacheKey) || INITIAL_BACKOFF;
          backoffDelays.current.set(cacheKey, Math.min(currentBackoff * 2, MAX_BACKOFF));
        } else {
          // On server errors (e.g., 5xx), back off aggressively to MAX to avoid storms
          backoffDelays.current.set(cacheKey, MAX_BACKOFF);
        }

        // Pause this token after max failures
        if (currentFailures >= MAX_FAILURES) {
          console.error(`[BondingDataContext] Max failures reached for ${tokenAddress}. Pausing.`);
          stopPollingToken(tokenAddress, chainId);
        }

        setTokenDataMap((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(cacheKey);
          newMap.set(cacheKey, {
            data: existing?.data || null,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to fetch bonding data',
            lastFetch: Date.now(),
          });
          return newMap;
        });
      } finally {
        inFlight.current.set(cacheKey, false);
      }
    },
    [getCacheKey, resolveApiBaseUrl],
  );

  const startPollingToken = useCallback(
    (tokenAddress: string, chainId: number = 8453) => {
      const cacheKey = getCacheKey(tokenAddress, chainId);

      if (pollingTokens.current.has(cacheKey)) {
        return; // Already polling
      }

      pollingTokens.current.add(cacheKey);

      // Helper to schedule next poll based on current backoff and activity
      const scheduleNext = () => {
        if (isPaused.current || !pollingTokens.current.has(cacheKey)) {
          return;
        }

        const pollInterval = isActiveTrading() ? ACTIVE_TRADING_INTERVAL : BACKGROUND_INTERVAL;
        const backoff = backoffDelays.current.get(cacheKey) || INITIAL_BACKOFF;
        const effectiveInterval = Math.max(pollInterval, backoff);

        // Clear any existing timeout before scheduling a new one
        const existing = pollTimeouts.current.get(cacheKey);
        if (existing) clearTimeout(existing);

        const timeout = setTimeout(async () => {
          // If paused or token polling stopped, do not proceed
          if (isPaused.current || !pollingTokens.current.has(cacheKey)) return;

          await fetchBondingData(tokenAddress, chainId);

          // If we've reached max failures, do not reschedule automatically
          const failures = failureCounters.current.get(cacheKey) || 0;
          if (failures >= MAX_FAILURES) return;

          scheduleNext();
        }, effectiveInterval);

        pollTimeouts.current.set(cacheKey, timeout);
      };

      // Kick off immediately, then schedule subsequent polls
      void fetchBondingData(tokenAddress, chainId).finally(() => {
        const failures = failureCounters.current.get(cacheKey) || 0;
        if (failures < MAX_FAILURES) {
          scheduleNext();
        }
      });
    },
    [getCacheKey, fetchBondingData, isActiveTrading],
  );

  const stopPollingToken = useCallback(
    (tokenAddress: string, chainId: number = 8453) => {
      const cacheKey = getCacheKey(tokenAddress, chainId);

      const interval = pollIntervals.current.get(cacheKey);
      if (interval) {
        clearInterval(interval);
        pollIntervals.current.delete(cacheKey);
      }

      const timeout = pollTimeouts.current.get(cacheKey);
      if (timeout) {
        clearTimeout(timeout);
        pollTimeouts.current.delete(cacheKey);
      }

      pollingTokens.current.delete(cacheKey);
    },
    [getCacheKey],
  );

  const getTokenData = useCallback(
    (tokenAddress: string, chainId: number = 8453): TokenBondingState => {
      const cacheKey = getCacheKey(tokenAddress, chainId);

      // Start polling if not already
      if (!pollingTokens.current.has(cacheKey)) {
        startPollingToken(tokenAddress, chainId);
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
    (tokenAddress: string, chainId: number = 8453) => {
      const cacheKey = getCacheKey(tokenAddress, chainId);
      console.log(`[BondingDataContext] Manual refresh for ${tokenAddress}`);

      // Reset failure counters
      failureCounters.current.set(cacheKey, 0);
      backoffDelays.current.set(cacheKey, INITIAL_BACKOFF);

      fetchBondingData(tokenAddress, chainId);
    },
    [getCacheKey, fetchBondingData],
  );

  // Track user interactions for active trading detection
  useEffect(() => {
    const handleInteraction = () => {
      lastInteraction.current = Date.now();
    };

    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  // Handle visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[BondingDataContext] Tab hidden, pausing polling');
        isPaused.current = true;
      } else {
        console.log('[BondingDataContext] Tab visible, resuming polling');
        isPaused.current = false;

        // Refresh all active tokens
        pollingTokens.current.forEach((cacheKey) => {
          const [tokenAddress, chainIdStr] = cacheKey.split('-');
          fetchBondingData(tokenAddress, parseInt(chainIdStr));
        });
      }
    };

    const handleFocus = () => {
      isPaused.current = false;
      pollingTokens.current.forEach((cacheKey) => {
        const [tokenAddress, chainIdStr] = cacheKey.split('-');
        fetchBondingData(tokenAddress, parseInt(chainIdStr));
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchBondingData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pollIntervals.current.forEach((interval) => clearInterval(interval));
      pollIntervals.current.clear();
      pollTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      pollTimeouts.current.clear();
      pollingTokens.current.clear();
    };
  }, []);

  const value: BondingDataContextValue = {
    getTokenData,
    refreshToken,
  };

  return <BondingDataContext.Provider value={value}>{children}</BondingDataContext.Provider>;
}

export function useBondingDataContext() {
  const context = useContext(BondingDataContext);
  if (context === undefined) {
    throw new Error('useBondingDataContext must be used within a BondingDataProvider');
  }
  return context;
}
