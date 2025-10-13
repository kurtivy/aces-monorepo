import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ethers } from 'ethers';
import { useAcesUsdPrice } from '@/hooks/use-aces-usd-price';
import { useBondingCurveState } from '@/hooks/swap/use-bonding-curve-state';
import { useQuoteAutoRefresh } from '@/hooks/use-quote-auto-refresh';
import { PRICE_QUOTE_DEBOUNCE_MS, DEFAULT_SLIPPAGE_BPS } from '@/lib/swap/constants';
import {
  quoteBuyAmountFromAces,
  quoteSellAcesFromAmount,
  getBuyPriceAfterFee,
  W,
} from '@/lib/bonding-curve/aces-quote';
import type { PaymentAsset } from '@/lib/swap/types';

interface UseEnhancedBondingQuoteProps {
  factoryContract: ethers.Contract | null;
  tokenContract: ethers.Contract | null;
  tokenAddress?: string;
  amount: string;
  tokenDecimals: number;
  isDexMode: boolean;
  activeTab: 'buy' | 'sell';
  inputAsset: 'ACES' | 'TOKEN'; // NEW: What the user is inputting
  paymentAsset?: PaymentAsset | 'TOKEN';
  slippageBps?: number;
  autoRefreshEnabled?: boolean;
}

interface EnhancedBondingQuoteResult {
  // Output amounts
  outputAmount: string; // What user will receive
  outputAmountWithSlippage: string;

  // ACES values
  acesCost: string; // For BUY: ACES needed
  acesReceived: string; // For SELL: ACES received

  // USD values
  inputUsdValue: string | null;
  outputUsdValue: string | null;
  acesUsdPrice: string | null;

  // State
  loading: boolean;
  error: string | null;
  lastRefreshTime: number;

  // Actions
  refreshQuote: () => void;

  // Metadata
  slippageBps: number;
}

/**
 * Enhanced bonding curve quote hook with support for:
 * - Forward calculation: TOKEN amount → ACES cost
 * - Reverse calculation: ACES amount → TOKEN amount (via binary search)
 * - On-chain USD pricing from Aerodrome pool
 */
