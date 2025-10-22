import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Decimal } from 'decimal.js';
import { ethers } from 'ethers';
import { TokenService } from '../../services/token-service';
import { TokenHolderService } from '../../services/token-holder-service';
import { OHLCVService } from '../../services/ohlcv-service';
import { SupplyBasedOHLCVService } from '../../services/supply-based-ohlcv-service';
import { PriceService } from '../../services/price-service';
import { BitQueryService } from '../../services/bitquery-service';
import { SupportedTimeframe } from '../../types/subgraph.types';
import { ACES_TOKEN_ADDRESS } from '../../config/bitquery.config';
import { getNetworkConfig, type SupportedChainId } from '../../config/network.config';

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
  const bitQueryService = new BitQueryService();

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
        const isDexMode =
          tokenData?.phase === 'DEX_TRADING' ||
          tokenData?.dexLiveAt !== null ||
          tokenData?.priceSource === 'DEX';
        const poolAddress = tokenData?.poolAddress;

        // 2. Get ACES/USD price for conversions using existing PriceService
        const priceData = await priceService.getAcesPrice();
        const parsedAcesUsdPrice = parseFloat(priceData.priceUSD);
        const acesUsdPrice = Number.isFinite(parsedAcesUsdPrice) ? parsedAcesUsdPrice : 0;
        fastify.log.info(
          { acesUsdPrice, isStale: priceData.isStale },
          'ACES/USD price fetched from PriceService',
        );
        const tokenPriceAces = parseFloat(tokenData.currentPriceACES || '0');
        const tokenPriceUsd = Number.isFinite(acesUsdPrice) ? tokenPriceAces * acesUsdPrice : 0;
        fastify.log.info({ tokenPriceAces, acesUsdPrice, tokenPriceUsd }, 'Price calculation');

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

        // 4. Get total fees from subgraph
        const fees = await tokenService.getTotalFees(address);

        // 5. Calculate derived metrics
        let volume24hAces = 0;
        let volume24hUsd = 0;
        let volumeSource: 'dex' | 'bonding_curve' | 'hybrid' = 'bonding_curve';

        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const dexLiveAt = tokenData?.dexLiveAt ? new Date(tokenData.dexLiveAt) : null;

        // Check if token graduated to DEX within the last 24 hours
        const graduatedRecently =
          isDexMode && dexLiveAt && dexLiveAt > twentyFourHoursAgo && dexLiveAt <= now;

        if (isDexMode && typeof poolAddress === 'string' && poolAddress.length > 0) {
          try {
            // Determine time range for DEX trades
            const dexTradeStart = graduatedRecently && dexLiveAt ? dexLiveAt : twentyFourHoursAgo;

            const dexTrades = await bitQueryService.getDexTrades(address, poolAddress, {
              from: dexTradeStart,
              to: now,
            });

            fastify.log.info(
              {
                address,
                poolAddress,
                tradeCount: dexTrades.length,
                graduatedRecently,
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

            // If graduated recently, also fetch bonding curve volume from before graduation
            if (graduatedRecently && dexLiveAt) {
              fastify.log.info(
                {
                  address,
                  dexLiveAt: dexLiveAt.toISOString(),
                  bondingCurveEnd: dexLiveAt.toISOString(),
                  bondingCurveStart: twentyFourHoursAgo.toISOString(),
                },
                'Token graduated within 24h, fetching bonding curve volume too',
              );

              try {
                // Query bonding curve trades from subgraph for the period before graduation
                const startTimeSeconds = Math.floor(twentyFourHoursAgo.getTime() / 1000);
                const endTimeSeconds = Math.floor(dexLiveAt.getTime() / 1000);

                const query = `{
                  trades(
                    where: {
                      token: "${address.toLowerCase()}"
                      createdAt_gte: "${startTimeSeconds}"
                      createdAt_lte: "${endTimeSeconds}"
                    }
                    orderBy: createdAt
                    orderDirection: asc
                    first: 1000
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

                if (response.ok) {
                  const result = (await response.json()) as {
                    data: { trades: Array<{ id: string; acesTokenAmount: string }> };
                  };
                  const bondingTrades = result.data.trades || [];

                  const bondingVolumeAces = bondingTrades.reduce((sum, trade) => {
                    const aces = parseFloat(trade.acesTokenAmount) / 1e18;
                    return Number.isFinite(aces) ? sum + aces : sum;
                  }, 0);

                  const bondingVolumeUsd = bondingVolumeAces * acesUsdPrice;

                  fastify.log.info(
                    {
                      address,
                      bondingTradeCount: bondingTrades.length,
                      bondingVolumeAces,
                      bondingVolumeUsd,
                      dexVolumeAces,
                      dexVolumeUsd,
                    },
                    'Bonding curve volume fetched, combining with DEX volume',
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
                } else {
                  fastify.log.warn(
                    { address, status: response.status },
                    'Failed to fetch bonding curve trades, using DEX volume only',
                  );
                  volume24hAces = dexVolumeAces;
                  volume24hUsd = dexVolumeUsd;
                  volumeSource = 'dex';
                }
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
          const volume24hWei = tokenData.volume24h || '0';
          const parsedAces = parseFloat(volume24hWei) / 1e18;
          volume24hAces = Number.isFinite(parsedAces) ? parsedAces : 0;
          volume24hUsd = Number.isFinite(acesUsdPrice) ? volume24hAces * acesUsdPrice : 0;

          fastify.log.info(
            { volume24hWei, volume24hAces, acesUsdPrice, volume24hUsd },
            'Bonding curve volume calculation',
          );
        }

        let liquidityUsd: number | null = null;
        let liquiditySource: 'bonding_curve' | 'dex' | null = null;

        if (
          liquidityUsd === null &&
          isDexMode &&
          typeof poolAddress === 'string' &&
          poolAddress.length > 0
        ) {
          try {
            const poolState = await bitQueryService.getPoolState(poolAddress);

            if (poolState) {
              const acesAddress = ACES_TOKEN_ADDRESS.toLowerCase();
              const targetAddress = address.toLowerCase();

              const normalizeReserve = (reserve: string, decimals: number): Decimal => {
                try {
                  const value = new Decimal(reserve || '0');
                  const divisor = new Decimal(10).pow(decimals || 0);
                  return divisor.eq(0) ? new Decimal(0) : value.div(divisor);
                } catch (error) {
                  fastify.log.error(
                    { error, reserve, decimals },
                    'Failed to normalize pool reserve',
                  );
                  return new Decimal(0);
                }
              };

              const token0Address = poolState.token0.address.toLowerCase();
              const token1Address = poolState.token1.address.toLowerCase();

              const token0Normalized = normalizeReserve(
                poolState.token0.reserve,
                poolState.token0.decimals ?? 18,
              );
              const token1Normalized = normalizeReserve(
                poolState.token1.reserve,
                poolState.token1.decimals ?? 18,
              );

              let acesReserve = new Decimal(0);
              let rwaReserve = new Decimal(0);

              if (token0Address === acesAddress) {
                acesReserve = token0Normalized;
              } else if (token1Address === acesAddress) {
                acesReserve = token1Normalized;
              }

              if (token0Address === targetAddress) {
                rwaReserve = token0Normalized;
              } else if (token1Address === targetAddress) {
                rwaReserve = token1Normalized;
              }

              const acesUsdDecimal = new Decimal(acesUsdPrice || 0);
              const acesReserveUsd = acesReserve.mul(acesUsdDecimal);

              let effectiveTokenPriceUsd = new Decimal(tokenPriceUsd || 0);
              if (
                (!effectiveTokenPriceUsd.isFinite() || effectiveTokenPriceUsd.lte(0)) &&
                rwaReserve.gt(0) &&
                acesReserveUsd.gt(0)
              ) {
                effectiveTokenPriceUsd = acesReserveUsd.div(rwaReserve);
              }

              let liquidityValue = acesReserveUsd;
              if (rwaReserve.gt(0) && effectiveTokenPriceUsd.gt(0)) {
                liquidityValue = liquidityValue.add(rwaReserve.mul(effectiveTokenPriceUsd));
              } else if (acesReserveUsd.gt(0)) {
                liquidityValue = acesReserveUsd.mul(2);
              }

              const liquidityValueNumber = liquidityValue.isFinite()
                ? liquidityValue.toNumber()
                : 0;
              liquidityUsd = liquidityValueNumber >= 0 ? liquidityValueNumber : 0;
              liquiditySource = 'dex';
              fastify.log.info(
                {
                  address,
                  poolAddress,
                  liquidityUsd,
                  acesReserve: acesReserve.toString(),
                  rwaReserve: rwaReserve.toString(),
                },
                'Calculated DEX liquidity',
              );
            }
          } catch (error) {
            fastify.log.error(
              { error, address, poolAddress },
              'Failed to compute DEX liquidity via BitQuery',
            );
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
            const liquidityValue = liquidityAces.mul(new Decimal(acesUsdPrice || 0));

            if (liquidityValue.gt(0)) {
              liquidityUsd = liquidityValue.toNumber();
              liquiditySource = 'bonding_curve';
            } else {
              liquidityUsd = null;
            }

            fastify.log.info(
              {
                address,
                liquidityUsd,
                liquiditySource,
                liquidityAces: liquidityAces.toString(),
                acesBalanceWei: acesBalanceWei.toString(),
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
            liquidityUsd,
            liquiditySource,
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
