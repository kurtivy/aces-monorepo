'use client';

import { useState, useEffect } from 'react';

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
 * Fetches actual market cap (price × circulating supply) from the backend API
 * NOT to be confused with total ACES deposited in the bonding curve
 */
export function useTokenMarketCap(
  tokenAddress: string | undefined,
  currency: 'usd' | 'aces' = 'usd',
): MarketCapData {
  const [data, setData] = useState<MarketCapData>({
    marketCapAces: 0,
    marketCapUsd: 0,
    circulatingSupply: 0,
    currentPriceAces: 0,
    currentPriceUsd: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!tokenAddress) {
      setData((prev) => ({
        ...prev,
        loading: false,
        error: 'No token address provided',
      }));
      return;
    }

    const fetchMarketCap = async () => {
      try {
        setData((prev) => ({ ...prev, loading: true, error: null }));

        // Fetch latest candle to get current market cap
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL ||
          (typeof window !== 'undefined' ? window.location.origin : '');

        const response = await fetch(
          `${apiUrl}/api/v1/chart/${tokenAddress}/market-cap?timeframe=5m&limit=1&currency=${currency}`,
        );

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success || !result.data?.candles || result.data.candles.length === 0) {
          throw new Error('No market cap data available');
        }

        // Get the most recent candle
        const latestCandle = result.data.candles[result.data.candles.length - 1];

        const marketCap = parseFloat(latestCandle.close || '0');
        const supply = parseFloat(latestCandle.circulatingSupply || '0');

        // Calculate price from market cap and supply
        const priceInCurrency = supply > 0 ? marketCap / supply : 0;

        // Get ACES/USD rate for conversion
        const acesUsdPrice = parseFloat(result.data.acesUsdPrice || '1');

        let marketCapAces: number;
        let marketCapUsd: number;
        let currentPriceAces: number;
        let currentPriceUsd: number;

        if (currency === 'usd') {
          marketCapUsd = marketCap;
          marketCapAces = acesUsdPrice > 0 ? marketCap / acesUsdPrice : 0;
          currentPriceUsd = priceInCurrency;
          currentPriceAces = acesUsdPrice > 0 ? priceInCurrency / acesUsdPrice : 0;
        } else {
          marketCapAces = marketCap;
          marketCapUsd = marketCap * acesUsdPrice;
          currentPriceAces = priceInCurrency;
          currentPriceUsd = priceInCurrency * acesUsdPrice;
        }

        setData({
          marketCapAces,
          marketCapUsd,
          circulatingSupply: supply,
          currentPriceAces,
          currentPriceUsd,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error('[useTokenMarketCap] Error fetching market cap:', error);
        setData((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch market cap',
        }));
      }
    };

    fetchMarketCap();

    // Refresh every 30 seconds
    const interval = setInterval(fetchMarketCap, 30000);

    return () => clearInterval(interval);
  }, [tokenAddress, currency]);

  return data;
}
