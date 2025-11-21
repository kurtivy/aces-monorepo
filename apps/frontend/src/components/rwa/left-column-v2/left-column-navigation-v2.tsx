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
  const {
    metrics,
    currentPriceUsd,
    bondingData,
    circulatingSupply,
    marketCapUsd,
    loading: metricsLoading,
  } = useTokenMetrics(listing?.token?.contractAddress);

  // 🔥 FIX: Prioritize WebSocket marketCapUsd over calculated values for real-time updates
  const fallbackMarketCap = useMemo(() => {
    const supply = circulatingSupply ?? NaN;
    const price = currentPriceUsd;
    if (Number.isFinite(supply) && Number.isFinite(price) && supply > 0 && price > 0) {
      return supply * price;
    }
    const mcap = metrics?.marketCapUsd ?? NaN;
    return Number.isFinite(mcap) && mcap > 0 ? mcap : undefined;
  }, [circulatingSupply, currentPriceUsd, metrics?.marketCapUsd]);

  // 🔥 FIX: Use marketCapUsd from hook (WebSocket) as primary source, fallback to calculated
  // This ensures real-time WebSocket updates take precedence
  const hasUnifiedMarketCap = Number.isFinite(marketCapUsd) && marketCapUsd > 0;
  const hasMetricsMarketCap =
    metrics && Number.isFinite(metrics.marketCapUsd) && metrics.marketCapUsd > 0;

  // Priority: WebSocket marketCapUsd > metrics.marketCapUsd > calculated fallback
  const marketCapUSD = hasUnifiedMarketCap
    ? marketCapUsd
    : hasMetricsMarketCap && metrics
      ? metrics.marketCapUsd
      : (fallbackMarketCap ?? 0);

  // 🔥 FIX: Only show loading when actually loading and no data available
  const marketCapLoading = useMemo(() => {
    // If we have unified or metrics market cap, not loading
    if (hasUnifiedMarketCap || hasMetricsMarketCap) {
      return false;
    }

    // If we have a valid fallback calculation, not loading
    if (fallbackMarketCap && fallbackMarketCap > 0) {
      return false;
    }

    // If metrics hook is loading, we're loading
    if (metricsLoading) {
      return true;
    }

    // Otherwise, not loading (showing N/A or 0)
    return false;
  }, [hasUnifiedMarketCap, hasMetricsMarketCap, fallbackMarketCap, metricsLoading]);

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
      <div className="bg-[#151c16] flex flex-col h-full overflow-hidden flex-shrink-0 w-[18rem] lg:w-[21vw] lg:min-w-[230px] lg:max-w-[280px] xl:w-[18rem] 2xl:w-[20rem]">
        <div className="flex items-center justify-center h-full">
          <span className="text-[#D0B284] text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  const tokenSymbol = listing.token?.symbol || listing.symbol || 'RWA';

  return (
    <>
      <div className="bg-[#151c16] flex flex-col overflow-hidden h-full min-h-[700px] flex-shrink-0 w-[18rem] lg:w-[21vw] lg:min-w-[230px] lg:max-w-[280px] xl:w-[18rem] 2xl:w-[20rem]">
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
            reservePrice={listing.reservePrice}
            chainId={listing.token?.chainId}
            listingValue={listing.value}
            brand={listing.brand}
            hypePoints={listing.hypePoints}
            hypeSentence={listing.hypeSentence}
            marketCap={marketCapUSD}
            dexMeta={listing.dex || null}
            liveTokenPrice={liveTokenPrice}
            marketCapLoading={marketCapLoading}
            volume24hAces={metrics?.volume24hAces}
            volume24hUsd={metrics?.volume24hUsd ?? null}
            liquidityUsd={metrics?.liquidityUsd ?? null}
            liquiditySource={metrics?.liquiditySource ?? null}
            metricsLoading={metricsLoading}
            circulatingSupply={circulatingSupply}
            disableMetricsFetch
          />
        </div>

        {/* Bonding Curve Progress */}
        <div className="flex-shrink-0 border-t border-[#1E2B1E]/80 bg-[#151c16] px-5 py-1.5">
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
