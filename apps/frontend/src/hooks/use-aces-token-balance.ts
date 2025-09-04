'use client';

import { useBalance, useReadContract } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { formatUnits } from 'viem';
import { ERC20_ABI } from '@aces/utils';

// Extended ERC20 ABI to include name and symbol functions
const EXTENDED_ERC20_ABI = [
  ...ERC20_ABI,
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
] as const;

// ACES Token contract address on Base Mainnet
const ACES_TOKEN_ADDRESS = '0x55337650856299363c496065C836B9C6E9dE0367' as const;

export interface AcesTokenData {
  address: string;
  balance: bigint;
  formattedBalance: string;
  decimals: number;
  symbol: string;
  name: string;
  usdValue?: number;
  isLoading: boolean;
  error: Error | null;
}

export function useAcesTokenBalance() {
  const { user, authenticated, ready } = usePrivy();
  const walletAddress = user?.wallet?.address as `0x${string}` | undefined;

  // Get ACES token balance
  const {
    data: balanceData,
    isLoading: balanceLoading,
    error: balanceError,
    refetch: refetchBalance,
  } = useBalance({
    address: walletAddress,
    token: ACES_TOKEN_ADDRESS,
    query: {
      enabled: ready && authenticated && !!walletAddress,
      refetchInterval: 30000, // Refetch every 30 seconds
      staleTime: 10000, // Consider data stale after 10 seconds
    },
  });

  // Get token metadata (symbol, name, decimals)
  const {
    data: symbol,
    isLoading: symbolLoading,
    error: symbolError,
  } = useReadContract({
    address: ACES_TOKEN_ADDRESS,
    abi: EXTENDED_ERC20_ABI,
    functionName: 'symbol',
    query: {
      enabled: true,
      staleTime: Infinity, // Symbol never changes
      gcTime: Infinity, // Keep in cache forever
    },
  });

  const {
    data: name,
    isLoading: nameLoading,
    error: nameError,
  } = useReadContract({
    address: ACES_TOKEN_ADDRESS,
    abi: EXTENDED_ERC20_ABI,
    functionName: 'name',
    query: {
      enabled: true,
      staleTime: Infinity, // Name never changes
      gcTime: Infinity, // Keep in cache forever
    },
  });

  const {
    data: decimals,
    isLoading: decimalsLoading,
    error: decimalsError,
  } = useReadContract({
    address: ACES_TOKEN_ADDRESS,
    abi: EXTENDED_ERC20_ABI,
    functionName: 'decimals',
    query: {
      enabled: true,
      staleTime: Infinity, // Decimals never change
      gcTime: Infinity, // Keep in cache forever
    },
  });

  // Determine loading state
  const isLoading = balanceLoading || symbolLoading || nameLoading || decimalsLoading;

  // Determine error state
  const error = balanceError || symbolError || nameError || decimalsError;

  // Format the balance
  const balance = balanceData?.value ?? BigInt(0);
  const tokenDecimals = decimals ?? 18;
  const formattedBalance = formatUnits(balance, tokenDecimals);

  // Check if user has any ACES tokens
  const hasTokens = balance > BigInt(0);

  // Create token data object
  const tokenData: AcesTokenData = {
    address: ACES_TOKEN_ADDRESS,
    balance,
    formattedBalance,
    decimals: tokenDecimals,
    symbol: symbol ?? 'ACES',
    name: name ?? 'ACES Token',
    isLoading,
    error: error as Error | null,
  };

  return {
    tokenData,
    hasTokens,
    isLoading,
    error,
    refetchBalance,
    // Wallet connection status
    isWalletConnected: ready && authenticated && !!walletAddress,
    walletAddress,
  };
}
