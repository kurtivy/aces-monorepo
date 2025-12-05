/**
 * WebSocket Route: Real-Time Candles
 * Phase 3 - Stream live OHLCV candle data for TradingView charts
 *
 * Endpoint: /api/v1/ws/candles/:tokenAddress
 * Protocol: WebSocket
 *
 * Note: Real-time candle streaming is not supported. DEX data is handled by DexScreener on frontend.
 * Clients should use REST API for candles.
 */

import { FastifyPluginAsync } from 'fastify';
import { SocketStream } from '@fastify/websocket';

export const candlesWebSocketRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * WebSocket: Subscribe to real-time candles for TradingView
   * GET /api/v1/ws/candles/:tokenAddress?timeframe=1m
   *
   * Note: This endpoint is deprecated. Real-time candle streaming is not supported.
   * DEX data is handled by DexScreener iframe on frontend.
   * Use REST API /api/v1/chart/:tokenAddress/unified for candle data.
   */
  fastify.get(
    '/candles/:tokenAddress',
    { websocket: true },
    async (connection: SocketStream, request) => {
      const { tokenAddress } = request.params as { tokenAddress: string };
      const { timeframe = '1m' } = request.query as { timeframe?: string };

      console.log(
        `[WS:Candles] Client connected for token: ${tokenAddress}, timeframe: ${timeframe}`,
      );

      // Real-time candle streaming is not supported
      // Send error and close connection
      connection.socket.send(
        JSON.stringify({
          type: 'error',
          message:
            'Real-time candles not available via WebSocket. DEX data is handled by DexScreener. Please use REST API endpoint /api/v1/chart/:tokenAddress/unified for bonding curve candles.',
          timestamp: Date.now(),
        }),
      );
      connection.socket.close();
    },
  );
};
