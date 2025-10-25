'use client';

import { motion } from 'framer-motion';
import TokenHealthPanel from '../left-column/token-details/token-health-panel';
import { useTokenMetrics } from '@/hooks/use-token-metrics';
import { useMemo } from 'react';

interface TokenMetricsSectionProps {
  tokenAddress?: string;
  reservePrice?: string | null;
  chainId?: number;
  rrp?: string | null;
  brand?: string | null;
  hypePoints?: string[] | null;
  hypeSentence?: string | null;
  marketCap?: number;
  dexMeta?: {
    poolAddress: string | null;
    isDexLive: boolean;
    dexLiveAt: string | null;
  } | null;
  liveTokenPrice?: number;
  marketCapLoading?: boolean;
  volume24hAces?: string;
  volume24hUsd?: number | null;
  liquidityUsd?: number | null;
  liquiditySource?: 'bonding_curve' | 'dex' | null;
  metricsLoading?: boolean;
  circulatingSupply?: number | null;
  disableMetricsFetch?: boolean;
}

const TARGET_CHART_HEIGHT_PX = 560; // Keep in sync with TradingSection chart height.
const COMMUNITY_REWARD_USD = 40_000;

const formatPrice = (price: string | null | undefined): string => {
  if (!price) return 'N/A';
  const numPrice = parseFloat(price);
  if (isNaN(numPrice)) return 'N/A';
  return `$${numPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export function TokenMetricsSection({
  tokenAddress,
  reservePrice,
  chainId,
  rrp,
  brand,
  hypePoints,
  hypeSentence,
  marketCap,
  dexMeta,
  liveTokenPrice,
  marketCapLoading,
  volume24hAces,
  volume24hUsd,
  liquidityUsd,
  liquiditySource,
  metricsLoading,
  circulatingSupply,
  disableMetricsFetch = false,
}: TokenMetricsSectionProps) {
  const hasHypePoints =
    Array.isArray(hypePoints) && hypePoints.some((point) => point && point.trim().length > 0);

  const hypeDescription = useMemo(() => {
    const sentence = hypeSentence?.trim();
    if (sentence) {
      return sentence;
    }

    if (hasHypePoints && hypePoints) {
      return hypePoints
        .filter((point) => point && point.trim().length > 0)
        .map((point) => point.trim())
        .join(' • ');
    }

    return 'Hype details coming soon.';
  }, [hypeSentence, hypePoints, hasHypePoints]);

  // Fetch aggregated token metrics (includes volume in ACES + USD and price)
  const {
    metrics: hookMetrics,
    loading: hookLoading,
    circulatingSupply: hookCirculatingSupply,
  } = useTokenMetrics(disableMetricsFetch ? undefined : tokenAddress);

  const resolvedVolume24hAces = volume24hAces ?? hookMetrics?.volume24hAces ?? '0';
  const resolvedVolume24hUsd =
    volume24hUsd ?? (hookMetrics?.volume24hUsd ?? undefined);
  const resolvedLiquidityUsd =
    liquidityUsd ?? (hookMetrics?.liquidityUsd ?? undefined);
  const resolvedLiquiditySource =
    liquiditySource ?? (hookMetrics?.liquiditySource ?? null);
  const resolvedMetricsLoading = metricsLoading ?? hookLoading;
  const resolvedCirculatingSupply =
    circulatingSupply ?? hookCirculatingSupply ?? null;

  return (
    <div className="bg-black overflow-hidden flex flex-col" style={{ minHeight: `${TARGET_CHART_HEIGHT_PX}px` }}>
      {/* DATA Section Title */}
      <div className="py-1 border-b border-[#D0B284]/10">
        <h3 className="text-[#D0B284] text-base font-bold uppercase tracking-[0.3em] font-spray-letters text-center">
          DATA
        </h3>
      </div>

      <div className="flex-1 flex flex-col">
        {/* Token Health Panel */}
        <TokenHealthPanel
          tokenAddress={tokenAddress}
          reservePrice={reservePrice}
          chainId={chainId}
          marketCap={marketCap}
          marketCapLoading={marketCapLoading}
          dexMeta={dexMeta}
          liveTokenPrice={liveTokenPrice}
          volume24hAces={resolvedVolume24hAces}
          volume24hUsd={resolvedVolume24hUsd ?? undefined}
          liquidityUsd={resolvedLiquidityUsd ?? undefined}
          liquiditySource={resolvedLiquiditySource}
          metricsLoading={resolvedMetricsLoading}
          circulatingSupply={resolvedCirculatingSupply}
        />

        {/* STORY Section */}
        <div className="border-t border-[#D0B284]/10 mt-2 flex-1 flex flex-col">
          {/* Section Title */}
          <div className="py-1 border-b border-[#D0B284]/10 ">
            <h3 className="text-[#D0B284] text-base font-bold uppercase tracking-[0.3em] font-spray-letters text-center">
              STORY
            </h3>
          </div>

          {/* VALUE (RRP) Row */}
          <div className="flex items-center justify-between px-5 py-2 border-b border-[#D0B284]/10">
            <span className="text-xs tracking-[0.2em] uppercase text-[#D0B284] font-proxima-nova font-semibold">
              VALUE
            </span>
            <span className="text-base font-semibold text-white font-proxima-nova">
              {formatPrice(rrp)}
            </span>
          </div>

          <div className="flex items-center justify-between px-5 py-2 border-b border-[#D0B284]/10">
            <span className="text-xs tracking-[0.2em] uppercase text-[#D0B284] font-proxima-nova font-semibold">
              COMMUNITY REWARD
            </span>
            <span className="text-base font-semibold text-white font-proxima-nova">
              {formatPrice(COMMUNITY_REWARD_USD.toFixed(0))}
            </span>
          </div>

          {/* BRAND Row */}
          <div className="flex items-center justify-between px-5 py-2 border-b border-[#D0B284]/10">
            <span className="text-xs tracking-[0.2em] uppercase text-[#D0B284] font-proxima-nova font-semibold">
              BRAND
            </span>
            <span className="text-base font-semibold text-white font-proxima-nova">
              {brand || 'N/A'}
            </span>
          </div>

          {/* HYPE Section */}
          <div className="px-5 py-3 flex-1">
            <div className="mb-1">
              <span className="text-xs tracking-[0.2em] uppercase text-[#D0B284] font-proxima-nova font-semibold">
                HYPE
              </span>
            </div>
            <p className="text-xs font-proxima-nova text-white/90">{hypeDescription}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
