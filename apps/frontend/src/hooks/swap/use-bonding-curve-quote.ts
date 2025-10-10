import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { useTokenUsdPrice } from '@/hooks/use-token-usd-price';
import { useQuoteAutoRefresh } from '@/hooks/use-quote-auto-refresh';
import { PRICE_QUOTE_DEBOUNCE_MS, DEFAULT_SLIPPAGE_BPS } from '@/lib/swap/constants';

interface UseBondingCurveQuoteProps {
  factoryContract: ethers.Contract | null;
  tokenAddress?: string;
  amount: string;
  tokenDecimals: number;
  isDexMode: boolean;
  activeTab: 'buy' | 'sell';
  slippageBps?: number; // NEW: Slippage in basis points
  autoRefreshEnabled?: boolean; // NEW: Enable 10s auto-refresh
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
  slippageBps = DEFAULT_SLIPPAGE_BPS,
  autoRefreshEnabled = true,
}: UseBondingCurveQuoteProps) {
  // Quote state
  const [buyQuote, setBuyQuote] = useState<string>('0');
  const [sellQuote, setSellQuote] = useState<string>('0');
  const [buyQuoteWithSlippage, setBuyQuoteWithSlippage] = useState<string>('0'); // NEW
  const [sellQuoteWithSlippage, setSellQuoteWithSlippage] = useState<string>('0'); // NEW
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now()); // NEW

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
   * Calculate quote with slippage buffer
   */
  const calculateWithSlippage = useCallback(
    (quoteWei: ethers.BigNumber, slippage: number): string => {
      // Formula: quote * (1 + slippage/10000)
      // Example: 100 ACES with 1% (100 bps) = 100 * 1.01 = 101 ACES
      const multiplier = ethers.BigNumber.from(10000 + slippage);
      const withSlippage = quoteWei.mul(multiplier).div(10000);
      return ethers.utils.formatEther(withSlippage);
    },
    [],
  );

  /**
   * Get buy price quote from bonding curve
   */
  const getBuyPriceQuote = useCallback(async (): Promise<void> => {
    if (!factoryContract || !tokenAddress || !amountWei.current) {
      setBuyQuote('0');
      setBuyQuoteWithSlippage('0');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const buyPriceWei: ethers.BigNumber = await factoryContract.getBuyPriceAfterFee(
        tokenAddress,
        amountWei.current,
      );

      const formatted = ethers.utils.formatEther(buyPriceWei);
      const withSlippage = calculateWithSlippage(buyPriceWei, slippageBps);

      setBuyQuote(formatted);
      setBuyQuoteWithSlippage(withSlippage);
      setLastRefreshTime(Date.now());

      console.log('[useBondingCurveQuote] Buy quote fetched:', {
        base: formatted,
        withSlippage,
        slippageBps,
      });
    } catch (error) {
      console.error('[useBondingCurveQuote] Failed to get buy price quote:', error);

      // For circuit breaker errors, keep the last known price
      if (isCircuitBreakerError(error)) {
        console.log('[useBondingCurveQuote] Circuit breaker active - keeping existing buy quote');
        return;
      }

      // For other errors, reset and set error state
      setBuyQuote('0');
      setBuyQuoteWithSlippage('0');
      setError('Failed to fetch buy price');
    } finally {
      setLoading(false);
    }
  }, [factoryContract, tokenAddress, slippageBps, calculateWithSlippage]);

  /**
   * Get sell price quote from bonding curve
   */
  const getSellPriceQuote = useCallback(async (): Promise<void> => {
    if (!factoryContract || !tokenAddress || !amountWei.current) {
      setSellQuote('0');
      setSellQuoteWithSlippage('0');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const sellPriceWei: ethers.BigNumber = await factoryContract.getSellPriceAfterFee(
        tokenAddress,
        amountWei.current,
      );

      const formatted = ethers.utils.formatEther(sellPriceWei);
      const withSlippage = calculateWithSlippage(sellPriceWei, slippageBps);

      setSellQuote(formatted);
      setSellQuoteWithSlippage(withSlippage);
      setLastRefreshTime(Date.now());

      console.log('[useBondingCurveQuote] Sell quote fetched:', {
        base: formatted,
        withSlippage,
        slippageBps,
      });
    } catch (error) {
      console.error('[useBondingCurveQuote] Failed to get sell price quote:', error);

      // For circuit breaker errors, keep the last known price
      if (isCircuitBreakerError(error)) {
        console.log('[useBondingCurveQuote] Circuit breaker active - keeping existing sell quote');
        return;
      }

      // For other errors, reset and set error state
      setSellQuote('0');
      setSellQuoteWithSlippage('0');
      setError('Failed to fetch sell price');
    } finally {
      setLoading(false);
    }
  }, [factoryContract, tokenAddress, slippageBps, calculateWithSlippage]);

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
   * Manual refresh function for auto-refresh hook
   */
  const refreshQuote = useCallback(() => {
    if (activeTab === 'buy') {
      getBuyPriceQuote();
    } else {
      getSellPriceQuote();
    }
  }, [activeTab, getBuyPriceQuote, getSellPriceQuote]);

  /**
   * Trigger quote calculation when dependencies change
   */
  useEffect(() => {
    if (isDexMode) {
      // Reset quotes in DEX mode
      setBuyQuote('0');
      setSellQuote('0');
      setBuyQuoteWithSlippage('0');
      setSellQuoteWithSlippage('0');
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

  /**
   * Auto-refresh every 10 seconds
   */
  useQuoteAutoRefresh({
    enabled: autoRefreshEnabled && !isDexMode && !!amountWei.current,
    onRefresh: refreshQuote,
  });

  // Get USD conversion for current quote (base quote, not with slippage)
  const currentQuote = activeTab === 'buy' ? buyQuote : sellQuote;
  const {
    totalUsdValue,
    acesUsdPrice,
    loading: usdLoading,
  } = useTokenUsdPrice({
    tokenPriceInAces: currentQuote,
    tokenAmount: amount,
    enabled: !isDexMode && parseFloat(currentQuote) > 0,
  });

  return {
    // Base quotes (ACES) - what the price actually is
    buyQuote,
    sellQuote,

    // Quotes with slippage buffer - what user will approve/spend
    buyQuoteWithSlippage,
    sellQuoteWithSlippage,

    // USD Values
    totalUsdValue,
    acesUsdPrice,
    usdLoading,

    // State
    loading,
    error,
    lastRefreshTime,

    // Actions
    refreshQuote,

    // Slippage
    slippageBps,
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
