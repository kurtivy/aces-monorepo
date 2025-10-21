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

        // Get current ACES/USD price for conversion
        const acesUsdPriceService = (fastify as any).acesUsdPriceService;
        const priceResult = await acesUsdPriceService.getAcesUsdPrice();
        const acesUsdPrice = parseFloat(priceResult.price);

        // DEBUG: Log ACES price fetching
        console.log('🔍 [Chart API] ACES/USD Price Service:', {
          serviceExists: !!acesUsdPriceService,
          rawPrice: priceResult.price,
          parsedPrice: acesUsdPrice,
          isValidPrice: !isNaN(acesUsdPrice) && acesUsdPrice > 0,
          source: priceResult.source,
          timestamp: priceResult.timestamp,
        });

        if (!acesUsdPrice || isNaN(acesUsdPrice) || acesUsdPrice <= 0) {
          console.error('❌ [Chart API] INVALID ACES/USD PRICE - USD conversion will fail!');
        }

        // Use unifiedChartService to get candles (generates from trades, not database)
        const unifiedService = (fastify as any).unifiedChartService;
        const chartData = await unifiedService.getChartData(tokenAddress, {
          timeframe,
          from: from ? new Date(parseInt(from) * 1000) : undefined,
          to: to ? new Date(parseInt(to) * 1000) : undefined,
          limit: limit ? parseInt(limit) : 1000,
          includeUsd: includeUsd === 'true',
        });

        console.log(
          `[Chart API] Generated ${chartData.candles.length} candles for ${tokenAddress} ${timeframe}, ACES/USD: ${acesUsdPrice}`,
        );

        // Convert UnifiedCandle format to API response format
        const mappedCandles = chartData.candles.map((c: any, index: number) => {
          const timestamp =
            c.timestamp instanceof Date
              ? Math.floor(c.timestamp.getTime() / 1000)
              : Math.floor(c.timestamp / 1000);

          // DEBUG: Log first candle
          if (index === 0) {
            console.log('🔍 [Chart API] First candle from UnifiedService:', {
              timestamp: c.timestamp,
              open: c.open,
              close: c.close,
              openUsd: c.openUsd,
              closeUsd: c.closeUsd,
              dataSource: c.dataSource,
            });
          }

          return {
            timestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            openUsd: c.openUsd,
            highUsd: c.highUsd,
            lowUsd: c.lowUsd,
            closeUsd: c.closeUsd,
            volume: c.volume,
            volumeUsd: c.volumeUsd,
            trades: c.trades,
            circulatingSupply: c.circulatingSupply || '0',
            totalSupply: c.totalSupply || '30000000',
            marketCapAces: c.marketCapAces || '0',
            marketCapUsd: c.marketCapUsd || '0',
            dataSource: c.dataSource,
          };
        });

        // DEBUG: Log response summary
        console.log('🔍 [Chart API] Response summary:', {
          candleCount: mappedCandles.length,
          firstCandleHasUsd: !!mappedCandles[0]?.openUsd,
          sampleOpenUsd: mappedCandles[0]?.openUsd,
          acesUsdPriceInResponse: chartData.acesUsdPrice || acesUsdPrice.toFixed(6),
        });

        return reply.send({
          success: true,
          data: {
            candles: mappedCandles,
            graduationState: chartData.graduationState,
            acesUsdPrice: chartData.acesUsdPrice || acesUsdPrice.toFixed(6),
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

        const marketCapCandles = chartData.candles.map((c: any, index: number) => {
          const timestamp = Math.floor(
            (c.timestamp instanceof Date ? c.timestamp : new Date(c.timestamp)).getTime() / 1000,
          );

          // Use pre-calculated market cap OHLC instead of calculating on-the-fly
          const mcapOhlc = currency === 'usd' ? c.marketCapOhlcUsd : c.marketCapOhlcAces;

          // Fallback to on-the-fly calculation if pre-calculated not available (for backward compatibility)
          let mcOpen: string, mcHigh: string, mcLow: string, mcClose: string;

          if (mcapOhlc) {
            // Use pre-calculated market cap OHLC (preferred)
            mcOpen = mcapOhlc.open;
            mcHigh = mcapOhlc.high;
            mcLow = mcapOhlc.low;
            mcClose = mcapOhlc.close;
          } else {
            // Fallback: Calculate on-the-fly (legacy behavior)
            const supply = chartData.graduationState?.poolReady
              ? parseFloat(c.circulatingSupply || '0')
              : 800000000;

            if (currency === 'usd') {
              const openUsd = parseFloat(c.openUsd || '0');
              const highUsd = parseFloat(c.highUsd || '0');
              const lowUsd = parseFloat(c.lowUsd || '0');
              const closeUsd = parseFloat(c.closeUsd || '0');

              mcOpen = (supply * openUsd).toFixed(2);
              mcHigh = (supply * highUsd).toFixed(2);
              mcLow = (supply * lowUsd).toFixed(2);
              mcClose = (supply * closeUsd).toFixed(2);
            } else {
              const open = parseFloat(c.open || '0');
              const high = parseFloat(c.high || '0');
              const low = parseFloat(c.low || '0');
              const close = parseFloat(c.close || '0');

              mcOpen = (supply * open).toFixed(2);
              mcHigh = (supply * high).toFixed(2);
              mcLow = (supply * low).toFixed(2);
              mcClose = (supply * close).toFixed(2);
            }
          }

          // DEBUG: Log first candle
          if (index === 0) {
            console.log('[Market Cap API] First candle:', {
              timestamp: c.timestamp,
              currency,
              usingPreCalculated: !!mcapOhlc,
              marketCap: { open: mcOpen, high: mcHigh, low: mcLow, close: mcClose },
            });
          }

          return {
            timestamp,
            open: mcOpen,
            high: mcHigh,
            low: mcLow,
            close: mcClose,
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
