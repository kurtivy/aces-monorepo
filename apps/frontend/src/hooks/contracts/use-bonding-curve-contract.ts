'use client';

import { useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useReadContract, useWriteContract, useBalance } from 'wagmi';
import { formatEther } from 'viem';
import { BONDING_CURVE_TEST_ABI, ACES_TEST_ABI } from '@aces/utils';
import { useReliableETHPrice } from './use-reliable-eth-price';

// Contract addresses from your deployment
const BONDING_CURVE_ADDRESS = '0xafa9256Adffc24c3d34296304046647B77eEB139' as const;
const ACES_TEST_TOKEN_ADDRESS = '0x6474F13C2CEbD4Ca36cAE5a1055d44928822Ded9' as const;

// Base Sepolia chain definition
const baseSepolia = {
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://sepolia.base.org'] } },
  blockExplorers: {
    default: { name: 'Base Sepolia Explorer', url: 'https://sepolia.basescan.org' },
  },
  testnet: true,
} as const;

export interface BondingCurveState {
  tokenSupply: bigint;
  totalETHRaised: bigint;
  currentPrice: bigint;
  progress: bigint;
  maxSupply: bigint;
  bondingCurveSupply: bigint;
  targetRaiseUSD: bigint;
  basePrice: bigint;
  isActive: boolean;
  name: string;
  symbol: string;
  ethBalance?: bigint;
  tokenBalance?: bigint;
  ethPriceUSD: number;
  priceSource: string;
  priceLastUpdated: number;
  isPriceStale: boolean;
}

export interface QuoteResult {
  tokensOut: bigint;
  ethCost: bigint;
  pricePerToken: bigint;
  usdCost: number;
  usdPerToken: number;
}

