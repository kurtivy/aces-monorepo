/**
 * WebSocket Route: Real-Time Token Metrics
 * Stream live token metrics (market cap, volume, liquidity, circulating supply)
 *
 * Endpoint: /api/v1/ws/metrics/:tokenAddress
 * Protocol: WebSocket
 * Data Sources: Aggregated from trades, pools, and bonding WebSocket streams
 */

import { FastifyPluginAsync } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import { TradeEvent, PoolStateEvent, BondingStatusEvent } from '../../../types/adapters';
import { priceCacheService } from '../../../services/price-cache-service';
import { TokenService } from '../../../services/token-service';
import { Decimal } from 'decimal.js';
import { ethers } from 'ethers';
import { ACES_TOKEN_ADDRESS } from '../../../config/bitquery.config';
import { getNetworkConfig } from '../../../config/network.config';

/**
 * 🔥 NEW: In-memory 24h rolling trade aggregator for real-time volume calculation
 * Maintains a time-series buffer of trades and auto-prunes old entries
 */
interface StoredTrade {
  timestamp: number;
  acesAmount: number;
  usdAmount: number;
}

class Trade24hAggregator {
  private trades: StoredTrade[] = [];
  private readonly WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  /**
   * Add a trade to the buffer and auto-prune old trades
   * @param trade TradeEvent from adapter
   * @param acesUsdPrice Current ACES/USD exchange rate (used as fallback if trade.priceUsd unavailable)
   */
  addTrade(trade: TradeEvent, acesUsdPrice: number): void {
    // Extract USD value - prefer trade.priceUsd (calculated at trade time), fallback to current price
    const tokenAmount = parseFloat(trade.tokenAmount);
    const acesAmount = parseFloat(trade.acesAmount);

    let usdAmount = 0;
    if (trade.priceUsd) {
      // Use price calculated at trade time (most accurate)
      usdAmount = parseFloat(trade.priceUsd) * tokenAmount;
    } else {
      // Fallback: calculate from ACES amount
      usdAmount = acesAmount * acesUsdPrice;
    }

    this.trades.push({
      timestamp: trade.timestamp,
      acesAmount,
      usdAmount: Number.isFinite(usdAmount) ? usdAmount : 0,
    });

    // Prune trades older than 24h
    this.pruneOldTrades();
  }

  /**
   * Remove trades older than 24h
   */
  private pruneOldTrades(): void {
    const cutoff = Date.now() - this.WINDOW_MS;
    const before = this.trades.length;
    this.trades = this.trades.filter((t) => t.timestamp > cutoff);
    const after = this.trades.length;

    if (before > after) {
      console.log(`[Trade24hAggregator] 🧹 Pruned ${before - after} old trades (older than 24h)`);
    }
  }

  /**
   * Calculate 24h volume from buffered trades
   * Automatically prunes before calculation to ensure freshness
   */
  getVolume24h(): { acesVolume: number; usdVolume: number } {
    this.pruneOldTrades(); // Ensure buffer is fresh

    const acesVolume = this.trades.reduce((sum, t) => sum + t.acesAmount, 0);
    const usdVolume = this.trades.reduce((sum, t) => sum + t.usdAmount, 0);

    return {
      acesVolume: Number.isFinite(acesVolume) ? acesVolume : 0,
      usdVolume: Number.isFinite(usdVolume) ? usdVolume : 0,
    };
  }

  /**
   * Get trade count for debugging/monitoring
   */
  getTradeCount(): number {
    this.pruneOldTrades();
    return this.trades.length;
  }

  /**
   * Seed aggregator with historical trades (for initialization)
   * More efficient than calling addTrade() for each historical trade
   */
  seedHistoricalTrades(
    trades: Array<{
      timestamp: number;
      acesAmount: number;
      usdAmount: number;
    }>,
  ): void {
    // Add all historical trades at once
    this.trades.push(...trades);
    // Prune any that are already older than 24h
    this.pruneOldTrades();
  }

  /**
   * Clear all trades (used on cleanup)
   */
  clear(): void {
    this.trades = [];
  }
}

