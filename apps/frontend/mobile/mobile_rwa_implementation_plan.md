### Step 4: Mobile Navigation Components

#### Mobile Bottom Navigation
**File: `app/rwa/[symbol]/components/mobile/navigation/mobile-bottom-nav.tsx`**

```tsx
'use client';

import { Eye, TrendingUp, MessageSquare, FileText, Gavel } from 'lucide-react';

interface MobileBottomNavProps {
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
}

const navItems = [
  { id: 'overview', icon: Eye, label: 'Overview' },
  { id: 'chart', icon: TrendingUp, label: 'Chart' },
  { id: 'comments', icon: MessageSquare, label: 'Comments' },
  { id: 'details', icon: FileText, label: 'Details' },
  { id: 'bids', icon: Gavel, label: 'Bids' },
];

export default function MobileBottomNav({
  activeSection,
  onSectionChange,
}: MobileBottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#151c16] border-t border-[#D0B284]/20">
      <div className="flex items-center justify-around px-2 py-3 safe-area-pb">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'text-[#D0B284] bg-[#D0B284]/10'
                  : 'text-[#D0B284]/60 hover:text-[#D0B284] hover:bg-[#D0B284]/5'
              }`}
            >
              <Icon className={`h-5 w-5 mb-1 ${isActive ? 'scale-110' : ''}`} />
              <span className="text-xs font-medium truncate max-w-[60px]">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

#### Mobile Floating Trade Button
**File: `app/rwa/[symbol]/components/mobile/navigation/mobile-floating-trade-button.tsx`**

```tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

interface MobileFloatingTradeButtonProps {
  isVisible: boolean;
  tokenSymbol: string;
  onTradeClick: () => void;
}

export default function MobileFloatingTradeButton({
  isVisible,
  tokenSymbol,
  onTradeClick,
}: MobileFloatingTradeButtonProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-30"
        >
          <button
            onClick={onTradeClick}
            className="flex items-center gap-2 px-6 py-3 bg-[#D0B284] hover:bg-[#D0B284]/90 text-[#151c16] font-bold rounded-full shadow-lg transition-all duration-200 active:scale-95"
          >
            <TrendingUp className="h-4 w-4" />
            <span>Trade ${tokenSymbol}</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### Step 5: Mobile Scroll Management Utilities

#### Mobile Scroll Manager Hook
**File: `app/rwa/[symbol]/components/mobile/utils/mobile-scroll-manager.tsx`**

```tsx
'use client';

import { useState, useEffect, useCallback, RefObject } from 'react';

interface SectionRef {
  id: string;
  ref: RefObject<HTMLDivElement>;
}

interface ScrollManagerReturn {
  activeSection: string;
  isTradeButtonVisible: boolean;
  scrollToSection: (sectionId: string) => void;
}

export function useMobileScrollManager(sections: SectionRef[]): ScrollManagerReturn {
  const [activeSection, setActiveSection] = useState('overview');
  const [isTradeButtonVisible, setIsTradeButtonVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Scroll to section function
  const scrollToSection = useCallback((sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (section?.ref.current) {
      const headerHeight = 120; // Combined height of both headers
      const targetY = section.ref.current.offsetTop - headerHeight;
      
      window.scrollTo({
        top: targetY,
        behavior: 'smooth'
      });
    }
  }, [sections]);

  // Intersection Observer for active section detection
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-120px 0px -50% 0px', // Account for header height
      threshold: 0.1,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute('data-section-id');
          if (sectionId) {
            setActiveSection(sectionId);
          }
        }
      });
    }, observerOptions);

    // Observe all sections
    sections.forEach(({ ref }) => {
      if (ref.current) {
        observer.observe(ref.current);
      }
    });

    return () => {
      sections.forEach(({ ref }) => {
        if (ref.current) {
          observer.unobserve(ref.current);
        }
      });
    };
  }, [sections]);

  // Scroll direction detection for trade button visibility
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDirection = currentScrollY > lastScrollY ? 'down' : 'up';
      
      // Hide button when scrolling down, show when scrolling up
      if (scrollDirection === 'down' && currentScrollY > 200) {
        setIsTradeButtonVisible(false);
      } else if (scrollDirection === 'up' || currentScrollY <= 200) {
        setIsTradeButtonVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    const throttledHandleScroll = throttle(handleScroll, 100);
    window.addEventListener('scroll', throttledHandleScroll);
    
    return () => window.removeEventListener('scroll', throttledHandleScroll);
  }, [lastScrollY]);

  return {
    activeSection,
    isTradeButtonVisible,
    scrollToSection,
  };
}

// Throttle utility function
function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
```

#### Mobile Overview Section
**File: `app/rwa/[symbol]/components/mobile/sections/mobile-overview-section.tsx`**

```tsx
'use client';

import { forwardRef } from 'react';
import ImageCarousel from '@/components/rwa/middle-column/overview/image-carousel';
import OverviewBottomSection from '@/components/rwa/middle-column/overview/overview-bottom-section';
import { mockImages } from '@/constants/rwa';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface MobileOverviewSectionProps {
  listing: DatabaseListing;
  loading: boolean;
  launchDate: string | null;
}

