'use client';

import DynamicImageGallery from '../left-column/overview/dynamic-image-gallery';
import BondingProgressSection from './bonding-progression-section';
import SwapBox from './swap-box';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface RightPanelProps {
  listing: DatabaseListing;
  selectedImageIndex: number;
  onSelectImage: (index: number) => void;
  loading?: boolean;
}

export default function RightPanel({
  listing,
  selectedImageIndex,
  onSelectImage,
  loading = false,
}: RightPanelProps) {
  const tokenSymbol = listing.token?.symbol || listing.symbol || 'RWA';
  const tokenAddress = listing.token?.contractAddress;
  const tokenName = listing.token?.name || listing.title;
  const chainId = listing.token?.chainId;
  const images = listing.imageGallery ?? [];
  const dexMeta = listing.dex ?? null;

  // Transform image gallery URLs into ImageData format
  const displayImages =
    listing.imageGallery?.map((url, index) => ({
      id: index + 1,
      src: url,
      thumbnail: url,
      alt: `${listing.title || tokenName} - Image ${index + 1}`,
    })) ?? [];

  return (
    <div className="h-full bg-[#151c16] p-4 flex flex-col gap-2">
      {/* Top: Progress */}
      <BondingProgressSection
        tokenAddress={tokenAddress}
        chainId={chainId}
        tokenSymbol={tokenSymbol}
      />

      {/* Image Gallery */}
      <DynamicImageGallery
        images={displayImages}
        selectedImageIndex={selectedImageIndex}
        onImageSelect={onSelectImage}
        loading={loading}
      />

      {/* Bottom: Swap */}
      <div>
        <SwapBox
          tokenSymbol={tokenSymbol}
          tokenAddress={tokenAddress}
          tokenName={tokenName}
          primaryImage={images?.[0] ?? undefined}
          imageGallery={images}
          chainId={chainId}
          dexMeta={dexMeta}
          // Hide internal headers/progression inside the swap component
          showProgression={false}
          showHeader={false}
          showFrame={true}
        />
      </div>
    </div>
  );
}
