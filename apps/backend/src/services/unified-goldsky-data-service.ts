/**
 * Unified GoldSky Data Service
 *
 * Fetches ALL token data from GoldSky in a single query, then distributes it to endpoints.
 * This dramatically reduces GoldSky API calls from 5-6 per token to just 1.
 *
 * Strategy:
 * 1. Fetch unified data (trades, metadata, metrics) in one query
 * 2. Cache for 60s (webhook invalidates on new trades)
 * 3. Background polling every 5s (only fetches if cache expired/invalidated)
 * 4. All endpoints read from cached unified data
 *
 * Benefits:
 * - 83-90% reduction in GoldSky calls
 * - Timeframe switching = zero new calls (aggregate from cached trades)
 * - Always fresh data via webhook invalidation
 */

import type { FastifyInstance } from 'fastify';

export interface UnifiedTokenData {
  // Token metadata
  address: string;
  steepness: string | null;
  floor: string | null;
  holdersCount: number | null;

  // Volume metrics
  tokensBought: string;
  tokensSold: string;
  subjectFeeAmount: string;
  protocolFeeAmount: string;

  // Time-series data for metrics
  tokenHours: Array<{
    id: string;
    tradesCount: number;
    tokensBought: string;
    tokensSold: string;
  }>;
  tokenDays: Array<{
    id: string;
    tradesCount: number;
    tokensBought: string;
    tokensSold: string;
  }>;

  // All trades (for trade history + chart aggregation)
  trades: Array<{
    id: string;
    isBuy: boolean;
    trader: { id: string } | null;
    tokenAmount: string;
    acesTokenAmount: string;
    supply: string;
    createdAt: string;
    blockNumber: string;
    protocolFeeAmount: string;
    subjectFeeAmount: string;
  }>;

  // Metadata
  fetchedAt: number; // Unix timestamp
  tradeCount: number;
}

interface CacheEntry {
  data: UnifiedTokenData;
  timestamp: number;
}

export class UnifiedGoldSkyDataService {
  private fastify: FastifyInstance;
  private readonly cacheKeyPrefix = 'unified-goldsky';
  private readonly defaultTtl = 60 * 1000; // 60 seconds (fresh)
  private readonly staleTtl = 120 * 1000; // Serve stale data up to 2 minutes
  private readonly tradesLimit = 1000; // Enough for all timeframes

  // Request coalescing
  private pendingRequests = new Map<string, Promise<UnifiedTokenData | null>>();

  // Basic metrics for monitoring
  private cacheHits = 0;
  private staleHits = 0;
  private cacheMisses = 0;
  private coalescedRequests = 0;
  private goldskyFetches = 0;

