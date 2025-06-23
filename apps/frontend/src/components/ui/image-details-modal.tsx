'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import type { ImageInfo } from '../../types/canvas';
import { getImageMetadata } from '../../lib/utils/luxury-logger';
import {
  addWindowEventListenerSafe,
  removeWindowEventListenerSafe,
} from '../../lib/utils/event-listener-utils';
import { getBackdropFilterCSS } from '../../lib/utils/browser-utils';

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
            src={src}
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
      src={src}
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

export default function ImageDetailsModal({ imageInfo, onClose }: ImageDetailsModalProps) {
  // Phase 2 Step 3 Action 4: Stabilize onClose to prevent event listener re-registration
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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

    const handleEscape = (e: Event) => {
      const keyboardEvent = e as KeyboardEvent;
      if (keyboardEvent.key === 'Escape') {
        stableOnClose();
      }
    };

    // Phase 2 Step 3 Action 5: Enhanced error handling for modal keydown events
    const keydownListenerResult = addWindowEventListenerSafe('keydown', handleEscape);

    if (!keydownListenerResult.success) {
      console.warn(
        '[Phase 2 Step 3] Modal keydown listener setup failed:',
        keydownListenerResult.details,
      );
      // Modal will still work via click outside, just no keyboard ESC support
    } else if (keydownListenerResult.fallbackApplied) {
      console.info('[Phase 2 Step 3] Modal keydown listener using fallback strategy');
    }

    return () => {
      // Phase 2 Step 3 Action 5: Enhanced cleanup with error reporting
      if (keydownListenerResult.success) {
        const removeResult = removeWindowEventListenerSafe('keydown', handleEscape);
        if (!removeResult.success) {
          console.warn(
            '[Phase 2 Step 3] Modal keydown listener cleanup failed:',
            removeResult.details,
          );
        }
      }
    };
  }, [imageInfo, stableOnClose]); // Phase 2 Step 3 Action 4: Use stable callback instead of onClose

  // Enhanced null safety checks
  if (!imageInfo) {
    return null;
  }

  // Use safe metadata access
  const safeMetadata = getImageMetadata(imageInfo);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }} // Faster on mobile
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
        style={{
          // Dynamic backdrop styles with fallbacks
          backgroundColor: backdropStyles.background || 'rgba(0, 0, 0, 0.7)',
          backdropFilter: backdropStyles.backdropFilter,
          WebkitBackdropFilter: backdropStyles.WebkitBackdropFilter,
          boxShadow: backdropStyles.boxShadow,
        }}
        onClick={stableOnClose}
      >
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
          className="bg-black rounded-2xl sm:rounded-3xl overflow-hidden max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-6xl w-full shadow-goldGlow border border-[#D0B264]/40 max-h-[95vh] sm:max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col lg:flex-row h-full max-h-[95vh] sm:max-h-[90vh]">
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

            {/* Content Section */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex-1 p-3 sm:p-6 lg:p-8 flex flex-col justify-between overflow-y-auto"
            >
              <div className="flex items-start justify-between mb-4 sm:mb-6">
                <div className="flex-1 pr-2">
                  <div>
                    {' '}
                    {/* Remove motion.div wrapper */}
                    <h2 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-[#D0B264] mb-1 sm:mb-2 font-syne tracking-wide leading-tight">
                      {safeMetadata.title}
                    </h2>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
                      <span className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-syne text-[#D0B264] font-bold">
                        {safeMetadata.ticker}
                      </span>
                      {safeMetadata.date && (
                        <span className="text-[#FFFFFF]/60 text-xs sm:text-sm font-jetbrains-mono tracking-wide">
                          • Listed {new Date(safeMetadata.date).toLocaleDateString()}
                        </span>
                      )}
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

              <div className="flex-1 mb-4 sm:mb-0">
                {' '}
                {/* Remove motion.div wrapper */}
                <div className="prose prose-invert">
                  <p className="text-[#FFFFFF]/80 text-sm sm:text-base leading-relaxed font-spectral tracking-wide line-clamp-4 sm:line-clamp-none">
                    {safeMetadata.description}
                  </p>
                </div>
              </div>

              <div className="mt-3 sm:mt-6 lg:mt-8">
                {' '}
                {/* Remove motion.div wrapper */}
                <button className="w-full bg-gradient-to-r from-[#D0B264] to-[#D0B264]/80 hover:from-[#D0B264]/90 hover:to-[#D0B264]/70 text-[#231F20] font-syne font-bold py-3 sm:py-4 px-4 sm:px-6 lg:px-8 rounded-lg sm:rounded-xl transition-all duration-150 transform active:scale-[0.98] shadow-goldGlow text-sm sm:text-base lg:text-lg md:hover:scale-[1.02]">
                  Tokenize Soon!
                </button>
              </div>

              <div className="mt-3 sm:mt-4 lg:mt-6 flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm text-[#FFFFFF]/60">
                {' '}
                {/* Remove motion.div wrapper */}
                <span className="flex items-center font-jetbrains-mono tracking-wide">
                  <svg
                    className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 mr-1 text-[#D0B264]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  Secure Transaction
                </span>
                <span className="flex items-center font-jetbrains-mono tracking-wide">
                  <svg
                    className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 mr-1 text-[#D0B264]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Verified Authentic
                </span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
