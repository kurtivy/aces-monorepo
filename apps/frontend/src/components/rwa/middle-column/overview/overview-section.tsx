'use client';

import { useState } from 'react';
import ImageCarousel from './image-carousel';
import OverviewBottomSection from './overview-bottom-section';
import type { ImageData } from '../../../../types/rwa/section.types';
import Image from 'next/image';

interface OverviewSectionProps {
  selectedImageIndex: number;
  setSelectedImageIndex: (index: number) => void;
  mockImages: ImageData[];
  launchDate?: string | null;
  tokenAddress?: string;
}

interface ImageOverlayProps {
  image: ImageData;
  onClose: () => void;
}

function ImageOverlay({ image, onClose }: ImageOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-6xl max-h-[90vh] w-full h-full flex items-center justify-center">
        <Image
          src={image.src}
          alt={image.alt}
          className="max-w-full max-h-full object-contain rounded-lg"
          onClick={(e) => e.stopPropagation()}
          width={1920}
          height={1080}
        />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function OverviewSection({
  selectedImageIndex,
  setSelectedImageIndex,
  mockImages,
  launchDate,
  tokenAddress,
}: OverviewSectionProps) {
  const [overlayImage, setOverlayImage] = useState<ImageData | null>(null);

  const handleImageClick = (image: ImageData) => {
    setOverlayImage(image);
  };

  const handleCloseOverlay = () => {
    setOverlayImage(null);
  };

  return (
    <>
      <div className="flex flex-col space-y-6">
        {/* Image Carousel - Responsive height container */}
        <div className="h-80 sm:h-80 md:h-96 lg:h-[28rem] xl:h-[28rem] 2xl:h-[40rem] w-full flex-shrink-0">
          <ImageCarousel
            selectedImageIndex={selectedImageIndex}
            setSelectedImageIndex={setSelectedImageIndex}
            mockImages={mockImages}
            onImageClick={handleImageClick}
          />
        </div>

        {/* Bottom Section - Countdown Timer */}
        <div className="w-full flex-shrink-0">
          <OverviewBottomSection
            launchDate={launchDate}
            showProgression={false}
            tokenAddress={tokenAddress}
          />
        </div>
      </div>

      {/* Image Overlay */}
      {overlayImage && <ImageOverlay image={overlayImage} onClose={handleCloseOverlay} />}
    </>
  );
}
