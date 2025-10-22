'use client';

import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
  type Dispatch,
  type SetStateAction,
} from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTokenMarketCap } from '@/hooks/use-token-market-cap';
import type { ImageData } from '@/types/rwa/section.types';
import { createImageErrorHandler, getValidImageSrc } from '@/lib/utils/image-error-handler';

interface TokenMarketCapProps {
  tokenAddress: string;
  tokenSymbol?: string;
  chainId?: number;
  images?: ImageData[];
  selectedImageIndex?: number;
  onImageSelect?: Dispatch<SetStateAction<number>>;
}

const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => {
  return new Intl.NumberFormat('en-US', options).format(value);
};

interface InlineThumbnailCarouselProps {
  images: ImageData[];
  selectedIndex?: number;
  onSelect?: Dispatch<SetStateAction<number>>;
  onOpen: (index: number) => void;
}

const InlineThumbnailCarousel: React.FC<InlineThumbnailCarouselProps> = ({
  images,
  selectedIndex,
  onSelect,
  onOpen,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', updateScrollState);
    return () => container.removeEventListener('scroll', updateScrollState);
  }, [updateScrollState, images.length]);

  const handleScroll = useCallback((direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const delta = 80;
    const next = direction === 'left' ? container.scrollLeft - delta : container.scrollLeft + delta;
    container.scrollTo({ left: next, behavior: 'smooth' });
  }, []);

  const handleThumbnailClick = (index: number) => {
    onSelect?.(index);
    onOpen(index);
  };

  return (
    <div className="flex items-center gap-2">
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => handleScroll('left')}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D0B284]/40 bg-black/70 text-[#D0B284] transition hover:border-[#D0B284] hover:text-[#F1DFA4]"
          aria-label="Scroll images left"
        >
          <ChevronLeft size={14} strokeWidth={2.5} />
        </button>
      )}
      <div ref={scrollContainerRef} className="flex max-w-[240px] gap-2 overflow-hidden">
        {images.map((image, index) => (
          <button
            type="button"
            key={image.id ?? `${image.src}-${index}`}
            onClick={() => handleThumbnailClick(index)}
            className={cn(
              'relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-md border transition duration-200',
              selectedIndex === index
                ? 'border-[#D0B284] ring-2 ring-[#D0B284]/50'
                : 'border-[#D0B284]/20 hover:border-[#D0B284]/70',
            )}
            aria-label={`View image ${index + 1}`}
          >
            <Image
              src={getValidImageSrc(image.thumbnail || image.src, undefined, {
                width: 120,
                height: 120,
                text: 'Image',
              })}
              alt={image.alt || `Gallery image ${index + 1}`}
              fill
              className="object-cover"
              sizes="56px"
              unoptimized={image.src?.includes('storage.googleapis.com')}
              onError={createImageErrorHandler({
                fallbackText: 'Image',
                width: 120,
                height: 120,
              })}
            />
          </button>
        ))}
      </div>
      {canScrollRight && (
        <button
          type="button"
          onClick={() => handleScroll('right')}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D0B284]/40 bg-black/70 text-[#D0B284] transition hover:border-[#D0B284] hover:text-[#F1DFA4]"
          aria-label="Scroll images right"
        >
          <ChevronRight size={14} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
};

interface LightboxProps {
  image: ImageData;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

const LightboxOverlay: React.FC<LightboxProps> = ({ image, onClose, onPrev, onNext }) => {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex h-full w-full max-w-5xl items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex w-full items-center justify-center gap-6">
          {onPrev && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onPrev();
              }}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-[#D0B284]/50 bg-black/70 text-white transition hover:border-[#D0B284] hover:bg-black/80"
              aria-label="Previous image"
            >
              <ChevronLeft size={28} />
            </button>
          )}
          <div className="relative flex max-h-[85vh] w-full max-w-4xl items-center justify-center">
            <Image
              src={image.src}
              alt={image.alt}
              width={1920}
              height={1080}
              className="max-h-[85vh] w-auto max-w-full rounded-lg object-contain"
              priority
            />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onClose();
              }}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
              aria-label="Close image"
            >
              <X size={24} />
            </button>
          </div>
          {onNext && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onNext();
              }}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-[#D0B284]/50 bg-black/70 text-white transition hover:border-[#D0B284] hover:bg-black/80"
              aria-label="Next image"
            >
              <ChevronRight size={28} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const TokenMarketCap: React.FC<TokenMarketCapProps> = ({
  tokenAddress,
  tokenSymbol = 'TOKEN',
  chainId,
  images,
  selectedImageIndex,
  onImageSelect,
}) => {
  // Use the correct market cap hook that fetches price × supply
  // NOT total ACES deposited in the bonding curve
  const { marketCapUsd, marketCapAces, loading, error } = useTokenMarketCap(tokenAddress, 'usd');

  const formattedMarketCapUSD = useMemo(() => {
    if (marketCapUsd <= 0) {
      return null;
    }

    return formatNumber(marketCapUsd, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: marketCapUsd >= 1000 ? 0 : 2,
      notation: marketCapUsd >= 1_000_000 ? 'compact' : 'standard',
    });
  }, [marketCapUsd]);

  const formattedMarketCapACES = useMemo(() => {
    if (marketCapAces <= 0) {
      return `0 ACES`;
    }

    return `${formatNumber(marketCapAces, {
      maximumFractionDigits: marketCapAces >= 1000 ? 0 : 2,
      notation: marketCapAces >= 1_000_000 ? 'compact' : 'standard',
    })} ACES`;
  }, [marketCapAces]);

  const isLoading = loading;

  const usdDisplay = isLoading
    ? 'Calculating…'
    : error
      ? 'Error loading'
      : (formattedMarketCapUSD ?? (marketCapAces > 0 ? '$0.00' : '$0'));

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const hasImages = Array.isArray(images) && images.length > 0;

  const openLightbox = useCallback(
    (index: number) => {
      if (!hasImages) return;
      setLightboxIndex(index);
      onImageSelect?.(index);
    },
    [hasImages, onImageSelect],
  );

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const showPrevImage = useCallback(() => {
    if (!hasImages) return;
    setLightboxIndex((current) => {
      if (current === null) return current;
      const nextIndex = current === 0 ? images!.length - 1 : current - 1;
      onImageSelect?.(nextIndex);
      return nextIndex;
    });
  }, [hasImages, images, onImageSelect]);

  const showNextImage = useCallback(() => {
    if (!hasImages) return;
    setLightboxIndex((current) => {
      if (current === null) return current;
      const nextIndex = current === images!.length - 1 ? 0 : current + 1;
      onImageSelect?.(nextIndex);
      return nextIndex;
    });
  }, [hasImages, images, onImageSelect]);

  useEffect(() => {
    if (lightboxIndex === null) {
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeLightbox();
      } else if (event.key === 'ArrowLeft') {
        showPrevImage();
      } else if (event.key === 'ArrowRight') {
        showNextImage();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, closeLightbox, showPrevImage, showNextImage]);

  return (
    <div className="mb-4 rounded-xl border border-[#D0B284]/15 bg-transparent px-4 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col">
          <div className="text-xs uppercase tracking-wide text-[#DCDDCC]/60">Market Cap</div>
          <div className="mt-1 text-xl font-semibold text-[#D0B284]">{usdDisplay}</div>
        </div>

        {hasImages && (
          <div className="hidden md:flex md:flex-1 md:justify-center">
            <InlineThumbnailCarousel
              images={images!}
              selectedIndex={selectedImageIndex}
              onSelect={onImageSelect}
              onOpen={openLightbox}
            />
          </div>
        )}

        <div className="text-xs text-[#DCDDCC]/50 md:text-right">{formattedMarketCapACES}</div>
      </div>

      {hasImages && lightboxIndex !== null && images?.[lightboxIndex] && (
        <LightboxOverlay
          image={images[lightboxIndex]}
          onClose={closeLightbox}
          onPrev={images.length > 1 ? showPrevImage : undefined}
          onNext={images.length > 1 ? showNextImage : undefined}
        />
      )}
    </div>
  );
};

export default TokenMarketCap;
