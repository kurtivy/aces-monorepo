'use client';

import type React from 'react';

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { ImageInfo } from '../../../types/canvas';
import { getImageMetadata } from '../../../lib/utils/luxury-logger';
import PurchaseInquiryModal from './purchase-inquiry-modal';
import AuctionInterestModal from '@/components/ui/custom/auction-interest-modal';
import { useListingBySymbol } from '../../../hooks/rwa/use-listing-by-symbol';
import { useTokenMarketCap } from '../../../hooks/use-token-market-cap';
import { TokensApi } from '@/lib/api/tokens';
import { isSymbolTradingLive, normalizeSymbol } from '@/constants/live-trading';

import {
  addWindowEventListenerSafe,
  removeWindowEventListenerSafe,
} from '../../../lib/utils/event-listener-utils';
import { getBackdropFilterCSS } from '../../../lib/utils/browser-utils';

// Modal image cache for memory management
class ModalImageCache {
  private cache = new Map<string, { loaded: boolean; timestamp: number }>();
  private readonly MAX_CACHE_SIZE = 10; // Maximum cached modal images
  private readonly CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

  track(src: string) {
    this.cache.set(src, { loaded: true, timestamp: Date.now() });
    this.cleanup();
  }

  isLoaded(src: string): boolean {
    const entry = this.cache.get(src);
    if (!entry) return false;

    // Check if expired
    if (Date.now() - entry.timestamp > this.CACHE_EXPIRY) {
      this.cache.delete(src);
      return false;
    }

    return entry.loaded;
  }

  cleanup() {
    // Remove expired entries
    const now = Date.now();
    for (const [src, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_EXPIRY) {
        this.cache.delete(src);
      }
    }

    // If still over limit, remove oldest entries
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const sortedEntries = Array.from(this.cache.entries()).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp,
      );

      const toRemove = sortedEntries.slice(0, this.cache.size - this.MAX_CACHE_SIZE);
      toRemove.forEach(([src]) => this.cache.delete(src));
    }
  }

  clear() {
    this.cache.clear();
  }
}

// Global modal image cache instance
const modalImageCache = new ModalImageCache();

interface ImageDetailsModalProps {
  imageInfo: ImageInfo | null;
  onClose: () => void;
  // Optional override from listings table to ensure indicator matches table state
  isLiveOverride?: boolean;
}

// Lazy loading component for modal images
function LazyModalImage({
  src,
  alt,
  className,
  style,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);

  // Mobile optimization - detect mobile device
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Start loading immediately when component mounts (modal is open)
  useEffect(() => {
    const timer = setTimeout(
      () => {
        setShouldLoad(true);
      },
      isMobile ? 100 : 50,
    ); // Slightly longer delay on mobile

    return () => clearTimeout(timer);
  }, [isMobile]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    // Track successful load in cache
    modalImageCache.track(src);
  }, [src]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  // Check if image is already cached
  const isCached = modalImageCache.isLoaded(src);

  // Cleanup: Revoke object URLs and clear cache when component unmounts
  useEffect(() => {
    return () => {
      // Clean up any cached image data if using object URLs
      if (src.startsWith('blob:')) {
        URL.revokeObjectURL(src);
      }
    };
  }, [src]);

  // Show loading state with black background
  if (!shouldLoad || (isLoading && !isCached)) {
    return (
      <div className="relative w-full h-full">
        {/* Black background */}
        <div
          className={className}
          style={{
            ...style,
            backgroundColor: '#000000',
          }}
        />
        {/* Centered loading spinner */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D0B264] opacity-70"></div>
        </div>
        {/* Actually load the image (hidden) */}
        {shouldLoad && (
          <Image
            src={src || '/placeholder.svg'}
            alt={alt}
            fill
            className="opacity-0 pointer-events-none"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw"
            quality={isMobile ? 75 : 85} // Lower quality on mobile for faster loading
            priority={false} // Lazy loading - no priority
            onLoad={handleLoad}
            onError={handleError}
          />
        )}
      </div>
    );
  }

  // Show error state
  if (hasError) {
    return (
      <div
        className={`${className} flex items-center justify-center`}
        style={{
          ...style,
          backgroundColor: '#000000',
        }}
      >
        <div className="text-[#D0B264]/60 text-center">
          <svg
            className="w-12 h-12 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 15.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <p className="text-sm">Failed to load image</p>
        </div>
      </div>
    );
  }

  // Show the loaded image
  return (
    <Image
      src={src || '/placeholder.svg'}
      alt={alt}
      fill
      className={className}
      style={style}
      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw"
      quality={isMobile ? 75 : 85} // Mobile-optimized quality
      priority={false} // Lazy loaded
    />
  );
}