export function useEnhancedBondingQuote({
  factoryContract,
  tokenContract,
  tokenAddress,
  amount,
  tokenDecimals,
  isDexMode,
  activeTab,
  inputAsset,
  paymentAsset,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
  autoRefreshEnabled = true,
}: UseEnhancedBondingQuoteProps): EnhancedBondingQuoteResult {
  // State
  const [outputAmount, setOutputAmount] = useState<string>('0');
  const [outputAmountWithSlippage, setOutputAmountWithSlippage] = useState<string>('0');
  const [acesCost, setAcesCost] = useState<string>('0');
  const [acesReceived, setAcesReceived] = useState<string>('0');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const normalizedPaymentAsset = (paymentAsset ?? 'ACES').toString().toUpperCase();
  const buyFeeBps = useMemo(() => {
    if (activeTab !== 'buy') return 0;

    switch (normalizedPaymentAsset) {
      case 'ACES':
      case undefined:
        return 100; // 1.0%
      case 'WETH':
        return 125; // 1.25%
      case 'USDC':
      case 'USDT':
      case 'ETH':
        return 150; // 1.5%
      default:
        return 100;
    }
  }, [activeTab, normalizedPaymentAsset]);

  // Get ACES/USD price from Aerodrome
  const { acesUsdPrice, loading: priceLoading } = useAcesUsdPrice({
    enabled: !isDexMode,
  });

  // Debug: Watch amount prop changes
  // useEffect(() => {
  //   console.log('[useEnhancedBondingQuote] Amount prop changed:', {
  //     amount,
  //     isDexMode,
  //     activeTab,
  //     inputAsset,
  //   });
  // }, [amount, isDexMode, activeTab, inputAsset]);

  // Get bonding curve state
  const { quoteState, loading: stateLoading } = useBondingCurveState({
    factoryContract,
    tokenContract,
    tokenAddress,
    enabled: !isDexMode,
  });

  /**
   * Calculate quote based on input type
   */
  const calculateQuote = useCallback(async () => {
    // console.log('[useEnhancedBondingQuote] calculateQuote called:', {
    //   isDexMode,
    //   hasQuoteState: !!quoteState,
    //   amount,
    //   activeTab,
    //   inputAsset,
    // });

    if (isDexMode || !quoteState || !amount || amount.trim() === '') {
      // console.log('[useEnhancedBondingQuote] Early return - resetting to zeros');
      setOutputAmount('0');
      setOutputAmountWithSlippage('0');
      setAcesCost('0');
      setAcesReceived('0');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const amountNum = parseFloat(amount);
      if (!isFinite(amountNum) || amountNum <= 0) {
        throw new Error('Invalid amount');
      }

      // Convert to Wei (bigint)
      const amountWei = BigInt(ethers.utils.parseUnits(amount, tokenDecimals).toString());

      if (activeTab === 'buy') {
        if (inputAsset === 'ACES') {
          // User entered ACES → Calculate TOKEN output via reverse calculation
          const tokenAmountWei = quoteBuyAmountFromAces(amountWei, quoteState);
          const tokenAmountWhole = tokenAmountWei / W;

          setOutputAmount(tokenAmountWhole.toString());
          setAcesCost(amount); // Input ACES is the cost

          // Apply slippage (reduce output by slippage %)
          const withSlippage = (tokenAmountWei * BigInt(10000 - slippageBps)) / BigInt(10000);
          const withSlippageWhole = withSlippage / W;
          setOutputAmountWithSlippage(withSlippageWhole.toString());

          // console.log('[useEnhancedBondingQuote] BUY with ACES input:', {
          //   acesInput: amount,
          //   tokenOutput: tokenAmountWhole.toString(),
          //   tokenOutputWithSlippage: withSlippageWhole.toString(),
          // });
        } else {
          // User entered TOKEN amount → Calculate ACES cost (forward calculation)
          const acesCostWei = getBuyPriceAfterFee(
            quoteState.supply,
            amountWei,
            quoteState.steepness,
            quoteState.floor,
            quoteState.protocolFeePercent,
            quoteState.subjectFeePercent,
          );

          const acesCostFormatted = ethers.utils.formatUnits(acesCostWei.toString(), 18);
          setOutputAmount(amount); // Output is the token amount user wants
          setAcesCost(acesCostFormatted);

          // Apply slippage (increase cost by slippage %)
          const withSlippage = (acesCostWei * BigInt(10000 + slippageBps)) / BigInt(10000);
          const withSlippageFormatted = ethers.utils.formatUnits(withSlippage.toString(), 18);
          setOutputAmountWithSlippage(amount);

          // console.log('[useEnhancedBondingQuote] BUY with TOKEN input:', {
          //   tokenInput: amount,
          //   acesCost: acesCostFormatted,
          //   acesCostWithSlippage: withSlippageFormatted,
          // });
        }
      } else {
        // SELL: User enters TOKEN amount → Calculate ACES received
        const acesReceivedWei = quoteSellAcesFromAmount(amountWei, quoteState);
        const acesReceivedFormatted = ethers.utils.formatUnits(acesReceivedWei.toString(), 18);

        setOutputAmount(acesReceivedFormatted);
        setAcesReceived(acesReceivedFormatted);
        // Apply slippage (reduce output by slippage %)
        const withSlippage = (acesReceivedWei * BigInt(10000 - slippageBps)) / BigInt(10000);
        const withSlippageFormatted = ethers.utils.formatUnits(withSlippage.toString(), 18);
        setOutputAmountWithSlippage(withSlippageFormatted);

        console.log('[useEnhancedBondingQuote] SELL:', {
          tokenInput: amount,
          acesOutput: acesReceivedFormatted,
          acesOutputWithSlippage: withSlippageFormatted,
        });
      }

      setLastRefreshTime(Date.now());
    } catch (err) {
      console.error('[useEnhancedBondingQuote] Calculation failed:', err);
      console.error('[useEnhancedBondingQuote] State:', {
        quoteState,
        amount,
        activeTab,
        inputAsset,
      });
      setError(err instanceof Error ? err.message : 'Quote calculation failed');
      setOutputAmount('0');
      setOutputAmountWithSlippage('0');
      setAcesCost('0');
      setAcesReceived('0');
    } finally {
      setLoading(false);
    }
  }, [isDexMode, quoteState, amount, tokenDecimals, activeTab, inputAsset, slippageBps]);

  /**
   * Debounced calculation trigger
   */
  const debouncedCalculate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (isDexMode) return;

    debounceTimerRef.current = setTimeout(() => {
      calculateQuote();
    }, PRICE_QUOTE_DEBOUNCE_MS);
  }, [isDexMode, calculateQuote]);

  /**
   * Trigger calculation when dependencies change
   */
  useEffect(() => {
    console.log('[useEnhancedBondingQuote] useEffect triggered:', {
      isDexMode,
      amount,
      activeTab,
      inputAsset,
      hasQuoteState: !!quoteState,
    });

    if (isDexMode) {
      setOutputAmount('0');
      setOutputAmountWithSlippage('0');
      setAcesCost('0');
      setAcesReceived('0');
      return;
    }

    debouncedCalculate();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [isDexMode, debouncedCalculate, amount, activeTab, inputAsset, quoteState]);

  /**
   * Auto-refresh (only when there's an amount to quote)
   */
  useQuoteAutoRefresh({
    enabled: autoRefreshEnabled && !isDexMode && !!quoteState && !!amount && amount.trim() !== '',
    onRefresh: calculateQuote,
  });

  /**
   * Calculate USD values
   */
  const inputUsdValue = useMemo(() => {
    // console.log('[useEnhancedBondingQuote] inputUsdValue calc:', {
    //   acesUsdPrice,
    //   activeTab,
    //   inputAsset,
    //   amount,
    //   acesCost,
    //   acesReceived,
    // });

    if (!acesUsdPrice) {
      console.log('[useEnhancedBondingQuote] No ACES USD price, returning null');
      return null;
    }

    const acesPrice = parseFloat(acesUsdPrice);
    if (!isFinite(acesPrice)) {
      console.log('[useEnhancedBondingQuote] Invalid ACES price, returning null');
      return null;
    }

    if (activeTab === 'buy') {
      if (inputAsset === 'ACES') {
        // Input is ACES
        const amountNum = parseFloat(amount || '0');
        const result = (amountNum * acesPrice).toFixed(2);
        // console.log('[useEnhancedBondingQuote] BUY with ACES input USD:', {
        //   amountNum,
        //   acesPrice,
        //   result,
        // });
        return result;
      } else {
        // Input is TOKEN, show USD of ACES cost
        const acesCostNum = parseFloat(acesCost || '0');
        const result = (acesCostNum * acesPrice).toFixed(2);
        console.log('[useEnhancedBondingQuote] BUY with TOKEN input USD:', {
          acesCostNum,
          acesPrice,
          result,
        });
        return result;
      }
    } else {
      // SELL: Input is TOKEN, show USD of ACES that will be received
      const acesNum = parseFloat(acesReceived || '0');
      const result = (acesNum * acesPrice).toFixed(2);
      console.log('[useEnhancedBondingQuote] SELL input USD:', { acesNum, acesPrice, result });
      return result;
    }
  }, [acesUsdPrice, activeTab, inputAsset, amount, acesCost, acesReceived]);

  const outputUsdValue = useMemo(() => {
    if (!acesUsdPrice) return null;

    const acesPrice = parseFloat(acesUsdPrice);
    if (!isFinite(acesPrice)) return null;

    if (activeTab === 'buy') {
      const inputUsd = inputUsdValue ? parseFloat(inputUsdValue) : NaN;
      if (!Number.isFinite(inputUsd)) return null;

      const multiplier = Math.max(0, 1 - buyFeeBps / 10_000);
      return (inputUsd * multiplier).toFixed(2);
    }

    const acesNum = parseFloat(outputAmount || '0');
    if (!Number.isFinite(acesNum)) return null;
    return (acesNum * acesPrice).toFixed(2);
  }, [acesUsdPrice, activeTab, inputUsdValue, buyFeeBps, outputAmount]);

  // console.log('[useEnhancedBondingQuote] Returning:', {
  //   outputAmount,
  //   acesCost,
  //   acesReceived,
  //   inputUsdValue,
  //   outputUsdValue,
  //   acesUsdPrice,
  //   loading: loading || stateLoading || priceLoading,
  // });

  return {
    outputAmount,
    outputAmountWithSlippage,
    acesCost,
    acesReceived,
    inputUsdValue,
    outputUsdValue,
    acesUsdPrice,
    loading: loading || stateLoading || priceLoading,
    error,
    lastRefreshTime,
    refreshQuote: calculateQuote,
    slippageBps,
  };
}
