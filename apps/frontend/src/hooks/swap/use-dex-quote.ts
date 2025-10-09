import { useState, useEffect, useCallback, useRef } from 'react';
import { DexApi, type DexQuoteResponse } from '@/lib/api/dex';
import { DEFAULT_SLIPPAGE_BPS } from '@/lib/swap/constants';
import type { PaymentAsset } from '@/lib/swap/types';

interface UseDexQuoteProps {
  tokenAddress?: string;
  amount: string;
  paymentAsset: PaymentAsset;
  activeTab: 'buy' | 'sell';
  isDexMode: boolean;
  enabled?: boolean;
}

/**
 * Hook for fetching Aerodrome DEX quotes via BitQuery/QuickNode API
 * Handles buy vs sell direction and multiple input assets
 * Automatically cancels in-flight requests on unmount
 */
export function useDexQuote({
  tokenAddress,
  amount,
  paymentAsset,
  activeTab,
  isDexMode,
  enabled = true,
}: UseDexQuoteProps) {
  // Quote state
  const [quote, setQuote] = useState<DexQuoteResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Slippage configuration
  const [slippageBps, setSlippageBps] = useState<number>(DEFAULT_SLIPPAGE_BPS);

  // Track if request is cancelled
  const cancelledRef = useRef<boolean>(false);

  /**
   * Validate if we have all required data to fetch a quote
   */
  const canFetchQuote = useCallback((): boolean => {
    if (!isDexMode || !enabled) {
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
  }, [isDexMode, enabled, tokenAddress, amount]);

  /**
   * Fetch quote from DEX API
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

      console.log('[useDexQuote] Fetching quote...', {
        tokenAddress,
        amount,
        paymentAsset,
        activeTab,
        slippageBps,
      });

      // Determine input asset based on tab
      // On Sell tab: selling the token for ACES
      // On Buy tab: buying the token with ACES/USDC/USDT/wETH
      const inputAsset = activeTab === 'sell' ? 'TOKEN' : paymentAsset;

      const result = await DexApi.getQuote(tokenAddress!, {
        inputAsset,
        amount,
        slippageBps,
      });

      // Check if request was cancelled
      if (cancelledRef.current) {
        console.log('[useDexQuote] Request cancelled, ignoring result');
        return;
      }

      if (result.success && result.data) {
        setQuote(result.data);
        setError(null);
        console.log('[useDexQuote] ✅ Quote fetched successfully:', result.data);
      } else {
        setQuote(null);
        const errorMessage =
          result.error instanceof Error ? result.error.message : 'Failed to fetch quote';
        setError(errorMessage);
        console.error('[useDexQuote] ❌ Quote fetch failed:', errorMessage);
      }
    } catch (error) {
      if (cancelledRef.current) {
        console.log('[useDexQuote] Request cancelled during error handling');
        return;
      }

      console.error('[useDexQuote] ❌ Failed to fetch DEX quote:', error);
      setQuote(null);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch quote';
      setError(errorMessage);
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, [canFetchQuote, tokenAddress, amount, paymentAsset, activeTab, slippageBps]);

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
    // Reset quote state if not in DEX mode
    if (!isDexMode) {
      setQuote(null);
      setError(null);
      setLoading(false);
      return;
    }

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
  }, [isDexMode, canFetchQuote, fetchQuote]);

  /**
   * Update slippage BPS
   */
  const updateSlippageBps = useCallback((newSlippageBps: number) => {
    if (newSlippageBps < 0 || newSlippageBps > 10000) {
      console.warn('[useDexQuote] Invalid slippage BPS:', newSlippageBps);
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