export function useBondingCurveContracts() {
  const { ready, authenticated, user } = usePrivy();

  // Get live ETH price from multiple reliable sources
  const {
    price: ethPriceUSD,
    source: priceSource,
    lastUpdated: priceLastUpdated,
    isStale: isPriceStale,
    isLoading: isPriceLoading,
    error: priceError,
    refresh: refreshPrice,
    current: currentNetwork,
    poolInfo,
  } = useReliableETHPrice(30000);

  // Get wallet balances (only when user is connected)
  const { data: ethBalance } = useBalance({
    address: user?.wallet?.address as `0x${string}`,
    query: { enabled: ready && authenticated && !!user?.wallet?.address },
  });

  const { data: tokenBalance } = useBalance({
    address: user?.wallet?.address as `0x${string}`,
    token: ACES_TEST_TOKEN_ADDRESS,
    query: { enabled: ready && authenticated && !!user?.wallet?.address },
  });

  // PUBLIC CONTRACT READS - Always enabled, no Privy dependency needed
  const { data: maxSupply } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: BONDING_CURVE_TEST_ABI,
    functionName: 'MAX_SUPPLY',
    query: { enabled: true, retry: 3, retryDelay: 1000 },
  });

  const { data: bondingCurveSupply } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: BONDING_CURVE_TEST_ABI,
    functionName: 'BONDING_CURVE_SUPPLY',
    query: { enabled: true, retry: 3, retryDelay: 1000 },
  });

  const { data: targetRaiseUSD } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: BONDING_CURVE_TEST_ABI,
    functionName: 'TARGET_RAISE_USD',
    query: { enabled: true, retry: 3, retryDelay: 1000 },
  });

  const { data: basePrice } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: BONDING_CURVE_TEST_ABI,
    functionName: 'BASE_PRICE',
    query: { enabled: true, retry: 3, retryDelay: 1000 },
  });

  // THE CRITICAL CALL - getRoomStats (returns all dynamic data)
  const { data: roomStats, error: roomStatsError } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: BONDING_CURVE_TEST_ABI,
    functionName: 'getRoomStats',
    args: [ACES_TEST_TOKEN_ADDRESS, BigInt(0)],
    query: {
      enabled: true,
      refetchInterval: 5000,
      retry: 3,
      retryDelay: 1000,
    },
  }) as {
    data: [bigint, bigint, bigint, bigint] | undefined;
    error: Error | null;
  };

  // Get current price for NEXT token (more accurate than roomStats price)
  const { data: nextTokenPrice } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: BONDING_CURVE_TEST_ABI,
    functionName: 'getCurrentPrice',
    args: [ACES_TEST_TOKEN_ADDRESS, BigInt(0)],
    query: {
      enabled: true,
      refetchInterval: 5000,
      retry: 3,
      retryDelay: 1000,
    },
  });

  // Read token name and symbol
  const { data: name } = useReadContract({
    address: ACES_TEST_TOKEN_ADDRESS,
    abi: ACES_TEST_ABI,
    functionName: 'name',
    query: { enabled: true, retry: 3, retryDelay: 1000 },
  });

  const { data: symbol } = useReadContract({
    address: ACES_TEST_TOKEN_ADDRESS,
    abi: ACES_TEST_ABI,
    functionName: 'symbol',
    query: { enabled: true, retry: 3, retryDelay: 1000 },
  });

  // Write contract functions
  const { writeContractAsync } = useWriteContract();

  // Debug logging (remove in production if desired)
  if (roomStatsError) {
    console.error('❌ getRoomStats failed:', roomStatsError.message);
  }

  if (roomStats) {
    const [tokenSupply, totalETHRaised, roomStatsPrice, progress] = roomStats;
    const actualCurrentPrice = nextTokenPrice || roomStatsPrice;
    console.log('📊 Live Contract Data:', {
      tokenSupply: `${Number(tokenSupply) / 1e18} tokens`,
      totalETHRaised: `${Number(totalETHRaised) / 1e18} ETH`,
      currentPrice: `${Number(formatEther(actualCurrentPrice))} ETH`,
      progress: `${Number(progress)}%`,
    });
  }

  // Get quote function
  const getQuote = useCallback(
    async (usdAmount: number): Promise<QuoteResult> => {
      if (!ready || !authenticated) throw new Error('Not authenticated');

      if (usdAmount <= 0) {
        return {
          tokensOut: BigInt(0),
          ethCost: BigInt(0),
          pricePerToken: BigInt(0),
          usdCost: 0,
          usdPerToken: 0,
        };
      }

      try {
        const ethAmount = usdAmount / ethPriceUSD;
        const ethAmountWei = BigInt(Math.floor(ethAmount * 1e18));
        const currentPrice = roomStats ? roomStats[2] : BigInt(0);

        if (currentPrice > BigInt(0)) {
          const estimatedTokens = (ethAmountWei * BigInt(1e18)) / currentPrice;
          const usdPerToken = (Number(currentPrice) / 1e18) * ethPriceUSD;

          return {
            tokensOut: estimatedTokens,
            ethCost: ethAmountWei,
            pricePerToken: currentPrice,
            usdCost: usdAmount,
            usdPerToken: usdPerToken,
          };
        } else {
          throw new Error('Current price not available');
        }
      } catch (error) {
        console.error('Quote failed:', error);
        throw new Error('Failed to get price quote');
      }
    },
    [ready, authenticated, ethPriceUSD, roomStats],
  );

  // Buy tokens function
  const buyTokens = useCallback(
    async (tokenAmount: bigint, ethCost: bigint) => {
      if (!ready || !authenticated) throw new Error('Not authenticated');

      try {
        const numTokens = Number(tokenAmount) / 1e18;
        let gasLimit: bigint;

        if (numTokens <= 100) {
          gasLimit = BigInt(1000000);
        } else if (numTokens <= 1000) {
          gasLimit = BigInt(2000000);
        } else if (numTokens <= 5000) {
          gasLimit = BigInt(4000000);
        } else if (numTokens <= 10000) {
          gasLimit = BigInt(6000000);
        } else {
          throw new Error(
            `Purchase of ${numTokens.toLocaleString()} tokens would require excessive gas. Please try a smaller amount (max 10,000 tokens per transaction).`,
          );
        }

        console.log(
          `💰 Using ${gasLimit.toLocaleString()} gas limit for ${numTokens.toLocaleString()} tokens`,
        );

        const hash = await writeContractAsync({
          address: BONDING_CURVE_ADDRESS,
          abi: BONDING_CURVE_TEST_ABI,
          functionName: 'buyShares',
          args: [ACES_TEST_TOKEN_ADDRESS, BigInt(0), tokenAmount],
          value: ethCost,
          chain: baseSepolia,
          account: user?.wallet?.address as `0x${string}`,
          gas: gasLimit,
          maxFeePerGas: numTokens > 1000 ? BigInt(2000000000) : BigInt(1000000000),
          maxPriorityFeePerGas: numTokens > 1000 ? BigInt(200000000) : BigInt(100000000),
        });

        console.log('✅ Transaction submitted:', hash);
        return hash;
      } catch (error) {
        console.error('❌ buyTokens failed:', error);
        throw error;
      }
    },
    [ready, authenticated, writeContractAsync, user?.wallet?.address],
  );

  // Sell tokens function
  const sellTokens = useCallback(
    async (tokenAmount: bigint) => {
      if (!ready || !authenticated) throw new Error('Not authenticated');

      try {
        console.log('🔥 Estimating gas for sellShares transaction...');
        const gasLimit = BigInt(300000);

        console.log(`💸 Selling ${tokenAmount} tokens with ${gasLimit} gas limit`);

        const hash = await writeContractAsync({
          address: BONDING_CURVE_ADDRESS,
          abi: BONDING_CURVE_TEST_ABI,
          functionName: 'sellShares',
          args: [ACES_TEST_TOKEN_ADDRESS, BigInt(0), tokenAmount],
          chain: baseSepolia,
          account: user?.wallet?.address as `0x${string}`,
          gas: gasLimit,
          maxFeePerGas: BigInt(1000000000),
          maxPriorityFeePerGas: BigInt(100000000),
        });

        console.log('✅ Sell transaction submitted:', hash);
        return hash;
      } catch (error) {
        console.error('❌ sellTokens failed:', error);
        throw error;
      }
    },
    [ready, authenticated, writeContractAsync, user?.wallet?.address],
  );

  // Create contract state - only if we have the essential data
  const contractState: BondingCurveState | undefined =
    roomStats && maxSupply && bondingCurveSupply && targetRaiseUSD && basePrice
      ? {
          tokenSupply: roomStats[0],
          totalETHRaised: roomStats[1],
          currentPrice: nextTokenPrice || roomStats[2],
          progress: roomStats[3],
          maxSupply,
          bondingCurveSupply,
          targetRaiseUSD,
          basePrice,
          isActive: true,
          name: name || 'ACES',
          symbol: symbol || 'ACES',
          ethBalance: ethBalance?.value,
          tokenBalance: tokenBalance?.value,
          ethPriceUSD,
          priceSource,
          priceLastUpdated,
          isPriceStale,
        }
      : undefined;

  return {
    contractState,
    getQuote,
    buyTokens,
    sellTokens,
    // Price feed utilities
    ethPrice: {
      current: ethPriceUSD,
      source: priceSource,
      lastUpdated: priceLastUpdated,
      isStale: isPriceStale,
      isLoading: isPriceLoading,
      error: priceError,
      refresh: refreshPrice,
      network: currentNetwork,
      poolInfo: poolInfo,
    },
    // Contract addresses for reference
    addresses: {
      bondingCurve: BONDING_CURVE_ADDRESS,
      token: ACES_TEST_TOKEN_ADDRESS,
    },
  };
}
