'use client';

import { motion, AnimatePresence } from 'framer-motion';
import OverviewSection from '@/components/rwa/middle-column/overview/overview-section';
import TokenGraph from '@/components/rwa/middle-column/token-details/token-graph';
// import TokenInformation from '@/components/rwa/middle-column/token-details/token-information';
import TradeHistory from '@/components/rwa/middle-column/token-details/trade-history';
import AssetAboutDetails from '@/components/rwa/middle-column/product/asset-about-details';
import PlaceBidsInterface from '@/components/rwa/middle-column/bids/place-bids-interface';
import RWAForum from '@/components/rwa/middle-column/chat/rwa-forum';
import type {
  MiddleContentAreaProps,
  DatabaseListing,
  NavigationDirection,
} from '../../../types/rwa/section.types';
import { mockImages } from '../../../constants/rwa';
// import SimpleTokenChart from './token-details/simple-token-chart';
import TradingChart from './token-details/trading-chart';

// Extended interface with optional dynamic props
interface DynamicMiddleContentAreaProps extends MiddleContentAreaProps {
  navigationDirection: NavigationDirection;
  // Optional props for dynamic functionality
  listing?: DatabaseListing | null;
  isLive?: boolean;
  loading?: boolean;
  launchDate?: string | null;
  isLaunched?: boolean;
}

const variants = {
  enter: (direction: NavigationDirection) => ({
    y: direction === 'down' ? 50 : -50,
    opacity: 0,
  }),
  center: {
    y: 0,
    opacity: 1,
  },
  exit: (direction: NavigationDirection) => ({
    y: direction === 'down' ? -50 : 50,
    opacity: 0,
  }),
};

export function MiddleContentArea({
  activeSection,
  selectedImageIndex,
  setSelectedImageIndex,
  navigationDirection,
  listing,
  isLive = false,
  loading = false,
  launchDate,
  isLaunched = true,
}: DynamicMiddleContentAreaProps) {
  // Show loading state for dynamic mode
  if (loading && listing === undefined) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[#D0B284] text-lg">Loading...</div>
      </div>
    );
  }

  // Determine if we're in dynamic mode (listing prop provided) or static mode
  const isDynamicMode = listing !== undefined;

  // Determine if the item is actually launched based on launch date
  const actuallyLaunched = isDynamicMode ? isLaunched : true;
  const actuallyPreLaunch = isDynamicMode ? !isLaunched && launchDate : false;

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

  // Get dynamic or static data
  const displayData = {
    title: listing?.title || "King Solomon's Baby",
    symbol: listing?.symbol || 'RWA',
    description: listing?.description || '',
    assetType: listing?.assetType || 'JEWELRY',
    location: listing?.location || null,
    imageUrl:
      listing?.imageGallery?.[0] ||
      'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-XLO1yYFWUAiJQZnkumrWt6GLOfTUV0.jpeg',
  };

  const contentSections = [
    // Overview Content - Always shown
    <OverviewSection
      key="overview-main"
      selectedImageIndex={selectedImageIndex}
      setSelectedImageIndex={setSelectedImageIndex}
      mockImages={displayImages}
      launchDate={launchDate}
    />,

    // Token Details Content - Conditional for dynamic mode
    ...(isDynamicMode && actuallyLaunched && isLive
      ? [
          <div key="token-details-main" className="space-y-0">
            <TradingChart
              tokenAddress={
                listing?.token?.contractAddress || '0xa19763cfd3dcd1f47447954f5576e660f8b6e261'
              }
              tokenSymbol={listing?.token?.symbol || listing?.symbol || 'TLT'}
              title={listing?.token?.name || listing?.title || 'NewTest Launchpad Token'}
            />
            <TradeHistory
              tokenAddress={
                listing?.token?.contractAddress || '0xa19763cfd3dcd1f47447954f5576e660f8b6e261'
              }
              tokenSymbol={listing?.token?.symbol || listing?.symbol || 'TLT'}
            />
          </div>,
        ]
      : isDynamicMode && actuallyPreLaunch
        ? [
            <div
              key="token-details-coming-soon"
              className="h-full flex items-center justify-center"
            >
              <div className="text-center">
                <div className="text-[#D0B284] text-2xl mb-4">Token Details</div>
                <div className="text-gray-400 text-lg">Coming Soon</div>
                <div className="text-gray-500 text-sm mt-2">
                  Token information will be available when {displayData.title} goes live
                  {launchDate && (
                    <div className="mt-2 text-xs">
                      Launch: {new Date(launchDate).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>,
          ]
        : !isDynamicMode
          ? [
              // Static mode - show original token details
              <div key="token-details-main" className="space-y-0">
                <TokenGraph
                  tokenSymbol="RWA"
                  title="King Solomon's Baby"
                  tokenAddress="0x1234...5678"
                  fdv="$100,000"
                  createdAt="1 day ago"
                  height="h-[550px]"
                />
                <TradeHistory
                  tokenAddress="0xa19763cfd3dcd1f47447954f5576e660f8b6e261"
                  tokenSymbol="RWA"
                />
              </div>,
            ]
          : []),

    // Manifesto/About Content - Always shown
    <div key="manifesto-main" className="space-y-0">
      <AssetAboutDetails
        description={displayData.description}
        assetDetails={listing?.assetDetails}
      />
    </div>,

    // Place Bids Content - Conditional for dynamic mode
    ...(isDynamicMode && actuallyLaunched && isLive
      ? [
          <div key="place-bids-main" className="space-y-0">
            <PlaceBidsInterface
              itemTitle={displayData.title}
              itemImage={displayData.imageUrl}
              tokenAddress="0x7300...0219FE"
              retailPrice={47000}
              topOffer={45200}
              onOfferSubmit={(amount, duration) => {
                console.log(`Offer submitted: $${amount} for ${duration} days`);
              }}
              // isLive={isLive}
            />
          </div>,
        ]
      : isDynamicMode && actuallyPreLaunch
        ? [
            <div key="place-bids-coming-soon" className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-[#D0B284] text-2xl mb-4">Place Bids</div>
                <div className="text-gray-400 text-lg">Coming Soon</div>
                <div className="text-gray-500 text-sm mt-2">
                  Bidding will be available when {displayData.title} goes live
                  {launchDate && (
                    <div className="mt-2 text-xs">
                      Launch: {new Date(launchDate).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>,
          ]
        : !isDynamicMode
          ? [
              // Static mode - show original bids interface
              <div key="place-bids-main" className="space-y-0">
                <PlaceBidsInterface
                  itemTitle="King Solomon's Baby"
                  itemImage="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-XLO1yYFWUAiJQZnkumrWt6GLOfTUV0.jpeg"
                  tokenAddress="0x7300...0219FE"
                  retailPrice={47000}
                  topOffer={45200}
                  onOfferSubmit={(amount, duration) => {
                    console.log(`Offer submitted: $${amount} for ${duration} days`);
                  }}
                />
              </div>,
            ]
          : []),

    // Chats Content - Available for both modes
    <div key="chats-main" className="h-full">
      <RWAForum
      // listingId={listing?.id}
      // listingTitle={displayData.title}
      // isLive={isDynamicMode ? isLive : true}
      />
    </div>,
  ];

  return (
    <div className="h-full overflow-y-auto">
      <AnimatePresence mode="wait" custom={navigationDirection}>
        <motion.div
          key={activeSection}
          custom={navigationDirection}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            duration: 1.2,
            ease: 'easeInOut',
          }}
          className="h-full"
        >
          {contentSections[activeSection]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
