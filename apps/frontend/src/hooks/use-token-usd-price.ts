import { useState, useEffect, useMemo } from 'react';
import { usePriceConversion } from '@/hooks/use-price-conversion';

interface TokenUsdPriceResult {
  tokenUsdPrice: string | null; // USD value per 1 token
  acesUsdPrice: string | null; // Current ACES/USD rate
  totalUsdValue: string | null; // Total USD for given amount
  loading: boolean;
  error: string | null;
}

interface UseTokenUsdPriceProps {
  tokenPriceInAces: string; // Price of 1 token in ACES (from bonding curve) OR total ACES amount
  tokenAmount: string; // Amount of tokens user wants to buy
  enabled?: boolean; // Only fetch when needed
  isTotalAmount?: boolean; // If true, tokenPriceInAces is already the total ACES (for sell quotes)
}

/**
 * Hook to calculate USD value by chaining ACES/USD price with token/ACES price
 *
 * Formula: Token/USD = (Token/ACES) * (ACES/USD)
 *
 * @example
 * const { totalUsdValue, acesUsdPrice, loading } = useTokenUsdPrice({
 *   tokenPriceInAces: '100', // 100 ACES per token
 *   tokenAmount: '10', // Buying 10 tokens
 *   enabled: true
 * });
 */
export function useTokenUsdPrice({
  tokenPriceInAces,
  tokenAmount,
  enabled = true,
  isTotalAmount = false,
}: UseTokenUsdPriceProps): TokenUsdPriceResult {
  const [tokenUsdPrice, setTokenUsdPrice] = useState<string | null>(null);
  const [totalUsdValue, setTotalUsdValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get ACES/USD price from existing hook
  const {
    data: acesUsdData,
    loading: acesLoading,
    error: acesError,
  } = usePriceConversion(tokenPriceInAces);

  // Calculate USD values when dependencies change
  useEffect(() => {
    if (!enabled || !acesUsdData || !tokenPriceInAces || !tokenAmount) {
      setTokenUsdPrice(null);
      setTotalUsdValue(null);
      return;
    }

    try {
      // Parse values
      const acesPrice = parseFloat(acesUsdData.acesPrice); // ACES/USD rate
      const priceInAces = parseFloat(tokenPriceInAces); // Token price in ACES OR total ACES amount
      const amount = parseFloat(tokenAmount);

      if (!isFinite(acesPrice) || !isFinite(priceInAces) || !isFinite(amount)) {
        throw new Error('Invalid price data');
      }

      if (acesPrice <= 0 || priceInAces < 0 || amount < 0) {
        throw new Error('Price values must be positive');
      }

      let totalUsd: number;
      let usdPricePerToken: number;

      if (isTotalAmount) {
        // For sell quotes: priceInAces is the TOTAL ACES received
        // Just convert ACES to USD directly
        totalUsd = priceInAces * acesPrice;
        usdPricePerToken = amount > 0 ? totalUsd / amount : 0;
      } else {
        // For buy quotes: Calculate Token/USD = (Token/ACES) * (ACES/USD)
        usdPricePerToken = priceInAces * acesPrice;
        totalUsd = usdPricePerToken * amount;
      }

      setTokenUsdPrice(usdPricePerToken.toFixed(6));
      setTotalUsdValue(totalUsd.toFixed(2));
      setError(null);

      console.log('[useTokenUsdPrice] Calculated:', {
        mode: isTotalAmount ? 'total' : 'per-token',
        acesUsdPrice: acesPrice,
        tokenPriceInAces: priceInAces,
        tokenUsdPrice: usdPricePerToken,
        totalUsdValue: totalUsd,
      });
    } catch (err) {
      console.error('[useTokenUsdPrice] Calculation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate USD price');
      setTokenUsdPrice(null);
      setTotalUsdValue(null);
    }
  }, [acesUsdData, tokenPriceInAces, tokenAmount, enabled, isTotalAmount]);

  return useMemo(
    () => ({
      tokenUsdPrice,
      acesUsdPrice: acesUsdData?.acesPrice || null,
      totalUsdValue,
      loading: acesLoading,
      error: error || acesError,
    }),
    [tokenUsdPrice, acesUsdData?.acesPrice, totalUsdValue, acesLoading, error, acesError],
  );
}
