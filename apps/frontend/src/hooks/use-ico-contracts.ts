'use client';

import { useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useReadContract, useWriteContract, useBalance } from 'wagmi';
import { formatEther } from 'viem';
import { BONDING_CURVE_TEST_ABI, ACES_TEST_ABI } from '@aces/utils';
import { useReliableETHPrice } from './use-reliable-eth-price'; // More reliable price hook

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
  // Price feed data
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
    network: currentNetwork,
    poolInfo,
  } = useReliableETHPrice(30000); // Multiple sources with fallbacks

  // Get wallet balances
  const { data: ethBalance } = useBalance({
    address: user?.wallet?.address as `0x${string}`,
    query: { enabled: ready && authenticated && !!user?.wallet?.address },
  });

  const { data: tokenBalance } = useBalance({
    address: user?.wallet?.address as `0x${string}`,
    token: ACES_TEST_TOKEN_ADDRESS,
    query: { enabled: ready && authenticated && !!user?.wallet?.address },
  });

  // Read contract constants - PUBLIC DATA (no auth required)
  const { data: maxSupply } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: BONDING_CURVE_TEST_ABI,
    functionName: 'MAX_SUPPLY',
    query: { enabled: ready }, // Remove authentication requirement
  });

  const { data: bondingCurveSupply } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: BONDING_CURVE_TEST_ABI,
    functionName: 'BONDING_CURVE_SUPPLY',
    query: { enabled: ready }, // Remove authentication requirement
  });

  const { data: targetRaiseUSD } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: BONDING_CURVE_TEST_ABI,
    functionName: 'TARGET_RAISE_USD',
    query: { enabled: ready }, // Remove authentication requirement
  });

  const { data: basePrice } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: BONDING_CURVE_TEST_ABI,
    functionName: 'BASE_PRICE',
    query: { enabled: ready }, // Remove authentication requirement
  });

  // Test basic contract connectivity with ethPriceUSD (should always return a value)
  const {
    data: contractETHPrice,
    error: ethPriceError,
    isLoading: ethPriceLoading,
  } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: BONDING_CURVE_TEST_ABI,
    functionName: 'ethPriceUSD',
    query: { enabled: ready },
  });

  // Check contract balance to see if it's been funded
  const { data: contractBalance } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: BONDING_CURVE_TEST_ABI,
    functionName: 'getContractBalance',
    query: { enabled: ready },
  });

  // Read room stats (all the dynamic data in one call) - PUBLIC DATA
  const { data: roomStats } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: BONDING_CURVE_TEST_ABI,
    functionName: 'getRoomStats',
    args: [ACES_TEST_TOKEN_ADDRESS, BigInt(0)],
    query: {
      enabled: ready, // Remove authentication requirement - price should be public
      refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
    },
  }) as { data: [bigint, bigint, bigint, bigint] | undefined };

  // Get current price for NEXT token (price to buy 1 token at current supply level)
  const { data: nextTokenPrice } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: BONDING_CURVE_TEST_ABI,
    functionName: 'getCurrentPrice',
    args: [ACES_TEST_TOKEN_ADDRESS, BigInt(0)], // sharesSubject, roomNumber
    query: {
      enabled: ready,
      refetchInterval: 5000, // Keep price updated
    },
  });

  // Read token name and symbol - PUBLIC DATA
  const { data: name } = useReadContract({
    address: ACES_TEST_TOKEN_ADDRESS,
    abi: ACES_TEST_ABI,
    functionName: 'name',
    query: { enabled: ready }, // Remove authentication requirement
  });

  const { data: symbol } = useReadContract({
    address: ACES_TEST_TOKEN_ADDRESS,
    abi: ACES_TEST_ABI,
    functionName: 'symbol',
    query: { enabled: ready }, // Remove authentication requirement
  });

  // Write contract functions
  const { writeContractAsync } = useWriteContract();

  // Get price quote for buying tokens with live USD conversion
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
        // Convert USD to ETH using live price
        const ethAmount = usdAmount / ethPriceUSD;
        const ethAmountWei = BigInt(Math.floor(ethAmount * 1e18));

        // Use current price from contract
        const currentPrice = roomStats ? roomStats[2] : BigInt(0);

        if (currentPrice > BigInt(0)) {
          // Calculate tokens based on current price
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

  // Buy tokens (matches your dev's buyShares function)
  const buyTokens = useCallback(
    async (tokenAmount: bigint, ethCost: bigint) => {
      if (!ready || !authenticated) throw new Error('Not authenticated');

      try {
        // Calculate number of tokens being purchased for gas estimation
        const numTokens = Number(tokenAmount) / 1e18; // Convert from wei to token count

        console.log('🔥 Estimating gas for buyShares transaction...');
        console.log(`📊 Purchasing ${numTokens.toLocaleString()} tokens`);

        // CRITICAL: The contract loops once per token in getPrice() function!
        // For large purchases, this becomes extremely gas-intensive

        // Dynamic gas calculation based on token amount
        let gasLimit: bigint;

        if (numTokens <= 100) {
          gasLimit = BigInt(1000000); // Increased from 200k to 1M gas
        } else if (numTokens <= 1000) {
          gasLimit = BigInt(2000000); // Increased from 500k to 2M gas
        } else if (numTokens <= 5000) {
          gasLimit = BigInt(4000000); // Increased from 1.5M to 4M gas
        } else if (numTokens <= 10000) {
          gasLimit = BigInt(6000000); // Increased from 2.5M to 6M gas
        } else {
          // For purchases over 10k tokens, break them down or warn user
          throw new Error(
            `Purchase of ${numTokens.toLocaleString()} tokens would require excessive gas. Please try a smaller amount (max 10,000 tokens per transaction).`,
          );
        }

        console.log(
          `💰 Using ${gasLimit.toLocaleString()} gas limit for ${numTokens.toLocaleString()} tokens`,
        );
        console.log(
          `💰 Buying ${tokenAmount} tokens for ${ethCost} ETH with ${gasLimit} gas limit`,
        );

        const hash = await writeContractAsync({
          address: BONDING_CURVE_ADDRESS,
          abi: BONDING_CURVE_TEST_ABI,
          functionName: 'buyShares',
          args: [ACES_TEST_TOKEN_ADDRESS, BigInt(0), tokenAmount],
          value: ethCost,
          chain: baseSepolia,
          account: user?.wallet?.address as `0x${string}`,
          // Dynamic gas settings based on purchase size
          gas: gasLimit,
          // Increased gas price for large transactions to ensure they go through
          maxFeePerGas: numTokens > 1000 ? BigInt(2000000000) : BigInt(1000000000), // 2 gwei for large, 1 gwei for small
          maxPriorityFeePerGas: numTokens > 1000 ? BigInt(200000000) : BigInt(100000000), // 0.2 gwei tip for large, 0.1 gwei for small
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

  // Sell tokens back to the curve
  const sellTokens = useCallback(
    async (tokenAmount: bigint) => {
      if (!ready || !authenticated) throw new Error('Not authenticated');

      try {
        console.log('🔥 Estimating gas for sellShares transaction...');

        // Use a higher gas limit for selling as well
        const gasLimit = BigInt(300000); // 300k gas limit for selling (slightly less complex than buying)

        console.log(`💸 Selling ${tokenAmount} tokens with ${gasLimit} gas limit`);

        const hash = await writeContractAsync({
          address: BONDING_CURVE_ADDRESS,
          abi: BONDING_CURVE_TEST_ABI,
          functionName: 'sellShares',
          args: [ACES_TEST_TOKEN_ADDRESS, BigInt(0), tokenAmount],
          chain: baseSepolia,
          account: user?.wallet?.address as `0x${string}`,
          // Add gas settings to prevent "out of gas" errors
          gas: gasLimit,
          // Optional: Set gas price for faster confirmation
          maxFeePerGas: BigInt(1000000000), // 1 gwei
          maxPriorityFeePerGas: BigInt(100000000), // 0.1 gwei tip
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

  // Contract data status
  const usingFallback = !roomStats && ethPriceUSD > 0;
  console.log(
    `🏗️ Contract Status: ${roomStats ? '✅ Live Data' : usingFallback ? '🔄 Demo Mode' : '⏳ Loading...'}`,
  );

  if (roomStats) {
    const [tokenSupply, totalETHRaised, roomStatsPrice, progress] = roomStats;
    const actualCurrentPrice = nextTokenPrice || roomStatsPrice; // Use nextTokenPrice if available
    console.log('📊 Live Contract Data:', {
      tokenSupply: `${Number(tokenSupply) / 1e18} tokens`,
      totalETHRaised: `${Number(totalETHRaised) / 1e18} ETH`,
      roomStatsPrice: `${Number(formatEther(roomStatsPrice))} ETH`,
      nextTokenPrice: nextTokenPrice ? `${Number(formatEther(nextTokenPrice))} ETH` : 'NO DATA',
      actualPriceUsed: `${Number(formatEther(actualCurrentPrice))} ETH`,
      actualPriceUSD: `$${(Number(formatEther(actualCurrentPrice)) * ethPriceUSD).toFixed(6)}`,
      progress: `${Number(progress)}%`,
    });
  }

  // Create fallback demo data if contracts aren't responding
  const createFallbackState = (): BondingCurveState => ({
    tokenSupply: BigInt('5000000000000000000000000'), // 5M tokens
    totalETHRaised: BigInt('100000000000000000000'), // 100 ETH raised
    currentPrice: BigInt('120000000000000'), // ~$0.00012 per token
    progress: BigInt(50), // 50% progress
    maxSupply: BigInt('10000000000000000000000000'), // 10M max supply
    bondingCurveSupply: BigInt('8000000000000000000000000'), // 8M for bonding curve
    targetRaiseUSD: BigInt('1000000000000000000000'), // $1000 target
    basePrice: BigInt('100000000000000'), // Base price
    isActive: true,
    name: 'ACES',
    symbol: 'ACES',
    ethBalance: ethBalance?.value,
    tokenBalance: tokenBalance?.value,
    // Always use live price data (more reliable than contract's stored price)
    ethPriceUSD,
    priceSource,
    priceLastUpdated,
    isPriceStale,
  });

  // Contract state with live price data or fallback
  const contractState: BondingCurveState | undefined = roomStats
    ? {
        tokenSupply: roomStats[0],
        totalETHRaised: roomStats[1],
        currentPrice: nextTokenPrice || roomStats[2], // Use nextTokenPrice for accurate next token pricing
        progress: roomStats[3],
        maxSupply: maxSupply || BigInt(0),
        bondingCurveSupply: bondingCurveSupply || BigInt(0),
        targetRaiseUSD: targetRaiseUSD || BigInt(0),
        basePrice: basePrice || BigInt(0),
        isActive: true,
        name: name || 'ACES',
        symbol: symbol || 'ACES',
        ethBalance: ethBalance?.value,
        tokenBalance: tokenBalance?.value,
        // Always use live ETH price (more reliable than contract's stored ethPriceUSD)
        ethPriceUSD, // From useReliableETHPrice hook
        priceSource,
        priceLastUpdated,
        isPriceStale,
      }
    : ethPriceUSD > 0
      ? createFallbackState()
      : undefined; // Use fallback if ETH price is ready

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
