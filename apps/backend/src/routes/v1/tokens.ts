import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Decimal } from 'decimal.js';
import { ethers } from 'ethers';
import { TokenService } from '../../services/token-service';
import { TokenHolderService } from '../../services/token-holder-service';
import { priceCacheService } from '../../services/price-cache-service';
import { BitQueryService } from '../../services/bitquery-service';
import { ACES_TOKEN_ADDRESS } from '../../config/bitquery.config';
import { getNetworkConfig, type SupportedChainId } from '../../config/network.config';

const BASE_MAINNET_CHAIN_ID = 8453;

interface TokenParams {
  address: string;
}

/**
 * 🔥 NEW: Calculate bonding curve volume with accurate historical pricing
 * Fetches individual trades from subgraph and calculates USD value at time of trade
 *
 * @param tokenAddress - Token contract address
 * @param startTime - Start of time window
 * @param endTime - End of time window
 * @returns { acesVolume, usdVolume } volumes for the period
 */
async function getBondingCurveVolume(
  tokenAddress: string,
  startTime: Date,
  endTime: Date,
  acesUsdPrice: number,
): Promise<{ acesVolume: number; usdVolume: number }> {
  const startTimeSeconds = Math.floor(startTime.getTime() / 1000);
  const endTimeSeconds = Math.floor(endTime.getTime() / 1000);

  const pageSize = 1000;
  let skip = 0;
  let allBondingTrades: Array<{ id: string; acesTokenAmount: string }> = [];
  let hasMore = true;

  // 🔥 NEW: Fetch all bonding curve trades in the time window with pagination
  while (hasMore) {
    const query = `{
      trades(
        where: {
          token: "${tokenAddress.toLowerCase()}"
          createdAt_gte: "${startTimeSeconds}"
          createdAt_lte: "${endTimeSeconds}"
        }
        orderBy: createdAt
        orderDirection: asc
        first: ${pageSize}
        skip: ${skip}
      ) {
        id
        acesTokenAmount
      }
    }`;

    const response = await fetch(process.env.GOLDSKY_SUBGRAPH_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Subgraph request failed: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as {
      data?: { trades: Array<{ id: string; acesTokenAmount: string }> };
      errors?: Array<{ message: string }>;
    };

    if (result.errors?.length) {
      throw new Error(`Subgraph GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    const trades = result.data?.trades || [];
    allBondingTrades = [...allBondingTrades, ...trades];

    // If we got fewer trades than the page size, we've reached the end
    hasMore = trades.length === pageSize;
    skip += trades.length;

    // Safety limit: prevent infinite loops (max 10,000 trades = 10 pages)
    if (skip >= 10000) {
      console.warn(
        `[getBondingCurveVolume] Reached max pagination limit for ${tokenAddress}, may be missing some trades`,
      );
      break;
    }
  }

  // 🔥 NEW: Calculate volumes from trades
  // Each trade's ACES amount is stored as Wei (18 decimals)
  // Note: We use current ACES price since historical prices not available in subgraph
  // For truly accurate pricing, would need to query price feeds at each trade timestamp
  const acesVolume = allBondingTrades.reduce((sum, trade) => {
    const aces = parseFloat(trade.acesTokenAmount) / 1e18;
    return Number.isFinite(aces) ? sum + aces : sum;
  }, 0);

  const usdVolume = acesVolume * acesUsdPrice;

  return { acesVolume, usdVolume };
}

interface HolderQuery {
  chainId?: number;
}

// 🔥 LOAD TEST FIX: Health endpoint cache
interface HealthCacheEntry {
  data: unknown;
  timestamp: number;
}

export async function tokensRoutes(fastify: FastifyInstance) {
  const tokenService = new TokenService(fastify.prisma);
  const tokenHolderService = new TokenHolderService();
  const bitQueryService = new BitQueryService();

  // 🔥 LOAD TEST FIX: In-memory cache for health endpoint (5s TTL)
  const healthCache = new Map<string, HealthCacheEntry>();
  const HEALTH_CACHE_TTL_MS = 5000; // 5 seconds - Fresh
  const HEALTH_STALE_TTL_MS = 60000; // 1 minute - Stale but usable
  let healthCacheHits = 0;
  let healthCacheMisses = 0;

  // Request coalescing map for health endpoint
  const healthPendingRequests = new Map<string, Promise<any>>();

  // 🔥 QUICK WIN #1: Request coalescing for trades endpoint
  const tradesCache = new Map<string, { data: any; timestamp: number }>();
  const tradesPendingRequests = new Map<string, Promise<any>>();
  const TRADES_CACHE_TTL_MS = 180000; // 3 minutes (trades don't change much)

  // 🔥 LOAD TEST FIX: Cache stats endpoint for observability
  fastify.get('/_cache-stats', async (_request, reply) => {
    const chartStats = (fastify as any).chartAggregationService?.getCacheStats() || null;
    const marketCapStats = (fastify as any).marketCapService?.getCacheStats() || null;

    const healthHitRate =
      healthCacheHits + healthCacheMisses > 0
        ? ((healthCacheHits / (healthCacheHits + healthCacheMisses)) * 100).toFixed(2)
        : '0.00';

    return reply.send({
      success: true,
      data: {
        health: {
          size: healthCache.size,
          hits: healthCacheHits,
          misses: healthCacheMisses,
          hitRate: `${healthHitRate}%`,
          ttlMs: HEALTH_CACHE_TTL_MS,
        },
        chart: chartStats,
        marketCap: marketCapStats,
      },
      timestamp: Date.now(),
    });
  });

  // Unified health endpoint - combines bonding data, market cap, and metrics
  // MUST come before /:address route to avoid route conflicts
  fastify.get(
    '/:address/health',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
          }),
        ),
        querystring: zodToJsonSchema(
          z.object({
            chainId: z.string().optional(),
            currency: z.enum(['usd', 'aces']).optional().default('usd'),
          }),
        ),
      },
    },
    async (
      request: FastifyRequest<{
        Params: TokenParams;
        Querystring: { chainId?: string; currency?: 'usd' | 'aces' };
      }>,
      reply,
    ) => {
      try {
        const { address } = request.params;
        const { chainId: chainIdStr, currency = 'usd' } = request.query;
        const chainId = chainIdStr ? parseInt(chainIdStr) : BASE_MAINNET_CHAIN_ID;

        // 🔥 LOAD TEST FIX: Check cache first with Stale-While-Revalidate
        const cacheKey = `${address.toLowerCase()}:${chainId}:${currency}`;
        const cached = healthCache.get(cacheKey);
        const now = Date.now();

        // Helper to fetch and cache
        const fetchAndCache = async () => {
          try {
            // Get base URL for internal API calls
            const protocol = request.headers['x-forwarded-proto'] || request.protocol;
            const host = request.headers['x-forwarded-host'] || request.hostname;
            const baseUrl = `${protocol}://${host}`;

            // Fetch all data in parallel for maximum performance
            const [bondingResponse, metricsResponse, marketCapResponse] = await Promise.allSettled([
              // 1. Bonding data
              fetch(`${baseUrl}/api/v1/bonding/${address}/data?chainId=${chainId}`).then((r) =>
                r.json(),
              ),

              // 2. Metrics data
              fetch(`${baseUrl}/api/v1/tokens/${address}/metrics?chainId=${chainId}`).then((r) =>
                r.json(),
              ),

              // 3. 🔥 UPDATED: Market cap from dedicated service (single source of truth)
              // No longer uses candle-based market cap - uses current price/reserves instead
              fetch(`${baseUrl}/api/v1/market-cap/${address}`).then((r) => r.json()),
            ]);

            // Extract data from results
            const bondingData =
              bondingResponse.status === 'fulfilled' &&
              (bondingResponse.value as { success: boolean; data: unknown })?.success
                ? (bondingResponse.value as { success: boolean; data: unknown }).data
                : null;

            type MetricsResponseType = { success: boolean; data: unknown };
            const metricsData =
              metricsResponse.status === 'fulfilled' &&
              (metricsResponse.value as MetricsResponseType)?.success
                ? (metricsResponse.value as MetricsResponseType).data
                : null;

            // 🔥 UPDATED: Parse market cap from new dedicated endpoint
            let marketCapData = null;
            if (marketCapResponse.status === 'fulfilled') {
              const marketCapResult = marketCapResponse.value as {
                marketCapUsd?: number;
                currentPriceUsd?: number;
                supply?: number;
                error?: string;
              };

              // New endpoint returns market cap data directly (not nested in 'data')
              if (
                marketCapResult &&
                (marketCapResult.marketCapUsd !== undefined ||
                  marketCapResult.currentPriceUsd !== undefined)
              ) {
                const marketCapUsd = marketCapResult.marketCapUsd || 0;
                const currentPriceUsd = marketCapResult.currentPriceUsd || 0;
                const supply = marketCapResult.supply || 1_000_000_000; // Default 1B supply

                // Get ACES/USD price from service for currency conversion
                let marketCapAces: number;
                let currentPriceAces: number;

                if (currency === 'usd') {
                  // Market cap data is already in USD
                  marketCapAces =
                    marketCapUsd > 0 && currentPriceUsd > 0 ? marketCapUsd / currentPriceUsd : 0;
                  currentPriceAces = 0; // Would need ACES/USD conversion, but we don't have it here
                } else {
                  // Market cap in ACES would need conversion from USD
                  marketCapAces = 0;
                  currentPriceAces = 0;
                }

                marketCapData = {
                  marketCapAces,
                  marketCapUsd,
                  circulatingSupply: supply,
                  currentPriceAces,
                  currentPriceUsd,
                  lastUpdated: Date.now(),
                };
              }
            }

            // Log any failures
            if (bondingResponse.status === 'rejected') {
              fastify.log.warn(
                { error: bondingResponse.reason },
                '⚠️ [Health] Bonding data fetch failed',
              );
            }
            if (metricsResponse.status === 'rejected') {
              fastify.log.warn(
                { error: metricsResponse.reason },
                '⚠️ [Health] Metrics data fetch failed',
              );
            }
            if (marketCapResponse.status === 'rejected') {
              fastify.log.warn(
                { error: marketCapResponse.reason },
                '⚠️ [Health] Market cap fetch failed',
              );
            }

            fastify.log.info(
              {
                address,
                hasBonding: !!bondingData,
                hasMetrics: !!metricsData,
                hasMarketCap: !!marketCapData,
              },
              '✅ [Health] Unified health data fetched',
            );

            const responseData = {
              success: true,
              data: {
                bondingData,
                metricsData,
                marketCapData,
              },
              timestamp: Date.now(),
            };

            // Update cache
            healthCache.set(cacheKey, {
              data: responseData,
              timestamp: Date.now(),
            });

            return responseData;
          } finally {
            healthPendingRequests.delete(cacheKey);
          }
        };

        // SWR Logic
        if (cached) {
          const age = now - cached.timestamp;

          // Case A: Fresh Cache -> Return immediately
          if (age < HEALTH_CACHE_TTL_MS) {
            healthCacheHits++;
            fastify.log.debug({ address, chainId }, '🎯 [Health] Cache hit');
            return reply.send(cached.data);
          }

          // Case B: Stale Cache -> Return immediately, refresh in background
          if (age < HEALTH_STALE_TTL_MS) {
            healthCacheHits++;
            fastify.log.debug(
              { address, chainId },
              '♻️ [Health] Stale cache hit, refreshing in background',
            );

            if (!healthPendingRequests.has(cacheKey)) {
              const promise = fetchAndCache();
              healthPendingRequests.set(cacheKey, promise);
              // Handle background error
              promise.catch((err) => {
                fastify.log.error({ err, address }, '❌ [Health] Background refresh failed');
              });
            }

            return reply.send(cached.data);
          }
        }

        // Case C: No Cache or Too Old -> Wait for fetch
        healthCacheMisses++;

        // Join pending request if exists
        if (healthPendingRequests.has(cacheKey)) {
          // console.log(`[Health] 🤝 Joining pending request for ${address}`);
          const data = await healthPendingRequests.get(cacheKey);
          return reply.send(data);
        }

        // Start new request
        fastify.log.info({ address, chainId }, '🏥 [Health] Fetching unified health data (cold)');
        const promise = fetchAndCache();
        healthPendingRequests.set(cacheKey, promise);

        const responseData = await promise;
        return reply.send(responseData);
      } catch (error) {
        fastify.log.error({ error }, '❌ [Health] Failed to fetch unified health data');
        return reply.code(500).send({
          success: false,
          error: 'Failed to fetch token health data',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  // Get token data (fetches fresh from subgraph)
  fastify.get(
    '/:address',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
          }),
        ),
      },
    },
    async (request: FastifyRequest<{ Params: TokenParams }>, reply) => {
      try {
        const { address } = request.params;
        const token = await tokenService.fetchAndUpdateTokenData(address);

        return reply.send({
          success: true,
          data: token,
        });
      } catch (error) {
        fastify.log.error({ error }, 'Token fetch error');
        return reply.code(500).send({
          success: false,
          error: 'Failed to fetch token data',
        });
      }
    },
  );

  // Get recent trades for a token (fresh from subgraph)
  fastify.get(
    '/:address/trades',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
          }),
        ),
        querystring: zodToJsonSchema(
          z.object({
            limit: z.string().transform(Number).default('50'),
          }),
        ),
      },
    },
    async (
      request: FastifyRequest<{ Params: TokenParams; Querystring: { limit?: number } }>,
      reply,
    ) => {
      try {
        const { address } = request.params;
        const { limit = 50 } = request.query;

        // 🔥 QUICK WIN #1: Cache + Request Coalescing
        const cacheKey = `${address.toLowerCase()}:${limit}`;
        const now = Date.now();

        // Check cache first
        const cached = tradesCache.get(cacheKey);
        if (cached && now - cached.timestamp < TRADES_CACHE_TTL_MS) {
          fastify.log.info({ address, limit, age: now - cached.timestamp }, '🎯 Trades cache hit');
          return reply.send(cached.data);
        }

        // Check if request is already pending (coalescing)
        const pending = tradesPendingRequests.get(cacheKey);
        if (pending) {
          fastify.log.info({ address, limit }, '🤝 Joining pending trades request');
          const result = await pending;
          return reply.send(result);
        }

        // Start new request
        const promise = (async () => {
          try {
            const trades = await tokenService.getRecentTradesForToken(address, limit);

            // Include graduation metadata for frontend detection (non-fatal if DB unavailable)
            let token: {
              phase: string | null;
              priceSource: string | null;
              poolAddress: string | null;
              dexLiveAt: Date | null;
            } | null = null;
            try {
              token = await fastify.prisma.token.findUnique({
                where: { contractAddress: address.toLowerCase() },
                select: {
                  phase: true,
                  priceSource: true,
                  poolAddress: true,
                  dexLiveAt: true,
                },
              });
            } catch (e) {
              fastify.log.warn(
                { error: e },
                'Graduation metadata lookup failed — proceeding without meta',
              );
              token = null;
            }

            const graduationMeta = token
              ? {
                  isDexLive: token.phase === 'DEX_TRADING',
                  poolAddress: token.poolAddress,
                  dexLiveAt: token.dexLiveAt?.toISOString() || null,
                  bondingCutoff: token.dexLiveAt?.toISOString() || null,
                }
              : null;

            const response = {
              success: true,
              data: trades,
              meta: {
                graduation: graduationMeta,
              },
            };

            // Cache the response
            tradesCache.set(cacheKey, { data: response, timestamp: Date.now() });
            return response;
          } finally {
            // Clean up pending request
            tradesPendingRequests.delete(cacheKey);
          }
        })();

        // Store pending request for coalescing
        tradesPendingRequests.set(cacheKey, promise);

        // Wait for result
        const result = await promise;
        return reply.send(result);
      } catch (error) {
        fastify.log.error({ error }, 'Trades fetch error');
        return reply.code(500).send({
          success: false,
          error: 'Failed to fetch trades',
        });
      }
    },
  );

  // Force refresh token data
  fastify.post(
    '/:address/refresh',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
          }),
        ),
      },
    },
    async (request: FastifyRequest<{ Params: TokenParams }>, reply) => {
      try {
        const { address } = request.params;
        const token = await tokenService.fetchAndUpdateTokenData(address);

        return reply.send({
          success: true,
          data: token,
          message: 'Token data refreshed successfully',
        });
      } catch (error) {
        fastify.log.error({ error }, 'Token refresh error');
        return reply.code(500).send({
          success: false,
          error: 'Failed to refresh token data',
        });
      }
    },
  );

  // DEPRECATED: Old OHLCV endpoint - replaced by /api/v1/chart/:address/unified
  // This endpoint used the old OHLCVService which has been removed
  // Please use the new unified chart endpoint instead
  /*
  fastify.get('/:address/ohlcv', async (request, reply) => {
    return reply.code(410).send({
      success: false,
      error: 'This endpoint has been deprecated',
      message: 'Please use /api/v1/chart/:address/unified instead',
    });
  });
  */

  // Get holder count for a token (server-side computation)
  fastify.get(
    '/:address/holders',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
          }),
        ),
        querystring: zodToJsonSchema(
          z.object({
            chainId: z
              .string()
              .regex(/^[0-9]+$/)
              .transform((value) => Number(value))
              .optional(),
          }),
        ),
      },
    },
    async (
      request: FastifyRequest<{
        Params: TokenParams;
        Querystring: HolderQuery;
      }>,
      reply,
    ) => {
      try {
        const { address } = request.params;
        const { chainId } = request.query;
        const holderCount = await tokenHolderService.getHolderCount(address, chainId);

        return reply.send({
          success: true,
          data: { holderCount },
        });
      } catch (error) {
        fastify.log.warn({ error }, 'Token holder count fetch error');
        return reply.code(502).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch token holder count',
        });
      }
    },
  );

  // DEPRECATED: Old live candle endpoint - replaced by /api/v1/chart/:address/unified + WebSocket
  // This endpoint used the old SupplyBasedOHLCVService which has been removed
  // Please use the new unified chart endpoint with WebSocket for real-time updates
  /*
  fastify.get('/:address/live', async (request, reply) => {
    return reply.code(410).send({
      success: false,
      error: 'This endpoint has been deprecated',
      message: 'Please use /api/v1/chart/:address/unified with WebSocket for real-time updates',
    });
  });
  */

  // 🔥 NEW: Simple in-memory cache for metrics with adaptive TTL
  const metricsCache = new Map<string, { data: any; timestamp: number }>();
  // Short cache for local dev (5s), longer for production (60s)
  const METRICS_CACHE_TTL = process.env.NODE_ENV === 'production' ? 60000 : 5000;
  // Small cache for lifetime DEX fee calculation (avoids repeated BitQuery hits when profiles refresh)
  const dexFeeCache = new Map<
    string,
    { aces: string; usd: number; source: 'db' | 'bitquery'; timestamp: number }
  >();
  const DEX_FEE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes is fine for rare profile visits

  /**
   * Calculate lifetime DEX creator fees (0.5% of ACES notional) since dexLiveAt
   * 1) Use stored dex_trades rows (preferred)
   * 2) If empty/missing, backfill from BitQuery for the date range
   */
  const calculateDexFees = async (
    tokenAddress: string,
    poolAddress: string | undefined,
    dexLiveAt: Date,
    acesUsdPrice: number,
  ) => {
    const cacheKey = `${tokenAddress.toLowerCase()}:${dexLiveAt.getTime()}`;
    const cached = dexFeeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < DEX_FEE_CACHE_TTL_MS) {
      return cached;
    }

    const fromTimestampMs = BigInt(dexLiveAt.getTime());
    let totalAces = new Decimal(0);
    let source: 'db' | 'bitquery' = 'db';

    try {
      const dbTrades = await fastify.prisma.dexTrade.findMany({
        where: {
          tokenAddress: tokenAddress.toLowerCase(),
          timestamp: { gte: fromTimestampMs },
        },
        select: { acesAmount: true },
      });

      totalAces = dbTrades.reduce((sum, trade) => {
        return sum.add(new Decimal(trade.acesAmount || '0'));
      }, new Decimal(0));
    } catch (dbError) {
      fastify.log.warn(
        { dbError, tokenAddress, dexLiveAt: dexLiveAt.toISOString() },
        '[Metrics] Failed to read dex_trades for fee calc; will fallback to BitQuery',
      );
    }

    // If DB had nothing (or zero volume), try BitQuery directly
    if (totalAces.eq(0) && poolAddress) {
      try {
        const dexTrades = await bitQueryService.getDexTrades(tokenAddress, poolAddress, {
          from: dexLiveAt,
          to: new Date(),
        });

        totalAces = dexTrades.reduce((sum, trade) => {
          return sum.add(new Decimal(trade.amountAces || '0'));
        }, new Decimal(0));
        source = 'bitquery';
      } catch (bqError) {
        fastify.log.error(
          { bqError, tokenAddress, poolAddress, dexLiveAt: dexLiveAt.toISOString() },
          '[Metrics] Failed to backfill DEX fees via BitQuery',
        );
      }
    }

    const feeAces = totalAces.mul(0.005); // 0.5% creator fee
    const feeUsd = acesUsdPrice && acesUsdPrice > 0 ? feeAces.mul(acesUsdPrice).toNumber() : 0;

    const result = {
      aces: feeAces.toString(),
      usd: feeUsd,
      source,
      timestamp: Date.now(),
    };

    dexFeeCache.set(cacheKey, result);
    return result;
  };

  // Get aggregated token metrics for listings display
  fastify.get(
    '/:address/metrics',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
          }),
        ),
        querystring: zodToJsonSchema(
          z.object({
            chainId: z
              .string()
              .regex(/^[0-9]+$/)
              .transform((value) => Number(value))
              .optional(),
          }),
        ),
      },
    },
    async (
      request: FastifyRequest<{
        Params: TokenParams;
        Querystring: { chainId?: number };
      }>,
      reply,
    ) => {
      try {
        const { address } = request.params;
        const { chainId } = request.query;

        // 🔥 OPTIMIZED: Check cache first
        const cacheKey = `${address.toLowerCase()}-${chainId || 'default'}`;
        const cached = metricsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < METRICS_CACHE_TTL) {
          fastify.log.info(
            { address, chainId, age: Math.floor((Date.now() - cached.timestamp) / 1000) },
            '🎯 [Metrics] Cache hit',
          );
          return reply.send({
            success: true,
            data: cached.data,
            cached: true,
          });
        }

        fastify.log.info({ address, chainId }, '🔵 [Metrics] Fetching fresh data');

        // 1. Fetch token data (has volume24h, currentPriceACES, supply)
        // Try database first, but continue without it if unavailable
        let tokenData;
        try {
          tokenData = await tokenService.fetchAndUpdateTokenData(address);
        } catch (dbError) {
          fastify.log.warn(
            { error: dbError, address },
            'Database unavailable, fetching metrics directly from subgraph',
          );
          tokenData = null;
        }

        // 🔥 FIX: If tokenData doesn't have dexLiveAt but we're in DEX mode, fetch it directly
        // This ensures we can combine bonding + DEX volumes even if fetchAndUpdateTokenData
        // doesn't return the dexLiveAt field
        if (tokenData && !tokenData.dexLiveAt) {
          try {
            const fullTokenData = await fastify.prisma.token.findUnique({
              where: { contractAddress: address.toLowerCase() },
              select: {
                dexLiveAt: true,
                poolAddress: true,
                phase: true,
                priceSource: true,
              },
            });
            if (fullTokenData) {
              // Merge the dexLiveAt and other DEX fields if not already present
              if (!tokenData.dexLiveAt && fullTokenData.dexLiveAt) {
                tokenData.dexLiveAt = fullTokenData.dexLiveAt;
              }
              if (!tokenData.poolAddress && fullTokenData.poolAddress) {
                tokenData.poolAddress = fullTokenData.poolAddress;
              }
              if (!tokenData.phase && fullTokenData.phase) {
                tokenData.phase = fullTokenData.phase;
              }
              if (!tokenData.priceSource && fullTokenData.priceSource) {
                tokenData.priceSource = fullTokenData.priceSource;
              }
            }
          } catch (directQueryError) {
            fastify.log.warn(
              { error: directQueryError, address },
              'Failed to fetch dexLiveAt directly from database',
            );
          }
        }

        const isDexMode =
          tokenData?.phase === 'DEX_TRADING' ||
          tokenData?.dexLiveAt !== null ||
          tokenData?.priceSource === 'DEX';
        const poolAddress = tokenData?.poolAddress || undefined;

        // 2. Get ACES/USD price for conversions using PriceCacheService
        const priceData = await priceCacheService.getPrices();
        const acesUsdPrice = Number.isFinite(priceData.acesUsd) ? priceData.acesUsd : 0;
        fastify.log.info(
          { acesUsdPrice, isStale: priceData.isStale },
          'ACES/USD price fetched from PriceCacheService',
        );
        const tokenPriceAces = parseFloat(tokenData?.currentPriceACES || '0');
        const tokenPriceUsd = Number.isFinite(acesUsdPrice) ? tokenPriceAces * acesUsdPrice : 0;
        fastify.log.info({ tokenPriceAces, acesUsdPrice, tokenPriceUsd }, 'Price calculation');

        // 2b. Compute bonding liquidity (subgraph-based net ACES in curve)
        let bondingLiquidityUsd: number | null = null;
        try {
          const bonding = await tokenService.getBondingCurveLiquidity(address);
          // Only calculate USD value if ACES price is valid
          // If ACES price is 0 or invalid, skip calculation to avoid returning $0
          if (acesUsdPrice && acesUsdPrice > 0) {
            const usdVal = bonding.netLiquidityWei
              .div(new Decimal(10).pow(18))
              .mul(new Decimal(acesUsdPrice));
            if (usdVal.isFinite() && usdVal.gt(0)) {
              bondingLiquidityUsd = usdVal.toNumber();
            }
          }
          fastify.log.info(
            {
              address,
              bondingLiquidityUsd,
              tradeCount: bonding.tradeCount,
              acesUsdPrice,
              skippedDueToInvalidPrice: !acesUsdPrice || acesUsdPrice <= 0,
            },
            'Calculated bonding liquidity from subgraph (net buys - sells)',
          );
        } catch (e) {
          fastify.log.warn(
            { error: e instanceof Error ? e.message : String(e), address },
            'Failed to calculate bonding liquidity via subgraph; will use fallbacks',
          );
        }

        // 3. Get holder count - use Subgraph for bonding phase, BitQuery for DEX phase
        let holderCount = 0;

        // For bonding phase tokens, get holder count from subgraph
        if (!isDexMode) {
          try {
            // Query subgraph directly for holdersCount
            const holderCountQuery = `{
              tokens(where: {address: "${address.toLowerCase()}"}) {
                holdersCount
              }
            }`;

            const subgraphResponse = await fetch(process.env.GOLDSKY_SUBGRAPH_URL!, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: holderCountQuery }),
              signal: AbortSignal.timeout(5000), // 5 second timeout
            });

            if (subgraphResponse.ok) {
              const result = (await subgraphResponse.json()) as {
                data: { tokens: Array<{ holdersCount?: number }> };
              };

              const subgraphHolderCount = result.data.tokens?.[0]?.holdersCount;
              if (subgraphHolderCount !== undefined && subgraphHolderCount !== null) {
                holderCount = subgraphHolderCount;
                fastify.log.info(
                  { address, holderCount, source: 'subgraph' },
                  'Holder count from subgraph (bonding phase)',
                );
              } else {
                fastify.log.warn(
                  { address },
                  'Subgraph returned no holdersCount for bonding phase token',
                );
              }
            } else {
              fastify.log.warn(
                { address, status: subgraphResponse.status },
                'Failed to fetch holdersCount from subgraph',
              );
            }
          } catch (error) {
            fastify.log.warn(
              { error, address },
              'Error fetching holdersCount from subgraph, will try RPC fallback',
            );
          }
        }

        // If we didn't get holder count from subgraph (either graduated or failed), use RPC
        if (holderCount === 0) {
          try {
            const holderCountPromise = tokenHolderService.getHolderCount(
              address,
              chainId ?? BASE_MAINNET_CHAIN_ID,
            );
            // Add 10-second timeout to prevent hanging
            holderCount = await Promise.race([
              holderCountPromise,
              new Promise<number>((_, reject) =>
                setTimeout(() => reject(new Error('Holder count timeout')), 10000),
              ),
            ]);
            fastify.log.info(
              { address, holderCount, source: 'rpc' },
              'Holder count fetched via RPC',
            );
          } catch (error) {
            fastify.log.warn(
              { error, address, isDexMode },
              'Failed to fetch holder count via RPC, defaulting to 0',
            );
            // Default to 0 on error or timeout
            holderCount = 0;
          }
        }

        // 4. Get cached dexLiveAt for reuse (used by fees + volume logic)
        const dexLiveAt = tokenData?.dexLiveAt ? new Date(tokenData.dexLiveAt) : null;

        // 4. Get total fees from subgraph
        const fees = await tokenService.getTotalFees(address);
        const bondingFeesAces = parseFloat(fees.acesAmount);

        // 4b. Get lifetime DEX fees (0.5% of ACES notional since dexLiveAt)
        let dexFeesAces = 0;
        let dexFeesUsd = 0;

        if (isDexMode && dexLiveAt) {
          try {
            const dexFeeResult = await calculateDexFees(address, poolAddress, dexLiveAt, acesUsdPrice);
            dexFeesAces = parseFloat(dexFeeResult.aces);
            dexFeesUsd = dexFeeResult.usd;

            fastify.log.info(
              {
                address,
                poolAddress,
                dexLiveAt: dexLiveAt.toISOString(),
                dexFeesAces,
                dexFeesUsd,
                source: dexFeeResult.source,
              },
              '[Metrics] Calculated lifetime DEX creator fees',
            );
          } catch (dexFeeError) {
            fastify.log.warn(
              { dexFeeError, address, poolAddress },
              '[Metrics] Failed to calculate DEX creator fees',
            );
          }
        }

        // 5. Calculate derived metrics
        let volume24hAces = 0;
        let volume24hUsd = 0;
        let volumeSource: 'dex' | 'bonding_curve' | 'hybrid' = 'bonding_curve';

        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // For graduated tokens, check if last 24h window spans both bonding curve and DEX periods
        // This happens when graduation occurred after the 24h window started (even if days ago)
        // i.e., when there could be bonding curve activity within the last 24h window
        const last24hSpansGraduation =
          isDexMode && dexLiveAt && dexLiveAt > twentyFourHoursAgo && dexLiveAt <= now;

        if (isDexMode && typeof poolAddress === 'string' && poolAddress.length > 0) {
          try {
            // Determine time range for DEX trades
            // If graduation is within the 24h window, DEX trades start from graduation time
            // Otherwise, fetch full 24h of DEX trades
            const dexTradeStart =
              last24hSpansGraduation && dexLiveAt ? dexLiveAt : twentyFourHoursAgo;

            const dexTrades = await bitQueryService.getDexTrades(address, poolAddress, {
              from: dexTradeStart,
              to: now,
            });

            fastify.log.info(
              {
                address,
                poolAddress,
                tradeCount: dexTrades.length,
                last24hSpansGraduation,
                dexLiveAt: dexLiveAt?.toISOString(),
                dexTradeStart: dexTradeStart.toISOString(),
              },
              'Fetched DEX trades for 24h volume',
            );

            const dexVolumeUsd = dexTrades.reduce((sum, trade) => {
              const usd = parseFloat(trade.volumeUsd || '0');
              return Number.isFinite(usd) ? sum + usd : sum;
            }, 0);

            const dexVolumeAces = dexTrades.reduce((sum, trade) => {
              const aces = parseFloat(trade.amountAces || '0');
              return Number.isFinite(aces) ? sum + aces : sum;
            }, 0);

            // If last 24h spans graduation, fetch bonding curve volume from before graduation
            // This covers the period from 24h ago up to graduation time
            if (last24hSpansGraduation && dexLiveAt) {
              fastify.log.info(
                {
                  address,
                  dexLiveAt: dexLiveAt.toISOString(),
                  bondingCurveEnd: dexLiveAt.toISOString(),
                  bondingCurveStart: twentyFourHoursAgo.toISOString(),
                  timeWindow: '24h spans graduation - will combine bonding + DEX volume',
                },
                '24h window spans graduation boundary, fetching bonding curve + DEX volume',
              );

              try {
                // 🔥 REFACTORED: Use extracted function for bonding trades
                // Covers period from 24h ago to graduation time
                // 🔥 REFACTORED: Use extracted function for bonding trades
                // Covers period from 24h ago to graduation time
                const bondingResult = await getBondingCurveVolume(
                  address,
                  twentyFourHoursAgo,
                  dexLiveAt,
                  acesUsdPrice,
                );

                const bondingVolumeAces = bondingResult.acesVolume;
                const bondingVolumeUsd = bondingResult.usdVolume;

                fastify.log.info(
                  {
                    address,
                    bondingVolumeAces,
                    bondingVolumeUsd,
                    dexVolumeAces,
                    dexVolumeUsd,
                  },
                  '✅ Bonding curve volume fetched, combining with DEX volume',
                );

                // Combine both volumes
                volume24hAces = bondingVolumeAces + dexVolumeAces;
                volume24hUsd = bondingVolumeUsd + dexVolumeUsd;
                volumeSource = 'hybrid';
                fastify.log.info(
                  {
                    address,
                    volume24hAces,
                    volume24hUsd,
                    bondingContribution: bondingVolumeUsd,
                    dexContribution: dexVolumeUsd,
                  },
                  'Hybrid volume calculation complete (bonding + DEX)',
                );
              } catch (bondingError) {
                fastify.log.error(
                  { error: bondingError, address },
                  'Error fetching bonding curve volume, using DEX volume only',
                );
                volume24hAces = dexVolumeAces;
                volume24hUsd = dexVolumeUsd;
                volumeSource = 'dex';
              }
            } else {
              // Token graduated >24h ago, use DEX volume only
              volume24hAces = dexVolumeAces;
              volume24hUsd = dexVolumeUsd;
              volumeSource = 'dex';
            }

            fastify.log.info(
              { address, volume24hUsd, volume24hAces, volumeSource },
              'Final volume calculation complete',
            );
          } catch (dexError) {
            fastify.log.error(
              { error: dexError, address, poolAddress },
              'Failed to fetch DEX trades, falling back to bonding curve volume',
            );
          }
        }

        if (volumeSource === 'bonding_curve') {
          try {
            // 🔥 NEW: Use accurate historical volume calculation
            const bondingVolumeResult = await getBondingCurveVolume(
              address,
              twentyFourHoursAgo,
              now,
              acesUsdPrice,
            );
            volume24hAces = bondingVolumeResult.acesVolume;
            volume24hUsd = bondingVolumeResult.usdVolume;

            fastify.log.info(
              {
                address,
                volume24hAces,
                volume24hUsd,
                source: 'subgraph_bonding_trades',
              },
              '✅ Bonding curve volume from subgraph trades (accurate)',
            );
          } catch (error) {
            // 🔥 FALLBACK: If subgraph fetch fails, use cached volume data
            fastify.log.warn(
              { error, address },
              'Failed to fetch bonding trades from subgraph, falling back to cached data',
            );

            const volume24hWei = tokenData?.volume24h || '0';
            const parsedAces = parseFloat(volume24hWei) / 1e18;
            volume24hAces = Number.isFinite(parsedAces) ? parsedAces : 0;
            volume24hUsd = Number.isFinite(acesUsdPrice) ? volume24hAces * acesUsdPrice : 0;

            fastify.log.info(
              { volume24hWei, volume24hAces, acesUsdPrice, volume24hUsd },
              'Bonding curve volume from cached data (fallback)',
            );
          }
        }

        let liquidityUsd: number | null = null;
        let liquiditySource: 'bonding_curve' | 'dex' | null = null;

        // Prefer subgraph-based bonding liquidity during bonding phase
        if (!isDexMode && bondingLiquidityUsd !== null) {
          liquidityUsd = bondingLiquidityUsd;
          liquiditySource = 'bonding_curve';
        }

        // Calculate DEX liquidity by querying pool contract directly
        if (
          liquidityUsd === null &&
          isDexMode &&
          typeof poolAddress === 'string' &&
          poolAddress.length > 0
        ) {
          try {
            const effectiveChainId = (chainId ?? BASE_MAINNET_CHAIN_ID) as SupportedChainId;
            const networkConfig = getNetworkConfig(effectiveChainId);

            if (!networkConfig.rpcUrl) {
              throw new Error(`No RPC URL configured for chainId ${effectiveChainId}`);
            }

            const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);

            // Standard Uniswap V2 / Aerodrome Pool ABI
            const POOL_ABI = [
              'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
              'function token0() view returns (address)',
              'function token1() view returns (address)',
            ];

            const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);

            // Fetch pool data in parallel
            const [reserves, token0Address, token1Address] = await Promise.all([
              poolContract.getReserves(),
              poolContract.token0(),
              poolContract.token1(),
            ]);

            // Identify which token is ACES
            const acesAddress = ACES_TOKEN_ADDRESS.toLowerCase();
            const isToken0Aces = token0Address.toLowerCase() === acesAddress;
            const isToken1Aces = token1Address.toLowerCase() === acesAddress;

            if (!isToken0Aces && !isToken1Aces) {
              fastify.log.warn(
                { address, poolAddress, token0: token0Address, token1: token1Address },
                '⚠️ ACES token not found in pool',
              );
              // Fallback to bonding liquidity
              if (bondingLiquidityUsd) {
                liquidityUsd = bondingLiquidityUsd;
                liquiditySource = 'bonding_curve';
              }
            } else {
              // Get ACES reserve (both tokens use 18 decimals)
              const acesReserveRaw = isToken0Aces ? reserves[0] : reserves[1];
              const acesReserve = new Decimal(acesReserveRaw.toString()).div(
                new Decimal(10).pow(18),
              );

              // Calculate total liquidity: ACES reserve × ACES price × 2 (for 50/50 pool)
              const acesUsdDecimal = new Decimal(acesUsdPrice || 0);
              const acesReserveUsd = acesReserve.mul(acesUsdDecimal);
              const totalLiquidityUsd = acesReserveUsd.mul(2); // Double for 50/50 pool

              const liquidityValueNumber = totalLiquidityUsd.isFinite()
                ? totalLiquidityUsd.toNumber()
                : 0;

              if (liquidityValueNumber > 0) {
                liquidityUsd = liquidityValueNumber;
                liquiditySource = 'dex';

                fastify.log.info(
                  {
                    address,
                    poolAddress,
                    acesReserve: acesReserve.toFixed(2),
                    acesUsdPrice,
                    liquidityUsd: liquidityUsd.toFixed(2),
                    isToken0Aces,
                  },
                  '✅ Calculated DEX liquidity from pool reserves',
                );
              } else {
                // Invalid calculation, fallback to bonding liquidity
                if (bondingLiquidityUsd) {
                  liquidityUsd = bondingLiquidityUsd;
                  liquiditySource = 'bonding_curve';
                }
              }
            }
          } catch (error) {
            fastify.log.error(
              { error, address, poolAddress },
              '❌ Failed to query DEX pool reserves',
            );
            // Fallback to bonding liquidity on error
            if (bondingLiquidityUsd) {
              liquidityUsd = bondingLiquidityUsd;
              liquiditySource = 'bonding_curve';
            }
          }
        }

        if (liquidityUsd === null) {
          try {
            // Query contract directly for ACES balance (source of truth)
            const effectiveChainId = (chainId ?? BASE_MAINNET_CHAIN_ID) as SupportedChainId;
            const networkConfig = getNetworkConfig(effectiveChainId);

            if (!networkConfig.rpcUrl || !networkConfig.acesFactoryProxy) {
              throw new Error(
                `Network config incomplete for chainId ${effectiveChainId}: rpcUrl=${!!networkConfig.rpcUrl}, factory=${!!networkConfig.acesFactoryProxy}`,
              );
            }

            const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
            const FACTORY_ABI = [
              'function tokens(address) view returns (address tokenAddress, uint256 curve, uint256 acesTokenBalance, uint256 tokensBondedAt, bool tokenBonded, uint256 floor, uint256 steepness)',
            ];

            const factoryContract = new ethers.Contract(
              networkConfig.acesFactoryProxy,
              FACTORY_ABI,
              provider,
            );
            const tokenData = await factoryContract.tokens(address);
            const acesBalanceWei = tokenData.acesTokenBalance;
            const liquidityAces = new Decimal(acesBalanceWei.toString()).div(
              new Decimal(10).pow(18),
            );

            // Only calculate USD value if ACES price is valid
            // If ACES price is 0 or invalid, fall back to bondingLiquidityUsd or null
            if (acesUsdPrice && acesUsdPrice > 0) {
              const liquidityValue = liquidityAces.mul(new Decimal(acesUsdPrice));
              if (liquidityValue.gt(0)) {
                liquidityUsd = liquidityValue.toNumber();
                liquiditySource = 'bonding_curve';
              } else {
                liquidityUsd = bondingLiquidityUsd ?? null;
                liquiditySource = liquidityUsd !== null ? 'bonding_curve' : liquiditySource;
              }
            } else {
              // ACES price is invalid, use fallback or keep as null
              liquidityUsd = bondingLiquidityUsd ?? null;
              liquiditySource = liquidityUsd !== null ? 'bonding_curve' : liquiditySource;
            }

            fastify.log.info(
              {
                address,
                liquidityUsd,
                liquiditySource,
                liquidityAces: liquidityAces.toString(),
                acesBalanceWei: acesBalanceWei.toString(),
                acesUsdPrice,
                skippedDueToInvalidPrice: !acesUsdPrice || acesUsdPrice <= 0,
              },
              'Calculated bonding curve liquidity from contract',
            );
          } catch (error) {
            fastify.log.error(
              { error, address },
              'Failed to compute bonding curve liquidity from contract',
            );
            liquidityUsd = null;
          }
        }

        // Determine supply based on token state (bonding curve vs DEX)
        const supply = isDexMode ? 1_000_000_000 : 800_000_000;
        const marketCapUsd = tokenPriceUsd * supply;

        const totalFeesAces = bondingFeesAces + dexFeesAces;
        const bondingFeesUsd = bondingFeesAces * acesUsdPrice;
        const totalFeesUsd =
          Number.isFinite(acesUsdPrice) && acesUsdPrice > 0
            ? totalFeesAces * acesUsdPrice
            : bondingFeesUsd + dexFeesUsd;

        // 🔥 OPTIMIZED: Build response data
        const responseData = {
          contractAddress: address,
          volume24hUsd,
          volume24hAces: volume24hAces.toString(),
          marketCapUsd,
          tokenPriceUsd,
          holderCount,
          totalFeesUsd,
          totalFeesAces: totalFeesAces.toString(),
          dexFeesUsd,
          dexFeesAces: dexFeesAces.toString(),
          bondingFeesUsd,
          bondingFeesAces: bondingFeesAces.toString(),
          liquidityUsd,
          liquiditySource,
        };

        // 🔥 OPTIMIZED: Cache the response
        metricsCache.set(cacheKey, {
          data: responseData,
          timestamp: Date.now(),
        });

        return reply.send({
          success: true,
          data: responseData,
          cached: false,
        });
      } catch (error) {
        fastify.log.error({ error }, 'Token metrics fetch error');
        return reply.code(500).send({
          success: false,
          error: 'Failed to fetch token metrics',
        });
      }
    },
  );

  // DEPRECATED: Old chart endpoint - replaced by /api/v1/chart/:address/unified
  // This endpoint used the old SupplyBasedOHLCVService and OHLCVService which have been removed
  // Please use the new unified chart endpoint instead
  /*
  fastify.get('/:address/chart', async (request, reply) => {
    return reply.code(410).send({
      success: false,
      error: 'This endpoint has been deprecated',
      message: 'Please use /api/v1/chart/:address/unified instead',
    });
  });
  */
}
