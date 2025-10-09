import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { usePriceConversion } from '@/hooks/use-price-conversion';
import { PRICE_QUOTE_DEBOUNCE_MS } from '@/lib/swap/constants';

interface UseBondingCurveQuoteProps {
  factoryContract: ethers.Contract | null;
  tokenAddress?: string;
  amount: string;
  tokenDecimals: number;
  isDexMode: boolean;
  activeTab: 'buy' | 'sell';
}

/**
 * Hook for fetching bonding curve price quotes with USD conversion
 * Gets real-time buy/sell prices from factory contract
 * Debounced to avoid excessive RPC calls
 * Only active when not in DEX mode
 */
export function useBondingCurveQuote({
  factoryContract,
  tokenAddress,
  amount,
  tokenDecimals,
  isDexMode,
  activeTab,
}: UseBondingCurveQuoteProps) {
  // Quote state
  const [buyQuote, setBuyQuote] = useState<string>('0');
  const [sellQuote, setSellQuote] = useState<string>('0');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce timer
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Convert amount to wei
  const amountWei = useRef<ethers.BigNumber | null>(null);

  useEffect(() => {
    if (!amount || amount.trim() === '') {
      amountWei.current = null;
      return;
    }

    try {
      const parsed = ethers.utils.parseUnits(amount.trim(), tokenDecimals);
      amountWei.current = parsed.gt(ethers.constants.Zero) ? parsed : null;
    } catch (error) {
      amountWei.current = null;
    }
  }, [amount, tokenDecimals]);

  /**
   * Get buy price quote from bonding curve
   */
  const getBuyPriceQuote = useCallback(async (): Promise<void> => {
    if (!factoryContract || !tokenAddress || !amountWei.current) {
      setBuyQuote('0');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const buyPrice = await factoryContract.getBuyPriceAfterFee(tokenAddress, amountWei.current);
      const formatted = ethers.utils.formatEther(buyPrice);
      setBuyQuote(formatted);

      console.log('[useBondingCurveQuote] Buy quote fetched:', formatted);
    } catch (error) {
      console.error('[useBondingCurveQuote] Failed to get buy price quote:', error);

      // For circuit breaker errors, keep the last known price
      if (isCircuitBreakerError(error)) {
        console.log('[useBondingCurveQuote] Circuit breaker active - keeping existing buy quote');
        return;
      }

      // For other errors, reset and set error state
      setBuyQuote('0');
      setError('Failed to fetch buy price');
    } finally {
      setLoading(false);
    }
  }, [factoryContract, tokenAddress]);

  /**
   * Get sell price quote from bonding curve
   */
  const getSellPriceQuote = useCallback(async (): Promise<void> => {
    if (!factoryContract || !tokenAddress || !amountWei.current) {
      setSellQuote('0');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const sellPrice = await factoryContract.getSellPriceAfterFee(tokenAddress, amountWei.current);
      const formatted = ethers.utils.formatEther(sellPrice);
      setSellQuote(formatted);

      console.log('[useBondingCurveQuote] Sell quote fetched:', formatted);
    } catch (error) {
      console.error('[useBondingCurveQuote] Failed to get sell price quote:', error);

      // For circuit breaker errors, keep the last known price
      if (isCircuitBreakerError(error)) {
        console.log('[useBondingCurveQuote] Circuit breaker active - keeping existing sell quote');
        return;
      }

      // For other errors, reset and set error state
      setSellQuote('0');
      setError('Failed to fetch sell price');
    } finally {
      setLoading(false);
    }
  }, [factoryContract, tokenAddress]);

  /**
   * Debounced price calculation
   */
  const calculatePriceQuote = useCallback(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't fetch in DEX mode
    if (isDexMode) {
      return;
    }

    // Debounce the quote fetch
    debounceTimerRef.current = setTimeout(() => {
      if (activeTab === 'buy') {
        getBuyPriceQuote();
      } else {
        getSellPriceQuote();
      }
    }, PRICE_QUOTE_DEBOUNCE_MS);
  }, [isDexMode, activeTab, getBuyPriceQuote, getSellPriceQuote]);

  /**
   * Trigger quote calculation when dependencies change
   */
  useEffect(() => {
    if (isDexMode) {
      // Reset quotes in DEX mode
      setBuyQuote('0');
      setSellQuote('0');
      setError(null);
      return;
    }

    calculatePriceQuote();

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [calculatePriceQuote, isDexMode]);

  // Get USD conversion for current quote
  const currentQuote = activeTab === 'buy' ? buyQuote : sellQuote;
  const { data: usdConversion, loading: usdLoading } = usePriceConversion(currentQuote);

  // Format USD display
  const usdDisplay =
    usdConversion?.usdValue && Number.isFinite(Number.parseFloat(usdConversion.usdValue))
      ? usdConversion.usdValue
      : null;

  return {
    // Quotes (ACES)
    buyQuote,
    sellQuote,

    // USD Values
    buyQuoteUSD: activeTab === 'buy' ? usdDisplay : null,
    sellQuoteUSD: activeTab === 'sell' ? usdDisplay : null,
    usdLoading,
    usdConversion,

    // State
    loading,
    error,

    // Future: Phase 4 - Slippage tolerance placeholder
    slippageTolerance: 0, // Not implemented yet
  };
}

/**
 * Helper to check if error is a circuit breaker error
 */
function isCircuitBreakerError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.includes('circuit breaker')
  );
}
