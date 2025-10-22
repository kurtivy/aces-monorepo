'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { fetchTokenHealth } from '@/lib/api/token-health';

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
  bondingTargetSource?:
    | 'contract'
    | 'max_total_supply'
    | 'subgraph'
    | 'listing_parameters'
    | 'default';
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
  subscribe: (cacheKey: string, callback: () => void) => () => void;
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

  // Use ref for data storage to avoid triggering re-renders
  const tokenDataMapRef = useRef<Map<string, TokenBondingState>>(new Map());

  // Track which tokens are actively being polled
  const pollingTokens = useRef<Set<string>>(new Set());
  const pollTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const failureCounters = useRef<Map<string, number>>(new Map());
  const backoffDelays = useRef<Map<string, number>>(new Map());
  const lastInteraction = useRef<number>(Date.now());
  const isPaused = useRef(false);
  const lastAttemptAt = useRef<Map<string, number>>(new Map());
  const inFlight = useRef<Map<string, boolean>>(new Map());
  // Track subscribers for each token
  const subscribers = useRef<Map<string, Set<() => void>>>(new Map());

  // const resolveApiBaseUrl = useCallback(() => {
  //   if (process.env.NEXT_PUBLIC_API_URL) {
  //     return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  //   }
  //   if (typeof window !== 'undefined' && window.location?.origin) {
  //     return window.location.origin;
  //   }
  //   return '';
  // }, []);

  const getCacheKey = useCallback((tokenAddress: string, chainId: number = 8453) => {
    return `${tokenAddress.toLowerCase()}-${chainId}`;
  }, []);

  const isActiveTrading = useCallback(() => {
    const isOnTokenPage = pathname?.includes('/rwa/');
    const recentInteraction = Date.now() - lastInteraction.current < INTERACTION_TIMEOUT;
    return isOnTokenPage && recentInteraction;
  }, [pathname]);

  const notifySubscribers = useCallback((cacheKey: string) => {
    const subs = subscribers.current.get(cacheKey);
    if (subs) {
      subs.forEach((callback) => callback());
    }
  }, []);

  const stopPollingToken = useCallback(
    (tokenAddress: string, chainId: number = 8453) => {
      const cacheKey = getCacheKey(tokenAddress, chainId);
      const timeout = pollTimeouts.current.get(cacheKey);
      if (timeout) {
        clearTimeout(timeout);
        pollTimeouts.current.delete(cacheKey);
      }
      pollingTokens.current.delete(cacheKey);
    },
    [getCacheKey],
  );

  const fetchBondingData = useCallback(
    async (tokenAddress: string, chainId: number = 8453) => {
      const cacheKey = getCacheKey(tokenAddress, chainId);

      if (isPaused.current || inFlight.current.get(cacheKey)) {
        return;
      }

      lastAttemptAt.current.set(cacheKey, Date.now());
      inFlight.current.set(cacheKey, true);

      try {
        // Use unified health endpoint (automatically deduped)
        const healthData = await fetchTokenHealth(tokenAddress, chainId, 'usd');

        if (!healthData.bondingData) {
          throw new Error('No bonding data in response');
        }

        // Update ref directly
        tokenDataMapRef.current.set(cacheKey, {
          data: healthData.bondingData,
          loading: false,
          error: null,
          lastFetch: Date.now(),
        });

        // Notify only subscribers for this specific token
        notifySubscribers(cacheKey);

        // Reset failure counters on success
        failureCounters.current.set(cacheKey, 0);
        backoffDelays.current.set(cacheKey, INITIAL_BACKOFF);
      } catch (err) {
        console.error(`[BondingDataContext] Fetch error for ${tokenAddress}:`, err);

        const currentFailures = (failureCounters.current.get(cacheKey) || 0) + 1;
        failureCounters.current.set(cacheKey, currentFailures);

        if (err instanceof Error && err.message === 'RATE_LIMITED') {
          const currentBackoff = backoffDelays.current.get(cacheKey) || INITIAL_BACKOFF;
          backoffDelays.current.set(cacheKey, Math.min(currentBackoff * 2, MAX_BACKOFF));
        } else {
          backoffDelays.current.set(cacheKey, MAX_BACKOFF);
        }

        if (currentFailures >= MAX_FAILURES) {
          console.error(`[BondingDataContext] Max failures reached for ${tokenAddress}. Pausing.`);
          stopPollingToken(tokenAddress, chainId);
        }

        const existing = tokenDataMapRef.current.get(cacheKey);
        tokenDataMapRef.current.set(cacheKey, {
          data: existing?.data || null,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch bonding data',
          lastFetch: Date.now(),
        });

        notifySubscribers(cacheKey);
      } finally {
        inFlight.current.set(cacheKey, false);
      }
    },
    [getCacheKey, stopPollingToken, notifySubscribers],
  );

  const startPollingToken = useCallback(
    (tokenAddress: string, chainId: number = 8453) => {
      const cacheKey = getCacheKey(tokenAddress, chainId);

      if (pollingTokens.current.has(cacheKey)) {
        return;
      }

      pollingTokens.current.add(cacheKey);

      const scheduleNext = () => {
        if (isPaused.current || !pollingTokens.current.has(cacheKey)) {
          return;
        }

        const pollInterval = isActiveTrading() ? ACTIVE_TRADING_INTERVAL : BACKGROUND_INTERVAL;
        const backoff = backoffDelays.current.get(cacheKey) || INITIAL_BACKOFF;
        const effectiveInterval = Math.max(pollInterval, backoff);

        const existing = pollTimeouts.current.get(cacheKey);
        if (existing) clearTimeout(existing);

        const timeout = setTimeout(async () => {
          if (isPaused.current || !pollingTokens.current.has(cacheKey)) return;

          await fetchBondingData(tokenAddress, chainId);

          const failures = failureCounters.current.get(cacheKey) || 0;
          if (failures >= MAX_FAILURES) return;

          scheduleNext();
        }, effectiveInterval);

        pollTimeouts.current.set(cacheKey, timeout);
      };

      void fetchBondingData(tokenAddress, chainId).finally(() => {
        const failures = failureCounters.current.get(cacheKey) || 0;
        if (failures < MAX_FAILURES) {
          scheduleNext();
        }
      });
    },
    [getCacheKey, fetchBondingData, isActiveTrading],
  );

  // Stable getTokenData that returns current state and subscribes component
  const getTokenData = useCallback(
    (tokenAddress: string, chainId: number = 8453): TokenBondingState => {
      const cacheKey = getCacheKey(tokenAddress, chainId);

      if (!pollingTokens.current.has(cacheKey)) {
        startPollingToken(tokenAddress, chainId);
      }

      return (
        tokenDataMapRef.current.get(cacheKey) || {
          data: null,
          loading: true,
          error: null,
          lastFetch: 0,
        }
      );
    },
    [getCacheKey, startPollingToken],
  );

  const refreshToken = useCallback(
    (tokenAddress: string, chainId: number = 8453) => {
      const cacheKey = getCacheKey(tokenAddress, chainId);
      console.log(`[BondingDataContext] Manual refresh for ${tokenAddress}`);

      failureCounters.current.set(cacheKey, 0);
      backoffDelays.current.set(cacheKey, INITIAL_BACKOFF);

      fetchBondingData(tokenAddress, chainId);
    },
    [getCacheKey, fetchBondingData],
  );

  // Subscribe/unsubscribe mechanism
  const subscribe = useCallback((cacheKey: string, callback: () => void) => {
    if (!subscribers.current.has(cacheKey)) {
      subscribers.current.set(cacheKey, new Set());
    }
    subscribers.current.get(cacheKey)!.add(callback);

    return () => {
      const subs = subscribers.current.get(cacheKey);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          subscribers.current.delete(cacheKey);
        }
      }
    };
  }, []);

  // Track user interactions
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

        pollingTokens.current.forEach((cacheKey) => {
          const [tokenAddress, chainIdStr] = cacheKey.split('-');
          const chainId = parseInt(chainIdStr);

          if (!inFlight.current.get(cacheKey)) {
            const lastAttempt = lastAttemptAt.current.get(cacheKey) || 0;
            const timeSinceLastAttempt = Date.now() - lastAttempt;
            const minInterval = backoffDelays.current.get(cacheKey) || INITIAL_BACKOFF;

            if (timeSinceLastAttempt >= minInterval) {
              fetchBondingData(tokenAddress, chainId);
            }
          }
        });
      }
    };

    const handleFocus = () => {
      isPaused.current = false;
      pollingTokens.current.forEach((cacheKey) => {
        const [tokenAddress, chainIdStr] = cacheKey.split('-');
        const chainId = parseInt(chainIdStr);

        if (!inFlight.current.get(cacheKey)) {
          const lastAttempt = lastAttemptAt.current.get(cacheKey) || 0;
          const timeSinceLastAttempt = Date.now() - lastAttempt;
          const minInterval = backoffDelays.current.get(cacheKey) || INITIAL_BACKOFF;

          if (timeSinceLastAttempt >= minInterval) {
            fetchBondingData(tokenAddress, chainId);
          }
        }
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
      pollTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      pollTimeouts.current.clear();
      pollingTokens.current.clear();
    };
  }, []);

  // Create stable context value - include subscribe
  const value: BondingDataContextValue = {
    getTokenData,
    refreshToken,
    subscribe,
  };

  return <BondingDataContext.Provider value={value}>{children}</BondingDataContext.Provider>;
}

// Custom hook that properly subscribes to updates
export function useBondingData(tokenAddress?: string, chainId: number = 8453) {
  const context = useContext(BondingDataContext);
  if (context === undefined) {
    throw new Error('useBondingData must be used within a BondingDataProvider');
  }

  const [, forceUpdate] = useState(0);
  const { getTokenData, subscribe } = context;

  useEffect(() => {
    if (!tokenAddress) return;

    const cacheKey = `${tokenAddress.toLowerCase()}-${chainId}`;

    // Subscribe to updates for this specific token
    const unsubscribe = subscribe(cacheKey, () => {
      forceUpdate((n) => n + 1);
    });

    return unsubscribe;
  }, [tokenAddress, chainId, subscribe]);

  if (!tokenAddress) {
    return {
      data: null,
      loading: false,
      error: null,
      lastFetch: 0,
    };
  }

  return getTokenData(tokenAddress, chainId);
}

export function useBondingDataContext() {
  const context = useContext(BondingDataContext);
  if (context === undefined) {
    throw new Error('useBondingDataContext must be used within a BondingDataProvider');
  }
  return context;
}
