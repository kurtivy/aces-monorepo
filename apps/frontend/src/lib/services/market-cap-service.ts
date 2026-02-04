/**
 * Market Cap Service - DEX-Only
 *
 * Provides current (real-time) market cap calculations for DEX tokens only.
 * Uses pool reserves from RPC provider.
 */

import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import { Decimal } from 'decimal.js';
import { getPriceCacheService } from './price-cache-service';
import { createRpcProvider, getDefaultRpcUrl } from '../utils/rpc-provider';

interface MarketCapData {
  marketCapUsd: number;
  currentPriceUsd: number;
  supply: number;
  rewardSupply: number; // Actual circulating supply for reward calculations (excludes LP tokens)
  source: 'dex_pool' | 'cached';
  calculatedAt: number;
}

interface PoolReserves {
  reserve0: string;
  reserve1: string;
  token0: string;
  token1: string;
  blockNumber: number;
}

const DEX_SUPPLY = 1_000_000_000; // 1B after DEX graduation
const CACHE_TTL_MS = 5000; // 5 seconds

export class MarketCapService {
  private cache = new Map<string, { data: MarketCapData; expiresAt: number }>();
  private cacheHits = 0;
  private cacheMisses = 0;
  private provider: ethers.providers.JsonRpcProvider;

  constructor(private prisma: PrismaClient) {
    const rpcUrl = getDefaultRpcUrl();

    // Use custom provider creation to avoid referrer header issues
    this.provider = createRpcProvider(rpcUrl, {
      name: 'base',
      chainId: 8453,
    });
  }

