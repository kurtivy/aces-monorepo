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

export function MiddleContentArea({
  activeSection,
  selectedImageIndex,
  setSelectedImageIndex,
  isAnimating,
}: MiddleContentAreaProps & { isAnimating: boolean }) {
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
        height="h-[500px]"
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
    <div className={`h-full overflow-y-auto ${activeSection === 0 ? 'p-0' : 'p-8'}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{
            opacity: 0,
            y: 50,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            y: -50,
          }}
          transition={{
            duration: isAnimating ? 1.2 : 0.6,
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