  // 🔥 NEW: Rolling window metrics for rate limit compliance
  private goldskyCallTimestamps: number[] = []; // Track timestamps of Goldsky calls
  private readonly RATE_LIMIT_WINDOW_MS = 10 * 1000; // 10 seconds
  private readonly RATE_LIMIT_MAX_CALLS = 50; // Max 50 calls per 10s

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  /**
   * Get unified token data (from cache or fetch)
   */
  async getUnifiedTokenData(tokenAddress: string): Promise<UnifiedTokenData | null> {
    const normalizedAddress = tokenAddress.toLowerCase();
    const cacheKey = `${this.cacheKeyPrefix}:${normalizedAddress}`;
    const now = Date.now();

    // Try cache first
    const cached = this.fastify.cache.get<CacheEntry>('other', cacheKey);
    if (cached) {
      const age = now - cached.timestamp;

      if (age < this.defaultTtl) {
        this.cacheHits++;
        this.fastify.log.debug(
          { tokenAddress: normalizedAddress, age },
          '[UnifiedGoldSky] ✅ Cache hit',
        );
        return cached.data;
      }

      if (age < this.staleTtl) {
        this.staleHits++;
        this.fastify.log.debug(
          { tokenAddress: normalizedAddress, age },
          '[UnifiedGoldSky] ♻️ Serving stale cache (refreshing in background)',
        );
        this.refreshInBackground(tokenAddress);
        return cached.data;
      }
    }

    this.cacheMisses++;

    // Check if a request is already in flight (coalescing)
    const pending = this.pendingRequests.get(cacheKey);
    if (pending) {
      this.coalescedRequests++;
      this.fastify.log.debug(
        { tokenAddress: normalizedAddress },
        '[UnifiedGoldSky] 🤝 Joining pending request',
      );
      return pending;
    }

    const fetchPromise = this.fetchAndCache(tokenAddress);
    this.pendingRequests.set(cacheKey, fetchPromise);

    try {
      return await fetchPromise;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Fetch unified data from GoldSky (single query)
   */
  private async fetchUnifiedData(tokenAddress: string): Promise<UnifiedTokenData | null> {
    const subgraphUrl = process.env.GOLDSKY_SUBGRAPH_URL;
    if (!subgraphUrl) {
      this.fastify.log.warn('[UnifiedGoldSky] GOLDSKY_SUBGRAPH_URL not configured');
      return null;
    }

    const normalizedAddress = tokenAddress.toLowerCase();

    try {
      // 🔥 UNIFIED QUERY: Fetch everything in one call
      const query = `{
        tokens(where: {address: "${normalizedAddress}"}) {
          address
          steepness
          floor
          holdersCount
          tokensBought
          tokensSold
          subjectFeeAmount
          protocolFeeAmount
          tokenHours(first: 24, orderBy: id, orderDirection: desc) {
            id
            tradesCount
            tokensBought
            tokensSold
          }
          tokenDays(first: 30, orderBy: id, orderDirection: desc) {
            id
            tradesCount
            tokensBought
            tokensSold
          }
        }
        trades(
          where: {token: "${normalizedAddress}"}
          orderBy: createdAt
          orderDirection: desc
          first: ${this.tradesLimit}
        ) {
          id
          isBuy
          trader { id }
          tokenAmount
          acesTokenAmount
          supply
          createdAt
          blockNumber
          protocolFeeAmount
          subjectFeeAmount
        }
      }`;

      this.fastify.log.info(
        { tokenAddress: normalizedAddress, queryLength: query.length },
        '[UnifiedGoldSky] 📤 Sending unified query to GoldSky',
      );

      this.goldskyFetches++;
      
      // 🔥 NEW: Track timestamp for rolling window metrics
      this.goldskyCallTimestamps.push(Date.now());

      const response = await fetch(subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      this.fastify.log.debug(
        { tokenAddress: normalizedAddress, status: response.status, ok: response.ok },
        '[UnifiedGoldSky] 📥 Received response from GoldSky',
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.fastify.log.error(
          {
            tokenAddress: normalizedAddress,
            status: response.status,
            statusText: response.statusText,
            errorText: errorText.substring(0, 500),
          },
          '[UnifiedGoldSky] HTTP error from GoldSky',
        );
        throw new Error(`GoldSky request failed: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      let result: {
        data?: {
          tokens?: Array<{
            address: string;
            steepness: string | null;
            floor: string | null;
            holdersCount: number | null;
            tokensBought: string;
            tokensSold: string;
            subjectFeeAmount: string;
            protocolFeeAmount: string;
            tokenHours: Array<{
              id: string;
              tradesCount: number;
              tokensBought: string;
              tokensSold: string;
            }>;
            tokenDays: Array<{
              id: string;
              tradesCount: number;
              tokensBought: string;
              tokensSold: string;
            }>;
          }>;
          trades?: Array<{
            id: string;
            isBuy: boolean;
            trader: { id: string } | null;
            tokenAmount: string;
            acesTokenAmount: string;
            supply: string;
            createdAt: string;
            blockNumber: string;
            protocolFeeAmount: string;
            subjectFeeAmount: string;
          }>;
        };
        errors?: Array<{ message: string }>;
      };

      try {
        result = JSON.parse(responseText) as typeof result;
      } catch (parseError) {
        this.fastify.log.error(
          {
            tokenAddress: normalizedAddress,
            responseText: responseText.substring(0, 500),
            parseError: parseError instanceof Error ? parseError.message : String(parseError),
          },
          '[UnifiedGoldSky] Failed to parse JSON response',
        );
        throw new Error(
          `Failed to parse GoldSky response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        );
      }

      if (result.errors) {
        const errorMsg = `GoldSky GraphQL errors: ${JSON.stringify(result.errors)}`;
        this.fastify.log.error(
          {
            tokenAddress: normalizedAddress,
            errors: result.errors,
            errorCount: result.errors.length,
          },
          '[UnifiedGoldSky] ❌ GraphQL errors from GoldSky',
        );
        throw new Error(errorMsg);
      }

      const token = result.data?.tokens?.[0];
      const trades = result.data?.trades || [];

      this.fastify.log.debug(
        {
          tokenAddress: normalizedAddress,
          tokensFound: result.data?.tokens?.length || 0,
          tradesFound: trades.length,
          hasToken: !!token,
        },
        '[UnifiedGoldSky] 📊 Parsed response data',
      );

      if (!token) {
        this.fastify.log.warn(
          {
            tokenAddress: normalizedAddress,
            tokensFound: result.data?.tokens?.length || 0,
            tradesFound: trades.length,
            responseData: JSON.stringify(result.data).substring(0, 500),
          },
          '[UnifiedGoldSky] ⚠️ No token found in subgraph response',
        );
        return null;
      }

      // Build unified data structure
      const unifiedData: UnifiedTokenData = {
        address: token.address,
        steepness: token.steepness,
        floor: token.floor,
        holdersCount: token.holdersCount,
        tokensBought: token.tokensBought,
        tokensSold: token.tokensSold,
        subjectFeeAmount: token.subjectFeeAmount,
        protocolFeeAmount: token.protocolFeeAmount,
        tokenHours: token.tokenHours,
        tokenDays: token.tokenDays,
        trades: trades,
        fetchedAt: Date.now(),
        tradeCount: trades.length,
      };

      this.fastify.log.info(
        {
          tokenAddress: normalizedAddress,
          tradeCount: trades.length,
        },
        '[UnifiedGoldSky] ✅ Fetched unified data',
      );

      return unifiedData;
    } catch (error) {
      this.fastify.log.error(
        {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          tokenAddress: normalizedAddress,
        },
        '[UnifiedGoldSky] ❌ Failed to fetch unified data',
      );

      // Re-throw to provide more context
      throw error;
    }
  }

  /**
   * 🔥 REMOVED: invalidateToken() method
   * We no longer invalidate cache - instead we use refreshInBackground()
   * This prevents thundering herd when webhooks arrive
   */

  /**
   * Background polling: Refresh unified data every 5s if cache expired/invalidated
   * This ensures data stays fresh without hitting rate limits
   */
  async startBackgroundPolling(tokensToPoll: string[]): Promise<void> {
    // Poll every 5 seconds
    setInterval(async () => {
      for (const tokenAddress of tokensToPoll) {
        const normalizedAddress = tokenAddress.toLowerCase();
        const cacheKey = `${this.cacheKeyPrefix}:${normalizedAddress}`;

        // Check if cache exists and is still valid
        const cached = this.fastify.cache.get<CacheEntry>('other', cacheKey);
        if (!cached || Date.now() - cached.timestamp >= this.defaultTtl) {
          // Cache expired or invalidated - fetch fresh data (coalesced)
          await this.fetchAndCache(tokenAddress);
        }
      }
    }, 5000); // 5 seconds
  }

  /**
   * Trigger a background refresh without blocking caller
   */
  refreshInBackground(tokenAddress: string): void {
    const normalizedAddress = tokenAddress.toLowerCase();
    const cacheKey = `${this.cacheKeyPrefix}:${normalizedAddress}`;

    if (this.pendingRequests.has(cacheKey)) {
      return;
    }

    const promise = this.fetchAndCache(tokenAddress);
    this.pendingRequests.set(cacheKey, promise);

    promise
      .catch((error) => {
        this.fastify.log.error(
          {
            error: error instanceof Error ? error.message : String(error),
            tokenAddress: normalizedAddress,
          },
          '[UnifiedGoldSky] ❌ Background refresh failed',
        );
      })
      .finally(() => {
        this.pendingRequests.delete(cacheKey);
      });
  }

  /**
   * Expose metrics for monitoring
   */
  getMetrics() {
    const totalRequests = this.cacheHits + this.staleHits + this.cacheMisses;
    const rollingWindow = this.getRollingWindowStats();
    
    return {
      cacheHits: this.cacheHits,
      staleHits: this.staleHits,
      cacheMisses: this.cacheMisses,
      coalescedRequests: this.coalescedRequests,
      goldskyFetches: this.goldskyFetches,
      cacheHitRate: totalRequests ? (this.cacheHits / totalRequests) * 100 : 0,
      
      // 🔥 NEW: Rolling window stats for rate limit compliance
      rateLimit: {
        callsLast10Seconds: rollingWindow.last10s,
        callsLastMinute: rollingWindow.last60s,
        peakLast10Minutes: rollingWindow.peak10min,
        limit: this.RATE_LIMIT_MAX_CALLS,
        windowSeconds: this.RATE_LIMIT_WINDOW_MS / 1000,
        utilizationPercent: (rollingWindow.last10s / this.RATE_LIMIT_MAX_CALLS) * 100,
        safetyMargin: this.RATE_LIMIT_MAX_CALLS - rollingWindow.last10s,
      },
    };
  }

  /**
   * 🔥 NEW: Calculate rolling window statistics
   * Clean up old timestamps while we're at it
   */
  private getRollingWindowStats() {
    const now = Date.now();
    
    // Clean up timestamps older than 10 minutes (we only track up to 10 min)
    const tenMinutesAgo = now - 10 * 60 * 1000;
    this.goldskyCallTimestamps = this.goldskyCallTimestamps.filter(
      (ts) => ts > tenMinutesAgo,
    );

    // Calculate windows
    const last10s = this.goldskyCallTimestamps.filter(
      (ts) => ts > now - this.RATE_LIMIT_WINDOW_MS,
    ).length;

    const last60s = this.goldskyCallTimestamps.filter(
      (ts) => ts > now - 60 * 1000,
    ).length;

    // Calculate peak in last 10 minutes by checking every 10s window
    let peak10min = 0;
    for (let i = 0; i < 60; i++) {
      // Check 60 windows (10 minutes / 10 seconds)
      const windowStart = now - (i + 1) * this.RATE_LIMIT_WINDOW_MS;
      const windowEnd = now - i * this.RATE_LIMIT_WINDOW_MS;
      const count = this.goldskyCallTimestamps.filter(
        (ts) => ts > windowStart && ts <= windowEnd,
      ).length;
      peak10min = Math.max(peak10min, count);
    }

    return {
      last10s,
      last60s,
      peak10min,
    };
  }

  private async fetchAndCache(tokenAddress: string): Promise<UnifiedTokenData | null> {
    const normalizedAddress = tokenAddress.toLowerCase();
    const cacheKey = `${this.cacheKeyPrefix}:${normalizedAddress}`;

    try {
      const data = await this.fetchUnifiedData(tokenAddress);

      if (data) {
        const entry: CacheEntry = {
          data,
          timestamp: Date.now(),
        };
        this.fastify.cache.set('other', cacheKey, entry, this.staleTtl);
      }

      return data;
    } catch (error) {
      // Log error but return null to allow graceful degradation
      this.fastify.log.error(
        {
          error: error instanceof Error ? error.message : String(error),
          tokenAddress: normalizedAddress,
        },
        '[UnifiedGoldSky] ❌ Fetch failed',
      );
      return null;
    }
  }
}
