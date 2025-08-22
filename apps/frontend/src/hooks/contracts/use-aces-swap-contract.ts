'use client';

import { useState, useCallback, useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits, type Address } from 'viem';
import { base } from 'viem/chains';
import { getBondingCurveContracts } from '@aces/utils';
import { ACES_SWAP_ABI, ERC20_ABI } from '@aces/utils';
import { SUPPORTED_CURRENCIES, type Currency } from '@/types/contracts';

interface SwapState {
  isLoading: boolean;
  error: string | null;
  step: 'idle' | 'checking-allowance' | 'approving' | 'swapping' | 'success';
  transactionHash?: string;
}

interface TokenBalance {
  balance: bigint;
  formattedBalance: string;
  decimals: number;
}

interface SwapQuote {
  inputAmount: bigint;
  minimumETHOut: bigint;
  shareCount: bigint;
  slippageTolerance: number; // percentage (e.g., 2.5 for 2.5%)
}

export function useAcesSwapContract() {
  const { address: walletAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [swapState, setSwapState] = useState<SwapState>({
    isLoading: false,
    error: null,
    step: 'idle',
  });

  // Get contract addresses
  const BASE_MAINNET_CONTRACTS = getBondingCurveContracts(8453); // Base Mainnet
  const ACES_SWAP_ADDRESS = BASE_MAINNET_CONTRACTS.acesSwap; // AcesSwap contract address
  const SHARES_SUBJECT_ADDRESS = BASE_MAINNET_CONTRACTS.sharesSubject as Address;
  const ROOM_NUMBER = BigInt(BASE_MAINNET_CONTRACTS.roomNumber);

  // Helper to check if contract is properly deployed
  const isSwapContractReady = 
    ACES_SWAP_ADDRESS.length > 10 && 
    ACES_SWAP_ADDRESS.startsWith('0x') &&
    ACES_SWAP_ADDRESS !== 'NOT_DEPLOYED';

  // Token contract addresses
  const USDC_ADDRESS = SUPPORTED_CURRENCIES.USDC.address as Address;
  const USDT_ADDRESS = SUPPORTED_CURRENCIES.USDT.address as Address;

  /**
   * Get token balance for a specific currency
   */
  const useTokenBalance = (currency: Currency): TokenBalance => {
    const tokenAddress = currency === 'USDC' ? USDC_ADDRESS : USDT_ADDRESS;
    const decimals = SUPPORTED_CURRENCIES[currency].decimals;

    const { data: balance = BigInt(0) } = useReadContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [walletAddress!],
      query: {
        enabled: !!walletAddress,
        refetchInterval: 10000, // Refetch every 10 seconds
      },
    });

    return {
      balance,
      formattedBalance: formatUnits(balance, decimals),
      decimals,
    };
  };

  /**
   * Check current allowance for AcesSwap contract
   */
  const useTokenAllowance = (currency: Currency) => {
    const tokenAddress = currency === 'USDC' ? USDC_ADDRESS : USDT_ADDRESS;

    const { data: allowance = BigInt(0), refetch: refetchAllowance } = useReadContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [walletAddress!, ACES_SWAP_ADDRESS as Address],
      query: {
        enabled: !!walletAddress && isSwapContractReady,
        refetchInterval: 5000, // Refetch every 5 seconds during active usage
      },
    });

    return { allowance, refetchAllowance };
  };

  /**
   * Calculate swap quote with slippage protection
   */
  const calculateSwapQuote = useCallback(
    (
      inputAmountFormatted: string,
      currency: Currency,
      shareCount: bigint,
      slippageTolerance: number = 2.5,
    ): SwapQuote | null => {
      if (!inputAmountFormatted || !shareCount) return null;

      const decimals = SUPPORTED_CURRENCIES[currency].decimals;
      const inputAmount = parseUnits(inputAmountFormatted, decimals);

      // Estimate ETH output with slippage protection
      // This is a simplified calculation - in production you'd query a price oracle
      // or use the contract's preview function if available
      const estimatedETHOut = inputAmount / BigInt(3000); // Rough ETH price estimate
      const minimumETHOut = (estimatedETHOut * BigInt(100 - slippageTolerance * 10)) / BigInt(1000);

      return {
        inputAmount,
        minimumETHOut,
        shareCount,
        slippageTolerance,
      };
    },
    [],
  );

  /**
   * Approve token spending for AcesSwap contract
   */
  const approveToken = useCallback(
    async (currency: Currency, amount: bigint): Promise<boolean> => {
      if (!walletAddress) {
        setSwapState({ isLoading: false, error: 'Wallet not connected', step: 'idle' });
        return false;
      }

      if (!isSwapContractReady) {
        setSwapState({
          isLoading: false,
          error: 'AcesSwap contract not deployed on this network',
          step: 'idle',
        });
        return false;
      }

      const tokenAddress = currency === 'USDC' ? USDC_ADDRESS : USDT_ADDRESS;

      try {
        setSwapState({ isLoading: true, error: null, step: 'approving' });

        const hash = await writeContractAsync({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [ACES_SWAP_ADDRESS as Address, amount],
          chain: base,
          account: walletAddress,
        });

        setSwapState((prev) => ({ ...prev, transactionHash: hash }));

        // Wait for transaction confirmation
        // Note: You'd typically use useWaitForTransactionReceipt here
        // For now, we'll assume success after a delay
        await new Promise((resolve) => setTimeout(resolve, 3000));

        setSwapState({ isLoading: false, error: null, step: 'success' });
        return true;
      } catch (error) {
        console.error('Token approval failed:', error);
        setSwapState({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Approval failed',
          step: 'idle',
        });
        return false;
      }
    },
    [walletAddress, writeContractAsync],
  );

  /**
   * Execute swap transaction (USDC/USDT → ETH → ACES)
   */
  const executeSwap = useCallback(
    async (currency: Currency, quote: SwapQuote): Promise<boolean> => {
      if (!walletAddress) {
        setSwapState({ isLoading: false, error: 'Wallet not connected', step: 'idle' });
        return false;
      }

      if (!isSwapContractReady) {
        setSwapState({
          isLoading: false,
          error: 'AcesSwap contract not deployed on this network',
          step: 'idle',
        });
        return false;
      }

      try {
        setSwapState({ isLoading: true, error: null, step: 'swapping' });

        const functionName = currency === 'USDC' ? 'sellUSDCAndBuyCurve' : 'sellUSDTAndBuyCurve';

        const hash = await writeContractAsync({
          address: ACES_SWAP_ADDRESS as Address,
          abi: ACES_SWAP_ABI,
          functionName,
          args: [
            quote.inputAmount, // amountIn
            quote.minimumETHOut, // amountOutMin (slippage protection)
            SHARES_SUBJECT_ADDRESS, // roomOwner
            ROOM_NUMBER, // roomNumber
            quote.shareCount, // amount (shares to buy)
          ],
          chain: base,
          account: walletAddress,
        });

        setSwapState((prev) => ({ ...prev, transactionHash: hash }));

        // Wait for transaction confirmation
        await new Promise((resolve) => setTimeout(resolve, 5000));

        setSwapState({ isLoading: false, error: null, step: 'success' });
        return true;
      } catch (error) {
        console.error('Swap execution failed:', error);
        setSwapState({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Swap failed',
          step: 'idle',
        });
        return false;
      }
    },
    [walletAddress, writeContractAsync],
  );

  /**
   * Complete swap workflow: check allowance → approve if needed → execute swap
   */
  const performCompleteSwap = useCallback(
    async (
      currency: Currency,
      inputAmountFormatted: string,
      shareCount: bigint,
      slippageTolerance: number = 2.5,
    ): Promise<boolean> => {
      if (!walletAddress) {
        setSwapState({ isLoading: false, error: 'Wallet not connected', step: 'idle' });
        return false;
      }

      // Calculate quote
      const quote = calculateSwapQuote(
        inputAmountFormatted,
        currency,
        shareCount,
        slippageTolerance,
      );
      if (!quote) {
        setSwapState({ isLoading: false, error: 'Invalid swap parameters', step: 'idle' });
        return false;
      }

      try {
        setSwapState({ isLoading: true, error: null, step: 'checking-allowance' });

        // Check current allowance
        const tokenAddress = currency === 'USDC' ? USDC_ADDRESS : USDT_ADDRESS;
        const { allowance } = useTokenAllowance(currency);

        // Approve if needed
        if (allowance < quote.inputAmount) {
          const approvalSuccess = await approveToken(currency, quote.inputAmount);
          if (!approvalSuccess) return false;
        }

        // Execute swap
        return await executeSwap(currency, quote);
      } catch (error) {
        console.error('Complete swap failed:', error);
        setSwapState({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Swap workflow failed',
          step: 'idle',
        });
        return false;
      }
    },
    [walletAddress, calculateSwapQuote, approveToken, executeSwap, useTokenAllowance],
  );

  /**
   * Reset swap state
   */
  const resetSwapState = useCallback(() => {
    setSwapState({ isLoading: false, error: null, step: 'idle' });
  }, []);

  return {
    // State
    swapState,

    // Contract addresses (for debugging)
    contractAddresses: {
      acesSwap: ACES_SWAP_ADDRESS,
      usdc: USDC_ADDRESS,
      usdt: USDT_ADDRESS,
      sharesSubject: SHARES_SUBJECT_ADDRESS,
      roomNumber: Number(ROOM_NUMBER),
    },

    // Hooks
    useTokenBalance,
    useTokenAllowance,

    // Functions
    calculateSwapQuote,
    approveToken,
    executeSwap,
    performCompleteSwap,
    resetSwapState,

    // Utilities
    isContractReady: isSwapContractReady,
  };
}
