import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';

const ERC20_ABI = ['function allowance(address owner, address spender) view returns (uint256)'];

/**
 * Truncates a number string to a maximum number of decimal places
 * This prevents "fractional component exceeds decimals" errors
 */
function truncateToDecimals(value: string, decimals: number): string {
  if (!value.includes('.')) {
    return value;
  }

  const [integer, fractional] = value.split('.');
  if (fractional.length <= decimals) {
    return value;
  }

  return `${integer}.${fractional.slice(0, decimals)}`;
}

interface UseTokenAllowanceProps {
  tokenAddress: string | null;
  ownerAddress: string | null;
  spenderAddress: string | null;
  signer: ethers.Signer | null;
  enabled?: boolean;
}

export interface TokenAllowanceResult {
  allowance: bigint;
  hasAllowance: (amount: string, decimals: number) => boolean;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to check token allowance for DEX swaps
 * Returns current allowance and helper to check if sufficient
 */
export function useTokenAllowance({
  tokenAddress,
  ownerAddress,
  spenderAddress,
  signer,
  enabled = true,
}: UseTokenAllowanceProps): TokenAllowanceResult {
  const [allowance, setAllowance] = useState<bigint>(BigInt(0));
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllowance = useCallback(async () => {
    if (!enabled || !tokenAddress || !ownerAddress || !spenderAddress || !signer) {
      setAllowance(BigInt(0));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const erc20Contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const allowanceBN = await erc20Contract.allowance(ownerAddress, spenderAddress);

      setAllowance(BigInt(allowanceBN.toString()));
    } catch (err: any) {
      console.error('[useTokenAllowance] Error fetching allowance:', err);
      setError(err.message || 'Failed to fetch allowance');
      setAllowance(BigInt(0));
    } finally {
      setLoading(false);
    }
  }, [enabled, tokenAddress, ownerAddress, spenderAddress, signer]);

  // Check if current allowance is sufficient for a given amount
  const hasAllowance = useCallback(
    (amount: string, decimals: number): boolean => {
      if (!amount || amount === '0') {
        return true; // No approval needed for 0 amount
      }

      try {
        // Truncate amount to match token decimals to avoid "fractional component exceeds decimals" error
        const truncatedAmount = truncateToDecimals(amount, decimals);
        const requiredAmount = ethers.utils.parseUnits(truncatedAmount, decimals);
        return allowance >= BigInt(requiredAmount.toString());
      } catch (err) {
        console.error('[useTokenAllowance] Error checking allowance:', err);
        return false;
      }
    },
    [allowance],
  );

  // Fetch allowance on mount and when dependencies change
  useEffect(() => {
    fetchAllowance();
  }, [fetchAllowance]);

  return {
    allowance,
    hasAllowance,
    loading,
    error,
    refetch: fetchAllowance,
  };
}
