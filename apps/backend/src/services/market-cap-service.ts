/**
 * Market Cap Service - Single Source of Truth
 *
 * Provides current (real-time) market cap calculations independent of chart candle data.
 * Uses different strategies for bonding curve vs DEX phases.
 *
 * Key Features:
 * - Bonding curve: Latest trade from Subgraph + circulating supply
 * - DEX: Pool reserves from QuickNode (primary) or latest trade price from BitQuery (fallback)
 * - In-memory caching (5s TTL) to reduce API calls
 * - Proper error handling with fallback chain
 */

import { BitQueryService } from './bitquery-service';
import { AcesUsdPriceService } from './aces-usd-price-service';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import { Decimal } from 'decimal.js';

interface MarketCapData {
  marketCapUsd: number;
  currentPriceUsd: number;
  supply: number;
  rewardSupply: number; // Actual circulating supply for reward calculations (excludes LP tokens)
  source: 'bonding_curve' | 'dex_pool' | 'dex_bitquery' | 'cached';
  calculatedAt: number;
}

interface PoolReserves {
  reserve0: string;
  reserve1: string;
  token0: string; // Address of token0 in the pool
  token1: string; // Address of token1 in the pool
  blockNumber: number;
}

interface BondingTradeData {
  priceAces: number;
  supply: number;
  timestamp: number;
}

const BONDING_CURVE_SUPPLY = 700_000_000; // 700M
const DEX_SUPPLY = 1_000_000_000; // 1B
const CACHE_TTL_MS = 5000; // 5 seconds
const BONDING_CURVE_ADDRESS =
  process.env.BONDING_CURVE_ADDRESS || '0x0000000000000000000000000000000000000000';

