/**
 * WebSocket Route: Chart Compatibility Layer
 * Phase 3 - Bridge old /ws/chart endpoint to new candles WebSocket
 *
 * This maintains backward compatibility with the existing TradingView datafeed
 * while the new /api/v1/ws/candles endpoint is being integrated.
 */

import { FastifyPluginAsync } from 'fastify';
import { SocketStream } from '@fastify/websocket';

export const chartCompatWebSocketRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Legacy WebSocket: Chart data (compatibility)
   * GET /ws/chart (old endpoint for TradingView)
   * 
   * This bridges to the new adapter-based system
   */
  fastify.get(
    '/chart',
    { websocket: true },
    async (connection: SocketStream, request) => {
      console.log('[WS:ChartCompat] Client connected to legacy /ws/chart endpoint');

      const adapterManager = fastify.adapterManager;

      if (!adapterManager) {
        console.warn('[WS:ChartCompat] AdapterManager not found, closing connection');
        connection.socket.send(
          JSON.stringify({
            type: 'error',
            message: 'WebSocket adapters not initialized',
          }),
        );
        connection.socket.close();
        return;
      }

      // Warn if not fully connected but allow connection anyway
      if (!adapterManager.isConnected()) {
        console.warn('[WS:ChartCompat] ⚠️ Adapters not fully connected - some real-time data may be unavailable');
        connection.socket.send(
          JSON.stringify({
            type: 'warning',
            message: 'Some real-time adapters not connected. Chart data may be delayed.',
            timestamp: Date.now(),
          }),
        );
      }

      // Track active subscriptions
      const subscriptions = new Map<string, string>(); // key -> subscriptionId

      // Send initial connection confirmation
      connection.socket.send(
        JSON.stringify({
          type: 'connected',
          message: 'Connected to chart WebSocket (compatibility mode)',
          timestamp: Date.now(),
        }),
      );

      // Handle incoming subscription requests
      connection.socket.on('message', async (messageBuffer) => {
        try {
          const message = JSON.parse(messageBuffer.toString());
          console.log('[WS:ChartCompat] Received message:', message);

          if (message.type === 'subscribe') {
            const { tokenAddress, timeframe = '1m', chartType = 'price' } = message;
            const key = `${tokenAddress}:${timeframe}:${chartType}`;

            // Unsubscribe from previous subscription with same key
            if (subscriptions.has(key)) {
              const oldSubId = subscriptions.get(key)!;
              try {
                await adapterManager.unsubscribe(oldSubId);
              } catch (error) {
                console.error('[WS:ChartCompat] Error unsubscribing:', error);
              }
            }

            // Subscribe to candles
            const subscriptionId = await adapterManager.subscribeToCandles(
              tokenAddress,
              timeframe,
              (candle) => {
                // Send candle data in old format for compatibility
                if (connection.socket.readyState === 1) {
                  connection.socket.send(
                    JSON.stringify({
                      type: 'candle',
                      tokenAddress,
                      timeframe,
                      chartType,
                      candle: {
                        timestamp: candle.timestamp,
                        open: candle.open,
                        high: candle.high,
                        low: candle.low,
                        close: candle.close,
                        volume: candle.volume,
                        // Add USD values if available
                        openUsd: candle.openUsd,
                        highUsd: candle.highUsd,
                        lowUsd: candle.lowUsd,
                        closeUsd: candle.closeUsd,
                        volumeUsd: candle.volumeUsd,
                      },
                      timestamp: Date.now(),
                    }),
                  );
                }
              },
            );

            subscriptions.set(key, subscriptionId);

            // Send subscription confirmation
            connection.socket.send(
              JSON.stringify({
                type: 'subscribed',
                tokenAddress,
                timeframe,
                chartType,
                message: `Subscribed to ${timeframe} candles for ${tokenAddress}`,
                timestamp: Date.now(),
              }),
            );

            console.log(
              `[WS:ChartCompat] Subscribed: ${tokenAddress} ${timeframe} ${chartType}`,
            );
          } else if (message.type === 'unsubscribe') {
            const { tokenAddress, timeframe = '1m', chartType = 'price' } = message;
            const key = `${tokenAddress}:${timeframe}:${chartType}`;

            if (subscriptions.has(key)) {
              const subId = subscriptions.get(key)!;
              try {
                await adapterManager.unsubscribe(subId);
                subscriptions.delete(key);

                connection.socket.send(
                  JSON.stringify({
                    type: 'unsubscribed',
                    tokenAddress,
                    timeframe,
                    chartType,
                    timestamp: Date.now(),
                  }),
                );

                console.log(
                  `[WS:ChartCompat] Unsubscribed: ${tokenAddress} ${timeframe} ${chartType}`,
                );
              } catch (error) {
                console.error('[WS:ChartCompat] Error unsubscribing:', error);
              }
            }
          } else if (message.type === 'ping') {
            connection.socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          }
        } catch (error) {
          console.error('[WS:ChartCompat] Error handling message:', error);
          connection.socket.send(
            JSON.stringify({
              type: 'error',
              message: 'Invalid message format',
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: Date.now(),
            }),
          );
        }
      });

      // Handle client disconnect
      connection.socket.on('close', async () => {
        console.log('[WS:ChartCompat] Client disconnected');

        // Unsubscribe from all
        for (const [key, subId] of subscriptions.entries()) {
          try {
            await adapterManager.unsubscribe(subId);
            console.log(`[WS:ChartCompat] Cleaned up subscription: ${key}`);
          } catch (error) {
            console.error('[WS:ChartCompat] Error cleaning up subscription:', error);
          }
        }

        subscriptions.clear();
      });

      // Handle errors
      connection.socket.on('error', (error) => {
        console.error('[WS:ChartCompat] WebSocket error:', error);
      });
    },
  );
};

