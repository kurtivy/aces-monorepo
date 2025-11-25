import { ethers } from 'ethers';
import type { FastifyInstance } from 'fastify';
import { getProvider } from '../lib/provider-manager';

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

// Slipstream (Uniswap V3 style) pool ABI for CL pools
const SLIPSTREAM_POOL_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)',
  'function liquidity() view returns (uint128)',
];

export interface AerodromeDataServiceOptions {
  rpcUrl?: string;
  factoryAddress?: string;
  acesTokenAddress: string;
  defaultStable?: boolean;
  mockEnabled?: boolean;
  mockData?: AerodromeMockData;
  provider?: ethers.JsonRpcProvider;
  fastify?: FastifyInstance; // 🔥 PHASE 3: Add fastify instance for cache plugin access
}

export interface AerodromeMockData {
  pools?: Record<string, AerodromePoolState>;
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

interface AerodromeGenericPoolState {
  poolAddress: string;
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
  stable: boolean;
  lastUpdated: number;
}

export class AerodromeDataService {
  private readonly provider: ethers.JsonRpcProvider | null;
  private readonly factoryAddress?: string;
  private readonly acesTokenAddress: string;
  private readonly defaultStable: boolean;
  private readonly mockEnabled: boolean;
  private readonly mockData: AerodromeMockData;
  private readonly fastify?: FastifyInstance; // 🔥 PHASE 3: Fastify instance for cache plugin
  private readonly decimalsCache = new Map<string, number>();

