/**
 * QuickNode WebSocket Adapter
 * US-2.4: Real-time blockchain data via QuickNode WebSocket
 *
 * Provides:
 * - eth_subscribe for logs (contract events)
 * - eth_subscribe for newHeads (new blocks)
 * - No rate limits (paid service)
 * - Foundation for Aerodrome pool monitoring
 */

import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import {
  BaseAdapter,
  AdapterStats,
  BlockchainLogEvent,
  BlockHeaderEvent,
  AdapterEventType,
  AdapterEvent,
} from '../../types/adapters';

interface LogSubscription {
  id: string;
  filter: ethers.Filter;
  callback: (log: ethers.Log) => void;
}

export class QuickNodeAdapter extends EventEmitter implements BaseAdapter {
  private provider: ethers.WebSocketProvider | null = null;
  private wsUrl: string;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isReconnecting = false;

  // Stats
  private stats = {
    name: 'QuickNode',
    connected: false,
    messagesReceived: 0,
    messagesEmitted: 0,
    errors: 0,
    lastMessageAt: null as number | null,
    connectionUptime: 0,
    connectedAt: 0,
  };

  // Subscriptions
  private logSubscriptions = new Map<string, LogSubscription>();
  private blockSubscriptionActive = false;

  constructor(wsUrl?: string) {
    super();
    this.wsUrl = wsUrl || process.env.QUICKNODE_WS_URL || '';

    if (!this.wsUrl) {
      throw new Error(
        'QuickNode WebSocket URL required. Set QUICKNODE_WS_URL environment variable.',
      );
    }

    console.log('[QuickNodeAdapter] Initialized with URL:', this.wsUrl.substring(0, 40) + '...');
  }

