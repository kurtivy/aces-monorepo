// apps/backend/src/services/aces-usd-price-service.ts
import { ethers } from 'ethers';
import { AerodromeDataService } from './aerodrome-data-service';

interface PriceResult {
  price: string;
  source: 'aerodrome' | 'coingecko' | 'fallback';
  timestamp: number;
}

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Base mainnet canonical token addresses
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'.toLowerCase();
const BASE_WETH = '0x4200000000000000000000000000000000000006'.toLowerCase();

// Uniswap V3 pool ABI bits we need
const V3_POOL_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16,uint16,uint16,uint8,bool)',
];

// (Optional) ERC20 decimals if you want to generalize beyond USDC/WETH
const ERC20_DECIMALS_ABI = ['function decimals() view returns (uint8)'];

export class AcesUsdPriceService {
  private cachedPrice: { price: string; expiresAt: number } | null = null;
  private readonly cacheTtl = 30000; // 30 seconds

  constructor(
    private aerodromeService: AerodromeDataService,
    private acesTokenAddress: string,
  ) {}

  /**
   * Get ACES price (in USD) with caching and fallbacks
   */
  async getAcesUsdPrice(): Promise<PriceResult> {
    // Check cache
    if (this.cachedPrice && Date.now() < this.cachedPrice.expiresAt) {
      return {
        price: this.cachedPrice.price,
        source: 'aerodrome',
        timestamp: Date.now(),
      };
    }

    // Try Aerodrome first (on-chain, most direct)
    try {
      // console.log('[AcesUsdPrice] 🔍 Attempting to fetch from Aerodrome...');
      const price = await this.getFromAerodrome();
      if (price) {
        // console.log('[AcesUsdPrice] ✅ Successfully fetched from Aerodrome:', price);
        this.cachePrice(price);
        return {
          price,
          source: 'aerodrome',
          timestamp: Date.now(),
        };
      } else {
        console.warn('[AcesUsdPrice] ⚠️ Aerodrome returned null price');
      }
    } catch (error) {
      console.error('[AcesUsdPrice] ❌ Aerodrome failed with error:', error);
    }

    // Try CoinGecko (if ACES is listed)
    try {
      const price = await this.getFromCoinGecko();
      if (price) {
        this.cachePrice(price);
        return {
          price,
          source: 'coingecko',
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      console.warn('[AcesUsdPrice] CoinGecko failed:', error);
    }

    // Fallback: Use cached price if available
    if (this.cachedPrice) {
      console.warn('[AcesUsdPrice] Using stale cached price');
      return {
        price: this.cachedPrice.price,
        source: 'fallback',
        timestamp: Date.now(),
      };
    }

    console.error('[AcesUsdPrice] ❌❌❌ ALL SOURCES FAILED - returning fallback price of 0');
    console.error('[AcesUsdPrice] This will cause all USD chart values to be zero!');
    console.error(
      '[AcesUsdPrice] Check: 1) RPC provider, 2) Pool addresses, 3) Network connectivity',
    );
    return {
      price: '0',
      source: 'fallback',
      timestamp: Date.now(),
    };
  }

  /**
   * Get ACES price in USD using:
   *  - ACES/WETH (V2-style) pool for ACES→WETH
   *  - Then WETH/USDC via:
   *      1) V2-style reserves (if env points to a V2 pool), or
   *      2) V3 slot0() math (robust path; works for the canonical USDC/WETH V3 pool)
   */
  private async getFromAerodrome(): Promise<string | null> {
    // ACES/WETH pool (V2-style; supports getReserves/priceInCounter in your existing service)
    const ACES_WETH_POOL = '0x2f97bbd562ba6c4d298b370929ea20291aff9ff5';

    // console.log('[AcesUsdPrice] 📍 Fetching ACES/WETH pool state...', {
    //   acesTokenAddress: this.acesTokenAddress,
    //   poolAddress: ACES_WETH_POOL,
    // });

    // Get ACES price in WETH
    let acesPerWeth: number;
    try {
      const acesWethPool = await (this.aerodromeService as any).getPoolState?.(
        this.acesTokenAddress,
        ACES_WETH_POOL,
      );

      // console.log('[AcesUsdPrice] 🔍 ACES/WETH pool result:', acesWethPool);

      if (!acesWethPool) {
        console.warn('[AcesUsdPrice] ⚠️ ACES/WETH pool returned null/undefined');
        return null;
      }

      acesPerWeth = parseFloat(String(acesWethPool.priceInCounter));
      // console.log('[AcesUsdPrice] 📊 ACES per WETH:', acesPerWeth);

      if (!isFinite(acesPerWeth) || acesPerWeth <= 0) {
        console.warn('[AcesUsdPrice] ⚠️ Invalid ACES/WETH price:', acesPerWeth);
        return null;
      }
    } catch (error) {
      console.error('[AcesUsdPrice] ❌ Error fetching ACES/WETH pool:', error);
      throw error;
    }

    // Resolve WETH→USD (USDC) leg
    // Use Uniswap V3 pool (NOT Aerodrome V2)
    // Base Uniswap V3 WETH/USDC 0.05% pool: 0xd0b53D9277642d899DF5C87A3966A349A798F224
    // Note: Using separate env var to avoid conflicts with Aerodrome V2 swap routing
    const WETH_USDC_POOL = (
      process.env.WETH_USDC_V3_POOL || // Dedicated V3 pool for price conversion
      process.env.WETH_USDC_POOL || // Fallback to general one
      '0xd0b53D9277642d899DF5C87A3966A349A798F224'
    ) // Default: Uniswap V3
      .toLowerCase();

    // console.log('[AcesUsdPrice] 📍 Fetching WETH/USDC pool...', {
    //   poolAddress: WETH_USDC_POOL,
    //   forceV3: process.env.FORCE_WETH_USDC_V3,
    // });

    let wethUsdPrice: number | null = null;

    if (process.env.FORCE_WETH_USDC_V3 === '1') {
      // Skip V2 entirely; go straight to V3 computation
      wethUsdPrice = await this.getWethUsdFromV3Pool(WETH_USDC_POOL);
    } else {
      // Try V2 via getPoolState() first (works only if this env points to a V2/sAMM pool)
      try {
        const wethUsdcPool = await (this.aerodromeService as any).getPoolState?.(
          BASE_USDC,
          WETH_USDC_POOL,
        );
        if (wethUsdcPool?.reserves) {
          const usdcReserve = parseFloat(String(wethUsdcPool.reserves.token)); // USDC
          const wethReserve = parseFloat(String(wethUsdcPool.reserves.counter)); // WETH
          if (usdcReserve > 0 && wethReserve > 0) {
            wethUsdPrice = usdcReserve / wethReserve; // USDC per WETH
          }
        }
      } catch {
        // ignore; we’ll compute via V3 below
      }

      if (!wethUsdPrice || !isFinite(wethUsdPrice) || wethUsdPrice <= 0) {
        wethUsdPrice = await this.getWethUsdFromV3Pool(WETH_USDC_POOL);
      }
    }

    // console.log('[AcesUsdPrice] 📊 WETH/USD price:', wethUsdPrice);

    if (wethUsdPrice && isFinite(wethUsdPrice) && wethUsdPrice > 0) {
      // Unit sanity:
      // acesPerWeth = ACES per 1 WETH (per Aerodrome naming weth/aces)
      // wethUsdPrice = USD per 1 WETH
      // We want USD per 1 ACES. If acesPerWeth is ACES/WETH, then:
      //   USD/ACES = (USD/WETH) / (ACES/WETH)
      // If instead priceInCounter were WETH/ACES, then USD/ACES = (USD/WETH) * (WETH/ACES).
      const usdPerAces_divide = wethUsdPrice / acesPerWeth;
      const usdPerAces_multiply = wethUsdPrice * acesPerWeth;

      // Choose the one that is sane (avoid absurdly large numbers). ACES should be tiny vs USD.
      // Heuristic: prefer the division path when acesPerWeth >> 1.
      const chosen = acesPerWeth > 1 ? usdPerAces_divide : usdPerAces_multiply;

      // console.log('[AcesUsdPrice] ✅ Final ACES/USD price (sanity-checked):', {
      //   acesPerWeth,
      //   wethUsdPrice,
      //   usdPerAces_divide: usdPerAces_divide.toFixed(10),
      //   usdPerAces_multiply: usdPerAces_multiply.toFixed(10),
      //   chosen: chosen.toFixed(10),
      // });

      return chosen.toFixed(6);
    }

    // CRITICAL: If WETH/USD unavailable, we CANNOT return a valid price
    // Returning ACES/WETH as if it were USD would be completely wrong (off by ~2600x!)
    console.error('[AcesUsdPrice] ❌ WETH/USDC leg unavailable - cannot calculate USD price!');
    console.error('[AcesUsdPrice] ACES/WETH was:', acesPerWeth, 'but we need USD conversion');
    return null;
  }

  /**
   * Compute WETH→USD (USDC) price from a Uniswap V3/CL pool using slot0().
   * Returns USDC per 1 WETH.
   */
  private async getWethUsdFromV3Pool(poolAddress: string): Promise<number | null> {
    // console.log('[AcesUsdPrice] 🔍 Reading V3 pool data...', poolAddress);

    try {
      const provider = this.getProvider();
      // console.log('[AcesUsdPrice] ✅ Got provider:', !!provider);

      const pool = new ethers.Contract(poolAddress, V3_POOL_ABI, provider);

      const [token0, token1] = await Promise.all([pool.token0(), pool.token1()]);
      const t0 = (token0 as string).toLowerCase();
      const t1 = (token1 as string).toLowerCase();

      // console.log('[AcesUsdPrice] 📊 V3 Pool tokens:', { token0: t0, token1: t1 });

      // Read sqrtPriceX96 from slot0
      const [sqrtPriceX96] = await pool.slot0();
      const sqrt = BigInt(sqrtPriceX96);

      // console.log('[AcesUsdPrice] 📊 V3 sqrtPriceX96:', sqrtPriceX96.toString());

      // For USDC/WETH we know the decimals (6 and 18), so we can avoid extra RPC calls.
      const d0 = t0 === BASE_USDC ? 6 : 18;
      const d1 = t1 === BASE_USDC ? 6 : 18;

      // price1Per0 = (sqrt^2 / 2^192) * 10^(dec0 - dec1)
      // Note: converting BigInt -> Number is fine here for display; for exact math use a fixed-point lib.
      const numerator = sqrt * sqrt; // Q64.96 squared
      const q192 = 2n ** 192n;
      const base = Number(numerator) / Number(q192);
      const price1Per0 = base * Math.pow(10, d0 - d1);

      // We want USDC per WETH
      if (t0 === BASE_WETH && t1 === BASE_USDC) {
        // token0 = WETH, token1 = USDC → price1Per0 is USDC per WETH (already desired)
        return price1Per0;
      }
      if (t0 === BASE_USDC && t1 === BASE_WETH) {
        // token0 = USDC, token1 = WETH → price1Per0 is WETH per USDC → invert
        if (price1Per0 === 0) return null;
        return 1 / price1Per0;
      }

      // Unexpected pair ordering; try decimals via ERC20 (rarely needed)
      try {
        const d0x = await this.readDecimals(t0, provider);
        const d1x = await this.readDecimals(t1, provider);
        const price1Per0x = base * Math.pow(10, d0x - d1x);
        // If token0==WETH token1==USDC → return price1Per0x; if opposite → invert
        if (t0 === BASE_WETH && t1 === BASE_USDC) return price1Per0x;
        if (t0 === BASE_USDC && t1 === BASE_WETH) return 1 / price1Per0x;
      } catch (_) {
        // ignore
      }

      return null;
    } catch (error) {
      console.error('[AcesUsdPrice] ❌ Error reading V3 pool:', error);
      return null;
    }
  }

  /**
   * Optional helper to read ERC20 decimals
   */
  private async readDecimals(addr: string, provider: ethers.Provider): Promise<number> {
    if (addr === BASE_USDC) return 6;
    if (addr === BASE_WETH) return 18;
    const erc = new ethers.Contract(addr, ERC20_DECIMALS_ABI, provider);
    return Number(await erc.decimals());
  }

  /**
   * Resolve a Provider from the injected AerodromeDataService.
   * Many services keep `this.provider` internally; even if it's `private` in TS,
   * it exists at runtime, so we can access it here. If yours exposes a getter
   * like `providerRef`, this will also pick it up.
   */
  private getProvider(): ethers.Provider {
    const p = (this.aerodromeService as any).provider ?? (this.aerodromeService as any).providerRef;
    if (!p) {
      throw new Error(
        'AcesUsdPriceService: provider not available. Expose a provider from AerodromeDataService or pass a V3-capable provider.',
      );
    }
    return p as ethers.Provider;
  }

  /**
   * Get price from CoinGecko (if ACES is listed)
   */
  private async getFromCoinGecko(): Promise<string | null> {
    try {
      // Note: Replace 'aces-token' with actual CoinGecko ID if listed
      const response = await fetch(
        `${COINGECKO_API}/simple/price?ids=aces-token&vs_currencies=usd`,
        {
          headers: { Accept: 'application/json' },
        },
      );

      if (!response.ok) return null;

      const data = (await response.json()) as { 'aces-token': { usd: string } };
      return data['aces-token']?.usd?.toString() || null;
    } catch {
      return null;
    }
  }

  /**
   * Cache price
   */
  private cachePrice(price: string): void {
    this.cachedPrice = {
      price,
      expiresAt: Date.now() + this.cacheTtl,
    };
  }
}