  constructor(options: AerodromeDataServiceOptions) {
    this.acesTokenAddress = options.acesTokenAddress.toLowerCase();
    this.factoryAddress = options.factoryAddress;
    this.defaultStable = options.defaultStable ?? false;
    this.mockEnabled = options.mockEnabled ?? process.env.USE_DEX_MOCKS === 'true';
    this.mockData = options.mockData || { pools: {} };
    this.fastify = options.fastify; // 🔥 PHASE 3: Store fastify instance

    if (!this.mockEnabled) {
      // 🔥 PHASE 3: Use shared provider from provider manager, fallback to provided or create new
      if (options.provider) {
        this.provider = options.provider;
      } else if (options.rpcUrl) {
        this.provider = new ethers.JsonRpcProvider(options.rpcUrl);
      } else {
        // Use shared provider from provider manager (Base Mainnet 8453)
        try {
          this.provider = getProvider(8453);
        } catch (error) {
          throw new Error(
            `AerodromeDataService: Could not get provider. ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      if (!this.factoryAddress) {
        throw new Error(
          'AerodromeDataService: factoryAddress is required when mock mode is disabled',
        );
      }
    } else {
      this.provider = null;
    }
  }

  async getPoolState(
    tokenAddress: string,
    knownPoolAddress?: string,
  ): Promise<AerodromePoolState | null> {
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

    const cacheKey = `${normalizedToken}-${knownPoolAddress || 'unknown'}`;

    if (this.fastify?.cache) {
      const cached = this.fastify.cache.get<AerodromePoolState>('poolReserves', cacheKey);
      if (cached) {
        return cached;
      }
    }

    let poolAddress: string | null = null;
    let usedKnownAddress = false;

    if (knownPoolAddress) {
      console.log(`🔍 Using known pool address: ${knownPoolAddress}`);
      poolAddress = knownPoolAddress.toLowerCase();
      usedKnownAddress = true;
    } else {
      console.log(`🔍 Resolving pool address from factory for token: ${normalizedToken}`);
      poolAddress = await this.resolvePoolAddress(normalizedToken);
    }

    if (!poolAddress || poolAddress === ethers.ZeroAddress) {
      console.log(`❌ Invalid pool address: ${poolAddress}`);
      return null;
    }

    console.log(`📍 Pool address resolved to: ${poolAddress}`);

    try {
      const poolState = await this.readV2PoolState(poolAddress, normalizedToken);

      if (this.fastify?.cache) {
        this.fastify.cache.set('poolReserves', cacheKey, poolState, 10 * 1000); // 10s TTL
      }

      return poolState;
    } catch (error) {
      console.error(`❌ ERROR calling pool contract at ${poolAddress}:`, error);

      const isInvalidPool = this.isInvalidPoolError(error);

      if (isInvalidPool && usedKnownAddress) {
        console.warn(
          `[AerodromeDataService] Known pool ${poolAddress} failed. Retrying with factory resolution...`,
        );

        if (this.fastify?.cache) {
          this.fastify.cache.invalidate('poolReserves', cacheKey);
        }

        const fallbackAddress = await this.resolvePoolAddress(normalizedToken);
        if (
          fallbackAddress &&
          fallbackAddress !== poolAddress &&
          fallbackAddress !== ethers.ZeroAddress
        ) {
          try {
            const fallbackState = await this.readV2PoolState(fallbackAddress, normalizedToken);
            const fallbackCacheKey = `${normalizedToken}-${fallbackAddress}`;
            if (this.fastify?.cache) {
              this.fastify.cache.set('poolReserves', fallbackCacheKey, fallbackState, 10 * 1000);
            }
            return fallbackState;
          } catch (fallbackError) {
            console.error(
              `[AerodromeDataService] Fallback pool ${fallbackAddress} also failed:`,
              fallbackError,
            );
          }
        }
      }

      return null;
    }
  }

  async getPairReserves(
    tokenIn: string,
    tokenOut: string,
    knownPoolAddress?: string,
  ): Promise<{
    poolAddress: string;
    reserveIn: bigint;
    reserveOut: bigint;
    decimalsIn: number;
    decimalsOut: number;
    stable: boolean;
  } | null> {
    console.log(`[getPairReserves] Called with:`, {
      tokenIn: tokenIn.slice(0, 10) + '...',
      tokenOut: tokenOut.slice(0, 10) + '...',
      knownPoolAddress: knownPoolAddress ? knownPoolAddress.slice(0, 10) + '...' : 'none',
    });

    const state = await this.getGenericPoolState(tokenIn, tokenOut, knownPoolAddress);
    console.log(`[getPairReserves] getGenericPoolState returned: ${state ? 'STATE' : 'NULL'}`);

    if (!state) {
      return null;
    }

    const normalizedIn = tokenIn.toLowerCase();
    const normalizedOut = tokenOut.toLowerCase();

    let reserveIn: bigint;
    let reserveOut: bigint;

    if (state.token0 === normalizedIn && state.token1 === normalizedOut) {
      reserveIn = BigInt(state.reserve0);
      reserveOut = BigInt(state.reserve1);
    } else if (state.token0 === normalizedOut && state.token1 === normalizedIn) {
      reserveIn = BigInt(state.reserve1);
      reserveOut = BigInt(state.reserve0);
    } else {
      return null;
    }

    const decimalsIn = await this.getTokenDecimals(normalizedIn);
    const decimalsOut = await this.getTokenDecimals(normalizedOut);

    return {
      poolAddress: state.poolAddress,
      reserveIn,
      reserveOut,
      decimalsIn,
      decimalsOut,
      stable: state.stable,
    };
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
    const poolAddress = await factory.getPair(
      tokenAddress,
      this.acesTokenAddress,
      this.defaultStable,
    );
    return (poolAddress as string).toLowerCase();
  }

  private async resolvePairAddress(
    tokenA: string,
    tokenB: string,
  ): Promise<{ address: string; stable: boolean } | null> {
    if (this.mockEnabled) {
      return null;
    }

    if (!this.provider || !this.factoryAddress) {
      return null;
    }

    const normalizedA = tokenA.toLowerCase();
    const normalizedB = tokenB.toLowerCase();
    console.log(
      `🔍 [AerodromeService] Resolving pair: ${normalizedA.slice(0, 8)}... / ${normalizedB.slice(0, 8)}...`,
    );

    const factory = new ethers.Contract(this.factoryAddress, FACTORY_ABI, this.provider);

    const attempts = this.defaultStable ? [true, false] : [false, true];

    for (const stable of attempts) {
      try {
        console.log(`  Trying ${stable ? 'stable' : 'volatile'} pool...`);
        const pairAddress = await factory.getPair(normalizedA, normalizedB, stable);
        console.log(`  Result: ${pairAddress}`);
        if (pairAddress && pairAddress !== ethers.ZeroAddress) {
          console.log(`  ✅ Found ${stable ? 'stable' : 'volatile'} pool at ${pairAddress}`);
          return { address: (pairAddress as string).toLowerCase(), stable };
        }
      } catch (error) {
        console.error(`  ❌ Failed to query ${stable ? 'stable' : 'volatile'} pool:`, error);
      }
    }

    console.log(`  ❌ No pool found for this pair`);
    return null;
  }

  private async getGenericPoolState(
    tokenA: string,
    tokenB: string,
    knownPoolAddress?: string,
  ): Promise<AerodromeGenericPoolState | null> {
    const normalizedA = tokenA.toLowerCase();
    const normalizedB = tokenB.toLowerCase();
    const cacheKey =
      normalizedA < normalizedB
        ? `${normalizedA}-${normalizedB}-${knownPoolAddress || 'unknown'}`
        : `${normalizedB}-${normalizedA}-${knownPoolAddress || 'unknown'}`;

    // console.log(`[getGenericPoolState] Called with:`);
    // console.log(`  tokenA: ${normalizedA}`);
    // console.log(`  tokenB: ${normalizedB}`);
    // console.log(`  knownPoolAddress: ${knownPoolAddress || 'none'}`);
    // console.log(`  cacheKey: ${cacheKey}`);

    // 🔥 PHASE 3: Use cache plugin if available
    if (this.fastify?.cache) {
      const cached = this.fastify.cache.get<AerodromeGenericPoolState>('poolReserves', cacheKey);
      if (cached) {
        console.log(`  ✅ Returning cached pool state (from cache plugin)`);
        return cached;
      }
    }

    if (this.mockEnabled) {
      console.log(`  ⚠️ Mock mode enabled, returning null`);
      return null;
    }

    if (!this.provider) {
      console.log(`  ❌ No provider available`);
      return null;
    }

    let pair: { address: string; stable: boolean } | null = null;
    const usedKnownAddress = Boolean(knownPoolAddress && knownPoolAddress !== ethers.ZeroAddress);

    // Use known pool address if provided
    if (knownPoolAddress && knownPoolAddress !== ethers.ZeroAddress) {
      console.log(`  ✅ Using known pool address: ${knownPoolAddress}`);
      pair = { address: knownPoolAddress.toLowerCase(), stable: false };
    } else {
      console.log(`  🔍 Resolving pair address from factory...`);
      pair = await this.resolvePairAddress(normalizedA, normalizedB);
    }

    if (!pair) {
      console.log(`  ❌ No pair found`);
      return null;
    }

    console.log(`  📍 Using pool address: ${pair.address}`);

    try {
      console.log(`  📞 Creating contract and calling getReserves()...`);
      const pairContract = new ethers.Contract(pair.address, PAIR_ABI, this.provider);
      const [reserve0, reserve1] = await pairContract.getReserves();
      console.log(`  ✅ Got reserves - reserve0: ${reserve0}, reserve1: ${reserve1}`);

      console.log(`  📞 Fetching token0 and token1...`);
      const token0 = ((await pairContract.token0()) as string).toLowerCase();
      const token1 = ((await pairContract.token1()) as string).toLowerCase();
      console.log(`  ✅ token0: ${token0}`);
      console.log(`  ✅ token1: ${token1}`);

      const state: AerodromeGenericPoolState = {
        poolAddress: pair.address,
        token0,
        token1,
        reserve0: reserve0.toString(),
        reserve1: reserve1.toString(),
        stable: pair.stable,
        lastUpdated: Date.now(),
      };

      console.log(`  ✅ Pool state created successfully, caching...`);
      // 🔥 PHASE 3: Use cache plugin if available
      if (this.fastify?.cache) {
        this.fastify.cache.set('poolReserves', cacheKey, state, 10 * 1000); // 10s TTL
      }
      return state;
    } catch (error) {
      console.error(`❌ ERROR reading V2 pool state for ${pair.address}:`, error);
      console.log(`  🔄 Attempting to read as Slipstream (V3) pool...`);

      // Try reading as a Slipstream/V3 pool
      try {
        const v3Result = await this.readSlipstreamPool(pair.address);
        if (v3Result) {
          console.log(`  ✅ Successfully read as Slipstream pool, caching...`);
          // 🔥 PHASE 3: Use cache plugin if available
          if (this.fastify?.cache) {
            this.fastify.cache.set('poolReserves', cacheKey, v3Result, 10 * 1000); // 10s TTL
          }
          return v3Result;
        }
      } catch (v3Error) {
        console.error(`  ❌ Failed to read as Slipstream pool:`, v3Error);
      }

      if (usedKnownAddress && this.isInvalidPoolError(error)) {
        console.warn(
          `  ⚠️ Known pool ${pair.address} failed validation, retrying with factory lookup...`,
        );
        if (this.fastify?.cache) {
          this.fastify.cache.invalidate('poolReserves', cacheKey);
        }
        return this.getGenericPoolState(tokenA, tokenB);
      }

      console.error(`   Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any)?.code,
        reason: (error as any)?.reason,
      });
      return null;
    }
  }

