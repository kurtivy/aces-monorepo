/**
 * Enhanced Error Handling for Chart Data Services
 * Provides graceful degradation and recovery strategies
 */

export enum ErrorType {
  SUBGRAPH_DOWN = 'SUBGRAPH_DOWN',
  SUBGRAPH_TIMEOUT = 'SUBGRAPH_TIMEOUT',
  SUBGRAPH_RATE_LIMIT = 'SUBGRAPH_RATE_LIMIT',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INVALID_TOKEN = 'INVALID_TOKEN',
  NO_DATA_AVAILABLE = 'NO_DATA_AVAILABLE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PARSING_ERROR = 'PARSING_ERROR',
}

export enum FallbackStrategy {
  USE_CACHED_DATA = 'USE_CACHED_DATA',
  RETRY_WITH_BACKOFF = 'RETRY_WITH_BACKOFF',
  RETURN_EMPTY_DATA = 'RETURN_EMPTY_DATA',
  USE_SYNTHETIC_DATA = 'USE_SYNTHETIC_DATA',
}

interface ErrorContext {
  tokenAddress: string;
  timeframe: string;
  operation: string;
  timestamp: number;
  userId?: string;
  retryCount?: number;
}

interface ErrorResult {
  error: ChartDataError;
  fallbackData?: any;
  shouldRetry: boolean;
  retryDelay?: number;
}

export class ChartDataError extends Error {
  public readonly type: ErrorType;
  public readonly context: ErrorContext;
  public readonly originalError?: Error;
  public readonly isRecoverable: boolean;

  constructor(
    type: ErrorType,
    message: string,
    context: ErrorContext,
    originalError?: Error,
    isRecoverable = true,
  ) {
    super(message);
    this.name = 'ChartDataError';
    this.type = type;
    this.context = context;
    this.originalError = originalError;
    this.isRecoverable = isRecoverable;
  }
}

/**
 * Central error handling service for chart data operations
 */
export class ChartErrorHandler {
  private errorCounts = new Map<string, number>();
  private lastErrors = new Map<string, number>();
  private circuitBreakers = new Map<string, boolean>();

  private readonly maxRetries = 3;
  private readonly circuitBreakerThreshold = 5;
  private readonly circuitBreakerResetTime = 300000; // 5 minutes

  /**
   * Handle errors and determine appropriate fallback strategy
   */
  async handleError(
    error: Error,
    context: ErrorContext,
    fallbackCallback?: () => Promise<any>,
  ): Promise<ErrorResult> {
    const chartError = this.classifyError(error, context);
    const errorKey = `${context.tokenAddress}-${context.operation}`;

    // Update error tracking
    this.updateErrorCounts(errorKey);

    // Check circuit breaker
    if (this.isCircuitBreakerOpen(errorKey)) {
      return {
        error: new ChartDataError(
          ErrorType.SUBGRAPH_DOWN,
          'Service temporarily unavailable due to repeated failures',
          context,
          error,
          false,
        ),
        shouldRetry: false,
        fallbackData: await this.getFallbackData(context, fallbackCallback),
      };
    }

    // Determine strategy based on error type
    const strategy = this.getFallbackStrategy(chartError);

    return await this.executeFallbackStrategy(strategy, chartError, fallbackCallback);
  }

  /**
   * Classify error into specific types for better handling
   */
  private classifyError(error: Error, context: ErrorContext): ChartDataError {
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('aborted')) {
      return new ChartDataError(
        ErrorType.SUBGRAPH_TIMEOUT,
        'Request timed out',
        context,
        error,
        true,
      );
    }

    if (message.includes('rate limit') || message.includes('429')) {
      return new ChartDataError(
        ErrorType.SUBGRAPH_RATE_LIMIT,
        'Rate limit exceeded',
        context,
        error,
        true,
      );
    }

    if (message.includes('network') || message.includes('fetch failed')) {
      return new ChartDataError(
        ErrorType.NETWORK_ERROR,
        'Network connectivity issue',
        context,
        error,
        true,
      );
    }

