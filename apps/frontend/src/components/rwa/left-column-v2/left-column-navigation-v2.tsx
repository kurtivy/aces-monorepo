'use client';

import { TokenHeaderSection } from './token-header-section';
import { TokenMetricsSection } from './token-metrics-section';
import { ChatSection } from './chat-section';
import { DatabaseListing } from '@/types/rwa/section.types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePriceConversion } from '@/hooks/use-price-conversion';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { BondingProgressSection } from '@/components/rwa/right-panel/bonding-progression-section';

interface LeftColumnNavigationV2Props {
  listing?: DatabaseListing | null;
  loading?: boolean;
  isChatOpen?: boolean;
  onChatToggle?: () => void;
}

export function LeftColumnNavigationV2({
  listing,
  loading,
  isChatOpen: externalChatOpen,
  onChatToggle,
}: LeftColumnNavigationV2Props) {
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

  // Use external chat state if provided, otherwise use internal state
  const [internalChatOpen, setInternalChatOpen] = useState(false);
  const isChatOpen = externalChatOpen !== undefined ? externalChatOpen : internalChatOpen;
  const setIsChatOpen =
    onChatToggle ||
    ((value: boolean | ((prev: boolean) => boolean)) => {
      if (typeof value === 'function') {
        setInternalChatOpen(value);
      } else {
        setInternalChatOpen(value);
      }
    });
  const [isPortalReady, setIsPortalReady] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsPortalReady(true);
    return () => setIsPortalReady(false);
  }, []);

  useEffect(() => {
    if (!isChatOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (onChatToggle) {
          onChatToggle();
        } else {
          setIsChatOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChatOpen, onChatToggle]);

  useEffect(() => {
    if (onChatToggle) {
      onChatToggle();
    } else {
      setIsChatOpen(false);
    }
  }, [listing?.id]);

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

        {/* Bonding Curve Progress */}
        <div className="flex-shrink-0 border-t border-[#1E2B1E]/80 bg-[#151c16] px-6 py-4">
          <div className="mb-3">
            <h3 className="font-spray-letters text-sm font-bold uppercase tracking-[0.3em] text-[#D0B284] text-center">
              Bonding Progress
            </h3>
          </div>
          <BondingProgressSection
            tokenAddress={listing?.token?.contractAddress}
            chainId={listing?.token?.chainId}
            tokenSymbol={listing?.symbol || 'RWA'}
          />
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
                  onClose={() => {
                    if (onChatToggle) {
                      onChatToggle();
                    } else {
                      setIsChatOpen(false);
                    }
                  }}
                  dragConstraintsRef={constraintsRef}
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