  /**
   * Read a Slipstream (V3) pool and convert it to V2-compatible format with synthetic reserves
   */
  private async readSlipstreamPool(poolAddress: string): Promise<AerodromeGenericPoolState | null> {
    if (!this.provider) {
      return null;
    }

    const pool = new ethers.Contract(poolAddress, SLIPSTREAM_POOL_ABI, this.provider);

    // Read token addresses
    const [token0, token1] = await Promise.all([pool.token0(), pool.token1()]);
    const t0 = (token0 as string).toLowerCase();
    const t1 = (token1 as string).toLowerCase();

    console.log(`  📊 Slipstream pool tokens: ${t0} / ${t1}`);

    // Read slot0 for price data
    const [sqrtPriceX96, , , , , ,] = await pool.slot0();
    const sqrt = BigInt(sqrtPriceX96);

    console.log(`  📊 sqrtPriceX96: ${sqrt}`);

    // Get decimals for both tokens
    const d0 = await this.getTokenDecimals(t0);
    const d1 = await this.getTokenDecimals(t1);

    console.log(`  📊 Decimals: ${d0} / ${d1}`);

    // Calculate price: price1Per0 = (sqrtPriceX96 / 2^96) ^ 2
    // Then adjust for decimals: price1Per0 * 10^(d0 - d1)
    const numerator = sqrt * sqrt;
    const q192 = 2n ** 192n;
    const base = Number(numerator) / Number(q192);
    const price1Per0 = base * Math.pow(10, d0 - d1);

    console.log(`  📊 price1Per0 (token1 per token0): ${price1Per0}`);

    // Create synthetic reserves that maintain the price ratio
    // We'll use a reasonable liquidity depth (e.g., 1000 units of token0)
    const syntheticToken0Amount = 1000n * 10n ** BigInt(d0);
    const syntheticToken1Amount = BigInt(Math.floor(Number(syntheticToken0Amount) * price1Per0));

    console.log(`  📊 Synthetic reserves: ${syntheticToken0Amount} / ${syntheticToken1Amount}`);

    return {
      poolAddress: poolAddress.toLowerCase(),
      token0: t0,
      token1: t1,
      reserve0: syntheticToken0Amount.toString(),
      reserve1: syntheticToken1Amount.toString(),
      stable: false, // V3 pools are volatile
      lastUpdated: Date.now(),
    };
  }

