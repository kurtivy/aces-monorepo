/**
 * Adapter Manager
 * Phase 2 Integration - Coordinates all external adapters
 *
 * Responsibilities:
 * - Initialize all adapters (QuickNode, Goldsky, BitQuery, Aerodrome)
 * - Route adapter events to subscription deduplicator
 * - Provide unified interface for subscribing to data
 * - Handle adapter lifecycle (connect/disconnect/reconnect)
 */

import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { QuickNodeAdapter } from '../../adapters/external/quicknode-adapter';
import { GoldskyMemoryAdapter } from '../../adapters/external/goldsky-memory-adapter'; // 🚀 NEW: Memory-based
import { BitQueryAdapter } from '../../adapters/external/bitquery-adapter';
import { AerodromeAdapter } from '../../adapters/external/aerodrome-adapter';
import { RateLimitEnforcer } from '../websocket/rate-limit-enforcer';
import type { AcesUsdPriceService } from '../aces-usd-price-service';
import {
  TradeEvent,
  PoolStateEvent,
  CandleData,
  BondingStatusEvent,
  AdapterEvent,
  AdapterEventType,
} from '../../types/adapters';

export interface AdapterManagerConfig {
  quickNodeWsUrl?: string;
  goldskyWsUrl?: string;
  goldskyApiKey?: string;
  bitQueryWsUrl?: string;
  bitQueryApiKey?: string;
  acesUsdPriceService?: AcesUsdPriceService;
  rateLimitEnforcer?: RateLimitEnforcer; // Optional enforcer for rate limiting
  prisma?: PrismaClient; // Optional Prisma client (for BitQuery trade storage)
}

/**
 * Adapter Manager
 */
export class AdapterManager extends EventEmitter {
  private quickNode: QuickNodeAdapter;
  private goldsky: GoldskyMemoryAdapter; // 🚀 NEW: Memory-based
  private bitQuery: BitQueryAdapter;
  private aerodrome: AerodromeAdapter;
  private rateLimitEnforcer?: RateLimitEnforcer;

  private connected = false;

  constructor(config: AdapterManagerConfig = {}) {
    super();

    // Store rate limit enforcer if provided
    this.rateLimitEnforcer = config.rateLimitEnforcer;

    // Initialize adapters
    this.quickNode = new QuickNodeAdapter(config.quickNodeWsUrl);

    // 🚀 NEW: Use memory adapter (reads from webhook-populated in-memory store)
    this.goldsky = new GoldskyMemoryAdapter();

    // BitQuery adapter (optional - don't crash if API key is invalid)
    try {
      this.bitQuery = new BitQueryAdapter(
        {
          wsUrl: config.bitQueryWsUrl,
          apiKey: config.bitQueryApiKey,
        },
        config.prisma,
        config.acesUsdPriceService,
      ); // Pass Prisma client and ACES/USD service for trade storage
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(
        '[AdapterManager] ⚠️ BitQueryAdapter initialization failed (optional, continuing...):',
        errorMessage,
      );
      // Set to null, will be checked before use
      this.bitQuery = null as unknown as BitQueryAdapter;
    }

    this.aerodrome = new AerodromeAdapter(this.quickNode);

    // Set up event forwarding
    this.setupEventForwarding();

    console.log('[AdapterManager] Initialized', {
      rateLimitEnforcement: !!this.rateLimitEnforcer ? 'enabled' : 'disabled',
    });
  }

  /**
   * Connect all adapters
   * Note: BitQuery is optional and won't block startup if it fails
   */
  async connect(): Promise<void> {
    console.log('[AdapterManager] 🔌 Connecting all adapters...');

    try {
      // Connect core adapters (required)
      await this.quickNode.connect();
      console.log('[AdapterManager] ✅ QuickNode connected');

      await this.aerodrome.connect();
      console.log('[AdapterManager] ✅ Aerodrome connected');

      await this.goldsky.connect();
      console.log('[AdapterManager] ✅ Goldsky connected');

      // Try to connect BitQuery, but don't fail if it doesn't work
      if (this.bitQuery) {
        try {
          console.log('[AdapterManager] 🔌 Attempting to connect BitQuery...');
          await this.bitQuery.connect();
          const isConnected = this.bitQuery.isConnected();
          if (isConnected) {
            console.log('[AdapterManager] ✅ BitQuery connected and ready');
          } else {
            console.warn(
              '[AdapterManager] ⚠️ BitQuery connect() completed but isConnected() returns false',
            );
          }
        } catch (bitQueryError) {
          console.error(
            '[AdapterManager] ❌ BitQuery connection failed (optional, continuing...):',
            bitQueryError instanceof Error ? bitQueryError.message : bitQueryError,
          );
          if (bitQueryError instanceof Error && bitQueryError.stack) {
            console.error('[AdapterManager] BitQuery error stack:', bitQueryError.stack);
          }
        }
      } else {
        console.warn('[AdapterManager] ⚠️ BitQuery adapter not initialized (skipping)');
        console.warn('[AdapterManager] ⚠️ DEX trades will not be available via WebSocket');
      }

      // Mark as connected once core adapters are ready
      this.connected = true;
      console.log('[AdapterManager] ✅ Core adapters connected (BitQuery is optional)');

      this.emit('connected');
    } catch (error) {
      console.error('[AdapterManager] ❌ Failed to connect core adapters:', error);
      throw error;
    }
  }

