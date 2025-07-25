'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Chart from '@/components/new-rwa/chart';
import CountdownTimer from '@/components/new-rwa/countdown-timer';
import ProgressionBar from '@/components/new-rwa/progression-bar';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import TokenGraph from '@/components/new-rwa/token-graph';
import TokenInformation from '@/components/new-rwa/token-information';
import SeesawAnimation from '@/components/new-rwa/seesaw-animation';
import ProductHeroLocation from '@/components/new-rwa/product-hero-location';
import PlaceBidsInterface from '@/components/new-rwa/place-bids-interface';
import RWAForum from '@/components/new-rwa/rwa-forum';
import AssetAboutDetails from '@/components/new-rwa/asset-about-details';
import TokenSwapInterface from '@/components/new-rwa/token-swap-interface';
import Image from 'next/image';
import React from 'react'; // Added for React.useEffect

const sections = [
  { id: 'overview', label: 'OVERVIEW' },
  { id: 'token-details', label: 'TOKEN DETAILS' },
  { id: 'manifesto', label: 'PRODUCT MANIFESTO' },
  { id: 'place-bids', label: 'PLACE BIDS' },
  { id: 'chats', label: 'CHATS' },
  { id: 'share', label: 'LINK TO YOUR RICH BUDDY', isModal: true },
  { id: 'delivery', label: 'DELIVERY', isModal: true },
];

// Real images of the pink Porsche 911
const mockImages = [
  {
    id: 1,
    src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-XLO1yYFWUAiJQZnkumrWt6GLOfTUV0.jpeg',
    thumbnail:
      'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-XLO1yYFWUAiJQZnkumrWt6GLOfTUV0.jpeg',
    alt: 'Pink Porsche 911 - Front View',
  },
  {
    id: 2,
    src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/2-iUQKqCppRWbXEhOi7KNUK773Kxn7yf.jpeg',
    thumbnail:
      'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/2-iUQKqCppRWbXEhOi7KNUK773Kxn7yf.jpeg',
    alt: 'Pink Porsche 911 - Rear View',
  },
  {
    id: 3,
    src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/3-kdbtDhEzl6RvGU7XFK0PNjQyp5T0x3.jpeg',
    thumbnail:
      'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/3-kdbtDhEzl6RvGU7XFK0PNjQyp5T0x3.jpeg',
    alt: 'Pink Porsche 911 - Side Profile',
  },
  {
    id: 4,
    src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/4-ESnibTIZQDab4L60RSs93vMxg9rOde.jpeg',
    thumbnail:
      'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/4-ESnibTIZQDab4L60RSs93vMxg9rOde.jpeg',
    alt: 'Pink Porsche 911 - Urban Setting',
  },
];

export default function RWAPage() {
  const [activeSection, setActiveSection] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [previousActiveSection, setPreviousActiveSection] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  const handleSectionChange = (index: number) => {
    const section = sections[index];

    // Handle modal sections differently
    if (section.isModal) {
      if (section.id === 'share') {
        setShowShareModal(true);
      } else if (section.id === 'delivery') {
        setShowDeliveryModal(true);
      }
      return; // Don't change active section for modals
    }

    // Regular navigation logic for content sections
    if (index !== activeSection && !isAnimating) {
      setIsAnimating(true);
      setPreviousActiveSection(activeSection);
      setActiveSection(index);
      // Reset animation state after transition completes
      setTimeout(() => setIsAnimating(false), 1200);
    }
  };

  // Page-level scroll handler for navigation
  const handlePageWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY;

    // Only navigate through content sections (not modal sections)
    const contentSections = sections.filter((section) => !section.isModal);
    const currentContentIndex = contentSections.findIndex(
      (section) => section.id === sections[activeSection].id,
    );

    if (delta > 0 && currentContentIndex < contentSections.length - 1) {
      // Scroll down - go to next content section
      const nextSection = contentSections[currentContentIndex + 1];
      const nextIndex = sections.findIndex((section) => section.id === nextSection.id);
      handleSectionChange(nextIndex);
    } else if (delta < 0 && currentContentIndex > 0) {
      // Scroll up - go to previous content section
      const prevSection = contentSections[currentContentIndex - 1];
      const prevIndex = sections.findIndex((section) => section.id === prevSection.id);
      handleSectionChange(prevIndex);
    }
  };

  return (
    <div
      className="h-screen bg-black text-white overflow-hidden flex flex-col"
      onWheel={handlePageWheel}
    >
      {/* Header Banner */}
      <header className="w-full bg-[#231F20] border-b border-[#D0B284]/20 flex-shrink-0">
        <div className="container mx-auto px-6 py-2">
          <h1 className="text-4xl md:text-6xl font-bold text-[#D0B284] text-center tracking-wide">
            <span style={{ fontFamily: "'Spray Letters', cursive" }}>KING SOLOMON&apos;S BABY</span>
          </h1>
        </div>
      </header>

      {/* Main 3-Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column - Navigation System */}
        <div className="w-80 bg-[#231F20] border-r border-[#D0B284]/20 relative overflow-hidden flex-shrink-0">
          <LeftColumnNavigation
            sections={sections}
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
            isAnimating={isAnimating}
            selectedImageIndex={selectedImageIndex}
            setSelectedImageIndex={setSelectedImageIndex}
            previousActiveSection={previousActiveSection}
          />
        </div>

        {/* Middle Column - Main Content */}
        <div className="flex-1 bg-black relative overflow-hidden">
          <MiddleContentArea
            activeSection={activeSection}
            isAnimating={isAnimating}
            selectedImageIndex={selectedImageIndex}
            setSelectedImageIndex={setSelectedImageIndex}
          />
        </div>

        {/* Right Column - Token Swap Interface */}
        <div className="w-96 bg-[#231F20] border-l border-[#D0B284]/20 flex-shrink-0 overflow-y-auto">
          <TokenSwapInterface tokenSymbol="RWA" tokenPrice={0.000268} userBalance={1.2547} />
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && <ShareModal onClose={() => setShowShareModal(false)} />}

      {/* Delivery Modal */}
      {showDeliveryModal && <DeliveryModal onClose={() => setShowDeliveryModal(false)} />}
    </div>
  );
}

