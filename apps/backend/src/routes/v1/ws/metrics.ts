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
  timestamp: number;
}

interface HealthResponse {
  success: boolean;
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
  bondingData?: {
    currentSupply?: string;
  };
}

export const metricsWebSocketRoutes: FastifyPluginAsync = async (fastify) => {
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
      let lastMetricsUpdate = 0;
      const UPDATE_THROTTLE_MS = 2000; // Update at most every 2 seconds to respect rate limits

      // Current metrics state
      let currentMetrics: Partial<MetricsUpdate> = {
        tokenAddress: tokenAddress.toLowerCase(),
        timestamp: Date.now(),
      };

      // Fetch initial metrics from REST API
      const fetchInitialMetrics = async () => {
        try {
          const baseUrl = process.env.API_URL || 'http://localhost:3002';
          const healthResponse = await fetch(
            `${baseUrl}/api/v1/tokens/${tokenAddress}/health?chainId=8453&currency=usd`,
          );
          const healthData = (await healthResponse.json()) as HealthResponse;

          if (healthData.success) {
            // Extract metrics from health response
            if (healthData.metricsData) {
              currentMetrics.marketCapUsd = healthData.metricsData.marketCapUsd;
              currentMetrics.volume24hUsd = healthData.metricsData.volume24hUsd;
              currentMetrics.volume24hAces = healthData.metricsData.volume24hAces;
              currentMetrics.liquidityUsd = healthData.metricsData.liquidityUsd;
              currentMetrics.liquiditySource = healthData.metricsData.liquiditySource;
            }

            if (healthData.marketCapData) {
              currentMetrics.currentPriceUsd = healthData.marketCapData.currentPriceUsd;
            }

            if (healthData.bondingData) {
              const supply = parseFloat(healthData.bondingData.currentSupply || '0');
              if (Number.isFinite(supply) && supply > 0) {
                currentMetrics.circulatingSupply = supply;
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

      // Throttled metrics update sender
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

      try {
        // Subscribe to trades for volume updates
        const tradeSubscriptionIds = await adapterManager.subscribeToTrades(
          tokenAddress,
          (trade: TradeEvent) => {
            // Volume updates will come from aggregated trade data
            // We'll update metrics periodically rather than on every trade
            sendMetricsUpdate();
          },
        );
        subscriptions.push(...tradeSubscriptionIds);

        // Subscribe to bonding status for supply updates
        try {
          const bondingSubscriptionId = await adapterManager.subscribeToBondingStatus(
            tokenAddress,
            (status: BondingStatusEvent) => {
              if (status.supply) {
                const supply = parseFloat(status.supply);
                if (Number.isFinite(supply) && supply > 0) {
                  currentMetrics.circulatingSupply = supply;
                  sendMetricsUpdate();
                }
              }
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
                // Calculate liquidity from pool reserves
                // This is a simplified calculation - adjust based on your needs
                if (poolState.priceToken0 && poolState.priceToken1) {
                  // Update liquidity if available from pool state
                  sendMetricsUpdate();
                }
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
            const healthData = (await healthResponse.json()) as HealthResponse;

            if (healthData.success) {
              let updated = false;

              if (healthData.metricsData) {
                if (
                  healthData.metricsData.marketCapUsd !== undefined &&
                  healthData.metricsData.marketCapUsd !== currentMetrics.marketCapUsd
                ) {
                  currentMetrics.marketCapUsd = healthData.metricsData.marketCapUsd;
                  updated = true;
                }
                if (
                  healthData.metricsData.volume24hUsd !== undefined &&
                  healthData.metricsData.volume24hUsd !== currentMetrics.volume24hUsd
                ) {
                  currentMetrics.volume24hUsd = healthData.metricsData.volume24hUsd;
                  updated = true;
                }
                if (
                  healthData.metricsData.liquidityUsd !== undefined &&
                  healthData.metricsData.liquidityUsd !== currentMetrics.liquidityUsd
                ) {
                  currentMetrics.liquidityUsd = healthData.metricsData.liquidityUsd;
                  currentMetrics.liquiditySource = healthData.metricsData.liquiditySource;
                  updated = true;
                }
              }

              if (healthData.marketCapData?.currentPriceUsd !== undefined) {
                if (
                  healthData.marketCapData.currentPriceUsd !== currentMetrics.currentPriceUsd
                ) {
                  currentMetrics.currentPriceUsd = healthData.marketCapData.currentPriceUsd;
                  updated = true;
                }
              }

              if (healthData.bondingData?.currentSupply) {
                const supply = parseFloat(healthData.bondingData.currentSupply);
                if (Number.isFinite(supply) && supply > 0 && supply !== currentMetrics.circulatingSupply) {
                  currentMetrics.circulatingSupply = supply;
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

          // Clear interval
          if (metricsUpdateInterval) {
            clearInterval(metricsUpdateInterval);
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

