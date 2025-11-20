/**
 * Goldsky Subgraph WebSocket Adapter
 * US-2.1: Real-time trade data via Goldsky GraphQL Subscriptions
 *
 * Provides:
 * - Real-time trade events (TokenPurchased, TokenSold)
 * - Bonding status updates (BondingCurveGraduated)
 * - Token creation events
 * - Low latency (~100-500ms)
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import {
  BaseAdapter,
  AdapterStats,
  TradeEvent,
  BondingStatusEvent,
  AdapterEventType,
  AdapterEvent,
} from '../../types/adapters';

interface GoldskyConfig {
  wsUrl: string;
  apiKey?: string;
}

interface SubscriptionRequest {
  id: string;
  query: string;
  variables?: Record<string, any>;
  callback: (data: any) => void;
}

/**
 * Goldsky Subgraph WebSocket Adapter
 */
export class GoldskyAdapter extends EventEmitter implements BaseAdapter {
  private ws: WebSocket | null = null;
  private config: GoldskyConfig;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isReconnecting = false;
  private pingInterval: NodeJS.Timeout | null = null;

  // Stats
  private stats = {
    name: 'Goldsky',
    connected: false,
    messagesReceived: 0,
    messagesEmitted: 0,
    errors: 0,
    lastMessageAt: null as number | null,
    connectionUptime: 0,
    connectedAt: 0,
  };

  // Subscriptions
  private subscriptions = new Map<string, SubscriptionRequest>();
  private subscriptionIdCounter = 0;

  constructor(config?: Partial<GoldskyConfig>) {
    super();
    this.config = {
      wsUrl: config?.wsUrl || process.env.GOLDSKY_WS_URL || '',
      apiKey: config?.apiKey || process.env.GOLDSKY_API_KEY,
    };

    if (!this.config.wsUrl) {
      throw new Error(
        'Goldsky WebSocket URL required. Set GOLDSKY_WS_URL environment variable.',
      );
    }

    console.log('[GoldskyAdapter] Initialized');
  }

