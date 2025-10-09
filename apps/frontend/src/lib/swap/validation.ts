import { ethers } from 'ethers';
import type { ValidationResult, DexQuoteResponse } from './types';

/**
 * Validate swap amount against balance and constraints
 * @param params - Validation parameters
 * @returns Validation result with error message if invalid
 */
export function validateSwapAmount(params: {
  amount: string;
  balance: string;
  decimals: number;
  minAmount?: string;
}): ValidationResult {
  const { amount, balance, decimals, minAmount } = params;

  if (!amount || amount.trim() === '') {
    return {
      isValid: false,
      error: 'Enter an amount',
    };
  }

  try {
    const amountWei = ethers.utils.parseUnits(amount, decimals);
    const balanceWei = ethers.utils.parseUnits(balance, decimals);

    if (amountWei.lte(ethers.constants.Zero)) {
      return {
        isValid: false,
        error: 'Enter an amount greater than zero',
      };
    }

    if (amountWei.gt(balanceWei)) {
      return {
        isValid: false,
        error: 'Insufficient balance',
      };
    }

    if (minAmount) {
      const minAmountWei = ethers.utils.parseUnits(minAmount, decimals);
      if (amountWei.lt(minAmountWei)) {
        return {
          isValid: false,
          error: `Minimum amount is ${minAmount}`,
        };
      }
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid amount format',
    };
  }
}

/**
 * Check if amount exceeds bonding curve limits
 * @param params - Curve limit parameters
 * @returns True if amount is within limits
 */
export function checkCurveLimits(params: {
  amountWei: ethers.BigNumber;
  remainingWei: ethers.BigNumber;
}): boolean {
  const { amountWei, remainingWei } = params;
  return amountWei.lte(remainingWei);
}

/**
 * Validate Ethereum address format
 * @param address - Address string to validate
 * @returns True if valid address
 */
export function isValidTokenAddress(address: string): boolean {
  try {
    return ethers.utils.isAddress(address);
  } catch (error) {
    return false;
  }
}

/**
 * Validate quote has required fields
 * @param quote - DEX quote response
 * @returns True if quote is valid and usable
 */
export function validateDexQuote(quote: DexQuoteResponse | null): boolean {
  if (!quote) {
    return false;
  }

  return Boolean(
    quote.inputAmountRaw &&
      quote.expectedOutput &&
      quote.minOutputRaw &&
      quote.path &&
      Array.isArray(quote.path) &&
      quote.path.length > 0,
  );
}

/**
 * Validate that a value is a valid positive number
 * @param value - String value to validate
 * @returns True if valid positive number
 */
export function isValidPositiveNumber(value: string): boolean {
  if (!value || value.trim() === '') {
    return false;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0;
}

/**
 * Validate slippage BPS value (0-10000)
 * @param slippageBps - Slippage in basis points
 * @returns Validation result
 */
export function validateSlippageBps(slippageBps: number): ValidationResult {
  if (!Number.isFinite(slippageBps)) {
    return {
      isValid: false,
      error: 'Slippage must be a number',
    };
  }

  if (slippageBps < 0) {
    return {
      isValid: false,
      error: 'Slippage cannot be negative',
    };
  }

  if (slippageBps > 10000) {
    return {
      isValid: false,
      error: 'Slippage cannot exceed 100%',
    };
  }

  return { isValid: true };
}
