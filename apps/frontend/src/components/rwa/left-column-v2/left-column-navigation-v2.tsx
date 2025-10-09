'use client';

import { TokenHeaderSection } from './token-header-section';
import { TokenMetricsSection } from './token-metrics-section';
import { ChatSection } from './chat-section';
import { DatabaseListing } from '@/types/rwa/section.types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePriceConversion } from '@/hooks/use-price-conversion';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import FloatingStreamButton from '@/components/twitch/floating-stream-button';
import { cn } from '@/lib/utils';
import { MessageCircle } from 'lucide-react';

interface LeftColumnNavigationV2Props {
  listing?: DatabaseListing | null;
  loading?: boolean;
}

export function LeftColumnNavigationV2({ listing, loading }: LeftColumnNavigationV2Props) {
  // Calculate market cap from ACES balance
  const acesBalance = listing?.token?.currentPriceACES || '0';
  const acesDepositedFloat = useMemo(() => {
    const parsed = parseFloat(acesBalance);
    return isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [acesBalance]);

  const { data: marketCapConversion } = usePriceConversion(
    acesDepositedFloat > 0 ? acesDepositedFloat.toString() : '0',
  );

  const marketCapUSD = useMemo(() => {
    if (!marketCapConversion?.usdValue) return 0;
    const usd = Number(marketCapConversion.usdValue);
    return isFinite(usd) ? usd : 0;
  }, [marketCapConversion]);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isPortalReady, setIsPortalReady] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const chatButtonRef = useRef<HTMLButtonElement>(null);
  const [chatAnchorRect, setChatAnchorRect] = useState<{
    top: number;
    left: number;
    right: number;
    height: number;
  } | null>(null);
  const twitchChannelName = (
    (listing as { twitchChannelName?: string } | null)?.twitchChannelName ??
    process.env.NEXT_PUBLIC_TWITCH_CHANNEL_NAME ??
    ''
  ).trim();

  const updateChatAnchor = useCallback(() => {
    const buttonEl = chatButtonRef.current;
    if (!buttonEl) return;
    const rect = buttonEl.getBoundingClientRect();
    setChatAnchorRect((prev) => {
      const next = {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        height: rect.height,
      };
      if (
        prev &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.right === next.right &&
        prev.height === next.height
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setIsPortalReady(true);
    return () => setIsPortalReady(false);
  }, []);

  useEffect(() => {
    if (!isChatOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsChatOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChatOpen]);

  useEffect(() => {
    setIsChatOpen(false);
    setChatAnchorRect(null);
  }, [listing?.id]);

  useEffect(() => {
    if (!isChatOpen) return;

    updateChatAnchor();
    const handleRecalc = () => updateChatAnchor();

    window.addEventListener('resize', handleRecalc);
    window.addEventListener('scroll', handleRecalc, true);
    return () => {
      window.removeEventListener('resize', handleRecalc);
      window.removeEventListener('scroll', handleRecalc, true);
    };
  }, [isChatOpen, updateChatAnchor]);

  const floatingChatPosition = chatAnchorRect
    ? {
        top: Math.max(24, chatAnchorRect.top),
        left: chatAnchorRect.right + 16,
      }
    : undefined;

  if (loading || !listing) {
    return (
      <div className="w-72 bg-[#151c16] flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-center h-full">
          <span className="text-[#D0B284] text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-72 bg-[#151c16] flex flex-col overflow-hidden h-full min-h-[750px]">
        {/* Section 1: Token Header - Fixed */}
        <div className="flex-shrink-0">
          <TokenHeaderSection
            tokenSymbol={listing.symbol}
            tokenAddress={listing.token?.contractAddress}
            tokenImage={listing.imageGallery?.[0]}
            marketCap={marketCapUSD}
          />
        </div>

        {/* Section 2: Token Metrics (DATA + STORY) - Fixed */}
        <div className="flex-shrink-0">
          <TokenMetricsSection
            tokenAddress={listing.token?.contractAddress}
            reservePrice={listing.reservePrice || listing.rrp}
            chainId={listing.token?.chainId}
            rrp={listing.rrp || listing.reservePrice}
            brand={listing.brand}
            hypePoints={listing.hypePoints}
          />
        </div>

        {/* Chat pop-out trigger */}
        <div className="flex-shrink-0 border-t border-[#1E2B1E]/80 bg-[#151c16] pb-6">
          <div className="w-full">
            <button
              ref={chatButtonRef}
              type="button"
              onClick={() =>
                setIsChatOpen((prev) => {
                  if (!prev) {
                    updateChatAnchor();
                  }
                  return !prev;
                })
              }
              aria-pressed={isChatOpen}
              aria-expanded={isChatOpen}
              className={cn(
                'relative flex h-16 w-full items-center justify-center overflow-hidden rounded-t-md rounded-b-none',
                'bg-[#151c16] text-[#D0B284] transition-colors font-spray-letters text-[13px] tracking-[0.25em]',
                isChatOpen ? 'bg-[#162016] text-white' : 'hover:bg-[#0E150E]/70 hover:text-white',
              )}
            >
              <MessageCircle
                size={16}
                className={cn(
                  'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#C9B48A]',
                  isChatOpen ? 'text-[#FFEFC7]' : '',
                )}
              />
              <span className="pointer-events-none">{isChatOpen ? 'HIDE CHAT' : 'VIEW CHAT'}</span>

              <span
                className={cn(
                  'pointer-events-none absolute right-4 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-[#D0B284]/50 transition',
                  isChatOpen
                    ? 'bg-[#4FFFB0] shadow-[0_0_12px_rgba(79,255,176,0.6)]'
                    : 'bg-transparent',
                )}
              />

              <div className="pointer-events-none absolute left-5 right-5 top-3 border-t border-dashed border-[#D0B284]/40" />
              <div className="pointer-events-none absolute left-5 right-5 bottom-3 border-t border-dashed border-[#D0B284]/40" />
            </button>
          </div>

          <div className="w-full">
            {twitchChannelName ? (
              <FloatingStreamButton
                channelName={twitchChannelName}
                variant="selector"
                className="mt-[-1px]"
                buttonClassName="w-full rounded-none rounded-b-md"
              />
            ) : (
              <div className="mt-[-1px] relative flex h-16 w-full items-center justify-center overflow-hidden rounded-none rounded-b-md bg-[#101710]/90 text-[#5A685A] font-spray-letters text-[13px] tracking-[0.25em]">
                STREAM UNAVAILABLE
                <div className="pointer-events-none absolute left-5 right-5 top-3 border-t border-dashed border-[#5A685A]/40" />
                <div className="pointer-events-none absolute left-5 right-5 bottom-3 border-t border-dashed border-[#5A685A]/40" />
              </div>
            )}
          </div>
        </div>
      </div>

      {isPortalReady &&
        createPortal(
          <AnimatePresence>
            {isChatOpen && (
              <motion.div
                ref={constraintsRef}
                className="pointer-events-none fixed inset-0 z-[60]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChatSection
                  listingId={listing.id}
                  listingTitle={listing.title}
                  isLive={listing.isLive}
                  floating
                  onClose={() => setIsChatOpen(false)}
                  dragConstraintsRef={constraintsRef}
                  floatingPosition={floatingChatPosition}
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
