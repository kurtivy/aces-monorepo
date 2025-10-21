import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { TokenService } from '../../services/token-service';
import { TokenHolderService } from '../../services/token-holder-service';
import { OHLCVService } from '../../services/ohlcv-service';
import { SupplyBasedOHLCVService } from '../../services/supply-based-ohlcv-service';
import { PriceService } from '../../services/price-service';
import { SupportedTimeframe } from '../../types/subgraph.types';

const BASE_MAINNET_CHAIN_ID = 8453;

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
  const priceService = new PriceService(fastify.prisma);

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

        console.log(`[Tokens API] Fetching trades for ${address}, limit: ${limit}`);
        const trades = await tokenService.getRecentTradesForToken(address, limit);
        console.log(`[Tokens API] Found ${trades.length} trades for ${address}`);

        if (trades.length > 0) {
          console.log(`[Tokens API] Sample trade:`, trades[0]);
        }

        // Include graduation metadata for frontend detection
        const token = await fastify.prisma.token.findUnique({
          where: { contractAddress: address.toLowerCase() },
          select: {
            phase: true,
            priceSource: true,
            poolAddress: true,
            dexLiveAt: true,
          },
        });

        const graduationMeta = token
          ? {
              isDexLive: token.phase === 'DEX_TRADING',
              poolAddress: token.poolAddress,
              dexLiveAt: token.dexLiveAt?.toISOString() || null,
              bondingCutoff: token.dexLiveAt?.toISOString() || null,
            }
          : null;

        return reply.send({
          success: true,
          data: trades,
          meta: {
            graduation: graduationMeta,
          },
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
          error: error instanceof Error ? error.message : 'Failed to fetch token holder count',
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

        // 1. Fetch token data (has volume24h, currentPriceACES, supply)
        const tokenData = await tokenService.fetchAndUpdateTokenData(address);

        // 2. Get ACES/USD price for conversions using existing PriceService
        const priceData = await priceService.getAcesPrice();
        const acesUsdPrice = parseFloat(priceData.priceUSD);
        fastify.log.info(
          { acesUsdPrice, isStale: priceData.isStale },
          'ACES/USD price fetched from PriceService',
        );

        // 3. Get holder count via RPC (with timeout to prevent hanging)
        let holderCount = 0;
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
          fastify.log.info({ address, holderCount }, 'Holder count fetched successfully');
        } catch (error) {
          fastify.log.warn({ error, address }, 'Failed to fetch holder count, defaulting to 0');
          // Default to 0 on error or timeout
          holderCount = 0;
        }

        // 4. Get total fees from subgraph
        const fees = await tokenService.getTotalFees(address);

        // 5. Calculate derived metrics
        // Convert volume from WEI to ACES (divide by 10^18)
        const volume24hWei = tokenData.volume24h || '0';
        const volume24hAces = parseFloat(volume24hWei) / 1e18;
        const volume24hUsd = volume24hAces * acesUsdPrice;
        fastify.log.info(
          { volume24hWei, volume24hAces, acesUsdPrice, volume24hUsd },
          'Volume calculation',
        );

        const tokenPriceAces = parseFloat(tokenData.currentPriceACES || '0');
        const tokenPriceUsd = tokenPriceAces * acesUsdPrice;
        fastify.log.info({ tokenPriceAces, acesUsdPrice, tokenPriceUsd }, 'Price calculation');

        // Determine supply based on token state (bonding curve vs DEX)
        // TODO: Check if token has graduated to DEX to use 1B supply
        // For now, assume bonding curve (800M) unless we have DEX metadata
        const supply = 800_000_000; // Will be updated when DEX detection is added
        const marketCapUsd = tokenPriceUsd * supply;

        const totalFeesAces = parseFloat(fees.acesAmount);
        const totalFeesUsd = totalFeesAces * acesUsdPrice;

        return reply.send({
          success: true,
          data: {
            contractAddress: address,
            volume24hUsd,
            volume24hAces: volume24hAces.toString(),
            marketCapUsd,
            tokenPriceUsd,
            holderCount,
            totalFeesUsd,
            totalFeesAces: fees.acesAmount,
          },
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
