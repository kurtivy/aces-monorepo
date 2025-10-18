'use client';

import { motion } from 'framer-motion';
import TokenHealthPanel from '../left-column/token-details/token-health-panel';
import { useTokenData } from '@/hooks/use-token-data';
import { useMemo } from 'react';

interface TokenMetricsSectionProps {
  tokenAddress?: string;
  reservePrice?: string | null;
  chainId?: number;
  rrp?: string | null;
  brand?: string | null;
  hypePoints?: string[] | null;
  marketCap?: number;
  dexMeta?: {
    poolAddress: string | null;
    isDexLive: boolean;
    dexLiveAt: string | null;
  } | null;
  liveTokenPrice?: number;
}

const TARGET_CHART_HEIGHT_PX = 560; // Keep in sync with TradingSection chart height.

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
  marketCap,
  dexMeta,
  liveTokenPrice,
}: TokenMetricsSectionProps) {
  const hasHypePoints = hypePoints && hypePoints.length > 0;

  // Fetch token data including 24h volume
  const { tokenData } = useTokenData(tokenAddress);

  // Extract volume24h in ACES
  const volume24hAces = useMemo(() => {
    return tokenData?.volume24h || '0';
  }, [tokenData]);

  return (
    <div
      className="bg-[#221F20] overflow-hidden flex flex-col"
      style={{ minHeight: `${TARGET_CHART_HEIGHT_PX}px` }}
    >
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
          dexMeta={dexMeta}
          liveTokenPrice={liveTokenPrice}
          volume24hAces={volume24hAces}
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
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#D0B284]/10">
            <span className="text-xs tracking-[0.2em] uppercase text-[#D0B284] font-proxima-nova font-semibold">
              VALUE
            </span>
            <span className="text-base font-semibold text-white font-proxima-nova">
              {formatPrice(rrp)}
            </span>
          </div>

          <div className="flex items-center justify-between px-5 py-3 border-b border-[#D0B284]/10">
            <span className="text-xs tracking-[0.2em] uppercase text-[#D0B284] font-proxima-nova font-semibold">
              COMMUNITY REWARD
            </span>
            <span className="text-base font-semibold text-white font-proxima-nova">
              {formatPrice((reservePrice ? parseFloat(reservePrice) * 0.1 : 0).toFixed(2))}
            </span>
          </div>

          {/* BRAND Row */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#D0B284]/10">
            <span className="text-xs tracking-[0.2em] uppercase text-[#D0B284] font-proxima-nova font-semibold">
              BRAND
            </span>
            <span className="text-base font-semibold text-white font-proxima-nova">
              {brand || 'N/A'}
            </span>
          </div>

          {/* HYPE Section */}
          <div className="px-5 py-3 flex-1">
            <div className="mb-2">
              <span className="text-xs tracking-[0.2em] uppercase text-[#D0B284] font-proxima-nova font-semibold">
                HYPE
              </span>
            </div>
            <p className="text-xs font-proxima-nova text-white/90">
              A groundbreaking collaboration between haute horology and contemporary art, this
              Audemars Piguet Royal Oak Concept is a limited edition masterpiece designed with the
              artist KAWS.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
