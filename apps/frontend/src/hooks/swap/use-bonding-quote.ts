import { useState, useEffect, useCallback, useRef } from 'react';
import { BondingApi, type DirectQuoteResponse } from '@/lib/bonding-curve/bonding';
import { DEFAULT_SLIPPAGE_BPS } from '@/lib/swap/constants';

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
   * Fetch quote from Bonding API
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

      console.log('[useBondingQuote] 🔄 Fetching quote...', {
        tokenAddress,
        amount,
        inputAsset,
        slippageBps,
      });

      const result = await BondingApi.getDirectQuote(tokenAddress!, {
        inputAsset,
        amount,
        slippageBps,
      });

      console.log('[useBondingQuote] 📥 API Response:', result);

      // Check if request was cancelled
      if (cancelledRef.current) {
        console.log('[useBondingQuote] Request cancelled, ignoring result');
        return;
      }

      if (result.success && result.data) {
        setQuote(result.data);
        setError(null);
        console.log('[useBondingQuote] ✅ Quote fetched successfully:', {
          inputAsset,
          expectedOutput: result.data.expectedOutput,
          path: result.data.path,
          fullData: result.data,
        });
      } else {
        setQuote(null);
        const errorMessage =
          typeof (result as any).error === 'string'
            ? (result as any).error
            : (result as any).error?.message || 'Failed to fetch quote';
        setError(errorMessage);
        console.error('[useBondingQuote] ❌ Quote fetch failed:', {
          errorMessage,
          fullError: result,
        });
      }
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