  /**
   * Disconnect all adapters
   */
  async disconnect(): Promise<void> {
    console.log('[AdapterManager] Disconnecting all adapters...');

    await Promise.all(
      [
        this.bitQuery?.disconnect(),
        this.goldsky.disconnect(),
        this.aerodrome.disconnect(),
        this.quickNode.disconnect(),
      ].filter(Boolean),
    );

    this.connected = false;
    console.log('[AdapterManager] ✅ All adapters disconnected');

    this.emit('disconnected');
  }

  /**
   * Check if core adapters are connected
   * Note: BitQuery is optional, so we don't require it
   */
  isConnected(): boolean {
    // Core adapters: QuickNode (blockchain), Goldsky (trades), Aerodrome (pools)
    const coreConnected =
      this.connected &&
      this.quickNode.isConnected() &&
      this.goldsky.isConnected() &&
      this.aerodrome.isConnected();

    // BitQuery is optional (historical data enrichment)
    // Don't fail if BitQuery isn't connected
    return coreConnected;
  }

  /**
   * Subscribe to trades for a token
   * Routes to Goldsky (required), BitQuery (optional)
   */
  async subscribeToTrades(
    tokenAddress: string,
    callback: (trade: TradeEvent) => void,
  ): Promise<string[]> {
    const subscriptions: string[] = [];

    // Subscribe to Goldsky (primary source for bonding curve)
    const goldskyId = await this.goldsky.subscribeToTrades(tokenAddress, callback);
    subscriptions.push(`goldsky:${goldskyId}`);

    // Subscribe to BitQuery (secondary/fallback for DEX) - optional
    if (this.bitQuery) {
      const isBitQueryConnected = this.bitQuery.isConnected();
      console.log(`[AdapterManager] BitQuery status for ${tokenAddress}:`, {
        initialized: !!this.bitQuery,
        connected: isBitQueryConnected,
      });

      if (isBitQueryConnected) {
        try {
          // 🛡️ Rate limit enforcement: Check if we should allow this BitQuery subscription
          let allowed = true;
          if (this.rateLimitEnforcer) {
            allowed = await this.rateLimitEnforcer.checkRateLimit('bitquery', 'normal', 30000);
          }

          if (!allowed) {
            console.warn(
              `[AdapterManager] ⚠️ BitQuery subscription for ${tokenAddress} rejected due to rate limits`,
            );
            // Don't throw - graceful degradation (Goldsky trades still work)
            return subscriptions;
          }

          console.log(
            `[AdapterManager] 📥 Subscribing to BitQuery DEX trades for ${tokenAddress}...`,
          );
          const bitQueryId = await this.bitQuery.subscribeToDexTrades(tokenAddress, callback);
          subscriptions.push(`bitquery:${bitQueryId}`);
          console.log(`[AdapterManager] ✅ BitQuery subscription active: ${bitQueryId}`);
        } catch (error) {
          console.error(
            `[AdapterManager] ❌ Failed to subscribe to BitQuery trades for ${tokenAddress}:`,
            error instanceof Error ? error.message : error,
          );
          if (error instanceof Error && error.stack) {
            console.error('[AdapterManager] BitQuery subscription error stack:', error.stack);
          }
        }
      } else {
        console.warn(
          `[AdapterManager] ⚠️ BitQuery not connected - skipping DEX trade subscription for ${tokenAddress}`,
        );
        console.warn(
          `[AdapterManager] ⚠️ DEX trades will not be available via WebSocket for this token`,
        );
      }
    } else {
      console.warn(`[AdapterManager] ⚠️ BitQuery adapter not initialized - DEX trades unavailable`);
    }

    return subscriptions;
  }

