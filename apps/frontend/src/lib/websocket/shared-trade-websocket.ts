/**
 * Shared Trade WebSocket Manager
 *
 * Prevents duplicate WebSocket connections to the same trade endpoint.
 * Multiple components can subscribe to the same WebSocket connection.
 */

export interface TradeData {
  id: string;
  tokenAddress: string;
  trader: string;
  isBuy: boolean;
  tokenAmount: string;
  acesAmount: string;
  pricePerToken: string;
  priceUsd: string;
  supply: string;
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
  source: 'goldsky' | 'bitquery';
  sequenceNumber?: number;
}

type TradeCallback = (trade: TradeData) => void;
type StatusCallback = (status: {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}) => void;

interface ConnectionState {
  ws: WebSocket | null;
  subscribers: Set<string>;
  tradeCallbacks: Map<string, TradeCallback>;
  statusCallbacks: Map<string, StatusCallback>;
  reconnectAttempt: number;
  reconnectTimeout: ReturnType<typeof setTimeout> | null;
  // 🔥 PHASE 2: Connection health tracking
  lastPongTime: number | null;
  lastMessageTime: number;
  missedPongs: number;
  totalPings: number;
  totalPongs: number;
  pongCheckInterval: NodeJS.Timeout | null;
}

class SharedTradeWebSocketManager {
  private connections = new Map<string, ConnectionState>();
  private readonly maxReconnectAttempts = 10;

  /**
   * Subscribe to trades for a token
   * Returns an unsubscribe function
   */
  subscribe(
    tokenAddress: string,
    onTrade: TradeCallback,
    onStatusChange?: StatusCallback,
  ): () => void {
    const subscriberId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const normalizedAddress = tokenAddress.toLowerCase();

    // Get or create connection state
    let state = this.connections.get(normalizedAddress);

    if (!state) {
      state = {
        ws: null,
        subscribers: new Set(),
        tradeCallbacks: new Map(),
        statusCallbacks: new Map(),
        reconnectAttempt: 0,
        reconnectTimeout: null,
        // 🔥 PHASE 2: Initialize health tracking
        lastPongTime: null,
        lastMessageTime: Date.now(),
        missedPongs: 0,
        totalPings: 0,
        totalPongs: 0,
        pongCheckInterval: null,
      };
      this.connections.set(normalizedAddress, state);
    }

    // Add this subscriber
    state.subscribers.add(subscriberId);
    state.tradeCallbacks.set(subscriberId, onTrade);
    if (onStatusChange) {
      state.statusCallbacks.set(subscriberId, onStatusChange);
    }

    console.log(
      `[SharedTradeWS] ✅ Subscriber added for ${tokenAddress}: ${subscriberId} (total: ${state.subscribers.size}, tradeCallbacks: ${state.tradeCallbacks.size})`,
      {
        subscriberId,
        tokenAddress,
        hasTradeCallback: !!onTrade,
        hasStatusCallback: !!onStatusChange,
        totalSubscribers: state.subscribers.size,
        totalTradeCallbacks: state.tradeCallbacks.size,
      },
    );

    // Connect if not already connected
    if (!state.ws || state.ws.readyState === WebSocket.CLOSED) {
      this.connect(normalizedAddress);
    } else if (state.ws.readyState === WebSocket.OPEN) {
      // Already connected, notify this subscriber
      if (onStatusChange) {
        onStatusChange({ isConnected: true, isConnecting: false, error: null });
      }
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribe(normalizedAddress, subscriberId);
    };
  }

