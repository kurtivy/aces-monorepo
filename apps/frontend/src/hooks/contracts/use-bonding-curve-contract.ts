'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useReadContract, useWriteContract, useBalance } from 'wagmi';
import { readContract } from 'wagmi/actions';
import { formatEther, parseEther } from 'viem';
import { ACES_VAULT_ABI, getBondingCurveContracts } from '@aces/utils';
import { useReliableETHPrice } from './use-reliable-eth-price';
import { wagmiConfig } from '@/components/providers/app-providers';
import { base } from 'wagmi/chains';

// Contract addresses - MAINNET CONFIGURATION
const BASE_MAINNET_CONTRACTS = getBondingCurveContracts(8453); // Base Mainnet
const ACES_VAULT_ADDRESS = BASE_MAINNET_CONTRACTS.acesVault; // Proxy address
const ACES_TOKEN_ADDRESS = BASE_MAINNET_CONTRACTS.acesToken; // Token address
const SHARES_SUBJECT_ADDRESS = BASE_MAINNET_CONTRACTS.sharesSubject; // Dev wallet as subject
const ROOM_NUMBER = BigInt(BASE_MAINNET_CONTRACTS.roomNumber); // Fixed room number

const baseMainnet = base;

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
  tokensOut: bigint; // Raw tokens that will be minted (shares * 1e18)
  ethCost: bigint; // Exact ETH cost from contract
  shareCount: bigint; // Raw share count for the contract
}

