'use client';

import Image from 'next/image';
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
import { createImageErrorHandler, getValidImageSrc } from '@/lib/utils/image-error-handler';
import { useTokenMarketCap } from '@/hooks/use-token-market-cap';
import { useTokenMetrics } from '@/hooks/use-token-metrics';

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

  // Fetch token metrics (includes DEX-adjusted 24h volume)
  const {
    metrics: tokenMetrics,
    loading: tokenMetricsLoading,
    circulatingSupply,
  } = useTokenMetrics(listingTokenAddress);

  // Fetch live token price
  const { currentPriceUsd } = useTokenMarketCap(listingTokenAddress, 'usd');

  const liveTokenPrice = useMemo(() => {
    return isFinite(currentPriceUsd) && currentPriceUsd > 0 ? currentPriceUsd : undefined;
  }, [currentPriceUsd]);

  const volume24hAces = useMemo(() => {
    return tokenMetrics?.volume24hAces ?? '0';
  }, [tokenMetrics]);

  const volume24hUsd = useMemo(() => {
    return tokenMetrics?.volume24hUsd;
  }, [tokenMetrics]);

  const liquidityUsd = useMemo(() => {
    return tokenMetrics?.liquidityUsd;
  }, [tokenMetrics]);

  const liquiditySource = useMemo(() => {
    return tokenMetrics?.liquiditySource;
  }, [tokenMetrics]);

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

  const defaultFallbackImage =
    'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-XLO1yYFWUAiJQZnkumrWt6GLOfTUV0.jpeg';

  const primaryFallbackImage = displayImages[0]?.src ?? defaultFallbackImage;

  const buildGalleryImage = (index: number, placeholderText: string) => {
    const imageData = displayImages[index];

    const alt =
      imageData?.alt ||
      (listing?.title
        ? `${listing.title} - Gallery Image ${index + 1}`
        : `Asset Gallery Image ${index + 1}`);

    return {
      src: getValidImageSrc(imageData?.src, primaryFallbackImage, {
        width: 500,
        height: 300,
        text: placeholderText,
      }),
      alt,
    };
  };

  const biddingGalleryImage = buildGalleryImage(1, 'Bidding Image');
  const chatGalleryImage = buildGalleryImage(2, 'Community Image');

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
          dexMeta={listing?.dex || null}
          liveTokenPrice={liveTokenPrice}
          volume24hAces={volume24hAces}
          volume24hUsd={volume24hUsd}
          liquidityUsd={liquidityUsd}
          liquiditySource={liquiditySource}
          metricsLoading={tokenMetricsLoading}
          circulatingSupply={circulatingSupply}
        />
      </div>
    </div>,

    // Product Manifesto - Ensure it fits in smaller space
    <div key="manifesto" className="h-full overflow-hidden">
      <ProductHeroLocation listing={listing} />
    </div>,

    // Place Bids - Compact version
    <div key="place-bids" className="h-full flex flex-col space-y-3 p-4 overflow-hidden bg-black">
      <div className="flex-shrink-0">
        <div className="relative bg-black rounded-lg border border-[#D0B284]/20 overflow-hidden shadow-lg">
          <Image
            src={biddingGalleryImage.src}
            alt={biddingGalleryImage.alt}
            className="w-full h-auto object-cover"
            style={{ aspectRatio: '4/3' }}
            width={500}
            height={300}
            onError={createImageErrorHandler({
              fallbackText: 'Bidding Image',
              width: 500,
              height: 300,
              onError: (src) => {
                console.error('Bidding image failed to load:', src);
              },
              maxRetries: 2,
            })}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      </div>
      {/* Bidding Details */}
      <div className="flex-1 space-y-2 min-h-0 overflow-y-auto">
        <h4 className="text-[#D0B284] text-xs font-bold mb-2 tracking-wider">BIDDING</h4>

        <HighestBidDisplay listingId={listing?.id || ''} />
      </div>
    </div>,

    // Chats - Compact version
    <div key="chats" className="h-full flex flex-col space-y-3 p-4 overflow-hidden bg-black">
      <div className="flex-shrink-0">
        <div className="relative bg-black rounded-lg border border-[#D0B284]/20 overflow-hidden shadow-lg">
          <Image
            src={chatGalleryImage.src}
            alt={chatGalleryImage.alt}
            className="w-full h-auto object-cover"
            style={{ aspectRatio: '4/3' }}
            width={500}
            height={300}
            onError={createImageErrorHandler({
              fallbackText: 'Community Image',
              width: 500,
              height: 300,
              onError: (src) => {
                console.error('Community image failed to load:', src);
              },
              maxRetries: 2,
            })}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      </div>
      {/* Community Stats */}
      <div className="flex-1 space-y-2 min-h-0 overflow-y-auto">
        <h4 className="text-[#D0B284] text-xs font-bold mb-2 tracking-wider">COMMUNITY</h4>

        <div className="bg-black border border-[#D0B284]/20 rounded-lg overflow-hidden">
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
