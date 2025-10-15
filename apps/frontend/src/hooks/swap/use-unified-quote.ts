import { useState, useEffect, useMemo, useCallback } from 'react';
import { ethers } from 'ethers';
import { useEnhancedBondingQuote } from './use-enhanced-bonding-quote';
import { useDexQuote } from './use-dex-quote';
import { BondingApi } from '@/lib/bonding-curve/bonding';
import type { PaymentAsset } from '@/lib/swap/types';
import { DEFAULT_SLIPPAGE_BPS } from '@/lib/swap/constants';

interface UseUnifiedQuoteProps {
  // Contracts
  factoryContract: ethers.Contract | null;
  tokenContract: ethers.Contract | null;

  // Token info
  tokenAddress?: string;
  tokenDecimals: number;

  // Swap params
  sellToken: PaymentAsset | 'TOKEN'; // What user is selling
  buyToken: PaymentAsset | 'TOKEN'; // What user is buying
  amount: string;

  // Mode
  isDexMode: boolean;

  // Config
  slippageBps?: number;
  enabled?: boolean;
}

interface MultiHopQuoteData {
  inputAsset: string;
  inputAmount: string;
  expectedAcesAmount: string;
  expectedAcesAmountRaw: string;
  minAcesAmount: string;
  expectedRwaOutput: string;
  path: string[];
  intermediate?: Array<{ symbol: string; amount: string }>;
  needsMultiHop: boolean;
  slippageBps: number;
}

export interface UnifiedQuoteResult {
  quote: any;
  // Output
  outputAmount: string;
  outputUsdValue: string | null;

  // Input
  inputUsdValue: string | null;

  // Intermediate (for multi-hop)
  intermediateAcesAmount?: string;
  needsMultiHop: boolean;

  // State
  loading: boolean;
  error: string | null;

  // Metadata
  path: string[];
  slippageBps: number;
  strategy: 'bonding-direct' | 'bonding-multihop' | 'dex' | 'none';

  // Actions
  refreshQuote: () => void;
}

type QuoteStrategy = 'bonding-direct' | 'bonding-multihop' | 'dex' | 'none';

/**
 * Unified quote hook that intelligently routes to:
 * - Enhanced bonding curve (ACES ↔ RWA in bonding mode)
 * - Multi-hop bonding (WETH/USDC/USDT → RWA in bonding mode, requires AcesSwap)
 * - DEX quotes (all pairs in DEX mode via Aerodrome)
 */
