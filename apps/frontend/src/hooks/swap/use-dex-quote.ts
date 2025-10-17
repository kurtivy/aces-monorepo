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
  slippageBps?: number; // override from UI
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
  slippageBps: slippageBpsOverride,
}: UseDexQuoteProps) {
  // Quote state
  const [quote, setQuote] = useState<DexQuoteResponse | null>(null);
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
  const requestIdRef = useRef<number>(0);

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
      const myId = ++requestIdRef.current;
      setLoading(true);
      setError(null);

      console.log('[useDexQuote] 🔄 Fetching quote...', {
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

      console.log('[useDexQuote] 📤 Calling DexApi.getQuote with:', {
        tokenAddress,
        inputAsset,
        amount,
        slippageBps,
      });

      const result = await DexApi.getQuote(tokenAddress!, {
        inputAsset,
        amount,
        slippageBps,
      });

      console.log('[useDexQuote] 📥 API Response:', result);

      // Check if request was cancelled
      if (cancelledRef.current || myId !== requestIdRef.current) {
        console.log('[useDexQuote] Request cancelled, ignoring result');
        return;
      }

      if (result.success && result.data) {
        setQuote(result.data);
        setError(null);
        console.log('[useDexQuote] ✅ Quote fetched successfully:', {
          inputAsset,
          expectedOutput: result.data.expectedOutput,
          path: result.data.path,
          routes: result.data.routes,
          fullData: result.data,
        });
      } else {
        setQuote(null);
        const errorMessage =
          typeof (result as any).error === 'string'
            ? (result as any).error
            : (result as any).error?.message || 'Failed to fetch quote';
        setError(errorMessage);
        console.error('[useDexQuote] ❌ Quote fetch failed:', {
          errorMessage,
          fullError: result,
        });
      }
    } catch (error) {
      if (cancelledRef.current) {
        console.log('[useDexQuote] Request cancelled during error handling');
        return;
      }

      // Ignore errors from stale responses
      if (requestIdRef.current) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch quote';
        console.error('[useDexQuote] ❌ Failed to fetch DEX quote:', errorMessage);
        // Only set state if this is the latest request
        if (requestIdRef.current) {
          setQuote(null);
          setError(errorMessage);
        }
      }
    } finally {
      if (!cancelledRef.current) {
        // Only clear loading for the latest request
        setLoading((prev) => {
          return requestIdRef.current ? false : prev;
        });
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
