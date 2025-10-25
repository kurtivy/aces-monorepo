import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ChartAggregationService } from '../../services/chart-aggregation-service';

interface ChartParams {
  tokenAddress: string;
}

interface ChartQuery {
  timeframe?: '5m' | '15m' | '1h' | '4h' | '1d';
  from?: string;
  to?: string;
  limit?: string;
}

/**
 * Unified chart endpoint
 * Returns both price and market cap data in a single request
 * No database caching - always fresh from SubGraph/BitQuery
 */
export async function chartUnifiedRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/v1/chart/:tokenAddress/unified',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
          }),
        ),
        querystring: zodToJsonSchema(
          z.object({
            timeframe: z.enum(['5m', '15m', '1h', '4h', '1d']).default('1h'),
            from: z.string().optional(),
            to: z.string().optional(),
            limit: z.string().optional(),
          }),
        ),
      },
    },
    async (
      request: FastifyRequest<{
        Params: ChartParams;
        Querystring: ChartQuery;
      }>,
      reply,
    ) => {
      try {
        const { tokenAddress } = request.params;
        const { timeframe = '1h', from, to, limit } = request.query;

        const requestStart = Date.now();

        console.log(`[ChartUnified] 📊 Request for ${tokenAddress}`, {
          timeframe,
          from,
          to,
          limit: limit || 'default(200)',
        });

        // Calculate time range
        const toDate = to ? new Date(parseInt(to) * 1000) : new Date();
        const fromDate = from
          ? new Date(parseInt(from) * 1000)
          : new Date(toDate.getTime() - 2 * 24 * 60 * 60 * 1000); // Default: 2 days (reduced for faster loading)

        // 🔥 OPTIMIZED: Reuse the existing service instance (with caching!)
        const chartService = (fastify as any).chartAggregationService;

        if (!chartService) {
          console.error('[ChartUnified] ❌ chartAggregationService not available');
          return reply.code(503).send({
            success: false,
            error: 'Chart service not initialized',
          });
        }

        // Fetch chart data
        const chartData = await chartService.getChartData(tokenAddress, {
          timeframe,
          from: fromDate,
          to: toDate,
          limit: limit ? parseInt(limit) : 200, // 🔥 OPTIMIZED: Lower default limit
        });

        const requestDuration = Date.now() - requestStart;
        console.log(
          `[ChartUnified] ⏱️ Returning ${chartData.candles.length} candles in ${requestDuration}ms`,
        );

        // Format response for TradingView
        const response = {
          success: true,
          data: {
            candles: chartData.candles.map((candle: any) => ({
              timestamp: Math.floor(candle.timestamp.getTime() / 1000),
              price: {
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                openUsd: candle.openUsd,
                highUsd: candle.highUsd,
                lowUsd: candle.lowUsd,
                closeUsd: candle.closeUsd,
                volume: candle.volume,
                volumeUsd: candle.volumeUsd,
              },
              marketCap: {
                aces: candle.marketCapAces,
                usd: candle.marketCapUsd,
                // Market cap OHLC for smooth chart connections
                marketCapOpenUsd: candle.marketCapOpenUsd,
                marketCapHighUsd: candle.marketCapHighUsd,
                marketCapLowUsd: candle.marketCapLowUsd,
                marketCapCloseUsd: candle.marketCapCloseUsd,
              },
              supply: {
                circulating: candle.circulatingSupply,
                total: candle.totalSupply,
              },
              trades: candle.trades,
              dataSource: candle.dataSource,
            })),
            graduationState: chartData.graduationState,
            acesUsdPrice: chartData.acesUsdPrice,
            metadata: {
              timeframe,
              from: fromDate.toISOString(),
              to: toDate.toISOString(),
              candleCount: chartData.candles.length,
            },
          },
        };

        return reply.send(response);
      } catch (error) {
        console.error('[ChartUnified] Error:', error);

        return reply.code(500).send({
          success: false,
          error: 'Failed to fetch chart data',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  /**
   * Health check endpoint for chart service
   */
  fastify.get('/api/v1/chart/health', async (request, reply) => {
    try {
      // Check if required services are available
      const bitQueryService = (fastify as any).bitQueryService;
      const acesUsdPriceService = (fastify as any).acesUsdPriceService;

      const checks = {
        bitQueryService: !!bitQueryService,
        acesUsdPriceService: !!acesUsdPriceService,
        prisma: !!fastify.prisma,
        subgraphUrl: !!process.env.GOLDSKY_SUBGRAPH_URL,
      };

      const allHealthy = Object.values(checks).every((check) => check);

      return reply.code(allHealthy ? 200 : 503).send({
        success: allHealthy,
        checks,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * 🔥 NEW: Cache statistics endpoint
   */
  fastify.get('/api/v1/cache/stats', async (request, reply) => {
    try {
      const tokenCache = (fastify as any).tokenMetadataCache;
      const snapshotCache = (fastify as any).acesSnapshotCache;
      const chartService = (fastify as any).chartAggregationService;

      if (!tokenCache) {
        return reply.code(503).send({
          success: false,
          error: 'Cache service not initialized',
        });
      }

      const stats = {
        tokenMetadataCache: tokenCache.getStats(),
        acesSnapshotCache: snapshotCache ? snapshotCache.getStats() : null,
        timestamp: new Date().toISOString(),
      };

      return reply.send({
        success: true,
        stats,
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * 🔥 NEW: Manual cache invalidation endpoint
   */
  fastify.post('/api/v1/cache/clear', async (request, reply) => {
    try {
      const tokenCache = (fastify as any).tokenMetadataCache;

      if (!tokenCache) {
        return reply.code(503).send({
          success: false,
          error: 'Cache service not initialized',
        });
      }

      const { tokenAddress } = request.body as { tokenAddress?: string };
      const snapshotCache = (fastify as any).acesSnapshotCache;

      tokenCache.invalidate(tokenAddress);
      if (snapshotCache) {
        snapshotCache.invalidate(tokenAddress);
      }

      return reply.send({
        success: true,
        message: tokenAddress ? `Caches cleared for ${tokenAddress}` : 'All caches cleared',
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
