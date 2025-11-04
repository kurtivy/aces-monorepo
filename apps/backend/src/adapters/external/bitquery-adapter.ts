/**
 * BitQuery WebSocket Adapter
 * US-2.2: Real-time DEX trade data for TradingView charts
 *
 * Provides:
 * - Real-time DEX trades (Base network)
 * - OHLCV data aggregation
 * - Multi-timeframe support (1m, 5m, 15m, 1h, 4h, 1d)
 * - Rate limit: 100 requests/minute (streaming subscription counts as 1)
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import {
  BaseAdapter,
  AdapterStats,
  TradeEvent,
  CandleData,
  AdapterEventType,
  AdapterEvent,
} from '../../types/adapters';

interface BitQueryConfig {
  wsUrl: string;
  apiKey: string;
}

interface BitQuerySubscription {
  id: string;
  query: string;
  variables?: Record<string, any>;
  callback: (data: any) => void;
}

/**
 * BitQuery WebSocket Adapter
 */
export class BitQueryAdapter extends EventEmitter implements BaseAdapter {
  private ws: WebSocket | null = null;
  private config: BitQueryConfig;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isReconnecting = false;
  private pingInterval: NodeJS.Timeout | null = null;

  // Stats
  private stats = {
    name: 'BitQuery',
    connected: false,
    messagesReceived: 0,
    messagesEmitted: 0,
    errors: 0,
    lastMessageAt: null as number | null,
    connectionUptime: 0,
    connectedAt: 0,
  };

  // Subscriptions
  private subscriptions = new Map<string, BitQuerySubscription>();
  private subscriptionIdCounter = 0;

  constructor(config?: Partial<BitQueryConfig>) {
    super();
    this.config = {
      wsUrl: config?.wsUrl || process.env.BITQUERY_WS_URL || 'wss://streaming.bitquery.io/graphql',
      apiKey: config?.apiKey || process.env.BITQUERY_API_KEY || '',
    };

    if (!this.config.apiKey) {
      throw new Error(
        'BitQuery API key required. Set BITQUERY_API_KEY environment variable.',
      );
    }

    console.log('[BitQueryAdapter] Initialized');
  }

  /**
   * Connect to BitQuery WebSocket
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.warn('[BitQueryAdapter] Already connected');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('[BitQueryAdapter] 🔌 Connecting to BitQuery...');

        // Create WebSocket connection with auth header
        this.ws = new WebSocket(this.config.wsUrl, {
          headers: {
            'X-API-KEY': this.config.apiKey,
          },
        });

        // Handle open
        this.ws.onopen = () => {
          console.log('[BitQueryAdapter] ✅ Connected');
          this.stats.connected = true;
          this.stats.connectedAt = Date.now();
          this.reconnectAttempts = 0;

          // Send connection init
          this.sendMessage({
            type: 'connection_init',
            payload: {
              headers: {
                'X-API-KEY': this.config.apiKey,
              },
            },
          });

          // Start ping interval
          this.startPingInterval();

          this.emit('connected');
          this.emitAdapterEvent(AdapterEventType.CONNECTED, {});

          resolve();
        };

        // Handle messages
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data.toString());
        };

        // Handle errors
        this.ws.onerror = (error) => {
          console.error('[BitQueryAdapter] WebSocket error:', error);
          this.stats.errors++;
          this.emit('error', error);
          reject(error);
        };

        // Handle close
        this.ws.onclose = (event) => {
          console.warn(
            `[BitQueryAdapter] WebSocket closed: ${event.code} ${event.reason}`,
          );
          this.stats.connected = false;
          this.stopPingInterval();

          if (!event.wasClean) {
            this.scheduleReconnect();
          }

          this.emit('disconnected', event);
        };
      } catch (error) {
        console.error('[BitQueryAdapter] Connection failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from BitQuery
   */
  async disconnect(): Promise<void> {
    if (!this.ws) return;

    console.log('[BitQueryAdapter] Disconnecting...');

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

    console.log('[BitQueryAdapter] ✅ Disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.stats.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Subscribe to DEX trades for a specific token pair
   */
  async subscribeToDexTrades(
    tokenAddress: string,
    callback: (trade: TradeEvent) => void,
  ): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Not connected to BitQuery');
    }

    const subscriptionId = this.getNextSubscriptionId();

    // BitQuery GraphQL subscription for DEX trades on Base
    const query = `
      subscription DexTrades($token: String!) {
        EVM(network: base) {
          DEXTrades(
            where: {
              Trade: {
                Currency: { SmartContract: { is: $token } }
              }
            }
          ) {
            Block {
              Number
              Time
            }
            Transaction {
              Hash
            }
            Trade {
              Buyer
              Seller
              Currency {
                SmartContract
                Symbol
              }
              Amount
              Price
              AmountInUSD
              Side {
                Currency {
                  SmartContract
                  Symbol
                }
                Amount
              }
            }
          }
        }
      }
    `;

    console.log('[BitQueryAdapter] 📥 Subscribing to DEX trades for:', tokenAddress);

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      query,
      variables: { token: tokenAddress.toLowerCase() },
      callback: (data) => {
        if (data.EVM?.DEXTrades) {
          for (const trade of data.EVM.DEXTrades) {
            const tradeEvent: TradeEvent = {
              id: trade.Transaction.Hash,
              tokenAddress: trade.Trade.Currency.SmartContract,
              trader: trade.Trade.Buyer || trade.Trade.Seller,
              isBuy: !!trade.Trade.Buyer,
              tokenAmount: trade.Trade.Amount,
              acesAmount: trade.Trade.Side.Amount,
              pricePerToken: trade.Trade.Price.toString(),
              priceUsd: trade.Trade.AmountInUSD?.toString(),
              supply: '0', // Not available in BitQuery
              timestamp: new Date(trade.Block.Time).getTime() / 1000,
              blockNumber: trade.Block.Number,
              transactionHash: trade.Transaction.Hash,
              dataSource: 'bitquery',
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
        variables: { token: tokenAddress.toLowerCase() },
      },
    });

    console.log('[BitQueryAdapter] ✅ DEX trade subscription active:', subscriptionId);

    return subscriptionId;
  }

  /**
   * Subscribe to OHLCV candles for a specific token pair
   */
  async subscribeToCandles(
    tokenAddress: string,
    timeframe: string,
    callback: (candle: CandleData) => void,
  ): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Not connected to BitQuery');
    }