function LeftColumnNavigation({
  sections,
  activeSection,
  onSectionChange,
  isAnimating,
  selectedImageIndex,
  setSelectedImageIndex,
  previousActiveSection,
}: {
  sections: Array<{ id: string; label: string; isModal?: boolean }>;
  activeSection: number;
  onSectionChange: (index: number) => void;
  isAnimating: boolean;
  selectedImageIndex: number;
  setSelectedImageIndex: (index: number) => void;
  previousActiveSection: number | null;
}) {
  const HEADER_HEIGHT = 56; // Reduced from 64 to fit more headers
  const CONTENT_HEIGHT = 320; // Reduced from 400 to make room for all headers

  // Calculate position for each card to create stacking effect
  const getCardPosition = (cardIndex: number) => {
    if (cardIndex === activeSection) {
      // Active card - positioned to show its content after any top stack headers
      const topStackCount = activeSection; // Number of cards above active section
      return topStackCount * HEADER_HEIGHT;
    } else if (cardIndex < activeSection) {
      // Cards above active card - stacked at top in numerical order (headers only)
      return cardIndex * HEADER_HEIGHT;
    } else {
      // Cards below active card - stacked after active card content
      const activeCardBottomPosition =
        activeSection * HEADER_HEIGHT + HEADER_HEIGHT + CONTENT_HEIGHT;
      return activeCardBottomPosition + (cardIndex - activeSection - 1) * HEADER_HEIGHT;
    }
  };

  return (
    <div
      className="h-full relative overflow-hidden"
      style={{
        height: 'calc(100vh - 120px)', // Use available viewport height minus header
        width: '320px',
        minHeight: '750px', // Minimum height to fit all 7 headers + content
      }}
    >
      {sections.map((section, index) => {
        const isActive = index === activeSection;

        // Determine if this card is animating out (going backwards)
        const isReverseAnimation =
          previousActiveSection !== null && previousActiveSection > activeSection;
        const isAnimatingOut = isAnimating && isReverseAnimation && index === previousActiveSection;

        // Show content for active card OR card that's animating out (only for content sections)
        const shouldShowContent = !section.isModal && (isActive || isAnimatingOut);

        return (
          <div
            key={section.id}
            className="absolute w-full"
            style={{
              zIndex: index * 5, // Fixed z-index: 0,5,10,15,20,25,30
              transform: `translateY(${getCardPosition(index)}px)`,
              transition: 'transform 1.2s cubic-bezier(0.23, 1, 0.32, 1)',
              willChange: 'transform',
            }}
          >
            {/* Card Header */}
            <div
              className={cn(
                'h-14 border-b border-[#D0B284]/20 cursor-pointer transition-all duration-300', // h-14 = 56px
                'flex items-center justify-center relative overflow-hidden',
                isActive
                  ? 'bg-[#D0B284] text-black'
                  : 'bg-[#231F20] text-[#D0B284] hover:bg-[#D0B284]/10',
                // Highlight modal sections differently
                section.isModal && 'hover:bg-[#D0B284]/5 border-dashed',
              )}
              onClick={() => onSectionChange(index)}
            >
              <span
                className="font-bold text-xs tracking-wider" // Reduced font size slightly
                style={{ fontFamily: "'Spray Letters', cursive" }}
              >
                {section.label}
              </span>

              {/* Active indicator (only for content sections) */}
              {isActive && !section.isModal && (
                <div className="absolute left-0 top-0 w-1 h-full bg-[#184D37]" />
              )}
            </div>

            {/* Card Content - Show for active content sections OR animating out card */}
            {shouldShowContent && (
              <motion.div
                className="bg-[#231F20] border-b border-[#D0B284]/20 overflow-y-auto"
                style={{
                  height: `${CONTENT_HEIGHT}px`, // Now 320px instead of 400px
                  width: '320px', // Fixed width to match container
                }}
                initial={false}
                animate={{ opacity: isActive ? 1 : 0.7 }}
                transition={{ duration: 0.3 }}
              >
                <ActiveSectionContent
                  sectionIndex={index}
                  selectedImageIndex={selectedImageIndex}
                  setSelectedImageIndex={setSelectedImageIndex}
                />
              </motion.div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ActiveSectionContent({
  sectionIndex,
  selectedImageIndex,
  setSelectedImageIndex,
}: {
  sectionIndex: number;
  selectedImageIndex: number;
  setSelectedImageIndex: (index: number) => void;
}) {
  const content = [
    // Overview
    <div key="overview" className="h-full flex flex-col space-y-3 p-4 overflow-hidden">
      {' '}
      {/* Reduced padding and spacing */}
      {/* Bonding Curve Chart */}
      <div className="flex-1 bg-[#231F20] rounded-lg border border-[#D0B284]/20 p-3 min-h-0">
        {' '}
        {/* Reduced padding */}
        <Chart />
      </div>
      {/* Image Thumbnails */}
      <div className="flex-shrink-0">
        <h4 className="text-[#D0B284] text-xs font-bold mb-2 tracking-wider">GALLERY</h4>{' '}
        {/* Smaller text and margin */}
        <div className="grid grid-cols-4 gap-1.5">
          {' '}
          {/* Reduced gap */}
          {mockImages.map((image, index) => (
            <div
              key={image.id}
              className={cn(
                'aspect-square bg-[#231F20] rounded border transition-all duration-200 overflow-hidden cursor-pointer',
                selectedImageIndex === index
                  ? 'border-[#D0B284] ring-2 ring-[#D0B284]/50'
                  : 'border-[#D0B284]/20 hover:border-[#D0B284]',
              )}
              onClick={() => setSelectedImageIndex(index)}
            >
              {/* Show actual image thumbnails for the first 4, numbers for the rest */}
              {index < 4 ? (
                <Image
                  src={image.thumbnail || '/placeholder.svg'}
                  alt={image.alt}
                  width={100}
                  height={100}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#D0B284] font-bold text-sm">
                  {' '}
                  {/* Smaller text */}
                  {index + 1}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>,

    // Token Details - Compact version
    <div key="token-details" className="h-full flex flex-col space-y-3 p-4 overflow-hidden">
      <div className="flex-1 min-h-0">
        <SeesawAnimation />
      </div>
    </div>,

    // Product Manifesto - Ensure it fits in smaller space
    <div key="manifesto" className="h-full overflow-hidden">
      <ProductHeroLocation />
    </div>,

    // Place Bids - Compact version
    <div key="place-bids" className="h-full flex flex-col space-y-3 p-4 overflow-hidden">
      {/* Product Image - Smaller */}
      <div className="flex-shrink-0">
        <div className="relative bg-[#231F20] rounded-lg border border-[#D0B284]/20 overflow-hidden shadow-lg">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-XLO1yYFWUAiJQZnkumrWt6GLOfTUV0.jpeg"
            alt="King Solomon's Baby - Hero Image"
            className="w-full h-auto object-cover"
            style={{ aspectRatio: '4/3' }}
            width={100}
            height={100}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      </div>

      {/* Bidding Details */}
      <div className="flex-1 space-y-2 min-h-0 overflow-y-auto">
        {' '}
        {/* Reduced spacing */}
        <h4 className="text-[#D0B284] text-xs font-bold mb-2 tracking-wider">BIDDING</h4>{' '}
        {/* Smaller text */}
        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-3">
            {' '}
            {/* Reduced padding */}
            <span className="text-[#DCDDCC] text-xs font-medium">Current High Bid:</span>{' '}
            {/* Smaller text */}
            <span className="text-white text-xs font-semibold">$45,200</span> {/* Smaller text */}
          </div>
        </div>
      </div>
    </div>,

    // Chats - Compact version
    <div key="chats" className="h-full flex flex-col space-y-3 p-4 overflow-hidden">
      {/* Product Image - Smaller */}
      <div className="flex-shrink-0">
        <div className="relative bg-[#231F20] rounded-lg border border-[#D0B284]/20 overflow-hidden shadow-lg">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-XLO1yYFWUAiJQZnkumrWt6GLOfTUV0.jpeg"
            alt="King Solomon's Baby - Hero Image"
            className="w-full h-auto object-cover"
            style={{ aspectRatio: '4/3' }}
            width={100}
            height={100}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      </div>

      {/* Community Stats */}
      <div className="flex-1 space-y-2 min-h-0 overflow-y-auto">
        {' '}
        {/* Reduced spacing */}
        <h4 className="text-[#D0B284] text-xs font-bold mb-2 tracking-wider">COMMUNITY</h4>{' '}
        {/* Smaller text */}
        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-3">
            {' '}
            {/* Reduced padding */}
            <span className="text-[#DCDDCC] text-xs font-medium">Active Members:</span>{' '}
            {/* Smaller text */}
            <span className="text-white text-xs font-semibold">1,247</span> {/* Smaller text */}
          </div>
        </div>
        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-3">
            {' '}
            {/* Reduced padding */}
            <span className="text-[#DCDDCC] text-xs font-medium">Total Comments:</span>{' '}
            {/* Smaller text */}
            <span className="text-white text-xs font-semibold">3,891</span> {/* Smaller text */}
          </div>
        </div>
      </div>
    </div>,
  ];

  return content[sectionIndex];
}

function MiddleContentArea({
  activeSection,
  isAnimating,
  selectedImageIndex,
  setSelectedImageIndex,
}: {
  activeSection: number;
  isAnimating: boolean;
  selectedImageIndex: number;
  setSelectedImageIndex: (index: number) => void;
}) {
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

// Share Modal Component
function ShareModal({ onClose }: { onClose: () => void }) {
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const shareOptions = [
    { name: 'Copy Link', action: () => navigator.clipboard.writeText(shareUrl) },
    {
      name: 'Twitter',
      action: () =>
        window.open(
          `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=Check out King Solomon's Baby - Real World Asset!`,
        ),
    },
    {
      name: 'Facebook',
      action: () =>
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`),
    },
    {
      name: 'LinkedIn',
      action: () =>
        window.open(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
        ),
    },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#231F20] border border-[#D0B284]/20 rounded-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3
            className="text-[#D0B284] text-xl font-bold"
            style={{ fontFamily: "'Spray Letters', cursive" }}
          >
            SHARE WITH YOUR RICH BUDDY
          </h3>
          <button onClick={onClose} className="text-[#D0B284] hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {shareOptions.map((option) => (
            <button
              key={option.name}
              onClick={option.action}
              className="w-full bg-[#D0B284]/10 hover:bg-[#D0B284]/20 text-[#D0B284] border border-[#D0B284]/20 rounded-lg p-3 transition-all duration-200 text-left"
            >
              {option.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Delivery Modal Component
function DeliveryModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#231F20] border border-[#D0B284]/20 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3
            className="text-[#D0B284] text-xl font-bold"
            style={{ fontFamily: "'Spray Letters', cursive" }}
          >
            DELIVERY INFORMATION
          </h3>
          <button onClick={onClose} className="text-[#D0B284] hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <div className="space-y-4 text-[#DCDDCC]">
          <div>
            <h4 className="text-[#D0B284] font-bold mb-2">Digital Asset Delivery</h4>
            <p className="text-sm leading-relaxed">
              Upon successful purchase, your RWA tokens will be instantly delivered to your
              connected wallet. The tokens represent fractional ownership of King Solomon&apos;s
              Baby sculpture.
            </p>
          </div>

          <div>
            <h4 className="text-[#D0B284] font-bold mb-2">Physical Rights</h4>
            <p className="text-sm leading-relaxed">
              Token holders will receive voting rights on the sculpture&apos;s future, including
              decisions about exhibitions, sales, and potential physical division based on the
              original MSCHF concept.
            </p>
          </div>

          <div>
            <h4 className="text-[#D0B284] font-bold mb-2">Timeline</h4>
            <ul className="text-sm space-y-1">
              <li>• Token delivery: Immediate upon purchase</li>
              <li>• Voting period: 30 days after sale completion</li>
              <li>• Physical delivery: If voted, 60-90 days processing</li>
            </ul>
          </div>

          <div className="bg-[#D0B284]/10 border border-[#D0B284]/20 rounded-lg p-4">
            <p className="text-xs text-[#D0B284]">
              <strong>Note:</strong> This is a conceptual RWA implementation. Actual delivery terms
              would be subject to legal agreements and regulatory compliance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
