'use client';

import { useState, useEffect, useCallback } from 'react';

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

// Multiple price sources for maximum reliability
const PRICE_SOURCES = [
  {
    name: 'CoinGecko',
    url: 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
    parser: (data: { ethereum?: { usd?: number } }) => data.ethereum?.usd ?? 0,
  },
  {
    name: 'Coinbase',
    url: 'https://api.coinbase.com/v2/exchange-rates?currency=ETH',
    parser: (data: { data?: { rates?: { USD?: string } } }) =>
      parseFloat(data.data?.rates?.USD || '0'),
  },
  {
    name: 'Binance',
    url: 'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT',
    parser: (data: { price?: string }) => parseFloat(data.price || '0'),
  },
  {
    name: 'CryptoCompare',
    url: 'https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD',
    parser: (data: { USD?: string }) => parseFloat(data.USD || '0'),
  },
];

// Backup Uniswap mainnet subgraph (most reliable)
const UNISWAP_MAINNET = {
  url: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
  poolId: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', // ETH/USDC 0.05%
  query: `
    query GetETHPrice($poolId: String!) {
      pool(id: $poolId) {
        id
        token0Price
        token1Price
        liquidity
        volumeUSD
        feeTier
        token0 { symbol }
        token1 { symbol }
      }
    }
  `,
  parser: (data: {
    data?: {
      pool?: {
        id: string;
        token0Price: string;
        token1Price: string;
        liquidity: string;
        volumeUSD: string;
        feeTier: string;
        token0: { symbol: string };
        token1: { symbol: string };
      };
    };
  }) => {
    const pool = data.data?.pool;
    if (!pool) return { price: 0, poolInfo: null };

    // ETH is usually token1, USDC is token0
    const price =
      pool.token1.symbol === 'WETH' ? parseFloat(pool.token0Price) : parseFloat(pool.token1Price);

    return {
      price,
      poolInfo: {
        address: pool.id,
        liquidity: parseFloat(pool.liquidity).toLocaleString(),
        volume24h: parseFloat(pool.volumeUSD).toLocaleString(),
        feeTier: `${parseFloat(pool.feeTier) / 10000}%`,
      },
    };
  },
};

export function useReliableETHPrice(refreshInterval: number = 30000) {
  const [priceData, setPriceData] = useState<ETHPriceData>({
    price: 3000, // Fallback price
    lastUpdated: Date.now(),
    source: 'fallback',
    isLoading: true,
    error: null,
  });

  const fetchPrice = useCallback(async () => {
    setPriceData((prev) => ({ ...prev, isLoading: true, error: null }));

    // Try API sources first (faster and more reliable)
    for (const source of PRICE_SOURCES) {
      try {
        // console.log(`💰 Trying ${source.name}...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(source.url, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) continue;

        const data = await response.json();
        const price = source.parser(data);

        if (price > 0 && price < 10000) {
          // Sanity check
          setPriceData({
            price,
            lastUpdated: Date.now(),
            source: source.name,
            isLoading: false,
            error: null,
          });

          // console.log(`✅ ETH price from ${source.name}: $${price.toLocaleString()}`);
          return;
        }
      } catch (error) {
        console.warn(`❌ ${source.name} failed:`, error);
        continue;
      }
    }

    // Try Uniswap as last resort
    try {
      // console.log(`🦄 Trying Uniswap mainnet...`);

      const response = await fetch(UNISWAP_MAINNET.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: UNISWAP_MAINNET.query,
          variables: { poolId: UNISWAP_MAINNET.poolId },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const result = UNISWAP_MAINNET.parser(data);

        if (result.price > 0) {
          setPriceData({
            price: result.price,
            lastUpdated: Date.now(),
            source: 'Uniswap V3',
            isLoading: false,
            error: null,
            poolInfo: result.poolInfo || undefined,
          });

          // console.log(`✅ ETH price from Uniswap: $${result.price.toLocaleString()}`);
          return;
        }
      }
    } catch (error) {
      console.warn(`❌ Uniswap failed:`, error);
    }

    // All sources failed
    setPriceData((prev) => ({
      ...prev,
      isLoading: false,
      error: 'All price sources failed. Using fallback price.',
      source: 'fallback',
    }));

    console.warn('❌ All price sources failed, using fallback price');
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchPrice();
  }, [fetchPrice]);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchPrice, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchPrice, refreshInterval]);

  const refresh = useCallback(() => {
    fetchPrice();
  }, [fetchPrice]);

  return {
    ...priceData,
    refresh,
    isStale: Date.now() - priceData.lastUpdated > refreshInterval * 2,
    // For compatibility with old hook
    current: priceData.price,
    network: 'multiple',
  };
}
