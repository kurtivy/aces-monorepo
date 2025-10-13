import { ethers } from 'ethers';

/**
 * Format amount for display with proper decimal places
 * @param value - Raw amount string
 * @param decimals - Token decimals (6 for USDC/USDT, 18 for others)
 * @returns Formatted string for UI display
 */
export function formatAmountForDisplay(value: string, decimals: number): string {
  const parsed = Number.parseFloat(value || '0');
  if (!Number.isFinite(parsed) || parsed === 0) {
    return '0';
  }

  if (parsed < 0.0001) {
    return '<0.0001';
  }

  const maxDecimals = Math.min(decimals, 6);
  return parsed.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });
}

/**
 * Format DEX quote amount with fixed 2 decimal places
 * @param rawAmount - Raw amount from quote
 * @returns Formatted string with 2 decimal places
 */
export function formatDexAmount(rawAmount: string): string {
  const parsed = Number.parseFloat(rawAmount || '0');
  if (!Number.isFinite(parsed)) {
    return '0.00';
  }
  return parsed.toFixed(2);
}

/**
 * Remove trailing zeros from decimal string
 * @param value - Decimal string
 * @returns String without trailing zeros
 */
export function trimTrailingZeros(value: string): string {
  if (!value.includes('.')) {
    return value;
  }
  return value.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
}

/**
 * Parse user input to BigNumber with proper decimals
 * @param input - User input string
 * @param decimals - Token decimals
 * @returns BigNumber or null if invalid
 */
export function parseUserInput(input: string, decimals: number): ethers.BigNumber | null {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = ethers.utils.parseUnits(trimmed, decimals);
    return parsed.gt(ethers.constants.Zero) ? parsed : null;
  } catch (error) {
    return null;
  }
}

/**
 * Format balance for display in UI
 * @param balance - Raw balance in wei
 * @param decimals - Token decimals
 * @returns Formatted balance string
 */
export function formatBalance(balance: ethers.BigNumber, decimals: number): string {
  try {
    const formatted = ethers.utils.formatUnits(balance, decimals);
    const parsed = Number.parseFloat(formatted);

    if (!Number.isFinite(parsed)) {
      return '0';
    }

    if (parsed < 0.0001 && parsed > 0) {
      return '<0.0001';
    }

    return parsed.toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch (error) {
    console.error('Failed to format balance:', error);
    return '0';
  }
}

/**
 * Format balance with fixed decimal places
 * @param balance - Balance string or number
 * @param decimals - Number of decimal places to show
 * @returns Formatted string
 */
export function formatBalanceFixed(balance: string | number, decimals: number = 4): string {
  const numeric = typeof balance === 'string' ? Number.parseFloat(balance) : balance;
  if (!Number.isFinite(numeric)) {
    return '0'.padEnd(decimals + 2, '0');
  }
  return numeric.toFixed(decimals);
}

/**
 * Format USD value for display
 * @param usdValue - USD value as string or number
 * @returns Formatted USD string with $ prefix
 */
export function formatUsdValue(usdValue: string | number): string | null {
  const numericValue = typeof usdValue === 'string' ? Number.parseFloat(usdValue) : usdValue;

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return `$${numericValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USD`;
}