  /**
   * Get current market cap - DEX-only mode.
   * Returns null when the token has no DEX pool or reserves (e.g. not yet on DEX, or no poolAddress in DB).
   */
  async getMarketCap(tokenAddress: string, chainId: number = 8453): Promise<MarketCapData | null> {
    try {
      const normalizedAddress = tokenAddress.toLowerCase();

      // Check cache first
      const cached = this.cache.get(normalizedAddress);
      if (cached && cached.expiresAt > Date.now()) {
        this.cacheHits++;
        return cached.data;
      }

      this.cacheMisses++;

      // All tokens are DEX-only when they have a pool; otherwise no market cap
      const marketCapData = await this.getDexMarketCap(normalizedAddress, chainId);
      if (!marketCapData) {
        return null;
      }

      // Cache the result only when we have data
      this.cache.set(normalizedAddress, {
        data: marketCapData,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      return marketCapData;
    } catch (error) {
      console.error(`[MarketCapService] Error fetching market cap for ${tokenAddress}:`, error);
      return null;
    }
  }

  /**
   * Get market cap for DEX token from pool reserves.
   * Returns null when the token has no pool or reserves (no throw).
   */
  private async getDexMarketCap(
    tokenAddress: string,
    _chainId: number,
  ): Promise<MarketCapData | null> {
    try {
      const poolData = await this.getDexFromPoolReserves(tokenAddress);
      return poolData ?? null;
    } catch (poolError) {
      console.warn('[MarketCapService] Pool reserves fetch failed:', poolError);
      return null;
    }
  }

  /**
   * Get market cap from DEX pool reserves
   */
  private async getDexFromPoolReserves(tokenAddress: string): Promise<MarketCapData | null> {
    try {
      // Get pool address for this token
      const poolAddress = await this.getTokenPoolAddress(tokenAddress);
      if (!poolAddress) {
        console.warn(`[MarketCapService] No pool address found for ${tokenAddress}`);
        return null;
      }

      // console.log(`[MarketCapService] Fetching pool reserves for pool: ${poolAddress}`);

      // Fetch pool reserves
      const reserves = await this.getPoolReserves(poolAddress);
      if (!reserves) {
        console.warn(`[MarketCapService] Failed to fetch pool reserves for ${poolAddress}`);
        return null;
      }

      // console.log(`[MarketCapService] Pool reserves:`, {
      //   reserve0: reserves.reserve0,
      //   reserve1: reserves.reserve1,
      // });

      // Calculate price from reserves (token price in ACES)
      const priceAces = this.calculatePriceFromReserves(reserves);
      // console.log(`[MarketCapService] Price in ACES: ${priceAces}`);

      // Get ACES/USD price
      let acesUsdPrice = 0;
      try {
        const priceService = getPriceCacheService();
        const priceData = await priceService.getPrices();
        acesUsdPrice = priceData.acesUsd;

        if (!Number.isFinite(acesUsdPrice) || acesUsdPrice === 0) {
          console.warn('[MarketCapService] ACES price is not valid:', acesUsdPrice);
          return null;
        }
      } catch (priceError) {
        console.error('[MarketCapService] Error getting ACES USD price:', priceError);
        return null;
      }
      // console.log(`[MarketCapService] ACES/USD Price: ${acesUsdPrice}`);

      // Calculate market cap
      const currentPriceUsd = priceAces * acesUsdPrice;
      const marketCapUsd = currentPriceUsd * DEX_SUPPLY;

      // Calculate reward supply: Total supply minus tokens locked in LP
      // Determine which reserve is the token (not ACES)
      const acesAddress = (
        process.env.ACES_TOKEN_ADDRESS || '0x55337650856299363c496065C836B9C6E9dE0367'
      ).toLowerCase();
      const isToken0Aces = reserves.token0.toLowerCase() === acesAddress;
      const tokenReserveWei = new Decimal(isToken0Aces ? reserves.reserve1 : reserves.reserve0);
      const tokenReserveHuman = tokenReserveWei.div(new Decimal('1e18')).toNumber();
      const rewardSupply = Math.max(0, DEX_SUPPLY - tokenReserveHuman);

      // console.log(`[MarketCapService] Calculated market cap:`, {
      //   currentPriceUsd,
      //   marketCapUsd,
      //   supply: DEX_SUPPLY,
      //   rewardSupply,
      //   tokensInLP: tokenReserveHuman,
      //   isToken0Aces,
      // });

      return {
        marketCapUsd,
        currentPriceUsd,
        supply: DEX_SUPPLY,
        rewardSupply, // Actual circulating = 1B - LP tokens
        source: 'dex_pool',
        calculatedAt: Date.now(),
      };
    } catch (error) {
      console.error('[MarketCapService] Pool reserves market cap error:', error);
      return null;
    }
  }

  /**
   * Get pool address for a token
   */
  private async getTokenPoolAddress(tokenAddress: string): Promise<string | null> {
    try {
      const token = await this.prisma.token.findUnique({
        where: { contractAddress: tokenAddress.toLowerCase() },
      });

      return token?.poolAddress || null;
    } catch (error) {
      console.error('[MarketCapService] Error getting pool address:', error);
      return null;
    }
  }

  /**
   * Get current pool reserves from RPC
   */
  private async getPoolReserves(poolAddress: string): Promise<PoolReserves | null> {
    try {
      // Aerodrome pool ABI (Uniswap V2 compatible)
      const poolAbi = [
        'function getReserves() public view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
        'function token0() view returns (address)',
        'function token1() view returns (address)',
      ];

      const poolContract = new ethers.Contract(poolAddress, poolAbi, this.provider);

      // Fetch reserves, token addresses, and block number in parallel
      const [reserves, token0Address, token1Address, blockNumber] = await Promise.all([
        poolContract.getReserves(),
        poolContract.token0(),
        poolContract.token1(),
        this.provider.getBlockNumber(),
      ]);

      const [reserve0, reserve1] = reserves;

      return {
        reserve0: reserve0.toString(),
        reserve1: reserve1.toString(),
        token0: token0Address,
        token1: token1Address,
        blockNumber,
      };
    } catch (error) {
      console.error('[MarketCapService] Error fetching pool reserves:', error);
      return null;
    }
  }

  /**
   * Calculate price from pool reserves
   * Determines token order dynamically (doesn't assume ACES position)
   */
  private calculatePriceFromReserves(reserves: PoolReserves): number {
    const acesAddress = (
      process.env.ACES_TOKEN_ADDRESS || '0x55337650856299363c496065C836B9C6E9dE0367'
    ).toLowerCase();

    const isToken0Aces = reserves.token0.toLowerCase() === acesAddress;
    const isToken1Aces = reserves.token1.toLowerCase() === acesAddress;

    if (!isToken0Aces && !isToken1Aces) {
      throw new Error('ACES token not found in pool reserves');
    }

    const acesReserve = new Decimal(isToken0Aces ? reserves.reserve0 : reserves.reserve1);
    const tokenReserve = new Decimal(isToken0Aces ? reserves.reserve1 : reserves.reserve0);

    if (tokenReserve.isZero()) {
      throw new Error('Token reserve is zero');
    }

    // Price = ACES reserve / Token reserve (how many ACES per token)
    return acesReserve.div(tokenReserve).toNumber();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      entries: Array.from(this.cache.entries()).map(([key, value]) => ({
        key,
        expiresAt: value.expiresAt,
      })),
    };
  }
}

// Singleton instance
let marketCapServiceInstance: MarketCapService | null = null;

export function getMarketCapService(prisma: PrismaClient): MarketCapService {
  if (!marketCapServiceInstance) {
    marketCapServiceInstance = new MarketCapService(prisma);
  }
  return marketCapServiceInstance;
}
