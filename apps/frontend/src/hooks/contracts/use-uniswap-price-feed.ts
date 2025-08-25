'use client';

import { useState, useCallback, useEffect } from 'react';
import { readContract } from 'wagmi/actions';
import { parseUnits, formatUnits } from 'viem';
import { wagmiConfig } from '@/components/providers/app-providers';

// Contract addresses on Base
const UNISWAP_QUOTER_V2 = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a';
const WETH_BASE = '0x4200000000000000000000000000000000000006';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDT_BASE = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';

// Simplified Quoter ABI
const QUOTER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'quoteExactInputSingle',
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

interface UniswapRates {
  ethToUSDC: number;
  ethToUSDT: number;
  usdcToETH: number;
  usdtToETH: number;
  lastUpdated: number;
  isLoading: boolean;
  error: string | null;
}

// Helper function to get Uniswap quote
async function getUniswapQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  fee: number = 500,
): Promise<bigint> {
  try {
    const result = await readContract(wagmiConfig, {
      address: UNISWAP_QUOTER_V2,
      abi: QUOTER_ABI,
      functionName: 'quoteExactInputSingle',
      args: [
        {
          tokenIn: tokenIn as `0x${string}`,
          tokenOut: tokenOut as `0x${string}`,
          amountIn,
          fee,
          sqrtPriceLimitX96: BigInt(0),
        },
      ],
    });

    return result[0]; // amountOut
  } catch (error) {
    console.error('Uniswap quote failed:', error);
    throw error;
  }
}

export function useUniswapRates() {
  const [rates, setRates] = useState<UniswapRates>({
    ethToUSDC: 0,
    ethToUSDT: 0,
    usdcToETH: 0,
    usdtToETH: 0,
    lastUpdated: 0,
    isLoading: true,
    error: null,
  });

  const fetchRates = useCallback(async () => {
    setRates((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const oneETH = parseUnits('1', 18);
      const oneThousandUSDC = parseUnits('1000', 6); // Use $1000 for better precision
      const oneThousandUSDT = parseUnits('1000', 6);

      // Get quotes in parallel
      const [ethToUSDCQuote, ethToUSDTQuote, usdcToETHQuote, usdtToETHQuote] = await Promise.all([
        getUniswapQuote(WETH_BASE, USDC_BASE, oneETH),
        getUniswapQuote(WETH_BASE, USDT_BASE, oneETH),
        getUniswapQuote(USDC_BASE, WETH_BASE, oneThousandUSDC),
        getUniswapQuote(USDT_BASE, WETH_BASE, oneThousandUSDT),
      ]);

      // Convert to human-readable rates
      const ethToUSDC = Number(formatUnits(ethToUSDCQuote, 6));
      const ethToUSDT = Number(formatUnits(ethToUSDTQuote, 6));

      // For reverse rates, calculate how much ETH we get per dollar
      const ethFromThousandUSDC = Number(formatUnits(usdcToETHQuote, 18));
      const ethFromThousandUSDT = Number(formatUnits(usdtToETHQuote, 18));
      const usdcToETH = ethFromThousandUSDC / 1000; // ETH per 1 USDC
      const usdtToETH = ethFromThousandUSDT / 1000; // ETH per 1 USDT

      setRates({
        ethToUSDC,
        ethToUSDT,
        usdcToETH,
        usdtToETH,
        lastUpdated: Date.now(),
        isLoading: false,
        error: null,
      });

      console.log('🦄 Uniswap rates updated:', {
        ethToUSDC: `$${ethToUSDC.toFixed(2)}`,
        ethToUSDT: `$${ethToUSDT.toFixed(2)}`,
        usdcToETH: `${usdcToETH.toFixed(8)} ETH per USDC`,
        usdtToETH: `${usdtToETH.toFixed(8)} ETH per USDT`,
      });
    } catch (error) {
      console.error('Failed to fetch Uniswap rates:', error);
      setRates((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch rates',
      }));
    }
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchRates();
    const interval = setInterval(fetchRates, 30000);
    return () => clearInterval(interval);
  }, [fetchRates]);

  return {
    ...rates,
    refresh: fetchRates,
    isStale: Date.now() - rates.lastUpdated > 60000, // 1 minute stale
  };
}

// Enhanced swap quote calculation using actual Uniswap rates
export function useAccurateSwapCalculation() {
  const uniswapRates = useUniswapRates();

  const calculateAccurateSwapQuote = useCallback(
    (
      ethAmountNeeded: string, // Exact ETH needed for bonding curve
      currency: 'USDC' | 'USDT',
      shareCount: bigint,
      slippageTolerance: number = 5.0,
    ) => {
      if (!ethAmountNeeded || !shareCount || uniswapRates.isLoading) {
        return null;
      }

      const ethAmount = Number(ethAmountNeeded);

      // Use Uniswap rate instead of external price feed
      const ethToStablecoinRate =
        currency === 'USDC' ? uniswapRates.ethToUSDC : uniswapRates.ethToUSDT;

      if (ethToStablecoinRate <= 0) {
        console.warn('⚠️ Uniswap rate not available yet');
        return null;
      }

      // Calculate required stablecoin using Uniswap rate
      const theoreticalStablecoin = ethAmount * ethToStablecoinRate;

      // Add 3% buffer for:
      // 1. Price movement during transaction (1-2%)
      // 2. Rounding errors (0.5%)
      // 3. Safety margin (0.5%)
      const bufferedStablecoin = theoreticalStablecoin * 1.03;

      // Convert to proper units
      const inputAmount = parseUnits(bufferedStablecoin.toFixed(6), 6);
      const ethAmountWei = parseUnits(ethAmountNeeded, 18);

      // Apply slippage to minimum ETH out
      const slippageMultiplier = (100 - slippageTolerance) / 100;
      const minimumETHOut = BigInt(Math.floor(Number(ethAmountWei) * slippageMultiplier));

      console.log('🎯 Accurate swap calculation:', {
        ethNeeded: ethAmountNeeded,
        uniswapRate: `$${ethToStablecoinRate.toFixed(2)} ${currency}/ETH`,
        theoreticalAmount: `$${theoreticalStablecoin.toFixed(6)}`,
        bufferedAmount: `$${bufferedStablecoin.toFixed(6)}`,
        minimumETHOut: formatUnits(minimumETHOut, 18),
        buffer: '3%',
        slippage: `${slippageTolerance}%`,
      });

      return {
        inputAmount,
        minimumETHOut,
        shareCount,
        slippageTolerance,
        uniswapRate: ethToStablecoinRate,
        actualCostFormatted: bufferedStablecoin.toFixed(6),
      };
    },
    [uniswapRates],
  );

  return {
    calculateAccurateSwapQuote,
    uniswapRates,
  };
}
