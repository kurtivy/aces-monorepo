/**
 * Validates if a string is a valid Ethereum address (40 hex characters)
 * @param address - The address string to validate
 * @returns true if valid Ethereum address format, false otherwise
 */
export function isValidEthereumAddress(address: string | null | undefined): address is string {
  if (!address) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Returns the address if valid, otherwise returns undefined
 * @param address - The address string to validate
 * @returns The validated address or undefined
 */
export function validateEthereumAddress(address: string | null | undefined): string | undefined {
  return isValidEthereumAddress(address) ? address : undefined;
}

/**
 * Logs a warning for invalid addresses and returns undefined
 * Useful for debugging invalid addresses in production
 * @param address - The address to validate
 * @param context - Context string for the warning message
 * @returns The validated address or undefined
 */
export function validateAndWarnAddress(
  address: string | null | undefined,
  context: string,
): string | undefined {
  if (!address) return undefined;

  if (!isValidEthereumAddress(address)) {
    console.warn(`[${context}] Invalid Ethereum address format: ${address}`);
    return undefined;
  }

  return address;
}
