'use client';

import { useState, useEffect, useCallback } from 'react';

interface UniswapPriceData {
  price: number;
  lastUpdated: number;
  source: string;
  isLoading: boolean;
  error: string | null;
  poolInfo: {
    address: string;
    liquidity: string;
    volume24h: string;
    feeTier: string;
  };
}

// Uniswap V3 Subgraph endpoints (Updated with working URLs)
const SUBGRAPH_ENDPOINTS = {
  mainnet: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
  base: 'https://api.studio.thegraph.com/query/48211/uniswap-v3-base/version/latest',
  arbitrum: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-arbitrum',
  polygon: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-polygon',
};

// Most liquid ETH/USDC pools by network
const ETH_USDC_POOLS = {
  mainnet: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', // 0.05% fee tier - most liquid
  base: '0x4c36388be6f416a29c8d8eee81c771ce6be14b18', // Base ETH/USDC 0.05%
  arbitrum: '0xc31e54c7a869b9fcbecc14363cf510d1c41fa443', // Arbitrum ETH/USDC 0.05%
  polygon: '0x45dda9cb7c25131df268515131f647d726f50608', // Polygon ETH/USDC 0.05%
};

// GraphQL query to get ETH price from ETH/USDC pool
const ETH_PRICE_QUERY = `
  query GetETHPrice($poolId: String!) {
    pool(id: $poolId) {
      id
      token0Price
      token1Price
      liquidity
      volumeUSD
      feeTier
      token0 {
        id
        symbol
        decimals
      }
      token1 {
        id
        symbol
        decimals
      }
    }
  }
`;

// Backup query to get multiple pools and pick the best one
// const MULTIPLE_POOLS_QUERY = `
//   query GetETHPools {
//     pools(
//       where: {
//         token0_in: ["0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", "0xa0b86a33e6441b8ceb596e3f7b0b59e33b9e0c1c"]
//         token1_in: ["0xa0b869b49f6c62b16a0a0b9b6c6b2e7a4b7e7b46", "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"]
//       }
//       orderBy: liquidity
//       orderDirection: desc
//       first: 5
//     ) {
//       id
//       token0Price
//       token1Price
//       liquidity
//       volumeUSD
//       feeTier
//       token0 {
//         symbol
//         decimals
//       }
//       token1 {
//         symbol
//         decimals
//       }
//     }
//   }
// `;

interface SubgraphResponse {
  data?: {
    pool?: {
      id: string;
      token0Price: string;
      token1Price: string;
      liquidity: string;
      volumeUSD: string;
      feeTier: string;
      token0: {
        id: string;
        symbol: string;
        decimals: string;
      };
      token1: {
        id: string;
        symbol: string;
        decimals: string;
      };
    };
    pools?: Array<{
      id: string;
      token0Price: string;
      token1Price: string;
      liquidity: string;
      volumeUSD: string;
      feeTier: string;
      token0: {
        symbol: string;
        decimals: string;
      };
      token1: {
        symbol: string;
        decimals: string;
      };
    }>;
  };
  errors?: Array<{ message: string }>;
}

