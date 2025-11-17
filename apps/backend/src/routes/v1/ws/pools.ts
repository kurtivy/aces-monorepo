/**
 * WebSocket Route: Real-Time Pool State
 * Phase 3 - Stream live pool reserves and prices from Aerodrome
 *
 * Endpoint: /api/v1/ws/pools/:poolAddress
 * Protocol: WebSocket
 * Data Source: Aerodrome (via QuickNode Sync events)
 */

import { FastifyPluginAsync } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import { PoolStateEvent } from '../../../types/adapters';

export const poolsWebSocketRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * WebSocket: Subscribe to real-time pool state (reserves, prices)
   * GET /api/v1/ws/pools/:poolAddress?token=0xTOKEN
   */
  fastify.get(
    '/pools/:poolAddress',
    { websocket: true },
    async (connection: SocketStream, request) => {
      const { poolAddress } = request.params as { poolAddress: string };
      const { token: tokenAddress } = request.query as { token?: string };

      if (!tokenAddress) {
        connection.socket.send(
          JSON.stringify({
            type: 'error',
            message: 'Missing required query parameter: token',
          }),
        );
        connection.socket.close();
        return;
      }

      const adapterManager = fastify.adapterManager;

      console.log(`[WS:Pools] Client connected for pool: ${poolAddress}, token: ${tokenAddress}`);

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

      try {
        // Subscribe to pool state from Aerodrome
        const subscriptionId = await adapterManager.subscribeToPoolState(
          poolAddress,
          tokenAddress,
          (poolState: PoolStateEvent) => {
            // Send pool state to client
            if (connection.socket.readyState === 1) {
              // OPEN
              connection.socket.send(
                JSON.stringify({
                  type: 'pool_state',
                  data: {
                    poolAddress: poolState.poolAddress,
                    tokenAddress: poolState.tokenAddress,
                    reserve0: poolState.reserve0,
                    reserve1: poolState.reserve1,
                    priceToken0: poolState.priceToken0,
                    priceToken1: poolState.priceToken1,
                    blockNumber: poolState.blockNumber,
                    timestamp: poolState.timestamp,
                  },
                  timestamp: Date.now(),
                }),
              );
            }
          },
        );

        console.log(`[WS:Pools] Subscribed to pool state for ${poolAddress}`);

        // Send confirmation
        connection.socket.send(
          JSON.stringify({
            type: 'subscribed',
            data: {
              poolAddress,
              tokenAddress,
              message: 'Streaming real-time pool reserves and prices',
            },
            timestamp: Date.now(),
          }),
        );

        // Handle client disconnect
        connection.socket.on('close', async () => {
          console.log(`[WS:Pools] Client disconnected from ${poolAddress}`);

          try {
            await adapterManager.unsubscribe(subscriptionId);
          } catch (error) {
            console.error('[WS:Pools] Error unsubscribing:', error);
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
        console.error('[WS:Pools] Subscription error:', error);
        connection.socket.send(
          JSON.stringify({
            type: 'error',
            message: 'Failed to subscribe to pool state',
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        );
        connection.socket.close();
      }
    },
  );
};
