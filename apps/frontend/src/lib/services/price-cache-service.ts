import { ethers } from 'ethers';
import { createRpcProvider, getDefaultRpcUrl } from '../utils/rpc-provider';

interface CachedPricePayload {
  acesUsd: number;
  wethUsd: number;
  usdcUsd: number;
  usdtUsd: number;
  acesPerWeth: number;
  updatedAt: number;
  isStale: boolean;
}

const DEFAULT_TTL_MS = Number(process.env.PRICE_CACHE_TTL_MS || 30000);
/** Max time for a single refresh (Aerodrome API + pool reserves). Exceeding returns stale cache if available. */
const REFRESH_TIMEOUT_MS = 10000;

/** QuickNode Aerodrome Swap API add-on path */
const AERODROME_ADDON_PATH = '/addon/1051/v1';

const AERODROME_POOL_ABI = [
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
];

/**
 * Lightweight in-memory cache for ACES/WETH pricing.
 * Keeps a shared JsonRpcProvider instance and refreshes values on demand.
 */
export class PriceCacheService {
  private provider: ethers.providers.JsonRpcProvider;
  private poolContract: ethers.Contract;
  private readonly ttlMs: number;

  private cache: CachedPricePayload | null = null;
  private inflight: Promise<CachedPricePayload> | null = null;

  constructor() {
    const rpcUrl = getDefaultRpcUrl();

    const poolAddress = process.env.AERODROME_ACES_WETH_POOL;
    const acesAddress = process.env.ACES_TOKEN_ADDRESS;

    if (!poolAddress) {
      throw new Error('[PriceCacheService] Missing AERODROME_ACES_WETH_POOL environment variable.');
    }

    if (!acesAddress) {
      throw new Error('[PriceCacheService] Missing ACES_TOKEN_ADDRESS environment variable.');
    }

    // Use custom provider creation to avoid referrer header issues
    this.provider = createRpcProvider(rpcUrl, {
      name: 'base',
      chainId: 8453,
    });
    this.poolContract = new ethers.Contract(poolAddress, AERODROME_POOL_ABI, this.provider);
    this.ttlMs = DEFAULT_TTL_MS;
  }

  /**
   * Public entry point – returns cached prices or refreshes if needed.
   */
  async getPrices(): Promise<CachedPricePayload> {
    const now = Date.now();

    if (this.cache && now - this.cache.updatedAt <= this.ttlMs) {
      return { ...this.cache, isStale: false };
    }

    if (this.inflight) {
      return this.inflight;
    }

    this.inflight = this.refreshPricesWithTimeout()
      .then((data) => {
        this.cache = data;
        this.inflight = null;
        return data;
      })
      .catch((error) => {
        this.inflight = null;
        if (this.cache) {
          // Serve stale cache if available
          return { ...this.cache, isStale: true };
        }
        throw error;
      });

    return this.inflight;
  }

  /**
   * Force refresh of the cached values, ignoring TTL.
   */
  async forceRefresh(): Promise<CachedPricePayload> {
    const fresh = await this.refreshPrices();
    this.cache = fresh;
    return fresh;
  }

