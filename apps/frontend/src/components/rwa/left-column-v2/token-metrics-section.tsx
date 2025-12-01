'use client';
import TokenHealthPanel from '../left-column/token-details/token-health-panel';
import { useTokenMetrics } from '@/hooks/use-token-metrics';
import { useMemo } from 'react';

interface TokenMetricsSectionProps {
  tokenAddress?: string;
  reservePrice?: string | null; // VALUE field - minimum/reserve price
  chainId?: number;
  listingValue?: string | null; // COMMUNITY REWARD field - full value/RRP
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
  rewardSupply?: number | null;
  disableMetricsFetch?: boolean;
}

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
  listingValue,
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
  rewardSupply,
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
    rewardSupply: hookRewardSupply,
  } = useTokenMetrics(disableMetricsFetch ? undefined : tokenAddress);

  const resolvedVolume24hAces = volume24hAces ?? hookMetrics?.volume24hAces ?? '0';
  const resolvedVolume24hUsd = volume24hUsd ?? hookMetrics?.volume24hUsd ?? undefined;
  const resolvedLiquidityUsd = liquidityUsd ?? hookMetrics?.liquidityUsd ?? undefined;
  const resolvedLiquiditySource = liquiditySource ?? hookMetrics?.liquiditySource ?? null;
  const resolvedMetricsLoading = metricsLoading ?? hookLoading;
  const resolvedCirculatingSupply = circulatingSupply ?? hookCirculatingSupply ?? null;
  const resolvedRewardSupply = rewardSupply ?? hookRewardSupply ?? null;

  // Community reward is the listing value (listing.value from database)
  const communityReward = useMemo(() => {
    if (!listingValue) return 20_000;
    const parsed = parseFloat(listingValue);
    if (!Number.isFinite(parsed)) return 20_000;
    return parsed;
  }, [listingValue]);

  return (
    <div className="bg-black overflow-hidden flex flex-col min-h-[562px]">
      {/* DATA Section Title */}
      <div className="py-0.5 border-b border-[#D0B284]/10">
        <h3 className="text-[#D0B284] text-sm xl:text-base font-bold uppercase tracking-[0.24em] font-spray-letters text-center">
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
          rewardSupply={resolvedRewardSupply}
          communityReward={communityReward}
        />

        {/* STORY Section */}
        <div className="border-t border-[#D0B284]/10 mt-1.5 flex-1 flex flex-col">
          {/* Section Title */}
          <div className="py-0.5 border-b border-[#D0B284]/10 ">
            <h3 className="text-[#D0B284] text-sm xl:text-base font-bold uppercase tracking-[0.24em] font-spray-letters text-center">
              STORY
            </h3>
          </div>

          {/* VALUE Row - Reserve Price */}
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-[#D0B284]/10">
            <span className="text-[11px] xl:text-xs tracking-[0.18em] uppercase text-[#D0B284] font-proxima-nova font-semibold">
              VALUE
            </span>
            <span className="text-sm xl:text-base font-semibold text-white font-proxima-nova">
              {formatPrice(reservePrice)}
            </span>
          </div>

          {/* COMMUNITY REWARD Row - Listing Value */}
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-[#D0B284]/10">
            <span className="text-[11px] xl:text-xs tracking-[0.18em] uppercase text-[#D0B284] font-proxima-nova font-semibold">
              COMMUNITY REWARD
            </span>
            <span className="text-sm xl:text-base font-semibold text-white font-proxima-nova">
              {formatPrice(communityReward.toFixed(0))}
            </span>
          </div>

          {/* BRAND Row */}
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-[#D0B284]/10">
            <span className="text-[11px] xl:text-xs tracking-[0.18em] uppercase text-[#D0B284] font-proxima-nova font-semibold">
              BRAND
            </span>
            <span className="text-sm xl:text-base font-semibold text-white font-proxima-nova">
              {brand || 'N/A'}
            </span>
          </div>

          {/* HYPE Section */}
          <div className="px-4 py-2 flex-1">
            <div className="mb-1">
              <span className="text-[11px] xl:text-xs tracking-[0.18em] uppercase text-[#D0B284] font-proxima-nova font-semibold">
                HYPE
              </span>
            </div>
            <p className="text-[11px] xl:text-xs leading-relaxed font-proxima-nova text-white/90">
              {hypeDescription}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
