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
      const price = await this.getFromAerodrome();
      if (price) {
        this.cachePrice(price);
        return {
          price,
          source: 'aerodrome',
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      console.warn('[AcesUsdPrice] Aerodrome failed:', error);
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

    console.warn('[AcesUsdPrice] All sources failed, returning fallback price of 0');
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

    // Get ACES price in WETH
    const acesWethPool = await (this.aerodromeService as any).getPoolState?.(
      this.acesTokenAddress,
      ACES_WETH_POOL,
    );

    if (!acesWethPool) {
      console.warn('[AcesUsdPrice] ACES/WETH pool not available');
      return null;
    }

    const acesPerWeth = parseFloat(String(acesWethPool.priceInCounter));
    if (!isFinite(acesPerWeth) || acesPerWeth <= 0) {
      console.warn('[AcesUsdPrice] Invalid ACES/WETH price:', acesPerWeth);
      return null;
    }

    // Resolve WETH→USD (USDC) leg
    const WETH_USDC_POOL = (
      process.env.WETH_USDC_POOL || '0xcdac0d6c6c59727a65f871236188350531885c43'
    ) // Base USDC/WETH v3 0.05%
      .toLowerCase();

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

    if (wethUsdPrice && isFinite(wethUsdPrice) && wethUsdPrice > 0) {
      const acesUsd = acesPerWeth * wethUsdPrice;
      return acesUsd.toFixed(6);
    }

    // Fallback: return ACES/WETH price only (frontend can convert later)
    console.warn('[AcesUsdPrice] WETH/USDC leg unavailable, returning ACES/WETH price only');
    return acesPerWeth.toFixed(6);
  }

  /**
   * Compute WETH→USD (USDC) price from a Uniswap V3/CL pool using slot0().
   * Returns USDC per 1 WETH.
   */
  private async getWethUsdFromV3Pool(poolAddress: string): Promise<number | null> {
    const provider = this.getProvider();
    const pool = new ethers.Contract(poolAddress, V3_POOL_ABI, provider);

    const [token0, token1] = await Promise.all([pool.token0(), pool.token1()]);
    const t0 = (token0 as string).toLowerCase();
    const t1 = (token1 as string).toLowerCase();

    // Read sqrtPriceX96 from slot0
    const [sqrtPriceX96] = await pool.slot0();
    const sqrt = BigInt(sqrtPriceX96);

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
