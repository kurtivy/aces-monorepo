import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDexQuote } from './use-dex-quote';
import type { PaymentAsset } from '@/lib/swap/types';
import { DEFAULT_SLIPPAGE_BPS } from '@/lib/swap/constants';
import {
  getPlatformFeeBps,
  applyFeeToUsdValue,
  applySlippageToUsdValue,
} from '@/lib/swap/fee-calculator';
import { clampAmountDecimals } from '@/lib/swap/amount-utils';

interface UseUnifiedQuoteProps {
  // Token info
  tokenAddress?: string;

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
  inputUsdValue?: string | null;
  outputUsdValue?: string | null;
}

export interface UnifiedQuoteResult {
  quote: unknown;
  // Output
  outputAmount: string;
  outputUsdValue: string | null;
  minOutputUsdValue?: string | null; // Output USD value with slippage applied

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
  strategy: 'dex' | 'none'; // Bonding curve removed - only DEX quotes

  // Actions
  refreshQuote: () => void;
}

type QuoteStrategy = 'dex' | 'none'; // Bonding curve removed

const PAYMENT_ASSET_DECIMALS: Record<PaymentAsset, number> = {
  ACES: 18,
  WETH: 18,
  ETH: 18,
  USDC: 6,
  USDT: 6,
};

/**
 * Unified quote hook - DEX-only mode
 * All quotes go through DEX (Aerodrome) - bonding curve removed
 */
export function useUnifiedQuote({
  tokenAddress,
  sellToken,
  buyToken,
  amount,
  isDexMode,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
  enabled = true,
}: UseUnifiedQuoteProps): UnifiedQuoteResult {
  // Lightweight client fallback for ACES input USD in DEX mode
  const [dexUsdFallback, setDexUsdFallback] = useState<{
    inputUsd: string | null;
    outputUsd: string | null;
  } | null>(null);

  /**
   * Determine quote strategy - always DEX (bonding curve removed)
   */
  const quoteStrategy = useMemo((): QuoteStrategy => {
    if (!enabled || !tokenAddress) {
      return 'none';
    }

    // All tokens are DEX-only now
    return 'dex';
  }, [enabled, tokenAddress]);

  /**
   * DEX quote (for all swaps via Aerodrome)
   */
  const dexQuote = useDexQuote({
    tokenAddress,
    amount,
    paymentAsset: sellToken as PaymentAsset,
    activeTab:
      sellToken === 'ACES' || ['WETH', 'ETH', 'USDC', 'USDT'].includes(sellToken as string)
        ? 'buy'
        : 'sell',
    isDexMode: true, // Always DEX mode now
    enabled: quoteStrategy === 'dex' && enabled,
    slippageBps,
  });

  // Compute a client-side USD fallback for ACES input in DEX mode when server omits USD
  useEffect(() => {
    let cancelled = false;

    const needsFallback =
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
        // Use relative path for Next.js API route
        const baseUrl = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || '';
        const res = await fetch(`${baseUrl}/api/prices/aces-usd`).catch(() => null);
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
  }, [sellToken, enabled, amount, dexQuote.quote?.inputUsdValue]);

  /**
   * For multi-hop, backend now calculates the final RWA output
   * No need for a separate client-side quote
   */

  /**
   * Combine results based on strategy
   */
  const result: UnifiedQuoteResult = useMemo(() => {
    // console.log('[useUnifiedQuote] 📊 Building result:', {
    //   quoteStrategy,
    //   isDexMode,
    //   enabled,
    //   sellToken,
    //   buyToken,
    //   amount,
    //   dexQuoteData: dexQuote.quote,
    //   dexQuoteLoading: dexQuote.loading,
    //   dexQuoteError: dexQuote.error,
    //   dexQuoteExpectedOutput: dexQuote.quote?.expectedOutput,
    //   bondingQuoteOutput: bondingQuote.outputAmount,
    //   bondingQuoteLoading: bondingQuote.loading,
    // });

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
    dexQuote,
    sellToken,
    buyToken,
    slippageBps,
    dexUsdFallback,
  ]);

  return result;
}