const MobileOverviewSection = forwardRef<HTMLDivElement, MobileOverviewSectionProps>(
  ({ listing, loading, launchDate }, ref) => {
    // Use database images or fallback to mock images
    const displayImages = listing?.imageGallery
      ? listing.imageGallery.map((url, index) => ({
          id: index + 1,
          src: url,
          thumbnail: url,
          alt: `${listing.title} - Image ${index + 1}`,
        }))
      : mockImages;

    return (
      <section
        ref={ref}
        data-section-id="overview"
        className="w-full bg-[#151c16] px-4 py-6"
      >
        <div className="space-y-6">
          {/* Image Carousel - Mobile optimized */}
          <div className="h-64 w-full rounded-lg overflow-hidden">
            <ImageCarousel
              selectedImageIndex={0}
              setSelectedImageIndex={() => {}} // Simple version for mobile
              mockImages={displayImages}
              onImageClick={() => {}} // Could add modal later
            />
          </div>

          {/* Overview Bottom Section - Countdown Timer */}
          <div className="w-full">
            <OverviewBottomSection launchDate={launchDate} />
          </div>
        </div>
      </section>
    );
  }
);

MobileOverviewSection.displayName = 'MobileOverviewSection';
export default MobileOverviewSection;
```

#### Mobile Trading Chart Section
**File: `app/rwa/[symbol]/components/mobile/sections/mobile-trading-chart-section.tsx`**

```tsx
'use client';

import { forwardRef } from 'react';
import TradingChart from '@/components/rwa/middle-column/token-details/trading-chart';
import TradeHistory from '@/components/rwa/middle-column/token-details/trade-history';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface MobileTradingChartSectionProps {
  listing: DatabaseListing;
  isLive: boolean;
  isLaunched: boolean;
}

const MobileTradingChartSection = forwardRef<HTMLDivElement, MobileTradingChartSectionProps>(
  ({ listing, isLive, isLaunched }, ref) => {
    // Show placeholder if not live/launched
    if (!isLive || !isLaunched) {
      return (
        <section
          ref={ref}
          data-section-id="chart"
          className="w-full bg-[#151c16] px-4 py-6 border-t border-[#D0B284]/20"
        >
          <div className="text-center py-12">
            <div className="text-[#D0B284] text-xl mb-4">Trading Chart</div>
            <div className="text-gray-400 text-base">Coming Soon</div>
            <div className="text-gray-500 text-sm mt-2">
              Chart will be available when {listing.title} goes live
            </div>
          </div>
        </section>
      );
    }

    return (
      <section
        ref={ref}
        data-section-id="chart"
        className="w-full bg-[#151c16] border-t border-[#D0B284]/20"
      >
        {/* Trading Chart - Mobile height */}
        <div className="h-80">
          <TradingChart
            tokenAddress={listing.token?.contractAddress || ''}
            tokenSymbol={listing.token?.symbol || listing.symbol}
            title={listing.token?.name || listing.title}
            height="h-80"
          />
        </div>

        {/* Trade History - Mobile optimized */}
        <div className="px-4 py-4">
          <TradeHistory
            tokenAddress={listing.token?.contractAddress || ''}
            tokenSymbol={listing.token?.symbol || listing.symbol}
          />
        </div>
      </section>
    );
  }
);

MobileTradingChartSection.displayName = 'MobileTradingChartSection';
export default MobileTradingChartSection;
```

#### Mobile Comments & History Section
**File: `app/rwa/[symbol]/components/mobile/sections/mobile-comments-history-section.tsx`**

```tsx
'use client';

import { forwardRef, useState } from 'react';
import { MessageSquare, BarChart3 } from 'lucide-react';
import RWAForumReal from '@/components/rwa/middle-column/chat/rwa-forum-real';
import TradeHistory from '@/components/rwa/middle-column/token-details/trade-history';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface MobileCommentsHistorySectionProps {
  listing: DatabaseListing;
  isLive: boolean;
}

