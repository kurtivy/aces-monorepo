'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ImageData } from '../../../../types/rwa/section.types';

interface ImageCarouselProps {
  selectedImageIndex: number;
  setSelectedImageIndex: (index: number) => void;
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
    setSelectedImageIndex(
      selectedImageIndex === 0 ? mockImages.length - 1 : selectedImageIndex - 1,
    );
  };

  const handleNextImage = () => {
    setSelectedImageIndex(
      selectedImageIndex === mockImages.length - 1 ? 0 : selectedImageIndex + 1,
    );
  };

  const handleImageClick = () => {
    if (onImageClick) {
      onImageClick(mockImages[selectedImageIndex]);
    }
  };

  return (
    <div className="relative w-full h-full bg-black/20 rounded-xl overflow-hidden">
      <div className="relative w-full h-full flex justify-center items-center">
        <div className="relative w-full h-full cursor-pointer" onClick={handleImageClick}>
          <Image
            src={mockImages[selectedImageIndex].src || '/placeholder.svg'}
            alt={mockImages[selectedImageIndex].alt}
            className="w-full h-full object-contain rounded-xl"
            onError={(e) => {
              console.log('Image failed to load:', mockImages[selectedImageIndex].src);
              e.currentTarget.src = '/placeholder.svg?height=400&width=600&text=Image Error';
            }}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
      </div>

      <button
        onClick={handlePrevImage}
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-[#D0B284] hover:bg-[#D0B284]/80 p-3 text-black rounded-full shadow-lg transition-all duration-200 z-10"
      >
        <ChevronLeft size={20} />
      </button>

      <button
        onClick={handleNextImage}
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-[#D0B284] hover:bg-[#D0B284]/80 p-3 text-black rounded-full shadow-lg transition-all duration-200 z-10"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
