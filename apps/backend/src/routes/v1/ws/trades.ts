/**
 * WebSocket Route: Real-Time Trades
 * Phase 3 - Stream live trade data for tokens
 *
 * Endpoint: /api/v1/ws/trades/:tokenAddress
 * Protocol: WebSocket
 * Data Sources: Goldsky (primary) + BitQuery (secondary)
 */

import { FastifyPluginAsync } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import { TradeEvent } from '../../../types/adapters';

export const tradesWebSocketRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * WebSocket: Subscribe to real-time trades for a specific token
   * GET /api/v1/ws/trades/:tokenAddress
   */
  fastify.get(
    '/trades/:tokenAddress',
    { websocket: true },
    async (connection: SocketStream, request) => {
      const { tokenAddress } = request.params as { tokenAddress: string };
      const adapterManager = fastify.adapterManager;

      console.log(`[WS:Trades] Client connected for token: ${tokenAddress}`);

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

      // Check adapter connection status (but don't block - allow connection even if some adapters aren't ready)
      const isConnected = adapterManager.isConnected();
      if (!isConnected) {
        console.warn(
          `[WS:Trades] Adapters not fully connected, but allowing connection for ${tokenAddress}`,
        );
        // Still allow connection - adapters might connect later
        // Send a warning message but keep the connection open
        connection.socket.send(
          JSON.stringify({
            type: 'warning',
            message:
              'Some adapters are still connecting. Trades may be limited until fully connected.',
            timestamp: Date.now(),
          }),
        );
      }

      try {
        // Subscribe to trades from both Goldsky and BitQuery
        const subscriptionIds = await adapterManager.subscribeToTrades(
          tokenAddress,
          (trade: TradeEvent) => {
            // Send trade to client
            if (connection.socket.readyState === 1) {
              // OPEN
              connection.socket.send(
                JSON.stringify({
                  type: 'trade',
                  data: {
                    id: trade.id,
                    tokenAddress: trade.tokenAddress,
                    trader: trade.trader,
                    isBuy: trade.isBuy,
                    tokenAmount: trade.tokenAmount,
                    acesAmount: trade.acesAmount,
                    pricePerToken: trade.pricePerToken,
                    priceUsd: trade.priceUsd,
                    supply: trade.supply,
                    timestamp: trade.timestamp,
                    blockNumber: trade.blockNumber,
                    transactionHash: trade.transactionHash,
                    source: trade.dataSource,
                  },
                  timestamp: Date.now(),
                }),
              );
            }
          },
        );

        console.log(
          `[WS:Trades] Subscribed to ${subscriptionIds.length} trade sources for ${tokenAddress}`,
        );

        // Send confirmation
        connection.socket.send(
          JSON.stringify({
            type: 'subscribed',
            data: {
              tokenAddress,
              sources: subscriptionIds.length,
              message: 'Streaming real-time trades',
            },
            timestamp: Date.now(),
          }),
        );

        // Handle client disconnect
        connection.socket.on('close', async () => {
          console.log(`[WS:Trades] Client disconnected from ${tokenAddress}`);

          // Unsubscribe from all trade sources
          for (const subId of subscriptionIds) {
            try {
              await adapterManager.unsubscribe(subId);
            } catch (error) {
              console.error('[WS:Trades] Error unsubscribing:', error);
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
        console.error('[WS:Trades] Subscription error:', error);
        connection.socket.send(
          JSON.stringify({
            type: 'error',
            message: 'Failed to subscribe to trades',
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        );
        connection.socket.close();
      }
    },
  );
};