    if (message.includes('subgraph') || message.includes('graphql')) {
      return new ChartDataError(
        ErrorType.SUBGRAPH_DOWN,
        'Subgraph service unavailable',
        context,
        error,
        true,
      );
    }

    if (message.includes('prisma') || message.includes('database')) {
      return new ChartDataError(
        ErrorType.DATABASE_ERROR,
        'Database operation failed',
        context,
        error,
        true,
      );
    }

    if (message.includes('invalid') || message.includes('not found')) {
      return new ChartDataError(
        ErrorType.INVALID_TOKEN,
        'Invalid token address or token not found',
        context,
        error,
        false,
      );
    }

    // Default to network error
    return new ChartDataError(ErrorType.NETWORK_ERROR, error.message, context, error, true);
  }

  /**
   * Determine appropriate fallback strategy
   */
  private getFallbackStrategy(error: ChartDataError): FallbackStrategy {
    switch (error.type) {
      case ErrorType.SUBGRAPH_DOWN:
      case ErrorType.SUBGRAPH_TIMEOUT:
      case ErrorType.NETWORK_ERROR:
        return FallbackStrategy.USE_CACHED_DATA;

      case ErrorType.SUBGRAPH_RATE_LIMIT:
        return FallbackStrategy.RETRY_WITH_BACKOFF;

      case ErrorType.DATABASE_ERROR:
        return FallbackStrategy.USE_SYNTHETIC_DATA;

      case ErrorType.INVALID_TOKEN:
      case ErrorType.NO_DATA_AVAILABLE:
        return FallbackStrategy.RETURN_EMPTY_DATA;

      default:
        return FallbackStrategy.USE_CACHED_DATA;
    }
  }

  /**
   * Execute the determined fallback strategy
   */
  private async executeFallbackStrategy(
    strategy: FallbackStrategy,
    error: ChartDataError,
    fallbackCallback?: () => Promise<any>,
  ): Promise<ErrorResult> {
    switch (strategy) {
      case FallbackStrategy.USE_CACHED_DATA:
        return {
          error,
          shouldRetry: false,
          fallbackData: await this.getFallbackData(error.context, fallbackCallback),
        };

      case FallbackStrategy.RETRY_WITH_BACKOFF:
        const retryCount = error.context.retryCount || 0;
        if (retryCount < this.maxRetries) {
          return {
            error,
            shouldRetry: true,
            retryDelay: Math.pow(2, retryCount) * 1000, // Exponential backoff
          };
        } else {
          return {
            error,
            shouldRetry: false,
            fallbackData: await this.getFallbackData(error.context, fallbackCallback),
          };
        }

      case FallbackStrategy.USE_SYNTHETIC_DATA:
        return {
          error,
          shouldRetry: false,
          fallbackData: this.generateSyntheticData(error.context),
        };

      case FallbackStrategy.RETURN_EMPTY_DATA:
        return {
          error,
          shouldRetry: false,
          fallbackData: this.getEmptyChartData(error.context),
        };

      default:
        return {
          error,
          shouldRetry: false,
        };
    }
  }

  /**
   * Get fallback data (cached or default)
   */
  private async getFallbackData(
    context: ErrorContext,
    fallbackCallback?: () => Promise<any>,
  ): Promise<any> {
    if (fallbackCallback) {
      try {
        return await fallbackCallback();
      } catch (fallbackError) {
        console.warn('Fallback callback failed:', fallbackError);
      }
    }

    // Return synthetic data as last resort
    return this.generateSyntheticData(context);
  }

  /**
   * Generate synthetic/placeholder data
   */
  private generateSyntheticData(context: ErrorContext): any {
    const now = Date.now();
    const intervalMs = this.getIntervalMs(context.timeframe);
    const candleCount = 50;

    const candles = [];
    const volume = [];
    const basePrice = 1.0;

    for (let i = 0; i < candleCount; i++) {
      const time = Math.floor((now - (candleCount - i) * intervalMs) / 1000);

      // Generate slightly random but stable price data
      const randomSeed = (time + i) % 100;
      const priceVariation = (randomSeed / 100 - 0.5) * 0.1; // ±5% variation
      const price = basePrice + priceVariation;

      candles.push({
        time,
        open: price,
        high: price * 1.02,
        low: price * 0.98,
        close: price,
      });

      volume.push({
        time,
        value: 1000 + randomSeed * 100,
        color: 'rgba(128, 128, 128, 0.3)', // Gray for synthetic data
      });
    }

    return {
      timeframe: context.timeframe,
      candles,
      volume,
      count: candles.length,
      isSynthetic: true,
      warning: 'Live data temporarily unavailable - showing placeholder data',
    };
  }

  /**
   * Get empty chart data structure
   */
  private getEmptyChartData(context: ErrorContext): any {
    return {
      timeframe: context.timeframe,
      candles: [],
      volume: [],
      count: 0,
      isEmpty: true,
      message: 'No trading data available for this token',
    };
  }

  /**
   * Get interval in milliseconds for timeframe
   */
  private getIntervalMs(timeframe: string): number {
    const intervals: { [key: string]: number } = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };
    return intervals[timeframe] || intervals['1h'];
  }

  /**
   * Update error counts for circuit breaker logic
   */
  private updateErrorCounts(errorKey: string): void {
    const count = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, count + 1);
    this.lastErrors.set(errorKey, Date.now());

    // Open circuit breaker if threshold exceeded
    if (count >= this.circuitBreakerThreshold) {
      this.circuitBreakers.set(errorKey, true);
      console.warn(`Circuit breaker opened for ${errorKey} after ${count} errors`);

      // Schedule reset
      setTimeout(() => {
        this.resetCircuitBreaker(errorKey);
      }, this.circuitBreakerResetTime);
    }
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(errorKey: string): boolean {
    return this.circuitBreakers.get(errorKey) || false;
  }

  /**
   * Reset circuit breaker and error counts
   */
  private resetCircuitBreaker(errorKey: string): void {
    this.circuitBreakers.set(errorKey, false);
    this.errorCounts.set(errorKey, 0);
    console.log(`Circuit breaker reset for ${errorKey}`);
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats(): {
    errorCounts: Record<string, number>;
    circuitBreakers: Record<string, boolean>;
    recentErrors: Array<{ key: string; timestamp: number }>;
  } {
    const recentErrors = Array.from(this.lastErrors.entries())
      .filter(([_, timestamp]) => Date.now() - timestamp < 3600000) // Last hour
      .map(([key, timestamp]) => ({ key, timestamp }))
      .sort((a, b) => b.timestamp - a.timestamp);

    return {
      errorCounts: Object.fromEntries(this.errorCounts),
      circuitBreakers: Object.fromEntries(this.circuitBreakers),
      recentErrors,
    };
  }

  /**
   * Clear error history (useful for testing or manual reset)
   */
  clearErrorHistory(): void {
    this.errorCounts.clear();
    this.lastErrors.clear();
    this.circuitBreakers.clear();
    console.log('Error history cleared');
  }
}

/**
 * Utility function to wrap async operations with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  errorHandler: ChartErrorHandler,
  fallbackCallback?: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const result = await errorHandler.handleError(
      error instanceof Error ? error : new Error(String(error)),
      context,
      fallbackCallback,
    );

    if (result.shouldRetry && result.retryDelay) {
      // Wait and retry
      await new Promise((resolve) => setTimeout(resolve, result.retryDelay));

      const retryContext = {
        ...context,
        retryCount: (context.retryCount || 0) + 1,
      };

      return await withErrorHandling(operation, retryContext, errorHandler, fallbackCallback);
    }

    if (result.fallbackData) {
      return result.fallbackData as T;
    }

    // Re-throw if no fallback available
    throw result.error;
  }
}
