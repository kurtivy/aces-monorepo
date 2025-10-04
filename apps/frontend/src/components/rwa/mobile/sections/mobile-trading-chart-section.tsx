'use client';

import { forwardRef } from 'react';
import TradingChart from '@/components/rwa/middle-column/token-details/trading-chart';
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
        <TradingChart
          tokenAddress={listing.token?.contractAddress ?? ''}
          tokenSymbol={listing.token?.symbol ?? listing.symbol}
          title={listing.token?.name ?? listing.title}
          heightClass="h-[400px]"
          dexMeta={listing.dex ?? null}
        />
      </section>
    );
  },
);

MobileTradingChartSection.displayName = 'MobileTradingChartSection';

export default MobileTradingChartSection;
