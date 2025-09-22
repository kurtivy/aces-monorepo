'use client';

import { forwardRef, useState, type ReactNode } from 'react';
import { MessageSquare, BarChart3, ChevronDown } from 'lucide-react';
import RWAForumReal from '@/components/rwa/middle-column/chat/rwa-forum-real';
import TradeHistory from '@/components/rwa/middle-column/token-details/trade-history';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface MobileCommentsHistorySectionProps {
  listing: DatabaseListing;
  isLive: boolean;
}

const MobileCommentsHistorySection = forwardRef<HTMLDivElement, MobileCommentsHistorySectionProps>(
  ({ listing, isLive }, ref) => {
    const [activeTab, setActiveTab] = useState<'comments' | 'trades'>('trades');
    const [tradesExpanded, setTradesExpanded] = useState(true);
    const [commentsExpanded, setCommentsExpanded] = useState(true);

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
        <div className="px-4 pt-6 pb-4">
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
              {renderAccordionHeader(
                'Recent Trades',
                tradesExpanded,
                () => setTradesExpanded((prev) => !prev),
                <BarChart3 className="h-4 w-4" />,
              )}
              {tradesExpanded && (
                <TradeHistory
                  tokenAddress={listing.token?.contractAddress ?? ''}
                  tokenSymbol={listing.token?.symbol ?? listing.symbol}
                />
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {renderAccordionHeader(
                'Community Comments',
                commentsExpanded,
                () => setCommentsExpanded((prev) => !prev),
                <MessageSquare className="h-4 w-4" />,
              )}
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
