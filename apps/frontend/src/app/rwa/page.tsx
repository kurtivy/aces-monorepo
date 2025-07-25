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
  // Add some placeholder slots for additional images
  {
    id: 5,
    src: '/placeholder.svg?height=400&width=600&text=Image 5',
    thumbnail: '/placeholder.svg?height=60&width=60&text=5',
    alt: 'Additional Image 5',
  },
  {
    id: 6,
    src: '/placeholder.svg?height=400&width=600&text=Image 6',
    thumbnail: '/placeholder.svg?height=60&width=60&text=6',
    alt: 'Additional Image 6',
  },
  {
    id: 7,
    src: '/placeholder.svg?height=400&width=600&text=Image 7',
    thumbnail: '/placeholder.svg?height=60&width=60&text=7',
    alt: 'Additional Image 7',
  },
  {
    id: 8,
    src: '/placeholder.svg?height=400&width=600&text=Image 8',
    thumbnail: '/placeholder.svg?height=60&width=60&text=8',
    alt: 'Additional Image 8',
  },
];

export default function RWAPage() {
  const [activeSection, setActiveSection] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [animationDirection, setAnimationDirection] = useState<'up' | 'down'>('up');
  const [previousActiveSection, setPreviousActiveSection] = useState<number | null>(null);

  const handleSectionChange = (index: number) => {
    if (index !== activeSection && !isAnimating) {
      setIsAnimating(true);
      setPreviousActiveSection(activeSection);
      setAnimationDirection(index > activeSection ? 'up' : 'down');
      setActiveSection(index);
      setTimeout(() => setIsAnimating(false), 1500); // Increased timeout for longer animation
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header Banner */}
      <header className="w-full bg-[#231F20] border-b border-[#D0B284]/20">
        <div className="container mx-auto px-6 py-2">
          <h1 className="text-4xl md:text-6xl font-bold text-[#D0B284] text-center tracking-wide">
            <span style={{ fontFamily: "'Spray Letters', cursive" }}>KING SOLOMON&apos;S BABY</span>
          </h1>
        </div>
      </header>

      {/* Main 3-Column Layout */}
      <div className="flex min-h-[calc(100vh-200px)]">
        {/* Left Column - Navigation System */}
        <div className="w-80 bg-[#231F20] border-r border-[#D0B284]/20 relative overflow-hidden">
          <LeftColumnNavigation
            sections={sections}
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
            isAnimating={isAnimating}
            animationDirection={animationDirection}
            selectedImageIndex={selectedImageIndex}
            setSelectedImageIndex={setSelectedImageIndex}
            previousActiveSection={previousActiveSection}
          />
        </div>

        {/* Middle Column - Main Content */}
        <div className="flex-1 bg-black relative">
          <MiddleContentArea
            activeSection={activeSection}
            isAnimating={isAnimating}
            animationDirection={animationDirection}
            selectedImageIndex={selectedImageIndex}
            setSelectedImageIndex={setSelectedImageIndex}
          />
        </div>

        {/* Right Column - Token Swap Interface */}
        <div className="w-96 bg-[#231F20] border-l border-[#D0B284]/20">
          <TokenSwapInterface tokenSymbol="RWA" tokenPrice={0.000268} userBalance={1.2547} />
        </div>
      </div>
    </div>
  );
}

