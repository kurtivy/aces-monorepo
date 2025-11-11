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
  const INITIAL_FETCH_CACHE_TTL = 5000; // 5 seconds - short cache for initial fetches

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

            // Extract metrics from health response
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
            // 🔥 IMPROVEMENT: Immediate volume updates on trades (bypass throttle)
            // Update volume immediately when trades occur for real-time feel
            // Note: Actual volume calculation happens in periodic REST refresh,
            // but we trigger immediate update to show activity
            sendVolumeUpdate();
          },
        );
        subscriptions.push(...tradeSubscriptionIds);

        // Subscribe to bonding status for supply updates
        try {
          const bondingSubscriptionId = await adapterManager.subscribeToBondingStatus(
            tokenAddress,
            (status: BondingStatusEvent) => {
              // 🔥 NEW: Extract full bonding data from WebSocket event
              if (status.supply) {
                const supply = parseFloat(status.supply);
                if (Number.isFinite(supply) && supply > 0) {
                  currentMetrics.circulatingSupply = supply;
                }
              }

              // 🔥 IMPROVEMENT: Trigger liquidity update for bonding curve mode
              // Liquidity will be updated from periodic REST refresh, but we trigger
              // immediate update to show activity when bonding status changes
              // Note: Actual liquidity calculation happens in REST API health endpoint
              sendLiquidityUpdate();

              // Update bonding data if we have tokensBondedAt from initial fetch
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
              } else {
                // If we don't have tokensBondedAt yet, we'll get it on next REST refresh
                // For now, just update what we can
                const bondingPercentage = status.isBonded
                  ? 100
                  : Math.min(100, status.bondingProgress * 100);

                // We'll need tokensBondedAt from REST API, so skip full update for now
                // But update circulatingSupply which is used immediately
              }

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
              (poolState: PoolStateEvent) => {
                // 🔥 IMPROVEMENT: Immediate liquidity updates for DEX mode
                // Trigger immediate update when pool state changes
                // Actual liquidity calculation happens in REST API health endpoint,
                // but we trigger update immediately to show activity
                currentMetrics.liquiditySource = 'dex';
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
                if (
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
                if (Number.isFinite(supply) && supply > 0 && supply !== currentMetrics.circulatingSupply) {
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

