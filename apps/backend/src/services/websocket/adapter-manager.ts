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
import { PrismaClient, TokenPhase } from '@prisma/client';
import { QuickNodeAdapter } from '../../adapters/external/quicknode-adapter';
import { GoldskyMemoryAdapter } from '../../adapters/external/goldsky-memory-adapter'; // 🚀 NEW: Memory-based
import { BitQueryAdapter } from '../../adapters/external/bitquery-adapter';
import { AerodromeAdapter } from '../../adapters/external/aerodrome-adapter';
import { RateLimitEnforcer } from '../websocket/rate-limit-enforcer';
import { SubscriptionDeduplicator } from './subscription-deduplicator';
import type { AcesUsdPriceService } from '../aces-usd-price-service';
import {
  TradeEvent,
  PoolStateEvent,
  CandleData,
  BondingStatusEvent,
  AdapterEvent,
  AdapterEventType,
} from '../../types/adapters';

interface DedupExternalEvent {
  key: string;
  topic: string;
  params: Record<string, any>;
  dataSource: string;
}

interface DedupExternalUnsubscribeEvent extends DedupExternalEvent {
  externalRef: any;
}

interface BitQueryDedupState {
  tokenAddress: string;
  subscriptionId: string | null;
  reconnectAttempts: number;
  pendingRetryAt: number | null;
}

export interface AdapterManagerConfig {
  quickNodeWsUrl?: string;
  goldskyWsUrl?: string;
  goldskyApiKey?: string;
  bitQueryWsUrl?: string;
  bitQueryApiKey?: string;
  acesUsdPriceService?: AcesUsdPriceService;
  rateLimitEnforcer?: RateLimitEnforcer; // Optional enforcer for rate limiting
  prisma?: PrismaClient; // Optional Prisma client (for BitQuery trade storage)
  subscriptionDeduplicator?: SubscriptionDeduplicator;
  enableBitQueryDedup?: boolean;
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
  private prisma?: PrismaClient;
  private deduplicator?: SubscriptionDeduplicator;
  private bitQueryDedupEnabled: boolean = false;
  private bitQueryDedupSubscriptions = new Map<string, BitQueryDedupState>();
  private bitQueryDedupRetryQueue = new Set<string>();
  private bitQueryDedupRetryTimer: NodeJS.Timeout | null = null;
  private readonly graduationCache = new Map<string, { isGraduated: boolean; timestamp: number }>();
  private readonly GRADUATION_CACHE_TTL_MS = Number(
    process.env.WS_GRADUATION_CACHE_TTL_MS ?? '60000',
  );

  private connected = false;

