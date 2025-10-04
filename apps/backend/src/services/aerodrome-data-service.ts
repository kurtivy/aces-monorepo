import { ethers } from 'ethers';

type Resolution = '5m' | '15m' | '1h' | '4h' | '1d';

const PAIR_ABI = [
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function totalSupply() view returns (uint256)',
];

const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB, bool stable) view returns (address)',
];

const ERC20_ABI = ['function decimals() view returns (uint8)'];

const FIVE_SECONDS_IN_MS = 5_000;

export interface AerodromeDataServiceOptions {
  rpcUrl?: string;
  factoryAddress?: string;
  acesTokenAddress: string;
  apiBaseUrl?: string;
  apiKey?: string;
  defaultStable?: boolean;
  cacheTtlMs?: number;
  mockEnabled?: boolean;
  mockData?: AerodromeMockData;
  provider?: ethers.JsonRpcProvider;
  fetchFn?: typeof fetch;
}

export interface AerodromeMockData {
  pools?: Record<string, AerodromePoolState>;
  trades?: Record<string, AerodromeSwap[]>;
}

export interface AerodromePoolState {
  poolAddress: string;
  tokenAddress: string;
  counterToken: string;
  reserves: {
    token: string; // decimal string representation
    counter: string;
  };
  reserveRaw: {
    token: string;
    counter: string;
  };
  priceInCounter: number;
  lastUpdated: number; // ms
  totalSupply?: string;
}

export interface AerodromeSwap {
  txHash: string;
  timestamp: number; // ms epoch
  blockNumber: number;
  direction: 'buy' | 'sell';
  amountToken: string;
  amountCounter: string;
  priceInCounter: number;
}

export interface AerodromeCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volumeToken: number;
  volumeCounter: number;
  startTime: number; // ms
  resolution: Resolution;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const DEFAULT_RESOLUTION: Resolution = '5m';

export class AerodromeDataService {
  private readonly provider: ethers.JsonRpcProvider | null;
  private readonly factoryAddress?: string;
  private readonly acesTokenAddress: string;
  private readonly apiBaseUrl?: string;
  private readonly apiKey?: string;
  private readonly defaultStable: boolean;
  private readonly cacheTtlMs: number;
  private readonly mockEnabled: boolean;
  private readonly mockData: AerodromeMockData;
  private readonly fetchFn: typeof fetch;

  private readonly poolCache = new Map<string, CacheEntry<AerodromePoolState>>();
  private readonly tradesCache = new Map<string, CacheEntry<AerodromeSwap[]>>();
  private readonly candleCache = new Map<string, CacheEntry<AerodromeCandle[]>>();
  private readonly decimalsCache = new Map<string, number>();

  constructor(options: AerodromeDataServiceOptions) {
    this.acesTokenAddress = options.acesTokenAddress.toLowerCase();
    this.factoryAddress = options.factoryAddress;
    this.apiBaseUrl = options.apiBaseUrl;
    this.apiKey = options.apiKey;
    this.defaultStable = options.defaultStable ?? false;
    this.cacheTtlMs = options.cacheTtlMs ?? FIVE_SECONDS_IN_MS;
    this.mockEnabled = options.mockEnabled ?? process.env.USE_DEX_MOCKS === 'true';
    this.mockData = options.mockData || { pools: {}, trades: {} };
    this.fetchFn = options.fetchFn ?? fetch;

    if (!this.mockEnabled) {
      if (!options.provider && !options.rpcUrl) {
        throw new Error('AerodromeDataService: rpcUrl or provider is required when mock mode is disabled');
      }

      this.provider = options.provider ?? new ethers.JsonRpcProvider(options.rpcUrl);
      if (!this.factoryAddress) {
        throw new Error('AerodromeDataService: factoryAddress is required when mock mode is disabled');
      }
    } else {
      this.provider = null;
    }
  }