export default function ImageDetailsModal({
  imageInfo,
  onClose,
  isLiveOverride,
}: ImageDetailsModalProps) {
  // Phase 2 Step 3 Action 4: Stabilize onClose to prevent event listener re-registration
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const router = useRouter();

  // State for expandable description - starts expanded (true)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(true);

  // State for purchase inquiry modal
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  // State for auction interest modal (when listing is not live)
  const [isAuctionModalOpen, setIsAuctionModalOpen] = useState(false);

  const isDrvn = imageInfo?.metadata?.id === 'drvn';
  const metadataSymbol = imageInfo?.metadata?.symbol;
  const metadataTicker = imageInfo?.metadata?.ticker;

  const normalizedSymbol = useMemo(() => {
    if (isDrvn) return '';
    return (
      normalizeSymbol(metadataSymbol) ??
      normalizeSymbol(metadataTicker) ??
      ''
    );
  }, [isDrvn, metadataSymbol, metadataTicker]);

  const shouldExposeTokenStats = normalizedSymbol === 'APK';

  const { listing, isLive: hookIsLive } = useListingBySymbol(isDrvn ? '' : normalizedSymbol);

  const [tokenMetrics, setTokenMetrics] = useState<{
    marketCapUsd: number | null;
    tokenPriceUsd: number | null;
  }>({
    marketCapUsd: null,
    tokenPriceUsd: null,
  });

  useEffect(() => {
    let isCancelled = false;

    const fetchTokenMetrics = async () => {
      if (!listing?.token?.contractAddress || !shouldExposeTokenStats) {
        if (!isCancelled) {
          setTokenMetrics({
            marketCapUsd: null,
            tokenPriceUsd: null,
          });
        }
        return;
      }

      try {
        const response = await TokensApi.getTokenMetrics(listing.token.contractAddress);
        if (isCancelled) return;

        if (response.success) {
          const marketCapUsd = Number(response.data.marketCapUsd || 0);
          const tokenPriceUsd = Number(response.data.tokenPriceUsd || 0);
          setTokenMetrics({
            marketCapUsd: Number.isFinite(marketCapUsd) && marketCapUsd > 0 ? marketCapUsd : null,
            tokenPriceUsd: Number.isFinite(tokenPriceUsd) && tokenPriceUsd > 0 ? tokenPriceUsd : null,
          });
        } else {
          setTokenMetrics({
            marketCapUsd: null,
            tokenPriceUsd: null,
          });
        }
      } catch (err) {
        if (isCancelled) return;
        setTokenMetrics({
          marketCapUsd: null,
          tokenPriceUsd: null,
        });
      }
    };

    fetchTokenMetrics();

    return () => {
      isCancelled = true;
    };
  }, [listing?.token?.contractAddress, shouldExposeTokenStats]);

  const computedIsLive = useMemo(() => {
    if (isDrvn) return false;
    if (hookIsLive) return true;
    return isSymbolTradingLive(normalizedSymbol);
  }, [hookIsLive, isDrvn, normalizedSymbol]);

  const isLive = isDrvn ? false : (isLiveOverride ?? computedIsLive);

  // Get token address from listing
  const tokenAddress = isDrvn ? undefined : listing?.token?.contractAddress;

  // Fetch live market cap data
  const { marketCapUsd: fallbackMarketCapUsd } = useTokenMarketCap(tokenAddress, 'usd');

  const resolvedMarketCapUsd = useMemo(() => {
    if (isDrvn || !shouldExposeTokenStats) return 0;
    if (tokenMetrics.marketCapUsd && tokenMetrics.marketCapUsd > 0) {
      return tokenMetrics.marketCapUsd;
    }
    return isFinite(fallbackMarketCapUsd) && fallbackMarketCapUsd > 0
      ? fallbackMarketCapUsd
      : 0;
  }, [fallbackMarketCapUsd, isDrvn, shouldExposeTokenStats, tokenMetrics.marketCapUsd]);

  // Get RRP (Asset Sale Price) from metadata
  const rrpValue = isDrvn ? undefined : (imageInfo?.metadata?.rrp as number | undefined);
  const assetSalePrice = useMemo(() => {
    return rrpValue !== undefined ? rrpValue : 0;
  }, [rrpValue]);

  // Calculate ACES Ratio: Market Cap / Asset Sale Price
  const acesRatio = useMemo(() => {
    if (isDrvn) return 0;
    if (assetSalePrice <= 0 || resolvedMarketCapUsd <= 0) return 0;
    return resolvedMarketCapUsd / assetSalePrice;
  }, [resolvedMarketCapUsd, assetSalePrice, isDrvn]);

  const [backdropStyles, setBackdropStyles] = useState<{
    backdropFilter?: string;
    WebkitBackdropFilter?: string;
    background?: string;
    boxShadow?: string;
  }>({
    // Safe server-side default - no backdrop effects
    background: 'rgba(0, 0, 0, 0.7)',
  });

  // Client-side only backdrop detection to prevent hydration mismatch
  useEffect(() => {
    // Only run on client after hydration
    const clientBackdropStyles = getBackdropFilterCSS('xl');
    setBackdropStyles(clientBackdropStyles);
  }, []);

  // Phase 2 Step 3 Action 4: Stable callback that doesn't change on every render
  const stableOnClose = useCallback(() => {
    try {
      onCloseRef.current();
    } catch (error) {
      // Modal close error - continue silently
    }
  }, []);

  // Cleanup modal image cache when component unmounts
  useEffect(() => {
    return () => {
      // Perform cache cleanup when modal is fully closed
      modalImageCache.cleanup();
    };
  }, []);

  // Phase 2 Step 3 Action 4: Enhanced event listener setup with race condition prevention
  useEffect(() => {
    // Phase 2 Step 3: Early exit if modal is not visible (prevents unnecessary listeners)
    if (!imageInfo) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleEscape = (e: any) => {
      if (e.key === 'Escape') {
        stableOnClose();
      }
    };

    // Phase 2 Step 3 Action 5: Enhanced error handling for modal keydown events
    const keydownListenerResult = addWindowEventListenerSafe('keydown', handleEscape);

    return () => {
      // Phase 2 Step 3 Action 5: Enhanced cleanup with error reporting
      if (keydownListenerResult.success) {
        removeWindowEventListenerSafe('keydown', handleEscape);
      }
    };
  }, [imageInfo, stableOnClose]); // Phase 2 Step 3 Action 4: Use stable callback instead of onClose

  const safeMetadata = getImageMetadata(imageInfo);

  const handleTradeClick = useCallback(() => {
    if (isDrvn) return; // disabled
    if (safeMetadata.id === '7') {
      stableOnClose();
      router.push('/rwa/apk');
    }
  }, [router, safeMetadata.id, stableOnClose, isDrvn]);

  // Enhanced null safety checks
  if (!imageInfo) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        key="image-details-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }} // Faster on mobile
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
        style={{
          // Dynamic backdrop styles with fallbacks
          backgroundColor: backdropStyles.background || 'rgba(0, 0, 0, 0.7)',
          backdropFilter: backdropStyles.backdropFilter,
          WebkitBackdropFilter: backdropStyles.WebkitBackdropFilter,
          boxShadow: backdropStyles.boxShadow,
        }}
        onClick={stableOnClose}
      >
        <div className="origin-center scale-[0.85]">
          <motion.div
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            transition={{
              duration: 0.15,
              ease: 'easeOut',
              // Disable scale animation on mobile for better performance
              scale: {
                duration: typeof window !== 'undefined' && window.innerWidth < 768 ? 0 : 0.15,
              },
            }}
            className="bg-black rounded-2xl sm:rounded-3xl overflow-hidden max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-6xl w-full shadow-goldGlow border border-[#D0B264]/40 max-h-[95vh] sm:max-h-[90vh] lg:h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Scrollable Content Area */}
            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
              {/* Image Section - Now with Lazy Loading */}
              <div className="flex-shrink-0 lg:w-1/2 bg-gradient-to-b from-black/60 to-black p-3 sm:p-6 lg:p-8">
                <div className="relative h-40 sm:h-48 md:h-56 lg:h-full min-h-[160px] max-h-[40vh] sm:max-h-[50vh] lg:max-h-none overflow-hidden rounded-xl sm:rounded-2xl bg-black">
                  {safeMetadata.image ? (
                    <LazyModalImage
                      src={safeMetadata.image}
                      alt={safeMetadata.title}
                      className="object-contain transition-transform duration-200 md:hover:scale-105 bg-black"
                      style={{
                        backgroundColor: '#000000',
                        // Force black background during all loading states
                        backgroundImage: 'none',
                        backgroundRepeat: 'no-repeat',
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#D0B264]/60">
                      <span>No image available</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Content Section - Scrollable */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 pb-0">
                  <div className="flex items-start justify-between mb-4 sm:mb-6">
                    <div className="flex-1 pr-2">
                      <div>
                        <h2 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-[#D0B264] mb-2 sm:mb-3 font-neue-world tracking-wide leading-tight">
                          {safeMetadata.title}
                        </h2>

                        {/* Live trading status indicator */}
                        <div className="mt-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs border ${
                              isLive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-zinc-800/60 text-zinc-300 border-zinc-700'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
                                isLive ? 'bg-emerald-400' : 'bg-zinc-500'
                              }`}
                            />
                            {isLive ? 'Trading live' : 'Not live yet'}
                          </span>
                        </div>

                        {/* Updated Price Display - RRP Price • Token Symbol */}
                        <div className="flex flex-col space-y-2 mb-3">
                          {/* <div className="text-[#FFFFFF]/60 text-xs sm:text-sm font-jetbrains-mono tracking-wide">
                          Bids starting at
                        </div> */}
                          {/* Price Line: RRP [Price] • [Token Symbol] */}
                          {/* <div className="flex items-baseline space-x-2">
                          {(() => {
                            const rrpValue = imageInfo?.metadata?.rrp as number | undefined;
                            if (rrpValue === undefined) return null;
                            const formatted = `$${rrpValue.toLocaleString('en-US', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}`;
                            return (
                              <span className="text-xl sm:text-2xl lg:text-3xl font-neue-world text-[#FFFFFF]/80 font-mono leading-none tracking-widest">
                                {formatted}
                              </span>
                            );
                          })()}
                          <span className="text-[#D0B264]/60 text-lg sm:text-xl lg:text-2xl font-medium">
                            •
                          </span>
                          <span className="text-lg sm:text-xl lg:text-2xl font-neue-world text-[#D0B264] font-mono tracking-widest">
                            {safeMetadata.ticker}
                          </span>
                        </div> */}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={stableOnClose}
                      className="text-[#D0B264]/80 hover:text-[#D0B264] transition-colors duration-150 p-1 flex-shrink-0"
                    >
                      <svg
                        className="w-5 h-5 sm:w-6 sm:h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Add Countdown Timer */}
                  {/* <div className="mb-2">
                  <CountdownTimer
                    targetDate={new Date(safeMetadata.countdownDate || '2025-09-26T16:00:00.000Z')} // Use metadata countdown date or fallback
                  />
                </div> */}

                  <div className="mb-4 sm:mb-6">
                    {/* Enhanced Description with Read More/Less functionality - More space allocated */}
                    <div className="prose prose-invert">
                      <div className="relative">
                        {isDrvn ? (
                          <p className="text-[#FFFFFF]/80 text-sm sm:text-base leading-relaxed font-spectral tracking-wide">
                            Coming soon. DRVN isn’t live yet — check back soon.
                          </p>
                        ) : (
                          <p
                            className={`text-[#FFFFFF]/80 text-sm sm:text-base leading-relaxed font-spectral tracking-wide transition-all duration-300 ${
                              isDescriptionExpanded ? '' : 'line-clamp-3'
                            }`}
                          >
                            {safeMetadata.description}
                          </p>
                        )}

                        {/* Read More Button - Show if description is long enough to be truncated */}
                        {!isDrvn &&
                          safeMetadata.description &&
                          safeMetadata.description.length > 200 && (
                            <div className="mt-3">
                              <button
                                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                                className="text-[#D0B264] text-sm font-medium hover:text-[#D0B264]/80 transition-colors duration-150 flex items-center space-x-1"
                              >
                                <span>{isDescriptionExpanded ? 'Show Less' : 'Read More'}</span>
                                <svg
                                  className={`w-4 h-4 transition-transform duration-200 ${
                                    isDescriptionExpanded ? 'rotate-180' : ''
                                  }`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                  />
                                </svg>
                              </button>
                            </div>
                          )}
                      </div>
                    </div>

                    {/* Asset Stats - More space allocated */}
                    {!isDrvn && (
                      <div className="mt-6 sm:mt-8 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 sm:gap-y-6">
                        {(() => {
                          // Format numbers for display
                          const formatNumber = (num: number): string => {
                            if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
                            if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
                            if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
                            return num.toFixed(2);
                          };

                          // Format ACES Ratio
                          const acesRatioDisplay =
                            acesRatio > 0 ? `${acesRatio.toFixed(2)}x` : 'TBD';

                          // Format Asset Sale Price
                          const assetSalePriceDisplay =
                            assetSalePrice > 0
                              ? `$${assetSalePrice.toLocaleString('en-US', {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 0,
                                })}`
                              : 'TBD';

                          // Format Market Cap
                          const marketCapDisplay =
                            resolvedMarketCapUsd > 0
                              ? `$${formatNumber(resolvedMarketCapUsd)}`
                              : 'TBD';

                          const stats = [
                            {
                              label: 'Market Cap',
                              value: marketCapDisplay,
                            },
                            {
                              label: 'Real World Value',
                              value: assetSalePriceDisplay,
                            },
                            {
                              label: 'ACES Ratio',
                              value: acesRatioDisplay,
                            },
                          ];

                          return stats.map(({ label, value }) => (
                            <div key={label} className="flex flex-col">
                              <span className="text-[10px] xs:text-xs sm:text-xs md:text-sm text-[#FFFFFF]/60 tracking-wide font-jetbrains-mono uppercase">
                                {label}
                              </span>
                              <span className="text-xs xs:text-sm sm:text-sm md:text-base font-neue-world font-bold text-[#D0B264] mt-1">
                                {value}
                              </span>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fixed Button Area */}
                <div className="flex-shrink-0 p-3 sm:p-6 lg:p-8 pt-0 bg-gradient-to-t from-black via-black/95 to-transparent">
                  <div className="flex gap-3">
                    {isDrvn ? (
                      <button
                        disabled
                        className="flex-1 bg-zinc-800/60 text-zinc-300 border border-zinc-700 font-syne font-bold py-3 sm:py-4 px-4 sm:px-6 lg:px-8 rounded-lg sm:rounded-xl text-sm sm:text-base lg:text-lg text-center cursor-not-allowed"
                      >
                        Coming Soon
                      </button>
                    ) : (
                      <button
                        onClick={handleTradeClick}
                        className="flex-1 bg-gradient-to-r from-[#D0B264] to-[#D0B264]/80 hover:from-[#D0B264]/90 hover:to-[#D0B264]/70 text-[#231F20] font-syne font-bold py-3 sm:py-4 px-4 sm:px-6 lg:px-8 rounded-lg sm:rounded-xl transition-all duration-150 transform active:scale-[0.98] shadow-goldGlow text-sm sm:text-base lg:text-lg md:hover:scale-[1.02] text-center"
                      >
                        TRADE
                      </button>
                    )}
                    <button
                      onClick={() =>
                        isLive ? setIsPurchaseModalOpen(true) : setIsAuctionModalOpen(true)
                      }
                      className="flex-1 bg-gradient-to-r from-[#231F20] to-[#231F20]/90 hover:from-[#181515]/90 hover:to-[#363636]/80 text-[#D0B264] font-syne font-bold py-3 sm:py-4 px-4 sm:px-6 lg:px-8 rounded-lg sm:rounded-xl transition-all duration-150 transform active:scale-[0.98] shadow-goldGlow text-sm sm:text-base lg:text-lg md:hover:scale-[1.02] text-center border border-[#D0B264]/70"
                    >
                      AUCTION
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Purchase Inquiry Modal */}
      <PurchaseInquiryModal
        key="purchase-inquiry-modal"
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        productTitle={safeMetadata.title}
        productTicker={safeMetadata.ticker}
        productPrice={(() => {
          const rrpValue = imageInfo?.metadata?.rrp as number | undefined;
          if (rrpValue === undefined) return undefined;
          return `$${rrpValue.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}`;
        })()}
      />

      {/* Auction Interest Modal (when listing is not live) */}
      <AuctionInterestModal
        key="auction-interest-modal"
        isOpen={isAuctionModalOpen}
        onClose={() => setIsAuctionModalOpen(false)}
        productTitle={safeMetadata.title}
        productTicker={safeMetadata.ticker}
      />
    </AnimatePresence>
  );
}
