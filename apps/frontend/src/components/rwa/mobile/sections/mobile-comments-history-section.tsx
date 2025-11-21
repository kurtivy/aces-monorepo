'use client';

import { forwardRef, useMemo, useState, type ReactNode } from 'react';
import { MessageSquare, BarChart3, ChevronDown } from 'lucide-react';
import RWAForumReal from '@/components/rwa/middle-column/chat/rwa-forum-real';
import TradeHistory from '@/components/rwa/middle-column/token-details/trade-history';
import { TokenMetricsSection } from '@/components/rwa/left-column-v2/token-metrics-section';
import type { DatabaseListing } from '@/types/rwa/section.types';
import { NETWORK_CONFIG } from '@/lib/contracts/addresses';
import { useTokenMarketCap } from '@/hooks/use-token-market-cap';

interface MobileCommentsHistorySectionProps {
  listing: DatabaseListing;
  isLive: boolean;
}

const MobileCommentsHistorySection = forwardRef<HTMLDivElement, MobileCommentsHistorySectionProps>(
  ({ listing, isLive }, ref) => {
    const [activeTab, setActiveTab] = useState<'comments' | 'trades' | 'stats'>('stats');
    const [tradesExpanded, setTradesExpanded] = useState(true);
    const [commentsExpanded, setCommentsExpanded] = useState(true);
    const tokenChainId = listing.token?.chainId ?? NETWORK_CONFIG.DEFAULT_CHAIN_ID;

    // Fetch live token price
    const { currentPriceUsd, marketCapUsd } = useTokenMarketCap(
      listing.token?.contractAddress,
      'usd',
    );

    const liveTokenPrice = useMemo(() => {
      return isFinite(currentPriceUsd) && currentPriceUsd > 0 ? currentPriceUsd : undefined;
    }, [currentPriceUsd]);

    const renderAccordionHeader = (
      label: string,
      isExpanded: boolean,
      onToggle: () => void,
      icon?: ReactNode,
    ) => (
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-lg bg-[#1b241a]/70 border border-[#2a3b2a] text-left text-[#DCDDCC] hover:text-white transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {label}
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180 text-white' : 'text-[#D0B284]'}`}
        />
      </button>
    );

    return (
      <section
        ref={ref}
        data-section-id="comments"
        className="w-full bg-[#151c16] border-t border-[#D0B284]/20"
      >
        <div className="px-2 pt-6">
          <div className="flex border-b border-[#253224]">
            <button
              type="button"
              onClick={() => setActiveTab('trades')}
              className={`flex-1 pb-3 text-sm font-semibold tracking-wide text-center relative transition-colors ${
                activeTab === 'trades' ? 'text-white' : 'text-[#8F9B8F]'
              }`}
            >
              Trades
              <span
                className={`absolute left-0 right-0 -bottom-[1px] h-0.5 transition-colors ${
                  activeTab === 'trades' ? 'bg-[#D0B284]' : 'bg-transparent'
                }`}
              />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stats')}
              className={`flex-1 pb-3 text-sm font-semibold tracking-wide text-center relative transition-colors ${
                activeTab === 'stats' ? 'text-white' : 'text-[#8F9B8F]'
              }`}
            >
              Stats
              <span
                className={`absolute left-0 right-0 -bottom-[1px] h-0.5 transition-colors ${
                  activeTab === 'stats' ? 'bg-[#D0B284]' : 'bg-transparent'
                }`}
              />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('comments')}
              className={`flex-1 pb-3 text-sm font-semibold tracking-wide text-center relative transition-colors ${
                activeTab === 'comments' ? 'text-white' : 'text-[#8F9B8F]'
              }`}
            >
              Comments
              <span
                className={`absolute left-0 right-0 -bottom-[1px] h-0.5 transition-colors ${
                  activeTab === 'comments' ? 'bg-[#D0B284]' : 'bg-transparent'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="pb-6 space-y-4">
          {activeTab === 'trades' ? (
            <div className="space-y-3">
              <div className="sticky top-0 z-20 bg-[#151c16] pb-2 pt-1">
                {renderAccordionHeader(
                  'Recent Trades',
                  tradesExpanded,
                  () => setTradesExpanded((prev) => !prev),
                  <BarChart3 className="h-4 w-4" />,
                )}
              </div>
              {tradesExpanded && (
                <TradeHistory
                  tokenAddress={listing.token?.contractAddress ?? ''}
                  tokenSymbol={listing.token?.symbol ?? listing.symbol}
                />
              )}
            </div>
          ) : activeTab === 'stats' ? (
            <div className="px-3 pt-4">
              <TokenMetricsSection
                tokenAddress={listing.token?.contractAddress}
                reservePrice={listing.reservePrice}
                chainId={tokenChainId}
                rrp={listing.rrp || listing.reservePrice}
                brand={listing.brand}
                hypePoints={listing.hypePoints}
                hypeSentence={listing.hypeSentence}
                marketCap={marketCapUsd}
                dexMeta={listing.dex || null}
                liveTokenPrice={liveTokenPrice}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="sticky top-0 z-20 bg-[#151c16] pb-2 pt-1">
                {renderAccordionHeader(
                  'Community Comments',
                  commentsExpanded,
                  () => setCommentsExpanded((prev) => !prev),
                  <MessageSquare className="h-4 w-4" />,
                )}
              </div>
              {commentsExpanded && (
                <RWAForumReal
                  listingId={listing.id}
                  listingTitle={listing.title}
                  isLive={isLive}
                  variant="mobile"
                />
              )}
            </div>
          )}
        </div>
      </section>
    );
  },
);

MobileCommentsHistorySection.displayName = 'MobileCommentsHistorySection';

export default MobileCommentsHistorySection;
