/**
 * Aerodrome DEX Real-Time Pool Data Adapter
 * US-2.3: Monitor pool reserves via QuickNode Sync events
 *
 * Provides:
 * - Real-time pool reserve updates (via Sync events)
 * - Price calculations from reserves
 * - Liquidity monitoring
 * - Depends on QuickNodeAdapter for blockchain events
 */

import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { QuickNodeAdapter } from './quicknode-adapter';
import {
  BaseAdapter,
  AdapterStats,
  PoolStateEvent,
  AdapterEventType,
  AdapterEvent,
} from '../../types/adapters';

// Aerodrome Sync event signature (Uniswap V2 compatible)
const SYNC_EVENT_SIGNATURE = ethers.id('Sync(uint112,uint112)');

interface PoolSubscription {
  poolAddress: string;
  tokenAddress: string;
  subscriptionId: string;
}

/**
 * Aerodrome DEX Adapter
 */
export class AerodromeAdapter extends EventEmitter implements BaseAdapter {
  private quickNode: QuickNodeAdapter;
  private poolSubscriptions = new Map<string, PoolSubscription>();

  // In-memory cache of latest pool states (key = poolAddress.toLowerCase())
  private poolStateCache = new Map<string, PoolStateEvent>();

  // Stats
  private stats = {
    name: 'Aerodrome',
    connected: false,
    messagesReceived: 0,
    messagesEmitted: 0,
    errors: 0,
    lastMessageAt: null as number | null,
    connectionUptime: 0,
    connectedAt: 0,
  };

  constructor(quickNodeAdapter: QuickNodeAdapter) {
    super();
    this.quickNode = quickNodeAdapter;

    console.log('[AerodromeAdapter] Initialized');
  }

  /**
   * Connect (depends on QuickNode connection)
   */
  async connect(): Promise<void> {
    if (!this.quickNode.isConnected()) {
      throw new Error('QuickNode adapter must be connected first');
    }

    console.log('[AerodromeAdapter] ✅ Connected (via QuickNode)');
    this.stats.connected = true;
    this.stats.connectedAt = Date.now();

    this.emit('connected');
    this.emitAdapterEvent(AdapterEventType.CONNECTED, {});
  }

  /**
   * Disconnect
   */
  async disconnect(): Promise<void> {
    console.log('[AerodromeAdapter] Disconnecting...');

    // Unsubscribe from all pools
    for (const [, sub] of this.poolSubscriptions) {
      await this.quickNode.unsubscribeLogs(sub.subscriptionId);
    }

    this.poolSubscriptions.clear();
    this.stats.connected = false;

    console.log('[AerodromeAdapter] ✅ Disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.stats.connected && this.quickNode.isConnected();
  }

  /**
   * Subscribe to pool reserve updates
   */
  async subscribeToPool(
    poolAddress: string,
    tokenAddress: string,
    callback: (poolState: PoolStateEvent) => void,
  ): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Aerodrome (QuickNode required)');
    }

    console.log('[AerodromeAdapter] 📥 Subscribing to pool:', poolAddress);

    // Create filter for Sync events on this pool
    const filter: ethers.Filter = {
      address: poolAddress,
      topics: [SYNC_EVENT_SIGNATURE],
    };

    // Subscribe via QuickNode
    const subscriptionId = await this.quickNode.subscribeLogs(filter, async (log) => {
      this.stats.messagesReceived++;
      this.stats.lastMessageAt = Date.now();

      try {
        // Decode Sync event: Sync(uint112 reserve0, uint112 reserve1)
        const iface = new ethers.Interface([
          'event Sync(uint112 reserve0, uint112 reserve1)',
        ]);

        const decoded = iface.decodeEventLog('Sync', log.data, log.topics);

        // Calculate prices (assuming token is token0 or token1)
        // Price of token0 in terms of token1: reserve1 / reserve0
        // Price of token1 in terms of token0: reserve0 / reserve1

        const reserve0 = decoded.reserve0.toString();
        const reserve1 = decoded.reserve1.toString();

        // Convert to BigNumber for price calculation
        const reserve0BN = ethers.parseUnits(reserve0, 0);
        const reserve1BN = ethers.parseUnits(reserve1, 0);

        // Calculate prices (18 decimals precision)
        const priceToken0 =
          reserve0BN > 0n
            ? ((reserve1BN * ethers.parseUnits('1', 18)) / reserve0BN).toString()
            : '0';
        const priceToken1 =
          reserve1BN > 0n
            ? ((reserve0BN * ethers.parseUnits('1', 18)) / reserve1BN).toString()
            : '0';

        const poolState: PoolStateEvent = {
          poolAddress: log.address,
          tokenAddress,
          reserve0,
          reserve1,
          priceToken0,
          priceToken1,
          blockNumber: log.blockNumber,
          timestamp: Date.now() / 1000, // Current timestamp (Sync event doesn't include it)
          dataSource: 'aerodrome',
        };

        // Cache the latest pool state for REST API access
        this.poolStateCache.set(log.address.toLowerCase(), poolState);

        callback(poolState);
        this.emitAdapterEvent(AdapterEventType.POOL_STATE, poolState);
      } catch (error) {
        console.error('[AerodromeAdapter] Error decoding Sync event:', error);
        this.stats.errors++;
      }
    });

    // Store subscription
    const subKey = `${poolAddress}_${tokenAddress}`;
    this.poolSubscriptions.set(subKey, {
      poolAddress,
      tokenAddress,
      subscriptionId,
    });

    console.log('[AerodromeAdapter] ✅ Pool subscription active:', subKey);

    return subKey;
  }

  /**
   * Unsubscribe from pool
   */
  async unsubscribeFromPool(poolAddress: string, tokenAddress: string): Promise<void> {
    const subKey = `${poolAddress}_${tokenAddress}`;
    const subscription = this.poolSubscriptions.get(subKey);

    if (!subscription) {
      console.warn('[AerodromeAdapter] Pool subscription not found:', subKey);
      return;
    }

    await this.quickNode.unsubscribeLogs(subscription.subscriptionId);
    this.poolSubscriptions.delete(subKey);

    console.log('[AerodromeAdapter] ✅ Unsubscribed from pool:', subKey);
  }

  /**
   * Get cached pool state from latest Sync event
   */
  getCachedPoolState(poolAddress: string): PoolStateEvent | null {
    const cached = this.poolStateCache.get(poolAddress.toLowerCase());
    return cached || null;
  }

  /**
   * Get current pool reserves (one-time query)
   */
  async getPoolReserves(poolAddress: string): Promise<{
    reserve0: string;
    reserve1: string;
    blockNumber: number;
  }> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Aerodrome (QuickNode required)');
    }

    // Get provider from QuickNode adapter
    const provider = (this.quickNode as any).provider;
    if (!provider) {
      throw new Error('QuickNode provider not available');
    }

    // Call getReserves() on the pool contract
    const poolContract = new ethers.Contract(
      poolAddress,
      [
        'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
      ],
      provider,
    );

    const [reserve0, reserve1] = await poolContract.getReserves();
    const blockNumber = await provider.getBlockNumber();

    return {
      reserve0: reserve0.toString(),
      reserve1: reserve1.toString(),
      blockNumber,
    };
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
   * Emit adapter event
   */
  private emitAdapterEvent(type: AdapterEventType, data: any): void {
    const event: AdapterEvent = {
      type,
      data,
      timestamp: Date.now(),
      source: 'Aerodrome',
    };

    this.emit('adapter_event', event);
    this.stats.messagesEmitted++;
  }
}

