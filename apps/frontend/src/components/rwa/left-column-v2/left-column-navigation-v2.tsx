'use client';

import { TokenHeaderSection } from './token-header-section';
import { TokenMetricsSection } from './token-metrics-section';
import { ChatSection } from './chat-section';
import { DatabaseListing } from '@/types/rwa/section.types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTokenMetrics } from '@/hooks/use-token-metrics';
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
  // Use unified token metrics hook for all data (price, bonding, metrics)
  const { metrics, currentPriceUsd, bondingData, circulatingSupply, marketCapUsd } =
    useTokenMetrics(listing?.token?.contractAddress);

  const fallbackMarketCap = useMemo(() => {
    const supply = circulatingSupply ?? NaN;
    const price = currentPriceUsd;
    if (Number.isFinite(supply) && Number.isFinite(price) && supply > 0 && price > 0) {
      return supply * price;
    }
    const mcap = metrics?.marketCapUsd ?? NaN;
    return Number.isFinite(mcap) && mcap > 0 ? mcap : undefined;
  }, [circulatingSupply, currentPriceUsd, metrics?.marketCapUsd]);

  const hasUnifiedMarketCap = Number.isFinite(marketCapUsd) && marketCapUsd > 0;
  const marketCapUSD = hasUnifiedMarketCap ? marketCapUsd : fallbackMarketCap ?? 0;
  const marketCapLoading = !hasUnifiedMarketCap;

  const liveTokenPrice = useMemo(() => {
    return isFinite(currentPriceUsd) && currentPriceUsd > 0 ? currentPriceUsd : undefined;
  }, [currentPriceUsd]);

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
    // Close the chat when the listing changes
    if (externalChatOpen) {
      onChatToggle?.();
    }
    if (internalChatOpen) {
      setInternalChatOpen(false);
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

  const tokenSymbol = listing.token?.symbol || listing.symbol || 'RWA';

  return (
    <>
      <div className="w-72 bg-[#151c16] flex flex-col overflow-hidden h-full min-h-[750px]">
        {/* Section 1: Token Header - Fixed */}
        <div className="flex-shrink-0">
          <TokenHeaderSection
            tokenSymbol={tokenSymbol}
            tokenAddress={listing.token?.contractAddress}
            tokenImage={listing.imageGallery?.[0]}
            marketCap={marketCapUSD}
            marketCapLoading={marketCapLoading}
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
            hypeSentence={listing.hypeSentence}
            marketCap={marketCapUSD}
            dexMeta={listing.dex || null}
            liveTokenPrice={liveTokenPrice}
            marketCapLoading={marketCapLoading}
          />
        </div>

        {/* Bonding Curve Progress */}
        <div className="flex-shrink-0 border-t border-[#1E2B1E]/80 bg-[#151c16] px-6 py-2">
          <BondingProgressSection
            tokenAddress={listing?.token?.contractAddress}
            chainId={listing?.token?.chainId}
            tokenSymbol={tokenSymbol}
            bondingDataFromParent={bondingData}
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
