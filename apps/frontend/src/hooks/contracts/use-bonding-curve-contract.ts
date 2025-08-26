'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  tokensOut: bigint; // Amount of tokens user will receive
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
      retry: 5,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchInterval: 60000, // Reduced from 30s to 60s since this doesn't change often
      staleTime: 30000, // Increased from 15s to 30s
      gcTime: 300000, // Keep in cache for 5 minutes
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
      refetchInterval: 60000, // Reduced frequency since price doesn't change that often
      retry: 5,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 30000,
      gcTime: 300000,
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

  // Cache successful contract reads
  useEffect(() => {
    if (roomTokenSupply !== undefined || currentSharePrice !== undefined) {
      const cacheData = {
        roomTokenSupply: roomTokenSupply?.toString(),
        currentSharePrice: currentSharePrice?.toString(),
        timestamp: Date.now(),
      };

      try {
        localStorage.setItem(
          `aces-contract-cache-${ACES_VAULT_ADDRESS}`,
          JSON.stringify(cacheData),
        );
        setCachedContractData({
          roomTokenSupply,
          currentSharePrice,
          timestamp: Date.now(),
        });
        console.log('💾 [ACES Contract] Cached contract data', cacheData);
      } catch (error) {
        console.warn('Failed to cache contract data:', error);
      }
    }
  }, [roomTokenSupply, currentSharePrice]);

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

  // Contract data cache with localStorage persistence
  const [cachedContractData, setCachedContractData] = useState<{
    roomTokenSupply?: bigint;
    currentSharePrice?: bigint;
    timestamp: number;
  } | null>(null);

  // Cache duration: 5 minutes for contract data that doesn't change often
  const CONTRACT_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Caching for quote calculations to reduce RPC calls
  const quoteCache = useMemo(
    () => new Map<string, { result: QuoteResult; timestamp: number }>(),
    [],
  );
  const CACHE_DURATION = 30000; // 30 seconds

  // Request deduplication cache
  const pendingRequests = useRef(new Map<string, Promise<QuoteResult>>());

  // Load cached data on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(`aces-contract-cache-${ACES_VAULT_ADDRESS}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CONTRACT_CACHE_DURATION) {
          setCachedContractData({
            roomTokenSupply: parsed.roomTokenSupply ? BigInt(parsed.roomTokenSupply) : undefined,
            currentSharePrice: parsed.currentSharePrice
              ? BigInt(parsed.currentSharePrice)
              : undefined,
            timestamp: parsed.timestamp,
          });
          console.log('📁 [ACES Contract] Loaded cached contract data', parsed);
        }
      }
    } catch (error) {
      console.warn('Failed to load cached contract data:', error);
    }
  }, [CONTRACT_CACHE_DURATION]);

  // Mathematical calculation for quadratic bonding curve
  const calculateSharesFromETH = useCallback(async (ethAmount: string): Promise<bigint> => {
    try {
      const ethWei = parseEther(ethAmount);

      // Get room configuration
      const roomConfig = await readContract(wagmiConfig, {
        address: ACES_VAULT_ADDRESS,
        abi: ACES_VAULT_ABI,
        functionName: 'rooms',
        args: [SHARES_SUBJECT_ADDRESS, ROOM_NUMBER],
      });

      const [curve, floor, midPoint, maxPrice, steepness, sharesSupply] = roomConfig;

      console.log('🎯 [Room Config]:', {
        curve: curve.toString(),
        floor: formatEther(floor),
        steepness: steepness.toString(),
        sharesSupply: sharesSupply.toString(),
        ethAmount,
      });

      // For quadratic curve (curve = 0), implement inverse formula
      if (curve === 0) {
        const result = calculateQuadraticInverse(ethWei, sharesSupply, steepness, floor);
        console.log('🧮 [Quadratic Calculation]:', {
          ethWei: formatEther(ethWei),
          estimatedShares: result.toString(),
        });
        return result;
      }

      // For other curves, fall back to estimation
      return ethWei / BigInt(1e15); // Rough estimate: 0.001 ETH per share
    } catch (error) {
      // Fallback to simple estimation
      return parseEther(ethAmount) / BigInt(1e15);
    }
  }, []);

  // Inverse quadratic formula - solve for shares given ETH amount
  const calculateQuadraticInverse = (
    ethWei: bigint,
    supply: bigint,
    steepness: bigint,
    floor: bigint,
  ): bigint => {
    const ethNumber = Number(formatEther(ethWei));
    const supplyNumber = Number(supply);
    const steepnessNumber = Number(steepness);
    const floorNumber = Number(formatEther(floor));

    // For quadratic bonding curve: Price = (summation * 1e18) / steepness + (floor * amount)
    // Where summation = sum2 - sum1, and sum_i = (i * (i+1) * (2i+1)) / 6

    // We need to solve for 'amount' given ethNumber
    // This is complex to solve analytically, so we use Newton's method for better approximation

    let amount = 1000; // Starting guess (1000 shares)
    const maxIterations = 20;
    const tolerance = 0.0001; // 0.01% tolerance

    for (let i = 0; i < maxIterations; i++) {
      // Calculate current price for this amount
      const sum1 = ((supplyNumber - 1) * supplyNumber * (2 * (supplyNumber - 1) + 1)) / 6;
      const sum2 =
        ((supplyNumber - 1 + amount) *
          (supplyNumber + amount) *
          (2 * (supplyNumber - 1 + amount) + 1)) /
        6;
      const summation = sum2 - sum1;
      const currentPrice = summation / steepnessNumber + floorNumber * amount;

      // Calculate derivative (rate of change)
      const nextAmount = amount + 1;
      const nextSum2 =
        ((supplyNumber - 1 + nextAmount) *
          (supplyNumber + nextAmount) *
          (2 * (supplyNumber - 1 + nextAmount) + 1)) /
        6;
      const nextSummation = nextSum2 - sum1;
      const nextPrice = nextSummation / steepnessNumber + floorNumber * nextAmount;
      const derivative = nextPrice - currentPrice;

      // Newton's method: x_new = x - f(x)/f'(x)
      const error = currentPrice - ethNumber;
      if (Math.abs(error) < tolerance) {
        break; // Converged
      }

      if (derivative === 0) {
        break; // Avoid division by zero
      }

      amount = Math.max(1, amount - error / derivative);
    }

    return BigInt(Math.floor(Math.max(1, amount)));
  };

  // Debug contract data with enhanced logging
  useEffect(() => {
    const debugData = {
      contractAddresses: {
        vault: ACES_VAULT_ADDRESS,
        token: ACES_TOKEN_ADDRESS,
        sharesSubject: SHARES_SUBJECT_ADDRESS,
        roomNumber: Number(ROOM_NUMBER),
      },
      liveData: {
        roomTokenSupply: roomTokenSupply?.toString(),
        currentSharePrice: currentSharePrice?.toString(),
        currentSharePriceETH: currentSharePrice ? formatEther(currentSharePrice) : 'N/A',
        userShareBalance: userShareBalance?.toString(),
        ethBalance: ethBalance?.formatted,
      },
      cachedData: {
        roomTokenSupply: cachedContractData?.roomTokenSupply?.toString(),
        currentSharePrice: cachedContractData?.currentSharePrice?.toString(),
        cacheAge: cachedContractData
          ? Math.round((Date.now() - cachedContractData.timestamp) / 1000) + 's'
          : 'none',
      },
      errors: {
        roomTokenSupplyError: roomTokenSupplyError?.message,
        currentSharePriceError: currentSharePriceError?.message,
      },
      loading: {
        roomTokenSupplyLoading,
        currentSharePriceLoading,
      },
      usingCache: !roomTokenSupply && cachedContractData?.roomTokenSupply ? true : false,
    };

    console.log('🔍 [ACES Contract Debug] Contract Data:', debugData);

    // Also log specific issues
    if (roomTokenSupplyError) {
      console.error('❌ [ACES Contract] Token Supply Error:', roomTokenSupplyError);
    }
    if (currentSharePriceError) {
      console.error('❌ [ACES Contract] Price Error:', currentSharePriceError);
    }
  }, [
    currentSharePrice,
    currentSharePriceError,
    currentSharePriceLoading,
    roomTokenSupply,
    roomTokenSupplyError,
    roomTokenSupplyLoading,
    userShareBalance,
    ethBalance,
    cachedContractData,
  ]);

  // Legacy approximation function (kept for backward compatibility)
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

  // Internal quote calculation logic
  const getQuoteInternal = useCallback(
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
        // NEW APPROACH: Calculate shares mathematically then verify with contract
        const estimatedShares = await calculateSharesFromETH(ethAmount);

        // Verify the estimate by getting the actual cost
        const exactCost = await readContract(wagmiConfig, {
          address: ACES_VAULT_ADDRESS,
          abi: ACES_VAULT_ABI,
          functionName: 'getBuyPriceAfterFee',
          args: [SHARES_SUBJECT_ADDRESS, ROOM_NUMBER, estimatedShares],
        });

        let bestShares = estimatedShares;
        let bestCost = exactCost;

        // If our estimate is too high, do a quick adjustment
        if (exactCost > ethAmountWei) {
          // Reduce shares proportionally
          const ratio = (ethAmountWei * BigInt(100)) / exactCost;
          const adjustedShares = (estimatedShares * ratio) / BigInt(100);

          try {
            const adjustedCost = await readContract(wagmiConfig, {
              address: ACES_VAULT_ADDRESS,
              abi: ACES_VAULT_ABI,
              functionName: 'getBuyPriceAfterFee',
              args: [SHARES_SUBJECT_ADDRESS, ROOM_NUMBER, adjustedShares],
            });

            if (adjustedCost <= ethAmountWei) {
              bestShares = adjustedShares;
              bestCost = adjustedCost;
            }
          } catch (error) {
            // Keep original estimate if adjustment fails
          }
        }

        const result = {
          tokensOut: bestShares,
          ethCost: bestCost,
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
        throw new Error('Failed to get price quote');
      }
    },
    [ready, authenticated, currentSharePrice, calculateSharesFromETH, quoteCache],
  );

  // Public getQuote function with request deduplication
  const getQuote = useCallback(
    async (ethAmount: string): Promise<QuoteResult> => {
      // DEDUPLICATION: Check for pending request
      const requestKey = `${ethAmount}`;
      const pendingRequest = pendingRequests.current.get(requestKey);

      if (pendingRequest) {
        console.log('Using pending request for', requestKey);
        return pendingRequest;
      }

      // Create new request
      const newRequest = getQuoteInternal(ethAmount);
      pendingRequests.current.set(requestKey, newRequest);

      try {
        const result = await newRequest;
        return result;
      } finally {
        // Clean up completed request
        pendingRequests.current.delete(requestKey);
      }
    },
    [getQuoteInternal],
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

  // Contract state - simplified memoization with cache fallback
  const contractState: BondingCurveState | undefined = useMemo(() => {
    // Use live data first, fall back to cached data
    const effectiveRoomTokenSupply = roomTokenSupply ?? cachedContractData?.roomTokenSupply;
    const effectiveCurrentSharePrice = currentSharePrice ?? cachedContractData?.currentSharePrice;

    // Check if we have the essential data (either live or cached)
    const hasEssentialData =
      effectiveRoomTokenSupply !== undefined && effectiveCurrentSharePrice !== undefined;

    // Define your intended maximum supply for the bonding curve launch
    const intendedMaxSupply = BigInt(1000000000) * BigInt(1e18); // 1B tokens intended max
    const bondingCurveMaxSupply = BigInt(800000000) * BigInt(1e18); // 800M available in bonding curve

    // Use effective data (live or cached) for calculations
    const currentRoomSupply = effectiveRoomTokenSupply || BigInt(0);
    const currentlyMinted = totalMintedSupply || effectiveRoomTokenSupply || BigInt(0);

    if (hasEssentialData) {
      // console.log('✅ [ACES Contract] Building contract state with:', {
      //   tokenSupply: currentRoomSupply.toString(),
      //   currentPrice: effectiveCurrentSharePrice?.toString(),
      //   priceInETH: effectiveCurrentSharePrice ? formatEther(effectiveCurrentSharePrice) : 'N/A',
      //   dataSource: roomTokenSupply ? 'live' : 'cached',
      // }
      // );

      return {
        tokenSupply: currentRoomSupply, // Shares in the vault room
        totalETHRaised: BigInt(0), // Can be calculated from events if needed
        currentPrice: effectiveCurrentSharePrice,
        progress:
          bondingCurveMaxSupply > 0
            ? BigInt(Math.floor((Number(currentlyMinted) / Number(bondingCurveMaxSupply)) * 100))
            : BigInt(0),
        maxSupply: intendedMaxSupply,
        bondingCurveSupply: bondingCurveMaxSupply,
        targetRaiseUSD: BigInt(100000) * BigInt(1e6), // $100K target
        basePrice: effectiveCurrentSharePrice,
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
    cachedContractData,
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
