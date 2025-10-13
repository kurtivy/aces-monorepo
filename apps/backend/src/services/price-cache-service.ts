import { ethers } from 'ethers';

interface CachedPricePayload {
  acesUsd: number;
  wethUsd: number;
  usdcUsd: number;
  usdtUsd: number;
  acesPerWeth: number;
  updatedAt: number;
  isStale: boolean;
}

const DEFAULT_TTL_MS = Number(process.env.PRICE_CACHE_TTL_MS || 60_000);
const COINGECKO_ENDPOINT =
  'https://api.coingecko.com/api/v3/simple/price?ids=weth,usd-coin,tether&vs_currencies=usd';

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
  private provider: ethers.JsonRpcProvider;
  private poolContract: ethers.Contract;
  private readonly ttlMs: number;

  private cache: CachedPricePayload | null = null;
  private inflight: Promise<CachedPricePayload> | null = null;

  constructor() {
    const rpcUrl =
      process.env.QUICKNODE_BASE_URL ||
      process.env.BASE_MAINNET_RPC_URL ||
      process.env.NEXT_PUBLIC_BASE_MAINNET_RPC_URL ||
      'https://mainnet.base.org';

    const poolAddress = process.env.AERODROME_ACES_WETH_POOL;
    const acesAddress = process.env.ACES_TOKEN_ADDRESS;

    if (!poolAddress) {
      throw new Error(
        '[PriceCacheService] Missing AERODROME_ACES_WETH_POOL environment variable.',
      );
    }

    if (!acesAddress) {
      throw new Error('[PriceCacheService] Missing ACES_TOKEN_ADDRESS environment variable.');
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.poolContract = new ethers.Contract(
      poolAddress,
      AERODROME_POOL_ABI,
      this.provider,
    );
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

    this.inflight = this.refreshPrices()
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

  private async fetchUsdPrices(): Promise<{
    weth?: { usd?: number };
    'usd-coin'?: { usd?: number };
    tether?: { usd?: number };
  }> {
    const response = await fetch(COINGECKO_ENDPOINT, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'aces-price-cache/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(
        `[PriceCacheService] Failed to fetch USD prices. Status ${response.status}`,
      );
    }

    const json = (await response.json()) as {
      weth?: { usd?: number };
      'usd-coin'?: { usd?: number };
      tether?: { usd?: number };
    };

    const wethUsd = json?.weth?.usd;
    if (!wethUsd || !Number.isFinite(wethUsd)) {
      throw new Error('[PriceCacheService] Invalid WETH/USD price response.');
    }

    const usdcUsd = json?.['usd-coin']?.usd;
    if (!usdcUsd || !Number.isFinite(usdcUsd)) {
      throw new Error('[PriceCacheService] Invalid USDC/USD price response.');
    }

    const usdtUsd = json?.tether?.usd;
    if (!usdtUsd || !Number.isFinite(usdtUsd)) {
      throw new Error('[PriceCacheService] Invalid USDT/USD price response.');
    }

    return json;
  }

  private async fetchAcesPerWeth(): Promise<number> {
    const acesAddress = process.env.ACES_TOKEN_ADDRESS!.toLowerCase();

    const [reserve0, reserve1] = await this.poolContract.getReserves();
    const token0 = (await this.poolContract.token0()).toLowerCase();

    const isToken0Aces = token0 === acesAddress;
    const acesReserve = isToken0Aces ? reserve0 : reserve1;
    const wethReserve = isToken0Aces ? reserve1 : reserve0;

    const acesReserveFloat = Number(ethers.formatEther(acesReserve));
    const wethReserveFloat = Number(ethers.formatEther(wethReserve));

    if (!Number.isFinite(acesReserveFloat) || acesReserveFloat <= 0) {
      throw new Error('[PriceCacheService] Invalid ACES reserve in Aerodrome pool.');
    }

    return wethReserveFloat / acesReserveFloat;
  }
}

// Single shared instance for the process
export const priceCacheService = new PriceCacheService();
