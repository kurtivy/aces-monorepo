/**
 * Platform fee calculation utilities for bonding curve swaps
 * Fees are applied to the output USD value (what user receives after fees)
 */

/**
 * Get platform fee in basis points based on payment asset
 * @param paymentAsset - The asset being used to buy RWA tokens (ACES, ETH, USDC, USDT, etc.)
 * @returns Fee in basis points (100 = 1%)
 */
export function getPlatformFeeBps(paymentAsset: string): number {
  const normalized = paymentAsset.toUpperCase();
  switch (normalized) {
    case 'ACES':
      return 100; // 1% platform fee
    case 'ETH':
    case 'WETH':
      return 125; // 1.25% total (0.25% Aerodrome swap + 1% platform)
    case 'USDC':
    case 'USDT':
      return 150; // 1.5% total (0.25% + 0.25% DEX hops + 1% platform)
    default:
      return 100; // Default to 1%
  }
}

/**
 * Apply platform fee to a USD value
 * Subtracts the fee from the value to show what user actually receives
 * @param usdValue - The USD value as a string (e.g., "100.00")
 * @param feeBps - Fee in basis points (e.g., 100 for 1%)
 * @returns Adjusted USD value after fee deduction, or null if invalid
 */
export function applyFeeToUsdValue(usdValue: string | null, feeBps: number): string | null {
  if (!usdValue) return null;
  const value = parseFloat(usdValue);
  if (!isFinite(value) || value <= 0) return null;

  // Subtract fee: finalValue = value * (1 - fee/10000)
  const multiplier = (10000 - feeBps) / 10000;
  return (value * multiplier).toFixed(2);
}

/**
 * Apply slippage tolerance to a USD value
 * Calculates the minimum USD value user will receive with slippage
 * @param usdValue - The USD value as a string (e.g., "100.00")
 * @param slippageBps - Slippage tolerance in basis points (e.g., 300 for 3%)
 * @returns Minimum USD value after slippage, or null if invalid
 */
export function applySlippageToUsdValue(
  usdValue: string | null,
  slippageBps: number,
): string | null {
  if (!usdValue) return null;
  const value = parseFloat(usdValue);
  if (!isFinite(value) || value <= 0) return null;

  // Apply slippage: minValue = value * (1 - slippage/10000)
  const multiplier = (10000 - slippageBps) / 10000;
  return (value * multiplier).toFixed(2);
}