  private async readV2PoolState(
    poolAddress: string,
    normalizedToken: string,
  ): Promise<AerodromePoolState> {
    if (!this.provider) {
      throw new Error('Provider unavailable for pool state read');
    }

    console.log(`🔄 Creating contract for pool: ${poolAddress}`);
    const pairContract = new ethers.Contract(poolAddress, PAIR_ABI, this.provider);

    console.log(`📞 Calling getReserves() on pool contract...`);
    const [reserve0, reserve1] = await pairContract.getReserves();
    console.log(`✅ Got reserves - reserve0: ${reserve0}, reserve1: ${reserve1}`);

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

    return {
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
  }

  private async getTokenDecimals(address: string): Promise<number> {
    const normalized = address.toLowerCase();

    // 🔥 PHASE 3: Use cache plugin if available (tokenDecimals cache has 24h TTL)
    if (this.fastify?.cache) {
      const cached = this.fastify.cache.get<number>('tokenDecimals', normalized);
      if (cached !== null) {
        return cached;
      }
    } else {
      // Fallback to internal cache
      if (this.decimalsCache.has(normalized)) {
        return this.decimalsCache.get(normalized)!;
      }
    }

    if (this.mockEnabled) {
      const decimals = normalized === this.acesTokenAddress ? 18 : 18;
      if (this.fastify?.cache) {
        this.fastify.cache.set('tokenDecimals', normalized, decimals, 24 * 60 * 60 * 1000); // 24h TTL
      } else {
        this.decimalsCache.set(normalized, decimals);
      }
      return decimals;
    }

    if (!this.provider) {
      throw new Error('Provider unavailable for decimals lookup');
    }

    const erc20 = new ethers.Contract(normalized, ERC20_ABI, this.provider);
    const decimals = await erc20.decimals();
    const decimalsNum = Number(decimals);

    // 🔥 PHASE 3: Cache in plugin or internal cache
    if (this.fastify?.cache) {
      this.fastify.cache.set('tokenDecimals', normalized, decimalsNum, 24 * 60 * 60 * 1000); // 24h TTL
    } else {
      this.decimalsCache.set(normalized, decimalsNum);
    }

    return decimalsNum;
  }

  private isInvalidPoolError(error: any): boolean {
    if (!error) {
      return false;
    }

    const code = (error as any)?.code;
    const message = (error as any)?.message?.toLowerCase?.() ?? '';
    const data = (error as any)?.data;

    return (
      code === 'BAD_DATA' ||
      code === 'CALL_EXCEPTION' ||
      message.includes('could not decode result data') ||
      message.includes('missing revert data') ||
      message.includes('execution reverted') ||
      data === '0x'
    );
  }
}