  /**
   * Subscribe to bonding status for a token
   * Routes to Goldsky
   */
  async subscribeToBondingStatus(
    tokenAddress: string,
    callback: (status: BondingStatusEvent) => void,
  ): Promise<string> {
    const goldskyId = await this.goldsky.subscribeToBondingStatus(tokenAddress, callback);
    return `goldsky:${goldskyId}`;
  }

  /**
   * Subscribe to pool state for a token
   * Routes to Aerodrome
   */
  async subscribeToPoolState(
    poolAddress: string,
    tokenAddress: string,
    callback: (poolState: PoolStateEvent) => void,
  ): Promise<string> {
    const aerodromeId = await this.aerodrome.subscribeToPool(poolAddress, tokenAddress, callback);
    return `aerodrome:${aerodromeId}`;
  }

  /**
   * Subscribe to candles for a token
   * Routes to BitQuery
   */
  async subscribeToCandles(
    tokenAddress: string,
    timeframe: string,
    callback: (candle: CandleData) => void,
  ): Promise<string> {
    if (!this.bitQuery) {
      throw new Error('BitQuery adapter not initialized');
    }
    const bitQueryId = await this.bitQuery.subscribeToCandles(tokenAddress, timeframe, callback);
    return `bitquery:${bitQueryId}`;
  }

  /**
   * Unsubscribe from a subscription
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const [adapter, id] = subscriptionId.split(':');

    switch (adapter) {
      case 'goldsky':
        await this.goldsky.unsubscribe(id);
        break;
      case 'bitquery':
        if (this.bitQuery) {
          await this.bitQuery.unsubscribe(id);
        }
        break;
      case 'aerodrome': {
        const [poolAddress, tokenAddress] = id.split('_');
        await this.aerodrome.unsubscribeFromPool(poolAddress, tokenAddress);
        break;
      }
      default:
        console.warn('[AdapterManager] Unknown adapter:', adapter);
    }
  }

  /**
   * Get cached pool state from Aerodrome adapter
   */
  getCachedPoolState(poolAddress: string): PoolStateEvent | null {
    return this.aerodrome.getCachedPoolState(poolAddress);
  }

  /**
   * Get stats from all adapters
   */
  getAllStats() {
    return {
      quickNode: this.quickNode.getStats(),
      goldsky: this.goldsky.getStats(),
      bitQuery: this.bitQuery?.getStats() || null,
      aerodrome: this.aerodrome.getStats(),
    };
  }

  /**
   * Set up event forwarding from adapters
   */
  private setupEventForwarding(): void {
    // Forward all adapter events
    this.quickNode.on('adapter_event', (event: AdapterEvent) => {
      this.emit('adapter_event', event);
    });

    this.goldsky.on('adapter_event', (event: AdapterEvent) => {
      this.emit('adapter_event', event);
    });

    if (this.bitQuery) {
      this.bitQuery.on('adapter_event', (event: AdapterEvent) => {
        this.emit('adapter_event', event);
      });
      this.bitQuery.on('connected', () => this.emit('bitquery_connected'));
      this.bitQuery.on('error', (error) => this.emit('bitquery_error', error));
    }

    this.aerodrome.on('adapter_event', (event: AdapterEvent) => {
      this.emit('adapter_event', event);
    });

    // Forward connection events
    this.quickNode.on('connected', () => this.emit('quicknode_connected'));
    this.goldsky.on('connected', () => this.emit('goldsky_connected'));
    this.aerodrome.on('connected', () => this.emit('aerodrome_connected'));

    // Forward errors
    this.quickNode.on('error', (error) => this.emit('quicknode_error', error));
    this.goldsky.on('error', (error) => this.emit('goldsky_error', error));
  }

  /**
   * Get individual adapter (for advanced use)
   */
  getAdapter(name: 'quicknode' | 'goldsky' | 'bitquery' | 'aerodrome') {
    switch (name) {
      case 'quicknode':
        return this.quickNode;
      case 'goldsky':
        return this.goldsky;
      case 'bitquery':
        if (!this.bitQuery) {
          throw new Error('BitQuery adapter not initialized');
        }
        return this.bitQuery;
      case 'aerodrome':
        return this.aerodrome;
      default:
        throw new Error(`Unknown adapter: ${name}`);
    }
  }
}
