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

export class UnifiedGoldSkyDataService {
  private fastify: FastifyInstance;
  private readonly cacheKeyPrefix = 'unified-goldsky';
  private readonly defaultTtl = 60 * 1000; // 60 seconds
  private readonly tradesLimit = 1000; // Enough for all timeframes

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  /**
   * Get unified token data (from cache or fetch)
   */
  async getUnifiedTokenData(tokenAddress: string): Promise<UnifiedTokenData | null> {
    const normalizedAddress = tokenAddress.toLowerCase();
    const cacheKey = `${this.cacheKeyPrefix}:${normalizedAddress}`;

    // Try cache first
    const cached = this.fastify.cache.get<UnifiedTokenData>('other', cacheKey);
    if (cached) {
      this.fastify.log.debug({ tokenAddress: normalizedAddress }, '[UnifiedGoldSky] ✅ Cache hit');
      return cached;
    }

    // Cache miss - fetch from GoldSky
    this.fastify.log.info(
      { tokenAddress: normalizedAddress },
      '[UnifiedGoldSky] 🔄 Cache miss - fetching from GoldSky',
    );
    try {
      return await this.fetchUnifiedData(tokenAddress);
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

      // Cache the unified data
      const cacheKey = `${this.cacheKeyPrefix}:${normalizedAddress}`;
      this.fastify.cache.set('other', cacheKey, unifiedData, this.defaultTtl);

      this.fastify.log.info(
        {
          tokenAddress: normalizedAddress,
          tradeCount: trades.length,
        },
        '[UnifiedGoldSky] ✅ Fetched and cached unified data',
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
   * Invalidate unified cache for a token (called by webhook)
   */
  invalidateToken(tokenAddress: string): void {
    const normalizedAddress = tokenAddress.toLowerCase();
    const cacheKey = `${this.cacheKeyPrefix}:${normalizedAddress}`;
    this.fastify.cache.invalidate('other', cacheKey);
    this.fastify.log.info(
      { tokenAddress: normalizedAddress },
      '[UnifiedGoldSky] 🗑️ Invalidated unified cache',
    );
  }

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
        const cached = this.fastify.cache.get<UnifiedTokenData>('other', cacheKey);
        if (!cached) {
          // Cache expired or invalidated - fetch fresh data
          await this.fetchUnifiedData(tokenAddress);
        }
      }
    }, 5000); // 5 seconds
  }
}
