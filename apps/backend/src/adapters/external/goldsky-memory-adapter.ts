/**
 * Goldsky Memory Adapter
 * Phase 3 - Reads from in-memory store and broadcasts to WebSocket clients
 * 
 * Works with Goldsky webhook sink → memory store → WebSocket
 */

import { EventEmitter } from 'events';
import { BaseAdapter, AdapterEventType } from '../../types/adapters';
import { TradeEvent, BondingStatusEvent } from '../../types/adapters';
import { getMemoryStore, GoldskyMemoryStore } from '../../services/goldsky-memory-store';

/**
 * Goldsky Memory Adapter
 * Subscribes to in-memory store events and broadcasts to clients
 */
export class GoldskyMemoryAdapter extends EventEmitter implements BaseAdapter {
  private memoryStore: GoldskyMemoryStore;
  private isActive = false;

  // Stats
  private stats = {
    name: 'Goldsky (Memory)',
    connected: false,
    messagesReceived: 0,
    messagesEmitted: 0,
    errors: 0,
    lastMessageAt: null as number | null,
    connectionUptime: 0,
    connectedAt: 0,
  };

  // Track subscriptions
  private subscriptions = new Map<
    string,
    {
      type: 'trades' | 'bonding';
      tokenAddress: string;
      callback: (data: any) => void;
      listener: (data: any) => void;
    }
  >();

  constructor() {
    super();
    this.memoryStore = getMemoryStore();
    
    console.log('[GoldskyMemory] Initialized (in-memory store)');
  }

  /**
   * Connect (start listening to memory store events)
   */
  async connect(): Promise<void> {
    if (this.isActive) {
      console.warn('[GoldskyMemory] Already connected');
      return;
    }

    console.log('[GoldskyMemory] 🔌 Connecting to memory store...');
    this.isActive = true;
    this.stats.connected = true;
    this.stats.connectedAt = Date.now();

    this.emit('connected');
    this.emitAdapterEvent(AdapterEventType.CONNECTED, {});

    console.log('[GoldskyMemory] ✅ Connected to memory store');
  }

  /**
   * Disconnect (stop listening)
   */
  async disconnect(): Promise<void> {
    console.log('[GoldskyMemory] 🔌 Disconnecting...');
    this.isActive = false;
    this.stats.connected = false;

    // Unsubscribe all
    for (const [id, sub] of this.subscriptions.entries()) {
      this.memoryStore.off(sub.type === 'trades' ? 'trade' : 'bonding', sub.listener);
    }

    this.subscriptions.clear();
    this.emit('disconnected');
    
    console.log('[GoldskyMemory] ✅ Disconnected');
  }

  /**
   * Subscribe to trades for a token
   * Guarantees sequential, time-ordered delivery
   */
  async subscribeToTrades(
    tokenAddress: string,
    callback: (trade: TradeEvent) => void,
  ): Promise<string> {
    const subscriptionId = `trades-${tokenAddress}-${Date.now()}`;

    console.log(`[GoldskyMemory] 📊 Subscribing to trades: ${tokenAddress}`);

    // Track sequence number for this subscription to guarantee order
    let sequenceNumber = 0;

    // Create listener that filters by token address
    const listener = (trade: TradeEvent) => {
      if (trade.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()) {
        // Add sequence number to guarantee order
        const tradeWithSequence = {
          ...trade,
          sequenceNumber: ++sequenceNumber,
        };
        
        callback(tradeWithSequence as any);
        this.stats.messagesEmitted++;
        this.stats.lastMessageAt = Date.now();
      }
    };

    // Subscribe to memory store events
    this.memoryStore.on('trade', listener);

    this.subscriptions.set(subscriptionId, {
      type: 'trades',
      tokenAddress,
      callback,
      listener,
    });

    // Send historical trades immediately (last 100) - IN CHRONOLOGICAL ORDER
    const historicalTrades = this.memoryStore.getTrades(tokenAddress, 100);
    console.log(`[GoldskyMemory] 📚 Sending ${historicalTrades.length} historical trades in chronological order`);
    
    // Trades are already sorted by timestamp in memory store
    for (const trade of historicalTrades) {
      const tradeWithSequence = {
        ...trade,
        sequenceNumber: ++sequenceNumber,
      };
      
      // Send sequentially with small delay to preserve order
      await new Promise(resolve => setTimeout(resolve, 1));
      callback(tradeWithSequence as any);
      this.stats.messagesEmitted++;
    }

    console.log(`[GoldskyMemory] ✅ Sent ${historicalTrades.length} historical trades, starting real-time stream at sequence ${sequenceNumber}`);

    return subscriptionId;
  }

  /**
   * Subscribe to bonding status for a token
   */
  async subscribeToBondingStatus(
    tokenAddress: string,
    callback: (status: BondingStatusEvent) => void,
  ): Promise<string> {
    const subscriptionId = `bonding-${tokenAddress}-${Date.now()}`;

    console.log(`[GoldskyMemory] 📈 Subscribing to bonding status: ${tokenAddress}`);

    // Create listener that filters by token address
    const listener = (status: BondingStatusEvent) => {
      if (status.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()) {
        callback(status);
        this.stats.messagesEmitted++;
        this.stats.lastMessageAt = Date.now();
      }
    };

    // Subscribe to memory store events
    this.memoryStore.on('bonding', listener);

    this.subscriptions.set(subscriptionId, {
      type: 'bonding',
      tokenAddress,
      callback,
      listener,
    });

    // Send current bonding status immediately
    const currentStatus = this.memoryStore.getBondingStatus(tokenAddress);
    if (currentStatus) {
      console.log(`[GoldskyMemory] 📚 Sending current bonding status`);
      callback(currentStatus);
      this.stats.messagesEmitted++;
    }

    return subscriptionId;
  }

  /**
   * Unsubscribe
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) {
      console.warn(`[GoldskyMemory] Subscription not found: ${subscriptionId}`);
      return;
    }

    // Remove listener from memory store
    this.memoryStore.off(sub.type === 'trades' ? 'trade' : 'bonding', sub.listener);

    this.subscriptions.delete(subscriptionId);
    console.log(`[GoldskyMemory] 🛑 Unsubscribed: ${subscriptionId}`);
  }

  /**
   * Get statistics
   */
  getStats() {
    const memoryStats = this.memoryStore.getStats();
    
    return {
      ...this.stats,
      activeSubscriptions: this.subscriptions.size,
      connectionUptime: this.stats.connectedAt ? Date.now() - this.stats.connectedAt : 0,
      memoryStore: memoryStats,
    };
  }

  getLatestBondingStatus(tokenAddress: string): BondingStatusEvent | null {
    return this.memoryStore.getBondingStatus(tokenAddress);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.isActive;
  }

  /**
   * Emit adapter event
   */
  private emitAdapterEvent(type: AdapterEventType, data: any): void {
    this.emit('adapter:event', { type, data, source: 'goldsky' });
  }
}

