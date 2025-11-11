/**
 * WebSocket Reconnection Utilities
 * 
 * Provides exponential backoff with jitter to prevent reconnection storms.
 * When many clients disconnect simultaneously (e.g., backend restart),
 * this spreads reconnection attempts over time instead of all at once.
 */

/**
 * Calculate reconnection delay using exponential backoff with jitter
 * 
 * @param attempt - Current reconnection attempt number (0-indexed)
 * @returns Delay in milliseconds
 * 
 * @example
 * Attempt 0: 1-2 seconds
 * Attempt 1: 2-3 seconds
 * Attempt 2: 4-5 seconds
 * Attempt 3: 8-9 seconds
 * Attempt 4: 16-17 seconds
 * Attempt 5+: 30-31 seconds (capped)
 */
export function getReconnectDelay(attempt: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 10000; // 🔥 IMPROVEMENT: Cap at 10 seconds (was 30s) for faster reconnection
  
  // Exponential backoff: 1s, 2s, 4s, 8s, 10s (capped)
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  
  // Add jitter (0-1 second random) to prevent synchronized reconnections
  const jitter = Math.random() * 1000;
  
  return exponentialDelay + jitter;
}

/**
 * Reset reconnection attempt counter on successful connection
 * 
 * This should be called in the WebSocket onopen handler to ensure
 * the next reconnection attempt starts from 0.
 */
export function resetReconnectAttempt(): number {
  return 0;
}

/**
 * Format reconnection delay for logging
 * 
 * @param delayMs - Delay in milliseconds
 * @returns Human-readable string
 */
export function formatReconnectDelay(delayMs: number): string {
  const seconds = (delayMs / 1000).toFixed(1);
  return `${seconds}s`;
}

/**
 * Check if reconnection should be attempted based on close code
 * 
 * @param code - WebSocket close code
 * @returns True if reconnection should be attempted
 * 
 * Close codes:
 * - 1000: Normal closure (don't reconnect)
 * - 1001: Going away (e.g., page navigation - don't reconnect)
 * - 1006: Abnormal closure (reconnect)
 * - 1008: Policy violation (don't reconnect)
 * - 1011: Server error (reconnect)
 */
export function shouldReconnect(code: number): boolean {
  // Don't reconnect on normal closure or policy violations
  if (code === 1000 || code === 1001 || code === 1008) {
    return false;
  }
  
  // Reconnect on abnormal closures and server errors
  return true;
}





