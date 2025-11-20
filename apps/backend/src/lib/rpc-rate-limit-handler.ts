/**
 * RPC Rate Limit Error Handling Utilities
 *
 * Provides utilities to detect and handle RPC rate limit errors with retry logic.
 * Common RPC rate limit indicators:
 * - Error codes: -32005 (rate limit), -32000 (server error with rate limit)
 * - Error messages containing: "rate limit", "too many requests", "429", "throttle"
 * - HTTP 429 status codes
 */

import { FastifyBaseLogger } from 'fastify';

/**
 * Common RPC rate limit error codes
 */
const RATE_LIMIT_ERROR_CODES = [
  -32005, // Rate limit exceeded
  -32000, // Server error (often used for rate limits)
  429, // HTTP 429 Too Many Requests
];

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
  if (!error) return false;

  // Check if it's an ethers.js error
  if (typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'number' && RATE_LIMIT_ERROR_CODES.includes(code)) {
      return true;
    }
  }

  // Check error message
  const message = error instanceof Error ? error.message : String(error);
  const messageLower = message.toLowerCase();

  return (
    messageLower.includes('rate limit') ||
    messageLower.includes('too many requests') ||
    messageLower.includes('429') ||
    messageLower.includes('throttle') ||
    messageLower.includes('rate exceeded') ||
    messageLower.includes('quota exceeded')
  );
}

/**
 * Get retry delay with exponential backoff
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds (default: 500ms)
 * @param maxDelayMs - Maximum delay in milliseconds (default: 5000ms)
 * @param retryAfterHeader - Optional retry-after header value (seconds)
 */
export function getRetryDelay(
  attempt: number,
  baseDelayMs: number = 500,
  maxDelayMs: number = 5000,
  retryAfterHeader?: number,
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);

  // If retry-after header is present, use it (convert to ms)
  if (retryAfterHeader !== undefined) {
    const retryAfterMs = retryAfterHeader * 1000;
    return Math.max(retryAfterMs, exponentialDelay);
  }

  return exponentialDelay;
}

/**
 * Retry an async function with exponential backoff on rate limit errors
 * @param fn - Function to retry
 * @param options - Retry options
 */
export async function retryOnRateLimit<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    logger?: FastifyBaseLogger;
    operationName?: string;
  } = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 500,
    maxDelayMs = 5000,
    logger,
    operationName = 'operation',
  } = options;

  let lastError: Error | unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Only retry on rate limit errors
      if (!isRateLimitError(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt >= maxRetries) {
        logger?.warn(
          {
            err: error,
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            operation: operationName,
          },
          `❌ [RateLimitRetry] Max retries exceeded for ${operationName}`,
        );
        break;
      }

      // Calculate delay
      const delay = getRetryDelay(attempt, baseDelayMs, maxDelayMs);

      logger?.warn(
        {
          err: error,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          delay,
          operation: operationName,
        },
        `⚠️ [RateLimitRetry] Rate limit detected, retrying ${operationName} in ${delay}ms`,
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Throw last error if all retries failed
  throw lastError || new Error(`Failed ${operationName} after ${maxRetries + 1} attempts`);
}

/**
 * Wrap an RPC contract call with rate limit retry logic
 */
export async function retryRpcCall<T>(
  contractCall: () => Promise<T>,
  options: {
    maxRetries?: number;
    logger?: FastifyBaseLogger;
    operationName?: string;
  } = {},
): Promise<T> {
  return retryOnRateLimit(contractCall, {
    maxRetries: options.maxRetries ?? 3,
    baseDelayMs: 500,
    maxDelayMs: 5000,
    logger: options.logger,
    operationName: options.operationName ?? 'RPC call',
  });
}

/**
 * Create a user-friendly error message for rate limit errors
 */
export function getRateLimitErrorMessage(error: unknown): string {
  if (isRateLimitError(error)) {
    return 'Service temporarily unavailable due to high demand. Please try again in a moment.';
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred';
}

