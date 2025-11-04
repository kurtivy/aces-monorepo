/**
 * WebSocket Route: Real-Time Bonding Status
 * Phase 3 - Stream live bonding curve status for tokens
 *
 * Endpoint: /api/v1/ws/bonding/:tokenAddress
 * Protocol: WebSocket
 * Data Source: Goldsky Subgraph
 */

import { FastifyPluginAsync } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import { BondingStatusEvent } from '../../../types/adapters';

export const bondingWebSocketRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * WebSocket: Subscribe to real-time bonding status for a specific token
   * GET /api/v1/ws/bonding/:tokenAddress
   */
  fastify.get(
    '/bonding/:tokenAddress',
    { websocket: true },
    async (connection: SocketStream, request) => {
      const { tokenAddress } = request.params as { tokenAddress: string };
      const adapterManager = fastify.adapterManager;

      console.log(`[WS:Bonding] Client connected for token: ${tokenAddress}`);

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
        // Subscribe to bonding status from Goldsky
        const subscriptionId = await adapterManager.subscribeToBondingStatus(
          tokenAddress,
          (status: BondingStatusEvent) => {
            // Send bonding status to client
            if (connection.socket.readyState === 1) {
              // OPEN
              connection.socket.send(
                JSON.stringify({
                  type: 'bonding_status',
                  data: {
                    tokenAddress: status.tokenAddress,
                    isBonded: status.isBonded,
                    supply: status.supply,
                    bondingProgress: status.bondingProgress,
                    poolAddress: status.poolAddress,
                    graduatedAt: status.graduatedAt,
                  },
                  timestamp: Date.now(),
                }),
              );
            }
          },
        );

        console.log(`[WS:Bonding] Subscribed to bonding status for ${tokenAddress}`);

        // Send confirmation
        connection.socket.send(
          JSON.stringify({
            type: 'subscribed',
            data: {
              tokenAddress,
              message: 'Streaming real-time bonding status',
            },
            timestamp: Date.now(),
          }),
        );

        // Handle client disconnect
        connection.socket.on('close', async () => {
          console.log(`[WS:Bonding] Client disconnected from ${tokenAddress}`);

          try {
            await adapterManager.unsubscribe(subscriptionId);
          } catch (error) {
            console.error('[WS:Bonding] Error unsubscribing:', error);
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
        console.error('[WS:Bonding] Subscription error:', error);
        connection.socket.send(
          JSON.stringify({
            type: 'error',
            message: 'Failed to subscribe to bonding status',
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        );
        connection.socket.close();
      }
    },
  );
};