export function useBondingCurveContracts() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();

  // Check if user has any connected wallets through Privy
  const hasConnectedWallet = wallets.length > 0;
  const primaryWallet = wallets[0];
  const walletAddress = user?.wallet?.address;

  // Get live ETH price
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
  } = useReliableETHPrice(120000);

  // Get wallet balances
  const { data: ethBalance } = useBalance({
    address: walletAddress as `0x${string}`,
    query: {
      enabled: ready && authenticated && !!walletAddress,
      refetchInterval: 30000,
    },
  });

  const { data: tokenBalanceData } = useBalance({
    address: walletAddress as `0x${string}`,
    token: ACES_TOKEN_ADDRESS,
    query: {
      enabled: ready && authenticated && !!walletAddress,
      refetchInterval: 30000,
    },
  });

  // CONTRACT READS - ALL USING PROXY ADDRESS

  // Room-based token supply (shares in the vault)
  const {
    data: roomTokenSupply,
    error: roomTokenSupplyError,
    isLoading: roomTokenSupplyLoading,
    refetch: refetchRoomTokenSupply,
  } = useReadContract({
    address: ACES_VAULT_ADDRESS,
    abi: ACES_VAULT_ABI,
    functionName: 'getTokenSupply',
    args: [SHARES_SUBJECT_ADDRESS, ROOM_NUMBER],
    query: {
      enabled: true,
      retry: 3,
      retryDelay: 1000,
      refetchInterval: 30000,
      staleTime: 15000,
    },
  });

  // User's share balance in the room
  const { data: userShareBalance, refetch: refetchUserShareBalance } = useReadContract({
    address: ACES_VAULT_ADDRESS,
    abi: ACES_VAULT_ABI,
    functionName: 'getTokenBalance',
    args: [SHARES_SUBJECT_ADDRESS, ROOM_NUMBER, walletAddress as `0x${string}`],
    query: {
      enabled: ready && authenticated && !!walletAddress,
      retry: 3,
      retryDelay: 1000,
      refetchInterval: 30000,
      staleTime: 15000,
    },
  });

  // Current price for 1 share (used for calculations)
  const {
    data: currentSharePrice,
    error: currentSharePriceError,
    isLoading: currentSharePriceLoading,
    refetch: refetchCurrentSharePrice,
  } = useReadContract({
    address: ACES_VAULT_ADDRESS,
    abi: ACES_VAULT_ABI,
    functionName: 'getBuyPriceAfterFee',
    args: [SHARES_SUBJECT_ADDRESS, ROOM_NUMBER, BigInt(1)],
    query: {
      enabled: true,
      refetchInterval: 30000,
      retry: 3,
      retryDelay: 1000,
      staleTime: 15000,
    },
  });

  // Try calling getBuyPrice (without fees) to see if that works
  const { data: baseBuyPrice, error: baseBuyPriceError } = useReadContract({
    address: ACES_VAULT_ADDRESS,
    abi: ACES_VAULT_ABI,
    functionName: 'getBuyPrice',
    args: [SHARES_SUBJECT_ADDRESS, ROOM_NUMBER, BigInt(1)],
    query: {
      enabled: true,
      retry: 3,
      retryDelay: 1000,
    },
  });

  // Debug the getBuyPriceAfterFee call
  useEffect(() => {
    // Debug logging removed for production
  }, [
    currentSharePrice,
    currentSharePriceError,
    currentSharePriceLoading,
    roomTokenSupply,
    baseBuyPrice,
    baseBuyPriceError,
  ]);

  // Fee information (static data) - ADD THESE BACK
  const { data: protocolFeePercent } = useReadContract({
    address: ACES_VAULT_ADDRESS,
    abi: ACES_VAULT_ABI,
    functionName: 'protocolFeePercent',
    query: {
      enabled: true,
      retry: 3,
      retryDelay: 1000,
      staleTime: 300000,
      refetchInterval: false,
    },
  });

  const { data: subjectFeePercent } = useReadContract({
    address: ACES_VAULT_ADDRESS,
    abi: ACES_VAULT_ABI,
    functionName: 'subjectFeePercent',
    query: {
      enabled: true,
      retry: 3,
      retryDelay: 1000,
      staleTime: 300000,
      refetchInterval: false,
    },
  });

  // Token metadata
  const name = 'ACES';
  const symbol = 'ACES';

  // Total minted tokens (for progression bar)
  const totalMintedSupply = roomTokenSupply;

  // Write contract functions
  const { writeContractAsync } = useWriteContract();

  // Provide fallback ETH price if main price feed fails
  const effectiveEthPrice = useMemo(() => {
    if (priceError || isPriceLoading) {
      return 3000; // Fallback price
    }
    return ethPriceUSD || 3000;
  }, [ethPriceUSD, priceError, isPriceLoading]);

  // Log fee data for debugging - ADD THIS BACK
  useEffect(() => {
    // Fee data logging removed for production
  }, [protocolFeePercent, subjectFeePercent]);

  // Caching for quote calculations to reduce RPC calls
  const quoteCache = useMemo(
    () => new Map<string, { result: QuoteResult; timestamp: number }>(),
    [],
  );
  const CACHE_DURATION = 30000; // 30 seconds

  // Mathematical approximation based on current contract pricing
  const approximateSharesFromETH = useCallback(
    (ethAmount: string, currentPrice?: bigint): bigint => {
      const ethWei = parseEther(ethAmount);

      if (!currentPrice || currentPrice <= BigInt(0)) {
        // If we don't have current price, return a conservative estimate
        // This should rarely happen since we fetch currentSharePrice
        return BigInt(1000); // Very conservative fallback
      }

      // Use current price: shares = ethAmount / pricePerShare
      return ethWei / currentPrice;
    },
    [],
  );

  // OPTIMIZED getQuote function with caching and fallback calculation
  const getQuote = useCallback(
    async (ethAmount: string): Promise<QuoteResult> => {
      if (!ready || !authenticated) throw new Error('Not authenticated');

      const ethAmountWei = parseEther(ethAmount);

      if (ethAmountWei <= BigInt(0)) {
        return {
          tokensOut: BigInt(0),
          ethCost: BigInt(0),
          shareCount: BigInt(0),
        };
      }

      // Check cache first
      const cacheKey = `${ethAmount}-${currentSharePrice?.toString() || '0'}`;
      const cachedResult = quoteCache.get(cacheKey);
      if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_DURATION) {
        return cachedResult.result;
      }

      try {
        // For quadratic bonding curve, we can't use linear approximation
        // Start with reasonable bounds for binary search based on ETH amount
        const ethWei = parseEther(ethAmount);

        // For small amounts of ETH, use conservative bounds
        // Based on contract data: ~53K shares for $0.54 ≈ 0.0001 ETH
        let low = BigInt(1000); // Start low
        let high = BigInt(100000); // Conservative upper bound

        // Scale bounds based on ETH amount
        if (ethWei > parseEther('0.001')) {
          high = BigInt(1000000); // 1M shares for larger amounts
        }
        if (ethWei > parseEther('0.01')) {
          high = BigInt(10000000); // 10M shares for very large amounts
        }

        // Cap the search range to avoid excessive calls and contract reverts
        if (high > BigInt(10000000)) high = BigInt(10000000); // Keep maximum cap

        // CRITICAL FIX: Allow low values for small ETH amounts, but set a reasonable minimum
        if (low < BigInt(100)) low = BigInt(100); // Much lower minimum: 100 instead of 10,000

        let bestShares = BigInt(0);
        let bestCost = BigInt(0);

        // First, test if the contract works at all with a very small amount
        try {
          const testShares = BigInt(1000); // Test with just 1,000 shares
          const testCost = await readContract(wagmiConfig, {
            address: ACES_VAULT_ADDRESS,
            abi: ACES_VAULT_ABI,
            functionName: 'getBuyPriceAfterFee',
            args: [SHARES_SUBJECT_ADDRESS, ROOM_NUMBER, testShares],
          });
        } catch (error) {
          throw new Error('Bonding curve contract not available for this room');
        }

        // Skip linear approximation for quadratic curves - go straight to binary search

        // Efficient binary search with reduced iterations
        const maxIterations = 8; // Much fewer iterations
        let iterations = 0;

        while (low <= high && iterations < maxIterations) {
          const mid = (low + high) / BigInt(2);

          try {
            const exactCost = await readContract(wagmiConfig, {
              address: ACES_VAULT_ADDRESS,
              abi: ACES_VAULT_ABI,
              functionName: 'getBuyPriceAfterFee',
              args: [SHARES_SUBJECT_ADDRESS, ROOM_NUMBER, mid],
            });

            if (exactCost <= ethAmountWei) {
              bestShares = mid;
              bestCost = exactCost;

              low = mid + BigInt(1);
            } else {
              high = mid - BigInt(1);
            }
          } catch (error) {
            // If we hit rate limit, break early and use best result
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
              break;
            }

            // If the contract reverts on this amount, it might be too high
            // Try reducing the search space
            if (errorMessage.includes('reverted') || errorMessage.includes('execution reverted')) {
              high = mid - BigInt(1);
            } else {
              // For other errors, also reduce search space
              high = mid - BigInt(1);
            }
          }

          iterations++;

          // Add minimal delay to avoid rate limits
          if (iterations % 3 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        // If we couldn't find a good result, return zero (binary search should work for quadratic curves)

        if (bestShares === BigInt(0)) {
          return {
            tokensOut: BigInt(0),
            ethCost: BigInt(0),
            shareCount: BigInt(0),
          };
        }

        // tokensOut represents the share count that user receives
        // The contract will mint amount * 1e18 tokens, but we display just the amount
        const tokensOut = bestShares;

        // Add fees to the cost for accurate total cost display
        let totalCostWithFees = bestCost;
        if (protocolFeePercent && subjectFeePercent) {
          const protocolFee = (bestCost * protocolFeePercent) / parseEther('1');
          const subjectFee = (bestCost * subjectFeePercent) / parseEther('1');
          totalCostWithFees = bestCost + protocolFee + subjectFee;
        }

        const result = {
          tokensOut,
          ethCost: totalCostWithFees,
          shareCount: bestShares,
        };

        // Cache the result
        quoteCache.set(cacheKey, { result, timestamp: Date.now() });

        // Clean old cache entries
        for (const [key, value] of quoteCache.entries()) {
          if (Date.now() - value.timestamp > CACHE_DURATION) {
            quoteCache.delete(key);
          }
        }

        return result;
      } catch (error) {
        throw new Error('Failed to get price quote from bonding curve contract');
      }
    },
    [
      ready,
      authenticated,
      protocolFeePercent,
      subjectFeePercent,
      currentSharePrice,
      approximateSharesFromETH,
      quoteCache,
    ],
  );

  // BUY TOKENS FUNCTION - simplified for proxy contract
  const buyTokens = useCallback(
    async (shareCount: bigint, ethCost: bigint) => {
      if (!ready || !authenticated) {
        throw new Error('Not authenticated with Privy');
      }

      if (!hasConnectedWallet || !walletAddress) {
        throw new Error('Wallet not connected. Please connect your wallet to make purchases.');
      }

      if (!primaryWallet) {
        throw new Error('No active wallet found');
      }

      try {
        // Get the EXACT cost from contract one more time to be sure
        // Use getPrice + fees calculation to match our quote
        const baseCost = await readContract(wagmiConfig, {
          address: ACES_VAULT_ADDRESS,
          abi: ACES_VAULT_ABI,
          functionName: 'getPrice',
          args: [SHARES_SUBJECT_ADDRESS, ROOM_NUMBER, shareCount, true],
        });

        // Calculate fees
        let finalCost = baseCost;
        if (protocolFeePercent && subjectFeePercent) {
          const protocolFee = (baseCost * protocolFeePercent) / parseEther('1');
          const subjectFee = (baseCost * subjectFeePercent) / parseEther('1');
          finalCost = baseCost + protocolFee + subjectFee;
        }

        // Use the higher of the two costs to be safe
        const safeFinalCost = ethCost > finalCost ? ethCost : finalCost;

        const hash = await writeContractAsync({
          address: ACES_VAULT_ADDRESS,
          abi: ACES_VAULT_ABI,
          functionName: 'buyShares',
          args: [SHARES_SUBJECT_ADDRESS, ROOM_NUMBER, shareCount],
          value: safeFinalCost,
          chain: baseMainnet,
          account: walletAddress as `0x${string}`,
        });

        // Refresh data after successful purchase
        setTimeout(() => {
          refetchRoomTokenSupply();
          refetchUserShareBalance();
          refetchCurrentSharePrice();
        }, 2000);

        return hash;
      } catch (error) {
        throw error;
      }
    },
    [
      ready,
      authenticated,
      hasConnectedWallet,
      walletAddress,
      primaryWallet,
      writeContractAsync,
      refetchRoomTokenSupply,
      refetchUserShareBalance,
      refetchCurrentSharePrice,
      protocolFeePercent,
      subjectFeePercent,
    ],
  );

  // Sell tokens function (placeholder)
  const sellTokens = useCallback(async (_shareCount: bigint) => {
    throw new Error('Selling tokens is not yet implemented in the current contract version');
  }, []);

  // Contract state - simplified memoization
  const contractState: BondingCurveState | undefined = useMemo(() => {
    // Check if we have the essential data
    const hasEssentialData = roomTokenSupply !== undefined && currentSharePrice !== undefined;

    // Define your intended maximum supply for the bonding curve launch
    const intendedMaxSupply = BigInt(1000000000) * BigInt(1e18); // 1B tokens intended max
    const bondingCurveMaxSupply = BigInt(800000000) * BigInt(1e18); // 800M available in bonding curve

    // Use room token supply for progress calculation (shares in the vault)
    const currentRoomSupply = roomTokenSupply || BigInt(0);
    const currentlyMinted = totalMintedSupply || BigInt(0);

    if (hasEssentialData) {
      return {
        tokenSupply: currentRoomSupply, // Shares in the vault room
        totalETHRaised: BigInt(0), // Can be calculated from events if needed
        currentPrice: currentSharePrice,
        progress:
          bondingCurveMaxSupply > 0
            ? BigInt(Math.floor((Number(currentlyMinted) / Number(bondingCurveMaxSupply)) * 100))
            : BigInt(0),
        maxSupply: intendedMaxSupply,
        bondingCurveSupply: bondingCurveMaxSupply,
        targetRaiseUSD: BigInt(100000) * BigInt(1e6), // $100K target
        basePrice: currentSharePrice,
        isActive: true,
        name: name,
        symbol: symbol,
        ethBalance: ethBalance?.value,
        tokenBalance: userShareBalance || tokenBalanceData?.value || BigInt(0),
        ethPriceUSD: effectiveEthPrice,
        priceSource: priceSource || 'fallback',
        priceLastUpdated: priceLastUpdated || Date.now(),
        isPriceStale: isPriceStale || false,
      };
    }

    // Loading state
    if (
      (roomTokenSupplyLoading || currentSharePriceLoading) &&
      !roomTokenSupplyError &&
      !currentSharePriceError
    ) {
      return {
        tokenSupply: BigInt(1),
        totalETHRaised: BigInt(0),
        currentPrice: BigInt('1000000000000000'), // 0.001 ETH
        progress: BigInt(0),
        maxSupply: intendedMaxSupply,
        bondingCurveSupply: bondingCurveMaxSupply,
        targetRaiseUSD: BigInt(100000) * BigInt(1e6),
        basePrice: BigInt('1000000000000000'),
        isActive: true,
        name: name,
        symbol: symbol,
        ethBalance: ethBalance?.value,
        tokenBalance: userShareBalance || BigInt(0),
        ethPriceUSD: effectiveEthPrice,
        priceSource: priceSource || 'fallback',
        priceLastUpdated: priceLastUpdated || Date.now(),
        isPriceStale: isPriceStale || false,
      };
    }

    return undefined;
  }, [
    roomTokenSupply,
    currentSharePrice,
    totalMintedSupply,
    roomTokenSupplyLoading,
    currentSharePriceLoading,
    roomTokenSupplyError,
    currentSharePriceError,
    userShareBalance,
    ethBalance?.value,
    effectiveEthPrice,
    name,
    symbol,
    priceSource,
    priceLastUpdated,
    isPriceStale,
  ]);

  return {
    contractState,
    getQuote,
    buyTokens,
    sellTokens,
    // Additional utilities for debugging
    refresh: {
      tokenSupply: refetchRoomTokenSupply,
      userBalance: refetchUserShareBalance,
      price: refetchCurrentSharePrice,
      ethPrice: refreshPrice,
    },
    isLoading: {
      tokenSupply: roomTokenSupplyLoading,
      currentPrice: currentSharePriceLoading,
      ethPrice: isPriceLoading,
    },
    errors: {
      tokenSupply: roomTokenSupplyError,
      currentPrice: currentSharePriceError,
      ethPrice: priceError,
    },
    // Price feed utilities
    ethPrice: {
      current: effectiveEthPrice,
      source: priceSource || 'fallback',
      lastUpdated: priceLastUpdated || Date.now(),
      isStale: isPriceStale || false,
      isLoading: isPriceLoading,
      error: priceError,
      refresh: refreshPrice,
      network: currentNetwork,
      poolInfo: poolInfo,
    },
    // Contract addresses
    addresses: {
      vault: ACES_VAULT_ADDRESS,
      token: ACES_TOKEN_ADDRESS,
      sharesSubject: SHARES_SUBJECT_ADDRESS,
    },
  };
}
