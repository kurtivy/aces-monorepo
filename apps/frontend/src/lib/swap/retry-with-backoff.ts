/**
 * Exponential Backoff with Jitter
 * 
 * Retries failed requests with exponentially increasing delays plus random jitter.
 * This prevents thundering herd problems when rate limits are hit.
 * 
 * Key Features:
 * - Exponential backoff (delay doubles each retry)
 * - Random jitter (prevents synchronized retries)
 * - Configurable max retries and delays
 * - Rate limit detection (HTTP 429, 503)
 */

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number; // 0-1, amount of randomness to add
  retryableStatusCodes: number[];
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 10000,
  jitterFactor: 0.3, // 30% jitter
  retryableStatusCodes: [408, 429, 500, 502, 503, 504], // Client/server errors + rate limit
};

interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDelayMs: number;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  config: RetryConfig,
): number {
  // Exponential backoff: delay = initialDelay * 2^attempt
  const exponentialDelay = config.initialDelayMs * Math.pow(2, attempt);
  
  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  
  // Add jitter: random value between (1 - jitter) and (1 + jitter)
  const jitterRange = cappedDelay * config.jitterFactor;
  const jitter = (Math.random() * 2 - 1) * jitterRange;
  
  return Math.max(0, cappedDelay + jitter);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any, config: RetryConfig): boolean {
  // HTTP errors with retryable status codes
  if (error?.response?.status) {
    return config.retryableStatusCodes.includes(error.response.status);
  }

  // Network errors
  if (error?.message) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('econnrefused') ||
      msg.includes('rate limit')
    );
  }

  return false;
}

/**
 * Execute request with exponential backoff retry logic
 */
export async function retryWithBackoff<T>(
  requestFn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<RetryResult<T>> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | undefined;
  let totalDelay = 0;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      // First attempt happens immediately (no delay)
      if (attempt > 0) {
        const delay = calculateDelay(attempt - 1, finalConfig);
        totalDelay += delay;
        
        console.log(
          `[RetryWithBackoff] Attempt ${attempt + 1}/${finalConfig.maxRetries + 1} after ${delay.toFixed(0)}ms delay`,
        );
        
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const data = await requestFn();
      
      if (attempt > 0) {
        console.log(
          `[RetryWithBackoff] ✅ Success after ${attempt} ${attempt === 1 ? 'retry' : 'retries'}`,
        );
      }

      return {
        success: true,
        data,
        attempts: attempt + 1,
        totalDelayMs: totalDelay,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if we should retry
      const shouldRetry = isRetryableError(error, finalConfig);
      const hasRetriesLeft = attempt < finalConfig.maxRetries;

      if (!shouldRetry) {
        console.log('[RetryWithBackoff] ❌ Non-retryable error:', lastError.message);
        break;
      }

      if (!hasRetriesLeft) {
        console.log(
          `[RetryWithBackoff] ❌ Max retries (${finalConfig.maxRetries}) exceeded:`,
          lastError.message,
        );
        break;
      }

      console.warn(
        `[RetryWithBackoff] ⚠️ Attempt ${attempt + 1} failed (${lastError.message}), will retry...`,
      );
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: finalConfig.maxRetries + 1,
    totalDelayMs: totalDelay,
  };
}

/**
 * Preset configurations for different scenarios
 */
export const RetryPresets = {
  /** Fast retry for user-facing quotes (3 retries, max 5s total) */
  QUOTE_FAST: {
    maxRetries: 3,
    initialDelayMs: 300,
    maxDelayMs: 2000,
    jitterFactor: 0.3,
  },

  /** Aggressive retry for critical operations (5 retries, max 30s total) */
  CRITICAL: {
    maxRetries: 5,
    initialDelayMs: 500,
    maxDelayMs: 10000,
    jitterFactor: 0.3,
  },

  /** Conservative retry for non-urgent operations (2 retries, max 10s total) */
  CONSERVATIVE: {
    maxRetries: 2,
    initialDelayMs: 1000,
    maxDelayMs: 5000,
    jitterFactor: 0.4,
  },
};


