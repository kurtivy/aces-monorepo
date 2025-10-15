'use client';

import { useMemo } from 'react';
import { usePriceContext } from '@/contexts/price-context';

interface ETHPriceData {
  price: number;
  lastUpdated: number;
  source: string;
  isLoading: boolean;
  error: string | null;
  poolInfo?: {
    address: string;
    liquidity: string;
    volume24h: string;
    feeTier: string;
  };
}

/**
 * Refactored to use shared PriceContext
 * Maintains backward compatibility with old interface
 */
export function useReliableETHPrice(_refreshInterval: number = 30000) {
  const { ethPrice, lastUpdated, loading, error, isStale, refresh } = usePriceContext();

  return useMemo(
    () => ({
      price: ethPrice,
      lastUpdated,
      source: 'Backend API (Shared)',
      isLoading: loading,
      error,
      refresh,
      isStale,
      // For compatibility with old hook
      current: ethPrice,
      network: 'multiple',
    }),
    [ethPrice, lastUpdated, loading, error, refresh, isStale],
  );
}
