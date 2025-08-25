'use client';

import { useState, useCallback, useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { readContract } from 'wagmi/actions';
import { parseUnits, formatUnits, type Address } from 'viem';
import { base } from 'viem/chains';
import { getBondingCurveContracts } from '@aces/utils';
import { ACES_SWAP_ABI, ERC20_ABI } from '@aces/utils';
import { SUPPORTED_CURRENCIES, type Currency } from '@/types/contracts';
import { wagmiConfig } from '@/components/providers/app-providers';

// Uniswap V3 integration
const UNISWAP_QUOTER_V2 = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a';
const WETH_BASE = '0x4200000000000000000000000000000000000006';

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

// Import QuoteResult type from bonding curve hook
interface QuoteResult {
  tokensOut: bigint;
  ethCost: bigint;
  shareCount: bigint;
}

interface SwapState {
  isLoading: boolean;
  error: string | null;
  step: 'idle' | 'checking-allowance' | 'approving' | 'swapping' | 'success';
  transactionHash?: string;
}

interface TokenBalance {
  balance: bigint;
  formattedBalance: string;
  decimals: number;
}

interface SwapQuote {
  inputAmount: bigint;
  minimumETHOut: bigint;
  shareCount: bigint;
  slippageTolerance: number;
  uniswapRate?: number;
  actualCostFormatted?: string;
}

interface UniswapRates {
  ethToUSDC: number;
  ethToUSDT: number;
  usdcToETH: number;
  usdtToETH: number;
  lastUpdated: number;
  isLoading: boolean;
  error: string | null;
}

export function useAcesSwapContract() {
  const { address: walletAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [swapState, setSwapState] = useState<SwapState>({
    isLoading: false,
    error: null,
    step: 'idle',
  });

  // Uniswap rates state
  const [uniswapRates, setUniswapRates] = useState<UniswapRates>({
    ethToUSDC: 0,
    ethToUSDT: 0,
    usdcToETH: 0,
    usdtToETH: 0,
    lastUpdated: 0,
    isLoading: true,
    error: null,
  });

  // Get contract addresses
  const BASE_MAINNET_CONTRACTS = getBondingCurveContracts(8453); // Base Mainnet
  const ACES_SWAP_ADDRESS = BASE_MAINNET_CONTRACTS.acesSwap; // AcesSwap contract address
  const SHARES_SUBJECT_ADDRESS = BASE_MAINNET_CONTRACTS.sharesSubject as Address;
  const ROOM_NUMBER = BigInt(BASE_MAINNET_CONTRACTS.roomNumber);

  // Helper to check if contract is properly deployed
  const isSwapContractReady =
    ACES_SWAP_ADDRESS.length > 10 &&
    ACES_SWAP_ADDRESS.startsWith('0x') &&
    ACES_SWAP_ADDRESS !== 'NOT_DEPLOYED';

  // Token contract addresses
  const USDC_ADDRESS = SUPPORTED_CURRENCIES.USDC.address as Address;
  const USDT_ADDRESS = SUPPORTED_CURRENCIES.USDT.address as Address;

  // Helper function to get Uniswap quote
  const getUniswapQuote = useCallback(
    async (
      tokenIn: string,
      tokenOut: string,
      amountIn: bigint,
      fee: number = 500,
    ): Promise<bigint> => {
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
        throw error;
      }
    },
    [],
  );

  // Fetch Uniswap rates
  const fetchUniswapRates = useCallback(async () => {
    setUniswapRates((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const oneETH = parseUnits('1', 18);
      const oneThousandUSDC = parseUnits('1000', 6);
      const oneThousandUSDT = parseUnits('1000', 6);

      // Get quotes in parallel
      const [ethToUSDCQuote, ethToUSDTQuote, usdcToETHQuote, usdtToETHQuote] = await Promise.all([
        getUniswapQuote(WETH_BASE, USDC_ADDRESS, oneETH),
        getUniswapQuote(WETH_BASE, USDT_ADDRESS, oneETH),
        getUniswapQuote(USDC_ADDRESS, WETH_BASE, oneThousandUSDC),
        getUniswapQuote(USDT_ADDRESS, WETH_BASE, oneThousandUSDT),
      ]);

      // Convert to human-readable rates
      const ethToUSDC = Number(formatUnits(ethToUSDCQuote, 6));
      const ethToUSDT = Number(formatUnits(ethToUSDTQuote, 6));

      // For reverse rates, calculate how much ETH we get per dollar
      const ethFromThousandUSDC = Number(formatUnits(usdcToETHQuote, 18));
      const ethFromThousandUSDT = Number(formatUnits(usdtToETHQuote, 18));
      const usdcToETH = ethFromThousandUSDC / 1000; // ETH per 1 USDC
      const usdtToETH = ethFromThousandUSDT / 1000; // ETH per 1 USDT

      setUniswapRates({
        ethToUSDC,
        ethToUSDT,
        usdcToETH,
        usdtToETH,
        lastUpdated: Date.now(),
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setUniswapRates((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch rates',
      }));
    }
  }, [getUniswapQuote, USDC_ADDRESS, USDT_ADDRESS]);

  // Auto-refresh Uniswap rates every 30 seconds
  useMemo(() => {
    fetchUniswapRates();
    const interval = setInterval(fetchUniswapRates, 30000);
    return () => clearInterval(interval);
  }, [fetchUniswapRates]);

  /**
   * Get token balance for a specific currency
   */
  const useTokenBalance = (currency: Currency): TokenBalance => {
    const tokenAddress = currency === 'USDC' ? USDC_ADDRESS : USDT_ADDRESS;
    const decimals = SUPPORTED_CURRENCIES[currency].decimals;

    const { data: balance = BigInt(0) } = useReadContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [walletAddress!],
      query: {
        enabled: !!walletAddress,
        refetchInterval: 10000, // Refetch every 10 seconds
      },
    });

    return {
      balance,
      formattedBalance: formatUnits(balance, decimals),
      decimals,
    };
  };

  /**
   * Check current allowance for AcesSwap contract
   */
  const useTokenAllowance = (currency: Currency) => {
    const tokenAddress = currency === 'USDC' ? USDC_ADDRESS : USDT_ADDRESS;

    const { data: allowance = BigInt(0), refetch: refetchAllowance } = useReadContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [walletAddress!, ACES_SWAP_ADDRESS as Address],
      query: {
        enabled: !!walletAddress && isSwapContractReady,
        refetchInterval: 5000, // Refetch every 5 seconds during active usage
      },
    });

    return { allowance, refetchAllowance };
  };

  /**
   * Enhanced swap quote calculation using Uniswap rates
   * This eliminates price feed mismatches by using actual DEX rates
   */
  const calculateSwapQuote = useCallback(
    (
      ethAmountFromQuote: string, // ETH amount returned from bonding curve getQuote
      _ethPriceUSD: number, // Legacy parameter - now ignored in favor of Uniswap rates
      currency: Currency,
      shareCount: bigint,
      slippageTolerance: number = 5.0,
    ): SwapQuote | null => {
      if (!ethAmountFromQuote || !shareCount || currency === 'ETH') return null;

      // Wait for Uniswap rates to load
      if (uniswapRates.isLoading || uniswapRates.error) {
        return null;
      }

      const ethAmount = Number(ethAmountFromQuote);

      // Use Uniswap rate instead of external price feed
      const ethToStablecoinRate =
        currency === 'USDC' ? uniswapRates.ethToUSDC : uniswapRates.ethToUSDT;

      if (ethToStablecoinRate <= 0) {
        return null;
      }

      // Calculate required stablecoin using Uniswap rate
      const theoreticalStablecoin = ethAmount * ethToStablecoinRate;

      // CRITICAL FIX: Much larger buffer to handle Uniswap slippage
      // We need to send significantly more USDC to ensure we get enough ETH
      const bufferedStablecoin = theoreticalStablecoin * 1.12; // 12% buffer instead of 8%

      // Convert to proper units
      const decimals = SUPPORTED_CURRENCIES[currency].decimals;
      const inputAmount = parseUnits(bufferedStablecoin.toFixed(decimals), decimals);
      const ethAmountWei = parseUnits(ethAmountFromQuote, 18);

      // CRITICAL FIX: Apply small safety margin to minimum ETH out
      // The bonding curve needs exactly this amount, but Uniswap has slippage
      // So we reduce our minimum by 1% to avoid the exact threshold issue
      const safetyMargin = 0.99; // 1% safety margin
      const minimumETHOut = BigInt(Math.floor(Number(ethAmountWei) * safetyMargin));

      return {
        inputAmount, // USDC/USDT with 12% buffer
        minimumETHOut, // ETH needed with 1% safety margin
        shareCount,
        slippageTolerance,
        uniswapRate: ethToStablecoinRate,
        actualCostFormatted: bufferedStablecoin.toFixed(6),
      };
    },
    [uniswapRates],
  );

  /**
   * Approve token spending for AcesSwap contract
   */
  const approveToken = useCallback(
    async (currency: Currency, amount: bigint): Promise<boolean> => {
      if (!walletAddress) {
        setSwapState({ isLoading: false, error: 'Wallet not connected', step: 'idle' });
        return false;
      }

      if (!isSwapContractReady) {
        setSwapState({
          isLoading: false,
          error: 'AcesSwap contract not deployed on this network',
          step: 'idle',
        });
        return false;
      }

      const tokenAddress = currency === 'USDC' ? USDC_ADDRESS : USDT_ADDRESS;

      try {
        setSwapState({ isLoading: true, error: null, step: 'approving' });

        const hash = await writeContractAsync({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [ACES_SWAP_ADDRESS as Address, amount],
          chain: base,
          account: walletAddress,
          gas: BigInt(60000), // 60k gas limit for ERC20 approval
        });

        setSwapState((prev) => ({ ...prev, transactionHash: hash }));

        try {
          const { waitForTransactionReceipt } = await import('wagmi/actions');

          const receipt = await waitForTransactionReceipt(wagmiConfig, {
            hash,
            timeout: 60_000,
          });
          setSwapState({ isLoading: false, error: null, step: 'success', transactionHash: hash });
          return true;
        } catch (waitError) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          setSwapState({ isLoading: false, error: null, step: 'success', transactionHash: hash });
          return true;
        }
      } catch (error) {
        setSwapState({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Approval failed',
          step: 'idle',
        });
        return false;
      }
    },
    [walletAddress, writeContractAsync],
  );

  /**
   * Execute swap transaction (USDC/USDT → ETH → ACES)
   */
  const executeSwap = useCallback(
    async (currency: Currency, quote: SwapQuote): Promise<boolean> => {
      if (!walletAddress) {
        setSwapState({ isLoading: false, error: 'Wallet not connected', step: 'idle' });
        return false;
      }

      if (!isSwapContractReady) {
        setSwapState({
          isLoading: false,
          error: 'AcesSwap contract not deployed on this network',
          step: 'idle',
        });
        return false;
      }

      try {
        setSwapState({ isLoading: true, error: null, step: 'swapping' });

        const functionName = currency === 'USDC' ? 'sellUSDCAndBuyCurve' : 'sellUSDTAndBuyCurve';
        const tokensOut = quote.shareCount;

        // Final pre-flight checks
        const finalAllowance = await readContract(wagmiConfig, {
          address: currency === 'USDC' ? USDC_ADDRESS : USDT_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [walletAddress, ACES_SWAP_ADDRESS],
        });

        const finalBalance = await readContract(wagmiConfig, {
          address: currency === 'USDC' ? USDC_ADDRESS : USDT_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [walletAddress],
        });

        if (finalAllowance < quote.inputAmount) {
          throw new Error(
            `Insufficient allowance: have ${finalAllowance.toString()}, need ${quote.inputAmount.toString()}`,
          );
        }

        if (finalBalance < quote.inputAmount) {
          throw new Error(
            `Insufficient balance: have ${finalBalance.toString()}, need ${quote.inputAmount.toString()}`,
          );
        }

        // Verify AcesSwap contract accessibility
        try {
          await readContract(wagmiConfig, {
            address: ACES_SWAP_ADDRESS as Address,
            abi: ACES_SWAP_ABI,
            functionName: 'getCurvesAddress',
            args: [],
          });
        } catch (error) {
          throw new Error('AcesSwap contract is not accessible. Please try again later.');
        }

        const hash = await writeContractAsync({
          address: ACES_SWAP_ADDRESS as Address,
          abi: ACES_SWAP_ABI,
          functionName,
          args: [
            quote.inputAmount, // amountIn (USDC/USDT, 6 decimals)
            quote.minimumETHOut, // amountOutMin (ETH, 18 decimals)
            SHARES_SUBJECT_ADDRESS, // roomOwner (address)
            ROOM_NUMBER, // roomNumber (uint256)
            tokensOut, // amount (ACES tokens expected)
          ],
          chain: base,
          account: walletAddress,
          gas: BigInt(500000), // 500k gas limit for swap
        });

        setSwapState((prev) => ({ ...prev, transactionHash: hash }));

        try {
          const { waitForTransactionReceipt } = await import('wagmi/actions');

          const receipt = await waitForTransactionReceipt(wagmiConfig, {
            hash,
            timeout: 120_000,
          });
          setSwapState({ isLoading: false, error: null, step: 'success', transactionHash: hash });
          return true;
        } catch (waitError) {
          await new Promise((resolve) => setTimeout(resolve, 8000));
          setSwapState({ isLoading: false, error: null, step: 'success', transactionHash: hash });
          return true;
        }
      } catch (error) {
        setSwapState({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Swap failed',
          step: 'idle',
        });
        return false;
      }
    },
    [walletAddress, writeContractAsync],
  );

  /**
   * Complete swap workflow: check allowance → approve if needed → execute swap
   * This function should be called with the exact ETH cost and share count from bonding curve getQuote
   */
  const performCompleteSwap = useCallback(
    async (
      currency: Currency,
      ethCostFromQuote: string, // ETH cost from bonding curve getQuote (formatEther result)
      shareCount: bigint,
      _ethPriceUSD: number, // Legacy parameter - ignored in favor of Uniswap rates
      slippageTolerance: number = 5.0,
    ): Promise<boolean> => {
      if (!walletAddress) {
        setSwapState({ isLoading: false, error: 'Wallet not connected', step: 'idle' });
        return false;
      }

      // Calculate quote using Uniswap rates
      const quote = calculateSwapQuote(
        ethCostFromQuote,
        0, // ethPriceUSD ignored
        currency,
        shareCount,
        slippageTolerance,
      );

      if (!quote) {
        setSwapState({
          isLoading: false,
          error: uniswapRates.error || 'Invalid swap parameters - Uniswap rates not available',
          step: 'idle',
        });
        return false;
      }

      try {
        setSwapState({ isLoading: true, error: null, step: 'checking-allowance' });

        const tokenAddress = currency === 'USDC' ? USDC_ADDRESS : USDT_ADDRESS;

        const allowance = (await readContract(wagmiConfig, {
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [walletAddress, ACES_SWAP_ADDRESS as Address],
        })) as bigint;

        if (allowance < quote.inputAmount) {
          const approvalSuccess = await approveToken(currency, quote.inputAmount);
          if (!approvalSuccess) return false;

          // Wait and re-check allowance
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const newAllowance = (await readContract(wagmiConfig, {
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [walletAddress, ACES_SWAP_ADDRESS as Address],
          })) as bigint;
        }

        // Execute swap
        return await executeSwap(currency, quote);
      } catch (error) {
        setSwapState({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Swap workflow failed',
          step: 'idle',
        });
        return false;
      }
    },
    [walletAddress, calculateSwapQuote, approveToken, executeSwap],
  );

  /**
   * Get USDC/USDT quote for a given USD amount using Uniswap rates
   */
  const getStablecoinQuote = useCallback(
    async (
      usdAmount: number,
      currency: Currency,
      getBondingCurveQuote: (ethAmount: string) => Promise<QuoteResult>,
      _ethPriceUSD: number, // Legacy parameter - ignored
      slippageTolerance: number = 5.0,
    ): Promise<{
      quote: SwapQuote | null;
      tokensOut: bigint;
      actualUSDCost: number;
    }> => {
      try {
        // Wait for Uniswap rates
        if (uniswapRates.isLoading) {
          return { quote: null, tokensOut: BigInt(0), actualUSDCost: 0 };
        }

        if (uniswapRates.error) {
          return { quote: null, tokensOut: BigInt(0), actualUSDCost: 0 };
        }

        // Convert USD amount to ETH using Uniswap rates
        const ethRate = currency === 'USDC' ? uniswapRates.usdcToETH : uniswapRates.usdtToETH;
        const ethEquivalent = usdAmount * ethRate;

        // Get quote from bonding curve
        const bondingCurveQuote = await getBondingCurveQuote(ethEquivalent.toString());

        if (bondingCurveQuote.tokensOut === BigInt(0)) {
          return { quote: null, tokensOut: BigInt(0), actualUSDCost: 0 };
        }

        // Calculate the swap quote using exact ETH cost
        const ethCostFormatted = formatUnits(bondingCurveQuote.ethCost, 18);
        const swapQuote = calculateSwapQuote(
          ethCostFormatted,
          0, // ethPriceUSD ignored
          currency,
          bondingCurveQuote.shareCount,
          slippageTolerance,
        );

        if (!swapQuote) {
          return { quote: null, tokensOut: BigInt(0), actualUSDCost: 0 };
        }

        // Calculate actual USD cost
        const actualUSDCost = Number(swapQuote.actualCostFormatted || '0');

        return {
          quote: swapQuote,
          tokensOut: bondingCurveQuote.tokensOut,
          actualUSDCost,
        };
      } catch (error) {
        return { quote: null, tokensOut: BigInt(0), actualUSDCost: 0 };
      }
    },
    [calculateSwapQuote, uniswapRates],
  );

  /**
   * Reset swap state
   */
  const resetSwapState = useCallback(() => {
    setSwapState({ isLoading: false, error: null, step: 'idle' });
  }, []);

  /**
   * Refresh Uniswap rates manually
   */
  const refreshUniswapRates = useCallback(() => {
    fetchUniswapRates();
  }, [fetchUniswapRates]);

  return {
    // State
    swapState,
    uniswapRates,

    // Contract addresses (for debugging)
    contractAddresses: {
      acesSwap: ACES_SWAP_ADDRESS,
      usdc: USDC_ADDRESS,
      usdt: USDT_ADDRESS,
      sharesSubject: SHARES_SUBJECT_ADDRESS,
      roomNumber: Number(ROOM_NUMBER),
    },

    // Hooks
    useTokenBalance,
    useTokenAllowance,

    // Functions
    calculateSwapQuote,
    approveToken,
    executeSwap,
    performCompleteSwap,
    getStablecoinQuote,
    resetSwapState,
    refreshUniswapRates,

    // Utilities
    isContractReady: isSwapContractReady,
    isUniswapRatesReady: !uniswapRates.isLoading && !uniswapRates.error,
  };
}