  private connect(tokenAddress: string): void {
    const state = this.connections.get(tokenAddress);
    if (!state) return;

    // Clean up existing connection
    if (state.ws) {
      state.ws.close();
      state.ws = null;
    }

    // Derive WebSocket URL
    const wsBaseUrl = (() => {
      if (typeof window === 'undefined') return 'ws://localhost:3002';

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (apiUrl) {
        try {
          const url = new URL(apiUrl);
          const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
          return `${protocol}//${url.host}`;
        } catch {
          // Fallback
        }
      }

      // Derive from window.location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.hostname}:3002`;
    })();

    const wsUrl = `${wsBaseUrl}/api/v1/ws/trades/${tokenAddress}`;

    console.log(
      `[SharedTradeWS] 🔌 Connecting to ${wsUrl} for ${state.subscribers.size} subscribers`,
    );
    console.log(`[SharedTradeWS] WebSocket base URL: ${wsBaseUrl}`);
    console.log(`[SharedTradeWS] Token address: ${tokenAddress}`);

    // Notify subscribers we're connecting
    for (const callback of state.statusCallbacks.values()) {
      callback({ isConnected: false, isConnecting: true, error: null });
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      state.ws = ws;

      console.log(`[SharedTradeWS] WebSocket instance created, readyState: ${ws.readyState}`);
    } catch (error) {
      console.error(`[SharedTradeWS] ❌ Failed to create WebSocket:`, error);
      for (const callback of state.statusCallbacks.values()) {
        callback({
          isConnected: false,
          isConnecting: false,
          error: `Failed to create WebSocket: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
      return;
    }

    ws.onopen = () => {
      console.log(`[SharedTradeWS] ✅ WebSocket opened for ${tokenAddress}`);
      state.reconnectAttempt = 0;
      state.lastMessageTime = Date.now();

      // 🔥 PHASE 2: Start pong monitoring to detect dead connections
      // If we don't get pongs, connection is likely dead
      state.pongCheckInterval = setInterval(() => {
        // Check if we've received a pong in the last 40 seconds (heartbeat is 30s + buffer)
        const timeSinceLastPong = state.lastPongTime ? Date.now() - state.lastPongTime : 40000;
        const timeSinceLastMessage = Date.now() - state.lastMessageTime;

        // If we haven't received any pong in 40+ seconds, increment missed count
        if (state.lastPongTime === null || timeSinceLastPong > 40000) {
          state.missedPongs++;
          console.warn(
            `[SharedTradeWS] ⚠️ Pong check for ${tokenAddress}: missed ${state.missedPongs}, last message ${timeSinceLastMessage}ms ago`,
          );

          // If we've missed 2 pongs (80+ seconds), connection is likely dead - force disconnect
          if (state.missedPongs >= 2) {
            console.error(
              `[SharedTradeWS] ❌ Missed ${state.missedPongs} pongs for ${tokenAddress}, connection likely dead`,
            );
            ws.close(1000, 'Pong timeout - connection dead');
          }
        }
      }, 45000); // Check every 45 seconds

      // Notify subscribers that we're connected (but wait for subscribed message for full confirmation)
      // The backend will send a 'subscribed' message after subscriptions are set up
      for (const callback of state.statusCallbacks.values()) {
        callback({ isConnected: false, isConnecting: true, error: null });
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // 🔥 PHASE 2: Handle heartbeat ping/pong
        state.lastMessageTime = Date.now();

        console.log(`[SharedTradeWS] 📨 Received message for ${tokenAddress}:`, message.type);

        // 🔥 PHASE 2: Handle server pings - respond with pong
        if (message.type === 'ping') {
          console.log(`[SharedTradeWS] 💓 Received server ping for ${tokenAddress}`);
          state.totalPings++;

          try {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            state.lastPongTime = Date.now();
            state.missedPongs = 0; // Reset on successful pong
            console.log(`[SharedTradeWS] 🏓 Responded with pong for ${tokenAddress}`);
          } catch (error) {
            console.error(`[SharedTradeWS] ❌ Failed to send pong for ${tokenAddress}:`, error);
          }

          return; // Don't process ping as regular message
        }

        // 🔥 PHASE 2: Acknowledge pong from server (if we sent client-initiated ping)
        if (message.type === 'pong') {
          const rtt = message.timestamp ? Date.now() - message.timestamp : 0;
          console.log(
            `[SharedTradeWS] 🏓 Received pong from server for ${tokenAddress} (RTT: ${rtt}ms)`,
          );
          state.totalPongs++;
          state.lastPongTime = Date.now();
          state.missedPongs = 0;
          return; // Don't process pong as regular message
        }

        if (message.type === 'trade' && message.data) {
          // Broadcast trade to all subscribers
          console.log(`[SharedTradeWS] 📊 Broadcasting trade for ${tokenAddress}:`, {
            id: message.data.id,
            source: message.data.source,
            isBuy: message.data.isBuy,
            tokenAmount: message.data.tokenAmount,
            timestamp: message.data.timestamp,
            subscriberCount: state.tradeCallbacks.size,
            allSubscriberIds: Array.from(state.tradeCallbacks.keys()),
          });

          if (state.tradeCallbacks.size === 0) {
            console.warn(`[SharedTradeWS] ⚠️ No subscribers to receive trade for ${tokenAddress}!`);
            return;
          }

          let callbackIndex = 0;
          const callbacksArray = Array.from(state.tradeCallbacks.entries());
          console.log(`[SharedTradeWS] 📋 Found ${callbacksArray.length} callbacks to execute`);

          for (const [subscriberId, callback] of callbacksArray) {
            try {
              console.log(
                `[SharedTradeWS] 🔔 Calling callback ${callbackIndex + 1}/${callbacksArray.length} (subscriber: ${subscriberId.substring(0, 20)}...)`,
              );
              console.log(`[SharedTradeWS] Callback function:`, {
                isFunction: typeof callback === 'function',
                name: callback.name || 'anonymous',
                toString: callback.toString().substring(0, 100),
              });

              callback(message.data);

              console.log(
                `[SharedTradeWS] ✅ Callback ${callbackIndex + 1} executed successfully (subscriber: ${subscriberId.substring(0, 20)}...)`,
              );
              callbackIndex++;
            } catch (error) {
              console.error(
                `[SharedTradeWS] ❌ Error in callback ${callbackIndex + 1} (subscriber: ${subscriberId}):`,
                error,
              );
              console.error(
                '[SharedTradeWS] Error stack:',
                error instanceof Error ? error.stack : 'No stack',
              );
              callbackIndex++;
            }
          }

          console.log(`[SharedTradeWS] ✅ Finished broadcasting to ${callbackIndex} callbacks`);
        } else if (message.type === 'subscribed') {
          // Backend confirmed subscriptions are active - connection is fully ready
          console.log(`[SharedTradeWS] ✅ Subscribed confirmed for ${tokenAddress}:`, message.data);
          for (const callback of state.statusCallbacks.values()) {
            callback({ isConnected: true, isConnecting: false, error: null });
          }
        } else if (message.type === 'warning') {
          // Backend sent a warning (e.g., adapters still connecting)
          console.warn(`[SharedTradeWS] ⚠️ Warning for ${tokenAddress}:`, message.message);
          // Still mark as connected, but with warning
          for (const callback of state.statusCallbacks.values()) {
            callback({ isConnected: true, isConnecting: false, error: null });
          }
        } else if (message.type === 'error') {
          // Backend sent an error
          console.error(`[SharedTradeWS] ❌ Error for ${tokenAddress}:`, message.message);
          for (const callback of state.statusCallbacks.values()) {
            callback({
              isConnected: false,
              isConnecting: false,
              error: message.message || 'WebSocket error',
            });
          }
        }
      } catch (error) {
        console.error('[SharedTradeWS] Error parsing message:', error);
      }
    };

    ws.onerror = (_error) => {
      // WebSocket error events don't contain useful info - the real info is in onclose
      // Just log that an error occurred, details will be in onclose
      console.warn(
        `[SharedTradeWS] ⚠️ WebSocket error event for ${tokenAddress} (check onclose for details)`,
      );
    };

    ws.onclose = (event) => {
      // This is where the real error information is!
      const closeCode = event.code;
      const closeReason = event.reason || 'No reason provided';
      const wasClean = event.wasClean;

      console.log(`[SharedTradeWS] 🔌 Closed for ${tokenAddress}:`, {
        code: closeCode,
        reason: closeReason,
        wasClean,
        subscribers: state.subscribers.size,
        reconnectAttempt: state.reconnectAttempt,
        // 🔥 PHASE 2: Connection health metrics
        totalPings: state.totalPings,
        totalPongs: state.totalPongs,
        missedPongs: state.missedPongs,
      });

      // 🔥 PHASE 2: Clear pong monitoring interval
      if (state.pongCheckInterval) {
        clearInterval(state.pongCheckInterval);
        state.pongCheckInterval = null;
        console.log(`[SharedTradeWS] ✅ Pong check interval cleared for ${tokenAddress}`);
      }

      // Clear the WebSocket reference
      if (state.ws === ws) {
        state.ws = null;
      }

      // Determine error message based on close code
      let errorMessage: string | null = 'Connection closed';
      if (closeCode === 1006) {
        errorMessage = 'Connection failed - check CORS and backend availability';
      } else if (closeCode === 1000) {
        errorMessage = null; // Normal closure, no error
      } else if (closeCode === 1001) {
        errorMessage = 'Connection going away';
      } else if (closeCode === 1008) {
        errorMessage = 'Policy violation - check CORS configuration';
      } else if (closeCode === 1011) {
        errorMessage = 'Server error';
      }

      // Notify all subscribers about disconnection
      for (const callback of state.statusCallbacks.values()) {
        callback({
          isConnected: false,
          isConnecting: false,
          error: errorMessage,
        });
      }

      // Auto-reconnect if we still have subscribers (unless it was a clean close)
      if (
        state.subscribers.size > 0 &&
        state.reconnectAttempt < this.maxReconnectAttempts &&
        !wasClean && // Don't reconnect on clean closes
        closeCode !== 1000 && // Don't reconnect on normal closure
        closeCode !== 1001 // Don't reconnect on "going away"
      ) {
        const delay = Math.min(1000 * Math.pow(2, state.reconnectAttempt), 30000);
        state.reconnectAttempt++;

        console.log(
          `[SharedTradeWS] 🔄 Reconnecting in ${delay}ms (attempt ${state.reconnectAttempt}/${this.maxReconnectAttempts}) - ${state.subscribers.size} subscribers waiting`,
        );

        state.reconnectTimeout = setTimeout(() => {
          // Double-check we still have subscribers before reconnecting
          const currentState = this.connections.get(tokenAddress);
          if (currentState && currentState.subscribers.size > 0) {
            this.connect(tokenAddress);
          } else {
            console.log(
              `[SharedTradeWS] ⚠️ No subscribers remaining, skipping reconnect for ${tokenAddress}`,
            );
          }
        }, delay);
      } else if (state.subscribers.size === 0) {
        console.log(
          `[SharedTradeWS] ⚠️ No subscribers left, will not reconnect for ${tokenAddress}`,
        );
        this.connections.delete(tokenAddress);
      } else if (state.reconnectAttempt >= this.maxReconnectAttempts) {
        console.error(
          `[SharedTradeWS] ❌ Max reconnection attempts reached for ${tokenAddress}, giving up`,
        );
        // Notify subscribers we've given up
        for (const callback of state.statusCallbacks.values()) {
          callback({
            isConnected: false,
            isConnecting: false,
            error: 'Max reconnection attempts reached',
          });
        }
      } else if (wasClean || closeCode === 1000 || closeCode === 1001) {
        console.log(`[SharedTradeWS] ✅ Clean closure (code ${closeCode}), not reconnecting`);
      }
    };
  }

  private unsubscribe(tokenAddress: string, subscriberId: string): void {
    const state = this.connections.get(tokenAddress);
    if (!state) return;

    state.subscribers.delete(subscriberId);
    state.tradeCallbacks.delete(subscriberId);
    state.statusCallbacks.delete(subscriberId);

    console.log(
      `[SharedTradeWS] Subscriber removed for ${tokenAddress}: ${subscriberId} (remaining: ${state.subscribers.size})`,
    );

    // If no more subscribers, close connection
    if (state.subscribers.size === 0) {
      console.log(`[SharedTradeWS] No more subscribers for ${tokenAddress}, closing connection`);

      if (state.reconnectTimeout) {
        clearTimeout(state.reconnectTimeout);
        state.reconnectTimeout = null;
      }

      // 🔥 PHASE 2: Clear pong monitoring interval
      if (state.pongCheckInterval) {
        clearInterval(state.pongCheckInterval);
        state.pongCheckInterval = null;
      }

      if (state.ws) {
        state.ws.close();
        state.ws = null;
      }

      this.connections.delete(tokenAddress);
    }
  }

  /**
   * Get connection status for a token
   */
  getStatus(tokenAddress: string): { isConnected: boolean; subscriberCount: number } {
    const state = this.connections.get(tokenAddress.toLowerCase());

    return {
      isConnected: state?.ws?.readyState === WebSocket.OPEN,
      subscriberCount: state?.subscribers.size || 0,
    };
  }

  /**
   * 🔥 PHASE 2: Get connection health metrics for a token
   */
  getHealthMetrics(
    tokenAddress: string,
  ): {
    isConnected: boolean;
    lastPongTime: number | null;
    missedPongs: number;
    totalPings: number;
    totalPongs: number;
    timeSinceLastMessage: number;
  } | null {
    const state = this.connections.get(tokenAddress.toLowerCase());
    if (!state) return null;

    return {
      isConnected: state.ws?.readyState === WebSocket.OPEN,
      lastPongTime: state.lastPongTime,
      missedPongs: state.missedPongs,
      totalPings: state.totalPings,
      totalPongs: state.totalPongs,
      timeSinceLastMessage: Date.now() - state.lastMessageTime,
    };
  }
}

// Singleton instance
export const sharedTradeWebSocket = new SharedTradeWebSocketManager();
