import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import type { QuoteState } from '@/lib/bonding-curve/aces-quote';
import { W } from '@/lib/bonding-curve/aces-quote';

interface UseBondingCurveStateProps {
  factoryContract: ethers.Contract | null;
  tokenContract: ethers.Contract | null;
  tokenAddress?: string;
  enabled?: boolean;
}

interface BondingCurveStateResult {
  quoteState: QuoteState | null;
  loading: boolean;
  error: string | null;
  refreshState: () => Promise<void>;
}

/**
 * Hook to fetch on-chain bonding curve parameters for quote calculations
 *
 * Fetches:
 * - Current token supply
 * - Bonding curve parameters (steepness, floor)
 * - Fee percentages
 * - Bonding status and limits
 */
export function useBondingCurveState({
  factoryContract,
  tokenContract,
  tokenAddress,
  enabled = true,
}: UseBondingCurveStateProps): BondingCurveStateResult {
  const [quoteState, setQuoteState] = useState<QuoteState | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBondingCurveState = useCallback(async () => {
    if (!enabled || !factoryContract || !tokenContract || !tokenAddress) {
      setQuoteState(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch all required data in parallel
      const [tokenInfo, totalSupply, maxSupply, protocolFeePercent, subjectFeePercent] =
        await Promise.all([
          factoryContract.tokens(tokenAddress),
          tokenContract.totalSupply(),
          tokenContract.MAX_TOTAL_SUPPLY
            ? tokenContract.MAX_TOTAL_SUPPLY()
            : ethers.BigNumber.from('1000000000').mul(W.toString()),
          factoryContract.protocolFeePercent(),
          factoryContract.subjectFeePercent(),
        ]);

      // Parse the token info struct
      const state: QuoteState = {
        supply: BigInt(totalSupply.toString()),
        steepness: BigInt(tokenInfo.steepness.toString()),
        floor: BigInt(tokenInfo.floor.toString()),
        protocolFeePercent: BigInt(protocolFeePercent.toString()),
        subjectFeePercent: BigInt(subjectFeePercent.toString()),
        tokenBonded: tokenInfo.tokenBonded,
        tokensBondedAt: BigInt(tokenInfo.tokensBondedAt.toString()),
        launchpadMaxSupply: BigInt(maxSupply.toString()),
        lpAmount: BigInt(tokenInfo.lpAmount?.toString() || '0'),
      };

      setQuoteState(state);

      console.log('[useBondingCurveState] State fetched:', {
        supply: (Number(state.supply) / 1e18).toFixed(0),
        steepness: state.steepness.toString(),
        floor: state.floor.toString(),
        protocolFee: ((Number(state.protocolFeePercent) / 1e18) * 100).toFixed(2) + '%',
        subjectFee: ((Number(state.subjectFeePercent) / 1e18) * 100).toFixed(2) + '%',
        tokenBonded: state.tokenBonded,
        tokensBondedAt: (Number(state.tokensBondedAt) / 1e18).toFixed(0),
      });
    } catch (err) {
      console.error('[useBondingCurveState] Failed to fetch state:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch bonding curve state');
      setQuoteState(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, factoryContract, tokenContract, tokenAddress]);

  // Fetch state when dependencies change
  useEffect(() => {
    fetchBondingCurveState();
  }, [fetchBondingCurveState]);

  return {
    quoteState,
    loading,
    error,
    refreshState: fetchBondingCurveState,
  };
}

