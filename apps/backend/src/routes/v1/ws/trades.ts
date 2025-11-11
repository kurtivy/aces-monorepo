/**
 * WebSocket Route: Real-Time Trades
 * Phase 3 - Stream live trade data for tokens
 * 🔥 PHASE 5: Integrated with Sentry for error tracking
 *
 * Endpoint: /api/v1/ws/trades/:tokenAddress
 * Protocol: WebSocket
 * Data Sources: Goldsky (primary) + BitQuery (secondary)
 */

import * as Sentry from '@sentry/node';
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

      // 🔥 PHASE 1: Heartbeat configuration for keep-alive
      const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds - keep connection alive and prevent proxy timeout
      let heartbeatInterval: NodeJS.Timeout | null = null;
      let lastMessageTime = Date.now();

      try {
        // 🔥 NEW: Send historical BitQuery trades from database (last 100)
        try {
          const historicalTrades = await fastify.prisma.dexTrade.findMany({
            where: { tokenAddress: tokenAddress.toLowerCase() },
            orderBy: { timestamp: 'asc' }, // Oldest first (chronological order)
            take: 100,
          });

          console.log(
            `[WS:Trades] 📚 Sending ${historicalTrades.length} historical DEX trades from database`,
          );

          for (const trade of historicalTrades) {
            if (connection.socket.readyState === 1) {
              connection.socket.send(
                JSON.stringify({
                  type: 'trade',
                  data: {
                    id: trade.txHash,
                    tokenAddress: trade.tokenAddress,
                    trader: trade.trader,
                    isBuy: trade.isBuy,
                    tokenAmount: trade.tokenAmount,
                    acesAmount: trade.acesAmount,
                    pricePerToken: trade.priceInAces.toString(),
                    priceUsd: trade.priceInUsd?.toString() || null,
                    supply: '0', // Not stored in database
                    timestamp: Number(trade.timestamp),
                    blockNumber: trade.blockNumber,
                    transactionHash: trade.txHash,
                    source: 'bitquery',
                  },
                  timestamp: Date.now(),
                }),
              );
            }
          }

          console.log(`[WS:Trades] ✅ Sent ${historicalTrades.length} historical trades`);
        } catch (error) {
          console.error('[WS:Trades] ❌ Failed to fetch historical trades:', error);
          // Don't block - continue with real-time subscription
        }

        // Subscribe to trades from both Goldsky and BitQuery
        const subscriptionIds = await adapterManager.subscribeToTrades(
          tokenAddress,
          (trade: TradeEvent) => {
            // 🔍 DEBUG: Log incoming trade
            console.log(`[WS:Trades] 📥 Received trade for ${tokenAddress}:`, {
              id: trade.id,
              source: trade.dataSource,
              isBuy: trade.isBuy,
              tokenAmount: trade.tokenAmount,
              timestamp: new Date(trade.timestamp).toISOString(),
            });

            // Send trade to client
            if (connection.socket.readyState === 1) {
              // OPEN
              const message = JSON.stringify({
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
              });

              connection.socket.send(message);
              lastMessageTime = Date.now(); // Update last message time
              console.log(`[WS:Trades] ✅ Sent trade to client for ${tokenAddress}`);
            } else {
              console.warn(
                `[WS:Trades] ⚠️ Socket not open (state: ${connection.socket.readyState}), cannot send trade`,
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
        lastMessageTime = Date.now(); // Update last message time

        // 🔥 PHASE 1: Start heartbeat/keep-alive mechanism
        // Send ping messages to keep connection alive and detect dead connections
        heartbeatInterval = setInterval(() => {
          if (connection.socket.readyState === 1) {
            // OPEN - send ping to keep connection alive
            // Client should respond with pong (Phase 2)
            try {
              connection.socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
              const timeSinceLastMessage = Date.now() - lastMessageTime;
              console.log(
                `[WS:Trades] 💓 Heartbeat ping sent for ${tokenAddress} (idle for ${timeSinceLastMessage}ms)`,
              );
            } catch (error) {
              console.warn('[WS:Trades] ❌ Failed to send heartbeat ping:', error);
              // 🔥 PHASE 5: Report heartbeat failures to Sentry
              Sentry.captureException(error, {
                tags: {
                  component: 'websocket-trades',
                  tokenAddress,
                  errorType: 'heartbeat_send_failed',
                },
                contexts: {
                  websocket: {
                    tokenAddress,
                    socketState: connection.socket.readyState,
                    timeSinceLastMessage: Date.now() - lastMessageTime,
                  },
                },
              });
            }
          } else {
            const socketState = connection.socket.readyState;
            console.warn(`[WS:Trades] ⚠️ Cannot send heartbeat - socket state: ${socketState}`);
            // 🔥 PHASE 5: Report socket state issues to Sentry (this is the "socket state: 3" warning)
            if (socketState === 3) {
              // CLOSED state - connection is dead
              Sentry.captureMessage(
                `WebSocket socket in CLOSED state (3) - cannot send heartbeat`,
                'warning',
              );
              Sentry.captureEvent({
                level: 'warning',
                message: 'WebSocket heartbeat blocked - socket closed',
                tags: {
                  component: 'websocket-trades',
                  tokenAddress,
                  errorType: 'socket_closed_state',
                  socketState: socketState.toString(),
                },
                contexts: {
                  websocket: {
                    tokenAddress,
                    socketState,
                    timeSinceLastMessage: Date.now() - lastMessageTime,
                  },
                },
              });
            }
          }
        }, HEARTBEAT_INTERVAL_MS);

        // Handle client disconnect
        connection.socket.on('close', async () => {
          console.log(`[WS:Trades] 🔌 Client disconnected from ${tokenAddress}`);

          // 🔥 CLEANUP: Clear heartbeat interval
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
            console.log(`[WS:Trades] ✅ Heartbeat interval cleared`);
          }

          // Unsubscribe from all trade sources
          for (const subId of subscriptionIds) {
            try {
              await adapterManager.unsubscribe(subId);
            } catch (error) {
              console.error('[WS:Trades] Error unsubscribing:', error);
              // 🔥 PHASE 5: Report unsubscribe errors to Sentry
              Sentry.captureException(error, {
                tags: {
                  component: 'websocket-trades',
                  tokenAddress,
                  errorType: 'unsubscribe_failed',
                  subscriptionId: subId,
                },
              });
            }
          }
        });

        // Handle ping/pong for keep-alive
        connection.socket.on('message', (message) => {
          try {
            const data = JSON.parse(message.toString());
            if (data.type === 'ping') {
              connection.socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
              console.log(`[WS:Trades] 🏓 Responded to client ping for ${tokenAddress}`);
            } else if (data.type === 'pong') {
              // 🔥 PHASE 3 FIX: Echo pong back to client for bidirectional heartbeat completion
              try {
                connection.socket.send(JSON.stringify({ type: 'pong', timestamp: data.timestamp }));
                const rtt = Date.now() - (data.timestamp || Date.now());
                console.log(
                  `[WS:Trades] 🏓 Echoed pong back to client for ${tokenAddress} (RTT: ${rtt}ms)`,
                );
              } catch (sendError) {
                console.warn(`[WS:Trades] ⚠️ Failed to echo pong for ${tokenAddress}:`, sendError);
              }
            }
          } catch (error) {
            // Ignore invalid messages
          }
        });
      } catch (error) {
        console.error('[WS:Trades] Subscription error:', error);

        // 🔥 PHASE 5: Report subscription errors to Sentry (critical - prevents connection)
        Sentry.captureException(error, {
          tags: {
            component: 'websocket-trades',
            tokenAddress,
            errorType: 'subscription_failed',
          },
          contexts: {
            websocket: {
              tokenAddress,
              socketState: connection.socket.readyState,
            },
          },
        });

        // 🔥 CLEANUP: Clear heartbeat on error
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }

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
