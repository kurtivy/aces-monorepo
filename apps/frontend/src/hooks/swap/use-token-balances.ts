import { useState, useCallback, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { ERC20_ABI } from '@/lib/contracts/abi';
import { getDexTokenAddresses } from '@/lib/swap/constants';

type BalanceAsset = 'ACES' | 'TOKEN' | 'USDC' | 'USDT' | 'ETH';

interface UseTokenBalancesProps {
  acesContract: ethers.Contract | null;
  tokenContract: ethers.Contract | null;
  signer: ethers.Signer | null;
  factoryContract?: ethers.Contract | null;
  tokenAddress?: string;
  chainId?: number; // Add chainId to support network-specific token addresses
}

/**
 * Hook for managing token balance fetching and refresh logic
 * Handles ACES, target token, and stable coin balances
 * Auto-refreshes after transactions and provides manual refresh
 */
export function useTokenBalances({
  acesContract,
  tokenContract,
  signer,
  factoryContract,
  tokenAddress,
  chainId = 84532, // Default to Base Sepolia
}: UseTokenBalancesProps) {
  // Balance state
  const [acesBalance, setAcesBalance] = useState<string>('0');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [stableBalances, setStableBalances] = useState<{
    USDC: string;
    USDT: string;
    ETH: string;
  }>({
    USDC: '0',
    USDT: '0',
    ETH: '0',
  });

  // State
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Track in-flight requests to prevent duplicates
  const refreshingRef = useRef(false);

  // Get network-specific DEX token addresses
  const dexAddresses = getDexTokenAddresses(chainId);

  /**
   * Refresh a specific asset balance
   * @param asset - Asset to refresh
   */
  const refreshBalance = useCallback(
    async (asset: BalanceAsset): Promise<void> => {
      if (!signer) {
        console.log('[useTokenBalances] No signer available');
        return;
      }

      try {
        const address = await signer.getAddress();

        switch (asset) {
          case 'ACES': {
            if (!acesContract) return;
            const balance = await acesContract.balanceOf(address);
            const formatted = ethers.utils.formatEther(balance);
            setAcesBalance(formatted);
            break;
          }

          case 'TOKEN': {
            if (!tokenContract) return;
            const balance = await tokenContract.balanceOf(address);
            const formatted = ethers.utils.formatEther(balance);
            setTokenBalance(formatted);
            break;
          }

          case 'USDC': {
            const usdcAddress = dexAddresses.USDC;
            if (!usdcAddress || usdcAddress === '0') return;
            const contract = new ethers.Contract(usdcAddress, ERC20_ABI, signer);
            const balance = await contract.balanceOf(address);
            const formatted = ethers.utils.formatUnits(balance, 6);
            setStableBalances((prev) => ({ ...prev, USDC: formatted }));
            break;
          }

          case 'USDT': {
            const usdtAddress = dexAddresses.USDT;
            if (!usdtAddress || usdtAddress === '0') return;
            const contract = new ethers.Contract(usdtAddress, ERC20_ABI, signer);
            const balance = await contract.balanceOf(address);
            const formatted = ethers.utils.formatUnits(balance, 6);
            setStableBalances((prev) => ({ ...prev, USDT: formatted }));
            break;
          }

          case 'ETH': {
            const ethAddress = dexAddresses.WETH;
            if (!ethAddress || ethAddress === '0') return;
            const contract = new ethers.Contract(ethAddress, ERC20_ABI, signer);
            const balance = await contract.balanceOf(address);
            const formatted = ethers.utils.formatEther(balance);
            setStableBalances((prev) => ({ ...prev, ETH: formatted }));
            break;
          }
        }
      } catch (error) {
        console.error(`[useTokenBalances] Failed to refresh ${asset} balance:`, error);

        // For circuit breaker errors, keep last known state
        if (
          error &&
          typeof error === 'object' &&
          'message' in error &&
          typeof error.message === 'string' &&
          error.message.includes('circuit breaker')
        ) {
          console.log('[useTokenBalances] Circuit breaker active - keeping existing balance');
          return;
        }

        // For other errors, set error state
        setError(`Failed to fetch ${asset} balance`);
      }
    },
    [signer, acesContract, tokenContract, dexAddresses],
  );

  /**
   * Refresh all balances
   */
  const refreshBalances = useCallback(async (): Promise<void> => {
    if (refreshingRef.current) {
      console.log('[useTokenBalances] Refresh already in progress, skipping');
      return;
    }

    if (!signer) {
      console.log('[useTokenBalances] No signer available for balance refresh');
      return;
    }

    try {
      refreshingRef.current = true;
      setLoading(true);
      setError(null);

      console.log('[useTokenBalances] Refreshing all balances...');

      const address = await signer.getAddress();

      // Refresh ACES balance
      if (acesContract) {
        try {
          const acesBalanceValue = await acesContract.balanceOf(address);
          const formattedAcesBalance = ethers.utils.formatEther(acesBalanceValue);
          setAcesBalance(formattedAcesBalance);
        } catch (error) {
          console.error('[useTokenBalances] Failed to fetch ACES balance:', error);
          if (!isCircuitBreakerError(error)) {
            throw error;
          }
        }
      }

      // Refresh token balance
      if (tokenContract) {
        try {
          const tokenBalanceValue = await tokenContract.balanceOf(address);
          const formattedTokenBalance = ethers.utils.formatEther(tokenBalanceValue);
          setTokenBalance(formattedTokenBalance);
        } catch (error) {
          console.error('[useTokenBalances] Failed to fetch token balance:', error);
          if (!isCircuitBreakerError(error)) {
            throw error;
          }
        }
      }

      // Refresh stable balances
      try {
        const baseTokenConfigs = [
          { symbol: 'USDC', address: dexAddresses.USDC, decimals: 6 },
          { symbol: 'USDT', address: dexAddresses.USDT, decimals: 6 },
          { symbol: 'ETH', address: dexAddresses.WETH, decimals: 18 },
        ].filter((config) => config.address && config.address !== '0');

        if (baseTokenConfigs.length > 0) {
          const erc20Instances = baseTokenConfigs.map(
            (config) => new ethers.Contract(config.address, ERC20_ABI, signer),
          );

          const balances = await Promise.all(
            erc20Instances.map((contract) => contract.balanceOf(address)),
          );

          const formatted = baseTokenConfigs.reduce(
            (acc, config, index) => {
              const balanceValue = balances[index];
              acc[config.symbol as 'USDC' | 'USDT' | 'ETH'] = ethers.utils.formatUnits(
                balanceValue,
                config.decimals,
              );
              return acc;
            },
            { USDC: stableBalances.USDC, USDT: stableBalances.USDT, ETH: stableBalances.ETH },
          );

          setStableBalances(formatted);
        }
      } catch (error) {
        console.error('[useTokenBalances] Failed to refresh stable balances:', error);
        if (!isCircuitBreakerError(error)) {
          // Don't throw, just log - stable balances are non-critical
          console.warn('[useTokenBalances] Continuing despite stable balance error');
        }
      }

      // Try to fetch bonding curve remaining tokens
      if (factoryContract && tokenAddress && tokenContract) {
        try {
          const tokenInfo = await factoryContract.tokens(tokenAddress);
          const totalSupply = await tokenContract.totalSupply();
          const tokensBondedAt = tokenInfo.tokensBondedAt;

          // This data could be used elsewhere, but we're not storing it here
          // to keep this hook focused on balances
          console.log('[useTokenBalances] Bonding info fetched successfully');
        } catch (error) {
          // Silently ignore bonding curve errors - this is optional data
          console.debug('[useTokenBalances] Could not fetch bonding info:', error);
        }
      }

      setLastRefreshed(new Date());
      console.log('[useTokenBalances] ✅ Balance refresh complete');
    } catch (error) {
      console.error('[useTokenBalances] ❌ Failed to refresh balances:', error);

      // Circuit breaker errors: keep existing state
      if (isCircuitBreakerError(error)) {
        console.log('[useTokenBalances] Circuit breaker active - keeping existing balances');
        return;
      }

      // Other errors: handle cleanup if signer is stale
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error.code === 'UNSUPPORTED_OPERATION' || error.code === 'CALL_EXCEPTION')
      ) {
        console.log('[useTokenBalances] Signer no longer valid');
        setError('Wallet connection lost. Please reconnect.');
      } else {
        setError('Failed to refresh balances');
      }
    } finally {
      setLoading(false);
      refreshingRef.current = false;
    }
  }, [
    signer,
    acesContract,
    tokenContract,
    factoryContract,
    tokenAddress,
    stableBalances,
    dexAddresses,
  ]);

  /**
   * Auto-refresh balances when contracts become available
   */
  useEffect(() => {
    if (acesContract && signer) {
      refreshBalances();
    }
  }, [acesContract, signer]); // Intentionally minimal deps to avoid excessive refreshes

  return {
    // Balances (formatted strings)
    acesBalance,
    tokenBalance,
    stableBalances,

    // State
    loading,
    error,
    lastRefreshed,

    // Actions
    refreshBalances,
    refreshBalance,
  };
}

/**
 * Helper to check if error is a circuit breaker error
 */
function isCircuitBreakerError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.includes('circuit breaker')
  );
}
