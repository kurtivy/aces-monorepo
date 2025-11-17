/**
 * WebSocket Route: Real-Time Candles
 * Phase 3 - Stream live OHLCV candle data for TradingView charts
 *
 * Endpoint: /api/v1/ws/candles/:tokenAddress
 * Protocol: WebSocket
 * Data Source: BitQuery
 */

import { FastifyPluginAsync } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import { CandleData } from '../../../types/adapters';

export const candlesWebSocketRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * WebSocket: Subscribe to real-time candles for TradingView
   * GET /api/v1/ws/candles/:tokenAddress?timeframe=1m
   */
  fastify.get(
    '/candles/:tokenAddress',
    { websocket: true },
    async (connection: SocketStream, request) => {
      const { tokenAddress } = request.params as { tokenAddress: string };
      const { timeframe = '1m' } = request.query as { timeframe?: string };

      // Validate timeframe
      const validTimeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
      if (!validTimeframes.includes(timeframe)) {
        connection.socket.send(
          JSON.stringify({
            type: 'error',
            message: `Invalid timeframe. Valid values: ${validTimeframes.join(', ')}`,
          }),
        );
        connection.socket.close();
        return;
      }

      const adapterManager = fastify.adapterManager;

      console.log(
        `[WS:Candles] Client connected for token: ${tokenAddress}, timeframe: ${timeframe}`,
      );

      if (!adapterManager || !adapterManager.isConnected()) {
        connection.socket.send(
          JSON.stringify({
            type: 'error',
            message: 'WebSocket adapters not connected. Using fallback REST API.',
          }),
        );
        connection.socket.close();
        return;
      }

      let subscriptionId: string | null = null;

      try {
        // Subscribe to candles from BitQuery
        // NOTE: BitQuery subscriptions don't support aggregations, so this will fail
        // Clients should use REST API for candles instead
        try {
          subscriptionId = await adapterManager.subscribeToCandles(
            tokenAddress,
            timeframe,
            (candle: CandleData) => {
              // Send candle to client
              if (connection.socket.readyState === 1) {
                // OPEN
                connection.socket.send(
                  JSON.stringify({
                    type: 'candle',
                    data: {
                      timestamp: candle.timestamp,
                      timeframe: candle.timeframe,
                      open: candle.open,
                      high: candle.high,
                      low: candle.low,
                      close: candle.close,
                      volume: candle.volume,
                      trades: candle.trades,
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

          console.log(`[WS:Candles] Subscribed to ${timeframe} candles for ${tokenAddress}`);
        } catch (candleError) {
          const errorMessage =
            candleError instanceof Error ? candleError.message : 'Candle subscription not available';
          console.warn('[WS:Candles] Candle subscription failed:', errorMessage);
          connection.socket.send(
            JSON.stringify({
              type: 'error',
              message:
                'Real-time candles not available via WebSocket. Please use REST API endpoint /api/v1/chart/:tokenAddress/unified for candles.',
              error: errorMessage,
              timestamp: Date.now(),
            }),
          );
          // Don't close connection - client can still use it for trades
        }

        // Send confirmation
        connection.socket.send(
          JSON.stringify({
            type: 'subscribed',
            data: {
              tokenAddress,
              timeframe,
              message: `Streaming real-time ${timeframe} candles`,
            },
            timestamp: Date.now(),
          }),
        );

        // Handle client disconnect
        connection.socket.on('close', async () => {
          console.log(`[WS:Candles] Client disconnected from ${tokenAddress} (${timeframe})`);

          if (subscriptionId) {
            try {
              await adapterManager.unsubscribe(subscriptionId);
            } catch (error) {
              console.error('[WS:Candles] Error unsubscribing:', error);
            }
          }
        });

        // Handle ping/pong for keep-alive
        connection.socket.on('message', (message) => {
          try {
            const data = JSON.parse(message.toString());
            if (data.type === 'ping') {
              connection.socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            }
          } catch (error) {
            // Ignore invalid messages
          }
        });
      } catch (error) {
        console.error('[WS:Candles] Subscription error:', error);
        connection.socket.send(
          JSON.stringify({
            type: 'error',
            message: 'Failed to subscribe to candles',
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        );
        connection.socket.close();
      }
    },
  );
};
