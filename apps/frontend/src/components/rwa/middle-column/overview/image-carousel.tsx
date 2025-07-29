'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ImageData } from '../../../../types/rwa/section.types';

interface ImageCarouselProps {
  selectedImageIndex: number;
  setSelectedImageIndex: (index: number) => void;
  mockImages: ImageData[];
}

export default function ImageCarousel({
  selectedImageIndex,
  setSelectedImageIndex,
  mockImages,
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

  return (
    <div className="flex-1 relative min-h-[400px]">
      <div className="relative h-full bg-[#231F20] rounded-lg border border-[#D0B284]/20 overflow-hidden">
        {/* Main Image Display */}
        <div className="absolute inset-0 z-0">
          <Image
            src={mockImages[selectedImageIndex].src || '/placeholder.svg'}
            alt={mockImages[selectedImageIndex].alt}
            className="w-full h-full object-cover"
            onError={(e) => {
              console.log('Image failed to load:', mockImages[selectedImageIndex].src);
              e.currentTarget.src = '/placeholder.svg?height=400&width=600&text=Image Error';
            }}
            width={100}
            height={100}
          />
        </div>

        {/* Dark overlay for better button visibility */}
        <div className="absolute inset-0 bg-black/10 z-1"></div>

        {/* Left Navigation Button */}
        <button
          onClick={handlePrevImage}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 text-[#D0B284] p-3 rounded-full border border-[#D0B284]/50 hover:border-[#D0B284] transition-all duration-200 z-10 backdrop-blur-sm"
        >
          <ChevronLeft size={24} />
        </button>

        {/* Right Navigation Button */}
        <button
          onClick={handleNextImage}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 text-[#D0B284] p-3 rounded-full border border-[#D0B284]/50 hover:border-[#D0B284] transition-all duration-200 z-10 backdrop-blur-sm"
        >
          <ChevronRight size={24} />
        </button>

        {/* Image Counter
        <div className="absolute bottom-4 right-4 bg-black/70 text-[#D0B284] px-3 py-1 rounded-full text-sm font-mono border border-[#D0B284]/50 z-10 backdrop-blur-sm">
          {selectedImageIndex + 1} / {mockImages.length}
        </div>

        {/* Image Title/Description */}
        {/* <div className="absolute bottom-4 left-4 bg-black/70 text-[#D0B284] px-3 py-1 rounded-full text-sm font-mono border border-[#D0B284]/50 z-10 backdrop-blur-sm">
          {mockImages[selectedImageIndex].alt}
        </div> */}
      </div>
    </div>
  );
}
