'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  const clampedSelectedIndex =
    images.length > 0 ? Math.min(Math.max(selectedImageIndex, 0), images.length - 1) : 0;
  const selectedImage = images[clampedSelectedIndex];

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
      <div className="flex-shrink-0 p-3">
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
    <div className="flex-shrink-0 p-3 bg-transparent">
      {/* Selected image preview */}
      <div className="relative w-full h-40 sm:h-48 bg-black/30 rounded-xl overflow-hidden mb-3">
        {selectedImage && (
          <Image
            src={getValidImageSrc(selectedImage.src, undefined, {
              width: 640,
              height: 480,
              text: 'Preview Error',
            })}
            alt={selectedImage.alt}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 33vw"
            unoptimized={selectedImage.src?.includes('storage.googleapis.com')}
            onError={createImageErrorHandler({
              fallbackText: 'Preview Error',
              width: 640,
              height: 480,
              onError: (src) => {
                console.error('Gallery preview failed to load:', src);
              },
              maxRetries: 2,
            })}
          />
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
            'grid gap-1.5 overflow-x-auto scrollbar-hide',
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
                images.length > 4 ? 'w-16' : '',
                clampedSelectedIndex === index
                  ? 'border-[#D0B284] ring-2 ring-[#D0B284]/50'
                  : 'border-[#D0B284]/20 hover:border-[#D0B284]',
              )}
              onClick={() => onImageSelect(index)}
            >
              <Image
                src={getValidImageSrc(image.thumbnail || image.src, undefined, {
                  width: 100,
                  height: 100,
                  text: 'Error',
                })}
                alt={image.alt}
                width={100}
                height={100}
                className="w-full h-full object-cover"
                unoptimized={image.src?.includes('storage.googleapis.com')}
                onError={createImageErrorHandler({
                  fallbackText: 'Error',
                  width: 100,
                  height: 100,
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
  );
}
