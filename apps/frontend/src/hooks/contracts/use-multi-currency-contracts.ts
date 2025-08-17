'use client';

import { useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useBalance, useWriteContract, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useBondingCurveContracts } from './use-bonding-curve-contract';
import {
  Currency,
  SUPPORTED_CURRENCIES,
  MultiCurrencyQuoteResult,
  WalletBalances,
} from '@/types/contracts';

// Placeholder pre-contract address (will be updated when deployed)
const PRE_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

// Standard ERC20 ABI for approvals and balance checks
const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export function useMultiCurrencyContracts() {
  const { ready, authenticated, user } = usePrivy();
  const bondingCurveHook = useBondingCurveContracts();
  const { writeContractAsync } = useWriteContract();

  // Get balances for all supported currencies
  const { data: usdcBalance } = useBalance({
    address: user?.wallet?.address as `0x${string}`,
    token: SUPPORTED_CURRENCIES.USDC.address,
    query: { enabled: ready && authenticated && !!user?.wallet?.address },
  });

  const { data: usdtBalance } = useBalance({
    address: user?.wallet?.address as `0x${string}`,
    token: SUPPORTED_CURRENCIES.USDT.address,
    query: { enabled: ready && authenticated && !!user?.wallet?.address },
  });

  // Get allowances for ERC20 tokens
  const { data: usdcAllowance } = useReadContract({
    address: SUPPORTED_CURRENCIES.USDC.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [user?.wallet?.address as `0x${string}`, PRE_CONTRACT_ADDRESS],
    query: { enabled: ready && authenticated && !!user?.wallet?.address },
  });

  const { data: usdtAllowance } = useReadContract({
    address: SUPPORTED_CURRENCIES.USDT.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [user?.wallet?.address as `0x${string}`, PRE_CONTRACT_ADDRESS],
    query: { enabled: ready && authenticated && !!user?.wallet?.address },
  });

  // Get wallet balances for all currencies
  const getWalletBalances = useCallback((): WalletBalances => {
    return {
      ETH: bondingCurveHook.contractState?.ethBalance || BigInt(0),
      USDC: usdcBalance?.value || BigInt(0),
      USDT: usdtBalance?.value || BigInt(0),
      tokens: bondingCurveHook.contractState?.tokenBalance || BigInt(0),
    };
  }, [bondingCurveHook.contractState, usdcBalance, usdtBalance]);

  // Get quote for multi-currency purchase
  const getMultiCurrencyQuote = useCallback(
    async (amount: number, currency: Currency): Promise<MultiCurrencyQuoteResult> => {
      if (!ready || !authenticated) throw new Error('Not authenticated');

      const currencyInfo = SUPPORTED_CURRENCIES[currency];

      if (currency === 'ETH') {
        // Use existing ETH quote logic
        const ethQuote = await bondingCurveHook.getQuote(amount.toString());

        // Calculate missing properties from available data
        const currentPrice = bondingCurveHook.contractState?.currentPrice || BigInt(0);
        const ethPriceUSD = bondingCurveHook.ethPrice.current;
        const ethCostInETH = Number(ethQuote.ethCost) / 1e18;
        const tokensOutCount = Number(ethQuote.tokensOut) / 1e18;

        return {
          tokensOut: ethQuote.tokensOut,
          cost: ethQuote.ethCost,
          currency: 'ETH',
          pricePerToken: currentPrice,
          usdCost: ethCostInETH * ethPriceUSD,
          usdPerToken: tokensOutCount > 0 ? (ethCostInETH * ethPriceUSD) / tokensOutCount : 0,
        };
      } else {
        // For stablecoins, estimate the conversion path
        // This is a simplified estimation until the pre-contract is ready

        // Convert stablecoin amount to wei (accounting for decimals)
        const stablecoinAmountWei = parseUnits(amount.toString(), currencyInfo.decimals);

        // Estimate ETH amount (assuming ~1:1 USD parity for stablecoins)
        const ethAmount = amount / bondingCurveHook.ethPrice.current;
        const ethAmountWei = parseUnits(ethAmount.toString(), 18);

        // Get token estimate using current bonding curve price
        const currentPrice = bondingCurveHook.contractState?.currentPrice || BigInt(0);
        let estimatedTokens = BigInt(0);

        if (currentPrice > BigInt(0)) {
          estimatedTokens = (ethAmountWei * BigInt(1e18)) / currentPrice;
          // Add buffer for conversion slippage and price impact
          estimatedTokens = (estimatedTokens * BigInt(90)) / BigInt(100); // 90% of estimate
        }

        return {
          tokensOut: estimatedTokens,
          cost: stablecoinAmountWei,
          currency,
          pricePerToken: currentPrice,
          usdCost: amount,
          usdPerToken: (Number(currentPrice) / 1e18) * bondingCurveHook.ethPrice.current,
          conversionPath: {
            inputAmount: stablecoinAmountWei,
            ethAmount: ethAmountWei,
            tokenAmount: estimatedTokens,
          },
        };
      }
    },
    [ready, authenticated, bondingCurveHook],
  );

  // Check if approval is needed for a currency
  const needsApproval = useCallback(
    (amount: bigint, currency: Currency): boolean => {
      if (currency === 'ETH') return false;

      const allowance =
        currency === 'USDC' ? usdcAllowance || BigInt(0) : usdtAllowance || BigInt(0);
      return allowance < amount;
    },
    [usdcAllowance, usdtAllowance],
  );

  // Approve ERC20 token spending
  const approveToken = useCallback(
    async (amount: bigint, currency: Currency): Promise<`0x${string}`> => {
      if (!ready || !authenticated) throw new Error('Not authenticated');
      if (currency === 'ETH') throw new Error('ETH does not require approval');

      const tokenAddress = SUPPORTED_CURRENCIES[currency].address;
      if (!tokenAddress) throw new Error(`No address found for ${currency}`);

      const hash = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [PRE_CONTRACT_ADDRESS, amount],
        account: user?.wallet?.address as `0x${string}`,
      });

      return hash;
    },
    [ready, authenticated, writeContractAsync, user?.wallet?.address],
  );

  // Execute multi-currency purchase
  const buyTokensWithCurrency = useCallback(
    async (tokenAmount: bigint, maxCost: bigint, currency: Currency): Promise<`0x${string}`> => {
      if (!ready || !authenticated) throw new Error('Not authenticated');

      if (currency === 'ETH') {
        // Use existing ETH purchase logic
        return bondingCurveHook.buyTokens(tokenAmount, maxCost);
      } else {
        // TODO: Implement pre-contract calls when ready
        // For now, throw error indicating feature is not ready
        throw new Error(
          `${currency} purchases are not yet implemented. The pre-contract is still in development.`,
        );

        // When pre-contract is ready, this will be:
        // const hash = await writeContractAsync({
        //   address: PRE_CONTRACT_ADDRESS,
        //   abi: PRE_CONTRACT_ABI,
        //   functionName: currency === 'USDC' ? 'buyWithUSDC' : 'buyWithUSDT',
        //   args: [tokenAmount, maxCost],
        //   account: user?.wallet?.address as `0x${string}`,
        // });
        // return hash;
      }
    },
    [ready, authenticated, bondingCurveHook, writeContractAsync, user?.wallet?.address],
  );

  return {
    // Inherit all existing functionality
    ...bondingCurveHook,

    // Multi-currency extensions
    getWalletBalances,
    getMultiCurrencyQuote,
    needsApproval,
    approveToken,
    buyTokensWithCurrency,

    // Balance information
    balances: getWalletBalances(),

    // Allowance information
    allowances: {
      USDC: usdcAllowance || BigInt(0),
      USDT: usdtAllowance || BigInt(0),
    },

    // Pre-contract status
    preContractReady: false, // Will be true when pre-contract is deployed
    preContractAddress: PRE_CONTRACT_ADDRESS,
  };
}