  /**
   * Connect to QuickNode WebSocket
   */
  async connect(): Promise<void> {
    if (this.provider) {
      console.warn('[QuickNodeAdapter] Already connected');
      return;
    }

    try {
      console.log('[QuickNodeAdapter] 🔌 Connecting to QuickNode...');

      this.provider = new ethers.WebSocketProvider(this.wsUrl);

      // Test connection
      const network = await this.provider.getNetwork();
      console.log(`[QuickNodeAdapter] ✅ Connected to network: ${network.name} (${network.chainId})`);

      this.stats.connected = true;
      this.stats.connectedAt = Date.now();
      this.reconnectAttempts = 0;

      // Set up event handlers
      this.setupEventHandlers();

      // Emit connected event
      this.emit('connected');
      this.emitAdapterEvent(AdapterEventType.CONNECTED, {
        network: network.name,
        chainId: network.chainId.toString(),
      });
    } catch (error) {
      console.error('[QuickNodeAdapter] ❌ Connection failed:', error);
      this.stats.connected = false;
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Disconnect from QuickNode
   */
  async disconnect(): Promise<void> {
    if (!this.provider) return;

    console.log('[QuickNodeAdapter] Disconnecting...');

    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Unsubscribe from all
    this.logSubscriptions.clear();
    this.blockSubscriptionActive = false;

    // Destroy provider
    await this.provider.destroy();
    this.provider = null;

    this.stats.connected = false;

    console.log('[QuickNodeAdapter] ✅ Disconnected');
    this.emit('disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.stats.connected && this.provider !== null;
  }

  /**
   * Subscribe to contract logs (events)
   */
  async subscribeLogs(
    filter: ethers.Filter,
    callback: (log: ethers.Log) => void,
  ): Promise<string> {
    if (!this.provider) {
      throw new Error('Not connected to QuickNode');
    }

    const subscriptionId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('[QuickNodeAdapter] 📥 Subscribing to logs:', {
      subscriptionId,
      address: filter.address,
      topics: filter.topics,
    });

    // Store subscription
    this.logSubscriptions.set(subscriptionId, {
      id: subscriptionId,
      filter,
      callback,
    });

    // Subscribe via provider
    this.provider.on(filter, (log) => {
      this.stats.messagesReceived++;
      this.stats.lastMessageAt = Date.now();

      try {
        callback(log);

        // Emit adapter event
        this.emitAdapterEvent(AdapterEventType.LOG, this.normalizeLog(log));
      } catch (error) {
        console.error('[QuickNodeAdapter] Error in log callback:', error);
        this.stats.errors++;
      }
    });

    console.log('[QuickNodeAdapter] ✅ Log subscription active:', subscriptionId);

    return subscriptionId;
  }

  /**
   * Unsubscribe from logs
   */
  async unsubscribeLogs(subscriptionId: string): Promise<void> {
    const subscription = this.logSubscriptions.get(subscriptionId);
    if (!subscription) {
      console.warn('[QuickNodeAdapter] Subscription not found:', subscriptionId);
      return;
    }

    if (this.provider) {
      this.provider.off(subscription.filter, subscription.callback as any);
    }

    this.logSubscriptions.delete(subscriptionId);
    console.log('[QuickNodeAdapter] ✅ Unsubscribed:', subscriptionId);
  }

  /**
   * Subscribe to new blocks
   */
  async subscribeNewBlocks(callback: (block: ethers.Block) => void): Promise<void> {
    if (!this.provider) {
      throw new Error('Not connected to QuickNode');
    }

    if (this.blockSubscriptionActive) {
      console.warn('[QuickNodeAdapter] Block subscription already active');
      return;
    }

    console.log('[QuickNodeAdapter] 📥 Subscribing to new blocks...');

    this.provider.on('block', async (blockNumber) => {
      this.stats.messagesReceived++;
      this.stats.lastMessageAt = Date.now();

      try {
        const block = await this.provider!.getBlock(blockNumber);
        if (block) {
          callback(block);

          // Emit adapter event
          this.emitAdapterEvent(AdapterEventType.BLOCK, {
            number: block.number.toString(),
            hash: block.hash,
            parentHash: block.parentHash,
            timestamp: block.timestamp.toString(),
          });
        }
      } catch (error) {
        console.error('[QuickNodeAdapter] Error fetching block:', error);
        this.stats.errors++;
      }
    });

    this.blockSubscriptionActive = true;
    console.log('[QuickNodeAdapter] ✅ Block subscription active');
  }

  /**
   * Unsubscribe from new blocks
   */
  async unsubscribeNewBlocks(): Promise<void> {
    if (!this.provider || !this.blockSubscriptionActive) return;

    this.provider.off('block');
    this.blockSubscriptionActive = false;
    console.log('[QuickNodeAdapter] ✅ Block subscription stopped');
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    if (!this.provider) {
      throw new Error('Not connected to QuickNode');
    }

    return await this.provider.getBlockNumber();
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
   * Setup event handlers for provider
   */
  private setupEventHandlers(): void {
    if (!this.provider) return;

    // Handle errors
    this.provider.on('error', (error) => {
      console.error('[QuickNodeAdapter] Provider error:', error);
      this.stats.errors++;
      this.emit('error', error);
    });

    // Handle network changes
    this.provider.on('network', (newNetwork, oldNetwork) => {
      if (oldNetwork) {
        console.log(
          `[QuickNodeAdapter] Network changed: ${oldNetwork.name} → ${newNetwork.name}`,
        );
      }
    });

    // Handle close event (WebSocket closed)
    (this.provider as any)._websocket?.on('close', () => {
      console.warn('[QuickNodeAdapter] WebSocket closed unexpectedly');
      this.stats.connected = false;
      this.scheduleReconnect();
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.isReconnecting) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[QuickNodeAdapter] Max reconnection attempts reached');
      this.emit('reconnect_failed');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 30000);

    console.log(
      `[QuickNodeAdapter] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.disconnect();
        await this.connect();

        // Resubscribe to all logs
        await this.resubscribeAll();

        this.isReconnecting = false;
        console.log('[QuickNodeAdapter] ✅ Reconnected successfully');
      } catch (error) {
        console.error('[QuickNodeAdapter] Reconnection failed:', error);
        this.isReconnecting = false;
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * Resubscribe to all active subscriptions after reconnect
   */
  private async resubscribeAll(): Promise<void> {
    console.log('[QuickNodeAdapter] Resubscribing to all active subscriptions...');

    // Resubscribe logs
    const logSubs = Array.from(this.logSubscriptions.values());
    for (const sub of logSubs) {
      await this.subscribeLogs(sub.filter, sub.callback);
    }

    // Resubscribe blocks if active
    if (this.blockSubscriptionActive) {
      this.blockSubscriptionActive = false; // Reset flag
      // Note: Original callback is lost; subscribers should re-register
      console.warn('[QuickNodeAdapter] Block subscription needs to be re-registered');
    }

    console.log(`[QuickNodeAdapter] ✅ Resubscribed to ${logSubs.length} log subscriptions`);
  }

  /**
   * Normalize ethers.Log to our format
   */
  private normalizeLog(log: ethers.Log): BlockchainLogEvent {
    return {
      address: log.address,
      topics: [...log.topics], // Convert readonly array to mutable array
      data: log.data,
      blockNumber: log.blockNumber.toString(),
      transactionHash: log.transactionHash,
      logIndex: log.index.toString(),
      removed: log.removed,
    };
  }

  /**
   * Emit adapter event
   */
  private emitAdapterEvent(type: AdapterEventType, data: any): void {
    const event: AdapterEvent = {
      type,
      data,
      timestamp: Date.now(),
      source: 'QuickNode',
    };

    this.emit('adapter_event', event);
    this.stats.messagesEmitted++;
  }
}

