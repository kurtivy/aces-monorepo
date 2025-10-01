'use client';

import { forwardRef, useEffect, useMemo, useState } from 'react';
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
    const displayImages = useMemo(
      () =>
        listing.imageGallery?.length
          ? listing.imageGallery.map((url, index) => ({
              id: index + 1,
              src: url,
              thumbnail: url,
              alt: `${listing.title} - Image ${index + 1}`,
            }))
          : mockImages,
      [listing.imageGallery, listing.title],
    );

    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    useEffect(() => {
      setSelectedImageIndex(0);
    }, [displayImages]);

    return (
      <section ref={ref} data-section-id="overview" className="w-full bg-[#151c16] px-4 py-6 space-y-6">
        <div className="h-64 w-full rounded-lg overflow-hidden border border-[#D0B284]/15">
          <ImageCarousel
            selectedImageIndex={selectedImageIndex}
            setSelectedImageIndex={setSelectedImageIndex}
            mockImages={displayImages}
            onImageClick={() => {}}
          />
        </div>

        <div className="w-full">
          <OverviewBottomSection
            launchDate={launchDate}
            showProgression={Boolean(listing.token?.contractAddress)}
            progressionPercentage={26.9}
            tokenAddress={listing.token?.contractAddress}
          />
        </div>
      </section>
    );
  },
);

MobileOverviewSection.displayName = 'MobileOverviewSection';

export default MobileOverviewSection;
