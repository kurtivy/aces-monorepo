'use client';

import { motion, AnimatePresence } from 'framer-motion';
import OverviewSection from '@/components/rwa/middle-column/overview/overview-section';
import TokenGraph from '@/components/rwa/middle-column/token-details/token-graph';
import TokenInformation from '@/components/rwa/middle-column/token-details/token-information';
import AssetAboutDetails from '@/components/rwa/middle-column/product/asset-about-details';
import PlaceBidsInterface from '@/components/rwa/middle-column/bids/place-bids-interface';
import RWAForum from '@/components/rwa/middle-column/chat/rwa-forum';
import type { MiddleContentAreaProps } from '../../../types/rwa/section.types';
import { mockImages } from '../../../constants/rwa';

// Import the type from the hook for consistency
export type NavigationDirection = 'up' | 'down';

// 1. Define the variants object OUTSIDE the component.
// The variant functions will receive the `custom` prop as an argument.
const variants = {
  // The state to animate FROM
  enter: (direction: NavigationDirection) => ({
    y: direction === 'down' ? 50 : -50,
    opacity: 0,
  }),
  // The state to animate TO
  center: {
    y: 0,
    opacity: 1,
  },
  // The state to animate TO when exiting
  exit: (direction: NavigationDirection) => ({
    y: direction === 'down' ? -50 : 50, // Note: The exiting component moves in the opposite direction of the enter
    opacity: 0,
  }),
};

export function MiddleContentArea({
  activeSection,
  selectedImageIndex,
  setSelectedImageIndex,
  navigationDirection, // Receive the stable direction from the hook
}: MiddleContentAreaProps & {
  isAnimating: boolean;
  navigationDirection: NavigationDirection;
}) {
  const contentSections = [
    // Overview Content
    <OverviewSection
      key="overview-main"
      selectedImageIndex={selectedImageIndex}
      setSelectedImageIndex={setSelectedImageIndex}
      mockImages={mockImages}
    />,

    // Token Details Content
    <div key="token-details-main" className="space-y-0">
      {/* TradingView Widget */}
      <TokenGraph
        tokenSymbol="RWA"
        title="King Solomon's Baby"
        tokenAddress="0x1234...5678"
        fdv="$100,000"
        createdAt="1 day ago"
        height="h-[550px]"
      />

      {/* Token Information - Single Column Layout */}
      <TokenInformation
        tokenPrice={268.82}
        priceChange={{
          '5m': 0.04,
          '1h': -6.31,
          '6h': -6.26,
          '1d': -5.24,
        }}
        fdv="$100,000"
        holders={372}
        liquidity="$50,000"
        volume={{
          '5m': '$5.19k',
          '1h': '$15.19k',
          '6h': '$25.19k',
          '1d': '$35.19k',
        }}
      />
    </div>,

    // Manifesto Content
    <div key="manifesto-main" className="space-y-0">
      <AssetAboutDetails />
    </div>,

    // Place Bids Content
    <div key="place-bids-main" className="space-y-0">
      <PlaceBidsInterface
        itemTitle="King Solomon's Baby"
        itemImage="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-XLO1yYFWUAiJQZnkumrWt6GLOfTUV0.jpeg"
        tokenAddress="0x7300...0219FE"
        retailPrice={47000}
        topOffer={45200}
        onOfferSubmit={(amount, duration) => {
          console.log(`Offer submitted: $${amount} for ${duration} days`);
          // Handle offer submission logic here
        }}
      />
    </div>,

    // Chats Content
    <div key="chats-main" className="h-full">
      <RWAForum />
    </div>,
  ];

  return (
    <div className="h-full overflow-y-auto">
      {/* mode="wait" is correct, it ensures exit animations finish first */}
      <AnimatePresence mode="wait" custom={navigationDirection}>
        <motion.div
          // The key tells AnimatePresence when a component enters/exits
          key={activeSection}
          // 2. Pass the direction to the `custom` prop. AnimatePresence
          // will pass this to the variants of both the entering and
          // EXITING components.
          custom={navigationDirection}
          // 3. Reference the variants by name.
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          // 4. The transition can be defined once.
          transition={{
            duration: 1.2, // Use a single duration
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
