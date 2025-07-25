'use client';

import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import CountdownTimer from '@/components/new-rwa/countdown-timer';
import ProgressionBar from '@/components/new-rwa/progression-bar';
import TokenGraph from '@/components/new-rwa/token-graph';
import TokenInformation from '@/components/new-rwa/token-information';
import AssetAboutDetails from '@/components/new-rwa/asset-about-details';
import PlaceBidsInterface from '@/components/new-rwa/place-bids-interface';
import RWAForum from '@/components/new-rwa/rwa-forum';
import type { MiddleContentAreaProps } from '../../types/section.types';
import { mockImages } from '../../constants';

export function MiddleContentArea({
  activeSection,
  selectedImageIndex,
  setSelectedImageIndex,
  isAnimating,
}: MiddleContentAreaProps & { isAnimating: boolean }) {
  const handlePrevImage = () => {
    setSelectedImageIndex(
      selectedImageIndex === 0 ? mockImages.length - 1 : selectedImageIndex - 1,
    );
  };

  const handleNextImage = () => {
    setSelectedImageIndex(
      selectedImageIndex === mockImages.length - 1 ? 0 : selectedImageIndex + 1,
    );
  };

  const contentSections = [
    // Overview Content
    <div key="overview-main" className="h-full flex flex-col">
      {/* Image Carousel */}
      <div className="flex-1 relative min-h-[400px]">
        <div className="relative h-full bg-[#231F20] rounded-lg border border-[#D0B284]/20 overflow-hidden">
          {/* Main Image Display */}
          <div className="absolute inset-0 z-0">
            <Image
              src={mockImages[selectedImageIndex].src || '/placeholder.svg'}
              alt={mockImages[selectedImageIndex].alt}
              className="w-full h-full object-cover"
              onError={(e) => {
                console.log('Image failed to load:', mockImages[selectedImageIndex].src);
                e.currentTarget.src = '/placeholder.svg?height=400&width=600&text=Image Error';
              }}
              width={100}
              height={100}
            />
          </div>

          {/* Dark overlay for better button visibility */}
          <div className="absolute inset-0 bg-black/10 z-1"></div>

          {/* Left Navigation Button */}
          <button
            onClick={handlePrevImage}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 text-[#D0B284] p-3 rounded-full border border-[#D0B284]/50 hover:border-[#D0B284] transition-all duration-200 z-10 backdrop-blur-sm"
          >
            <ChevronLeft size={24} />
          </button>

          {/* Right Navigation Button */}
          <button
            onClick={handleNextImage}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 text-[#D0B284] p-3 rounded-full border border-[#D0B284]/50 hover:border-[#D0B284] transition-all duration-200 z-10 backdrop-blur-sm"
          >
            <ChevronRight size={24} />
          </button>

          {/* Image Counter */}
          <div className="absolute bottom-4 right-4 bg-black/70 text-[#D0B284] px-3 py-1 rounded-full text-sm font-mono border border-[#D0B284]/50 z-10 backdrop-blur-sm">
            {selectedImageIndex + 1} / {mockImages.length}
          </div>

          {/* Image Title/Description */}
          <div className="absolute bottom-4 left-4 bg-black/70 text-[#D0B284] px-3 py-1 rounded-full text-sm font-mono border border-[#D0B284]/50 z-10 backdrop-blur-sm">
            {mockImages[selectedImageIndex].alt}
          </div>
        </div>
      </div>

      {/* Bottom Section - Vertical Stack */}
      <div className="flex-shrink-0 mt-6 space-y-4">
        {/* Countdown Timer */}
        <div className="h-32">
          <CountdownTimer />
        </div>

        {/* Progress Bar */}
        <div className="h-20">
          <ProgressionBar />
        </div>

        {/* Buy Presale Button */}
        <button className="w-full bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-bold py-4 px-8 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02]">
          <span
            className="text-xl tracking-wider"
            style={{ fontFamily: "'Spray Letters', cursive" }}
          >
            BUY PRESALE
          </span>
        </button>
      </div>
    </div>,

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
    <div className={`h-full overflow-y-auto ${activeSection === 1 ? 'p-0' : 'p-8'}`}>
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
