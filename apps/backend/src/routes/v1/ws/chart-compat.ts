/**
 * WebSocket Route: Chart Compatibility Layer
 * Phase 3 - Bridge old /ws/chart endpoint to new candles WebSocket
 *
 * Note: Real-time candle streaming is not supported. DEX data is handled by DexScreener on frontend.
 * Clients should use REST API for candles.
 */

import { FastifyPluginAsync } from 'fastify';
import { SocketStream } from '@fastify/websocket';

export const chartCompatWebSocketRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Legacy WebSocket: Chart data (compatibility)
   * GET /ws/chart (old endpoint for TradingView)
   *
   * Note: This endpoint is deprecated. Real-time candle streaming is not supported.
   * DEX data is handled by DexScreener iframe on frontend.
   * Use REST API /api/v1/chart/:tokenAddress/unified for candle data.
   */
  fastify.get(
    '/chart',
    { websocket: true },
    async (connection: SocketStream, _request) => {
      console.log('[WS:ChartCompat] Client connected to legacy /ws/chart endpoint');

      // Send deprecation notice
      connection.socket.send(
        JSON.stringify({
          type: 'error',
          message:
            'Real-time candles not available via WebSocket. DEX data is handled by DexScreener. Please use REST API endpoint /api/v1/chart/:tokenAddress/unified for bonding curve candles.',
          timestamp: Date.now(),
        }),
      );

      // Handle ping/pong for keep-alive
      connection.socket.on('message', (messageBuffer) => {
        try {
          const message = JSON.parse(messageBuffer.toString());
          if (message.type === 'ping') {
            connection.socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          } else if (message.type === 'subscribe') {
            // Send error for subscription requests
            connection.socket.send(
              JSON.stringify({
                type: 'error',
                message:
                  'Real-time candles not available via WebSocket. DEX data is handled by DexScreener. Please use REST API endpoint /api/v1/chart/:tokenAddress/unified for bonding curve candles.',
                timestamp: Date.now(),
              }),
            );
          }
        } catch (error) {
          // Ignore invalid messages
        }
      });

      // Handle client disconnect
      connection.socket.on('close', async () => {
        console.log('[WS:ChartCompat] Client disconnected');
      });
    },
  );
};
