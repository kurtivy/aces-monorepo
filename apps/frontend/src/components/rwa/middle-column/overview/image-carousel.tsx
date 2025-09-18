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
    <div className="relative w-full h-full bg-black/20 rounded-xl overflow-hidden">
      <div className="relative h-full flex justify-center items-center px-2 py-2">
        <div className="relative border-2 border-[#D0B284] rounded-xl p-2">
          <Image
            src={mockImages[selectedImageIndex].src || '/placeholder.svg'}
            alt={mockImages[selectedImageIndex].alt}
            className="max-w-full max-h-[60vh] object-contain rounded-xl"
            onError={(e) => {
              console.log('Image failed to load:', mockImages[selectedImageIndex].src);
              e.currentTarget.src = '/placeholder.svg?height=400&width=600&text=Image Error';
            }}
            width={800}
            height={600}
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