  async getPoolState(tokenAddress: string): Promise<AerodromePoolState | null> {
    const normalizedToken = tokenAddress.toLowerCase();

    if (this.mockEnabled) {
      const mockPool = this.mockData.pools?.[normalizedToken];
      if (!mockPool) {
        return null;
      }
      return {
        ...mockPool,
        lastUpdated: Date.now(),
      };
    }

    if (!this.provider || !this.factoryAddress) {
      return null;
    }

    const cacheKey = normalizedToken;
    const cached = this.getCached(this.poolCache, cacheKey);
    if (cached) {
      return cached;
    }

    const poolAddress = await this.resolvePoolAddress(normalizedToken);
    if (!poolAddress || poolAddress === ethers.ZeroAddress) {
      return null;
    }

    const pairContract = new ethers.Contract(poolAddress, PAIR_ABI, this.provider);
    const [reserve0, reserve1] = await pairContract.getReserves();
    const token0 = ((await pairContract.token0()) as string).toLowerCase();
    const token1 = ((await pairContract.token1()) as string).toLowerCase();
    const totalSupply = await pairContract.totalSupply();

    const tokenDecimals = await this.getTokenDecimals(normalizedToken);
    const counterDecimals = await this.getTokenDecimals(this.acesTokenAddress);

    const tokenIsToken0 = token0 === normalizedToken;
    const tokenReserveRaw = tokenIsToken0 ? reserve0 : reserve1;
    const counterReserveRaw = tokenIsToken0 ? reserve1 : reserve0;

    const tokenReserve = parseFloat(ethers.formatUnits(tokenReserveRaw, tokenDecimals));
    const counterReserve = parseFloat(ethers.formatUnits(counterReserveRaw, counterDecimals));

    const priceInCounter = tokenReserve === 0 ? 0 : counterReserve / tokenReserve;

    const poolState: AerodromePoolState = {
      poolAddress,
      tokenAddress: normalizedToken,
      counterToken: this.acesTokenAddress,
      reserves: {
        token: tokenReserve.toString(),
        counter: counterReserve.toString(),
      },
      reserveRaw: {
        token: tokenReserveRaw.toString(),
        counter: counterReserveRaw.toString(),
      },
      priceInCounter,
      lastUpdated: Date.now(),
      totalSupply: totalSupply.toString(),
    };

    this.setCached(this.poolCache, cacheKey, poolState);
    return poolState;
  }

  async getRecentTrades(tokenAddress: string, limit = 100): Promise<AerodromeSwap[]> {
    const normalizedToken = tokenAddress.toLowerCase();

    if (this.mockEnabled) {
      const trades = this.mockData.trades?.[normalizedToken] ?? [];
      return trades.slice(-limit);
    }

    if (!this.provider) {
      return [];
    }

    const poolAddress = await this.resolvePoolAddress(normalizedToken);
    if (!poolAddress || poolAddress === ethers.ZeroAddress) {
      return [];
    }

    const cacheKey = `${poolAddress}-${limit}`;
    const cached = this.getCached(this.tradesCache, cacheKey);
    if (cached) {
      return cached.slice(-limit);
    }

    const swaps = await this.fetchTradesFromAerodromeApi(poolAddress, limit);
    if (swaps.length > 0) {
      this.setCached(this.tradesCache, cacheKey, swaps);
    }

    return swaps.slice(-limit);
  }

  async getCandles(
    tokenAddress: string,
    resolution: Resolution = DEFAULT_RESOLUTION,
    lookbackMinutes = 60,
  ): Promise<AerodromeCandle[]> {
    const normalizedToken = tokenAddress.toLowerCase();
    const cacheKey = `${normalizedToken}-${resolution}-${lookbackMinutes}`;

    const cached = this.getCached(this.candleCache, cacheKey);
    if (cached) {
      return cached;
    }

    const trades = await this.getRecentTrades(normalizedToken);
    if (trades.length === 0) {
      return [];
    }

    const resolutionMs = this.resolutionToMs(resolution);
    const cutoff = Date.now() - lookbackMinutes * 60 * 1000;

    const filtered = trades.filter((trade) => trade.timestamp >= cutoff);
    const candles = this.buildCandles(filtered, resolutionMs, resolution);

    this.setCached(this.candleCache, cacheKey, candles);
    return candles;
  }

  clearCaches(): void {
    this.poolCache.clear();
    this.tradesCache.clear();
    this.candleCache.clear();
  }

  private async resolvePoolAddress(tokenAddress: string): Promise<string | null> {
    if (this.mockEnabled) {
      const mockPool = this.mockData.pools?.[tokenAddress];
      return mockPool?.poolAddress ?? null;
    }

    if (!this.provider || !this.factoryAddress) {
      return null;
    }

    const factory = new ethers.Contract(this.factoryAddress, FACTORY_ABI, this.provider);
    const poolAddress = await factory.getPair(tokenAddress, this.acesTokenAddress, this.defaultStable);
    return (poolAddress as string).toLowerCase();
  }