  /**
   * Connect to Goldsky WebSocket
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.warn('[GoldskyAdapter] Already connected');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('[GoldskyAdapter] 🔌 Connecting to Goldsky...');

        // Create WebSocket connection
        const wsUrl = this.config.apiKey
          ? `${this.config.wsUrl}?apiKey=${this.config.apiKey}`
          : this.config.wsUrl;

        this.ws = new WebSocket(wsUrl, ['graphql-ws']);

        // Handle open
        this.ws.onopen = () => {
          console.log('[GoldskyAdapter] ✅ Connected');
          this.stats.connected = true;
          this.stats.connectedAt = Date.now();
          this.reconnectAttempts = 0;

          // Send connection init
          this.sendMessage({
            type: 'connection_init',
            payload: {},
          });

          // Start ping interval
          this.startPingInterval();

          this.emit('connected');
          this.emitAdapterEvent(AdapterEventType.CONNECTED, {});

          resolve();
        };

        // Handle messages
        this.ws.onmessage = (event) => {
          const data = typeof event.data === 'string' ? event.data : event.data.toString();
          this.handleMessage(data);
        };

        // Handle errors
        this.ws.onerror = (error) => {
          console.error('[GoldskyAdapter] WebSocket error:', error);
          this.stats.errors++;
          this.emit('error', error);
          reject(error);
        };

        // Handle close
        this.ws.onclose = (event) => {
          console.warn(
            `[GoldskyAdapter] WebSocket closed: ${event.code} ${event.reason}`,
          );
          this.stats.connected = false;
          this.stopPingInterval();

          if (!event.wasClean) {
            this.scheduleReconnect();
          }

          this.emit('disconnected', event);
        };
      } catch (error) {
        console.error('[GoldskyAdapter] Connection failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from Goldsky
   */
  async disconnect(): Promise<void> {
    if (!this.ws) return;

    console.log('[GoldskyAdapter] Disconnecting...');

    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Stop ping
    this.stopPingInterval();

    // Unsubscribe all
    for (const [id] of this.subscriptions) {
      await this.unsubscribe(id);
    }

    // Close connection
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'Normal closure');
    }

    this.ws = null;
    this.stats.connected = false;

    console.log('[GoldskyAdapter] ✅ Disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.stats.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Subscribe to trade events for a specific token
   */
  async subscribeToTrades(
    tokenAddress: string,
    callback: (trade: TradeEvent) => void,
  ): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Goldsky');
    }

    const subscriptionId = this.getNextSubscriptionId();

    const query = `
      subscription TradeEvents($tokenAddress: String!) {
        trades(
          where: { tokenAddress: $tokenAddress }
          orderBy: timestamp
          orderDirection: desc
        ) {
          id
          tokenAddress
          trader
          isBuy
          tokenAmount
          acesAmount
          pricePerToken
          priceUsd
          supply
          timestamp
          blockNumber
          transactionHash
        }
      }
    `;

    console.log('[GoldskyAdapter] 📥 Subscribing to trades for:', tokenAddress);

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      query,
      variables: { tokenAddress: tokenAddress.toLowerCase() },
      callback: (data) => {
        if (data.trades) {
          for (const trade of data.trades) {
            const tradeEvent: TradeEvent = {
              ...trade,
              dataSource: 'goldsky',
            };
            callback(tradeEvent);
            this.emitAdapterEvent(AdapterEventType.TRADE, tradeEvent);
          }
        }
      },
    });

    // Send subscription request
    this.sendMessage({
      id: subscriptionId,
      type: 'start',
      payload: {
        query,
        variables: { tokenAddress: tokenAddress.toLowerCase() },
      },
    });

    console.log('[GoldskyAdapter] ✅ Trade subscription active:', subscriptionId);

    return subscriptionId;
  }

  /**
   * Subscribe to bonding status for a specific token
   */
  async subscribeToBondingStatus(
    tokenAddress: string,
    callback: (status: BondingStatusEvent) => void,
  ): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Goldsky');
    }

    const subscriptionId = this.getNextSubscriptionId();

    const query = `
      subscription BondingStatus($tokenAddress: String!) {
        bondedTokens(where: { address: $tokenAddress }) {
          id
          address
          isBonded
          supply
          bondingProgress
          poolAddress
          graduatedAt
        }
      }
    `;

    console.log('[GoldskyAdapter] 📥 Subscribing to bonding status for:', tokenAddress);

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      query,
      variables: { tokenAddress: tokenAddress.toLowerCase() },
      callback: (data) => {
        if (data.bondedTokens) {
          for (const token of data.bondedTokens) {
            const statusEvent: BondingStatusEvent = {
              tokenAddress: token.address,
              isBonded: token.isBonded,
              supply: token.supply,
              bondingProgress: parseFloat(token.bondingProgress) || 0,
              poolAddress: token.poolAddress,
              graduatedAt: token.graduatedAt ? parseInt(token.graduatedAt) : undefined,
            };
            callback(statusEvent);
            this.emitAdapterEvent(AdapterEventType.BONDING_STATUS, statusEvent);
          }
        }
      },
    });

    // Send subscription request
    this.sendMessage({
      id: subscriptionId,
      type: 'start',
      payload: {
        query,
        variables: { tokenAddress: tokenAddress.toLowerCase() },
      },
    });

    console.log('[GoldskyAdapter] ✅ Bonding status subscription active:', subscriptionId);

    return subscriptionId;
  }

  /**
   * Subscribe to all new trades (global)
   */
  async subscribeToAllTrades(callback: (trade: TradeEvent) => void): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Goldsky');
    }

    const subscriptionId = this.getNextSubscriptionId();

    const query = `
      subscription AllTrades {
        trades(orderBy: timestamp, orderDirection: desc, first: 100) {
          id
          tokenAddress
          trader
          isBuy
          tokenAmount
          acesAmount
          pricePerToken
          priceUsd
          supply
          timestamp
          blockNumber
          transactionHash
        }
      }
    `;

    console.log('[GoldskyAdapter] 📥 Subscribing to all trades');

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      query,
      callback: (data) => {
        if (data.trades) {
          for (const trade of data.trades) {
            const tradeEvent: TradeEvent = {
              ...trade,
              dataSource: 'goldsky',
            };
            callback(tradeEvent);
            this.emitAdapterEvent(AdapterEventType.TRADE, tradeEvent);
          }
        }
      },
    });

    // Send subscription request
    this.sendMessage({
      id: subscriptionId,
      type: 'start',
      payload: { query },
    });

    console.log('[GoldskyAdapter] ✅ All trades subscription active:', subscriptionId);

    return subscriptionId;
  }

  /**
   * Unsubscribe from a subscription
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      console.warn('[GoldskyAdapter] Subscription not found:', subscriptionId);
      return;
    }

    // Send stop message
    if (this.isConnected()) {
      this.sendMessage({
        id: subscriptionId,
        type: 'stop',
      });
    }

    this.subscriptions.delete(subscriptionId);
    console.log('[GoldskyAdapter] ✅ Unsubscribed:', subscriptionId);
  }

  /**
   * Get stats
   */
  getStats(): AdapterStats {
    return {
      ...this.stats,
      connectionUptime: this.stats.connected ? Date.now() - this.stats.connectedAt : 0,
    };
  }

  /**
   * Send message to Goldsky
   */
  private sendMessage(message: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[GoldskyAdapter] Cannot send message: not connected');
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    this.stats.messagesReceived++;
    this.stats.lastMessageAt = Date.now();

    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'connection_ack':
          console.log('[GoldskyAdapter] Connection acknowledged');
          break;

        case 'data':
          // Handle subscription data
          if (message.id && message.payload?.data) {
            const subscription = this.subscriptions.get(message.id);
            if (subscription) {
              subscription.callback(message.payload.data);
            }
          }
          break;

        case 'error':
          console.error('[GoldskyAdapter] Subscription error:', message.payload);
          this.stats.errors++;
          this.emit('subscription_error', message.payload);
          break;

        case 'complete':
          console.log('[GoldskyAdapter] Subscription complete:', message.id);
          break;

        case 'ka':
          // Keep-alive
          break;

        default:
          console.log('[GoldskyAdapter] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[GoldskyAdapter] Error parsing message:', error);
      this.stats.errors++;
    }
  }

  /**
   * Start ping interval
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        this.sendMessage({ type: 'ping' });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Get next subscription ID
   */
  private getNextSubscriptionId(): string {
    this.subscriptionIdCounter++;
    return `goldsky_${this.subscriptionIdCounter}`;
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.isReconnecting) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[GoldskyAdapter] Max reconnection attempts reached');
      this.emit('reconnect_failed');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 30000);

    console.log(
      `[GoldskyAdapter] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();

        // Resubscribe to all active subscriptions
        await this.resubscribeAll();

        this.isReconnecting = false;
        console.log('[GoldskyAdapter] ✅ Reconnected successfully');
      } catch (error) {
        console.error('[GoldskyAdapter] Reconnection failed:', error);
        this.isReconnecting = false;
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * Resubscribe to all active subscriptions after reconnect
   */
  private async resubscribeAll(): Promise<void> {
    console.log('[GoldskyAdapter] Resubscribing to all active subscriptions...');

    const subs = Array.from(this.subscriptions.values());

    for (const sub of subs) {
      this.sendMessage({
        id: sub.id,
        type: 'start',
        payload: {
          query: sub.query,
          variables: sub.variables,
        },
      });
    }

    console.log(`[GoldskyAdapter] ✅ Resubscribed to ${subs.length} subscriptions`);
  }

  /**
   * Emit adapter event
   */
  private emitAdapterEvent(type: AdapterEventType, data: any): void {
    const event: AdapterEvent = {
      type,
      data,
      timestamp: Date.now(),
      source: 'Goldsky',
    };

    this.emit('adapter_event', event);
    this.stats.messagesEmitted++;
  }
}

