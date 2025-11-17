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
import { PrismaClient } from '@prisma/client';
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
  private authFailed = false; // Track authentication failures
  private prisma: PrismaClient; // Database client for storing trades

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

  constructor(config?: Partial<BitQueryConfig>, prisma?: PrismaClient) {
    super();
    this.config = {
      wsUrl: config?.wsUrl || process.env.BITQUERY_WS_URL || 'wss://streaming.bitquery.io/graphql',
      apiKey: config?.apiKey || process.env.BITQUERY_API_KEY || '',
    };

    if (!this.config.apiKey) {
      throw new Error('BitQuery API key required. Set BITQUERY_API_KEY environment variable.');
    }

    // Initialize Prisma client (use provided or create new)
    this.prisma = prisma || new PrismaClient();

    // Note: BitQuery now uses OAuth tokens (starting with "ory_at") as of January 2025
    // OAuth tokens should be passed in the URL query parameter, not headers

    // Log masked API key for debugging (first 8 chars + last 4 chars)
    const maskedKey =
      this.config.apiKey.length > 12
        ? `${this.config.apiKey.substring(0, 8)}...${this.config.apiKey.substring(
            this.config.apiKey.length - 4,
          )}`
        : '***';
    console.log(`[BitQueryAdapter] Initialized with API key: ${maskedKey}`);
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

        // BitQuery OAuth tokens (starting with "ory_") should be in URL query parameter
        // Legacy API keys use headers
        const isOAuthToken = this.config.apiKey.startsWith('ory_');
        const wsUrl = isOAuthToken
          ? `${this.config.wsUrl}?token=${this.config.apiKey}`
          : this.config.wsUrl;

        // Create WebSocket connection
        // OAuth tokens: use URL query parameter, no headers
        // Legacy keys: use X-API-KEY header
        const wsOptions: any = {};
        if (!isOAuthToken) {
          wsOptions.headers = {
            'X-API-KEY': this.config.apiKey,
          };
        }

        this.ws = new WebSocket(wsUrl, ['graphql-ws'], wsOptions);

        // Handle open
        this.ws.onopen = () => {
          console.log('[BitQueryAdapter] ✅ Connected');
          this.stats.connected = true;
          this.stats.connectedAt = Date.now();
          this.reconnectAttempts = 0;
          this.authFailed = false; // Reset auth failure flag on successful connection

          // Send connection init
          // OAuth tokens don't need headers in connection_init
          const isOAuthToken = this.config.apiKey.startsWith('ory_');
          const initPayload: any = {};
          if (!isOAuthToken) {
            initPayload.headers = {
              'X-API-KEY': this.config.apiKey,
            };
          }

          this.sendMessage({
            type: 'connection_init',
            payload: Object.keys(initPayload).length > 0 ? initPayload : undefined,
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
        this.ws.onerror = (error: any) => {
          // Extract error message from various error formats
          // In Node.js ws library, errors can be Error objects or wrapped ErrorEvent-like objects
          let errorMessage = '';

          // Check for nested error property (common in ws library)
          const actualError = error?.error || error;

          if (actualError instanceof Error) {
            errorMessage = actualError.message;
          } else if (actualError?.message) {
            errorMessage = actualError.message;
          } else if (typeof actualError === 'string') {
            errorMessage = actualError;
          } else {
            errorMessage = String(actualError);
          }

          console.error('[BitQueryAdapter] WebSocket error:', errorMessage);

          // Check for 401 authentication errors
          const isAuthError =
            errorMessage.includes('401') ||
            errorMessage.includes('Unauthorized') ||
            errorMessage.includes('Unexpected server response: 401');

          if (isAuthError) {
            console.error(
              '[BitQueryAdapter] ❌ Authentication failed (401). Invalid API key detected.',
            );
            console.error('[BitQueryAdapter] Please check BITQUERY_API_KEY environment variable.');

            // Check if it's an OAuth token
            if (this.config.apiKey.startsWith('ory_')) {
              console.error(
                '[BitQueryAdapter] ⚠️  OAuth token authentication failed. Please verify:',
              );
              console.error(
                '[BitQueryAdapter]   1. Token is valid and not expired',
                '[BitQueryAdapter]   2. Token has WebSocket streaming permissions',
                '[BitQueryAdapter]   3. Account plan supports streaming subscriptions',
              );
            } else {
              console.error(
                '[BitQueryAdapter] ⚠️  API key format looks correct, but authentication failed.',
              );
              console.error('[BitQueryAdapter] Possible reasons:');
              console.error('[BitQueryAdapter]   1. API key is invalid or expired');
              console.error(
                '[BitQueryAdapter]   2. Account needs activation (sign up at https://graphql.bitquery.io/ide)',
              );
              console.error('[BitQueryAdapter]   3. WebSocket streaming not enabled on your plan');
              console.error(
                '[BitQueryAdapter]   4. Free plan has limited streams (2 simultaneous max)',
              );
            }

            // Don't retry on authentication errors
            this.reconnectAttempts = this.maxReconnectAttempts;
            this.authFailed = true;
            this.emit('auth_failed');
          }

          this.stats.errors++;
          this.emit('error', error);
          reject(error);
        };

        // Handle close
        this.ws.onclose = (event) => {
          // Check if we've already detected an auth error
          if (this.authFailed) {
            console.error('[BitQueryAdapter] ❌ Connection closed due to authentication failure.');
            console.error(
              '[BitQueryAdapter] Stopping reconnection attempts. Please fix BITQUERY_API_KEY.',
            );
            this.emit('disconnected', event);
            return;
          }

          // Detect potential auth errors from close code 1006 (abnormal closure)
          // which often happens with 401 errors during HTTP upgrade
          const isPotentialAuthError = event.code === 1006 && this.reconnectAttempts > 0;

          if (isPotentialAuthError) {
            console.error(
              '[BitQueryAdapter] ❌ Connection closed abnormally (code 1006). This may indicate authentication failure.',
            );
            console.error('[BitQueryAdapter] Please verify BITQUERY_API_KEY is set correctly.');
            // Mark as auth failed to prevent retries
            this.authFailed = true;
            this.reconnectAttempts = this.maxReconnectAttempts;
            this.emit('auth_failed');
          } else {
            console.warn(
              `[BitQueryAdapter] WebSocket closed: ${event.code} ${event.reason || 'No reason provided'}`,
            );
          }

          this.stats.connected = false;
          this.stopPingInterval();

          // Only retry if it wasn't a clean close and not an auth error
          if (!event.wasClean && !this.authFailed) {
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
    // Using DEXTradeByTokens which matches the working query structure
    const query = `
      subscription DexTrades($token: String!) {
        EVM(network: base) {
          DEXTradeByTokens(
            where: {
              Trade: {
                Currency: {
                  SmartContract: { is: $token }
                }
                Price: { gt: 0 }
              }
            }
          ) {
            Block {
              Number
              Time
            }
            Transaction {
              Hash
              From
            }
            Trade {
              Amount
              Price
              Side {
                Type
                Amount
                AmountInUSD
                Currency {
                  SmartContract
                  Symbol
                  Name
                }
              }
              Dex {
                ProtocolName
                ProtocolFamily
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
        console.log('[BitQueryAdapter] 🔔 Subscription callback invoked for:', tokenAddress);
        console.log('[BitQueryAdapter] Data structure:', {
          hasEVM: !!data.EVM,
          hasDEXTradeByTokens: !!data.EVM?.DEXTradeByTokens,
          tradeCount: data.EVM?.DEXTradeByTokens?.length || 0,
          dataKeys: Object.keys(data),
        });

        if (data.EVM?.DEXTradeByTokens) {
          console.log(
            `[BitQueryAdapter] 📊 Processing ${data.EVM.DEXTradeByTokens.length} trades from BitQuery`,
          );

          for (const trade of data.EVM.DEXTradeByTokens) {
            const tradeData = trade.Trade;
            const sideType = tradeData.Side.Type; // "buy" or "sell" (from ACES perspective)

            console.log('[BitQueryAdapter] 🔍 Processing trade:', {
              txHash: trade.Transaction.Hash,
              sideType,
              amountToken: tradeData.Amount,
              amountAces: tradeData.Side.Amount,
              blockNumber: trade.Block.Number,
            });

            // DEXTradeByTokens logic:
            // Trade.Side.Type = "sell" means ACES was sold (token was BOUGHT) → user BOUGHT token
            // Trade.Side.Type = "buy" means ACES was bought (token was SOLD) → user SOLD token
            const isBuy = sideType === 'sell';

            // Extract amounts
            const amountToken = tradeData.Amount || '0';
            const amountAces = tradeData.Side.Amount || '0';

            // Calculate price in USD
            const acesAmountUSD = parseFloat(tradeData.Side.AmountInUSD || '0');
            const tokenAmountNum = parseFloat(amountToken);
            let priceUsd = '0';

            if (tokenAmountNum > 0 && acesAmountUSD > 0) {
              // Price per token = Total USD spent / Token amount
              priceUsd = (acesAmountUSD / tokenAmountNum).toString();
            }

            // Convert timestamp to milliseconds (frontend expects milliseconds)
            const timestampMs = new Date(trade.Block.Time).getTime();

            const tradeEvent: TradeEvent = {
              id: trade.Transaction.Hash,
              tokenAddress: tokenAddress.toLowerCase(),
              trader: trade.Transaction.From,
              isBuy: isBuy,
              tokenAmount: amountToken,
              acesAmount: amountAces,
              pricePerToken: tradeData.Price?.toString() || '0',
              priceUsd: priceUsd,
              supply: '0', // Not available in BitQuery
              timestamp: timestampMs, // Milliseconds (frontend expects this)
              blockNumber: trade.Block.Number,
              transactionHash: trade.Transaction.Hash,
              dataSource: 'bitquery',
            };

            console.log('[BitQueryAdapter] ✅ Emitting trade event:', {
              id: tradeEvent.id,
              tokenAddress: tradeEvent.tokenAddress,
              isBuy: tradeEvent.isBuy,
              tokenAmount: tradeEvent.tokenAmount,
              acesAmount: tradeEvent.acesAmount,
              timestamp: new Date(tradeEvent.timestamp).toISOString(),
            });

            // 🔥 NEW: Store trade in database (async, don't block)
            this.storeTrade(tradeEvent).catch((error) => {
              console.error('[BitQueryAdapter] ❌ Failed to store trade in database:', error);
            });

            callback(tradeEvent);
            this.emitAdapterEvent(AdapterEventType.TRADE, tradeEvent);
          }
        } else {
          console.warn('[BitQueryAdapter] ⚠️ No DEXTradeByTokens in data:', {
            dataKeys: Object.keys(data),
            evmKeys: data.EVM ? Object.keys(data.EVM) : [],
          });
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
   * NOTE: BitQuery subscriptions don't support aggregations like queries do.
   * This method is disabled - use REST API endpoints for candles instead.
   * WebSocket subscriptions are better suited for individual trades.
   */
  async subscribeToCandles(
    tokenAddress: string,
    timeframe: string,
    callback: (candle: CandleData) => void,
  ): Promise<string> {
    throw new Error(
      'BitQuery WebSocket subscriptions do not support OHLCV aggregations. ' +
        'Please use the REST API endpoint /api/v1/chart/:tokenAddress/unified for candles. ' +
        'WebSocket subscriptions are available for individual trades via subscribeToDexTrades().',
    );
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

      // Log all incoming messages for debugging
      console.log('[BitQueryAdapter] 📨 Received message:', {
        type: message.type,
        id: message.id,
        hasPayload: !!message.payload,
      });

      switch (message.type) {
        case 'connection_ack':
          console.log('[BitQueryAdapter] Connection acknowledged');
          break;

        case 'data':
          // Handle subscription data
          console.log('[BitQueryAdapter] 📥 Received data message:', {
            id: message.id,
            hasPayload: !!message.payload,
            hasData: !!message.payload?.data,
            dataKeys: message.payload?.data ? Object.keys(message.payload.data) : [],
          });

          if (message.id && message.payload?.data) {
            const subscription = this.subscriptions.get(message.id);
            if (subscription) {
              const data = message.payload.data;
              console.log('[BitQueryAdapter] 🔍 Processing subscription data:', {
                subscriptionId: message.id,
                dataType: subscription.query.includes('DEXTradeByTokens') ? 'DEX Trades' : 'Other',
                hasEVM: !!data.EVM,
                hasDEXTradeByTokens: !!data.EVM?.DEXTradeByTokens,
                tradeCount: data.EVM?.DEXTradeByTokens?.length || 0,
              });

              // Log full trade data for debugging
              if (data.EVM?.DEXTradeByTokens && data.EVM.DEXTradeByTokens.length > 0) {
                console.log(
                  '[BitQueryAdapter] 📊 Trade data received:',
                  JSON.stringify(data.EVM.DEXTradeByTokens[0], null, 2),
                );
              }

              subscription.callback(data);
              console.log('[BitQueryAdapter] ✅ Callback invoked for subscription:', message.id);
            } else {
              console.warn('[BitQueryAdapter] ⚠️ No subscription found for ID:', message.id);
            }
          } else {
            console.warn('[BitQueryAdapter] ⚠️ Data message missing id or payload.data:', {
              hasId: !!message.id,
              hasPayload: !!message.payload,
              hasData: !!message.payload?.data,
            });
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

        case 'pong':
          // Pong response to our ping
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
    if (this.authFailed) {
      console.error('[BitQueryAdapter] Skipping reconnection - authentication failed');
      return;
    }
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

  /**
   * Store trade in database (upsert to prevent duplicates)
   */
  private async storeTrade(trade: TradeEvent): Promise<void> {
    try {
      // Calculate price in ACES
      const acesAmount = parseFloat(trade.acesAmount);
      const tokenAmount = parseFloat(trade.tokenAmount);
      const priceInAces = tokenAmount > 0 ? acesAmount / tokenAmount : 0;

      await this.prisma.dexTrade.upsert({
        where: {
          txHash_tokenAddress: {
            txHash: trade.transactionHash,
            tokenAddress: trade.tokenAddress.toLowerCase(),
          },
        },
        update: {}, // Don't update if exists (already stored)
        create: {
          txHash: trade.transactionHash,
          tokenAddress: trade.tokenAddress.toLowerCase(),
          timestamp: BigInt(trade.timestamp),
          blockNumber: trade.blockNumber.toString(),
          isBuy: trade.isBuy,
          tokenAmount: trade.tokenAmount,
          acesAmount: trade.acesAmount,
          priceInAces,
          priceInUsd: trade.priceUsd ? parseFloat(trade.priceUsd) : null,
          trader: trade.trader,
          source: 'bitquery',
        },
      });

      console.log('[BitQueryAdapter] 💾 Stored trade in database:', {
        txHash: trade.transactionHash.substring(0, 10) + '...',
        tokenAddress: trade.tokenAddress.substring(0, 10) + '...',
        timestamp: new Date(trade.timestamp).toISOString(),
      });
    } catch (error) {
      // Log error but don't throw (don't break the trade stream)
      console.error('[BitQueryAdapter] ❌ Database storage error:', error);
    }
  }
}