export function useUniswapETHPrice(
  network: keyof typeof SUBGRAPH_ENDPOINTS = 'mainnet',
  refreshInterval: number = 30000, // 30 seconds
) {
  const [priceData, setPriceData] = useState<UniswapPriceData>({
    price: 3000, // Fallback price
    lastUpdated: Date.now(),
    source: 'Uniswap V3 Subgraph',
    isLoading: true,
    error: null,
    poolInfo: {
      address: '',
      liquidity: '0',
      volume24h: '0',
      feeTier: '0.05%',
    },
  });

  const fetchETHPrice = useCallback(async () => {
    setPriceData((prev) => ({ ...prev, isLoading: true, error: null }));

    const subgraphUrl = SUBGRAPH_ENDPOINTS[network];
    const poolAddress = ETH_USDC_POOLS[network] || ETH_USDC_POOLS.mainnet;

    try {
      console.log(`🦄 Fetching ETH price from Uniswap ${network} subgraph...`);

      const response = await fetch(subgraphUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: ETH_PRICE_QUERY,
          variables: {
            poolId: poolAddress.toLowerCase(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: SubgraphResponse = await response.json();

      if (result.errors) {
        throw new Error(`GraphQL Error: ${result.errors[0].message}`);
      }

      if (!result.data?.pool) {
        throw new Error('Pool data not found in response');
      }

      const pool = result.data.pool;

      // Determine which token is ETH and which is USDC
      let ethPrice: number;

      if (pool.token0.symbol === 'WETH' || pool.token0.symbol === 'ETH') {
        // ETH is token0, so price is token1Price (USDC per ETH)
        ethPrice = parseFloat(pool.token1Price);
      } else if (pool.token1.symbol === 'WETH' || pool.token1.symbol === 'ETH') {
        // ETH is token1, so price is token0Price (USDC per ETH)
        ethPrice = parseFloat(pool.token0Price);
      } else {
        // Neither token is clearly ETH, use token1Price as fallback
        ethPrice = parseFloat(pool.token1Price);
      }

      if (ethPrice <= 0 || isNaN(ethPrice)) {
        throw new Error('Invalid price data received');
      }

      setPriceData({
        price: ethPrice,
        lastUpdated: Date.now(),
        source: `Uniswap V3 ${network}`,
        isLoading: false,
        error: null,
        poolInfo: {
          address: pool.id,
          liquidity: parseFloat(pool.liquidity).toLocaleString(),
          volume24h: parseFloat(pool.volumeUSD).toLocaleString(),
          feeTier: `${parseFloat(pool.feeTier) / 10000}%`,
        },
      });

      console.log(`✅ ETH price from Uniswap ${network}: $${ethPrice.toLocaleString()}`);
    } catch (error) {
      console.error(`❌ Failed to fetch from Uniswap ${network}:`, error);

      setPriceData((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch price',
      }));
    }
  }, [network]);

  // Initial fetch
  useEffect(() => {
    fetchETHPrice();
  }, [fetchETHPrice]);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchETHPrice, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchETHPrice, refreshInterval]);

  // Manual refresh function
  const refresh = useCallback(() => {
    fetchETHPrice();
  }, [fetchETHPrice]);

  return {
    ...priceData,
    refresh,
    isStale: Date.now() - priceData.lastUpdated > refreshInterval * 2,
  };
}

// Multi-network hook that tries different networks as fallbacks
export function useUniswapETHPriceWithFallback(
  primaryNetwork: keyof typeof SUBGRAPH_ENDPOINTS = 'mainnet',
  refreshInterval: number = 30000,
) {
  const [currentNetwork, setCurrentNetwork] = useState(primaryNetwork);
  const [attemptedNetworks, setAttemptedNetworks] = useState<Set<string>>(new Set());

  const priceData = useUniswapETHPrice(currentNetwork, refreshInterval);

  // If current network fails, try fallback networks
  useEffect(() => {
    if (priceData.error && !priceData.isLoading) {
      const networks = Object.keys(SUBGRAPH_ENDPOINTS) as Array<keyof typeof SUBGRAPH_ENDPOINTS>;
      const nextNetwork = networks.find(
        (net) => net !== currentNetwork && !attemptedNetworks.has(net),
      );

      if (nextNetwork) {
        console.log(`🔄 Switching to ${nextNetwork} as fallback...`);
        setAttemptedNetworks((prev) => new Set([...prev, currentNetwork]));
        setCurrentNetwork(nextNetwork);
      }
    }
  }, [priceData.error, priceData.isLoading, currentNetwork, attemptedNetworks]);

  // Reset attempted networks on successful fetch
  useEffect(() => {
    if (!priceData.error && !priceData.isLoading && priceData.price > 0) {
      setAttemptedNetworks(new Set());
    }
  }, [priceData.error, priceData.isLoading, priceData.price]);

  return {
    ...priceData,
    currentNetwork,
    source: `${priceData.source} (${currentNetwork})`,
  };
}
