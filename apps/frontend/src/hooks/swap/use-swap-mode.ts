import { useMemo } from 'react';
import { useTokenBondingData } from '@/hooks/contracts/use-token-bonding-data';
import { SUPPORTED_DEX_ASSETS } from '@/lib/swap/constants';
import type { DatabaseListing } from '@/types/rwa/section.types';
import type { SwapMode, PaymentAsset } from '@/lib/swap/types';

interface UseSwapModeProps {
  tokenAddress?: string;
  chainId?: number;
  dexMeta?: DatabaseListing['dex'] | null;
  routerAddress?: string;
}

/**
 * Hook to determine and manage swap mode (Bonding Curve vs DEX)
 * Calculates mode based on bonding status and DEX metadata
 * Provides mode-specific configuration
 */
export function useSwapMode({
  tokenAddress,
  chainId = 84532,
  dexMeta = null,
  routerAddress,
}: UseSwapModeProps) {
  // Get bonding data from read-only hook
  const {
    bondingPercentage: readOnlyBondingPercentage,
    isBonded: readOnlyIsBonded,
    loading: bondingLoading,
  } = useTokenBondingData(tokenAddress, chainId);

  /**
   * Normalize bonding percentage to ensure valid range
   * If token is on DEX, it's 100% bonded (even if on-chain data is stale)
   */
  const normalizedBondingPercentage = useMemo(() => {
    // Graduated tokens are always 100% bonded
    if (dexMeta?.isDexLive === true) {
      return 100;
    }
    const percentage = Number.isFinite(readOnlyBondingPercentage) ? readOnlyBondingPercentage : 0;
    return Math.min(100, Math.max(0, percentage));
  }, [readOnlyBondingPercentage, dexMeta]);

  /**
   * Determine if token is fully bonded
   * Check both on-chain bonding curve data AND database dex metadata
   * (Graduated tokens won't have bonding curve data, but will have dexMeta.isDexLive)
   */
  const tokenBonded = useMemo(() => {
    return readOnlyIsBonded || normalizedBondingPercentage >= 100 || dexMeta?.isDexLive === true;
  }, [readOnlyIsBonded, normalizedBondingPercentage, dexMeta]);

  /**
   * Determine if we should use DEX mode
   * Requirements:
   * 1. Token must be fully bonded (100%)
   * 2. DEX metadata must indicate pool is live
   * 3. Pool address must be provided
   * 4. Token address must be available
   * 5. Router address must be available
   */
  const isDexMode = useMemo(() => {
    // Relax requirement: if token is bonded and we have router + token address, allow DEX mode.
    // Backend will validate availability and return errors/quotes accordingly.
    return Boolean(tokenBonded && tokenAddress && routerAddress);
  }, [tokenBonded, tokenAddress, routerAddress]);

  /**
   * Get swap mode enum
   */
  const mode: SwapMode = isDexMode ? 'dex' : 'bonding';

  /**
   * Determine if swaps are available
   * Bonding mode: always available unless loading
   * DEX mode: available if pool is live
   */
  const canSwap = useMemo(() => {
    if (bondingLoading) return false;
    return true;
  }, [bondingLoading]);

  /**
   * Get supported payment assets based on mode
   * Bonding mode: ACES only
   * DEX mode: ACES, USDC, USDT, ETH (when contract deployed)
   */
  const supportedAssets = useMemo((): PaymentAsset[] => {
    if (isDexMode) {
      // DEX mode supports multiple assets
      return [...SUPPORTED_DEX_ASSETS];
    }

    // Bonding curve only supports ACES
    return ['ACES'];
  }, [isDexMode]);

  /**
   * Check if a specific asset is supported in current mode
   */
  const isAssetSupported = (asset: PaymentAsset): boolean => {
    return supportedAssets.includes(asset);
  };

  return {
    // Mode
    mode,
    isDexMode,
    isBondingMode: !isDexMode,

    // Metadata
    canSwap,
    bondingPercentage: normalizedBondingPercentage,
    tokenBonded,
    bondingLoading,

    // Configuration
    supportedAssets,
    isAssetSupported,

    // Raw data (for debugging/advanced use)
    dexMeta,
  };
}