  /**
   * Refresh with a hard timeout so the API route doesn't hang.
   * On timeout we throw so getPrices() can return stale cache if available.
   */
  private async refreshPricesWithTimeout(): Promise<CachedPricePayload> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Price refresh timed out')), REFRESH_TIMEOUT_MS);
    });
    return Promise.race([this.refreshPrices(), timeoutPromise]);
  }

  private async refreshPrices(): Promise<CachedPricePayload> {
    const [usdPrices, acesPerWeth] = await Promise.all([
      this.fetchUsdPrices(),
      this.fetchAcesPerWeth(),
    ]);

    const wethUsd = usdPrices.weth?.usd ?? NaN;
    const usdcUsd = usdPrices['usd-coin']?.usd ?? NaN;
    const usdtUsd = usdPrices.tether?.usd ?? NaN;

    const acesUsd = acesPerWeth * wethUsd;

    if (!Number.isFinite(acesUsd) || acesUsd <= 0) {
      throw new Error(`[PriceCacheService] Invalid ACES/USD price calculated: ${acesUsd}`);
    }

    return {
      acesUsd,
      wethUsd,
      acesPerWeth,
      usdcUsd,
      usdtUsd,
      updatedAt: Date.now(),
      isStale: false,
    };
  }

  /**
   * Build Aerodrome API URL from QuickNode RPC URL.
   * The Aerodrome Swap API add-on is served at /addon/1051/v1 on the same QuickNode endpoint.
   */
  private getAerodromeApiUrl(path: string, params?: Record<string, string>): string {
    const rpcUrl = getDefaultRpcUrl().replace(/\/$/, '');
    const base = `${rpcUrl}${AERODROME_ADDON_PATH}${path}`;
    if (params && Object.keys(params).length > 0) {
      const search = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      return `${base}?${search}`;
    }
    return base;
  }

  /**
   * Fetch USD prices via QuickNode Aerodrome Swap API.
   * All data comes from Aerodrome DEX on Base - no external price APIs.
   */
  private async fetchUsdPrices(): Promise<{
    weth?: { usd?: number };
    'usd-coin'?: { usd?: number };
    tether?: { usd?: number };
  }> {
    const url = this.getAerodromeApiUrl('/prices', {
      target: 'aero',
      symbols: 'WETH,USDC,USDT',
      limit: '10',
    });

    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(
        `[PriceCacheService] Aerodrome API failed. Status ${response.status}: ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      prices?: Record<string, { token?: { symbol?: string }; price?: number }>;
    };

    const prices = data?.prices;
    if (!prices || typeof prices !== 'object') {
      throw new Error('[PriceCacheService] Invalid Aerodrome API response.');
    }

    let wethUsd: number | undefined;
    let usdcUsd: number | undefined;
    let usdtUsd: number | undefined;

    for (const [, info] of Object.entries(prices)) {
      const symbol = info?.token?.symbol?.toUpperCase();
      const price = info?.price;
      if (!Number.isFinite(price)) continue;
      if (symbol === 'WETH') wethUsd = price;
      else if (symbol === 'USDC') usdcUsd = price;
      else if (symbol === 'USDT') usdtUsd = price;
    }

    if (!wethUsd || !Number.isFinite(wethUsd)) {
      throw new Error('[PriceCacheService] WETH price not found in Aerodrome API.');
    }
    if (!usdcUsd || !Number.isFinite(usdcUsd)) {
      throw new Error('[PriceCacheService] USDC price not found in Aerodrome API.');
    }
    if (!usdtUsd || !Number.isFinite(usdtUsd)) {
      throw new Error('[PriceCacheService] USDT price not found in Aerodrome API.');
    }

    return {
      weth: { usd: wethUsd },
      'usd-coin': { usd: usdcUsd },
      tether: { usd: usdtUsd },
    };
  }

  private async fetchAcesPerWeth(): Promise<number> {
    const acesAddress = process.env.ACES_TOKEN_ADDRESS!.toLowerCase();

    const [reserve0, reserve1] = await this.poolContract.getReserves();
    const token0 = (await this.poolContract.token0()).toLowerCase();

    const isToken0Aces = token0 === acesAddress;
    const acesReserve = isToken0Aces ? reserve0 : reserve1;
    const wethReserve = isToken0Aces ? reserve1 : reserve0;

    const acesReserveFloat = Number(ethers.utils.formatEther(acesReserve));
    const wethReserveFloat = Number(ethers.utils.formatEther(wethReserve));

    if (!Number.isFinite(acesReserveFloat) || acesReserveFloat <= 0) {
      throw new Error('[PriceCacheService] Invalid ACES reserve in Aerodrome pool.');
    }

    return wethReserveFloat / acesReserveFloat;
  }
}

// Single shared instance for the process
let priceCacheServiceInstance: PriceCacheService | null = null;

export function getPriceCacheService(): PriceCacheService {
  if (!priceCacheServiceInstance) {
    priceCacheServiceInstance = new PriceCacheService();
  }
  return priceCacheServiceInstance;
}
