import { useMemo, useState, useEffect } from 'react';
import { DexApi } from '@/lib/api/dex';
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
 * Automatically detects graduation mid-session via bonding percentage monitoring
 */
export function useSwapMode({
  tokenAddress,
  chainId = 84532,
  dexMeta = null,
  routerAddress,
}: UseSwapModeProps) {
  // Track graduation state dynamically - can change mid-session
  const [detectedGraduation, setDetectedGraduation] = useState<boolean>(
    Boolean(dexMeta?.isDexLive),
  );

  // Track DEX pool/route readiness
  const [dexReady, setDexReady] = useState<boolean>(false);

  // Get bonding data from read-only hook
  const {
    bondingPercentage: readOnlyBondingPercentage,
    isBonded: readOnlyIsBonded,
    loading: bondingLoading,
  } = useTokenBondingData(tokenAddress, chainId);

  // Detect graduation when bonding percentage reaches 100%
  // Only set graduation if we also have a router address (indicates DEX is ready)
  useEffect(() => {
    if (!detectedGraduation && readOnlyIsBonded && routerAddress) {
      console.log('[SwapMode] 🎓 Token graduated! Detected via bonding percentage reaching 100%', {
        tokenAddress,
        bondingPercentage: readOnlyBondingPercentage,
        hasRouterAddress: !!routerAddress,
      });
      setDetectedGraduation(true);
    }
  }, [
    readOnlyIsBonded,
    readOnlyBondingPercentage,
    detectedGraduation,
    tokenAddress,
    routerAddress,
  ]);

  // Sync with prop changes (for initial load or external updates)
  useEffect(() => {
    if (dexMeta?.isDexLive !== detectedGraduation) {
      setDetectedGraduation(Boolean(dexMeta?.isDexLive));
    }
  }, [dexMeta?.isDexLive]);

  // Probe backend to verify DEX readiness (pool or viable route)
  useEffect(() => {
    let cancelled = false;
    async function checkDexReadiness() {
      // Reset when inputs are missing or not graduated
      if (!detectedGraduation || !tokenAddress || !routerAddress) {
        if (!cancelled) setDexReady(false);
        return;
      }

      // If listing metadata is present and indicates not live, gate off
      if (dexMeta && (!dexMeta.isDexLive || !dexMeta.poolAddress)) {
        if (!cancelled) setDexReady(false);
        return;
      }

      // Step 1: Check for direct pool
      const poolRes = await DexApi.getPool(tokenAddress);
      if (!cancelled && poolRes.success) {
        setDexReady(true);
        return;
      }

      // Step 2: Probe a tiny ACES -> TOKEN quote to see if multi-hop is viable
      const quoteRes = await DexApi.getQuote(tokenAddress, {
        inputAsset: 'ACES',
        amount: '1',
        slippageBps: 100,
      });
      if (!cancelled) {
        setDexReady(Boolean(quoteRes.success && quoteRes.data));
      }
    }

    void checkDexReadiness();
    return () => {
      cancelled = true;
    };
  }, [detectedGraduation, tokenAddress, routerAddress, dexMeta]);

  /**
   * Normalize bonding percentage to ensure valid range
   * If token is on DEX, it's 100% bonded (even if on-chain data is stale)
   */
  const normalizedBondingPercentage = useMemo(() => {
    // Graduated tokens are always 100% bonded
    if (detectedGraduation) {
      return 100;
    }
    const percentage = Number.isFinite(readOnlyBondingPercentage) ? readOnlyBondingPercentage : 0;
    return Math.min(100, Math.max(0, percentage));
  }, [readOnlyBondingPercentage, detectedGraduation]);

  /**
   * Determine if token is fully bonded
   * Check both on-chain bonding curve data AND detected graduation state
   * (Graduated tokens won't have bonding curve data, but will be detected via state)
   */
  const tokenBonded = useMemo(() => {
    return readOnlyIsBonded || normalizedBondingPercentage >= 100 || detectedGraduation;
  }, [readOnlyIsBonded, normalizedBondingPercentage, detectedGraduation]);

  /**
   * Determine if we should use DEX mode
   * Requirements:
   * 1. Token must be fully bonded (100%) OR graduation detected
   * 2. DEX must be live (detected dynamically or from dexMeta)
   * 3. Token address must be available
   * 4. Router address must be available
   *
   * NOTE: AcesSwap (bonding mode) works from 0-100% bonded.
   * Only switch to DEX mode when the DEX pool is actually live.
   * Graduation is detected automatically when bonding reaches 100%.
   */
  const metaAllowsDex = useMemo(() => {
    if (!dexMeta) return true;
    return Boolean(dexMeta.isDexLive && dexMeta.poolAddress);
  }, [dexMeta]);

  const isDexMode = useMemo(() => {
    // Only use DEX mode when the DEX pool/route is confirmed ready and metadata (if present) allows it
    // This allows AcesSwap to work through the entire bonding phase (0-100%)
    return Boolean(
      detectedGraduation && tokenAddress && routerAddress && dexReady && metaAllowsDex,
    );
  }, [detectedGraduation, tokenAddress, routerAddress, dexReady, metaAllowsDex]);

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
    dexReady,
  };
}
