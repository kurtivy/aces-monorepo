import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { UnifiedChartResponse } from '../../services/chart-aggregation-service';

// Import Candle type - it's internal to chart-aggregation-service, so we'll define it here
interface Candle {
  timestamp: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  openUsd: string;
  highUsd: string;
  lowUsd: string;
  closeUsd: string;
  volume: string;
  volumeUsd: string;
  trades: number;
  dataSource: 'bonding_curve' | 'dex';
  circulatingSupply: string;
  totalSupply: string;
  marketCapAces: string;
  marketCapUsd: string;
  marketCapOpenUsd?: string;
  marketCapHighUsd?: string;
  marketCapLowUsd?: string;
  marketCapCloseUsd?: string;
}

interface ChartParams {
  tokenAddress: string;
}

interface ChartQuery {
  timeframe?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  from?: string;
  to?: string;
  limit?: string;
}

/**
 * Execute a promise with a timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out',
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${errorMessage} (timeout: ${timeoutMs}ms)`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
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
            timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).default('1h'),
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

        // 🔥 PHASE 3: Check ChartDataStore first (in-memory cache)
        const chartDataStore = (fastify as any).chartDataStore;
        const chartService = (fastify as any).chartAggregationService;
        const acesUsdPriceService = (fastify as any).acesUsdPriceService;

        // Calculate time range
        const toDate = to ? new Date(parseInt(to) * 1000) : new Date();
        const fromDate = from
          ? new Date(parseInt(from) * 1000)
          : new Date(toDate.getTime() - 2 * 24 * 60 * 60 * 1000); // Default: 2 days

        // Check if request is within memory window (7 days)
        const memoryWindowMs = 7 * 24 * 60 * 60 * 1000;
        const requestSpanMs = toDate.getTime() - fromDate.getTime();
        const isWithinMemoryWindow =
          requestSpanMs <= memoryWindowMs && toDate.getTime() >= Date.now() - memoryWindowMs;

        let responseData: {
          candles: UnifiedChartResponse['candles'];
          graduationState: UnifiedChartResponse['graduationState'];
          acesUsdPrice: UnifiedChartResponse['acesUsdPrice'];
          metadata: {
            timeframe: string;
            from: string;
            to: string;
            candleCount: number;
            dataSource: 'memory' | 'chart_service';
          };
        } | null = null;
        let dataSource: 'memory' | 'chart_service' = 'chart_service';

        // 🔥 PHASE 3: Try memory first if within window
        if (chartDataStore && isWithinMemoryWindow) {
          // 🔥 LAZY LOADING: Populate memory if empty
          if (!chartDataStore.hasData(tokenAddress, timeframe as any)) {
            try {
              // Get ACES USD price for lazy loading
              const acesPriceResult = acesUsdPriceService
                ? await acesUsdPriceService.getAcesUsdPrice()
                : null;

              // Extract price from result
              const acesPriceNum = acesPriceResult?.price ? parseFloat(acesPriceResult.price) : 0;

              if (acesPriceNum > 0) {
                const chartWebSocket = (fastify as any).chartWebSocket;
                await chartDataStore.populateFromUnifiedService(
                  tokenAddress,
                  acesPriceNum,
                  chartWebSocket,
                );
              } else {
                fastify.log.warn(
                  {
                    tokenAddress,
                    acesPriceResult,
                    acesPriceNum,
                  },
                  '⚠️ [ChartUnified] Invalid ACES price for lazy loading',
                );
              }
            } catch (populateError) {
              fastify.log.warn(
                {
                  err: populateError,
                  tokenAddress,
                },
                '⚠️ [ChartUnified] Lazy loading failed, continuing with fallback',
              );
            }
          }

          // Try memory again after lazy loading
          if (chartDataStore.hasData(tokenAddress, timeframe as any)) {
            try {
              const memoryStart = Date.now();
              const memoryCandles = chartDataStore.getCandles(
                tokenAddress,
                timeframe as any,
                fromDate,
                toDate,
              );

              if (memoryCandles.length > 0) {
                // Get ACES USD price
                const acesPriceResult = acesUsdPriceService
                  ? await acesUsdPriceService.getAcesUsdPrice()
                  : null;
                const acesUsdPrice = acesPriceResult?.price || '0';

                // Get graduation state (need to fetch from chart service for this)
                let graduationState;
                if (chartService && typeof chartService.getChartData === 'function') {
                  // Fetch minimal data just to get graduation state
                  const minimalChartData = await chartService.getChartData(tokenAddress, {
                    timeframe,
                    from: new Date(Date.now() - 3600000), // Last hour
                    to: new Date(),
                    limit: 1,
                  });
                  graduationState = minimalChartData.graduationState;
                } else {
                  graduationState = {
                    isBonded: false,
                    poolReady: false,
                    poolAddress: null,
                    dexLiveAt: null,
                  };
                }

                // Convert memory candles to response format
                const formattedCandles = memoryCandles.map((candle: any) => ({
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
                }));

                const memoryDuration = Date.now() - memoryStart;
                fastify.log.info(
                  {
                    tokenAddress,
                    candleCount: formattedCandles.length,
                    duration: memoryDuration,
                    source: 'memory',
                  },
                  `✅ [ChartUnified] ⚡ Ultra-fast memory read: ${memoryDuration}ms`,
                );

                responseData = {
                  candles: formattedCandles,
                  graduationState,
                  acesUsdPrice:
                    typeof acesUsdPrice === 'string' ? acesUsdPrice : acesUsdPrice.toString(),
                  metadata: {
                    timeframe,
                    from: fromDate.toISOString(),
                    to: toDate.toISOString(),
                    candleCount: formattedCandles.length,
                    dataSource: 'memory',
                  },
                };
                dataSource = 'memory';
              }
            } catch (memoryError) {
              fastify.log.warn(
                {
                  err: memoryError,
                  tokenAddress,
                },
                '⚠️ [ChartUnified] Memory read failed, falling back to chart service',
              );
            }
          }
        }

        // 🔥 PHASE 3: Fallback to chart service if memory miss or historical request
        if (!responseData || dataSource === 'chart_service') {
          const requestStart = Date.now();

          fastify.log.info(
            {
              tokenAddress,
              timeframe,
              from,
              to,
              limit: limit || 'default(200)',
              reason:
                dataSource === 'chart_service' ? 'historical/outside-memory-window' : 'memory-miss',
            },
            `[ChartUnified] 📊 Fetching from chart service for ${tokenAddress}`,
          );

          if (!chartService) {
            throw new Error('Chart service not initialized');
          }

          // 🔥 TIMEOUT: Overall timeout for chart data fetch (15 seconds)
          const CHART_FETCH_TIMEOUT_MS = 15000;

          // Fetch chart data with timeout
          const chartData: UnifiedChartResponse = await withTimeout(
            chartService.getChartData(tokenAddress, {
              timeframe,
              from: fromDate,
              to: toDate,
              limit: limit ? parseInt(limit) : 200,
            }),
            CHART_FETCH_TIMEOUT_MS,
            'Chart data fetch timeout',
          );

          const requestDuration = Date.now() - requestStart;
          fastify.log.info(
            {
              tokenAddress,
              candleCount: chartData.candles.length,
              duration: requestDuration,
              source: 'chart_service',
            },
            `⏱️ [ChartUnified] Chart service fetch: ${requestDuration}ms`,
          );

          // Format response for TradingView
          responseData = {
            candles: chartData.candles.map((candle: Candle) => ({
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
            })) as any, // Type assertion needed due to format transformation
            graduationState: chartData.graduationState,
            acesUsdPrice: chartData.acesUsdPrice,
            metadata: {
              timeframe,
              from: fromDate.toISOString(),
              to: toDate.toISOString(),
              candleCount: chartData.candles.length,
              dataSource: 'chart_service',
            },
          };
        }

        if (!responseData) {
          throw new Error('Failed to fetch chart data');
        }

        return reply.send({
          success: true,
          data: responseData,
          source: dataSource,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isTimeout = errorMessage.includes('timeout');

        fastify.log.error(
          {
            err: error,
            tokenAddress: request.params.tokenAddress,
            isTimeout,
          },
          isTimeout ? '⏱️ [ChartUnified] Timeout error' : '❌ [ChartUnified] Error',
        );

        return reply.code(isTimeout ? 504 : 500).send({
          success: false,
          error: isTimeout
            ? 'Chart data fetch timed out. Please try again or reduce the time range.'
            : 'Failed to fetch chart data',
          message: errorMessage,
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
}