  constructor(config: AdapterManagerConfig = {}) {
    super();

    // Store rate limit enforcer if provided
    this.rateLimitEnforcer = config.rateLimitEnforcer;

    // Initialize adapters
    this.quickNode = new QuickNodeAdapter(config.quickNodeWsUrl);

    // 🚀 NEW: Use memory adapter (reads from webhook-populated in-memory store)
    this.goldsky = new GoldskyMemoryAdapter();
    this.prisma = config.prisma;
    this.deduplicator = config.subscriptionDeduplicator;
    this.bitQueryDedupEnabled = Boolean(config.enableBitQueryDedup && this.deduplicator);

    if (config.enableBitQueryDedup && !this.deduplicator) {
      console.warn(
        '[AdapterManager] ⚠️ BitQuery dedup requested but no SubscriptionDeduplicator instance provided',
      );
      this.bitQueryDedupEnabled = false;
    }

    if (this.bitQueryDedupEnabled && this.deduplicator) {
      this.deduplicator.on('external_subscribe', this.handleDedupExternalSubscribe);
      this.deduplicator.on('external_unsubscribe', this.handleDedupExternalUnsubscribe);
    }

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
    options: { useBitQueryDedup?: boolean } = {},
  ): Promise<string[]> {
    const subscriptions: string[] = [];
    const dedupGloballyActive = this.isBitQueryDedupActive();
    const useDedupForBitQuery = Boolean(options.useBitQueryDedup && dedupGloballyActive);
    if (dedupGloballyActive && !options.useBitQueryDedup && this.bitQuery) {
      console.warn(
        `[AdapterManager] ⚠️ BitQuery dedup is enabled globally but subscribeToTrades() was called without dedup flag for ${tokenAddress}.` +
          ' To avoid duplicate external streams, falling back to Goldsky-only until this route opts into dedup.',
      );
    }

    // Subscribe to Goldsky (primary source for bonding curve)
    const goldskyId = await this.goldsky.subscribeToTrades(tokenAddress, callback);
    subscriptions.push(`goldsky:${goldskyId}`);

    // Subscribe to BitQuery (secondary/fallback for DEX) - optional
    const legacyBitQueryAllowed = this.bitQuery && !dedupGloballyActive;

    if (legacyBitQueryAllowed && !useDedupForBitQuery) {
      const allowBitQuery = await this.shouldUseBitQuery(tokenAddress);
      if (!allowBitQuery) {
        console.log(
          `[AdapterManager] ⏭️ Token ${tokenAddress} not graduated yet - skipping BitQuery WS`,
        );
        return subscriptions;
      }

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

    if (useDedupForBitQuery) {
      console.log(
        `[AdapterManager] ♻️ BitQuery dedup active for ${tokenAddress} - upstream subscription handled by SubscriptionDeduplicator`,
      );
    }

    return subscriptions;
  }

  private isBitQueryDedupActive(): boolean {
    return this.bitQueryDedupEnabled && !!this.deduplicator;
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

  private handleDedupExternalSubscribe = async (event: DedupExternalEvent) => {
    if (!this.isBitQueryDedupActive()) {
      return;
    }
    if (event.dataSource !== 'bitquery' || event.topic !== 'trades') {
      return;
    }
    if (!this.bitQuery) {
      console.warn('[AdapterManager] ⚠️ Dedup subscribe fired but BitQuery adapter unavailable');
      return;
    }

    const tokenAddress =
      (event.params?.tokenAddress as string | undefined) ||
      (event.params?.token as string | undefined);

    if (!tokenAddress) {
      console.warn('[AdapterManager] ⚠️ Dedup subscribe missing tokenAddress param', event.params);
      return;
    }

    const normalized = tokenAddress.toLowerCase();
    const allowBitQuery = await this.shouldUseBitQuery(normalized);
    if (!allowBitQuery) {
      console.log(
        `[AdapterManager] ⏭️ Dedup gating prevented BitQuery stream for ${normalized} (not graduated)`,
      );
      return;
    }

    if (this.bitQueryDedupSubscriptions.has(event.key)) {
      console.log(
        `[AdapterManager] ♻️ Dedup BitQuery stream already active for ${normalized} (${event.key})`,
      );
      return;
    }

    const state: BitQueryDedupState = {
      tokenAddress: normalized,
      subscriptionId: null,
      reconnectAttempts: 0,
      pendingRetryAt: null,
    };
    this.bitQueryDedupSubscriptions.set(event.key, state);

    console.log(
      `[AdapterManager] 🔁 Creating shared BitQuery subscription for ${normalized} via deduplicator`,
    );
    await this.startBitQueryDedupStream(event.key, state);
  };

  private handleDedupExternalUnsubscribe = async (event: DedupExternalUnsubscribeEvent) => {
    if (!this.isBitQueryDedupActive()) {
      return;
    }
    if (event.dataSource !== 'bitquery') {
      return;
    }
    await this.cleanupBitQueryDedupSubscription(event.key);
  };

  private async startBitQueryDedupStream(
    key: string,
    state: BitQueryDedupState,
  ): Promise<void> {
    if (!this.bitQuery) {
      console.warn('[AdapterManager] ⚠️ Cannot start dedup BitQuery stream - adapter unavailable');
      return;
    }

    const isConnected = this.bitQuery.isConnected();
    if (!isConnected) {
      console.warn('[AdapterManager] ⚠️ BitQuery not connected yet - scheduling dedup retry');
      this.scheduleBitQueryDedupRetry(key, state);
      return;
    }

    try {
      const subscriptionId = await this.bitQuery.subscribeToDexTrades(
        state.tokenAddress,
        (trade: TradeEvent) => {
          state.reconnectAttempts = 0;
          this.deduplicator?.broadcast(key, trade);
        },
      );

      state.subscriptionId = subscriptionId;
      this.bitQueryDedupRetryQueue.delete(key);
      this.deduplicator?.setExternalRef(key, subscriptionId);
      console.log(
        `[AdapterManager] ✅ BitQuery dedup stream ready for ${state.tokenAddress} (${key})`,
      );
    } catch (error) {
      console.error(
        `[AdapterManager] ❌ Failed to establish BitQuery dedup stream for ${state.tokenAddress}:`,
        error,
      );
      this.scheduleBitQueryDedupRetry(key, state);
    }
  }

  private scheduleBitQueryDedupRetry(key: string, state: BitQueryDedupState): void {
    state.reconnectAttempts += 1;
    const delay = Math.min(1000 * 2 ** (state.reconnectAttempts - 1), 30000);
    console.warn(
      `[AdapterManager] 🔁 Retrying BitQuery dedup stream for ${state.tokenAddress} in ${delay}ms (attempt ${state.reconnectAttempts})`,
    );
    state.pendingRetryAt = Date.now() + delay;
    this.bitQueryDedupRetryQueue.add(key);
    this.ensureBitQueryDedupRetryTimer();
  }

  private ensureBitQueryDedupRetryTimer(): void {
    if (this.bitQueryDedupRetryTimer || this.bitQueryDedupRetryQueue.size === 0) {
      return;
    }

    const nextDelay = this.getNextBitQueryDedupRetryDelay();
    if (nextDelay === null) {
      return;
    }

    this.bitQueryDedupRetryTimer = setTimeout(() => {
      this.bitQueryDedupRetryTimer = null;
      const now = Date.now();
      for (const key of Array.from(this.bitQueryDedupRetryQueue)) {
        const state = this.bitQueryDedupSubscriptions.get(key);
        if (!state || state.pendingRetryAt === null) {
          this.bitQueryDedupRetryQueue.delete(key);
          continue;
        }
        if (now >= state.pendingRetryAt) {
          state.pendingRetryAt = null;
          this.bitQueryDedupRetryQueue.delete(key);
          void this.startBitQueryDedupStream(key, state);
        }
      }

      if (this.bitQueryDedupRetryQueue.size > 0) {
        this.ensureBitQueryDedupRetryTimer();
      }
    }, Math.max(10, nextDelay));
  }

  private getNextBitQueryDedupRetryDelay(): number | null {
    let soonest = Infinity;
    const now = Date.now();

    for (const key of this.bitQueryDedupRetryQueue) {
      const state = this.bitQueryDedupSubscriptions.get(key);
      if (!state || state.pendingRetryAt === null) {
        continue;
      }
      soonest = Math.min(soonest, state.pendingRetryAt);
    }

    if (soonest === Infinity) {
      return null;
    }

    return Math.max(0, soonest - now);
  }

  private async cleanupBitQueryDedupSubscription(key: string): Promise<void> {
    const state = this.bitQueryDedupSubscriptions.get(key);
    if (!state) {
      return;
    }

    if (state.subscriptionId && this.bitQuery) {
      try {
        await this.bitQuery.unsubscribe(state.subscriptionId);
        console.log(
          `[AdapterManager] 🧹 Cleaned up BitQuery dedup subscription ${state.subscriptionId} for ${state.tokenAddress}`,
        );
      } catch (error) {
        console.warn(
          `[AdapterManager] ⚠️ Failed to unsubscribe BitQuery dedup stream ${state.subscriptionId}:`,
          error,
        );
      }
    }

    this.bitQueryDedupSubscriptions.delete(key);
    if (this.bitQueryDedupRetryQueue.delete(key) && this.bitQueryDedupRetryQueue.size === 0 && this.bitQueryDedupRetryTimer) {
      clearTimeout(this.bitQueryDedupRetryTimer);
      this.bitQueryDedupRetryTimer = null;
    }
  }

  async canUseBitQuery(tokenAddress: string): Promise<boolean> {
    return this.shouldUseBitQuery(tokenAddress);
  }

  private async shouldUseBitQuery(tokenAddress: string): Promise<boolean> {
    const normalized = tokenAddress.toLowerCase();
    const cached = this.graduationCache.get(normalized);

    if (
      cached &&
      Date.now() - cached.timestamp < this.GRADUATION_CACHE_TTL_MS &&
      cached.isGraduated
    ) {
      return true;
    }

    let isGraduated: boolean | null = null;

    if (this.prisma) {
      try {
        const token = await this.prisma.token.findUnique({
          where: { contractAddress: normalized },
          select: { phase: true, poolAddress: true },
        });

        console.log('[AdapterManager] Graduation check (prisma)', {
          token: normalized,
          phase: token?.phase,
          poolAddress: token?.poolAddress,
        });

        if (token) {
          if (token.phase === TokenPhase.DEX_TRADING) {
            isGraduated = true;
          } else if (token.phase === TokenPhase.BONDING_CURVE) {
            isGraduated = false;
          } else if (token.poolAddress) {
            isGraduated = true;
          }
        }
      } catch (error) {
        console.warn(
          `[AdapterManager] ⚠️ Failed to fetch token phase for ${normalized}:`,
          error,
        );
      }
    }

    if (isGraduated !== true) {
      const bondingStatus = this.goldsky.getLatestBondingStatus(tokenAddress);
      console.log('[AdapterManager] Graduation check (goldsky)', {
        token: normalized,
        bondingStatus,
      });
      if (bondingStatus?.isBonded) {
        isGraduated = true;
      } else if (bondingStatus && bondingStatus.isBonded === false) {
        isGraduated = false;
      }
    }

    if (isGraduated === null) {
      console.warn(
        `[AdapterManager] ⚠️ No graduation data for ${normalized} - defaulting to NOT graduated`,
      );
      isGraduated = false;
    }

    this.graduationCache.set(normalized, {
      isGraduated,
      timestamp: Date.now(),
    });

    return isGraduated;
  }
}
