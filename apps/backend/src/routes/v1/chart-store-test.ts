import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

interface StoreParams {
  tokenAddress: string;
}

interface StoreQuery {
  timeframe?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
}

/**
 * Test endpoints for Chart Data Store
 * These endpoints help verify the in-memory store is working correctly
 */
export async function chartDataStoreTestRoutes(fastify: FastifyInstance) {
  /**
   * Get statistics about the chart data store
   */
  fastify.get('/api/v1/chart/store/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const chartDataStore = (fastify as any).chartDataStore;

    if (!chartDataStore) {
      return reply.code(503).send({
        success: false,
        error: 'Chart Data Store not initialized',
      });
    }

    const stats = chartDataStore.getStats();

    return reply.send({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Check if token has data in memory for a specific timeframe
   */
  fastify.get(
    '/api/v1/chart/store/:tokenAddress/has-data',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
          }),
        ),
        querystring: zodToJsonSchema(
          z.object({
            timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).default('1h'),
          }),
        ),
      },
    },
    async (
      request: FastifyRequest<{
        Params: StoreParams;
        Querystring: StoreQuery;
      }>,
      reply: FastifyReply,
    ) => {
      const { tokenAddress } = request.params;
      const { timeframe = '1h' } = request.query;

      const chartDataStore = (fastify as any).chartDataStore;

      if (!chartDataStore) {
        return reply.code(503).send({
          success: false,
          error: 'Chart Data Store not initialized',
        });
      }

      const hasData = chartDataStore.hasData(tokenAddress, timeframe);
      const latestCandle = chartDataStore.getLatestCandle(tokenAddress, timeframe);

      return reply.send({
        success: true,
        data: {
          hasData,
          latestCandle: latestCandle
            ? {
                timestamp: latestCandle.timestamp.toISOString(),
                close: latestCandle.close,
                closeUsd: latestCandle.closeUsd,
                volume: latestCandle.volume,
                trades: latestCandle.trades,
              }
            : null,
          timeframe,
        },
      });
    },
  );

  /**
   * Get raw candles from memory for a token/timeframe
   */
  fastify.get(
    '/api/v1/chart/store/:tokenAddress/candles',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
          }),
        ),
        querystring: zodToJsonSchema(
          z.object({
            timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).default('1h'),
            from: z.string().optional(),
            to: z.string().optional(),
          }),
        ),
      },
    },
    async (
      request: FastifyRequest<{
        Params: StoreParams;
        Querystring: StoreQuery & { from?: string; to?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { tokenAddress } = request.params;
      const { timeframe = '1h', from, to } = request.query;

      const chartDataStore = (fastify as any).chartDataStore;

      if (!chartDataStore) {
        return reply.code(503).send({
          success: false,
          error: 'Chart Data Store not initialized',
        });
      }

      const toDate = to ? new Date(parseInt(to) * 1000) : new Date();
      const fromDate = from
        ? new Date(parseInt(from) * 1000)
        : new Date(toDate.getTime() - 24 * 60 * 60 * 1000); // Default: 24 hours

      const candles = chartDataStore.getCandles(tokenAddress, timeframe as any, fromDate, toDate);

      return reply.send({
        success: true,
        data: {
          candles: candles.map((candle: any) => ({
            timestamp: candle.timestamp.toISOString(),
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
            trades: candle.trades,
            dataSource: candle.dataSource,
          })),
          count: candles.length,
          timeframe,
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        },
      });
    },
  );
}
