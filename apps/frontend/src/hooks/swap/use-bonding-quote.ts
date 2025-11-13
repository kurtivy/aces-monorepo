import { useState, useEffect, useCallback, useRef } from 'react';
import { BondingApi, type DirectQuoteResponse } from '@/lib/bonding-curve/bonding';
import { DEFAULT_SLIPPAGE_BPS } from '@/lib/swap/constants';
import { bondingQuoteCache } from '@/lib/swap/quote-cache';
import { bondingQuoteDeduplicator } from '@/lib/swap/request-deduplicator';
import { retryWithBackoff, RetryPresets } from '@/lib/swap/retry-with-backoff';

interface UseBondingQuoteProps {
  tokenAddress?: string;
  amount: string;
  inputAsset: 'ACES' | 'TOKEN';
  enabled?: boolean;
  slippageBps?: number;
}

/**
 * Hook for fetching bonding curve quotes via backend API
 * Handles ACES ↔ TOKEN direct swaps
 * Automatically cancels in-flight requests on unmount
 */
export function useBondingQuote({
  tokenAddress,
  amount,
  inputAsset,
  enabled = true,
  slippageBps: slippageBpsOverride,
}: UseBondingQuoteProps) {
  // Quote state
  const [quote, setQuote] = useState<DirectQuoteResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Slippage configuration
  const [slippageBps, setSlippageBps] = useState<number>(DEFAULT_SLIPPAGE_BPS);

  // Track previous amount to detect significant changes
  const previousAmountRef = useRef<string>('');

  // Sync external override from UI when provided
  useEffect(() => {
    if (
      typeof slippageBpsOverride === 'number' &&
      slippageBpsOverride >= 0 &&
      slippageBpsOverride <= 10000 &&
      slippageBpsOverride !== slippageBps
    ) {
      setSlippageBps(slippageBpsOverride);
    }
  }, [slippageBpsOverride, slippageBps]);

  // Track if request is cancelled
  const cancelledRef = useRef<boolean>(false);

  /**
   * Validate if we have all required data to fetch a quote
   */
  const canFetchQuote = useCallback((): boolean => {
    if (!enabled) {
      return false;
    }

    if (!tokenAddress) {
      return false;
    }

    const trimmedAmount = (amount || '').trim();
    if (!trimmedAmount) {
      return false;
    }

    const parsedAmount = Number.parseFloat(trimmedAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return false;
    }

    return true;
  }, [enabled, tokenAddress, amount]);

  /**
   * Fetch quote from Bonding API with caching, deduplication, and retry logic
   */
  const fetchQuote = useCallback(async (): Promise<void> => {
    if (!canFetchQuote()) {
      setQuote(null);
      setError(null);
      return;
    }

    try {
      cancelledRef.current = false;
      setLoading(true);
      setError(null);

      // Check cache first, but bypass if amount changed significantly
      const cacheParams = { inputAsset, slippageBps };
      const previousAmount = previousAmountRef.current;
      const cachedQuote = bondingQuoteCache.get(tokenAddress!, amount, cacheParams, previousAmount);

      if (cachedQuote) {
        console.log('[useBondingQuote] 💰 Cache hit!', { tokenAddress, amount, inputAsset });
        setQuote(cachedQuote);
        setLoading(false);
        // Update previous amount ref
        previousAmountRef.current = amount;
        return;
      }

      console.log('[useBondingQuote] 🔄 Fetching quote with optimization layers...', {
        tokenAddress,
        amount,
        inputAsset,
        slippageBps,
      });

      // Use deduplicator to prevent concurrent identical requests
      const result = await bondingQuoteDeduplicator.execute(
        { tokenAddress, amount, inputAsset, slippageBps },
        async () => {
          // Use retry logic with exponential backoff for rate limit handling
          const retryResult = await retryWithBackoff(
            async () => {
              const apiResult = await BondingApi.getDirectQuote(tokenAddress!, {
                inputAsset,
                amount,
                slippageBps,
              });

              // Throw error if API call failed (triggers retry)
              if (!apiResult.success || !apiResult.data) {
                const errorMsg =
                  typeof (apiResult as any).error === 'string'
                    ? (apiResult as any).error
                    : (apiResult as any).error?.message || 'Failed to fetch quote';
                throw new Error(errorMsg);
              }

              return apiResult.data;
            },
            RetryPresets.QUOTE_FAST, // 3 retries with max 5s total delay
          );

          if (!retryResult.success || !retryResult.data) {
            throw retryResult.error || new Error('Failed to fetch quote');
          }

          return retryResult.data;
        },
      );

      console.log('[useBondingQuote] 📥 Quote fetched successfully');

      // Check if request was cancelled
      if (cancelledRef.current) {
        console.log('[useBondingQuote] Request cancelled, ignoring result');
        return;
      }

      // Type assertion since we know the structure from API
      const typedResult = result as DirectQuoteResponse;

      // Store in cache for future requests
      bondingQuoteCache.set(tokenAddress!, amount, typedResult, cacheParams);

      setQuote(typedResult);
      setError(null);
      // Update previous amount ref
      previousAmountRef.current = amount;
      console.log('[useBondingQuote] ✅ Quote processed:', {
        inputAsset,
        expectedOutput: typedResult.expectedOutput,
        path: typedResult.path,
      });
    } catch (error) {
      if (cancelledRef.current) {
        console.log('[useBondingQuote] Request cancelled during error handling');
        return;
      }

      console.error('[useBondingQuote] ❌ Failed to fetch bonding quote:', error);
      setQuote(null);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch quote';
      setError(errorMessage);
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, [canFetchQuote, tokenAddress, amount, inputAsset, slippageBps]);

  /**
   * Refetch quote manually (useful after errors or user action)
   */
  const refetchQuote = useCallback(async (): Promise<void> => {
    await fetchQuote();
  }, [fetchQuote]);

  /**
   * Auto-fetch quote when dependencies change
   */
  useEffect(() => {
    // Reset and fetch new quote
    if (canFetchQuote()) {
      fetchQuote();
    } else {
      setQuote(null);
      setError(null);
    }

    // Cleanup: cancel request on unmount or when dependencies change
    return () => {
      cancelledRef.current = true;
    };
  }, [canFetchQuote, fetchQuote]);

  /**
   * Update slippage BPS
   */
  const updateSlippageBps = useCallback((newSlippageBps: number) => {
    if (newSlippageBps < 0 || newSlippageBps > 10000) {
      console.warn('[useBondingQuote] Invalid slippage BPS:', newSlippageBps);
      return;
    }
    setSlippageBps(newSlippageBps);
  }, []);

  return {
    // Quote data
    quote,

    // State
    loading,
    error,

    // Config
    slippageBps,
    setSlippageBps: updateSlippageBps,

    // Actions
    refetchQuote,
  };
}
