import { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { ACES_SWAP_ABI } from '@/lib/contracts/abi/aces-swap';
import type { TransactionResult } from '@/lib/swap/types';

// Placeholder address - will be updated once contract is deployed
const ACES_SWAP_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ACES_SWAP_CONTRACT || '';

interface UseAcesSwapContractProps {
  signer: ethers.Signer | null;
  walletAddress: string | null;
}

/**
 * Hook for USDT/USDC → ACES → LaunchpadToken multi-hop swaps
 * Handles interaction with the AcesSwap contract
 * Gracefully handles when contract is not deployed
 */
export function useAcesSwapContract({ signer, walletAddress }: UseAcesSwapContractProps) {
  // Contract state
  const [acesSwapContract, setAcesSwapContract] = useState<ethers.Contract | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [loading, setLoading] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  /**
   * Check if contract is deployed and configured
   */
  const isDeployed = useMemo(() => {
    return Boolean(
      ACES_SWAP_CONTRACT_ADDRESS && ethers.utils.isAddress(ACES_SWAP_CONTRACT_ADDRESS),
    );
  }, []);

  /**
   * Initialize contract when signer is available
   */
  useEffect(() => {
    if (!signer || !isDeployed) {
      setAcesSwapContract(null);
      return;
    }

    try {
      const contract = new ethers.Contract(ACES_SWAP_CONTRACT_ADDRESS, ACES_SWAP_ABI, signer);
      setAcesSwapContract(contract);
      console.log('[useAcesSwapContract] Contract initialized:', ACES_SWAP_CONTRACT_ADDRESS);
    } catch (error) {
      console.error('[useAcesSwapContract] Failed to initialize contract:', error);
      setAcesSwapContract(null);
      setError('Failed to initialize swap contract');
    }
  }, [signer, isDeployed]);

  /**
   * Swap USDT for LaunchpadToken
   * Flow: USDT → WETH → ACES → LaunchpadToken
   */
  const swapUSDTForToken = useCallback(
    async (params: {
      amountIn: string;
      tokenAddress: string;
      launchpadTokenAmount: string;
    }): Promise<TransactionResult> => {
      const { amountIn, tokenAddress, launchpadTokenAmount } = params;

      if (!acesSwapContract || !isDeployed) {
        return {
          success: false,
          error: 'AcesSwap contract not deployed yet. This feature will be available soon.',
        };
      }

      if (isPaused) {
        return {
          success: false,
          error: 'Contract is currently paused. Please try again later.',
        };
      }

      try {
        setLoading('Preparing USDT swap...');
        setError(null);

        console.log('[useAcesSwapContract] Swapping USDT for token...', {
          amountIn,
          tokenAddress,
          launchpadTokenAmount,
        });

        // Convert amounts to BigNumber (USDT has 6 decimals)
        const amountInWei = ethers.utils.parseUnits(amountIn, 6);
        const launchpadAmountWei = ethers.utils.parseUnits(launchpadTokenAmount, 18);

        setLoading('Confirming transaction...');

        const tx = await acesSwapContract.sellUSDTAndBuyLaunchpadToken(
          amountInWei,
          tokenAddress,
          launchpadAmountWei,
        );

        setLoading('Waiting for confirmation...');
        console.log('[useAcesSwapContract] Transaction sent:', tx.hash);

        const receipt = await tx.wait();
        console.log('[useAcesSwapContract] ✅ USDT swap confirmed');

        setLoading('');

        return {
          success: true,
          hash: tx.hash,
          receipt,
        };
      } catch (error) {
        console.error('[useAcesSwapContract] ❌ USDT swap failed:', error);

        let errorMessage = 'USDT swap failed';

        if (error instanceof Error) {
          if (error.message.includes('user rejected') || error.message.includes('user denied')) {
            errorMessage = 'Transaction was rejected by user';
          } else if (error.message.includes('paused')) {
            errorMessage = 'Contract is currently paused';
            setIsPaused(true);
          } else {
            errorMessage = error.message;
          }
        }

        setError(errorMessage);
        setLoading('');

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    [acesSwapContract, isDeployed, isPaused],
  );

  /**
   * Swap USDC for LaunchpadToken
   * Flow: USDC → WETH → ACES → LaunchpadToken
   */
  const swapUSDCForToken = useCallback(
    async (params: {
      amountIn: string;
      tokenAddress: string;
      launchpadTokenAmount: string;
    }): Promise<TransactionResult> => {
      const { amountIn, tokenAddress, launchpadTokenAmount } = params;

      if (!acesSwapContract || !isDeployed) {
        return {
          success: false,
          error: 'AcesSwap contract not deployed yet. This feature will be available soon.',
        };
      }

      if (isPaused) {
        return {
          success: false,
          error: 'Contract is currently paused. Please try again later.',
        };
      }

      try {
        setLoading('Preparing USDC swap...');
        setError(null);

        console.log('[useAcesSwapContract] Swapping USDC for token...', {
          amountIn,
          tokenAddress,
          launchpadTokenAmount,
        });

        // Convert amounts to BigNumber (USDC has 6 decimals)
        const amountInWei = ethers.utils.parseUnits(amountIn, 6);
        const launchpadAmountWei = ethers.utils.parseUnits(launchpadTokenAmount, 18);

        setLoading('Confirming transaction...');

        const tx = await acesSwapContract.sellUSDCAndBuyLaunchpadToken(
          amountInWei,
          tokenAddress,
          launchpadAmountWei,
        );

        setLoading('Waiting for confirmation...');
        console.log('[useAcesSwapContract] Transaction sent:', tx.hash);

        const receipt = await tx.wait();
        console.log('[useAcesSwapContract] ✅ USDC swap confirmed');

        setLoading('');

        return {
          success: true,
          hash: tx.hash,
          receipt,
        };
      } catch (error) {
        console.error('[useAcesSwapContract] ❌ USDC swap failed:', error);

        let errorMessage = 'USDC swap failed';

        if (error instanceof Error) {
          if (error.message.includes('user rejected') || error.message.includes('user denied')) {
            errorMessage = 'Transaction was rejected by user';
          } else if (error.message.includes('paused')) {
            errorMessage = 'Contract is currently paused';
            setIsPaused(true);
          } else {
            errorMessage = error.message;
          }
        }

        setError(errorMessage);
        setLoading('');

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    [acesSwapContract, isDeployed, isPaused],
  );

  return {
    // Contract
    acesSwapContract,
    isReady: Boolean(acesSwapContract && isDeployed),
    isDeployed,

    // Actions
    swapUSDTForToken,
    swapUSDCForToken,

    // State
    loading,
    error,
    isPaused,
  };
}
