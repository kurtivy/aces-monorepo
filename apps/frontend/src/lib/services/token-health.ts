/**
 * Server-side Token Health
 *
 * Fetches metrics and market cap in-process (no internal HTTP).
 * Single source of truth for health data; used by health route and listing route.
 */

import '../utils/patch-fetch-referrer'; // ensure ethers v5 referrer fix runs before any RPC (Node rejects referrer "client")
import type { PrismaClient } from '@prisma/client';
import type { TokenHealthData } from '@/lib/api/token-health';
import { getTokenMetricsService } from './token-metrics-service';
import { getMarketCapService } from './market-cap-service';

const DEFAULT_CHAIN_ID = 8453;

/**
 * Get token health by calling metrics and market-cap services in-process.
 * Use this in API routes instead of internal fetch() to avoid extra latency.
 */
export async function getTokenHealth(
  prisma: PrismaClient,
  tokenAddress: string,
  chainId: number = DEFAULT_CHAIN_ID,
  currency: 'usd' | 'aces' = 'usd',
): Promise<TokenHealthData> {
  const normalizedAddress = tokenAddress.toLowerCase();
  const metricsService = getTokenMetricsService(prisma);
  const marketCapService = getMarketCapService(prisma);

  const [metricsResult, marketCapResult] = await Promise.allSettled([
    metricsService.getTokenMetrics(normalizedAddress, chainId),
    marketCapService.getMarketCap(normalizedAddress, chainId),
  ]);

  let metricsData: TokenHealthData['metricsData'] = null;
  if (metricsResult.status === 'fulfilled') {
    const m = metricsResult.value;
    metricsData = {
      contractAddress: m.contractAddress,
      volume24hUsd: m.volume24hUsd,
      volume24hAces: m.volume24hAces,
      marketCapUsd: m.marketCapUsd,
      tokenPriceUsd: m.tokenPriceUsd,
      holderCount: m.holderCount,
      totalFeesUsd: m.totalFeesUsd,
      totalFeesAces: m.totalFeesAces,
      dexFeesUsd: m.dexFeesUsd,
      dexFeesAces: m.dexFeesAces,
      bondingFeesUsd: m.bondingFeesUsd,
      bondingFeesAces: m.bondingFeesAces,
      liquidityUsd: m.liquidityUsd,
      liquiditySource: m.liquiditySource,
    };
  } else {
    console.warn('[TokenHealth] Metrics fetch failed:', metricsResult.reason);
  }

  let marketCapData: TokenHealthData['marketCapData'] = null;
  if (marketCapResult.status === 'fulfilled' && marketCapResult.value) {
    const mc = marketCapResult.value;
    const marketCapUsd = mc.marketCapUsd ?? 0;
    const currentPriceUsd = mc.currentPriceUsd ?? 0;
    const supply = mc.supply ?? 1_000_000_000;
    const rewardSupply = mc.rewardSupply ?? supply;

    marketCapData = {
      marketCapAces: currency === 'usd' && currentPriceUsd > 0 ? marketCapUsd / currentPriceUsd : 0,
      marketCapUsd,
      circulatingSupply: supply,
      rewardSupply,
      currentPriceAces: 0,
      currentPriceUsd,
      lastUpdated: mc.calculatedAt ?? Date.now(),
    };
  } else {
    if (marketCapResult.status === 'rejected') {
      console.warn('[TokenHealth] Market cap fetch failed:', marketCapResult.reason);
    }
  }

  return {
    bondingData: null,
    metricsData,
    marketCapData,
  };
}
