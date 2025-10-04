import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

// Minimal ABI for ERC20 and Uniswap V3 pool
const ERC20_ABI = ['function decimals() view returns (uint8)'];
const UNISWAP_V3_POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
];

const AERODROME_POOL_ABI = [
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
];

interface PriceData {
  symbol: string;
  priceUSD: string;
  updatedAt: Date;
  isStale: boolean;
}

// Simple throttling mechanism
class SimpleThrottler {
  private lastRequestTime = 0;
  private readonly minInterval = 1000; // 1 second between requests

  async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}

export class PriceService {
  private provider: ethers.JsonRpcProvider;
  private cacheTTL: number;
  private throttler: SimpleThrottler;

  constructor(private prisma: PrismaClient) {
    this.provider = new ethers.JsonRpcProvider(process.env.QUICKNODE_BASE_URL);
    this.cacheTTL = parseInt(process.env.PRICE_CACHE_TTL_SECONDS || '60') * 1000;
    this.throttler = new SimpleThrottler();
  }

  /**
   * Get ACES price in USD with caching and throttling
   */
  async getAcesPrice(): Promise<PriceData> {
    try {
      // Check cache first
      const cached = await this.prisma.tokenPrice.findUnique({
        where: { symbol: 'ACES' },
      });

      const now = new Date();
      const isStale = !cached || now.getTime() - cached.updatedAt.getTime() > this.cacheTTL;

      // Return cached if fresh
      if (cached && !isStale) {
        return {
          symbol: 'ACES',
          priceUSD: cached.priceUSD.toString(),
          updatedAt: cached.updatedAt,
          isStale: false,
        };
      }

      // Apply throttling before making blockchain calls
      await this.throttler.throttle();

      // Fetch fresh price
      const acesPerWeth = await this.getAcesPerWeth();
      const wethUsdPrice = await this.getWethUsdPrice();
      const acesUsdPrice = acesPerWeth * wethUsdPrice;

      // Validate price is reasonable
      if (!this.validatePrice(acesUsdPrice)) {
        throw new Error(`Invalid price calculated: ${acesUsdPrice}`);
      }

      // Update cache
      await this.prisma.tokenPrice.upsert({
        where: { symbol: 'ACES' },
        update: { priceUSD: acesUsdPrice.toFixed(8) },
        create: { symbol: 'ACES', priceUSD: acesUsdPrice.toFixed(8) },
      });

      return {
        symbol: 'ACES',
        priceUSD: acesUsdPrice.toFixed(8),
        updatedAt: now,
        isStale: false,
      };
    } catch (error) {
      console.error('[PriceService] Error fetching ACES price:', error);

      // Return cached price as fallback
      const cached = await this.prisma.tokenPrice.findUnique({
        where: { symbol: 'ACES' },
      });

      if (cached) {
        return {
          symbol: 'ACES',
          priceUSD: cached.priceUSD.toString(),
          updatedAt: cached.updatedAt,
          isStale: true,
        };
      }

      throw new Error('Unable to fetch ACES price and no cached price available');
    }
  }

  /**
   * Convert ACES amount to USD
   */
  async convertAcesToUsd(acesAmount: string): Promise<string> {
    const priceData = await this.getAcesPrice();
    const amount = parseFloat(acesAmount);
    const price = parseFloat(priceData.priceUSD);
    return (amount * price).toFixed(2);
  }

  /**
   * Get ACES price per WETH from Aerodrome pool
   * Fixed: Now correctly calculates WETH/ACES ratio
   */
  private async getAcesPerWeth(): Promise<number> {
    const poolAddress = process.env.AERODROME_ACES_WETH_POOL!;
    const acesAddress = process.env.ACES_TOKEN_ADDRESS!;

    const pool = new ethers.Contract(poolAddress, AERODROME_POOL_ABI, this.provider);

    const [reserve0, reserve1] = await pool.getReserves();
    const token0 = await pool.token0();

    // Determine which reserve is ACES
    const isToken0Aces = token0.toLowerCase() === acesAddress.toLowerCase();
    const acesReserve = isToken0Aces ? reserve0 : reserve1;
    const wethReserve = isToken0Aces ? reserve1 : reserve0;

    // Price = WETH / ACES (how much WETH you get per ACES)
    return (
      parseFloat(ethers.formatEther(wethReserve)) / parseFloat(ethers.formatEther(acesReserve))
    );
  }

  /**
   * Get WETH price in USD from Uniswap V3 pool
   */
  private async getWethUsdPrice(): Promise<number> {
    const poolAddress = process.env.WETH_USDC_POOL!;
    const wethAddress = process.env.WETH_ADDRESS!;
    const usdcAddress = process.env.USDC_ADDRESS!;

    const pool = new ethers.Contract(poolAddress, UNISWAP_V3_POOL_ABI, this.provider);

    const slot0 = await pool.slot0();
    const sqrtPriceX96 = slot0.sqrtPriceX96;
    const token0 = await pool.token0();

    // Get decimals
    const wethContract = new ethers.Contract(wethAddress, ERC20_ABI, this.provider);
    const usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, this.provider);
    const wethDecimals = await wethContract.decimals();
    const usdcDecimals = await usdcContract.decimals();

    // Calculate price from sqrtPriceX96
    const price =
      (BigInt(sqrtPriceX96.toString()) ** 2n * 10n ** BigInt(wethDecimals)) /
      2n ** 192n /
      10n ** BigInt(usdcDecimals);

    const isToken0Weth = token0.toLowerCase() === wethAddress.toLowerCase();

    if (isToken0Weth) {
      return 1 / parseFloat(ethers.formatUnits(price, usdcDecimals));
    } else {
      return parseFloat(ethers.formatUnits(price, usdcDecimals));
    }
  }

  /**
   * Validate price is within reasonable bounds
   */
  private validatePrice(price: number): boolean {
    return price > 0 && price < 1000000; // Reasonable bounds for token price
  }

  /**
   * Health check for price service
   */
  async healthCheck(): Promise<{
    status: string;
    lastPrice?: string;
    isStale?: boolean;
    updatedAt?: Date;
    error?: string;
  }> {
    try {
      const priceData = await this.getAcesPrice();
      return {
        status: 'ok',
        lastPrice: priceData.priceUSD,
        isStale: priceData.isStale,
        updatedAt: priceData.updatedAt,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
