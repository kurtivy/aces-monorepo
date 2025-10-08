'use client';

import { useState, useMemo } from 'react';
import { ChartHeader } from './chart-header';
import { TradingSection } from './trading-section';
import { DetailsOverlay } from './details-overlay';
import { DatabaseListing } from '@/types/rwa/section.types';
import { useAuth } from '@/lib/auth/auth-context';

interface ImageData {
  id: number;
  src: string;
  thumbnail?: string;
  alt: string;
}

interface MiddleContentAreaV2Props {
  listing: DatabaseListing;
  isLive: boolean;
  isLaunched: boolean;
  selectedImageIndex?: number;
  onImageSelect?: (index: number) => void;
}

export function MiddleContentAreaV2({
  listing,
  isLive,
  isLaunched,
  selectedImageIndex,
  onImageSelect,
}: MiddleContentAreaV2Props) {
  const { user } = useAuth();
  const [showDetailsOverlay, setShowDetailsOverlay] = useState(false);

  const handleLearnMoreClick = () => {
    setShowDetailsOverlay(true);
  };

  const handleCloseOverlay = () => {
    setShowDetailsOverlay(false);
  };

  // Convert image gallery to ImageData format
  const images: ImageData[] = useMemo(() => {
    if (!listing.imageGallery || listing.imageGallery.length === 0) {
      return [];
    }
    return listing.imageGallery.map((url, index) => ({
      id: index,
      src: url,
      thumbnail: url,
      alt: `${listing.title} - Image ${index + 1}`,
    }));
  }, [listing.imageGallery, listing.title]);

  const isOwner = user?.id === listing.ownerId;

  return (
    <div className="relative h-full">
      {/* Main Trading View - Scrollable */}
      <div className="h-full overflow-y-auto">
        {/* Chart Header - Now scrolls with content */}
        <ChartHeader title={listing.title} onLearnMoreClick={handleLearnMoreClick} />

        {/* Trading Section */}
        <TradingSection
          tokenAddress={listing.token?.contractAddress || ''}
          tokenSymbol={listing.symbol}
          title={listing.title}
          chainId={listing.token?.chainId}
          dexMeta={listing.dex}
          images={images}
          selectedImageIndex={selectedImageIndex}
          onImageSelect={onImageSelect}
        />
      </div>

      {/* Details Overlay */}
      <DetailsOverlay
        isOpen={showDetailsOverlay}
        onClose={handleCloseOverlay}
        listing={listing}
        isLive={isLive}
        isOwner={isOwner}
      />
    </div>
  );
}