export function useUnifiedQuote({
  factoryContract,
  tokenContract,
  tokenAddress,
  tokenDecimals,
  sellToken,
  buyToken,
  amount,
  isDexMode,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
  enabled = true,
}: UseUnifiedQuoteProps): UnifiedQuoteResult {
  // Multi-hop quote state (for ETH/USDC/USDT → RWA in bonding mode)
  const [multiHopQuote, setMultiHopQuote] = useState<MultiHopQuoteData | null>(null);
  const [multiHopLoading, setMultiHopLoading] = useState(false);
  const [multiHopError, setMultiHopError] = useState<string | null>(null);

  // Lightweight client fallback for ACES input USD in DEX mode
  const [dexUsdFallback, setDexUsdFallback] = useState<{
    inputUsd: string | null;
    outputUsd: string | null;
  } | null>(null);

  /**
   * Determine quote strategy based on tokens and mode
   */
  const quoteStrategy = useMemo((): QuoteStrategy => {
    if (!enabled || !tokenAddress) {
      return 'none';
    }

    const isRwaToken = (token: string) =>
      token.toLowerCase() === tokenAddress.toLowerCase() || token === 'TOKEN';

    const isSellRwa = isRwaToken(sellToken);
    const isBuyRwa = isRwaToken(buyToken);

    // DEX Mode: Always use Aerodrome quotes
    if (isDexMode) {
      return 'dex';
    }

    // Bonding Mode routing:

    // ACES → RWA: Direct bonding curve buy
    if (sellToken === 'ACES' && isBuyRwa) {
      return 'bonding-direct';
    }

    // RWA → ACES: Direct bonding curve sell
    if (isSellRwa && buyToken === 'ACES') {
      return 'bonding-direct';
    }

    // WETH/ETH/USDC/USDT → RWA: Multi-hop via AcesSwap contract
    // (WETH/ETH/USDC/USDT → WETH → ACES via DEX, then ACES → RWA via bonding)
    if (['WETH', 'ETH', 'USDC', 'USDT'].includes(sellToken as string) && isBuyRwa) {
      return 'bonding-multihop';
    }

    // Unsupported combination
    return 'none';
  }, [enabled, tokenAddress, sellToken, buyToken, isDexMode]);

  /**
   * Enhanced bonding curve quote (for ACES ↔ RWA direct swaps)
   */
  const bondingQuote = useEnhancedBondingQuote({
    factoryContract,
    tokenContract,
    tokenAddress,
    amount,
    tokenDecimals,
    isDexMode: isDexMode || quoteStrategy !== 'bonding-direct',
    activeTab: sellToken === 'ACES' ? 'buy' : 'sell',
    inputAsset: sellToken === 'ACES' ? 'ACES' : 'TOKEN',
    paymentAsset: sellToken === 'TOKEN' ? 'ACES' : (sellToken as PaymentAsset),
    slippageBps,
    autoRefreshEnabled: quoteStrategy === 'bonding-direct' && enabled,
  });

  /**
   * DEX quote (for all swaps in DEX mode via Aerodrome)
   */
  const dexQuote = useDexQuote({
    tokenAddress,
    amount,
    paymentAsset: sellToken as PaymentAsset,
    activeTab:
      sellToken === 'ACES' || ['WETH', 'ETH', 'USDC', 'USDT'].includes(sellToken as string)
        ? 'buy'
        : 'sell',
    isDexMode,
    enabled: quoteStrategy === 'dex' && enabled,
    slippageBps,
  });

  // Compute a client-side USD fallback for ACES input in DEX mode when server omits USD
  useEffect(() => {
    let cancelled = false;

    const needsFallback =
      isDexMode &&
      sellToken === 'ACES' &&
      enabled &&
      (amount || '').trim() !== '' &&
      !dexQuote.quote?.inputUsdValue;

    if (!needsFallback) {
      setDexUsdFallback(null);
      return;
    }

    const amountNum = Number.parseFloat(amount || '0');
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setDexUsdFallback(null);
      return;
    }

    (async () => {
      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_API_URL ||
          (typeof window !== 'undefined' && window.location.hostname === 'localhost'
            ? 'http://localhost:3002'
            : 'https://aces-monorepo-backend.vercel.app');
        const res = await fetch(`${baseUrl}/api/v1/prices/aces-usd`).catch(() => null);
        if (!res || !res.ok) {
          if (!cancelled) setDexUsdFallback(null);
          return;
        }
        const payload = await res.json();
        const acesUsd = payload?.data?.acesUsdPrice ?? payload?.price ?? null;
        const acesUsdNum = Number.parseFloat(String(acesUsd ?? ''));
        if (!Number.isFinite(acesUsdNum) || acesUsdNum <= 0) {
          if (!cancelled) setDexUsdFallback(null);
          return;
        }
        const inputUsd = (amountNum * acesUsdNum).toFixed(2);
        const outputUsd = inputUsd; // TOKEN output approximated by input value
        if (!cancelled) setDexUsdFallback({ inputUsd, outputUsd });
      } catch {
        if (!cancelled) setDexUsdFallback(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDexMode, sellToken, enabled, amount, dexQuote.quote?.inputUsdValue]);

  /**
   * Fetch multi-hop quote for WETH/USDC/USDT → RWA
   * Backend calculates WETH/USDC/USDT → ACES via DEX pools
   * Then we calculate ACES → RWA via bonding curve
   */
  const fetchMultiHopQuote = useCallback(async () => {
    if (quoteStrategy !== 'bonding-multihop' || !tokenAddress || !amount) {
      setMultiHopQuote(null);
      return;
    }

    if (!['WETH', 'ETH', 'USDC', 'USDT'].includes(sellToken as string)) {
      setMultiHopError('Invalid input asset for multi-hop');
      return;
    }

    try {
      setMultiHopLoading(true);
      setMultiHopError(null);

      // Normalize ETH to WETH for backend API
      const apiAsset = sellToken === 'ETH' ? 'WETH' : sellToken;

      const result = await BondingApi.getMultiHopQuote(tokenAddress, {
        inputAsset: apiAsset as 'WETH' | 'USDC' | 'USDT',
        amount,
        slippageBps,
      });

      if (result.success && result.data) {
        setMultiHopQuote(result.data as MultiHopQuoteData);
      } else {
        const errorMsg =
          typeof result.error === 'string' ? result.error : 'Failed to fetch multi-hop quote';
        setMultiHopError(errorMsg);
        setMultiHopQuote(null);
      }
    } catch (error) {
      console.error('[useUnifiedQuote] Multi-hop quote failed:', error); // eslint-disable-line
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch quote';
      setMultiHopError(errorMsg);
      setMultiHopQuote(null);
    } finally {
      setMultiHopLoading(false);
    }
  }, [quoteStrategy, tokenAddress, sellToken, amount, slippageBps]);

  /**
   * Auto-fetch multi-hop quote when strategy changes
   */
  useEffect(() => {
    if (quoteStrategy === 'bonding-multihop' && enabled) {
      fetchMultiHopQuote();
    } else {
      setMultiHopQuote(null);
      setMultiHopError(null);
    }
  }, [quoteStrategy, enabled, fetchMultiHopQuote]);

  /**
   * For multi-hop, calculate final RWA output using bonding curve
   * with the intermediate ACES amount from backend
   */
  const multiHopFinalQuote = useEnhancedBondingQuote({
    factoryContract,
    tokenContract,
    tokenAddress,
    amount: multiHopQuote?.expectedAcesAmount || '0',
    tokenDecimals,
    isDexMode: false,
    activeTab: 'buy',
    inputAsset: 'ACES',
    paymentAsset: sellToken === 'TOKEN' ? 'ACES' : (sellToken as PaymentAsset | undefined),
    slippageBps,
    autoRefreshEnabled: false,
  });

  /**
   * Combine results based on strategy
   */
  const result: UnifiedQuoteResult = useMemo(() => {
    console.log('[useUnifiedQuote] 📊 Building result:', {
      quoteStrategy,
      isDexMode,
      enabled,
      sellToken,
      buyToken,
      amount,
      dexQuoteData: dexQuote.quote,
      dexQuoteLoading: dexQuote.loading,
      dexQuoteError: dexQuote.error,
      dexQuoteExpectedOutput: dexQuote.quote?.expectedOutput,
      bondingQuoteOutput: bondingQuote.outputAmount,
      bondingQuoteLoading: bondingQuote.loading,
    });

    const baseResult: UnifiedQuoteResult = {
      outputAmount: '0',
      outputUsdValue: null,
      inputUsdValue: null,
      needsMultiHop: false,
      path: [],
      slippageBps,
      strategy: quoteStrategy,
      loading: false,
      error: null,
      refreshQuote: () => {},
      quote: undefined,
    };

    switch (quoteStrategy) {
      case 'bonding-direct':
        return {
          ...baseResult,
          outputAmount: bondingQuote.outputAmount,
          outputUsdValue: bondingQuote.outputUsdValue,
          inputUsdValue: bondingQuote.inputUsdValue,
          needsMultiHop: false,
          path: [sellToken, buyToken],
          loading: bondingQuote.loading,
          error: bondingQuote.error,
          refreshQuote: bondingQuote.refreshQuote,
        };

      case 'bonding-multihop':
        return {
          ...baseResult,
          outputAmount: multiHopFinalQuote.outputAmount || '0',
          outputUsdValue: multiHopFinalQuote.outputUsdValue,
          inputUsdValue: multiHopFinalQuote.inputUsdValue,
          intermediateAcesAmount: multiHopQuote?.expectedAcesAmount,
          needsMultiHop: true,
          path: multiHopQuote?.path || [sellToken, 'ACES', buyToken],
          loading: multiHopLoading || multiHopFinalQuote.loading,
          error: multiHopError || multiHopFinalQuote.error,
          refreshQuote: fetchMultiHopQuote,
        };

      case 'dex': {
        // Prefer server-provided USD values; fallback to client-computed values if present.
        // If server provided input USD but omitted output USD for TOKEN, mirror input USD.
        const inputUsdValue = dexQuote.quote?.inputUsdValue ?? dexUsdFallback?.inputUsd ?? null;
        let outputUsdValue = dexQuote.quote?.outputUsdValue ?? dexUsdFallback?.outputUsd ?? null;
        if (!outputUsdValue && inputUsdValue && buyToken === 'TOKEN') {
          outputUsdValue = inputUsdValue;
        }

        return {
          ...baseResult,
          quote: dexQuote.quote, // Pass the full quote object for swap execution
          outputAmount: dexQuote.quote?.expectedOutput || '0',
          outputUsdValue,
          inputUsdValue,
          needsMultiHop: (dexQuote.quote?.path?.length || 0) > 2,
          path: dexQuote.quote?.path || [sellToken, buyToken],
          loading: dexQuote.loading,
          error: dexQuote.error,
          refreshQuote: dexQuote.refetchQuote,
        };
      }

      case 'none':
      default:
        return {
          ...baseResult,
          error: 'Unsupported token pair',
        };
    }
  }, [
    quoteStrategy,
    bondingQuote,
    dexQuote,
    multiHopQuote,
    multiHopFinalQuote,
    multiHopLoading,
    multiHopError,
    sellToken,
    buyToken,
    slippageBps,
    fetchMultiHopQuote,
    dexUsdFallback,
  ]);

  return result;
}
