/**
 * WebSocket Route: Real-Time Trades
 * Phase 3 - Stream live trade data for tokens
 * 🔥 PHASE 5: Integrated with Sentry for error tracking
 *
 * Endpoint: /api/v1/ws/trades/:tokenAddress
 * Protocol: WebSocket
 * Data Source: Goldsky
 */

import * as Sentry from '@sentry/node';
import { randomUUID } from 'crypto';
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
      const clientId = randomUUID();
      const normalizedTokenAddress = tokenAddress.toLowerCase();

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

      // 🔥 NEW: Trade buffer for chronological ordering
      // Buffers trades from multiple sources and sends them in timestamp order
      interface BufferedTrade {
        trade: TradeEvent;
        receivedAt: number;
        marketCap?: {
          marketCapUsd: number;
          currentPriceUsd: number | string;
        };
      }
      const tradeBuffer: BufferedTrade[] = [];
      const FLUSH_INTERVAL_MS = 100; // Flush buffer every 100ms
      const MAX_BUFFER_AGE_MS = 500; // Max age before forcing flush (500ms)
      let flushInterval: NodeJS.Timeout | null = null;
      let lastFlushTime = Date.now();
      let lastSentTimestamp = 0; // Track last sent trade timestamp for ordering

      // Function to flush buffered trades in chronological order
      const flushTradeBuffer = () => {
        if (tradeBuffer.length === 0 || connection.socket.readyState !== 1) {
          return;
        }

        // Sort by trade timestamp (chronological order)
        tradeBuffer.sort((a, b) => a.trade.timestamp - b.trade.timestamp);

        // Send trades that are in order (timestamp >= lastSentTimestamp)
        const tradesToSend: BufferedTrade[] = [];
        const tradesToKeep: BufferedTrade[] = [];

        for (const bufferedTrade of tradeBuffer) {
          if (bufferedTrade.trade.timestamp >= lastSentTimestamp) {
            tradesToSend.push(bufferedTrade);
            lastSentTimestamp = bufferedTrade.trade.timestamp;
          } else {
            // Trade is out of order - keep it for next flush (might be delayed)
            const age = Date.now() - bufferedTrade.receivedAt;
            if (age < MAX_BUFFER_AGE_MS) {
              tradesToKeep.push(bufferedTrade);
            } else {
              // Too old, skip it (likely duplicate or very delayed)
              console.warn(`[WS:Trades] ⚠️ Skipping out-of-order trade (too old):`, {
                tradeId: bufferedTrade.trade.id,
                tradeTimestamp: new Date(bufferedTrade.trade.timestamp).toISOString(),
                lastSentTimestamp: new Date(lastSentTimestamp).toISOString(),
                ageMs: age,
              });
            }
          }
        }

        // Clear buffer and add back trades to keep
        tradeBuffer.length = 0;
        tradeBuffer.push(...tradesToKeep);

        // Send trades in order
        for (const bufferedTrade of tradesToSend) {
          const message = JSON.stringify({
            type: 'trade',
            data: {
              id: bufferedTrade.trade.id,
              tokenAddress: bufferedTrade.trade.tokenAddress,
              trader: bufferedTrade.trade.trader,
              isBuy: bufferedTrade.trade.isBuy,
              tokenAmount: bufferedTrade.trade.tokenAmount,
              acesAmount: bufferedTrade.trade.acesAmount,
              pricePerToken: bufferedTrade.trade.pricePerToken,
              priceUsd: bufferedTrade.trade.priceUsd,
              supply: bufferedTrade.trade.supply,
              timestamp: bufferedTrade.trade.timestamp, // Original trade time (for charts)
              ingestedAt: Date.now(), // 🔥 LOAD TEST FIX: When we sent this message (for latency metrics)
              blockNumber: bufferedTrade.trade.blockNumber,
              transactionHash: bufferedTrade.trade.transactionHash,
              source: bufferedTrade.trade.dataSource,
              isHistorical: false,
              // 🔥 NEW: Market cap data from single source of truth
              marketCapUsd: bufferedTrade.marketCap?.marketCapUsd || 0,
              currentPriceUsd:
                bufferedTrade.marketCap?.currentPriceUsd || bufferedTrade.trade.priceUsd || 0,
            },
            timestamp: Date.now(),
          });

          // 🔍 DEBUG: Log real-time trade being sent
          console.log(`[WS:Trades] 📤 Sending real-time trade to client:`, {
            id: bufferedTrade.trade.id,
            source: bufferedTrade.trade.dataSource,
            isBuy: bufferedTrade.trade.isBuy,
            tokenAmount: bufferedTrade.trade.tokenAmount,
            socketState: connection.socket.readyState,
          });

          connection.socket.send(message);
          lastMessageTime = Date.now();
        }

        if (tradesToSend.length > 0) {
          console.log(
            `[WS:Trades] ✅ Flushed ${tradesToSend.length} trades (chronological order), ${tradeBuffer.length} remaining in buffer`,
          );
        }

        lastFlushTime = Date.now();
      };

      // Start periodic flush
      flushInterval = setInterval(flushTradeBuffer, FLUSH_INTERVAL_MS);

      const processIncomingTrade = async (trade: TradeEvent) => {
        // 🔍 DEBUG: Log incoming trade
        console.log(`[WS:Trades] 📥 Received trade for ${tokenAddress}:`, {
          id: trade.id,
          source: trade.dataSource,
          dataSource: trade.dataSource, // Explicitly log dataSource
          isBuy: trade.isBuy,
          tokenAmount: trade.tokenAmount,
          timestamp: new Date(trade.timestamp).toISOString(),
          isHistorical: trade.isHistorical,
        });

        // 🔥 NEW: Fetch current market cap data
        // This provides real-time market cap updates alongside trades
        const MARKET_CAP_TIMEOUT_MS = 2000; // Do not block real-time delivery on slow market cap fetch
        let marketCapData = {
          marketCapUsd: 0,
          currentPriceUsd: trade.priceUsd || 0,
        };

        try {
          if (fastify.marketCapService) {
            const freshMarketCap = await Promise.race([
              fastify.marketCapService.getMarketCap(tokenAddress, 8453),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('market_cap_timeout')), MARKET_CAP_TIMEOUT_MS),
              ),
            ]);

            if (freshMarketCap) {
              marketCapData = {
                marketCapUsd: (freshMarketCap as any).marketCapUsd ?? 0,
                currentPriceUsd: (freshMarketCap as any).currentPriceUsd ?? trade.priceUsd ?? 0,
              };
            }
          }
        } catch (mcError) {
          const isTimeout = mcError instanceof Error && mcError.message === 'market_cap_timeout';
          console.warn(
            `[WS:Trades] ⚠️ ${
              isTimeout ? 'Market cap fetch timed out' : 'Failed to fetch market cap'
            } for ${tokenAddress}:`,
            mcError,
          );
          // Fallback to trade price if market cap service fails
          marketCapData.currentPriceUsd = trade.priceUsd || 0;
        }

        // 🔥 NEW: Buffer trade instead of sending immediately
        // This ensures chronological order across multiple sources
        // Now includes market cap data
        tradeBuffer.push({
          trade,
          receivedAt: Date.now(),
          marketCap: marketCapData,
        });

        // Force flush if buffer is getting large or trade is very recent
        const bufferAge = Date.now() - lastFlushTime;
        if (tradeBuffer.length >= 10 || bufferAge >= MAX_BUFFER_AGE_MS) {
          flushTradeBuffer();
        }
      };

      try {
        // 🔥 NEW: Send historical DEX trades from database (most recent 100)
        {
          try {
            const historicalTrades = await fastify.prisma.dexTrade.findMany({
              where: { tokenAddress: tokenAddress.toLowerCase() },
              orderBy: { timestamp: 'desc' }, // 🔥 FIX: Most recent first, then reverse for chronological
              take: 100,
            });

            // Reverse to send in chronological order (oldest to newest)
            historicalTrades.reverse();

            console.log(
              `[WS:Trades] 📚 Sending ${historicalTrades.length} historical DEX trades from database (most recent 100)`,
            );

            const acesUsdPriceService = (fastify as any).acesUsdPriceService;
            let batchAcesUsdPrice = 0;

            if (acesUsdPriceService) {
              try {
                const result = await acesUsdPriceService.getAcesUsdPrice();
                batchAcesUsdPrice = Number.parseFloat(result.price);
                if (Number.isFinite(batchAcesUsdPrice) && batchAcesUsdPrice > 0) {
                  console.log(
                    `[WS:Trades] ✅ Using batch ACES/USD price ${batchAcesUsdPrice} for historical trades`,
                  );
                } else {
                  console.warn(
                    '[WS:Trades] ⚠️ Invalid ACES/USD price for historical batch:',
                    result.price,
                  );
                  batchAcesUsdPrice = 0;
                }
              } catch (error) {
                console.warn(
                  '[WS:Trades] ⚠️ Failed to fetch ACES/USD price for historical batch:',
                  error,
                );
                batchAcesUsdPrice = 0;
              }
            }

            for (const trade of historicalTrades) {
              if (connection.socket.readyState === 1) {
                const tradeTimestamp = Number(trade.timestamp);

                // 🔥 NEW: Fetch market cap for historical trades
                let marketCapUsd = 0;
                const priceInAces = parseFloat(trade.priceInAces?.toString() || '0');
                const recomputedPriceUsd =
                  batchAcesUsdPrice > 0 && priceInAces > 0
                    ? priceInAces * batchAcesUsdPrice
                    : parseFloat(trade.priceInUsd?.toString() || '0');
                let currentPriceUsd = recomputedPriceUsd;

                try {
                  if (fastify.marketCapService) {
                    const freshMarketCap = await fastify.marketCapService.getMarketCap(
                      tokenAddress,
                      8453,
                    );
                    marketCapUsd = freshMarketCap.marketCapUsd;
                    currentPriceUsd = freshMarketCap.currentPriceUsd;
                  }
                } catch (mcError) {
                  console.warn(
                    `[WS:Trades] ⚠️ Failed to fetch market cap for historical trade:`,
                    mcError,
                  );
                  // Use trade price as fallback
                  currentPriceUsd = recomputedPriceUsd;
                }

                const message = JSON.stringify({
                  type: 'trade',
                  data: {
                    id: trade.txHash,
                    tokenAddress: trade.tokenAddress,
                    trader: trade.trader,
                    isBuy: trade.isBuy,
                    tokenAmount: trade.tokenAmount,
                    acesAmount: trade.acesAmount,
                    pricePerToken: trade.priceInAces.toString(),
                    priceUsd: recomputedPriceUsd > 0 ? recomputedPriceUsd.toString() : null,
                    supply: '0', // Not stored in database
                    timestamp: tradeTimestamp, // Original trade time (for charts)
                    ingestedAt: Date.now(), // 🔥 LOAD TEST FIX: When we sent this message (for latency metrics)
                    blockNumber: trade.blockNumber,
                    transactionHash: trade.txHash,
                    source: 'bitquery',
                    isHistorical: true,
                    // 🔥 NEW: Market cap data from single source of truth
                    marketCapUsd,
                    currentPriceUsd,
                  },
                  timestamp: Date.now(),
                });

                connection.socket.send(message);
                lastSentTimestamp = Math.max(lastSentTimestamp, tradeTimestamp);
              }
            }

            console.log(`[WS:Trades] ✅ Sent ${historicalTrades.length} historical trades`);
          } catch (error) {
            console.error('[WS:Trades] ❌ Failed to fetch historical trades:', error);
            // Don't block - continue with real-time subscription
          }
        }

        const subscriptionIds = await adapterManager.subscribeToTrades(
          tokenAddress,
          (trade: TradeEvent) => {
            void processIncomingTrade(trade);
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

          // 🔥 CLEANUP: Clear flush interval and flush remaining trades
          if (flushInterval) {
            clearInterval(flushInterval);
            flushInterval = null;
            console.log(`[WS:Trades] ✅ Flush interval cleared`);
          }

          // Flush any remaining buffered trades before disconnect
          if (tradeBuffer.length > 0) {
            flushTradeBuffer();
            console.log(
              `[WS:Trades] ✅ Flushed ${tradeBuffer.length} remaining trades before disconnect`,
            );
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

        // 🔥 CLEANUP: Clear flush interval on error
        if (flushInterval) {
          clearInterval(flushInterval);
          flushInterval = null;
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
