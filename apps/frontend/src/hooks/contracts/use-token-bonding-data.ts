'use client';

import { useMemo } from 'react';
import { useBondingDataContext } from '@/contexts/bonding-data-context';

const BASE_MAINNET_CHAIN_ID = 8453;

interface BondingData {
  // Raw contract data
  curve: number;
  currentSupply: string; // In ether (e.g., "22320.83")
  tokensBondedAt: string; // In ether (e.g., "30000000")
  acesBalance: string; // In ether
  floorWei: string;
  floorPriceACES: string;
  steepness: string;
  isBonded: boolean;

  // Calculated values
  bondingPercentage: number; // 0-100

  // Loading state
  loading: boolean;
  error: string | null;
}

/**
 * Refactored to use shared BondingDataContext
 * Now calls backend API with smart polling instead of direct RPC calls
 * Maintains backward compatibility with old interface
 */
export function useTokenBondingData(
  tokenAddress: string | undefined,
  chainId?: number,
): BondingData {
  const { getTokenData } = useBondingDataContext();

  return useMemo(() => {
    if (!tokenAddress) {
      return {
        curve: 0,
        currentSupply: '0',
        tokensBondedAt: '30000000',
        acesBalance: '0',
        floorWei: '0',
        floorPriceACES: '0',
        steepness: '0',
        isBonded: false,
        bondingPercentage: 0,
        loading: false,
        error: 'No token address provided',
      };
    }

    const tokenState = getTokenData(tokenAddress, chainId || BASE_MAINNET_CHAIN_ID);

    if (tokenState.loading || !tokenState.data) {
      return {
        curve: 0,
        currentSupply: '0',
        tokensBondedAt: '30000000',
        acesBalance: '0',
        floorWei: '0',
        floorPriceACES: '0',
        steepness: '0',
        isBonded: false,
        bondingPercentage: 0,
        loading: tokenState.loading,
        error: tokenState.error,
      };
    }

    // Map backend data to expected interface
    return {
      curve: tokenState.data.curve,
      currentSupply: tokenState.data.currentSupply,
      tokensBondedAt: tokenState.data.tokensBondedAt,
      acesBalance: tokenState.data.acesBalance,
      floorWei: tokenState.data.floorWei,
      floorPriceACES: tokenState.data.floorPriceACES,
      steepness: tokenState.data.steepness,
      isBonded: tokenState.data.isBonded,
      bondingPercentage: tokenState.data.bondingPercentage,
      loading: false,
      error: null,
    };
  }, [tokenAddress, chainId, getTokenData]);
}
