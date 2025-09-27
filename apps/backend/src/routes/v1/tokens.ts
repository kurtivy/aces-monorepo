import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { TokenService } from '../../services/token-service';
import { OHLCVService } from '../../services/ohlcv-service';

interface TokenParams {
  address: string;
}

interface OHLCVQuery {
  timeframe?: string;
  limit?: number;
}

interface LiveDataQuery {
  timeframe?: string;
  since?: string; // Unix timestamp
  limit?: number;
}

interface ChartQuery {
  timeframe?: string;
  limit?: number;
  mode?: 'live' | 'cached' | 'hybrid';
}

export async function tokensRoutes(fastify: FastifyInstance) {
  const tokenService = new TokenService(fastify.prisma);
  const ohlcvService = new OHLCVService(fastify.prisma, tokenService);

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
        const trades = await tokenService.getRecentTradesForToken(address, limit);

        return reply.send({
          success: true,
          data: trades,
        });
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

  // New: Get OHLCV data for charts
  fastify.get(
    '/:address/ohlcv',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
          }),
        ),
        querystring: zodToJsonSchema(
          z.object({
            timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).default('1h'),
            limit: z.string().transform(Number).default('100'),
          }),
        ),
      },
    },
    async (
      request: FastifyRequest<{
        Params: TokenParams;
        Querystring: OHLCVQuery;
      }>,
      reply,
    ) => {
      try {
        const { address } = request.params;
        const { timeframe = '1h', limit = 100 } = request.query;

        // Generate fresh OHLCV data from subgraph
        const ohlcvCandles = await ohlcvService.generateOHLCVCandles(address, timeframe);

        if (!ohlcvCandles || ohlcvCandles.length === 0) {
          return reply.send({
            success: true,
            data: {
              timeframe,
              candles: [],
              volume: [],
              count: 0,
              message: 'No trading data available for this timeframe',
            },
          });
        }

        // Convert to lightweight-charts format
        const chartData = ohlcvCandles.slice(-limit).map((candle) => ({
          time: Math.floor(candle.timestamp.getTime() / 1000),
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close),
        }));

        const volumeData = ohlcvCandles.slice(-limit).map((candle) => ({
          time: Math.floor(candle.timestamp.getTime() / 1000),
          value: parseFloat(candle.volume),
          color:
            parseFloat(candle.close) >= parseFloat(candle.open)
              ? 'rgba(0, 200, 150, 0.6)'
              : 'rgba(255, 91, 91, 0.6)',
        }));

        return reply.send({
          success: true,
          data: {
            timeframe,
            candles: chartData,
            volume: volumeData,
            count: chartData.length,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'OHLCV fetch error');
        return reply.code(500).send({
          success: false,
          error: 'Failed to fetch chart data',
        });
      }
    },
  );

  // NEW: Get live data directly from subgraph (last N minutes)
  // Used for real-time updates
  fastify.get(
    '/:address/live',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
          }),
        ),
        querystring: zodToJsonSchema(
          z.object({
            timeframe: z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1d']).default('1h'),
            since: z.string().optional(), // Unix timestamp
            limit: z.string().transform(Number).default('100'),
          }),
        ),
      },
    },
    async (
      request: FastifyRequest<{
        Params: TokenParams;
        Querystring: LiveDataQuery;
      }>,
      reply,
    ) => {
      try {
        const { address } = request.params;
        const { timeframe = '1h', since, limit = 100 } = request.query;

        // Convert since timestamp to number
        const sinceTimestamp = since ? parseInt(since) * 1000 : Date.now() - 10 * 60 * 1000; // Default: last 10 minutes

        // Generate live candles from subgraph
        const liveCandles = await ohlcvService.generateLiveCandles(
          address,
          timeframe,
          sinceTimestamp,
        );

        if (!liveCandles || liveCandles.length === 0) {
          return reply.send({
            success: true,
            data: {
              timeframe,
              candles: [],
              volume: [],
              count: 0,
              isLive: true,
              lastUpdate: Date.now(),
              message: 'No new trading data available',
            },
          });
        }

        // Convert to chart format
        const chartData = liveCandles.slice(-limit).map((candle) => ({
          time: Math.floor(candle.timestamp.getTime() / 1000),
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close),
        }));

        const volumeData = liveCandles.slice(-limit).map((candle) => ({
          time: Math.floor(candle.timestamp.getTime() / 1000),
          value: parseFloat(candle.volume),
          color:
            parseFloat(candle.close) >= parseFloat(candle.open)
              ? 'rgba(0, 200, 150, 0.6)'
              : 'rgba(255, 91, 91, 0.6)',
        }));

        return reply.send({
          success: true,
          data: {
            timeframe,
            candles: chartData,
            volume: volumeData,
            count: chartData.length,
            isLive: true,
            lastUpdate: Date.now(),
            since: sinceTimestamp,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Live data fetch error');
        return reply.code(500).send({
          success: false,
          error: 'Failed to fetch live data',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  // NEW: Smart hybrid chart data endpoint
  // Combines cached historical data with live recent data
  fastify.get(
    '/:address/chart',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
          }),
        ),
        querystring: zodToJsonSchema(
          z.object({
            timeframe: z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1d']).default('1h'),
            limit: z.string().transform(Number).default('100'),
            mode: z.enum(['live', 'cached', 'hybrid']).default('hybrid'),
          }),
        ),
      },
    },
    async (
      request: FastifyRequest<{
        Params: TokenParams;
        Querystring: ChartQuery;
      }>,
      reply,
    ) => {
      try {
        const { address } = request.params;
        const { timeframe = '1h', limit = 100, mode = 'hybrid' } = request.query;

        let chartData: Array<{
          time: number;
          open: number;
          high: number;
          low: number;
          close: number;
        }> = [];
        let volumeData: Array<{
          time: number;
          value: number;
          color: string;
        }> = [];
        let isLive = false;
        let dataSource = 'unknown';

        if (mode === 'live') {
          // Force live data only
          const liveCandles = await ohlcvService.generateOHLCVCandles(address, timeframe, {
            forceRefresh: true,
          });

          chartData = liveCandles.slice(-limit).map((candle) => ({
            time: Math.floor(candle.timestamp.getTime() / 1000),
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close),
          }));

          volumeData = liveCandles.slice(-limit).map((candle) => ({
            time: Math.floor(candle.timestamp.getTime() / 1000),
            value: parseFloat(candle.volume),
            color:
              parseFloat(candle.close) >= parseFloat(candle.open)
                ? 'rgba(0, 200, 150, 0.6)'
                : 'rgba(255, 91, 91, 0.6)',
          }));

          isLive = true;
          dataSource = 'live';
        } else if (mode === 'cached') {
          // Use cached data only
          const cachedCandles = await ohlcvService.getStoredOHLCVData(address, timeframe, limit);

          chartData = cachedCandles.reverse().map((candle) => ({
            time: Math.floor(candle.timestamp.getTime() / 1000),
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close),
          }));

          volumeData = cachedCandles.map((candle) => ({
            time: Math.floor(candle.timestamp.getTime() / 1000),
            value: parseFloat(candle.volume),
            color:
              parseFloat(candle.close) >= parseFloat(candle.open)
                ? 'rgba(0, 200, 150, 0.6)'
                : 'rgba(255, 91, 91, 0.6)',
          }));

          dataSource = 'cached';
        } else {
          // Hybrid mode: Use enhanced service with smart caching
          const hybridCandles = await ohlcvService.generateOHLCVCandles(address, timeframe);

          chartData = hybridCandles.slice(-limit).map((candle) => ({
            time: Math.floor(candle.timestamp.getTime() / 1000),
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close),
          }));

          volumeData = hybridCandles.slice(-limit).map((candle) => ({
            time: Math.floor(candle.timestamp.getTime() / 1000),
            value: parseFloat(candle.volume),
            color:
              parseFloat(candle.close) >= parseFloat(candle.open)
                ? 'rgba(0, 200, 150, 0.6)'
                : 'rgba(255, 91, 91, 0.6)',
          }));

          isLive = hybridCandles.length > 0;
          dataSource = 'hybrid';
        }

        if (chartData.length === 0) {
          return reply.send({
            success: true,
            data: {
              timeframe,
              candles: [],
              volume: [],
              count: 0,
              isLive: false,
              dataSource,
              message: 'No trading data available for this timeframe',
            },
          });
        }

        return reply.send({
          success: true,
          data: {
            timeframe,
            candles: chartData,
            volume: volumeData,
            count: chartData.length,
            isLive,
            dataSource,
            lastUpdate: Date.now(),
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
}