function LeftColumnNavigation({
  sections,
  activeSection,
  onSectionChange,
  isAnimating,
  // animationDirection,
  selectedImageIndex,
  setSelectedImageIndex,
  previousActiveSection,
}: {
  sections: Array<{ id: string; label: string }>;
  activeSection: number;
  onSectionChange: (index: number) => void;
  isAnimating: boolean;
  animationDirection: 'up' | 'down';
  selectedImageIndex: number;
  setSelectedImageIndex: (index: number) => void;
  previousActiveSection: number | null;
}) {
  const HEADER_HEIGHT = 64;
  const CONTENT_HEIGHT = 400;
  const CONTAINER_HEIGHT = 800;

  const getCardPosition = (cardIndex: number) => {
    if (cardIndex === activeSection) {
      // Active card - positioned to show its content after any top stack headers
      const topStackCount = activeSection; // Number of cards above active section
      return topStackCount * HEADER_HEIGHT;
    } else if (cardIndex < activeSection) {
      // Cards above active card - stacked at top in numerical order
      return cardIndex * HEADER_HEIGHT;
    } else {
      // Cards below active card - stacked immediately after active card content
      const activeCardBottomPosition =
        activeSection * HEADER_HEIGHT + HEADER_HEIGHT + CONTENT_HEIGHT;
      return activeCardBottomPosition + (cardIndex - activeSection - 1) * HEADER_HEIGHT;
    }
  };

  const getCardZIndex = (cardIndex: number) => {
    // Fixed z-index based on card position - higher card numbers get higher z-index
    // This maintains the physical "stack" order consistently
    return cardIndex * 5; // 0,5,10,15,20
  };

  // Add scroll handler for navigation
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY;

    if (delta > 0 && activeSection < sections.length - 1) {
      // Scroll down - go to next section
      onSectionChange(activeSection + 1);
    } else if (delta < 0 && activeSection > 0) {
      // Scroll up - go to previous section
      onSectionChange(activeSection - 1);
    }
  };

  return (
    <div
      className="h-full relative overflow-hidden"
      style={{ height: `${CONTAINER_HEIGHT}px` }}
      onWheel={handleWheel}
    >
      {sections.map((section, index) => {
        const isActive = index === activeSection;

        // Determine if this card is moving in a reverse animation (backwards navigation)
        const isReverseAnimation =
          previousActiveSection !== null && previousActiveSection > activeSection;

        // Calculate animation delay for two-phase animation
        let animationDelay = 0;
        if (isReverseAnimation) {
          // When going backwards, outgoing cards animate first (no delay)
          // Incoming card (new active) animates second (with delay)
          if (index === activeSection) {
            animationDelay = 0.5; // Incoming card waits for outgoing card
          } else if (index > activeSection) {
            animationDelay = 0; // Outgoing cards go first
          }
        }

        // Determine if content should be visible
        // Show content for: active card OR card that's animating out in reverse animation
        const shouldShowContent =
          isActive || (isReverseAnimation && isAnimating && index === previousActiveSection);

        return (
          <motion.div
            key={section.id}
            className="absolute w-full"
            style={{
              zIndex: getCardZIndex(index),
            }}
            animate={{
              y: getCardPosition(index),
            }}
            transition={{
              duration: 1.0, // Increased to 1 second
              ease: [0.23, 1, 0.32, 1],
              delay: animationDelay,
            }}
          >
            {/* Card Header */}
            <div
              className={cn(
                'h-16 border-b border-[#D0B284]/20 cursor-pointer transition-all duration-300',
                'flex items-center justify-center relative overflow-hidden',
                isActive
                  ? 'bg-[#D0B284] text-black'
                  : 'bg-[#231F20] text-[#D0B284] hover:bg-[#D0B284]/10',
              )}
              onClick={() => onSectionChange(index)}
            >
              <span
                className="font-bold text-sm tracking-wider"
                style={{ fontFamily: "'Spray Letters', cursive" }}
              >
                {section.label}
              </span>

              {/* Active indicator */}
              {isActive && <div className="absolute left-0 top-0 w-1 h-full bg-[#184D37]" />}
            </div>

            {/* Card Content - Show for active card OR animating out card */}
            {shouldShowContent && (
              <div
                className="bg-[#231F20] border-b border-[#D0B284]/20 overflow-y-auto"
                style={{ height: `${CONTENT_HEIGHT}px` }}
              >
                <ActiveSectionContent
                  sectionIndex={index}
                  selectedImageIndex={selectedImageIndex}
                  setSelectedImageIndex={setSelectedImageIndex}
                />
              </div>
            )}
          </motion.div>
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
    <div key="overview" className="h-full flex flex-col space-y-4 p-6">
      {/* Bonding Curve Chart */}
      <div className="flex-1 bg-[#231F20] rounded-lg border border-[#D0B284]/20 p-4">
        <Chart />
      </div>

      {/* Image Thumbnails */}
      <div className="flex-shrink-0">
        <h4 className="text-[#D0B284] text-sm font-bold mb-3 tracking-wider">GALLERY</h4>
        <div className="grid grid-cols-4 gap-2">
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
                <div className="w-full h-full flex items-center justify-center text-[#D0B284] font-bold text-lg">
                  {index + 1}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>,

    // Token Details
    <div key="token-details" className="space-y-4 p-6">
      <SeesawAnimation />
    </div>,

    // Product Manifesto
    <div key="manifesto" className="h-full">
      <ProductHeroLocation />
    </div>,

    // Place Bids
    <div key="place-bids" className="h-full flex flex-col space-y-4 p-6">
      {/* Product Image - Same as manifesto */}
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
      <div className="flex-1 space-y-3">
        <h4 className="text-[#D0B284] text-sm font-bold mb-4 tracking-wider">BIDDING</h4>

        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <span className="text-[#DCDDCC] text-sm font-medium">Current High Bid:</span>
            <span className="text-white text-sm font-semibold">$45,200</span>
          </div>
        </div>
      </div>
    </div>,

    // Chats
    <div key="chats" className="h-full flex flex-col space-y-4 p-6">
      {/* Product Image - Same as other sections */}
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
      <div className="flex-1 space-y-3">
        <h4 className="text-[#D0B284] text-sm font-bold mb-4 tracking-wider">COMMUNITY</h4>

        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <span className="text-[#DCDDCC] text-sm font-medium">Active Members:</span>
            <span className="text-white text-sm font-semibold">1,247</span>
          </div>
        </div>

        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <span className="text-[#DCDDCC] text-sm font-medium">Total Comments:</span>
            <span className="text-white text-sm font-semibold">3,891</span>
          </div>
        </div>
      </div>
    </div>,
  ];

  return content[sectionIndex];
}

function MiddleContentArea({
  activeSection,
  //   isAnimating,
  animationDirection,
  selectedImageIndex,
  setSelectedImageIndex,
}: {
  activeSection: number;
  isAnimating: boolean;
  animationDirection: 'up' | 'down';
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
            y: animationDirection === 'up' ? 50 : -50,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            y: animationDirection === 'up' ? -50 : 50,
          }}
          transition={{
            duration: 1,
            ease: 'easeInOut',
          }}
        >
          {contentSections[activeSection]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
