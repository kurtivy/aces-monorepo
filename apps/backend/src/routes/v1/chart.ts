import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

interface ChartParams {
  tokenAddress: string;
}

interface ChartQuery {
  timeframe?: '5m' | '15m' | '1h' | '4h' | '1d';
  from?: string;
  to?: string;
  limit?: string;
  includeUsd?: string;
}

export async function chartRoutes(fastify: FastifyInstance) {
  // Unified chart endpoint with market cap
  fastify.get(
    '/api/v1/chart/:tokenAddress',
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
            includeUsd: z.string().optional().default('true'),
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
        const { timeframe = '1h', from, to, limit, includeUsd = 'true' } = request.query;

        // Get candles directly from database (since we populated them)
        const candles = await fastify.prisma.tokenOHLCV.findMany({
          where: {
            contractAddress: tokenAddress.toLowerCase(),
            timeframe,
          },
          orderBy: {
            timestamp: 'asc',
          },
          take: limit ? parseInt(limit) : 1000,
        });

        console.log(`[Chart API] Found ${candles.length} candles for ${tokenAddress} ${timeframe}`);

        return reply.send({
          success: true,
          data: {
            candles: candles.map((c) => ({
              timestamp: Math.floor(c.timestamp.getTime() / 1000),
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              openUsd: c.openUsd || '0',
              highUsd: c.highUsd || '0',
              lowUsd: c.lowUsd || '0',
              closeUsd: c.closeUsd || '0',
              volume: c.volume,
              volumeUsd: c.volumeUsd || '0',
              trades: c.trades,
              circulatingSupply: c.circulatingSupply || '0',
              totalSupply: c.totalSupply || '30000000',
              marketCapAces: c.marketCapAces || '0',
              marketCapUsd: c.marketCapUsd || '0',
              dataSource: c.dataSource,
            })),
            graduationState: {
              isBonded: false,
              poolAddress: null,
              poolReady: false,
              dexLiveAt: null,
            },
            acesUsdPrice: '0.002570', // From your populate script
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Chart data fetch error');
        return reply.code(500).send({
          success: false,
          error: 'Failed to fetch chart data',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  // Market cap chart endpoint
  fastify.get(
    '/api/v1/chart/:tokenAddress/market-cap',
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
            currency: z.enum(['usd', 'aces']).default('usd'),
          }),
        ),
      },
    },
    async (
      request: FastifyRequest<{
        Params: ChartParams;
        Querystring: ChartQuery & { currency?: 'usd' | 'aces' };
      }>,
      reply,
    ) => {
      try {
        const { tokenAddress } = request.params;
        const { timeframe = '1h', from, to, currency = 'usd' } = request.query;

        const unifiedService = (fastify as any).unifiedChartService;

        const chartData = await unifiedService.getChartData(tokenAddress, {
          timeframe,
          from: from ? new Date(parseInt(from) * 1000) : undefined,
          to: to ? new Date(parseInt(to) * 1000) : undefined,
          includeUsd: true,
        });

        const marketCapCandles = chartData.candles.map((c: any) => {
          const timestamp = Math.floor(
            (c.timestamp instanceof Date ? c.timestamp : new Date(c.timestamp)).getTime() / 1000,
          );
          const mcValue = currency === 'usd' ? c.marketCapUsd : c.marketCapAces;

          return {
            timestamp,
            open: mcValue,
            high: mcValue,
            low: mcValue,
            close: mcValue,
            volume: c.volume,
            volumeUsd: c.volumeUsd,
            trades: c.trades,
            circulatingSupply: c.circulatingSupply,
          };
        });

        return reply.send({
          success: true,
          data: {
            candles: marketCapCandles,
            currency,
            graduationState: chartData.graduationState,
            acesUsdPrice: chartData.acesUsdPrice,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Market cap data fetch error');
        return reply.code(500).send({
          success: false,
          error: 'Failed to fetch market cap data',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  // ACES price endpoint
  fastify.get('/api/v1/aces/price', async (request, reply) => {
    try {
      const acesUsdPriceService = (fastify as any).acesUsdPriceService;
      const priceResult = await acesUsdPriceService.getAcesUsdPrice();

      return reply.send({
        success: true,
        data: {
          price: priceResult.price,
          source: priceResult.source,
          timestamp: priceResult.timestamp,
        },
      });
    } catch (error) {
      fastify.log.error({ error }, 'ACES price fetch error');
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch ACES price',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  fastify.get(
    '/api/v1/chart/:tokenAddress/raw',
    async (request: FastifyRequest<{ Params: ChartParams }>, reply) => {
      try {
        const { tokenAddress } = request.params;

        console.log(`[Chart/Raw] Fetching candles for ${tokenAddress}`);

        // Get candles directly from database
        const candles = await fastify.prisma.tokenOHLCV.findMany({
          where: {
            contractAddress: tokenAddress.toLowerCase(),
          },
          orderBy: {
            timestamp: 'desc',
          },
          take: 100,
        });

        console.log(`[Chart/Raw] Found ${candles.length} candles in database`);

        // Group by timeframe for debugging
        const byTimeframe = candles.reduce((acc: any, c) => {
          acc[c.timeframe] = (acc[c.timeframe] || 0) + 1;
          return acc;
        }, {});

        console.log(`[Chart/Raw] Candles by timeframe:`, byTimeframe);

        return reply.send({
          success: true,
          count: candles.length,
          byTimeframe,
          data: candles,
        });
      } catch (error) {
        console.error('[Chart/Raw] Error:', error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );
}
