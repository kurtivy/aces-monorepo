'use client';

import { useBondingData } from '@/contexts/bonding-data-context';

const DEFAULT_CHAIN_ID = 8453; // Base Mainnet

interface BondingData {
  // Raw contract data
  curve: number;
  currentSupply: string; // In ether (e.g., "22320.83")
  tokensBondedAt: string; // In ether (e.g., "700000000")
  acesBalance: string; // In ether
  floorWei: string;
  floorPriceACES: string;
  steepness: string;
  isBonded: boolean;

  // Calculated values
  bondingPercentage: number; // 0-100
  bondingTargetSource?:
    | 'contract'
    | 'max_total_supply'
    | 'subgraph'
    | 'listing_parameters'
    | 'default';

  // Loading state
  loading: boolean;
  error: string | null;
}

const EMPTY_BONDING_DATA: BondingData = {
  curve: 0,
  currentSupply: '0',
  tokensBondedAt: '700000000', // Unified default to 700M tokens
  acesBalance: '0',
  floorWei: '0',
  floorPriceACES: '0',
  steepness: '0',
  isBonded: false,
  bondingPercentage: 0,
  loading: false,
  error: 'No token address provided',
  bondingTargetSource: 'default',
};

/**
 * Refactored to use shared BondingDataContext with subscription system
 * Now calls backend API with smart polling instead of direct RPC calls
 * Maintains backward compatibility with old interface
 */
export function useTokenBondingData(
  tokenAddress: string | undefined,
  chainId?: number,
): BondingData {
  // Use the new subscription-based hook
  const tokenState = useBondingData(tokenAddress, chainId || DEFAULT_CHAIN_ID);

  if (!tokenAddress) {
    return EMPTY_BONDING_DATA;
  }

  if (tokenState.loading || !tokenState.data) {
    return {
      curve: 0,
      currentSupply: '0',
      tokensBondedAt: '700000000', // Unified default to 700M tokens
      acesBalance: '0',
      floorWei: '0',
      floorPriceACES: '0',
      steepness: '0',
      isBonded: false,
      bondingPercentage: 0,
      loading: tokenState.loading,
      error: tokenState.error,
      bondingTargetSource: 'default',
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
    bondingTargetSource: tokenState.data.bondingTargetSource,
    loading: false,
    error: null,
  };
}
