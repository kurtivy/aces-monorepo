'use client';

import { forwardRef } from 'react';
import TradingViewChart from '@/components/charts/trading-view-chart';
import MobileMarketCapHeader from '@/components/rwa/mobile/mobile-market-cap-header';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface MobileTradingChartSectionProps {
  listing: DatabaseListing;
  isLive: boolean;
  isLaunched: boolean;
}

const MobileTradingChartSection = forwardRef<HTMLDivElement, MobileTradingChartSectionProps>(
  ({ listing, isLive, isLaunched }, ref) => {
    if (!isLive || !isLaunched) {
      return (
        <section
          ref={ref}
          data-section-id="chart"
          className="w-full bg-[#151c16] px-4 py-6 border-t border-[#D0B284]/20"
        >
          <div className="text-center py-12 space-y-2">
            <div className="text-[#D0B284] text-xl font-semibold">Trading Chart</div>
            <div className="text-gray-400 text-base">Coming Soon</div>
            <div className="text-gray-500 text-sm">
              Chart will be available when {listing.title} goes live
            </div>
          </div>
        </section>
      );
    }

    return (
      <section
        ref={ref}
        data-section-id="chart"
        className="w-full bg-[#151c16] border-t border-[#D0B284]/20"
      >
        <div className="overflow-hidden border border-[#D0B284]/15">
          <MobileMarketCapHeader tokenAddress={listing.token?.contractAddress ?? null} />
          <TradingViewChart
            tokenAddress={listing.token?.contractAddress ?? ''}
            tokenSymbol={listing.token?.symbol ?? listing.symbol}
            tokenName={listing.token?.name ?? listing.title}
            heightClass="h-[400px]"
            dexMeta={listing.dex ?? null}
          />
        </div>
      </section>
    );
  },
);

MobileTradingChartSection.displayName = 'MobileTradingChartSection';

export default MobileTradingChartSection;
