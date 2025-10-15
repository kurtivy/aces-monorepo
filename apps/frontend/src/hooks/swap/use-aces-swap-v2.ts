import { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import type { TransactionResult } from '@/lib/swap/types';
import { getContractAddresses } from '@/lib/contracts/addresses';
import { ACES_SWAP_NEW_ABI } from '@/lib/contracts/abi';

interface UseAcesSwapV2Props {
  signer: ethers.Signer | null;
  walletAddress: string | null;
}

/**
 * Hook for ETH/USDC/USDT → ACES → LaunchpadToken multi-hop swaps using AcesSwapNew
 * - Selects the correct contract address by chain (Base mainnet only)
 * - Exposes helpers for each supported input asset
 */
export function useAcesSwapV2({ signer, walletAddress }: UseAcesSwapV2Props) {
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [swapAddress, setSwapAddress] = useState<string>('');
  const [loading, setLoading] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const isDeployed = useMemo(
    () => Boolean(swapAddress && ethers.utils.isAddress(swapAddress)),
    [swapAddress],
  );

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        setError(null);
        if (!signer) {
          setContract(null);
          return;
        }

        const network = await signer.provider?.getNetwork();
        const chainId = Number(network?.chainId || 0);

        // Resolve address by chain
        const addresses = getContractAddresses(chainId || 8453);
        const addr = (addresses as Record<string, string>).ACES_SWAP || '';
        if (!addr) {
          setContract(null);
          setSwapAddress('');
          return;
        }

        const c = new ethers.Contract(addr, ACES_SWAP_NEW_ABI as any, signer);
        if (!mounted) return;
        setSwapAddress(addr);
        setContract(c);
        // console.log('[useAcesSwapV2] Initialized at', addr, 'chainId', chainId);
      } catch (e) {
        if (!mounted) return;
        setContract(null);
        setSwapAddress('');
        setError('Failed to initialize AcesSwapNew');
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, [signer]);

  const swapUSDTForToken = useCallback(
    async (params: {
      amountIn: string; // decimal string (6 decimals)
      tokenAddress: string;
      launchpadTokenAmount: string; // decimal string (18 decimals)
    }): Promise<TransactionResult> => {
      const { amountIn, tokenAddress, launchpadTokenAmount } = params;
      if (!contract || !isDeployed) {
        return { success: false, error: 'Swap contract unavailable' };
      }
      try {
        setLoading('Requesting USDT swap...');
        setError(null);
        const amountInWei = ethers.utils.parseUnits(amountIn, 6);
        const amountTokenWei = ethers.utils.parseUnits(launchpadTokenAmount, 18);
        const tx = await contract.sellUSDTAndBuyLaunchpadToken(
          amountInWei,
          tokenAddress,
          amountTokenWei,
        );
        setLoading('Confirming...');
        const receipt = await tx.wait();
        setLoading('');
        return { success: true, hash: tx.hash, receipt };
      } catch (e) {
        setLoading('');
        const message = e instanceof Error ? e.message : 'USDT swap failed';
        setError(message);
        return { success: false, error: message };
      }
    },
    [contract, isDeployed],
  );

  const swapUSDCForToken = useCallback(
    async (params: {
      amountIn: string; // decimal string (6 decimals)
      tokenAddress: string;
      launchpadTokenAmount: string; // decimal string (18 decimals)
    }): Promise<TransactionResult> => {
      const { amountIn, tokenAddress, launchpadTokenAmount } = params;
      if (!contract || !isDeployed) {
        return { success: false, error: 'Swap contract unavailable' };
      }
      try {
        setLoading('Requesting USDC swap...');
        setError(null);
        const amountInWei = ethers.utils.parseUnits(amountIn, 6);
        const amountTokenWei = ethers.utils.parseUnits(launchpadTokenAmount, 18);
        const tx = await contract.sellUSDCAndBuyLaunchpadToken(
          amountInWei,
          tokenAddress,
          amountTokenWei,
        );
        setLoading('Confirming...');
        const receipt = await tx.wait();
        setLoading('');
        return { success: true, hash: tx.hash, receipt };
      } catch (e) {
        setLoading('');
        const message = e instanceof Error ? e.message : 'USDC swap failed';
        setError(message);
        return { success: false, error: message };
      }
    },
    [contract, isDeployed],
  );

  const swapETHForToken = useCallback(
    async (params: {
      ethAmountIn: string; // decimal string (18 decimals)
      tokenAddress: string;
      launchpadTokenAmount: string; // decimal string (18 decimals)
    }): Promise<TransactionResult> => {
      const { ethAmountIn, tokenAddress, launchpadTokenAmount } = params;
      if (!contract || !isDeployed) {
        return { success: false, error: 'Swap contract unavailable' };
      }
      try {
        setLoading('Requesting ETH swap...');
        setError(null);
        const valueWei = ethers.utils.parseUnits(ethAmountIn, 18);
        const amountTokenWei = ethers.utils.parseUnits(launchpadTokenAmount, 18);
        const tx = await contract.sellEthAndBuyLaunchpadToken(tokenAddress, amountTokenWei, {
          value: valueWei,
        });
        setLoading('Confirming...');
        const receipt = await tx.wait();
        setLoading('');
        return { success: true, hash: tx.hash, receipt };
      } catch (e) {
        setLoading('');
        const message = e instanceof Error ? e.message : 'ETH swap failed';
        setError(message);
        return { success: false, error: message };
      }
    },
    [contract, isDeployed],
  );

  return {
    contract,
    swapAddress,
    isReady: Boolean(contract && isDeployed && walletAddress),
    isDeployed,
    swapUSDTForToken,
    swapUSDCForToken,
    swapETHForToken,
    loading,
    error,
  };
}
