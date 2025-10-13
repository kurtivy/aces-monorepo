'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImageData } from '../../../../types/rwa/section.types';
import { createImageErrorHandler, getValidImageSrc } from '@/lib/utils/image-error-handler';

interface DynamicImageGalleryProps {
  images: ImageData[];
  selectedImageIndex: number;
  onImageSelect: (index: number) => void;
  loading?: boolean;
}

export default function DynamicImageGallery({
  images,
  selectedImageIndex,
  onImageSelect,
  loading = false,
}: DynamicImageGalleryProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isImageFading, setIsImageFading] = useState(false);
  const isInitialRenderRef = useRef(true);
  const clampedSelectedIndex =
    images.length > 0 ? Math.min(Math.max(selectedImageIndex, 0), images.length - 1) : 0;
  const selectedImage = images[clampedSelectedIndex];

  // Track if component is mounted (for portal)
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Check scroll capabilities
  const checkScrollCapabilities = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth);
    }
  };

  // Auto-scroll to selected image when it changes
  useEffect(() => {
    if (scrollContainerRef.current && images.length > 4 && images[clampedSelectedIndex]) {
      const container = scrollContainerRef.current;
      const selectedElement = container.children[clampedSelectedIndex] as HTMLElement;

      if (selectedElement) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = selectedElement.getBoundingClientRect();

        // Check if element is outside visible area
        if (elementRect.left < containerRect.left || elementRect.right > containerRect.right) {
          selectedElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center',
          });
        }
      }
    }
  }, [selectedImageIndex, clampedSelectedIndex, images.length]);

  // Check scroll capabilities on mount and when images change
  useEffect(() => {
    checkScrollCapabilities();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollCapabilities);
      return () => container.removeEventListener('scroll', checkScrollCapabilities);
    }
  }, [images]);

  // Trigger fade animation when selected image changes
  useEffect(() => {
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
      return;
    }

    setIsImageFading(true);

    const timeoutId = window.setTimeout(() => {
      setIsImageFading(false);
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [clampedSelectedIndex]);

  // Auto-cycle images every 5 seconds when lightbox is closed
  useEffect(() => {
    if (isLightboxOpen || images.length <= 1) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextIndex = clampedSelectedIndex === images.length - 1 ? 0 : clampedSelectedIndex + 1;
      onImageSelect(nextIndex);
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [clampedSelectedIndex, images.length, isLightboxOpen, onImageSelect]);

  // Handle keyboard navigation in lightbox
  useEffect(() => {
    if (!isLightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false);
      } else if (e.key === 'ArrowLeft' && clampedSelectedIndex > 0) {
        onImageSelect(clampedSelectedIndex - 1);
      } else if (e.key === 'ArrowRight' && clampedSelectedIndex < images.length - 1) {
        onImageSelect(clampedSelectedIndex + 1);
      }
    };

    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLightboxOpen, clampedSelectedIndex, images.length, onImageSelect]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollAmount = 100; // Adjust scroll amount as needed
      const newScrollLeft =
        direction === 'left'
          ? container.scrollLeft - scrollAmount
          : container.scrollLeft + scrollAmount;

      container.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth',
      });
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex-shrink-0 p-0">
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="aspect-square rounded border border-[#D0B284]/20 bg-[#231F20] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (!images || images.length === 0) {
    return (
      <div className="flex-shrink-0 p-3">
        <div className="text-center py-8">
          <div className="text-gray-400 text-sm">No images available</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-shrink-0 p-1 bg-transparent">
        {/* Selected image preview - clickable to open lightbox */}
        <div
          className="relative w-full h-36 sm:h-46 bg-black/20 rounded-xl overflow-hidden mb-3 cursor-pointer group"
          onClick={() => setIsLightboxOpen(true)}
        >
          {selectedImage && (
            <>
              <div className="absolute inset-0 transition-transform duration-200 group-hover:scale-105">
                <div
                  className={cn(
                    'relative w-full h-full transition-opacity duration-700',
                    isImageFading ? 'opacity-0' : 'opacity-100',
                  )}
                >
                  <Image
                    src={getValidImageSrc(selectedImage.src, undefined, {
                      width: 512,
                      height: 384,
                      text: 'Preview Error',
                    })}
                    alt={selectedImage.alt}
                    fill
                    className="object-contain rounded-xl"
                    sizes="(max-width: 768px) 100vw, 33vw"
                    unoptimized={selectedImage.src?.includes('storage.googleapis.com')}
                    onError={createImageErrorHandler({
                      fallbackText: 'Preview Error',
                      width: 512,
                      height: 384,
                      onError: (src) => {
                        console.error('Gallery preview failed to load:', src);
                      },
                      maxRetries: 2,
                    })}
                  />
                </div>
              </div>
              {/* Hover overlay hint */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white text-sm bg-black/60 px-3 py-1.5 rounded-lg">
                  Click to enlarge
                </div>
              </div>
            </>
          )}
        </div>

        {/* Scrollable container */}
        <div className="relative">
          {/* Left scroll button */}
          {images.length > 4 && canScrollLeft && (
            <button
              onClick={() => handleScroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 hover:bg-black text-[#D0B284] p-1 rounded-full border border-[#D0B284]/50 hover:border-[#D0B284] transition-all duration-200"
            >
              <ChevronLeft size={16} />
            </button>
          )}

          {/* Right scroll button */}
          {images.length > 4 && canScrollRight && (
            <button
              onClick={() => handleScroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 hover:bg-black text-[#D0B284] p-1 rounded-full border border-[#D0B284]/50 hover:border-[#D0B284] transition-all duration-200"
            >
              <ChevronRight size={16} />
            </button>
          )}

          {/* Images grid */}
          <div
            ref={scrollContainerRef}
            className={cn(
              'grid gap-1.5 overflow-x-auto scrollbar-hide px-6',
              images.length > 4 ? 'grid-cols-none flex' : 'grid-cols-4',
            )}
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {images.map((image, index) => (
              <div
                key={image.id}
                className={cn(
                  'aspect-square rounded border transition-all duration-200 overflow-hidden cursor-pointer flex-shrink-0',
                  images.length > 4 ? 'w-8' : '',
                  clampedSelectedIndex === index
                    ? 'border-[#D0B284] ring-2 ring-[#D0B284]/50'
                    : 'border-[#D0B284]/20 hover:border-[#D0B284]',
                )}
                onClick={() => onImageSelect(index)}
              >
                <Image
                  src={getValidImageSrc(image.thumbnail || image.src, undefined, {
                    width: 20,
                    height: 20,
                    text: 'Error',
                  })}
                  alt={image.alt}
                  width={20}
                  height={20}
                  className="w-full h-full object-cover"
                  unoptimized={image.src?.includes('storage.googleapis.com')}
                  onError={createImageErrorHandler({
                    fallbackText: 'Error',
                    width: 20,
                    height: 20,
                    onError: (src) => {
                      console.error('Gallery thumbnail failed to load:', src);
                    },
                    maxRetries: 1,
                  })}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lightbox Modal - Rendered via Portal to cover entire viewport */}
      {mounted &&
        isLightboxOpen &&
        selectedImage &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-lg"
            onClick={() => setIsLightboxOpen(false)}
          >
            {/* Close button */}
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors duration-200"
              aria-label="Close"
            >
              <X size={24} />
            </button>

            {/* Image counter */}
            <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-lg bg-black/60 text-white text-sm">
              {clampedSelectedIndex + 1} / {images.length}
            </div>

            {/* Navigation buttons */}
            {images.length > 1 && (
              <>
                {clampedSelectedIndex > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onImageSelect(clampedSelectedIndex - 1);
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors duration-200"
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={28} />
                  </button>
                )}
                {clampedSelectedIndex < images.length - 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onImageSelect(clampedSelectedIndex + 1);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors duration-200"
                    aria-label="Next image"
                  >
                    <ChevronRight size={28} />
                  </button>
                )}
              </>
            )}

            {/* Main image */}
            <div
              className="relative max-w-[90vw] max-h-[90vh] w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={getValidImageSrc(selectedImage.src, undefined, {
                  width: 1920,
                  height: 1080,
                  text: 'Image Not Available',
                })}
                alt={selectedImage.alt}
                width={1920}
                height={1080}
                className="max-w-full max-h-[90vh] w-auto h-auto object-contain"
                unoptimized={selectedImage.src?.includes('storage.googleapis.com')}
                onError={createImageErrorHandler({
                  fallbackText: 'Image Not Available',
                  width: 1920,
                  height: 1080,
                  onError: (src) => {
                    console.error('Lightbox image failed to load:', src);
                  },
                  maxRetries: 2,
                })}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
