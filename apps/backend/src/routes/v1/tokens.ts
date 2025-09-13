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
}