const MobileCommentsHistorySection = forwardRef<HTMLDivElement, MobileCommentsHistorySectionProps>(
  ({ listing, isLive }, ref) => {
    const [activeTab, setActiveTab] = useState<'comments' | 'history'>('comments');

    return (
      <section
        ref={ref}
        data-section-id="comments"
        className="w-full bg-[#151c16] border-t border-[#D0B284]/20"
      >
        {/* Tab Selector */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex bg-[#1a2318] rounded-lg p-1 border border-[#D0B284]/20">
            <button
              onClick={() => setActiveTab('comments')}
              className={`flex-1 py-3 px-4 rounded-md font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                activeTab === 'comments'
                  ? 'bg-[#184D37] text-white shadow-lg'
                  : 'text-[#D0B284] hover:text-white hover:bg-[#D0B284]/10'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span>Comments</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-3 px-4 rounded-md font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-[#184D37] text-white shadow-lg'
                  : 'text-[#D0B284] hover:text-white hover:bg-[#D0B284]/10'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>History</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-96">
          {activeTab === 'comments' ? (
            <div className="h-96">
              <RWAForumReal
                listingId={listing.id}
                listingTitle={listing.title}
                isLive={isLive}
              />
            </div>
          ) : (
            <div className="px-4 pb-6">
              <TradeHistory
                tokenAddress={listing.token?.contractAddress || ''}
                tokenSymbol={listing.token?.symbol || listing.symbol}
              />
            </div>
          )}
        </div>
      </section>
    );
  }
);

MobileCommentsHistorySection.displayName = 'MobileCommentsHistorySection';
export default MobileCommentsHistorySection;
```

#### Mobile Asset Details Section
**File: `app/rwa/[symbol]/components/mobile/sections/mobile-asset-details-section.tsx`**

```tsx
'use client';

import { forwardRef } from 'react';
import AssetAboutDetails from '@/components/rwa/middle-column/product/asset-about-details';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface MobileAssetDetailsSectionProps {
  listing: DatabaseListing;
}

const MobileAssetDetailsSection = forwardRef<HTMLDivElement, MobileAssetDetailsSectionProps>(
  ({ listing }, ref) => {
    return (
      <section
        ref={ref}
        data-section-id="details"
        className="w-full bg-[#151c16] border-t border-[#D0B284]/20 px-4 py-6"
      >
        <div className="space-y-4">
          <h2 className="text-[#D0B284] text-xl font-bold">Asset Details</h2>
          
          {/* Mobile-optimized Asset Details */}
          <div className="bg-[#151c16] rounded-lg">
            <AssetAboutDetails
              description={listing.description}
              assetDetails={listing.assetDetails}
            />
          </div>
        </div>
      </section>
    );
  }
);

MobileAssetDetailsSection.displayName = 'MobileAssetDetailsSection';
export default MobileAssetDetailsSection;
```

#### Mobile Place Bids Section
**File: `app/rwa/[symbol]/components/mobile/sections/mobile-place-bids-section.tsx`**

```tsx
'use client';

import { forwardRef } from 'react';
import PlaceBidsInterface from '@/components/rwa/middle-column/bids/place-bids-interface';
import { useAuth } from '@/lib/auth/auth-context';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface MobilePlaceBidsSectionProps {
  listing: DatabaseListing;
  isLive: boolean;
  isLaunched: boolean;
}

const MobilePlaceBidsSection = forwardRef<HTMLDivElement, MobilePlaceBidsSectionProps>(
  ({ listing, isLive, isLaunched }, ref) => {
    const { user } = useAuth();

    // Show placeholder if not live/launched
    if (!isLive || !isLaunched) {
      return (
        <section
          ref={ref}
          data-section-id="bids"
          className="w-full bg-[#151c16] border-t border-[#D0B284]/20 px-4 py-6"
        >
          <div className="text-center py-12">
            <div className="text-[#D0B284] text-xl mb-4">Place Bids</div>
            <div className="text-gray-400 text-base">Coming Soon</div>
            <div className="text-gray-500 text-sm mt-2">
              Bidding will be available when {listing.title} goes live
            </div>
          </div>
        </section>
      );
    }

    return (
      <section
        ref={ref}
        data-section-id="bids"
        className="w-full bg-[#151c16] border-t border-[#D0B284]/20 px-4 py-6 pb-36"
      >
        <div className="space-y-4">
          <h2 className="text-[#D0B284] text-xl font-bold">Place Bids</h2>
          
          {/* Mobile-optimized Bidding Interface */}
          <div className="bg-[#151c16] rounded-lg">
            <PlaceBidsInterface
              listingId={listing.id}
              itemTitle={listing.title}
              itemImage={listing.imageGallery?.[0] || ''}
              tokenAddress={listing.token?.contractAddress || listing.symbol}
              retailPrice={
                listing.token?.currentPriceACES
                  ? parseFloat(listing.token.currentPriceACES)
                  : 47000
              }
              startingBidPrice={
                listing.startingBidPrice
                  ? parseFloat(listing.startingBidPrice)
                  : undefined
              }
              isLive={isLive}
              isOwner={user?.id === listing.ownerId}
              onBidPlaced={(bid) => {
                console.log('New bid placed:', bid);
              }}
            />
          </div>
        </div>
      </section>
    );
  }
);

MobilePlaceBidsSection.displayName = 'MobilePlaceBidsSection';
export default MobilePlaceBidsSection;
```

### Step 7: Mobile Trade Drawer
**File: `app/rwa/[symbol]/components/mobile/trade/mobile-trade-drawer.tsx`**

```tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import TokenSwapInterface from '@/components/rwa/token-swap-interface';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface MobileTradeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  listing: DatabaseListing;
}

export default function MobileTradeDrawer({
  isOpen,
  onClose,
  listing,
}: MobileTradeDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 300,
            }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#151c16] rounded-t-xl border-t border-[#D0B284]/20 max-h-[85vh] overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#D0B284]/20">
              <h3 className="text-[#D0B284] text-lg font-bold">
                Trade ${listing.token?.symbol || listing.symbol}
              </h3>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-[#D0B284]/10 transition-colors"
              >
                <X className="h-5 w-5 text-[#D0B284]" />
              </button>
            </div>

            {/* Drawer Content - Scrollable */}
            <div className="overflow-y-auto max-h-[calc(85vh-80px)]">
              {/* Modified TokenSwapInterface without header */}
              <TokenSwapInterface
                tokenSymbol={listing.token?.symbol || listing.symbol}
                tokenPrice={
                  listing.token?.currentPriceACES
                    ? parseFloat(listing.token.currentPriceACES)
                    : 0.000268
                }
                userBalance={1.2547}
                tokenAddress={listing.token?.contractAddress}
                tokenName={listing.token?.name || listing.title}
                primaryImage={listing.imageGallery?.[0]}
                imageGallery={listing.imageGallery}
                currentAmount={0}
                targetAmount={1000000}
                percentage={26.9}
                showFrame={false}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```# Mobile RWA Implementation Plan - Complete Source of Truth

## 1. Component Architecture & File Structure

### Exact File Structure
```
app/rwa/[symbol]/
├── page.tsx (MODIFIED - add responsive detection)
├── mobile-page.tsx (NEW - complete mobile layout)
└── components/
    ├── mobile/
    │   ├── headers/
    │   │   ├── mobile-rwa-header.tsx (NEW)
    │   │   └── mobile-token-header.tsx (NEW)
    │   ├── navigation/
    │   │   ├── mobile-bottom-nav.tsx (NEW)
    │   │   └── mobile-floating-trade-button.tsx (NEW)
    │   ├── sections/
    │   │   ├── mobile-overview-section.tsx (NEW)
    │   │   ├── mobile-trading-chart-section.tsx (NEW)
    │   │   ├── mobile-comments-history-section.tsx (NEW)
    │   │   ├── mobile-asset-details-section.tsx (NEW)
    │   │   └── mobile-place-bids-section.tsx (NEW)
    │   ├── trade/
    │   │   └── mobile-trade-drawer.tsx (NEW)
    │   └── utils/
    │       ├── mobile-scroll-manager.tsx (NEW)
    │       └── mobile-section-observer.tsx (NEW)
```

### Component Dependencies Map
```
MobileRWAItemPage
├── MobileRWAHeader (uses ConnectWalletNav)
├── MobileTokenHeader (extracts from TokenSwapInterface)
├── MobileScrollManager (manages scroll refs & intersection observer)
├── MobileOverviewSection (uses existing ImageCarousel, OverviewBottomSection)
├── MobileTradingChartSection (uses existing TradingChart)
├── MobileCommentsHistorySection (uses existing RWAForumReal, TradeHistory)
├── MobileAssetDetailsSection (uses existing AssetAboutDetails)
├── MobilePlaceBidsSection (uses existing PlaceBidsInterface)
├── MobileFloatingTradeButton (scroll-responsive)
├── MobileBottomNav (section navigation)
└── MobileTradeDrawer (uses modified TokenSwapInterface)
```

## 2. Detailed Implementation Steps with Code Examples

### Step 1: Modify Main Page Component
**File: `app/rwa/[symbol]/page.tsx`**

#### Changes Required:
1. Add mobile detection hook
2. Conditionally render mobile vs desktop layouts  
3. Import new MobileRWAItemPage component

#### Exact Code Changes:
```tsx
// ADD THESE IMPORTS at the top of the file
import { useState, useEffect } from 'react';
import { useDeviceCapabilities } from '@/contexts/device-provider';
import MobileRWAItemPage from './mobile-page';

// ADD THIS INTERFACE at the top of the file  
interface MobileRWAItemPageProps {
  listing: DatabaseListing | null;
  loading: boolean;
  error: string | null;
  isLive: boolean;
  launchDate: string | null;
  isLaunched: boolean;
  symbol: string;
}

// INSIDE RWAItemPage component, ADD THESE HOOKS (after existing hooks)
const [isMobile, setIsMobile] = useState(false);
const { capabilities } = useDeviceCapabilities();

// ADD THIS useEffect (after existing useEffects)
useEffect(() => {
  const checkMobile = () => {
    const windowWidth = window.innerWidth;
    const isMobileWidth = windowWidth < 1024; // lg breakpoint
    
    // Enhanced detection using device capabilities
    const isMobileDevice = capabilities?.touchCapable || false;
    
    // Combine both signals for robust detection
    setIsMobile(isMobileWidth || (isMobileDevice && windowWidth < 1280));
  };

  checkMobile();
  window.addEventListener('resize', checkMobile);
  return () => window.removeEventListener('resize', checkMobile);
}, [capabilities]);

// REPLACE THE ENTIRE RETURN STATEMENT with this:
return (
  <>
    {/* Desktop Layout - hidden on mobile */}
    {!isMobile && (
      <div className="hidden lg:block">
        {/* ALL EXISTING DESKTOP CONTENT GOES HERE - NO CHANGES TO DESKTOP CODE */}
        <div className="relative min-h-screen text-white overflow-hidden flex flex-col">
          <DashedGridBackground className="absolute inset-0 -z-10" bg="#151c16" opacity={0.8} />

          {/* Header */}
          <div className="relative z-50">
            <RWAHeader title={listing?.title} />
          </div>

          {/* Main 3-Column Layout */}
          <div className="flex flex-1 relative z-10 min-h-0">
            {/* Left Column - Navigation System */}
            <div className="w-80 bg-[#151c16] overflow-hidden flex-shrink-0">
              <LeftColumnNavigation
                sections={sections}
                activeSection={navigation.activeSection}
                onSectionChange={navigation.handleSectionChange}
                isAnimating={navigation.isAnimating}
                selectedImageIndex={navigation.selectedImageIndex}
                setSelectedImageIndex={navigation.setSelectedImageIndex}
                previousActiveSection={navigation.previousActiveSection}
                listing={listing}
                loading={loading}
              />
            </div>

            {/* SVG Dashed Border - Between Left and Middle columns */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="8"
              height="100%"
              viewBox="0 0 2 100"
              preserveAspectRatio="none"
              className="pointer-events-none flex-shrink-0 bg-[#151c16]"
              style={{ height: 'calc(100vh - 120px)', minHeight: '750px' }}
            >
              <line
                x1="1"
                y1="0"
                x2="1"
                y2="100"
                stroke="#D0B284"
                strokeOpacity={0.5}
                strokeWidth={1}
                strokeDasharray="12 12"
                vectorEffect="non-scaling-stroke"
                shapeRendering="crispEdges"
              />
            </svg>

            {/* Middle Column - Main Content with Internal Scrolling */}
            <div className="flex-1 relative backdrop-blur-sm bg-[#151c16]">
              <div
                className="h-full overflow-y-auto"
                style={{
                  height: 'calc(100vh - 120px)',
                  minHeight: '750px',
                }}
              >
                <MiddleContentArea
                  activeSection={navigation.activeSection}
                  selectedImageIndex={navigation.selectedImageIndex}
                  setSelectedImageIndex={navigation.setSelectedImageIndex}
                  navigationDirection={navigation.navigationDirection}
                  listing={listing}
                  isLive={forceShowTokenDetails ? true : isLive}
                  launchDate={launchDate}
                  isLaunched={forceShowTokenDetails ? true : isLaunched}
                />
              </div>
            </div>

            {/* SVG Dashed Border - Between Middle and Right columns */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="8"
              height="100%"
              viewBox="0 0 2 100"
              preserveAspectRatio="none"
              className="pointer-events-none flex-shrink-0 bg-[#151c16]"
              style={{ height: 'calc(100vh - 120px)', minHeight: '750px' }}
            >
              <line
                x1="1"
                y1="0"
                x2="1"
                y2="100"
                stroke="#D0B284"
                strokeOpacity={0.5}
                strokeWidth={1}
                strokeDasharray="12 12"
                vectorEffect="non-scaling-stroke"
                shapeRendering="crispEdges"
              />
            </svg>

            {/* Right Column - Token Swap Interface with Progression */}
            <div className="w-96 bg-[#151c16] flex-shrink-0 overflow-hidden backdrop-blur-sm">
              <div
                style={{
                  height: 'calc(100vh - 120px)',
                  minHeight: '750px',
                }}
              >
                <TokenSwapWithProgression
                  tokenSymbol={listing.token?.symbol || listing.symbol}
                  tokenPrice={
                    listing.token?.currentPriceACES
                      ? parseFloat(listing.token.currentPriceACES)
                      : 0.000268
                  }
                  userBalance={1.2547} // TODO: Make dynamic later
                  tokenAddress={listing.token?.contractAddress}
                  tokenName={listing.token?.name || listing.title}
                  primaryImage={listing.imageGallery?.[0]}
                  imageGallery={listing.imageGallery}
                  currentAmount={0} // TODO: Connect to actual bonding curve data
                  targetAmount={1000000} // Example target
                  percentage={26.9} // TODO: Calculate from actual bonding curve progress
                />
              </div>
            </div>
          </div>

          {/* Modals */}
          {navigation.showShareModal && (
            <ShareModal onClose={() => navigation.setShowShareModal(false)} />
          )}
          {navigation.showDeliveryModal && (
            <DeliveryModal onClose={() => navigation.setShowDeliveryModal(false)} />
          )}
        </div>
      </div>
    )}
    
    {/* Mobile Layout - hidden on desktop */}
    {isMobile && (
      <div className="block lg:hidden">
        <MobileRWAItemPage
          listing={listing}
          loading={loading}
          error={error}
          isLive={forceShowTokenDetails ? true : isLive}
          launchDate={launchDate}
          isLaunched={forceShowTokenDetails ? true : isLaunched}
          symbol={symbol}
        />
      </div>
    )}
  </>
);
```

### Step 2: Create Mobile Page Shell
**File: `app/rwa/[symbol]/mobile-page.tsx`** (NEW FILE)

```tsx
'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import MobileRWAHeader from './components/mobile/headers/mobile-rwa-header';
import MobileTokenHeader from './components/mobile/headers/mobile-token-header';
import MobileOverviewSection from './components/mobile/sections/mobile-overview-section';
import MobileTradingChartSection from './components/mobile/sections/mobile-trading-chart-section';
import MobileCommentsHistorySection from './components/mobile/sections/mobile-comments-history-section';
import MobileAssetDetailsSection from './components/mobile/sections/mobile-asset-details-section';
import MobilePlaceBidsSection from './components/mobile/sections/mobile-place-bids-section';
import MobileFloatingTradeButton from './components/mobile/navigation/mobile-floating-trade-button';
import MobileBottomNav from './components/mobile/navigation/mobile-bottom-nav';
import MobileTradeDrawer from './components/mobile/trade/mobile-trade-drawer';
import { useMobileScrollManager } from './components/mobile/utils/mobile-scroll-manager';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface MobileRWAItemPageProps {
  listing: DatabaseListing | null;
  loading: boolean;
  error: string | null;
  isLive: boolean;
  launchDate: string | null;
  isLaunched: boolean;
  symbol: string;
}

export default function MobileRWAItemPage({
  listing,
  loading,
  error,
  isLive,
  launchDate,
  isLaunched,
  symbol,
}: MobileRWAItemPageProps) {
  // Section refs for scroll management
  const overviewRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const commentsRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const bidsRef = useRef<HTMLDivElement>(null);

  // Trade drawer state
  const [isTradeDrawerOpen, setIsTradeDrawerOpen] = useState(false);

  // Mobile scroll management
  const {
    activeSection,
    isTradeButtonVisible,
    scrollToSection,
  } = useMobileScrollManager([
    { id: 'overview', ref: overviewRef },
    { id: 'chart', ref: chartRef },
    { id: 'comments', ref: commentsRef },
    { id: 'details', ref: detailsRef },
    { id: 'bids', ref: bidsRef },
  ]);

  // Error state
  if (error) {
    return (
      <div className="h-screen bg-[#151c16] text-white flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-2">Error Loading Listing</div>
          <div className="text-gray-400">{error}</div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="h-screen bg-[#151c16] text-white flex items-center justify-center">
        <div className="text-[#D0B284] text-lg">Loading {symbol}...</div>
      </div>
    );
  }

  // Not found state
  if (!listing) {
    return (
      <div className="h-screen bg-[#151c16] text-white flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-2">Listing Not Found</div>
          <div className="text-gray-400">The asset "{symbol}" could not be found.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#151c16] text-white overflow-hidden">
      {/* Fixed Headers */}
      <MobileRWAHeader title={listing?.title} />
      <MobileTokenHeader
        listing={listing}
        symbol={symbol}
        isLive={isLive}
        isLaunched={isLaunched}
      />

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-32 scrollbar-hide mobile-optimized">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <MobileOverviewSection
            ref={overviewRef}
            listing={listing}
            loading={loading}
            launchDate={launchDate}
          />
          
          <MobileTradingChartSection
            ref={chartRef}
            listing={listing}
            isLive={isLive}
            isLaunched={isLaunched}
          />
          
          <MobileCommentsHistorySection
            ref={commentsRef}
            listing={listing}
            isLive={isLive}
          />
          
          <MobileAssetDetailsSection
            ref={detailsRef}
            listing={listing}
          />
          
          <MobilePlaceBidsSection
            ref={bidsRef}
            listing={listing}
            isLive={isLive}
            isLaunched={isLaunched}
          />
        </motion.div>
      </div>

      {/* Fixed Bottom Elements */}
      <MobileFloatingTradeButton
        isVisible={isTradeButtonVisible}
        tokenSymbol={listing.token?.symbol || listing.symbol}
        onTradeClick={() => setIsTradeDrawerOpen(true)}
      />
      
      <MobileBottomNav
        activeSection={activeSection}
        onSectionChange={scrollToSection}
      />

      {/* Trade Drawer */}
      <MobileTradeDrawer
        isOpen={isTradeDrawerOpen}
        onClose={() => setIsTradeDrawerOpen(false)}
        listing={listing}
      />
    </div>
  );
}
```

### Step 3: Mobile Header Components

#### Mobile RWA Header
**File: `app/rwa/[symbol]/components/mobile/headers/mobile-rwa-header.tsx`** (NEW FILE)

```tsx
'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ConnectWalletNav from '@/components/ui/custom/connect-wallet-nav';

interface MobileRWAHeaderProps {
  title?: string;
}

export default function MobileRWAHeader({ title }: MobileRWAHeaderProps) {
  const router = useRouter();

  const handleLogoClick = () => {
    router.push('/');
  };

  return (
    <header className="w-full bg-[#151c16] relative z-50 flex-shrink-0">
      <div className="px-4 py-3">
        <div className="grid grid-cols-3 items-center">
          {/* Left - Logo */}
          <div className="flex items-center">
            <button
              onClick={handleLogoClick}
              className="w-8 h-8 flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity duration-200 focus:outline-none cursor-pointer"
              aria-label="Navigate to home page"
            >
              <Image
                src="/aces-logo.png"
                alt="ACES Logo"
                width={32}
                height={32}
                className="w-6 h-6 object-contain"
              />
            </button>
          </div>

          {/* Center - Connect Wallet */}
          <div className="flex justify-center">
            <ConnectWalletNav isMobileHeader={true} />
          </div>

          {/* Right - Navigation Menu (handled by ConnectWalletNav) */}
          <div className="flex justify-end">
            {/* NavMenu is part of ConnectWalletNav */}
          </div>
        </div>
      </div>

      {/* Bottom border */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="8"
        viewBox="0 0 100 2"
        preserveAspectRatio="none"
        className="pointer-events-none absolute left-0 right-0 bottom-0"
      >
        <line
          x1="0"
          y1="1"
          x2="100"
          y2="1"
          stroke="#D7BF75"
          strokeOpacity={0.5}
          strokeWidth={1}
          strokeDasharray="12 12"
          vectorEffect="non-scaling-stroke"
          shapeRendering="crispEdges"
        />
      </svg>
    </header>
  );
}
```

#### Mobile Token Header
**File: `app/rwa/[symbol]/components/mobile/headers/mobile-token-header.tsx`** (NEW FILE)

```tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Copy, Check, Share2 } from 'lucide-react';
import ProgressionBar from '@/components/rwa/middle-column/overview/progression-bar';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface MobileTokenHeaderProps {
  listing: DatabaseListing;
  symbol: string;
  isLive: boolean;
  isLaunched: boolean;
}

export default function MobileTokenHeader({
  listing,
  symbol,
  isLive,
  isLaunched,
}: MobileTokenHeaderProps) {
  const [copied, setCopied] = useState(false);

  const tokenAddress = listing.token?.contractAddress || '';
  
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: listing.title,
          text: `Check out ${listing.title} on ACES.FUN`,
          url: window.location.href,
        });
      } else {
        // Fallback to clipboard
        await copyToClipboard(window.location.href);
      }
    } catch (err) {
      console.error('Failed to share:', err);
    }
  };

  return (
    <div className="w-full bg-[#151c16] border-b border-[#D0B284]/20 flex-shrink-0">
      <div className="px-4 py-4">
        {/* Token Info Row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Token Image */}
            <div className="w-12 h-12 rounded-xl overflow-hidden border border-[#D0B284]/30 flex-shrink-0">
              <Image
                src={
                  listing.imageGallery?.[0] ||
                  '/placeholder.svg?height=48&width=48&text=Token'
                }
                alt={`${symbol} logo`}
                width={48}
                height={48}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder.svg?height=48&width=48&text=Error';
                }}
              />
            </div>
            
            {/* Token Details */}
            <div className="flex-1 min-w-0">
              <h2 className="text-[#D0B284] text-xl font-bold font-mono leading-tight">
                ${symbol}
              </h2>
              <p className="text-white text-sm font-medium truncate">
                {listing.title}
              </p>
            </div>
          </div>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#D0B284]/10 hover:bg-[#D0B284]/20 transition-colors border border-[#D0B284]/20"
          >
            <Share2 className="h-4 w-4 text-[#D0B284]" />
          </button>
        </div>

        {/* Contract Address */}
        {tokenAddress && (
          <div className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 border border-[#D0B284]/20 mb-4">
            <span className="text-xs text-[#D0B284] font-mono flex-1 truncate">
              {tokenAddress}
            </span>
            <button
              onClick={() => copyToClipboard(tokenAddress)}
              className="flex h-6 w-6 items-center justify-center rounded bg-[#D0B284]/10 hover:bg-[#D0B284]/20 transition-colors border border-[#D0B284]/20 flex-shrink-0"
            >
              {copied ? (
                <Check className="h-3 w-3 text-[#D0B284]" />
              ) : (
                <Copy className="h-3 w-3 text-[#D0B284]" />
              )}
            </button>
          </div>
        )}

        {/* Progression Bar - Only if live/launched */}
        {(isLive || isLaunched) && (
          <div className="mb-2">
            <ProgressionBar
              currentAmount={0} // TODO: Connect to bonding curve data
              targetAmount={1000000}
              percentage={26.9} // TODO: Calculate from bonding curve
            />
            <div className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-center text-[#D7BF75]/80">
              Bonded 26.9% / 100%
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 4: Bottom Navigation
**File: `bottom-nav-bar.tsx`**
- Fixed at bottom with 5 navigation icons
- Icons: Eye (Overview), TrendingUp (Chart), MessageSquare (Comments), FileText (Details), Gavel (Bids)
- Active state management
- Smooth scroll to sections

```tsx
const navItems = [
  { id: 'overview', icon: Eye, label: 'Overview', ref: overviewRef },
  { id: 'chart', icon: TrendingUp, label: 'Chart', ref: chartRef },
  { id: 'comments', icon: MessageSquare, label: 'Comments', ref: commentsRef },
  { id: 'details', icon: FileText, label: 'Details', ref: detailsRef },
  { id: 'bids', icon: Gavel, label: 'Bids', ref: bidsRef },
];
```

### Step 5: Floating Trade Button
**File: `floating-trade-button.tsx`**
- Positioned above bottom nav
- Hide/show on scroll with smooth animation
- Opens bottom drawer on click
- Uses Intersection Observer for scroll detection

### Step 6: Mobile Trade Drawer
**File: `mobile-trade-drawer.tsx`**
- Bottom sheet implementation using Framer Motion
- Backdrop that allows content viewing
- Clean trade interface without header
- Drag-to-dismiss functionality

### Step 7: Mobile Sections

#### Mobile Overview
- Hero image carousel (simplified)
- Token info from extracted header
- Bonding curve chart (mobile-optimized)

#### Mobile Trading Chart
- Full-width TradingChart component
- Simplified controls for mobile
- Touch-friendly interactions

#### Mobile Comments & History
- Tab switcher between Comments and Trade History
- Collapsible sections
- Mobile-optimized list layouts

#### Mobile Asset Details
- Simplified version of AssetAboutDetails
- Mobile-friendly typography and spacing

#### Mobile Place Bids
- Streamlined bidding interface
- Mobile-optimized form inputs
- Touch-friendly buttons

## 3. Required Changes to Existing Components

### TokenSwapInterface Modifications
**File: `@/components/rwa/token-swap-interface.tsx`**

**REQUIRED CHANGES:**
1. **Extract Header Logic**: Move token info header to separate component
2. **Add showFrame prop**: Already exists, ensure it works properly for mobile
3. **Mobile optimizations**: Ensure touch-friendly interactions

```tsx
// Add this interface at the top of the file
interface TokenHeaderInfo {
  tokenSymbol: string;
  tokenAddress?: string;
  primaryImage?: string;
  tokenName?: string;
  acesBalance: string;
  tokenBalance: string;
}

// Add this function before the main component
export function extractTokenHeaderInfo(props: TokenSwapInterfaceProps): TokenHeaderInfo {
  return {
    tokenSymbol: props.tokenSymbol || 'RWA',
    tokenAddress: props.tokenAddress,
    primaryImage: props.primaryImage,
    tokenName: props.tokenName,
    // These would need to be passed or calculated
    acesBalance: '0', // This needs to come from state
    tokenBalance: '0', // This needs to come from state
  };
}

// In the TokenSwapInterface component, ensure mobile optimizations:
// 1. Touch-friendly button sizes (min 44px height)
// 2. Proper input behavior on mobile
// 3. Responsive text sizes
```

### ConnectWalletNav Modifications
**File: `@/components/ui/custom/connect-wallet-nav.tsx`**

**REQUIRED CHANGES:**
1. **Mobile Layout Support**: Ensure it works in centered position
2. **Responsive Sizing**: Optimize for mobile header

```tsx
// Add mobile-specific props and styling
interface ConnectWalletNavProps {
  className?: string;
  onProfileClick?: () => void;
  isMobileHeader?: boolean; // NEW PROP
}

export default function ConnectWalletNav({
  className = '',
  isMobileHeader = false, // NEW PROP
}: ConnectWalletNavProps) {
  return (
    <div className={`flex items-center gap-2 relative ${
      isMobileHeader ? 'justify-center' : ''
    } ${className}`}>
      {/* Existing content with mobile optimizations */}
    </div>
  );
}
```

### AssetAboutDetails Modifications
**File: `@/components/rwa/middle-column/product/asset-about-details.tsx`**

**REQUIRED CHANGES:**
1. **Mobile Text Sizing**: Ensure readable text on mobile
2. **Touch-friendly Tabs**: Larger touch targets

```tsx
// Add mobile responsiveness to existing component
// In the tab buttons section:
className={`flex-1 p-4 text-left transition-all duration-300 rounded-tl-lg ${
  activeTab === 'about'
    ? 'bg-[#D0B284]/10 text-white border-b-2 border-[#D0B284]'
    : 'text-[#D0B284]/60 hover:bg-[#D0B284]/5 hover:text-white'
} 
${isMobile ? 'min-h-[48px] text-sm' : ''}`} // ADD MOBILE STYLES
```

### TradingChart Modifications
**File: `@/components/rwa/middle-column/token-details/trading-chart.tsx`**

**REQUIRED CHANGES:**
1. **Mobile Height Props**: Support different heights for mobile
2. **Touch Interactions**: Ensure chart works with touch

```tsx
// The height prop already exists, ensure mobile usage:
// height="h-80" for mobile sections
// Touch interactions should work with existing lightweight-charts setup
```

### RWAForumReal Modifications
**File: `@/components/rwa/middle-column/chat/rwa-forum-real.tsx`**

**REQUIRED CHANGES:**
1. **Mobile Input Sizing**: Larger text areas for mobile
2. **Touch-friendly Buttons**: Ensure proper touch targets

```tsx
// In the comment input section, add mobile responsiveness:
className={`flex-1 bg-[#151c16] border-[#D0B284]/20 text-white placeholder:text-[#DCDDCC] resize-none ${
  isMobile ? 'min-h-[60px] text-base' : 'min-h-[60px] max-h-[200px]'
} overflow-y-auto`}
```

## 4. CSS and Styling Requirements

### Tailwind CSS Additions
**File: `globals.css` or component-specific styles**

```css
/* Add these utility classes for mobile */
.safe-area-pb {
  padding-bottom: env(safe-area-inset-bottom);
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Mobile-specific touch improvements */
.touch-manipulation {
  touch-action: manipulation;
}

/* Ensure proper mobile viewport handling */
@media (max-width: 1023px) {
  .mobile-optimized {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
}
```

### Mobile Breakpoint Strategy
```tsx
// Use these breakpoints consistently:
// Mobile: < 1024px (below lg)
// Desktop: >= 1024px (lg and up)

// Example usage in components:
className="block lg:hidden" // Mobile only
className="hidden lg:block" // Desktop only
className="text-sm lg:text-base" // Responsive text
className="p-4 lg:p-6" // Responsive padding
```

## 5. Data Flow and State Management

### Shared Props Interface
```tsx
// Create shared interface for consistent prop passing
interface SharedListingProps {
  listing: DatabaseListing | null;
  loading: boolean;
  error: string | null;
  isLive: boolean;
  launchDate: string | null;
  isLaunched: boolean;
  symbol: string;
}

// Use this interface across all mobile components
```

### Hook Reusability
```tsx
// Existing hooks that MUST be reused (no changes needed):
- useListingBySymbol()
- useAuth()
- useSectionNavigation() // May need mobile adaptation
- useTradeHistory()
- useLivePrice()

// New mobile-specific hooks:
- useMobileScrollManager() // Already defined above
```

## 6. Performance Considerations

### Lazy Loading Strategy
```tsx
// Implement lazy loading for mobile sections
import { lazy, Suspense } from 'react';

const MobileTradingChartSection = lazy(() => 
  import('./components/mobile/sections/mobile-trading-chart-section')
);

// Use with Suspense boundary
<Suspense fallback={<div>Loading chart...</div>}>
  <MobileTradingChartSection {...props} />
</Suspense>
```

### Mobile Performance Optimizations
```tsx
// Use these patterns for mobile performance:

// 1. Optimize images for mobile
const imageProps = {
  width: isMobile ? 350 : 500,
  height: isMobile ? 250 : 350,
  quality: isMobile ? 75 : 85,
};

// 2. Reduce animation complexity on mobile
const animationProps = isMobile 
  ? { duration: 0.3, ease: 'easeOut' }
  : { duration: 0.6, ease: 'easeInOut' };

// 3. Use intersection observer for section visibility
// (Already implemented in useMobileScrollManager)
```

## 7. Testing and Development Workflow

### Development Checklist
- [ ] Mobile detection working correctly
- [ ] All sections render properly
- [ ] Navigation scrolls to correct sections
- [ ] Trade button hides/shows on scroll
- [ ] Trade drawer opens and functions
- [ ] All existing desktop functionality preserved
- [ ] Touch interactions work properly
- [ ] Performance acceptable on mobile devices
- [ ] Safe area handled correctly (iPhone notch, etc.)

### Testing Strategy
```tsx
// Test on these viewport sizes:
// iPhone SE: 375x667
// iPhone 12: 390x844
// iPhone 12 Pro Max: 428x926
// iPad: 768x1024
// Small Android: 360x640
// Large Android: 412x915

// Use Chrome DevTools device simulation
// Test orientation changes
// Test on actual devices when possible
```

### Component Testing Approach
```tsx
// Test each mobile component in isolation:
// 1. Unit test mobile components
// 2. Integration test mobile page
// 3. E2E test mobile user flows
// 4. Performance test on constrained devices
```

## 8. Deployment and Rollout Plan

### Phase 1: Foundation (Week 1)
- Implement mobile detection in main page
- Create mobile page shell
- Build header components
- Test basic mobile layout

### Phase 2: Navigation (Week 2)  
- Implement bottom navigation
- Add floating trade button
- Create scroll management system
- Test section navigation

### Phase 3: Content (Week 3)
- Build all mobile sections
- Integrate existing components
- Optimize for mobile performance
- Test content display

### Phase 4: Trading (Week 4)
- Implement trade drawer
- Integrate trading functionality
- Final performance optimization
- Comprehensive testing

## 9. Error Handling and Edge Cases

### Mobile-Specific Error Handling
```tsx
// Handle mobile-specific errors:
// 1. Viewport size changes
// 2. Orientation changes  
// 3. Touch interaction failures
// 4. Network connectivity issues
// 5. Performance degradation

// Error boundary for mobile components
class MobileErrorBoundary extends React.Component {
  // Implementation for mobile-specific error recovery
}
```

### Fallback Strategies
```tsx
// If mobile detection fails, provide fallbacks:
// 1. Default to desktop layout
// 2. Provide manual mobile toggle
// 3. Use CSS-only responsive design as backup
```

This comprehensive plan provides everything needed to implement the mobile version while maintaining the existing desktop functionality. Each component has detailed implementation instructions, required changes are clearly marked, and the integration points are well-defined.