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

  // Fee information (static data)
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

  // Token metadata - removed since we're not using ERC20 contract calls
  const name = 'ACES';
  const symbol = 'ACES';

  // Total minted tokens (for progression bar) - removed ERC20 call
  // We'll use room token supply for now since we don't need separate ERC20 tracking
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

  // Log fee data for debugging
  useEffect(() => {
    // Fee data loaded - no logging needed
  }, [protocolFeePercent, subjectFeePercent]);

  // SIMPLIFIED QUOTE FUNCTION - ETH-based, using contract pricing
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

      try {
        // If we don't have a current share price, return zeros
        if (!currentSharePrice || currentSharePrice === BigInt(0)) {
          return {
            tokensOut: BigInt(0),
            ethCost: BigInt(0),
            shareCount: BigInt(0),
          };
        }

        // Estimate how many shares we can buy with this ETH amount
        // This is an approximation - we'll use binary search for exact amount
        const estimatedShares = ethAmountWei / currentSharePrice;

        // Binary search to find exact share count within ETH budget
        let low = BigInt(1);
        let high = estimatedShares * BigInt(2); // Search up to 2x estimated
        let bestShares = BigInt(0);
        let bestCost = BigInt(0);

        // Cap the search to prevent infinite loops
        const maxIterations = 50;
        let iterations = 0;

        while (low <= high && iterations < maxIterations) {
          const mid = (low + high) / BigInt(2);

          try {
            // Get exact cost from contract for this many shares
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
            high = mid - BigInt(1);
          }

          iterations++;
        }

        if (bestShares === BigInt(0)) {
          return {
            tokensOut: BigInt(0),
            ethCost: BigInt(0),
            shareCount: BigInt(0),
          };
        }

        // Tokens are minted as shares * 1e18 (from contract buyShares function)
        const tokensOut = bestShares * BigInt(1e18);

        return {
          tokensOut,
          ethCost: bestCost,
          shareCount: bestShares,
        };
      } catch (error) {
        throw new Error('Failed to get price quote');
      }
    },
    [ready, authenticated, currentSharePrice],
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
        const exactCost = await readContract(wagmiConfig, {
          address: ACES_VAULT_ADDRESS,
          abi: ACES_VAULT_ABI,
          functionName: 'getBuyPriceAfterFee',
          args: [SHARES_SUBJECT_ADDRESS, ROOM_NUMBER, shareCount],
        });

        // Use the higher of the two costs to be safe
        const finalCost = ethCost > exactCost ? ethCost : exactCost;

        const hash = await writeContractAsync({
          address: ACES_VAULT_ADDRESS,
          abi: ACES_VAULT_ABI,
          functionName: 'buyShares',
          args: [SHARES_SUBJECT_ADDRESS, ROOM_NUMBER, shareCount],
          value: finalCost,
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
