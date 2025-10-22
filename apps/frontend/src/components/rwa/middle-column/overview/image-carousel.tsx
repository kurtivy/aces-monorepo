'use client';

import { type Dispatch, type SetStateAction } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ImageData } from '../../../../types/rwa/section.types';
import { createImageErrorHandler, getValidImageSrc } from '@/lib/utils/image-error-handler';

interface ImageCarouselProps {
  selectedImageIndex: number;
  setSelectedImageIndex: Dispatch<SetStateAction<number>>;
  mockImages: ImageData[];
  onImageClick?: (image: ImageData) => void;
}

export default function ImageCarousel({
  selectedImageIndex,
  setSelectedImageIndex,
  mockImages,
  onImageClick,
}: ImageCarouselProps) {
  const handlePrevImage = () => {
    if (!mockImages.length) return;
    setSelectedImageIndex((prevIndex) =>
      prevIndex === 0 ? mockImages.length - 1 : prevIndex - 1,
    );
  };

  const handleNextImage = () => {
    if (!mockImages.length) return;
    setSelectedImageIndex((prevIndex) =>
      prevIndex === mockImages.length - 1 ? 0 : prevIndex + 1,
    );
  };

  const handleImageClick = () => {
    if (onImageClick) {
      onImageClick(mockImages[selectedImageIndex]);
    }
  };

  if (!mockImages.length) {
    return null;
  }

  return (
    <div className="relative w-full h-full bg-black/20 rounded-xl overflow-hidden">
      <div className="relative w-full h-full flex justify-center items-center">
        <div className="relative w-full h-full cursor-pointer" onClick={handleImageClick}>
          <Image
            src={getValidImageSrc(
              mockImages[selectedImageIndex].src,
              undefined,
              { width: 600, height: 400, text: 'Image Error' }
            )}
            alt={mockImages[selectedImageIndex].alt}
            className="w-full h-full object-contain rounded-xl"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            unoptimized={mockImages[selectedImageIndex].src?.includes('storage.googleapis.com')}
            onError={createImageErrorHandler({
              fallbackText: 'Image Error',
              width: 600,
              height: 400,
              onError: (src) => {
                console.error('Carousel image failed to load:', src);
              },
              maxRetries: 2,
            })}
          />
        </div>
      </div>

      <button
        onClick={handlePrevImage}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D0B284] hover:text-[#F1DFA4] transition-colors duration-200 z-10"
        aria-label="Previous image"
      >
        <ChevronLeft size={28} strokeWidth={2.5} />
      </button>

      <button
        onClick={handleNextImage}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D0B284] hover:text-[#F1DFA4] transition-colors duration-200 z-10"
        aria-label="Next image"
      >
        <ChevronRight size={28} strokeWidth={2.5} />
      </button>
    </div>
  );
}