export class MarketCapService {
  private cache = new Map<string, { data: MarketCapData; expiresAt: number }>();
  // 🔥 LOAD TEST FIX: Cache stats for monitoring
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    private prisma: PrismaClient,
    private bitQueryService: BitQueryService,
    private acesUsdPriceService: AcesUsdPriceService,
    private provider: ethers.JsonRpcProvider,
  ) {}

  /**
   * Get current market cap - main entry point
   * Determines phase and delegates to appropriate method
   */
  async getMarketCap(tokenAddress: string, chainId: number = 8453): Promise<MarketCapData> {
    try {
      const normalizedAddress = tokenAddress.toLowerCase();

      // Check cache first
      const cached = this.cache.get(normalizedAddress);
      if (cached && cached.expiresAt > Date.now()) {
        this.cacheHits++; // 🔥 LOAD TEST FIX: Track cache hits
        return cached.data;
      }

      this.cacheMisses++; // 🔥 LOAD TEST FIX: Track cache misses

      // Determine if token is in bonding curve or DEX phase
      const isBondingCurve = await this.isBondingCurveToken(normalizedAddress);

      let marketCapData: MarketCapData;

      if (isBondingCurve) {
        marketCapData = await this.getBondingCurveMarketCap(normalizedAddress);
      } else {
        marketCapData = await this.getDexMarketCap(normalizedAddress, chainId);
      }

      // Cache the result
      this.cache.set(normalizedAddress, {
        data: marketCapData,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      return marketCapData;
    } catch (error) {
      console.error(`[MarketCapService] Error fetching market cap for ${tokenAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get market cap for bonding curve token
   * Sources: Latest Subgraph trade + circulating supply
   */
  private async getBondingCurveMarketCap(tokenAddress: string): Promise<MarketCapData> {
    try {
      // Fetch latest trade and supply from Subgraph
      const tradeData = await this.getLatestBondingTrade(tokenAddress);

      if (!tradeData) {
        throw new Error('No bonding curve trade data available');
      }

      // Get ACES/USD price
      const acesUsdPriceResult = await this.acesUsdPriceService.getAcesUsdPrice();
      // Extract price from result object - service returns { price: string, source: string, timestamp: number }
      const priceValue =
        typeof acesUsdPriceResult === 'object' && 'price' in acesUsdPriceResult
          ? acesUsdPriceResult.price
          : acesUsdPriceResult;
      const acesUsdPrice =
        typeof priceValue === 'number' ? priceValue : parseFloat(String(priceValue));

      // Calculate market cap in USD
      const currentPriceUsd = tradeData.priceAces * acesUsdPrice;
      const marketCapUsd = currentPriceUsd * tradeData.supply;

      return {
        marketCapUsd,
        currentPriceUsd,
        supply: tradeData.supply,
        rewardSupply: tradeData.supply, // For bonding curve, reward supply = actual supply sold
        source: 'bonding_curve',
        calculatedAt: Date.now(),
      };
    } catch (error) {
      console.error('[MarketCapService] Bonding curve market cap error:', error);
      throw new Error(
        `Failed to calculate bonding curve market cap: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get market cap for DEX token
   * Primary: QuickNode pool reserves
   * Fallback: BitQuery latest trade
   */
  private async getDexMarketCap(tokenAddress: string, chainId: number): Promise<MarketCapData> {
    try {
      // Try QuickNode pool reserves first (most accurate)
      const poolData = await this.getDexFromPoolReserves(tokenAddress);
      if (poolData) {
        return poolData;
      }
    } catch (poolError) {
      console.warn('[MarketCapService] Pool reserves fetch failed, trying BitQuery:', poolError);
    }

    try {
      // Fallback to BitQuery latest trade
      const bitqueryData = await this.getDexFromBitQuery(tokenAddress);
      if (bitqueryData) {
        return bitqueryData;
      }
    } catch (bitqueryError) {
      console.error('[MarketCapService] BitQuery fallback also failed:', bitqueryError);
    }

    throw new Error('Failed to fetch DEX market cap from all available sources');
  }

  /**
   * Get market cap from DEX pool reserves (QuickNode)
   */
  private async getDexFromPoolReserves(tokenAddress: string): Promise<MarketCapData | null> {
    try {
      // Get pool address for this token
      const poolAddress = await this.getTokenPoolAddress(tokenAddress);
      if (!poolAddress) {
        console.warn(`[MarketCapService] No pool address found for ${tokenAddress}`);
        return null;
      }

      console.log(`[MarketCapService] Fetching pool reserves for pool: ${poolAddress}`);

      // Fetch pool reserves
      const reserves = await this.getPoolReserves(poolAddress);
      if (!reserves) {
        console.warn(`[MarketCapService] Failed to fetch pool reserves for ${poolAddress}`);
        return null;
      }

      console.log(`[MarketCapService] Pool reserves:`, {
        reserve0: reserves.reserve0,
        reserve1: reserves.reserve1,
      });

      // Calculate price from reserves (token price in ACES)
      const priceAces = this.calculatePriceFromReserves(reserves);
      console.log(`[MarketCapService] Price in ACES: ${priceAces}`);

      // Get ACES/USD price
      let acesUsdPrice = 0;
      try {
        const acesUsdPriceResult = await this.acesUsdPriceService.getAcesUsdPrice();
        console.log(`[MarketCapService] ACES price from service:`, acesUsdPriceResult);

        if (acesUsdPriceResult === null || acesUsdPriceResult === undefined) {
          console.warn(
            '[MarketCapService] ACES price is null/undefined, cannot calculate market cap',
          );
          return null;
        }

        // Extract price from result object - service returns { price: string, source: string, timestamp: number }
        const priceValue =
          typeof acesUsdPriceResult === 'object' && 'price' in acesUsdPriceResult
            ? acesUsdPriceResult.price
            : acesUsdPriceResult;

        acesUsdPrice = typeof priceValue === 'number' ? priceValue : parseFloat(String(priceValue));

        if (!Number.isFinite(acesUsdPrice) || acesUsdPrice === 0) {
          console.warn('[MarketCapService] ACES price is not valid:', acesUsdPrice);
          return null;
        }
      } catch (priceError) {
        console.error('[MarketCapService] Error getting ACES USD price:', priceError);
        return null;
      }
      console.log(`[MarketCapService] ACES/USD Price: ${acesUsdPrice}`);

      // Calculate market cap
      const currentPriceUsd = priceAces * acesUsdPrice;
      const marketCapUsd = currentPriceUsd * DEX_SUPPLY;

      // Calculate reward supply: Total supply minus tokens locked in LP
      // Determine which reserve is the Fun token (not ACES)
      const acesAddress = (
        process.env.ACES_TOKEN_ADDRESS || '0x55337650856299363c496065C836B9C6E9dE0367'
      ).toLowerCase();
      const isToken0Aces = reserves.token0.toLowerCase() === acesAddress;
      const tokenReserveWei = new Decimal(isToken0Aces ? reserves.reserve1 : reserves.reserve0);
      const tokenReserveHuman = tokenReserveWei.div(new Decimal('1e18')).toNumber();
      const rewardSupply = Math.max(0, DEX_SUPPLY - tokenReserveHuman);

      console.log(`[MarketCapService] Calculated market cap:`, {
        currentPriceUsd,
        marketCapUsd,
        supply: DEX_SUPPLY,
        rewardSupply,
        tokensInLP: tokenReserveHuman,
        isToken0Aces,
      });

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
   * Get market cap from BitQuery (fallback)
   */
  private async getDexFromBitQuery(tokenAddress: string): Promise<MarketCapData | null> {
    try {
      // Get latest trade price from BitQuery
      const latestPrice = await this.bitQueryService.getLatestPriceUSD(tokenAddress);
      if (latestPrice === null) {
        return null;
      }

      // Get ACES/USD price for reference
      const acesUsdPrice = await this.acesUsdPriceService.getAcesUsdPrice();

      // Calculate market cap (assuming price is already in USD)
      const marketCapUsd = latestPrice * DEX_SUPPLY;

      // Try to get reward supply from pool reserves (fallback to DEX_SUPPLY if unavailable)
      let rewardSupply = DEX_SUPPLY;
      try {
        const poolAddress = await this.getTokenPoolAddress(tokenAddress);
        if (poolAddress) {
          const reserves = await this.getPoolReserves(poolAddress);
          if (reserves) {
            // Determine which reserve is the Fun token (not ACES)
            const acesAddress = (
              process.env.ACES_TOKEN_ADDRESS || '0x55337650856299363c496065C836B9C6E9dE0367'
            ).toLowerCase();
            const isToken0Aces = reserves.token0.toLowerCase() === acesAddress;
            const tokenReserveWei = new Decimal(
              isToken0Aces ? reserves.reserve1 : reserves.reserve0,
            );
            const tokenReserveHuman = tokenReserveWei.div(new Decimal('1e18')).toNumber();
            rewardSupply = Math.max(0, DEX_SUPPLY - tokenReserveHuman);
          }
        }
      } catch (reserveError) {
        console.warn(
          '[MarketCapService] Could not fetch pool reserves for rewardSupply, using DEX_SUPPLY',
        );
      }

      return {
        marketCapUsd,
        currentPriceUsd: latestPrice,
        supply: DEX_SUPPLY,
        rewardSupply,
        source: 'dex_bitquery',
        calculatedAt: Date.now(),
      };
    } catch (error) {
      console.error('[MarketCapService] BitQuery market cap error:', error);
      return null;
    }
  }

  /**
   * Get latest bonding curve trade data
   */
  private async getLatestBondingTrade(tokenAddress: string): Promise<BondingTradeData | null> {
    try {
      const query = `{
        trades(
          first: 1
          orderBy: createdAt
          orderDirection: desc
          where: { token: "${tokenAddress.toLowerCase()}" }
        ) {
          id
          isBuy
          tokenAmount
          acesTokenAmount
          supply
          createdAt
        }
      }`;

      const subgraphUrl =
        process.env.SUBGRAPH_URL ||
        process.env.GOLDSKY_SUBGRAPH_URL ||
        'https://api.studio.thegraph.com/query/your-subgraph';

      const response = await fetch(subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = (await response.json()) as any;
      const trade = data?.data?.trades?.[0];

      if (!trade) {
        return null;
      }

      // Normalize from wei -> human units to avoid gigantic supplies/price distortions
      const tokenAmount = new Decimal(trade.tokenAmount).div(new Decimal('1e18'));
      const acesTokenAmount = new Decimal(trade.acesTokenAmount).div(new Decimal('1e18'));
      const supplyHuman = new Decimal(trade.supply).div(new Decimal('1e18'));

      if (tokenAmount.isZero() || acesTokenAmount.isZero()) {
        console.warn('[MarketCapService] Bonding trade has zero amounts, skipping price calc');
        return null;
      }

      return {
        priceAces: acesTokenAmount.div(tokenAmount).toNumber(),
        supply: supplyHuman.toNumber(),
        timestamp: parseInt(trade.createdAt) * 1000,
      };
    } catch (error) {
      console.error('[MarketCapService] Bonding trade fetch error:', error);
      return null;
    }
  }

  /**
   * Determine if token is in bonding curve or DEX phase
   */
  private async isBondingCurveToken(tokenAddress: string): Promise<boolean> {
    try {
      // Check database for token graduation status
      const token = await this.prisma.token.findUnique({
        where: { contractAddress: tokenAddress.toLowerCase() },
      });

      if (!token) {
        return false;
      }

      // If token has a pool address and is marked as graduated, it's DEX
      // Otherwise it's still in bonding curve phase
      const priceSource = token.priceSource || 'BONDING_CURVE';
      return priceSource === 'BONDING_CURVE';
    } catch (error) {
      console.error('[MarketCapService] Error checking token phase:', error);
      return false;
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
   * Get current pool reserves from QuickNode
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
   * Price = ACES reserve / Token reserve (ACES per token)
   */
  private calculatePriceFromReserves(reserves: PoolReserves): number {
    try {
      const reserve0 = new Decimal(reserves.reserve0);
      const reserve1 = new Decimal(reserves.reserve1);

      if (reserve0.isZero() || reserve1.isZero()) {
        console.warn('[MarketCapService] One or both reserves are zero, cannot calculate price');
        return 0;
      }

      // Determine which token is ACES (don't assume position)
      const acesAddress = (
        process.env.ACES_TOKEN_ADDRESS || '0x55337650856299363c496065C836B9C6E9dE0367'
      ).toLowerCase();
      const isToken0Aces = reserves.token0.toLowerCase() === acesAddress;

      // Calculate price: ACES reserve / Token reserve
      const acesReserve = isToken0Aces ? reserve0 : reserve1;
      const tokenReserve = isToken0Aces ? reserve1 : reserve0;

      const priceAces = acesReserve.div(tokenReserve).toNumber();

      console.log('[MarketCapService] Reserve calculations:', {
        token0: reserves.token0,
        token1: reserves.token1,
        isToken0Aces,
        reserve0: reserve0.toString(),
        reserve1: reserve1.toString(),
        acesReserve: acesReserve.toString(),
        tokenReserve: tokenReserve.toString(),
        priceAces,
      });

      return priceAces;
    } catch (error) {
      console.error('[MarketCapService] Error calculating price from reserves:', error);
      return 0;
    }
  }

  /**
   * Clear cache for a specific token (useful after trades)
   */
  clearCache(tokenAddress: string): void {
    this.cache.delete(tokenAddress.toLowerCase());
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats (for debugging)
   * 🔥 LOAD TEST FIX: Enhanced with hit/miss tracking
   */
  getCacheStats(): {
    size: number;
    entries: string[];
    hits: number;
    misses: number;
    hitRate: string;
  } {
    const hitRate =
      this.cacheHits + this.cacheMisses > 0
        ? ((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100).toFixed(2)
        : '0.00';

    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: `${hitRate}%`,
    };
  }
}
