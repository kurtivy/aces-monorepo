'use client';

import ImageCarousel from './image-carousel';
import OverviewBottomSection from './overview-bottom-section';
import type { ImageData } from '../../../../types/rwa/section.types';

interface OverviewSectionProps {
  selectedImageIndex: number;
  setSelectedImageIndex: (index: number) => void;
  mockImages: ImageData[];
}

export default function OverviewSection({
  selectedImageIndex,
  setSelectedImageIndex,
  mockImages,
}: OverviewSectionProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Image Carousel */}
      <ImageCarousel
        selectedImageIndex={selectedImageIndex}
        setSelectedImageIndex={setSelectedImageIndex}
        mockImages={mockImages}
      />

      {/* Bottom Section */}
      <OverviewBottomSection />
    </div>
  );
}
