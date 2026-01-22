/**
 * WebSocket Route: Real-Time Token Metrics
 * Stream live token metrics (market cap, volume, liquidity, circulating supply)
 *
 * Endpoint: /api/v1/ws/metrics/:tokenAddress
 * Protocol: WebSocket
 * Data Sources: Aggregated from trades, pools, and bonding WebSocket streams
 */

import { randomUUID } from 'crypto';
import { FastifyPluginAsync } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import { TradeEvent, PoolStateEvent, BondingStatusEvent } from '../../../types/adapters';
import { priceCacheService } from '../../../services/price-cache-service';
import { TokenService } from '../../../services/token-service';
import { Decimal } from 'decimal.js';
import { ethers } from 'ethers';
import { getNetworkConfig, type SupportedChainId } from '../../../config/network.config';

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
    // Normalize raw on-chain amounts (wei) into human units when necessary
    const normalizeAmount = (value: number) => {
      if (!Number.isFinite(value)) return 0;
      // Heuristic: if value is extremely large, treat it as wei and scale down
      return value > 1e9 ? value / 1e18 : value;
    };

    const rawTokenAmount = parseFloat(trade.tokenAmount);
    const rawAcesAmount = parseFloat(trade.acesAmount);
    const tokenAmount = normalizeAmount(rawTokenAmount);
    const acesAmount = normalizeAmount(rawAcesAmount);

    let usdAmount = 0;
    // Use trade price if it looks valid and non-zero; otherwise compute from ACES amount
    const tradePriceUsd = trade.priceUsd ? parseFloat(trade.priceUsd) : 0;
    if (Number.isFinite(tradePriceUsd) && tradePriceUsd > 0) {
      usdAmount = tradePriceUsd * tokenAmount;
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
  rewardSupply?: number | null; // Actual circulating for reward calculations (excludes LP tokens)
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
  const INITIAL_FETCH_CACHE_TTL = 30000; // 30 seconds cache

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
      const clientId = randomUUID();
      const normalizedTokenAddress = tokenAddress.toLowerCase();

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

      // 🔥 FIX: Use Trade24hAggregator with proper REST API seeding
      // This maintains proper rolling 24h window with auto-pruning
      const tradeAggregator = new Trade24hAggregator();
      let acesUsdPrice = 1; // Default fallback for volume calculations
      let hasRealAcesPrice = false; // 🔥 FIX: Track if we have real price (for liquidity only)
      let lastSeedRefresh = 0; // Track when we last refreshed the seed
      const SEED_REFRESH_INTERVAL = 10 * 60 * 1000; // Refresh seed every 10 minutes

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
                const normalizeVolume = (value: number) =>
                  Number.isFinite(value) && value > 1e9 ? value / 1e18 : value;
                currentMetrics.marketCapUsd = metricsData.marketCapUsd;
                currentMetrics.volume24hUsd = metricsData.volume24hUsd;
                currentMetrics.volume24hAces = normalizeVolume(
                  parseFloat(metricsData.volume24hAces || '0'),
                ).toString();
                currentMetrics.liquidityUsd = metricsData.liquidityUsd;
                currentMetrics.liquiditySource = metricsData.liquiditySource;
              }
              if (marketCapData) {
                currentMetrics.currentPriceUsd = marketCapData.currentPriceUsd;
                // 🔥 FIX: Prefer marketCapData.marketCapUsd (from pool reserves, accurate)
                const mcapFromService = marketCapData.marketCapUsd;
                if (
                  typeof mcapFromService === 'number' &&
                  Number.isFinite(mcapFromService) &&
                  mcapFromService > 0
                ) {
                  currentMetrics.marketCapUsd = mcapFromService;
                }
                // 🔥 NEW: Extract rewardSupply for reward calculations (excludes LP tokens)
                if (
                  marketCapData.rewardSupply !== undefined &&
                  marketCapData.rewardSupply !== null
                ) {
                  currentMetrics.rewardSupply = marketCapData.rewardSupply;
                }
              }
              if (bondingData) {
                const normalizeSupply = (value: number) =>
                  Number.isFinite(value) && value > 1e9 ? value / 1e18 : value;
                const supply = normalizeSupply(parseFloat(bondingData.currentSupply || '0'));
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
                    currentSupply: supply.toString(),
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
                  marketCapUsd?: number;
                  rewardSupply?: number; // Actual circulating for reward calculations
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

            // Extract metrics from health response
            if (metricsData) {
              currentMetrics.marketCapUsd = metricsData.marketCapUsd;

              // 🔥 FIX: Seed aggregator with REST volume (accurate, includes all sources)
              // REST API queries BitQuery (DEX) + Subgraph (bonding) for complete 24h history
              const normalizeVolume = (value: number) =>
                Number.isFinite(value) && value > 1e9 ? value / 1e18 : value;
              const baselineVolumeUsd = metricsData.volume24hUsd || 0;
              const baselineVolumeAces = normalizeVolume(
                parseFloat(metricsData.volume24hAces || '0'),
              );

              if (baselineVolumeUsd > 0 || baselineVolumeAces > 0) {
                // Seed aggregator with REST volume as a single "baseline" trade
                // This trade will auto-prune after 24h (maintaining rolling window)
                tradeAggregator.seedHistoricalTrades([
                  {
                    timestamp: Date.now(),
                    acesAmount: baselineVolumeAces,
                    usdAmount: baselineVolumeUsd,
                  },
                ]);

                lastSeedRefresh = Date.now();

                console.log(
                  `[WS:Metrics] ✅ Seeded aggregator with REST volume: ${baselineVolumeAces.toFixed(2)} ACES / $${baselineVolumeUsd.toFixed(2)} USD`,
                );
              }

              // Set initial volume from aggregator
              const { acesVolume, usdVolume } = tradeAggregator.getVolume24h();
              currentMetrics.volume24hUsd = usdVolume;
              currentMetrics.volume24hAces = acesVolume.toString();

              currentMetrics.liquidityUsd = metricsData.liquidityUsd;
              currentMetrics.liquiditySource = metricsData.liquiditySource;
            }

            if (marketCapData) {
              currentMetrics.currentPriceUsd = marketCapData.currentPriceUsd;
              // 🔥 FIX: Prefer marketCapData.marketCapUsd over metricsData.marketCapUsd
              // marketCapData comes from dedicated market cap service (pool reserves/accurate)
              // metricsData uses database currentPriceACES which can be stale/wrong
              const mcapFromService = marketCapData.marketCapUsd;
              if (
                typeof mcapFromService === 'number' &&
                Number.isFinite(mcapFromService) &&
                mcapFromService > 0
              ) {
                currentMetrics.marketCapUsd = mcapFromService;
              }
              // 🔥 NEW: Extract rewardSupply for reward calculations (excludes LP tokens)
              if (marketCapData.rewardSupply !== undefined && marketCapData.rewardSupply !== null) {
                currentMetrics.rewardSupply = marketCapData.rewardSupply;
              }
            }

            if (bondingData) {
              const normalizeSupply = (value: number) =>
                Number.isFinite(value) && value > 1e9 ? value / 1e18 : value;
              const rawSupply = parseFloat(bondingData.currentSupply || '0');
              const supply = normalizeSupply(rawSupply);
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
                  currentSupply: supply.toString(),
                  tokensBondedAt: bondingData.tokensBondedAt,
                };
              }
            }

            // 🔥 ACES/USD price already fetched early (before subscriptions)
            // This is a fallback refresh in case price wasn't available earlier
            if (!hasRealAcesPrice) {
              try {
                const priceData = await priceCacheService.getPrices();
                if (
                  priceData.acesUsd &&
                  Number.isFinite(priceData.acesUsd) &&
                  priceData.acesUsd > 0
                ) {
                  acesUsdPrice = priceData.acesUsd;
                  hasRealAcesPrice = true;
                  console.log(
                    `[WS:Metrics] 💰 ACES price fetched (fallback): $${acesUsdPrice.toFixed(6)}`,
                  );
                }
              } catch (error) {
                console.warn('[WS:Metrics] ⚠️ Failed to fetch ACES price in fetchInitialMetrics');
              }
            }

            // 🔥 FIX: Aggregator seeded above from REST API
            // REST API is source of truth (includes BitQuery DEX + Subgraph bonding trades)
            // New trades will be added to aggregator in real-time with proper 24h rolling window

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

      const handleTradeEvent = (trade: TradeEvent) => {
        // 1. Add trade to 24h rolling buffer (uses acesUsdPrice for USD calculation)
        tradeAggregator.addTrade(trade, acesUsdPrice);

        // 2. Recalculate volumes from buffer (auto-prunes trades older than 24h)
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
      };

      try {
        // 🔥 FIX: Fetch ACES price FIRST before any subscriptions
        // This ensures liquidity calculations use real price, not the $1 default
        try {
          const priceData = await priceCacheService.getPrices();
          if (priceData.acesUsd && Number.isFinite(priceData.acesUsd) && priceData.acesUsd > 0) {
            acesUsdPrice = priceData.acesUsd;
            hasRealAcesPrice = true; // 🔥 FIX: Mark that we have real price for liquidity
            console.log(`[WS:Metrics] 💰 ACES price fetched: $${acesUsdPrice.toFixed(6)}`);
          }
        } catch (error) {
          console.warn('[WS:Metrics] ⚠️ Failed to fetch early ACES price:', error);
        }

        // Subscribe to trades for volume updates
        const tradeSubscriptionIds = await adapterManager.subscribeToTrades(
          tokenAddress,
          handleTradeEvent,
        );
        subscriptions.push(...tradeSubscriptionIds);

        // Subscribe to bonding status for supply updates
        // Helper: Normalize supply values that may be in wei (> 1e9) to human-readable units
        const normalizeSupply = (value: string | number): number => {
          const num = typeof value === 'string' ? parseFloat(value) : value;
          if (!Number.isFinite(num) || num < 0) return 0;
          // If value is extremely large (> 1 billion), assume it's in wei and convert to ether
          return num > 1e9 ? num / 1e18 : num;
        };

        try {
          const bondingSubscriptionId = await adapterManager.subscribeToBondingStatus(
            tokenAddress,
            async (status: BondingStatusEvent) => {
              // 🔥 NEW: Real-time liquidity + supply updates

              // 1. Update circulating supply immediately from bonding event
              if (status.supply) {
                const supply = normalizeSupply(status.supply);
                if (Number.isFinite(supply) && supply >= 0) {
                  currentMetrics.circulatingSupply = supply;
                }
              }

              // 2. Recalculate bonding curve liquidity in real-time
              // 🔥 FIX: Only calculate if we have REAL ACES price (not $1 default)
              if (!hasRealAcesPrice) {
                if (process.env.DEBUG_METRICS) {
                  console.log(
                    '[WS:Metrics] ⚠️ Skipping liquidity calculation - waiting for real ACES price',
                  );
                }
              } else {
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
              }

              // 3. Update bonding data if we have tokensBondedAt from initial fetch
              if (currentMetrics.bondingData) {
                // Convert bondingProgress (0-1) to percentage (0-100)
                const bondingPercentage = status.isBonded
                  ? 100
                  : Math.min(100, status.bondingProgress * 100);

                const updatedSupply = status.supply
                  ? normalizeSupply(status.supply)
                  : currentMetrics.bondingData.currentSupply
                    ? parseFloat(currentMetrics.bondingData.currentSupply)
                    : null;

                currentMetrics.bondingData = {
                  ...currentMetrics.bondingData,
                  isBonded: status.isBonded,
                  bondingPercentage,
                  currentSupply:
                    updatedSupply !== null
                      ? updatedSupply.toString()
                      : currentMetrics.bondingData.currentSupply,
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
                  const acesAddress = networkConfig.acesToken.toLowerCase();
                  const isToken0Aces = token0Address.toLowerCase() === acesAddress;
                  const isToken1Aces = token1Address.toLowerCase() === acesAddress;

                  if (!isToken0Aces && !isToken1Aces) {
                    console.warn(
                      '[WS:Metrics] ⚠️ ACES token not found in pool reserves for liquidity calculation',
                    );
                    currentMetrics.liquiditySource = 'dex';
                  } else if (!hasRealAcesPrice) {
                    // 🔥 FIX: Don't calculate DEX liquidity without real ACES price
                    if (process.env.DEBUG_METRICS) {
                      console.log(
                        '[WS:Metrics] ⚠️ Skipping DEX liquidity calculation - waiting for real ACES price',
                      );
                    }
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
                  marketCapUsd?: number;
                  rewardSupply?: number; // Actual circulating for reward calculations
                };
              };
            };

            if (healthResult.success && healthResult.data) {
              const { bondingData, metricsData, marketCapData } = healthResult.data;
              let updated = false;

              // 🔥 FIX: Prefer marketCapData.marketCapUsd (from pool reserves, accurate)
              // over metricsData.marketCapUsd (uses stale database currentPriceACES)
              const mcapFromService = marketCapData?.marketCapUsd;
              const preferredMarketCap =
                typeof mcapFromService === 'number' &&
                Number.isFinite(mcapFromService) &&
                mcapFromService > 0
                  ? mcapFromService
                  : metricsData?.marketCapUsd;

              if (metricsData) {
                if (
                  preferredMarketCap !== undefined &&
                  preferredMarketCap !== currentMetrics.marketCapUsd
                ) {
                  currentMetrics.marketCapUsd = preferredMarketCap;
                  updated = true;
                }
                // 🔥 FIX: Periodically refresh aggregator seed to stay accurate
                // This catches any trades we might have missed and keeps aggregator synchronized
                const timeSinceLastSeed = Date.now() - lastSeedRefresh;
                if (
                  timeSinceLastSeed > SEED_REFRESH_INTERVAL &&
                  metricsData.volume24hUsd !== undefined
                ) {
                  const restVolumeUsd = metricsData.volume24hUsd;
                  const restVolumeAces = parseFloat(metricsData.volume24hAces || '0');

                  // Clear aggregator and re-seed with fresh REST volume
                  // This prevents drift from missed trades while maintaining rolling window
                  tradeAggregator.clear();
                  tradeAggregator.seedHistoricalTrades([
                    {
                      timestamp: Date.now(),
                      acesAmount: restVolumeAces,
                      usdAmount: restVolumeUsd,
                    },
                  ]);

                  lastSeedRefresh = Date.now();

                  // Update metrics from re-seeded aggregator
                  const { acesVolume, usdVolume } = tradeAggregator.getVolume24h();
                  currentMetrics.volume24hAces = acesVolume.toString();
                  currentMetrics.volume24hUsd = usdVolume;

                  console.log(
                    `[WS:Metrics] 🔄 Re-seeded aggregator with REST volume: ${restVolumeAces.toFixed(2)} ACES / $${restVolumeUsd.toFixed(2)} USD ` +
                      `(${(timeSinceLastSeed / 60000).toFixed(1)} min since last seed)`,
                  );

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

              // 🔥 NEW: Update rewardSupply for reward calculations (excludes LP tokens)
              if (
                marketCapData?.rewardSupply !== undefined &&
                marketCapData?.rewardSupply !== null
              ) {
                if (marketCapData.rewardSupply !== currentMetrics.rewardSupply) {
                  currentMetrics.rewardSupply = marketCapData.rewardSupply;
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

          // 🔥 FIX: Clear trade aggregator
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
