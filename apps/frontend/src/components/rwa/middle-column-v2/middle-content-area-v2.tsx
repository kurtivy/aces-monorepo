'use client';

import { useState, useMemo, useEffect, type Dispatch, type SetStateAction } from 'react';
import { useSearchParams } from 'next/navigation';
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
  onImageSelect?: Dispatch<SetStateAction<number>>;
  onChatClick?: () => void;
}

export function MiddleContentAreaV2({
  listing,
  isLive,
  isLaunched,
  selectedImageIndex,
  onImageSelect,
  onChatClick,
}: MiddleContentAreaV2Props) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [showDetailsOverlay, setShowDetailsOverlay] = useState(false);

  const handleLearnMoreClick = () => {
    setShowDetailsOverlay(true);
  };

  const handleCloseOverlay = () => {
    setShowDetailsOverlay(false);
  };

  // Auto-open auction overlay if coming from image modal
  useEffect(() => {
    const openAuction = searchParams.get('openAuction');
    if (openAuction === 'true') {
      setShowDetailsOverlay(true);
    }
  }, [searchParams]);

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
  const tokenSymbol = listing.token?.symbol || listing.symbol || 'RWA';

  return (
    <div className="relative h-full">
      {/* Main Trading View */}
      <div className="h-full">
        <ChartHeader
          title={listing.title}
          onLearnMoreClick={handleLearnMoreClick}
          onChatClick={onChatClick}
        />

        <TradingSection
          tokenAddress={listing.token?.contractAddress || ''}
          tokenSymbol={tokenSymbol}
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