    const subscriptionId = this.getNextSubscriptionId();

    // Convert timeframe to seconds for aggregation
    const intervalSeconds = this.getTimeframeSeconds(timeframe);

    const query = `
      subscription OHLCVCandles($token: String!, $interval: Int!) {
        EVM(network: base) {
          DEXTradeByTokens(
            where: {
              Trade: {
                Currency: { SmartContract: { is: $token } }
              }
            }
            orderBy: { descending: Block_Time }
            limit: { count: 1 }
          ) {
            Block {
              Time(interval: { in: seconds, count: $interval })
            }
            Trade {
              open: Price(minimum: Block_Number)
              high: Price(maximum: Block_Number)
              low: Price(minimum: Block_Number)
              close: Price(maximum: Block_Number)
              volume: Amount(sum: Block_Number)
              trades: count
            }
          }
        }
      }
    `;

    console.log('[BitQueryAdapter] 📥 Subscribing to OHLCV candles:', tokenAddress, timeframe);

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      query,
      variables: { token: tokenAddress.toLowerCase(), interval: intervalSeconds },
      callback: (data) => {
        if (data.EVM?.DEXTradeByTokens) {
          for (const candle of data.EVM.DEXTradeByTokens) {
            const candleData: CandleData = {
              timestamp: new Date(candle.Block.Time).getTime() / 1000,
              timeframe,
              open: candle.Trade.open?.toString() || '0',
              high: candle.Trade.high?.toString() || '0',
              low: candle.Trade.low?.toString() || '0',
              close: candle.Trade.close?.toString() || '0',
              volume: candle.Trade.volume?.toString() || '0',
              trades: candle.Trade.trades || 0,
              dataSource: 'bitquery',
            };
            callback(candleData);
            this.emitAdapterEvent(AdapterEventType.CANDLE, candleData);
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
        variables: { token: tokenAddress.toLowerCase(), interval: intervalSeconds },
      },
    });

    console.log('[BitQueryAdapter] ✅ Candle subscription active:', subscriptionId);

    return subscriptionId;
  }

  /**
   * Unsubscribe from a subscription
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      console.warn('[BitQueryAdapter] Subscription not found:', subscriptionId);
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
    console.log('[BitQueryAdapter] ✅ Unsubscribed:', subscriptionId);
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
   * Send message to BitQuery
   */
  private sendMessage(message: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[BitQueryAdapter] Cannot send message: not connected');
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
          console.log('[BitQueryAdapter] Connection acknowledged');
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
          console.error('[BitQueryAdapter] Subscription error:', message.payload);
          this.stats.errors++;
          this.emit('subscription_error', message.payload);
          break;

        case 'complete':
          console.log('[BitQueryAdapter] Subscription complete:', message.id);
          break;

        case 'ka':
          // Keep-alive
          break;

        default:
          console.log('[BitQueryAdapter] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[BitQueryAdapter] Error parsing message:', error);
      this.stats.errors++;
    }
  }

  /**
   * Convert timeframe string to seconds
   */
  private getTimeframeSeconds(timeframe: string): number {
    const timeframeMap: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
    };

    return timeframeMap[timeframe] || 60;
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
    return `bitquery_${this.subscriptionIdCounter}`;
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.isReconnecting) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[BitQueryAdapter] Max reconnection attempts reached');
      this.emit('reconnect_failed');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 30000);

    console.log(
      `[BitQueryAdapter] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();

        // Resubscribe to all active subscriptions
        await this.resubscribeAll();

        this.isReconnecting = false;
        console.log('[BitQueryAdapter] ✅ Reconnected successfully');
      } catch (error) {
        console.error('[BitQueryAdapter] Reconnection failed:', error);
        this.isReconnecting = false;
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * Resubscribe to all active subscriptions after reconnect
   */
  private async resubscribeAll(): Promise<void> {
    console.log('[BitQueryAdapter] Resubscribing to all active subscriptions...');

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

    console.log(`[BitQueryAdapter] ✅ Resubscribed to ${subs.length} subscriptions`);
  }

  /**
   * Emit adapter event
   */
  private emitAdapterEvent(type: AdapterEventType, data: any): void {
    const event: AdapterEvent = {
      type,
      data,
      timestamp: Date.now(),
      source: 'BitQuery',
    };

    this.emit('adapter_event', event);
    this.stats.messagesEmitted++;
  }
}

