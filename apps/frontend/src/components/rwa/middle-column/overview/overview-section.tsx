'use client';

import ImageCarousel from './image-carousel';
import OverviewBottomSection from './overview-bottom-section';
import type { ImageData } from '../../../../types/rwa/section.types';

interface OverviewSectionProps {
  selectedImageIndex: number;
  setSelectedImageIndex: (index: number) => void;
  mockImages: ImageData[];
  launchDate?: string | null;
}

export default function OverviewSection({
  selectedImageIndex,
  setSelectedImageIndex,
  mockImages,
  launchDate,
}: OverviewSectionProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Image Carousel */}
      <div className="flex-1">
        <ImageCarousel
          selectedImageIndex={selectedImageIndex}
          setSelectedImageIndex={setSelectedImageIndex}
          mockImages={mockImages}
        />
      </div>

      {/* Bottom Section */}
      <OverviewBottomSection launchDate={launchDate} />
    </div>
  );
}
