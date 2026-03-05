/**
 * Token Metrics Service - DEX-Only
 *
 * Calculates token metrics for DEX tokens only:
 * - Volume (24h) from database trades
 * - Fees (DEX fees)
 * - Liquidity from pool reserves
 * - Holder count
 */

import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import { Decimal } from 'decimal.js';
import { getPriceCacheService } from './price-cache-service';
import { createRpcProvider, getDefaultRpcUrl } from '../utils/rpc-provider';

interface TokenMetrics {
  contractAddress: string;
  volume24hUsd: number;
  volume24hAces: string;
  marketCapUsd: number;
  tokenPriceUsd: number;
  holderCount: number;
  totalFeesUsd: number;
  totalFeesAces: string;
  dexFeesUsd: number;
  dexFeesAces: string;
  bondingFeesUsd: number;
  bondingFeesAces: string;
  liquidityUsd: number | null;
  liquiditySource: 'dex' | null;
}

const METRICS_CACHE_TTL = process.env.NODE_ENV === 'production' ? 60000 : 5000;
const DEX_FEE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class TokenMetricsService {
  private metricsCache = new Map<string, { data: TokenMetrics; timestamp: number }>();
  private dexFeeCache = new Map<
    string,
    { aces: string; usd: number; source: 'db'; timestamp: number }
  >();
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
   * Get token metrics for a DEX token
   */
  async getTokenMetrics(
    tokenAddress: string,
    chainId: number = 8453,
    options: { includeFees?: boolean } = {},
  ): Promise<TokenMetrics> {
    const { includeFees = false } = options;
    const cacheKey = `${tokenAddress.toLowerCase()}-${chainId || 'default'}`;
    const cached = this.metricsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < METRICS_CACHE_TTL) {
      return cached.data;
    }

    // Fetch pool address (Convex-first, Prisma fallback)
    const poolAddress = await this.getTokenPoolAddress(tokenAddress);

    // Fetch token metadata for fee calculation
    const token = await this.prisma.token.findUnique({
      where: { contractAddress: tokenAddress.toLowerCase() },
      select: {
        dexLiveAt: true,
        phase: true,
        priceSource: true,
      },
    }).catch(() => null);

    // Get ACES/USD price
    const priceService = getPriceCacheService();
    const priceData = await priceService.getPrices();
    const acesUsdPrice = Number.isFinite(priceData.acesUsd) ? priceData.acesUsd : 0;

    // Get token price from pool (supports both V2 and CL)
    let tokenPriceAces = 0;
    if (poolAddress) {
      try {
        tokenPriceAces = await this.getTokenPriceInAces(tokenAddress, poolAddress);
      } catch {
        // Non-critical — leave as 0
      }
    }
    const tokenPriceUsd = Number.isFinite(acesUsdPrice) ? tokenPriceAces * acesUsdPrice : 0;

    // Get holder count (simplified - can be enhanced later)
    let holderCount = 0;
    try {
      // For now, return 0 - can implement holder count service later
      // This is non-critical for metrics
    } catch (error) {
      console.warn('[TokenMetricsService] Failed to fetch holder count:', error);
    }

    // Calculate DEX fees
    let dexFeesAces = 0;
    let dexFeesUsd = 0;

    if (includeFees && poolAddress && token?.dexLiveAt) {
      try {
        const dexFeeResult = await this.calculateDexFees(
          tokenAddress,
          poolAddress,
          token.dexLiveAt,
          acesUsdPrice,
        );
        dexFeesAces = parseFloat(dexFeeResult.aces);
        dexFeesUsd = dexFeeResult.usd;
      } catch (error) {
        console.warn('[TokenMetricsService] Failed to calculate DEX fees:', error);
      }
    }

    // Calculate DEX volume (24h) from on-chain Swap events
    let volume24hAces = 0;
    let volume24hUsd = 0;

    if (poolAddress) {
      try {
        const currentBlock = await this.provider.getBlockNumber();
        // Base produces ~1 block every 2 seconds → 43200 blocks per day
        const BLOCKS_PER_DAY = 43200;
        const fromBlock = Math.max(0, currentBlock - BLOCKS_PER_DAY);
        const onChainVol = await this.getOnChainVolume(poolAddress, acesUsdPrice, fromBlock, currentBlock);
        volume24hAces = onChainVol.volumeAces;
        volume24hUsd = onChainVol.volumeUsd;
      } catch (error) {
        console.warn('[TokenMetricsService] On-chain volume query failed:', error);
      }
    }

    // Calculate DEX liquidity — supports both V2 (getReserves) and CL (slot0 + liquidity) pools
    let liquidityUsd: number | null = null;
    let liquiditySource: 'dex' | null = null;

    if (poolAddress) {
      try {
        const POOL_ABI = [
          'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
          'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, bool)',
          'function liquidity() view returns (uint128)',
          'function token0() view returns (address)',
          'function token1() view returns (address)',
        ];

        const poolContract = new ethers.Contract(poolAddress, POOL_ABI, this.provider);
        const [token0Address, token1Address] = await Promise.all([
          poolContract.token0(),
          poolContract.token1(),
        ]);

        const acesAddress = (
          process.env.ACES_TOKEN_ADDRESS || '0x55337650856299363c496065C836B9C6E9dE0367'
        ).toLowerCase();
        const isToken0Aces = token0Address.toLowerCase() === acesAddress;
        const isToken1Aces = token1Address.toLowerCase() === acesAddress;

          if (isToken0Aces || isToken1Aces) {
          let acesReserveWei: ethers.BigNumber | null = null;
          let isClPool = false;

          // Try V2 getReserves first
          try {
            const reserves = await poolContract.getReserves();
            acesReserveWei = isToken0Aces ? reserves[0] : reserves[1];
          } catch {
            // CL pool — compute virtual ACES reserve from slot0 + liquidity
            isClPool = true;
            try {
              const [slot0, liquidityRaw] = await Promise.all([
                poolContract.slot0(),
                poolContract.liquidity(),
              ]);
              const Q96 = ethers.BigNumber.from(2).pow(96);
              const sqrtP = ethers.BigNumber.from(slot0.sqrtPriceX96);
              const L = ethers.BigNumber.from(liquidityRaw);
              if (!sqrtP.isZero() && !L.isZero()) {
                acesReserveWei = isToken1Aces
                  ? L.mul(sqrtP).div(Q96)
                  : L.mul(Q96).div(sqrtP);
              }
            } catch (clError) {
              console.warn('[TokenMetricsService] CL pool liquidity fetch failed:', clError);
            }
          }

          if (acesReserveWei && acesReserveWei.gt(0)) {
            const acesReserve = new Decimal(acesReserveWei.toString()).div(new Decimal('1e18'));
            // V2 pools are 50/50 so double the ACES side to get total TVL.
            // CL pools: use only the ACES virtual reserve — liquidity is concentrated,
            // not necessarily equal on both sides.
            const multiplier = isClPool ? 1 : 2;
            const totalLiquidityUsd = acesReserve.mul(new Decimal(acesUsdPrice || 0)).mul(multiplier);
            const liquidityValueNumber = totalLiquidityUsd.isFinite()
              ? totalLiquidityUsd.toNumber()
              : 0;
            if (liquidityValueNumber > 0) {
              liquidityUsd = liquidityValueNumber;
              liquiditySource = 'dex';
            }
          }
        }
      } catch (error) {
        console.error('[TokenMetricsService] Failed to query DEX pool reserves:', error);
      }
    }

    // Supply is always 1B for DEX tokens
    const supply = 1_000_000_000;
    const marketCapUsd = tokenPriceUsd * supply;

    // Total fees (DEX only)
    const totalFeesAces = dexFeesAces;
    const totalFeesUsd =
      Number.isFinite(acesUsdPrice) && acesUsdPrice > 0 ? totalFeesAces * acesUsdPrice : dexFeesUsd;

    const responseData: TokenMetrics = {
      contractAddress: tokenAddress.toLowerCase(),
      volume24hUsd,
      volume24hAces: volume24hAces.toString(),
      marketCapUsd,
      tokenPriceUsd,
      holderCount,
      totalFeesUsd,
      totalFeesAces: totalFeesAces.toString(),
      dexFeesUsd,
      dexFeesAces: dexFeesAces.toString(),
      bondingFeesUsd: 0, // Bonding curve removed
      bondingFeesAces: '0', // Bonding curve removed
      liquidityUsd,
      liquiditySource,
    };

    // Cache the response
    this.metricsCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now(),
    });

    return responseData;
  }

  /**
   * Get token price in ACES from pool state.
   * Supports both V2 (getReserves) and CL (slot0 + liquidity) pools.
   */
  private async getTokenPriceInAces(tokenAddress: string, poolAddress: string): Promise<number> {
    const POOL_ABI = [
      'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
      'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, bool)',
      'function token0() view returns (address)',
      'function token1() view returns (address)',
    ];
    const poolContract = new ethers.Contract(poolAddress, POOL_ABI, this.provider);
    const acesAddress = (
      process.env.ACES_TOKEN_ADDRESS || '0x55337650856299363c496065C836B9C6E9dE0367'
    ).toLowerCase();

    const [token0, token1] = await Promise.all([poolContract.token0(), poolContract.token1()]);
    const isToken0Aces = token0.toLowerCase() === acesAddress;
    const isToken1Aces = token1.toLowerCase() === acesAddress;

    if (!isToken0Aces && !isToken1Aces) return 0;

    // Try V2 first
    try {
      const reserves = await poolContract.getReserves();
      const acesReserve = new Decimal((isToken0Aces ? reserves[0] : reserves[1]).toString());
      const tokenReserve = new Decimal((isToken0Aces ? reserves[1] : reserves[0]).toString());
      if (tokenReserve.isZero()) return 0;
      return acesReserve.div(tokenReserve).toNumber();
    } catch {
      // CL pool
    }

    // CL pool: price from sqrtPriceX96
    const slot0 = await poolContract.slot0();
    const sqrtP = Number(ethers.BigNumber.from(slot0.sqrtPriceX96).toString());
    const Q96 = Number(ethers.BigNumber.from(2).pow(96).toString());
    const price = Math.pow(sqrtP / Q96, 2); // price = token1/token0

    // price = token1/token0, ACES per token
    if (isToken0Aces) {
      // token0=ACES, token1=TOKEN → price = TOKEN/ACES → token price in ACES = 1/price
      return price === 0 ? 0 : 1 / price;
    } else {
      // token0=TOKEN, token1=ACES → price = ACES/TOKEN → token price in ACES = price
      return price;
    }
  }

  /**
   * Get pool address for a token (Convex-first, Prisma fallback)
   */
  private async getTokenPoolAddress(tokenAddress: string): Promise<string | undefined> {
    try {
      const normalized = tokenAddress.toLowerCase();
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

      if (convexUrl) {
        try {
          const { fetchQuery } = await import('convex/nextjs');
          const { api } = await import('convex/_generated/api');
          const convexToken = await fetchQuery(
            api.tokens.getByContractAddress,
            { contractAddress: normalized },
            { url: convexUrl },
          );
          if (convexToken?.poolAddress) {
            return convexToken.poolAddress;
          }
        } catch (e) {
          console.warn('[TokenMetricsService] Convex pool address lookup failed:', e);
        }
      }

      const token = await this.prisma.token.findUnique({
        where: { contractAddress: normalized },
        select: { poolAddress: true },
      }).catch(() => null);
      return token?.poolAddress ?? undefined;
    } catch (error) {
      console.error('[TokenMetricsService] Error getting pool address:', error);
      return undefined;
    }
  }

  /**
   * Calculate lifetime DEX creator fees (0.5% of ACES notional) since dexLiveAt.
   * Reads on-chain Swap events instead of the decommissioned backend dexTrade table.
   */
  private async calculateDexFees(
    tokenAddress: string,
    poolAddress: string,
    dexLiveAt: Date,
    acesUsdPrice: number,
  ): Promise<{ aces: string; usd: number; source: 'db'; timestamp: number }> {
    const cacheKey = `${tokenAddress.toLowerCase()}:fees:${dexLiveAt.getTime()}`;
    const cached = this.dexFeeCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < DEX_FEE_CACHE_TTL_MS) {
      return cached;
    }

    const source: 'db' = 'db';
    let totalAces = new Decimal(0);

    try {
      const currentBlock = await this.provider.getBlockNumber();
      // Convert dexLiveAt timestamp to an approximate block number (Base: ~2s per block)
      const msAgo = Date.now() - dexLiveAt.getTime();
      const blocksAgo = Math.ceil(msAgo / 2000);
      const fromBlock = Math.max(0, currentBlock - blocksAgo);
      const { volumeAces } = await this.getOnChainVolume(poolAddress, acesUsdPrice, fromBlock, currentBlock);
      totalAces = new Decimal(volumeAces);
    } catch (err) {
      console.warn('[TokenMetricsService] On-chain fee calc failed:', err);
    }

    const feeAces = totalAces.mul(0.005); // 0.5% creator fee
    const feeUsd = acesUsdPrice && acesUsdPrice > 0 ? feeAces.mul(acesUsdPrice).toNumber() : 0;

    const result = {
      aces: feeAces.toString(),
      usd: feeUsd,
      source,
      timestamp: Date.now(),
    };

    this.dexFeeCache.set(cacheKey, result);
    return result;
  }

  /**
   * Fetch raw Swap event logs from a pool contract in batches.
   * Batches at batchSize blocks to stay within RPC limits (QuickNode: ~10k blocks/request).
   */
  private async fetchSwapLogs(
    poolAddress: string,
    swapTopic: string,
    fromBlock: number,
    toBlock: number,
    batchSize = 9000,
  ): Promise<ethers.providers.Log[]> {
    const logs: ethers.providers.Log[] = [];
    let batchFrom = fromBlock;
    while (batchFrom <= toBlock) {
      const batchTo = Math.min(batchFrom + batchSize - 1, toBlock);
      try {
        const batch = await this.provider.getLogs({
          address: poolAddress,
          topics: [swapTopic],
          fromBlock: batchFrom,
          toBlock: batchTo,
        });
        logs.push(...batch);
      } catch (err) {
        console.warn(`[TokenMetricsService] getLogs failed for blocks ${batchFrom}-${batchTo}:`, err);
      }
      batchFrom = batchTo + 1;
    }
    return logs;
  }

  /**
   * Calculate ACES-denominated swap volume from on-chain Swap events.
   * Supports both V2 (Aerodrome AMM) and CL (Slipstream) pool event schemas.
   */
  private async getOnChainVolume(
    poolAddress: string,
    acesUsdPrice: number,
    fromBlock: number,
    toBlock: number,
  ): Promise<{ volumeAces: number; volumeUsd: number; isClPool: boolean }> {
    const POOL_ABI = [
      'function token0() view returns (address)',
      'function token1() view returns (address)',
      'function getReserves() view returns (uint112, uint112, uint32)',
    ];
    const poolContract = new ethers.Contract(poolAddress, POOL_ABI, this.provider);
    const [token0, token1] = await Promise.all([poolContract.token0(), poolContract.token1()]);
    const acesAddress = (
      process.env.ACES_TOKEN_ADDRESS || '0x55337650856299363c496065C836B9C6E9dE0367'
    ).toLowerCase();
    const isToken0Aces = token0.toLowerCase() === acesAddress;

    // Detect V2 vs CL pool by trying getReserves()
    let isClPool = false;
    try {
      await poolContract.getReserves();
    } catch {
      isClPool = true;
    }

    const V2_SWAP_ABI =
      'event Swap(address indexed sender, address indexed to, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out)';
    const CL_SWAP_ABI =
      'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)';

    const iface = new ethers.utils.Interface([isClPool ? CL_SWAP_ABI : V2_SWAP_ABI]);
    const swapTopic = iface.getEventTopic('Swap');

    const logs = await this.fetchSwapLogs(poolAddress, swapTopic, fromBlock, toBlock);

    let totalAces = new Decimal(0);
    for (const log of logs) {
      try {
        const parsed = iface.parseLog(log);
        let acesWei: Decimal;

        if (isClPool) {
          // CL: amount0/amount1 are int256 — one is positive (into pool) and one negative
          const raw: ethers.BigNumber = isToken0Aces ? parsed.args.amount0 : parsed.args.amount1;
          acesWei = new Decimal(raw.abs().toString());
        } else {
          // V2: amountXIn + amountXOut covers the ACES leg of this swap
          const amountIn: ethers.BigNumber = isToken0Aces
            ? parsed.args.amount0In
            : parsed.args.amount1In;
          const amountOut: ethers.BigNumber = isToken0Aces
            ? parsed.args.amount0Out
            : parsed.args.amount1Out;
          acesWei = new Decimal(amountIn.add(amountOut).toString());
        }

        totalAces = totalAces.add(acesWei.div(new Decimal('1e18')));
      } catch (err) {
        console.warn('[TokenMetricsService] Failed to parse swap log:', err);
      }
    }

    const volumeAces = totalAces.toNumber();
    return { volumeAces, volumeUsd: volumeAces * acesUsdPrice, isClPool };
  }
}

// Singleton instance
let tokenMetricsServiceInstance: TokenMetricsService | null = null;

export function getTokenMetricsService(prisma: PrismaClient): TokenMetricsService {
  if (!tokenMetricsServiceInstance) {
    tokenMetricsServiceInstance = new TokenMetricsService(prisma);
  }
  return tokenMetricsServiceInstance;
}
