'use client';

import { forwardRef } from 'react';
import ImageCarousel from '@/components/rwa/middle-column/overview/image-carousel';
import OverviewBottomSection from '@/components/rwa/middle-column/overview/overview-bottom-section';
import { mockImages } from '@/constants/rwa';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface MobileOverviewSectionProps {
  listing: DatabaseListing;
  loading: boolean;
  launchDate: string | null;
}

const MobileOverviewSection = forwardRef<HTMLDivElement, MobileOverviewSectionProps>(
  ({ listing, loading: _loading, launchDate }, ref) => {
    const displayImages = listing.imageGallery?.length
      ? listing.imageGallery.map((url, index) => ({
          id: index + 1,
          src: url,
          thumbnail: url,
          alt: `${listing.title} - Image ${index + 1}`,
        }))
      : mockImages;

    return (
      <section ref={ref} data-section-id="overview" className="w-full bg-[#151c16] px-4 py-6 space-y-6">
        <div className="h-64 w-full rounded-lg overflow-hidden border border-[#D0B284]/15">
          <ImageCarousel
            selectedImageIndex={0}
            setSelectedImageIndex={() => {}}
            mockImages={displayImages}
            onImageClick={() => {}}
          />
        </div>

        <div className="w-full">
          <OverviewBottomSection
            launchDate={launchDate}
            showProgression={listing.token?.currentPriceACES !== undefined}
            progressionPercentage={26.9}
          />
        </div>
      </section>
    );
  },
);

MobileOverviewSection.displayName = 'MobileOverviewSection';

export default MobileOverviewSection;
