'use client';

import { useMemo } from 'react';
import { useMarketCapContext } from '@/contexts/market-cap-context';

interface MarketCapData {
  marketCapAces: number;
  marketCapUsd: number;
  circulatingSupply: number;
  currentPriceAces: number;
  currentPriceUsd: number;
  loading: boolean;
  error: string | null;
}

/**
 * Refactored to use shared MarketCapContext
 * Polls every 30 seconds via shared context instead of per-component
 * Maintains backward compatibility with old interface
 */
export function useTokenMarketCap(
  tokenAddress: string | undefined,
  currency: 'usd' | 'aces' = 'usd',
): MarketCapData {
  const { getTokenMarketCap } = useMarketCapContext();

  return useMemo(() => {
    if (!tokenAddress) {
      return {
        marketCapAces: 0,
        marketCapUsd: 0,
        circulatingSupply: 0,
        currentPriceAces: 0,
        currentPriceUsd: 0,
        loading: false,
        error: 'No token address provided',
      };
    }

    const tokenState = getTokenMarketCap(tokenAddress, currency);

    if (tokenState.loading || !tokenState.data) {
      return {
        marketCapAces: 0,
        marketCapUsd: 0,
        circulatingSupply: 0,
        currentPriceAces: 0,
        currentPriceUsd: 0,
        loading: tokenState.loading,
        error: tokenState.error,
      };
    }

    return {
      marketCapAces: tokenState.data.marketCapAces,
      marketCapUsd: tokenState.data.marketCapUsd,
      circulatingSupply: tokenState.data.circulatingSupply,
      currentPriceAces: tokenState.data.currentPriceAces,
      currentPriceUsd: tokenState.data.currentPriceUsd,
      loading: false,
      error: null,
    };
  }, [tokenAddress, currency, getTokenMarketCap]);
}