interface MetricsUpdate {
  tokenAddress: string;
  marketCapUsd?: number;
  currentPriceUsd?: number;
  volume24hUsd?: number;
  volume24hAces?: string;
  liquidityUsd?: number | null;
  liquiditySource?: 'bonding_curve' | 'dex' | null;
  circulatingSupply?: number | null;
  // 🔥 NEW: Bonding data fields
  bondingData?: {
    isBonded: boolean;
    bondingPercentage: number;
    currentSupply: string;
    tokensBondedAt: string;
  };
  timestamp: number;
}

export const metricsWebSocketRoutes: FastifyPluginAsync = async (fastify) => {
  // 🔥 NEW: Shared initial fetch cache to prevent thundering herd
  // Key: tokenAddress, Value: Promise<HealthResult>
  const initialFetchCache = new Map<string, Promise<any>>();
  const INITIAL_FETCH_CACHE_TTL = 30000; // 🔥 OPTIMIZATION: 30 seconds cache to reduce BitQuery calls
  // Extended from 5s to 30s to handle burst of WebSocket connections without hitting BitQuery API

  /**
   * WebSocket: Subscribe to real-time metrics for a specific token
   * GET /api/v1/ws/metrics/:tokenAddress
   */
  fastify.get(
    '/metrics/:tokenAddress',
    { websocket: true },
    async (connection: SocketStream, request) => {
      const { tokenAddress } = request.params as { tokenAddress: string };
      const adapterManager = fastify.adapterManager;

      console.log(`[WS:Metrics] Client connected for token: ${tokenAddress}`);

      if (!adapterManager) {
        connection.socket.send(
          JSON.stringify({
            type: 'error',
            message: 'WebSocket adapters not initialized. Please try again.',
          }),
        );
        connection.socket.close();
        return;
      }

      // Track subscriptions for cleanup
      const subscriptions: string[] = [];
      let metricsUpdateInterval: NodeJS.Timeout | null = null;
      let heartbeatInterval: NodeJS.Timeout | null = null;
      let lastMetricsUpdate = 0;
      const UPDATE_THROTTLE_MS = 2000; // Update at most every 2 seconds to respect rate limits
      const VOLUME_UPDATE_THROTTLE_MS = 500; // Faster throttle for volume updates (500ms)
      const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds - keep connection alive

      // Current metrics state
      let currentMetrics: Partial<MetricsUpdate> = {
        tokenAddress: tokenAddress.toLowerCase(),
        timestamp: Date.now(),
      };

      // 🔥 NEW: Initialize trade aggregator for real-time volume calculation
      const tradeAggregator = new Trade24hAggregator();
      let acesUsdPrice = 1; // Default fallback
      let useDbVolume = false; // Track if we're using DB volume to avoid BitQuery calls

      // Fetch initial metrics from REST API
      const fetchInitialMetrics = async () => {
        const cacheKey = tokenAddress.toLowerCase();

        // 🔥 NEW: Check if another connection is already fetching for this token
        const existingFetch = initialFetchCache.get(cacheKey);
        if (existingFetch) {
          console.log(`[WS:Metrics] ⏳ Reusing existing fetch for ${tokenAddress}`);
          try {
            const healthResult = await existingFetch;
            // Process the cached result
            if (healthResult.success && healthResult.data) {
              const { bondingData, metricsData, marketCapData } = healthResult.data;
              // ... same processing logic ...
              if (metricsData) {
                currentMetrics.marketCapUsd = metricsData.marketCapUsd;
                currentMetrics.volume24hUsd = metricsData.volume24hUsd;
                currentMetrics.volume24hAces = metricsData.volume24hAces;
                currentMetrics.liquidityUsd = metricsData.liquidityUsd;
                currentMetrics.liquiditySource = metricsData.liquiditySource;
              }
              if (marketCapData) {
                currentMetrics.currentPriceUsd = marketCapData.currentPriceUsd;
              }
              if (bondingData) {
                const supply = parseFloat(bondingData.currentSupply || '0');
                if (Number.isFinite(supply) && supply > 0) {
                  currentMetrics.circulatingSupply = supply;
                }
                if (
                  bondingData.currentSupply &&
                  bondingData.tokensBondedAt !== undefined &&
                  bondingData.isBonded !== undefined &&
                  bondingData.bondingPercentage !== undefined
                ) {
                  currentMetrics.bondingData = {
                    isBonded: bondingData.isBonded,
                    bondingPercentage: bondingData.bondingPercentage,
                    currentSupply: bondingData.currentSupply,
                    tokensBondedAt: bondingData.tokensBondedAt,
                  };
                }
              }
              connection.socket.send(
                JSON.stringify({
                  type: 'metrics',
                  data: { ...currentMetrics, timestamp: Date.now() },
                }),
              );
            }
            return;
          } catch (error) {
            // If cached fetch failed, continue to new fetch
            initialFetchCache.delete(cacheKey);
          }
        }

        // 🔥 NEW: Create new fetch promise and cache it
        const fetchPromise = (async () => {
          try {
            const baseUrl = process.env.API_URL || 'http://localhost:3002';
            const healthResponse = await fetch(
              `${baseUrl}/api/v1/tokens/${tokenAddress}/health?chainId=8453&currency=usd`,
            );
            const healthResult = (await healthResponse.json()) as {
              success: boolean;
              data?: {
                bondingData?: {
                  currentSupply?: string;
                  tokensBondedAt?: string;
                  isBonded?: boolean;
                  bondingPercentage?: number;
                };
                metricsData?: {
                  marketCapUsd?: number;
                  volume24hUsd?: number;
                  volume24hAces?: string;
                  liquidityUsd?: number | null;
                  liquiditySource?: 'bonding_curve' | 'dex' | null;
                };
                marketCapData?: {
                  currentPriceUsd?: number;
                };
              };
            };
            return healthResult;
          } catch (error) {
            throw error;
          } finally {
            // Remove from cache after TTL
            setTimeout(() => {
              initialFetchCache.delete(cacheKey);
            }, INITIAL_FETCH_CACHE_TTL);
          }
        })();

        initialFetchCache.set(cacheKey, fetchPromise);

        try {
          const healthResult = await fetchPromise;

          if (healthResult.success && healthResult.data) {
            const { bondingData, metricsData, marketCapData } = healthResult.data;

            // Extract metrics from health response (volume will be set later after DB check)
            if (metricsData) {
              currentMetrics.marketCapUsd = metricsData.marketCapUsd;
              // 🔥 OPTIMIZATION: Don't set volume here - will be set after DB volume check
              // currentMetrics.volume24hUsd = metricsData.volume24hUsd;
              // currentMetrics.volume24hAces = metricsData.volume24hAces;
              currentMetrics.liquidityUsd = metricsData.liquidityUsd;
              currentMetrics.liquiditySource = metricsData.liquiditySource;
            }

            if (marketCapData) {
              currentMetrics.currentPriceUsd = marketCapData.currentPriceUsd;
            }

            if (bondingData) {
              const supply = parseFloat(bondingData.currentSupply || '0');
              if (Number.isFinite(supply) && supply > 0) {
                currentMetrics.circulatingSupply = supply;
              }

              // 🔥 NEW: Extract full bonding data
              if (
                bondingData.currentSupply &&
                bondingData.tokensBondedAt !== undefined &&
                bondingData.isBonded !== undefined &&
                bondingData.bondingPercentage !== undefined
              ) {
                currentMetrics.bondingData = {
                  isBonded: bondingData.isBonded,
                  bondingPercentage: bondingData.bondingPercentage,
                  currentSupply: bondingData.currentSupply,
                  tokensBondedAt: bondingData.tokensBondedAt,
                };
              }
            }

            // 🔥 NEW: Extract ACES/USD price for volume calculations
            // Fetch from price cache service (same source as REST endpoint)
            try {
              const priceData = await priceCacheService.getPrices();
              if (
                priceData.acesUsd &&
                Number.isFinite(priceData.acesUsd) &&
                priceData.acesUsd > 0
              ) {
                acesUsdPrice = priceData.acesUsd;
              }
            } catch (error) {
              console.warn('[WS:Metrics] Failed to fetch ACES price, using default 1.0');
            }

            // 🔥 FIX: Seed Trade24hAggregator with historical trades from last 24h
            // This prevents volume from dropping when new trades arrive (aggregator starts empty)
            try {
              const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
              const historicalTrades = await fastify.prisma.dexTrade.findMany({
                where: {
                  tokenAddress: tokenAddress.toLowerCase(),
                  timestamp: {
                    gte: BigInt(twentyFourHoursAgo),
                  },
                },
                orderBy: { timestamp: 'asc' },
                take: 10000, // Reasonable limit to prevent memory issues
              });

              if (historicalTrades.length > 0) {
                // Convert database trades to aggregator format
                const seedTrades = historicalTrades
                  .map((trade) => {
                    const timestamp = Number(trade.timestamp);
                    const acesAmount = parseFloat(trade.acesAmount || '0');
                    const tokenAmount = parseFloat(trade.tokenAmount || '0');

                    // Calculate USD amount - prefer priceInUsd from DB, fallback to ACES * current price
                    let usdAmount = 0;
                    if (
                      trade.priceInUsd &&
                      Number.isFinite(trade.priceInUsd) &&
                      trade.priceInUsd > 0
                    ) {
                      // Use price at trade time (most accurate)
                      usdAmount = trade.priceInUsd * tokenAmount;
                    } else {
                      // Fallback: calculate from ACES amount using current price
                      usdAmount = acesAmount * acesUsdPrice;
                    }

                    return {
                      timestamp,
                      acesAmount: Number.isFinite(acesAmount) ? acesAmount : 0,
                      usdAmount: Number.isFinite(usdAmount) ? usdAmount : 0,
                    };
                  })
                  .filter((t) => t.timestamp > twentyFourHoursAgo); // Extra safety check

                // Seed the aggregator with historical trades
                tradeAggregator.seedHistoricalTrades(seedTrades);

                // Recalculate volume from seeded aggregator
                const { acesVolume, usdVolume } = tradeAggregator.getVolume24h();

                // 🔥 OPTIMIZATION: Use database volume as baseline to avoid BitQuery API calls
                // Only use REST volume if database volume is significantly incomplete (>10% difference)
                // This prevents expensive BitQuery calls on every WebSocket connection
                // With volumes in 10s-100s of thousands, 10% is still a significant threshold
                const restVolumeUsd = metricsData?.volume24hUsd;
                const restVolumeAces = metricsData?.volume24hAces;

                if (restVolumeUsd !== undefined && restVolumeUsd > 0 && usdVolume > 0) {
                  // Check if database volume is significantly incomplete
                  const volumeDiff = Math.abs(usdVolume - restVolumeUsd);
                  const volumeDiffPercent = (volumeDiff / restVolumeUsd) * 100;
                  const THRESHOLD_PERCENT = 10; // Only use REST if DB is missing >10% of volume

                  if (volumeDiffPercent > THRESHOLD_PERCENT) {
                    // Database is significantly incomplete - use REST volume (BitQuery API)
                    currentMetrics.volume24hUsd = restVolumeUsd;
                    currentMetrics.volume24hAces = restVolumeAces || acesVolume.toString();

                    console.log(
                      `[WS:Metrics] ⚠️ DB volume incomplete (${volumeDiffPercent.toFixed(1)}% diff). ` +
                        `Using REST volume: $${restVolumeUsd.toFixed(2)} USD (DB: $${usdVolume.toFixed(2)} USD)`,
                    );
                  } else {
                    // Database volume is accurate enough - use it to avoid BitQuery calls
                    currentMetrics.volume24hAces = acesVolume.toString();
                    currentMetrics.volume24hUsd = usdVolume;
                    useDbVolume = true; // Mark that we're using DB volume

                    console.log(
                      `[WS:Metrics] ✅ Using DB volume: $${usdVolume.toFixed(2)} USD ` +
                        `(REST: $${restVolumeUsd.toFixed(2)} USD, ${volumeDiffPercent.toFixed(1)}% diff - within threshold)`,
                    );
                  }
                } else if (usdVolume > 0) {
                  // Use database volume if REST unavailable
                  currentMetrics.volume24hAces = acesVolume.toString();
                  currentMetrics.volume24hUsd = usdVolume;
                  useDbVolume = true; // Mark that we're using DB volume

                  console.log(
                    `[WS:Metrics] ✅ Using DB volume: ${acesVolume.toFixed(2)} ACES / $${usdVolume.toFixed(2)} USD`,
                  );
                } else if (restVolumeUsd !== undefined && restVolumeUsd > 0) {
                  // Fallback: use REST volume if database has no trades
                  currentMetrics.volume24hUsd = restVolumeUsd;
                  currentMetrics.volume24hAces = restVolumeAces || '0';

                  console.log(
                    `[WS:Metrics] ⚠️ No DB trades found, using REST volume: $${restVolumeUsd.toFixed(2)} USD`,
                  );
                }
              } else {
                // No historical trades in DB - use REST volume as fallback
                if (metricsData?.volume24hUsd !== undefined && metricsData.volume24hUsd > 0) {
                  currentMetrics.volume24hUsd = metricsData.volume24hUsd;
                  currentMetrics.volume24hAces = metricsData.volume24hAces || '0';
                  console.log(
                    `[WS:Metrics] ℹ️ No DB trades found, using REST volume: $${metricsData.volume24hUsd.toFixed(2)} USD`,
                  );
                }
                console.log(
                  '[WS:Metrics] ℹ️ No historical trades found in last 24h to seed aggregator',
                );
              }
            } catch (error) {
              console.error('[WS:Metrics] ⚠️ Failed to seed historical trades:', error);
              // Fallback: use REST volume if DB query failed
              if (metricsData?.volume24hUsd !== undefined && metricsData.volume24hUsd > 0) {
                currentMetrics.volume24hUsd = metricsData.volume24hUsd;
                currentMetrics.volume24hAces = metricsData.volume24hAces || '0';
              }
              // Continue without seeding - aggregator will accumulate trades from now on
            }

            // Send initial metrics
            connection.socket.send(
              JSON.stringify({
                type: 'metrics',
                data: { ...currentMetrics, timestamp: Date.now() },
              }),
            );
          }
        } catch (error) {
          console.error('[WS:Metrics] Failed to fetch initial metrics:', error);
          // Send error but keep connection open for retry
          connection.socket.send(
            JSON.stringify({
              type: 'error',
              message: 'Failed to fetch initial metrics. Will retry periodically.',
            }),
          );
        }
      };

      // Throttled metrics update sender (for general updates)
      const sendMetricsUpdate = () => {
        const now = Date.now();
        if (now - lastMetricsUpdate < UPDATE_THROTTLE_MS) {
          return;
        }
        lastMetricsUpdate = now;

        if (connection.socket.readyState === 1) {
          // OPEN
          connection.socket.send(
            JSON.stringify({
              type: 'metrics',
              data: { ...currentMetrics, timestamp: Date.now() },
            }),
          );
        }
      };

      // Immediate volume update sender (bypasses throttle for real-time volume)
      let lastVolumeUpdate = 0;
      const sendVolumeUpdate = () => {
        const now = Date.now();
        if (now - lastVolumeUpdate < VOLUME_UPDATE_THROTTLE_MS) {
          return;
        }
        lastVolumeUpdate = now;

        if (connection.socket.readyState === 1) {
          connection.socket.send(
            JSON.stringify({
              type: 'metrics',
              data: {
                ...currentMetrics,
                volume24hUsd: currentMetrics.volume24hUsd,
                volume24hAces: currentMetrics.volume24hAces,
                timestamp: Date.now(),
              },
            }),
          );
        }
      };

      // Immediate liquidity update sender (bypasses throttle for real-time liquidity)
      let lastLiquidityUpdate = 0;
      const sendLiquidityUpdate = () => {
        const now = Date.now();
        if (now - lastLiquidityUpdate < UPDATE_THROTTLE_MS) {
          return;
        }
        lastLiquidityUpdate = now;

        if (connection.socket.readyState === 1) {
          connection.socket.send(
            JSON.stringify({
              type: 'metrics',
              data: {
                ...currentMetrics,
                liquidityUsd: currentMetrics.liquidityUsd,
                liquiditySource: currentMetrics.liquiditySource,
                timestamp: Date.now(),
              },
            }),
          );
        }
      };

      try {
        // Subscribe to trades for volume updates
        const tradeSubscriptionIds = await adapterManager.subscribeToTrades(
          tokenAddress,
          (trade: TradeEvent) => {
            // 🔥 NEW: Real-time volume calculation
            // 1. Add trade to 24h rolling buffer
            tradeAggregator.addTrade(trade, acesUsdPrice);

            // 2. Recalculate volumes from buffer
            const { acesVolume, usdVolume } = tradeAggregator.getVolume24h();

            // 3. Update currentMetrics with fresh calculations
            currentMetrics.volume24hAces = acesVolume.toString();
            currentMetrics.volume24hUsd = usdVolume;

            // 4. Send update via throttled sender (500ms)
            sendVolumeUpdate();

            // Debug logging (can be disabled in production)
            if (process.env.DEBUG_METRICS) {
              console.log(
                `[WS:Metrics] 📊 Trade added - Volume: ${acesVolume.toFixed(2)} ACES / $${usdVolume.toFixed(2)} USD (${tradeAggregator.getTradeCount()} trades in buffer)`,
              );
            }
          },
        );
        subscriptions.push(...tradeSubscriptionIds);

        // Subscribe to bonding status for supply updates
        try {
          const bondingSubscriptionId = await adapterManager.subscribeToBondingStatus(
            tokenAddress,
            async (status: BondingStatusEvent) => {
              // 🔥 NEW: Real-time liquidity + supply updates

              // 1. Update circulating supply immediately from bonding event
              if (status.supply) {
                const supply = parseFloat(status.supply);
                if (Number.isFinite(supply) && supply > 0) {
                  currentMetrics.circulatingSupply = supply;
                }
              }

              // 2. Recalculate bonding curve liquidity in real-time
              try {
                const tokenService = new TokenService(fastify.prisma);
                const bonding = await tokenService.getBondingCurveLiquidity(tokenAddress);

                // Convert liquidity from Wei to proper units
                const liquidityAces = bonding.netLiquidityWei.div(new Decimal(10).pow(18));
                const liquidityUsd = liquidityAces.mul(new Decimal(acesUsdPrice));

                if (liquidityUsd.isFinite() && liquidityUsd.gt(0)) {
                  currentMetrics.liquidityUsd = liquidityUsd.toNumber();
                  currentMetrics.liquiditySource = 'bonding_curve';

                  if (process.env.DEBUG_METRICS) {
                    console.log(
                      `[WS:Metrics] 💧 Bonding liquidity updated: $${liquidityUsd.toFixed(2)} USD (${liquidityAces.toFixed(2)} ACES)`,
                    );
                  }
                }
              } catch (error) {
                console.warn('[WS:Metrics] Failed to recalculate bonding liquidity:', error);
              }

              // 3. Update bonding data if we have tokensBondedAt from initial fetch
              if (currentMetrics.bondingData) {
                // Convert bondingProgress (0-1) to percentage (0-100)
                const bondingPercentage = status.isBonded
                  ? 100
                  : Math.min(100, status.bondingProgress * 100);

                currentMetrics.bondingData = {
                  ...currentMetrics.bondingData,
                  isBonded: status.isBonded,
                  bondingPercentage,
                  currentSupply: status.supply || currentMetrics.bondingData.currentSupply,
                  // tokensBondedAt doesn't change, keep existing value
                };
              }

              // 4. Send updates via throttled sender (2s throttle for liquidity)
              sendLiquidityUpdate();
              sendMetricsUpdate();
            },
          );
          subscriptions.push(bondingSubscriptionId);
        } catch (error) {
          console.warn('[WS:Metrics] Failed to subscribe to bonding status:', error);
        }

        // Subscribe to pool state if token has a pool (for liquidity updates)
        try {
          // Try to get pool address from token metadata
          const tokenMetadata = await fastify.tokenMetadataCache?.getTokenMetadata(
            tokenAddress.toLowerCase(),
          );
          const poolAddress = tokenMetadata?.poolAddress;

          if (poolAddress) {
            const poolSubscriptionId = await adapterManager.subscribeToPoolState(
              poolAddress,
              tokenAddress,
              async (poolState: PoolStateEvent) => {
                // 🔥 NEW: Real-time DEX liquidity calculation
                try {
                  const networkConfig = getNetworkConfig(8453); // Base chain
                  if (!networkConfig.rpcUrl) {
                    throw new Error('No RPC URL configured for Base chain');
                  }

                  const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);

                  // Standard Uniswap V2 / Aerodrome Pool ABI
                  const POOL_ABI = [
                    'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
                    'function token0() view returns (address)',
                    'function token1() view returns (address)',
                  ];

                  const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);

                  // Fetch pool reserves and token addresses
                  const [reserves, token0Address, token1Address] = await Promise.all([
                    poolContract.getReserves(),
                    poolContract.token0(),
                    poolContract.token1(),
                  ]);

                  // Identify which token is ACES and calculate liquidity
                  const acesAddress = ACES_TOKEN_ADDRESS.toLowerCase();
                  const isToken0Aces = token0Address.toLowerCase() === acesAddress;
                  const isToken1Aces = token1Address.toLowerCase() === acesAddress;

                  if (!isToken0Aces && !isToken1Aces) {
                    console.warn(
                      '[WS:Metrics] ⚠️ ACES token not found in pool reserves for liquidity calculation',
                    );
                    currentMetrics.liquiditySource = 'dex';
                  } else {
                    // Get ACES reserve (both tokens use 18 decimals)
                    const acesReserveRaw = isToken0Aces ? reserves[0] : reserves[1];
                    const acesReserve = new Decimal(acesReserveRaw.toString()).div(
                      new Decimal(10).pow(18),
                    );

                    // Calculate total liquidity: ACES reserve × ACES price × 2 (for 50/50 pool)
                    const acesUsdDecimal = new Decimal(acesUsdPrice || 0);
                    const acesReserveUsd = acesReserve.mul(acesUsdDecimal);
                    const totalLiquidityUsd = acesReserveUsd.mul(2);

                    if (totalLiquidityUsd.isFinite() && totalLiquidityUsd.gt(0)) {
                      currentMetrics.liquidityUsd = totalLiquidityUsd.toNumber();
                      currentMetrics.liquiditySource = 'dex';

                      if (process.env.DEBUG_METRICS) {
                        console.log(
                          `[WS:Metrics] 💧 DEX liquidity updated: $${totalLiquidityUsd.toFixed(2)} USD (${acesReserve.toFixed(2)} ACES)`,
                        );
                      }
                    }
                  }
                } catch (error) {
                  console.warn('[WS:Metrics] Failed to recalculate DEX liquidity:', error);
                  // Keep previous liquidity value on error
                }

                // Send update via throttled sender (2s throttle)
                sendLiquidityUpdate();
              },
            );
            subscriptions.push(poolSubscriptionId);
          }
        } catch (error) {
          console.warn('[WS:Metrics] Failed to subscribe to pool state:', error);
        }

        // Periodic metrics refresh from REST API (every 30 seconds)
        // This ensures we get accurate aggregated metrics even if WebSocket updates are sparse
        metricsUpdateInterval = setInterval(async () => {
          try {
            const baseUrl = process.env.API_URL || 'http://localhost:3002';
            const healthResponse = await fetch(
              `${baseUrl}/api/v1/tokens/${tokenAddress}/health?chainId=8453&currency=usd`,
            );
            const healthResult = (await healthResponse.json()) as {
              success: boolean;
              data?: {
                bondingData?: {
                  currentSupply?: string;
                  tokensBondedAt?: string;
                  isBonded?: boolean;
                  bondingPercentage?: number;
                };
                metricsData?: {
                  marketCapUsd?: number;
                  volume24hUsd?: number;
                  volume24hAces?: string;
                  liquidityUsd?: number | null;
                  liquiditySource?: 'bonding_curve' | 'dex' | null;
                };
                marketCapData?: {
                  currentPriceUsd?: number;
                };
              };
            };

            if (healthResult.success && healthResult.data) {
              const { bondingData, metricsData, marketCapData } = healthResult.data;
              let updated = false;

              if (metricsData) {
                if (
                  metricsData.marketCapUsd !== undefined &&
                  metricsData.marketCapUsd !== currentMetrics.marketCapUsd
                ) {
                  currentMetrics.marketCapUsd = metricsData.marketCapUsd;
                  updated = true;
                }
                // 🔥 OPTIMIZATION: Skip volume updates in periodic refresh if using DB volume
                // This prevents overwriting DB-based volume with REST volume (which triggers BitQuery)
                // Volume is already being updated in real-time from the aggregator
                if (
                  !useDbVolume &&
                  metricsData.volume24hUsd !== undefined &&
                  metricsData.volume24hUsd !== currentMetrics.volume24hUsd
                ) {
                  currentMetrics.volume24hUsd = metricsData.volume24hUsd;
                  updated = true;
                }
                if (
                  metricsData.liquidityUsd !== undefined &&
                  metricsData.liquidityUsd !== currentMetrics.liquidityUsd
                ) {
                  currentMetrics.liquidityUsd = metricsData.liquidityUsd;
                  currentMetrics.liquiditySource = metricsData.liquiditySource;
                  updated = true;
                }
              }

              if (marketCapData?.currentPriceUsd !== undefined) {
                if (marketCapData.currentPriceUsd !== currentMetrics.currentPriceUsd) {
                  currentMetrics.currentPriceUsd = marketCapData.currentPriceUsd;
                  updated = true;
                }
              }

              if (bondingData?.currentSupply) {
                const supply = parseFloat(bondingData.currentSupply);
                if (
                  Number.isFinite(supply) &&
                  supply > 0 &&
                  supply !== currentMetrics.circulatingSupply
                ) {
                  currentMetrics.circulatingSupply = supply;
                  updated = true;
                }
              }

              // 🔥 NEW: Update full bonding data from periodic REST refresh
              if (
                bondingData &&
                bondingData.currentSupply &&
                bondingData.tokensBondedAt !== undefined &&
                bondingData.isBonded !== undefined &&
                bondingData.bondingPercentage !== undefined
              ) {
                const newBondingData = {
                  isBonded: bondingData.isBonded,
                  bondingPercentage: bondingData.bondingPercentage,
                  currentSupply: bondingData.currentSupply,
                  tokensBondedAt: bondingData.tokensBondedAt,
                };

                // Only update if data changed
                if (
                  !currentMetrics.bondingData ||
                  JSON.stringify(currentMetrics.bondingData) !== JSON.stringify(newBondingData)
                ) {
                  currentMetrics.bondingData = newBondingData;
                  updated = true;
                }
              }

              if (updated) {
                sendMetricsUpdate();
              }
            }
          } catch (error) {
            console.error('[WS:Metrics] Failed to refresh metrics:', error);
          }
        }, 30000); // 30 seconds - respects rate limits

        // 🔥 FIX: Fetch initial metrics BEFORE setting up subscriptions
        // This ensures data is sent immediately on connection
        await fetchInitialMetrics();

        // 🔥 IMPROVEMENT: Start heartbeat/keep-alive mechanism
        // Send ping messages to keep connection alive and detect dead connections
        heartbeatInterval = setInterval(() => {
          if (connection.socket.readyState === 1) {
            // OPEN - send ping to keep connection alive
            // Client should respond with pong (handled in frontend hook)
            try {
              connection.socket.send(JSON.stringify({ type: 'ping' }));
            } catch (error) {
              console.warn('[WS:Metrics] Failed to send heartbeat ping:', error);
            }
          }
        }, HEARTBEAT_INTERVAL_MS);

        // Send confirmation
        connection.socket.send(
          JSON.stringify({
            type: 'subscribed',
            data: {
              tokenAddress,
              subscriptions: subscriptions.length,
              message: 'Streaming real-time metrics',
            },
            timestamp: Date.now(),
          }),
        );

        // Handle client disconnect
        connection.socket.on('close', () => {
          console.log(`[WS:Metrics] Client disconnected for token: ${tokenAddress}`);

          // Unsubscribe from all adapters
          subscriptions.forEach((id) => {
            try {
              adapterManager.unsubscribe(id);
            } catch (error) {
              console.error(`[WS:Metrics] Failed to unsubscribe ${id}:`, error);
            }
          });

          // Clear intervals
          if (metricsUpdateInterval) {
            clearInterval(metricsUpdateInterval);
          }
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
          }

          // 🔥 NEW: Clear trade aggregator
          tradeAggregator.clear();
          console.log(`[WS:Metrics] ✅ Cleared trade aggregator for token: ${tokenAddress}`);
        });
      } catch (error) {
        console.error(`[WS:Metrics] Error setting up subscriptions for ${tokenAddress}:`, error);
        connection.socket.send(
          JSON.stringify({
            type: 'error',
            message: 'Failed to subscribe to metrics updates',
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        );
        connection.socket.close();
      }
    },
  );
};
