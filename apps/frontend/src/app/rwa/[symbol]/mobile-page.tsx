'use client';

import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import MobileRWAHeader from '../../../components/rwa/mobile/headers/mobile-rwa-header';
import MobileTokenHeader from '../../../components/rwa/mobile/headers/mobile-token-header';
import MobileOverviewSection from '../../../components/rwa/mobile/sections/mobile-overview-section';
// import MobileTradingChartSection from '../../../components/rwa/mobile/sections/mobile-trading-chart-section';
import MobileCommentsHistorySection from '../../../components/rwa/mobile/sections/mobile-comments-history-section';
import MobilePlaceBidsSection from '../../../components/rwa/mobile/sections/mobile-place-bids-section';
import MobileBottomNav from '../../../components/rwa/mobile/navigation/mobile-bottom-nav';
import MobileFloatingTradeButton from '../../../components/rwa/mobile/navigation/mobile-floating-trade-button';
import MobileTradeDrawer from '../../../components/rwa/mobile/trade/mobile-trade-drawer';
import { useMobileScrollManager } from '../../../lib/utils/rwa/mobile-scroll-manager';
import type { DatabaseListing } from '@/types/rwa/section.types';
import { ShareModal } from '@/components/rwa/modals';

interface MobileRWAItemPageProps {
  listing: DatabaseListing | null;
  loading: boolean;
  error: string | null;
  isLive: boolean;
  launchDate: string | null;
  isLaunched: boolean;
  symbol: string;
}

export default function MobileRWAItemPage({
  listing,
  loading,
  error,
  isLive,
  launchDate,
  isLaunched,
  symbol,
}: MobileRWAItemPageProps) {
  const overviewRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const commentsRef = useRef<HTMLDivElement>(null);
  const bidsRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const sectionRefs = useMemo(
    () => [
      { id: 'overview', ref: overviewRef },
      { id: 'chart', ref: chartRef },
      { id: 'comments', ref: commentsRef },
      { id: 'bids', ref: bidsRef },
    ],
    [overviewRef, chartRef, commentsRef, bidsRef],
  );

  const { activeSection, isTradeButtonVisible, scrollToSection } = useMobileScrollManager(
    sectionRefs,
    scrollContainerRef,
  );
  const [isTradeDrawerOpen, setIsTradeDrawerOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  if (error) {
    return (
      <div className="h-screen bg-[#151c16] text-white flex items-center justify-center px-4">
        <div className="text-center space-y-2">
          <div className="text-red-400 text-xl font-semibold">Error Loading Listing</div>
          <div className="text-gray-400 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen bg-[#151c16] text-white flex items-center justify-center">
        <div className="text-[#D0B284] text-lg">Loading {symbol}...</div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="h-screen bg-[#151c16] text-white flex items-center justify-center px-4">
        <div className="text-center space-y-2">
          <div className="text-red-400 text-xl font-semibold">Listing Not Found</div>
          <div className="text-gray-400 text-sm">
            The asset &quot;{symbol}&quot; could not be found.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#151c16] text-white overflow-hidden">
      <MobileRWAHeader title={listing.title} />
      <MobileTokenHeader
        listing={listing}
        symbol={symbol}
        onShare={() => setIsShareModalOpen(true)}
      />

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto pb-32 scrollbar-hide mobile-optimized"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <MobileOverviewSection
            ref={overviewRef}
            listing={listing}
            loading={loading}
            launchDate={launchDate}
          />
          {/* <MobileTradingChartSection
            ref={chartRef}
            listing={listing}
            isLive={isLive}
            isLaunched={isLaunched}
          /> */}

          <MobileCommentsHistorySection ref={commentsRef} listing={listing} isLive={isLive} />
          <MobilePlaceBidsSection
            ref={bidsRef}
            listing={listing}
            isLive={isLive}
            isLaunched={isLaunched}
          />
        </motion.div>
      </div>

      <MobileFloatingTradeButton
        isVisible={isTradeButtonVisible && !isTradeDrawerOpen}
        tokenSymbol={listing.token?.symbol ?? listing.symbol}
        onTradeClick={() => setIsTradeDrawerOpen(true)}
      />

      <MobileBottomNav activeSection={activeSection} onSectionChange={scrollToSection} />

      <MobileTradeDrawer
        isOpen={isTradeDrawerOpen}
        onClose={() => setIsTradeDrawerOpen(false)}
        listing={listing}
      />

      {isShareModalOpen && (
        <ShareModal
          onClose={() => setIsShareModalOpen(false)}
          title={listing.title}
          symbol={listing.symbol}
        />
      )}
    </div>
  );
}
