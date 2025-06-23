export const lerp = (start: number, end: number, factor: number) => {
  return start + (end - start) * factor;
};

export const easeInOutCubic = (t: number) => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/**
 * Round a number to specified decimal places
 * More efficient than repeated Math.round(x * 100) / 100 patterns
 */
export function roundToDecimals(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Round to 2 decimal places (common for scale factors)
 */
export function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Round to 3 decimal places (common for precise scale factors)
 */
export function roundTo3Decimals(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Check if two numbers are approximately equal (useful for floating point comparisons)
 */
export function isApproximatelyEqual(a: number, b: number, tolerance = 0.01): boolean {
  return Math.abs(a - b) <= tolerance;
}
