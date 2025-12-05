/**
 * Adapter Manager
 * Phase 2 Integration - Coordinates all external adapters
 *
 * Responsibilities:
 * - Initialize all adapters (QuickNode, Goldsky, Aerodrome)
 * - Route adapter events to subscription deduplicator
 * - Provide unified interface for subscribing to data
 * - Handle adapter lifecycle (connect/disconnect/reconnect)
 *
 * Note: DEX trades for graduated tokens are handled by DexScreener iframe on frontend.
 * This adapter manager focuses on bonding curve (Goldsky) and on-chain data (QuickNode/Aerodrome).
 */

import { EventEmitter } from 'events';
import { PrismaClient, TokenPhase } from '@prisma/client';
import { QuickNodeAdapter } from '../../adapters/external/quicknode-adapter';
import { GoldskyMemoryAdapter } from '../../adapters/external/goldsky-memory-adapter';
import { AerodromeAdapter } from '../../adapters/external/aerodrome-adapter';
import { RateLimitEnforcer } from '../websocket/rate-limit-enforcer';
import { SubscriptionDeduplicator } from './subscription-deduplicator';
import type { AcesUsdPriceService } from '../aces-usd-price-service';
import {
  TradeEvent,
  PoolStateEvent,
  BondingStatusEvent,
  AdapterEvent,
} from '../../types/adapters';

export interface AdapterManagerConfig {
  quickNodeWsUrl?: string;
  goldskyWsUrl?: string;
  goldskyApiKey?: string;
  acesUsdPriceService?: AcesUsdPriceService;
  rateLimitEnforcer?: RateLimitEnforcer;
  prisma?: PrismaClient;
  subscriptionDeduplicator?: SubscriptionDeduplicator;
  // Legacy config options (kept for backwards compatibility, but ignored)
  bitQueryWsUrl?: string;
  bitQueryApiKey?: string;
  enableBitQueryDedup?: boolean;
}

/**
 * Adapter Manager
 * Coordinates QuickNode (blockchain), Goldsky (bonding trades), and Aerodrome (pool state)
 */
export class AdapterManager extends EventEmitter {
  private quickNode: QuickNodeAdapter;
  private goldsky: GoldskyMemoryAdapter;
  private aerodrome: AerodromeAdapter;
  private rateLimitEnforcer?: RateLimitEnforcer;
  private prisma?: PrismaClient;
  private deduplicator?: SubscriptionDeduplicator;
  private readonly graduationCache = new Map<string, { isGraduated: boolean; timestamp: number }>();
  private readonly GRADUATION_CACHE_TTL_MS = Number(
    process.env.WS_GRADUATION_CACHE_TTL_MS ?? '60000',
  );

  private connected = false;

  constructor(config: AdapterManagerConfig = {}) {
    super();

    // Store rate limit enforcer if provided
    this.rateLimitEnforcer = config.rateLimitEnforcer;

    // Initialize core adapters
    this.quickNode = new QuickNodeAdapter(config.quickNodeWsUrl);
    this.goldsky = new GoldskyMemoryAdapter();
    this.prisma = config.prisma;
    this.deduplicator = config.subscriptionDeduplicator;

    this.aerodrome = new AerodromeAdapter(this.quickNode);

    // Set up event forwarding
    this.setupEventForwarding();

    console.log('[AdapterManager] Initialized', {
      adapters: ['quicknode', 'goldsky', 'aerodrome'],
      rateLimitEnforcement: !!this.rateLimitEnforcer ? 'enabled' : 'disabled',
      note: 'DEX trades handled by DexScreener iframe on frontend',
    });
  }

  /**
   * Connect all adapters
   */
  async connect(): Promise<void> {
    console.log('[AdapterManager] 🔌 Connecting all adapters...');

    try {
      // Connect core adapters
      await this.quickNode.connect();
      console.log('[AdapterManager] ✅ QuickNode connected');

      await this.aerodrome.connect();
      console.log('[AdapterManager] ✅ Aerodrome connected');

      await this.goldsky.connect();
      console.log('[AdapterManager] ✅ Goldsky connected');

      // Mark as connected
      this.connected = true;
      console.log('[AdapterManager] ✅ All adapters connected');

      this.emit('connected');
    } catch (error) {
      console.error('[AdapterManager] ❌ Failed to connect adapters:', error);
      throw error;
    }
  }

  /**
   * Disconnect all adapters
   */
  async disconnect(): Promise<void> {
    console.log('[AdapterManager] Disconnecting all adapters...');

    await Promise.all([
      this.goldsky.disconnect(),
      this.aerodrome.disconnect(),
      this.quickNode.disconnect(),
    ]);

    this.connected = false;
    console.log('[AdapterManager] ✅ All adapters disconnected');

    this.emit('disconnected');
  }

  /**
   * Check if core adapters are connected
   */
  isConnected(): boolean {
    return (
      this.connected &&
      this.quickNode.isConnected() &&
      this.goldsky.isConnected() &&
      this.aerodrome.isConnected()
    );
  }

  /**
   * Subscribe to trades for a token
   * Routes to Goldsky for bonding curve trades
   * Note: DEX trades are handled by DexScreener iframe on frontend
   */
  async subscribeToTrades(
    tokenAddress: string,
    callback: (trade: TradeEvent) => void,
    _options: { useBitQueryDedup?: boolean } = {},
  ): Promise<string[]> {
    const subscriptions: string[] = [];

    // Subscribe to Goldsky (bonding curve trades)
    const goldskyId = await this.goldsky.subscribeToTrades(tokenAddress, callback);
    subscriptions.push(`goldsky:${goldskyId}`);

    // Note: DEX trades for graduated tokens are handled by DexScreener iframe on frontend
    // No need to subscribe to DEX trade streams here

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
   * Unsubscribe from a subscription
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const [adapter, id] = subscriptionId.split(':');

    switch (adapter) {
      case 'goldsky':
        await this.goldsky.unsubscribe(id);
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
  getAdapter(name: 'quicknode' | 'goldsky' | 'aerodrome') {
    switch (name) {
      case 'quicknode':
        return this.quickNode;
      case 'goldsky':
        return this.goldsky;
      case 'aerodrome':
        return this.aerodrome;
      default:
        throw new Error(`Unknown adapter: ${name}`);
    }
  }

  /**
   * Check if token is graduated (on DEX)
   * Used to determine if DEX-specific features should be enabled
   */
  async isTokenGraduated(tokenAddress: string): Promise<boolean> {
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
      if (bondingStatus?.isBonded) {
        isGraduated = true;
      } else if (bondingStatus && bondingStatus.isBonded === false) {
        isGraduated = false;
      }
    }

    if (isGraduated === null) {
      isGraduated = false;
    }

    this.graduationCache.set(normalized, {
      isGraduated,
      timestamp: Date.now(),
    });

    return isGraduated;
  }
}
