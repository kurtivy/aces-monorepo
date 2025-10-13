import { getBitQueryConfig, BITQUERY_QUERIES, BASE_NETWORK } from '../config/bitquery.config';
import type {
  BitQuerySwap,
  BitQueryCandle,
  BitQueryPoolState,
  BitQueryResponse,
} from '../types/bitquery.types';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class BitQueryService {
  private config = getBitQueryConfig();
  private cache = new Map<string, CacheEntry<unknown>>();

  /**
   * Fetch recent swaps for a token pair
   */
  async getRecentSwaps(
    tokenAddress: string,
    poolAddress: string,
    options: {
      since?: Date;
      limit?: number;
    } = {},
  ): Promise<BitQuerySwap[]> {
    const cacheKey = `swaps:${poolAddress}:${options.since?.getTime() || 'all'}`;
    const cached = this.getFromCache<BitQuerySwap[]>(cacheKey);
    if (cached) return cached;

    try {
      const queryVariables: any = {
        network: BASE_NETWORK,
        poolAddress: poolAddress.toLowerCase(),
        limit: options.limit || 100,
      };

      // Only include since parameter if it's provided
      if (options.since) {
        queryVariables.since = options.since.toISOString();
      }

      // Create query based on whether since parameter is provided
      const queryToUse = options.since
        ? BITQUERY_QUERIES.GET_RECENT_SWAPS
        : BITQUERY_QUERIES.GET_RECENT_SWAPS_NO_SINCE;
      const response = await this.queryBitQuery<any>(queryToUse, queryVariables);

      // FIX: Access via response.data.EVM
      const swaps = this.normalizeSwaps(response.data.EVM.DEXTrades, tokenAddress);
      this.setCache(cacheKey, swaps);
      return swaps;
    } catch (error) {
      console.error('[BitQuery] Failed to fetch swaps:', error);
      throw error;
    }
  }

  /**
   * Fetch OHLC candles for a timeframe
   */
  async getOHLCCandles(
    tokenAddress: string,
    poolAddress: string,
    timeframe: string,
    options: {
      from?: Date;
      to?: Date;
    } = {},
  ): Promise<BitQueryCandle[]> {
    const from = options.from || new Date(Date.now() - this.getTimeframeDuration(timeframe));
    const to = options.to || new Date();

    const cacheKey = `candles:${poolAddress}:${timeframe}:${from.getTime()}:${to.getTime()}`;
    const cached = this.getFromCache<BitQueryCandle[]>(cacheKey);
    if (cached) return cached;

    try {
      const intervalSeconds = this.getIntervalSeconds(timeframe);

      const response = await this.queryBitQuery<any>(BITQUERY_QUERIES.GET_OHLC_CANDLES, {
        network: BASE_NETWORK,
        poolAddress: poolAddress.toLowerCase(),
        from: from.toISOString(),
        to: to.toISOString(),
        interval: intervalSeconds,
      });

      // FIX: Access via response.data.EVM
      const candles = this.normalizeCandles(response.data.EVM.DEXTrades);
      this.setCache(cacheKey, candles);
      return candles;
    } catch (error) {
      console.error('[BitQuery] Failed to fetch candles:', error);
      throw error;
    }
  }

  /**
   * Get current pool reserves and state
   */
  async getPoolState(poolAddress: string): Promise<BitQueryPoolState | null> {
    const cacheKey = `pool:${poolAddress}`;
    const cached = this.getFromCache<BitQueryPoolState>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.queryBitQuery<any>(BITQUERY_QUERIES.GET_POOL_STATE, {
        network: BASE_NETWORK,
        poolAddress: poolAddress.toLowerCase(),
      });

      // FIX: Access via response.data.EVM
      const poolState = this.normalizePoolState(response.data.EVM.BalanceUpdates, poolAddress);
      if (poolState) {
        this.setCache(cacheKey, poolState, 10000); // Cache pool state for 10s
      }
      return poolState;
    } catch (error) {
      console.error('[BitQuery] Failed to fetch pool state:', error);
      return null;
    }
  }

  /**
   * Execute GraphQL query with retry logic
   */
  private async queryBitQuery<T>(query: string, variables: any): Promise<BitQueryResponse<T>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({ query, variables }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`BitQuery HTTP ${response.status}: ${response.statusText}`);
        }

        // FIX: Use type assertion instead
        const data = (await response.json()) as BitQueryResponse<T>;

        if (data.errors && data.errors.length > 0) {
          throw new Error(`BitQuery GraphQL errors: ${JSON.stringify(data.errors)}`);
        }

        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[BitQuery] Attempt ${attempt + 1} failed:`, lastError.message);

        if (attempt < this.config.maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.retryDelayMs * (attempt + 1)),
          );
        }
      }
    }

    throw lastError || new Error('BitQuery request failed after retries');
  }

  /**
   * Normalize swap data from BitQuery response
   */
  private normalizeSwaps(trades: any[], tokenAddress: string): BitQuerySwap[] {
    return trades.map((trade) => {
      const tradeData = trade.Trade;

      return {
        blockTime: new Date(trade.Block.Time),
        blockNumber: trade.Block.Number,
        txHash: trade.Transaction.Hash,
        priceInAces: '0', // Will need to get this from a different source
        priceInUsd: '0', // Will need to get this from a different source
        amountToken: '0', // Will need to get this from a different source
        amountAces: '0', // Will need to get this from a different source
        volumeUsd: '0', // Will need to get this from a different source
        side: 'buy', // Placeholder for now
      };
    });
  }

  /**
   * Normalize candle data from BitQuery response
   */
  private normalizeCandles(candles: any[]): BitQueryCandle[] {
    return candles.map((candle) => ({
      timestamp: new Date(candle.Block.Time),
      open: '0', // Placeholder - will need to implement proper OHLC logic
      high: '0',
      low: '0',
      close: '0',
      openUsd: '0',
      highUsd: '0',
      lowUsd: '0',
      closeUsd: '0',
      volume: '0',
      volumeUsd: '0',
      trades: candle.count || 0,
    }));
  }

  /**
   * Normalize pool state from BitQuery response
   */
  private normalizePoolState(balances: any[], poolAddress: string): BitQueryPoolState | null {
    if (!balances || balances.length < 2) return null;

    return {
      poolAddress,
      token0: {
        address: balances[0].Currency.SmartContract,
        symbol: balances[0].Currency.Symbol,
        decimals: balances[0].Currency.Decimals,
        reserve: balances[0].BalanceUpdate.Amount.toString(),
      },
      token1: {
        address: balances[1].Currency.SmartContract,
        symbol: balances[1].Currency.Symbol,
        decimals: balances[1].Currency.Decimals,
        reserve: balances[1].BalanceUpdate.Amount.toString(),
      },
      lastUpdated: new Date(balances[0].Block.Time),
      blockNumber: balances[0].Block.Number,
    };
  }

  /**
   * Cache management
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private setCache<T>(key: string, data: T, ttlMs?: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs || this.config.cacheTtlMs),
    });
  }

  /**
   * Utility: Convert timeframe to duration
   */
  private getTimeframeDuration(timeframe: string): number {
    const durations: Record<string, number> = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };
    return durations[timeframe] || durations['1h'];
  }

  /**
   * Utility: Convert timeframe to interval seconds
   */
  private getIntervalSeconds(timeframe: string): number {
    const intervals: Record<string, number> = {
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
    };
    return intervals[timeframe] || 3600;
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
}