  private async getTokenDecimals(address: string): Promise<number> {
    const normalized = address.toLowerCase();
    if (this.decimalsCache.has(normalized)) {
      return this.decimalsCache.get(normalized)!;
    }

    if (this.mockEnabled) {
      const decimals = normalized === this.acesTokenAddress ? 18 : 18;
      this.decimalsCache.set(normalized, decimals);
      return decimals;
    }

    if (!this.provider) {
      throw new Error('Provider unavailable for decimals lookup');
    }

    const erc20 = new ethers.Contract(normalized, ERC20_ABI, this.provider);
    const decimals = await erc20.decimals();
    this.decimalsCache.set(normalized, Number(decimals));
    return Number(decimals);
  }

  private async fetchTradesFromAerodromeApi(poolAddress: string, limit: number): Promise<AerodromeSwap[]> {
    if (!this.apiBaseUrl) {
      return [];
    }

    const url = new URL(this.apiBaseUrl.replace(/\/$/, ''));
    url.pathname = `${url.pathname.replace(/\/$/, '')}/trades`;
    url.searchParams.set('poolAddress', poolAddress);
    url.searchParams.set('limit', String(limit));

    const response = await this.fetchFn(url.toString(), {
      headers: this.apiKey
        ? {
            Authorization: `Bearer ${this.apiKey}`,
          }
        : undefined,
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as unknown;
    const tradesArray = Array.isArray((payload as any)?.data)
      ? (payload as any).data
      : Array.isArray(payload)
        ? payload
        : [];

    if (!Array.isArray(tradesArray)) {
      return [];
    }

    return tradesArray.map((item: any) => this.mapApiTrade(item)).filter(Boolean) as AerodromeSwap[];
  }

  private mapApiTrade(trade: any): AerodromeSwap | null {
    if (!trade) return null;

    const timestampMs = typeof trade.timestamp === 'number' ? trade.timestamp * 1000 : Date.now();
    const direction = trade.direction === 'buy' ? 'buy' : trade.direction === 'sell' ? 'sell' : 'buy';

    return {
      txHash: trade.txHash || trade.transactionHash || '',
      timestamp: timestampMs,
      blockNumber: trade.blockNumber || 0,
      direction,
      amountToken: trade.amountToken?.toString?.() ?? trade.amountIn?.toString?.() ?? '0',
      amountCounter: trade.amountCounter?.toString?.() ?? trade.amountOut?.toString?.() ?? '0',
      priceInCounter: Number(trade.priceInCounter ?? trade.price ?? 0),
    };
  }

  private buildCandles(
    trades: AerodromeSwap[],
    resolutionMs: number,
    resolution: Resolution,
  ): AerodromeCandle[] {
    if (trades.length === 0) {
      return [];
    }

    const buckets = new Map<number, AerodromeCandle>();

    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);

    for (const trade of sortedTrades) {
      const bucketStart = Math.floor(trade.timestamp / resolutionMs) * resolutionMs;
      let candle = buckets.get(bucketStart);

      if (!candle) {
        candle = {
          open: trade.priceInCounter,
          high: trade.priceInCounter,
          low: trade.priceInCounter,
          close: trade.priceInCounter,
          volumeToken: 0,
          volumeCounter: 0,
          startTime: bucketStart,
          resolution,
        };
        buckets.set(bucketStart, candle);
      }

      candle.high = Math.max(candle.high, trade.priceInCounter);
      candle.low = Math.min(candle.low, trade.priceInCounter);
      candle.close = trade.priceInCounter;

      const tokenVolume = Number(trade.amountToken ?? 0);
      const counterVolume = Number(trade.amountCounter ?? 0);
      candle.volumeToken += Number.isFinite(tokenVolume) ? tokenVolume : 0;
      candle.volumeCounter += Number.isFinite(counterVolume) ? counterVolume : 0;
    }

    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, candle]) => candle);
  }

  private resolutionToMs(resolution: Resolution): number {
    switch (resolution) {
      case '5m':
        return 5 * 60 * 1000;
      case '15m':
        return 15 * 60 * 1000;
      case '1h':
        return 60 * 60 * 1000;
      case '4h':
        return 4 * 60 * 60 * 1000;
      case '1d':
        return 24 * 60 * 60 * 1000;
      default:
        return 5 * 60 * 1000;
    }
  }

  private getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
    cache.set(key, {
      data,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }

}
