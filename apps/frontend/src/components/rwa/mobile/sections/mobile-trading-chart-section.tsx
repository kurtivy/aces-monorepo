'use client';

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TradingViewChart from '@/components/charts/trading-view-chart';
import MobileMarketCapHeader from '@/components/rwa/mobile/mobile-market-cap-header';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface MobileTradingChartSectionProps {
  listing: DatabaseListing;
  isLive: boolean;
  isLaunched: boolean;
  forceLoad?: boolean; // For testing: bypass lazy loading and load chart immediately
}

const MobileTradingChartSection = forwardRef<HTMLDivElement, MobileTradingChartSectionProps>(
  ({ listing, isLive, isLaunched, forceLoad = false }, ref) => {
    // Local ref so we can both expose it to parents and use it for IntersectionObserver
    const sectionRef = useRef<HTMLDivElement | null>(null);
    const setSectionRef = useCallback(
      (node: HTMLDivElement | null) => {
        sectionRef.current = node;

        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (ref as any).current = node;
        }
      },
      [ref],
    );

    // Lazy loading state - chart only initializes when section becomes visible.
    // TradingView recommends delaying initialization on mobile until the container is in view.
    const [shouldLoadChart, setShouldLoadChart] = useState(forceLoad);
    const mobileEnabledFeatures = useMemo(
      () => [
        // Mobile-specific touch features per TradingView docs
        'show_zoom_and_move_buttons_on_touch', // Shows zoom in/out buttons
        'pinch_scale', // Enables pinch-to-zoom gesture
        // Note: horz_touch_drag_scroll and vert_touch_drag_scroll are for PAGE scrolling,
        // not chart interaction. Omitting them allows proper chart touch handling.
      ],
      [],
    );

    // Lazy load the chart when the section approaches the viewport (mobile performance fix)
    useEffect(() => {
      // Skip lazy loading if disabled or chart already queued
      if (forceLoad || shouldLoadChart) {
        return;
      }

      // Do not set up observers if chart won't render yet
      if (!isLive || !isLaunched) {
        return;
      }

      const element = sectionRef.current;
      if (!element) {
        return;
      }

      // If IntersectionObserver is unavailable (very old browsers), load immediately
      if (typeof IntersectionObserver === 'undefined') {
        setShouldLoadChart(true);
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry?.isIntersecting) {
            setShouldLoadChart(true);
            observer.disconnect();
          }
        },
        {
          threshold: 0.1, // Trigger when 10% of the section is visible
          rootMargin: '120px', // Preload shortly before it scrolls into view
        },
      );

      observer.observe(element);

      return () => {
        observer.disconnect();
      };
    }, [forceLoad, isLaunched, isLive, shouldLoadChart]);

    if (!isLive || !isLaunched) {
      return (
        <section
          ref={setSectionRef}
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
        ref={setSectionRef}
        data-section-id="chart"
        className="w-full bg-[#151c16] border-t border-[#D0B284]/20"
      >
        <div className="overflow-hidden border border-[#D0B284]/15 rounded-b-lg">
          <MobileMarketCapHeader tokenAddress={listing.token?.contractAddress ?? null} />
          {/* Mobile chart: Use explicit pixel height for reliable TradingView rendering */}
          <div className="w-full" style={{ height: '420px', minHeight: '360px' }}>
            {shouldLoadChart ? (
              <TradingViewChart
                tokenAddress={listing.token?.contractAddress ?? ''}
                tokenSymbol={listing.token?.symbol ?? listing.symbol}
                tokenName={listing.token?.name ?? listing.title}
                heightPx={420}
                minHeightPx={360}
                hideNativeHeader
                extraEnabledFeatures={mobileEnabledFeatures}
                dexMeta={listing.dex ?? null}
              />
            ) : (
              <div className="w-full h-full bg-black flex flex-col items-center justify-center gap-4">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-[#D0B284]/20 border-t-[#D0B284] rounded-full animate-spin" />
                  </div>
                  <div className="text-[#DCDDCC] text-sm font-medium">Preparing chart...</div>
                  <div className="text-gray-500 text-xs">Chart will load when visible</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  },
);

MobileTradingChartSection.displayName = 'MobileTradingChartSection';

export default MobileTradingChartSection;
