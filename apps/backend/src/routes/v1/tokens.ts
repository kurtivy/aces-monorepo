import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { TokenService } from '../../services/token-service';
import { TokenHolderService } from '../../services/token-holder-service';
import { OHLCVService } from '../../services/ohlcv-service';
import { SupplyBasedOHLCVService } from '../../services/supply-based-ohlcv-service';
import { SupportedTimeframe } from '../../types/subgraph.types';

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

interface HolderQuery {
  chainId?: number;
}

export async function tokensRoutes(fastify: FastifyInstance) {
  const tokenService = new TokenService(fastify.prisma);
  const tokenHolderService = new TokenHolderService();
  const ohlcvService = new OHLCVService(fastify.prisma, tokenService);
  const supplyBasedOHLCVService = new SupplyBasedOHLCVService();

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
          error:
            error instanceof Error ? error.message : 'Failed to fetch token holder count',
        });
      }
    },
  );

  // Live candle with bonding curve marginal prices
  // Used for real-time chart updates (polls every 5 seconds)
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
            timeframe: z.enum(['5m', '15m', '1h', '4h', '1d']).default('1h'),
            since: z.string().optional(), // Unix timestamp (deprecated, kept for compatibility)
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
        const { timeframe = '1h' } = request.query;

        // Fetch candles using SupplyBasedOHLCVService for marginal prices
        const allCandles = await supplyBasedOHLCVService.getCandles(
          address,
          timeframe as SupportedTimeframe,
          100, // Get last 100 trades for live updates
        );

        if (!allCandles || allCandles.length === 0) {
          return reply.send({
            success: true,
            data: {
              timeframe,
              candles: [],
              volume: [],
              count: 0,
              isLive: true,
              lastUpdate: Date.now(),
              message: 'No current candle available',
            },
          });
        }

        // Get the most recent candle
        const currentCandle = allCandles[allCandles.length - 1];

        const chartData = [
          {
            time: Math.floor(currentCandle.timestamp.getTime() / 1000),
            open: parseFloat(currentCandle.open),
            high: parseFloat(currentCandle.high),
            low: parseFloat(currentCandle.low),
            close: parseFloat(currentCandle.close),
          },
        ];

        const volumeData = [
          {
            time: Math.floor(currentCandle.timestamp.getTime() / 1000),
            value: parseFloat(currentCandle.volume),
            color:
              parseFloat(currentCandle.close) >= parseFloat(currentCandle.open)
                ? 'rgba(0, 200, 150, 0.6)'
                : 'rgba(255, 91, 91, 0.6)',
          },
        ];

        return reply.send({
          success: true,
          data: {
            timeframe,
            candles: chartData,
            volume: volumeData,
            count: 1,
            isLive: true,
            lastUpdate: Date.now(),
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

  // Chart data with bonding curve marginal prices
  // Calculates correct instantaneous prices that match buy/sell quotes
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
            timeframe: z.enum(['5m', '15m', '1h', '4h', '1d']).default('1h'),
            limit: z.string().transform(Number).default('5000'),
            mode: z.enum(['live', 'cached', 'hybrid']).optional().default('hybrid'),
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
        const { timeframe = '1h', limit = 5000 } = request.query;

        // Use SupplyBasedOHLCVService to calculate marginal prices from bonding curve
        // This shows the instantaneous price at each supply level (matches the quote)
        const candles = await supplyBasedOHLCVService.getCandles(
          address,
          timeframe as SupportedTimeframe,
        );

        if (!candles || candles.length === 0) {
          return reply.send({
            success: true,
            data: {
              timeframe,
              candles: [],
              volume: [],
              count: 0,
              dataSource: 'subgraph',
              message: 'No trading data available for this timeframe',
            },
          });
        }

        // Convert to TradingView format
        const chartData = candles.slice(-limit).map((candle) => ({
          time: Math.floor(candle.timestamp.getTime() / 1000),
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close),
        }));

        const volumeData = candles.slice(-limit).map((candle) => ({
          time: Math.floor(candle.timestamp.getTime() / 1000),
          value: parseFloat(candle.volume),
          color:
            parseFloat(candle.close) >= parseFloat(candle.open)
              ? 'rgba(0, 200, 150, 0.6)'
              : 'rgba(255, 91, 91, 0.6)',
        }));

        // Optional: Store to DB in background (non-blocking)
        if (candles.length > 0) {
          ohlcvService.storeCandlesInBackground(address, timeframe, candles).catch((err) => {
            console.warn('[API /chart] Background DB storage failed:', err);
          });
        }

        return reply.send({
          success: true,
          data: {
            timeframe,
            candles: chartData,
            volume: volumeData,
            count: chartData.length,
            dataSource: 'subgraph',
            lastUpdate: Date.now(),
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Chart data fetch error');

        // Fallback to database if subgraph fails
        try {
          const { address } = request.params;
          const { timeframe = '1h', limit = 5000 } = request.query;

          const dbCandles = await ohlcvService.getStoredOHLCVData(address, timeframe, limit);

          if (dbCandles.length > 0) {
            const chartData = dbCandles.map((candle) => ({
              time: Math.floor(candle.timestamp.getTime() / 1000),
              open: parseFloat(candle.open),
              high: parseFloat(candle.high),
              low: parseFloat(candle.low),
              close: parseFloat(candle.close),
            }));

            const volumeData = dbCandles.map((candle) => ({
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
                dataSource: 'database_fallback',
                warning: 'Using cached data - live data temporarily unavailable',
                lastUpdate: Date.now(),
              },
            });
          }
        } catch (fallbackError) {
          console.error('[API /chart] Database fallback also failed:', fallbackError);
        }

        return reply.code(500).send({
          success: false,
          error: 'Failed to fetch chart data',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );
}
