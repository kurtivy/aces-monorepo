'use client';

import { useMemo } from 'react';
import TokenHealthPanel from '@/components/rwa/left-column/token-details/token-health-panel';
import ProductHeroLocation from '@/components/rwa/left-column/product/product-hero-location';
import DynamicImageGallery from './overview/dynamic-image-gallery';
import { HighestBidDisplay } from './bidding/highest-bid-display';
import type { ActiveSectionContentProps, DatabaseListing } from '../../../types/rwa/section.types';
import type { Comment } from '@/types/comments';
import { mockImages } from '../../../constants/rwa';
import BondingCurveChart from './overview/bonding-curve-chart';
import { useTokenHolderCount } from '@/hooks/rwa/use-token-holder-count';
import { NETWORK_CONFIG } from '@/lib/contracts/addresses';

interface DynamicActiveSectionContentProps extends ActiveSectionContentProps {
  listing?: DatabaseListing | null;
  loading?: boolean;
}

const parseCount = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9]/g, '');
    if (!normalized) {
      return null;
    }

    const parsed = Number.parseInt(normalized, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

export function ActiveSectionContent({
  sectionIndex,
  selectedImageIndex,
  setSelectedImageIndex,
  listing,
  loading = false,
}: DynamicActiveSectionContentProps) {
  const listingTokenAddress = listing?.token?.contractAddress;
  const listingTokenChainId = listing?.token?.chainId;

  const directHolderCount = useMemo(() => {
    const directCountRaw = listing?.token?.holderCount ?? listing?.token?.holdersCount;
    return parseCount(directCountRaw);
  }, [listing]);

  const { holderCount: fetchedHolderCount, loading: holderCountLoading } = useTokenHolderCount(
    listingTokenAddress,
    listingTokenChainId,
    directHolderCount,
  );

  const totalComments = useMemo(() => {
    const explicitCount = parseCount(listing?.commentCount);
    if (explicitCount !== null) {
      return explicitCount;
    }

    const countComments = (comments?: Comment[]): number => {
      if (!comments || comments.length === 0) {
        return 0;
      }

      return comments.reduce((total, comment) => {
        return total + 1 + countComments(comment.replies);
      }, 0);
    };

    return listing?.comments ? countComments(listing.comments) : null;
  }, [listing]);

  const totalHolders = useMemo(() => {
    return directHolderCount ?? fetchedHolderCount ?? null;
  }, [directHolderCount, fetchedHolderCount]);

  const formattedCommentCount =
    typeof totalComments === 'number' ? totalComments.toLocaleString() : '--';

  const formattedHolderCount =
    typeof totalHolders === 'number'
      ? totalHolders.toLocaleString()
      : holderCountLoading
        ? 'Loading...'
        : '--';
  // Determine if we're in dynamic mode (listing prop provided) or static mode
  const isDynamicMode = listing !== undefined;

  // For dynamic mode, use database images; for static mode, use mock images
  const displayImages =
    isDynamicMode && listing?.imageGallery
      ? listing.imageGallery.map((url, index) => ({
          id: index + 1,
          src: url,
          thumbnail: url,
          alt: `${listing.title} - Image ${index + 1}`,
        }))
      : mockImages;

  const tokenChainId = listing?.token?.chainId ?? NETWORK_CONFIG.DEFAULT_CHAIN_ID;

  const content = [
    // Overview
    <div key="overview" className="h-full flex flex-col space-y-2 overflow-hidden">
      {/* Bonding Curve Chart */}
      <div className="flex-1 rounded-lg p-3 min-h-0 bg-transparent relative">
        <BondingCurveChart
          tokenAddress={
            listing?.token?.contractAddress || '0xc318d8f3f930e0c5850a1d0a2e095db7077dbace'
          }
        />
      </div>

      {/* Dynamic Image Gallery */}
      <DynamicImageGallery
        images={displayImages}
        selectedImageIndex={selectedImageIndex}
        onImageSelect={setSelectedImageIndex}
        loading={loading}
      />
    </div>,

    // Token Details - Compact version
    <div key="token-details" className="h-full flex flex-col space-y-3 overflow-hidden ">
      <div className="flex-1 min-h-0">
        <TokenHealthPanel
          tokenAddress={listing?.token?.contractAddress}
          reservePrice={listing?.reservePrice}
          chainId={tokenChainId}
        />
      </div>
    </div>,

    // Product Manifesto - Ensure it fits in smaller space
    <div key="manifesto" className="h-full overflow-hidden">
      <ProductHeroLocation listing={listing} />
    </div>,

    // Place Bids - Compact version
    <div
      key="place-bids"
      className="h-full flex flex-col space-y-3 p-4 overflow-hidden bg-[#151c16]"
    >
      {/* Bidding Details */}
      <div className="flex-1 space-y-2 min-h-0 overflow-y-auto">
        <h4 className="text-[#D0B284] text-xs font-bold mb-2 tracking-wider">BIDDING</h4>

        <HighestBidDisplay listingId={listing?.id || ''} />
      </div>
    </div>,

    // Chats - Compact version
    <div key="chats" className="h-full flex flex-col space-y-3 p-4 overflow-hidden bg-[#151c16]">
      {/* Community Stats */}
      <div className="flex-1 space-y-2 min-h-0 overflow-y-auto">
        <h4 className="text-[#D0B284] text-xs font-bold mb-2 tracking-wider">COMMUNITY</h4>

        <div className="bg-[#151c16] border border-[#D0B284]/20 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-3">
            <span className="text-[#DCDDCC] text-xs font-medium">Token Holders:</span>
            <span className="text-white text-xs font-semibold">{formattedHolderCount}</span>
          </div>
        </div>

        <div className="bg-[#231F20]/30 border border-[#D0B284]/20 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-3">
            <span className="text-[#DCDDCC] text-xs font-medium">Total Comments:</span>
            <span className="text-white text-xs font-semibold">{formattedCommentCount}</span>
          </div>
        </div>
      </div>
    </div>,
  ];

  return content[sectionIndex];
}
