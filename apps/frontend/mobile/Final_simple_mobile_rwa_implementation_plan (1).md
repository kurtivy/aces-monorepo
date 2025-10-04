# Simplified Mobile RWA Implementation Plan

## Overview
Keep your existing `page.tsx` architecture intact. Add mobile detection and conditionally render a mobile layout alongside your working desktop layout. No data flow changes, no architectural restructuring.

## Prerequisites (Simple Additions)

### 1. Add Mobile CSS Utilities
**File: `app/globals.css`** - Add these utilities at the end:

```css
/* Mobile utility classes */
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
```

### 2. Create Mobile Constants
**File: `app/rwa/[symbol]/mobile-constants.ts`** (NEW FILE)

```tsx
export const MOBILE_CONSTANTS = {
  HEADER_HEIGHT: 120,
  BREAKPOINT: 1024,
  SCROLL_THROTTLE: 100,
} as const;
```

## Implementation Steps

### Step 1: Minimal Changes to Existing Page
**File: `app/rwa/[symbol]/page.tsx`** - Add ONLY these lines:

```tsx
// ADD these imports at the top (keep all existing imports)
import { useState, useEffect } from 'react';
import MobileRWAItemPage from './mobile-page';

// ADD this inside your RWAItemPage component (after your existing hooks)
const [isMobile, setIsMobile] = useState(false);

// ADD this useEffect (after your existing useEffects)
useEffect(() => {
  const checkMobile = () => setIsMobile(window.innerWidth < 1024);
  checkMobile();
  window.addEventListener('resize', checkMobile);
  return () => window.removeEventListener('resize', checkMobile);
}, []);

// MODIFY your return statement to wrap existing content:
return (
  <>
    {/* Your entire existing desktop layout - NO CHANGES */}
    {!isMobile && (
      <div className="hidden lg:block">
        {/* Move your ENTIRE existing return content here - exactly as is */}
        <div className="relative min-h-screen text-white overflow-hidden flex flex-col">
          <DashedGridBackground className="absolute inset-0 -z-10" bg="#151c16" opacity={0.8} />
          
          {/* Header */}
          <div className="relative z-50">
            <RWAHeader title={listing?.title} />
          </div>

          {/* Main 3-Column Layout */}
          <div className="flex flex-1 relative z-10 min-h-0">
            {/* All your existing layout code - unchanged */}
            {/* ... rest of your existing desktop layout ... */}
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
    
    {/* Mobile Layout - completely separate */}
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

### Step 2: Create Simple Mobile Page
**File: `app/rwa/[symbol]/mobile-page.tsx`** (NEW FILE)

```tsx
'use client';

import { useRef, useState } from 'react';
import MobileBottomNav from './components/mobile-bottom-nav';
import MobileTradeButton from './components/mobile-trade-button';
import MobileTradeDrawer from './components/mobile-trade-drawer';
import { useMobileScroll } from './hooks/use-mobile-scroll';
import type { DatabaseListing } from '@/types/rwa/section.types';

// Import your existing components - no changes needed to them
import RWAHeader from '@/components/rwa/rwa-header';
import ImageCarousel from '@/components/rwa/middle-column/overview/image-carousel';
import TradingChart from '@/components/rwa/middle-column/token-details/trading-chart';
import RWAForumReal from '@/components/rwa/middle-column/chat/rwa-forum-real';
import AssetAboutDetails from '@/components/rwa/middle-column/product/asset-about-details';
import PlaceBidsInterface from '@/components/rwa/middle-column/bids/place-bids-interface';
import { mockImages } from '@/constants/rwa';

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
  // Section refs
  const overviewRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const commentsRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const bidsRef = useRef<HTMLDivElement>(null);

  const [isTradeDrawerOpen, setIsTradeDrawerOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Simple scroll management
  const { activeSection, isTradeButtonVisible, scrollToSection } = useMobileScroll([
    { id: 'overview', ref: overviewRef },
    { id: 'chart', ref: chartRef },
    { id: 'comments', ref: commentsRef },
    { id: 'details', ref: detailsRef },
    { id: 'bids', ref: bidsRef },
  ]);

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

  if (loading || !listing) {
    return (
      <div className="h-screen bg-[#151c16] text-white flex items-center justify-center">
        <div className="text-[#D0B284] text-lg">Loading {symbol}...</div>
      </div>
    );
  }

  const displayImages = listing?.imageGallery
    ? listing.imageGallery.map((url, index) => ({
        id: index + 1,
        src: url,
        thumbnail: url,
        alt: `${listing.title} - Image ${index + 1}`,
      }))
    : mockImages;

  return (
    <div className="flex flex-col h-screen bg-[#151c16] text-white overflow-hidden">
      {/* Simple mobile header */}
      <div className="flex-shrink-0">
        <RWAHeader title={listing.title} />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-32 scrollbar-hide">
        {/* Overview Section */}
        <section ref={overviewRef} data-section-id="overview" className="px-4 py-6">
          <div className="mb-4">
            <h2 className="text-[#D0B284] text-xl font-bold mb-2">${symbol}</h2>
            <p className="text-white text-sm">{listing.title}</p>
          </div>
          <div className="h-64 mb-6">
            <ImageCarousel
              selectedImageIndex={selectedImageIndex}
              setSelectedImageIndex={setSelectedImageIndex}
              mockImages={displayImages}
              onImageClick={() => {}}
            />
          </div>
        </section>

        {/* Chart Section */}
        <section ref={chartRef} data-section-id="chart" className="border-t border-[#D0B284]/20">
          {isLive && isLaunched ? (
            <div className="h-80">
              <TradingChart
                tokenAddress={listing.token?.contractAddress || ''}
                tokenSymbol={listing.token?.symbol || listing.symbol}
                title={listing.token?.name || listing.title}
                height="h-80"
              />
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center">
              <div className="text-center">
                <div className="text-[#D0B284] text-xl mb-2">Trading Chart</div>
                <div className="text-gray-400">Coming Soon</div>
              </div>
            </div>
          )}
        </section>

        {/* Comments Section */}
        <section ref={commentsRef} data-section-id="comments" className="border-t border-[#D0B284]/20">
          <div className="h-96">
            <RWAForumReal
              listingId={listing.id}
              listingTitle={listing.title}
              isLive={isLive}
            />
          </div>
        </section>

        {/* Details Section */}
        <section ref={detailsRef} data-section-id="details" className="border-t border-[#D0B284]/20 px-4 py-6">
          <h2 className="text-[#D0B284] text-xl font-bold mb-4">Asset Details</h2>
          <AssetAboutDetails
            description={listing.description}
            assetDetails={listing.assetDetails}
          />
        </section>

        {/* Bids Section */}
        <section ref={bidsRef} data-section-id="bids" className="border-t border-[#D0B284]/20 px-4 py-6 pb-36">
          {isLive && isLaunched ? (
            <>
              <h2 className="text-[#D0B284] text-xl font-bold mb-4">Place Bids</h2>
              <PlaceBidsInterface
                listingId={listing.id}
                itemTitle={listing.title}
                itemImage={listing.imageGallery?.[0] || ''}
                tokenAddress={listing.token?.contractAddress || listing.symbol}
                retailPrice={listing.token?.currentPriceACES ? parseFloat(listing.token.currentPriceACES) : 47000}
                startingBidPrice={listing.startingBidPrice ? parseFloat(listing.startingBidPrice) : undefined}
                isLive={isLive}
                isOwner={false}
                onBidPlaced={(bid) => console.log('New bid placed:', bid)}
              />
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-[#D0B284] text-xl mb-2">Place Bids</div>
              <div className="text-gray-400">Coming Soon</div>
            </div>
          )}
        </section>
      </div>

      {/* Fixed bottom elements */}
      <MobileTradeButton
        isVisible={isTradeButtonVisible}
        tokenSymbol={listing.token?.symbol || listing.symbol}
        onTradeClick={() => setIsTradeDrawerOpen(true)}
      />
      
      <MobileBottomNav
        activeSection={activeSection}
        onSectionChange={scrollToSection}
      />

      <MobileTradeDrawer
        isOpen={isTradeDrawerOpen}
        onClose={() => setIsTradeDrawerOpen(false)}
        listing={listing}
      />
    </div>
  );
}
```

### Step 3: Simple Mobile Components

**File: `app/rwa/[symbol]/hooks/use-mobile-scroll.ts`** (NEW FILE)

```tsx
'use client';

import { useState, useEffect, useCallback, RefObject, useRef } from 'react';
import { MOBILE_CONSTANTS } from '../mobile-constants';

interface SectionRef {
  id: string;
  ref: RefObject<HTMLDivElement>;
}

export function useMobileScroll(sections: SectionRef[]) {
  const [activeSection, setActiveSection] = useState('overview');
  const [isTradeButtonVisible, setIsTradeButtonVisible] = useState(true);
  const lastScrollY = useRef(0);

  const scrollToSection = useCallback((sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (section?.ref.current) {
      const targetY = section.ref.current.offsetTop - MOBILE_CONSTANTS.HEADER_HEIGHT;
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    }
  }, [sections]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute('data-section-id');
            if (sectionId) setActiveSection(sectionId);
          }
        });
      },
      { rootMargin: '-120px 0px -50% 0px', threshold: 0.1 }
    );

    sections.forEach(({ ref }) => {
      if (ref.current) observer.observe(ref.current);
    });

    return () => observer.disconnect();
  }, [sections]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsTradeButtonVisible(currentScrollY <= lastScrollY.current || currentScrollY <= 200);
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return { activeSection, isTradeButtonVisible, scrollToSection };
}
```

**File: `app/rwa/[symbol]/components/mobile-bottom-nav.tsx`** (NEW FILE)

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

export default function MobileBottomNav({ activeSection, onSectionChange }: MobileBottomNavProps) {
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
              className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 min-h-[44px] ${
                isActive ? 'text-[#D0B284] bg-[#D0B284]/10' : 'text-[#D0B284]/60 hover:text-[#D0B284]'
              }`}
            >
              <Icon className={`h-5 w-5 mb-1 ${isActive ? 'scale-110' : ''}`} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

**File: `app/rwa/[symbol]/components/mobile-trade-button.tsx`** (NEW FILE)

```tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

interface MobileTradeButtonProps {
  isVisible: boolean;
  tokenSymbol: string;
  onTradeClick: () => void;
}

export default function MobileTradeButton({ isVisible, tokenSymbol, onTradeClick }: MobileTradeButtonProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-30"
        >
          <button
            onClick={onTradeClick}
            className="flex items-center gap-2 px-6 py-3 bg-[#D0B284] hover:bg-[#D0B284]/90 text-[#151c16] font-bold rounded-full shadow-lg"
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

**File: `app/rwa/[symbol]/components/mobile-trade-drawer.tsx`** (NEW FILE)

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

export default function MobileTradeDrawer({ isOpen, onClose, listing }: MobileTradeDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#151c16] rounded-t-xl border-t border-[#D0B284]/20 max-h-[85vh] overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-[#D0B284]/20">
              <h3 className="text-[#D0B284] text-lg font-bold">
                Trade ${listing.token?.symbol || listing.symbol}
              </h3>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#D0B284]/10">
                <X className="h-5 w-5 text-[#D0B284]" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(85vh-80px)] scrollbar-hide">
              <TokenSwapInterface
                tokenSymbol={listing.token?.symbol || listing.symbol}
                tokenPrice={listing.token?.currentPriceACES ? parseFloat(listing.token.currentPriceACES) : 0.000268}
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
```

## What This Approach Does

**Keeps Safe:**
- Your existing desktop layout is completely untouched
- All your existing hooks, data flow, and logic remain identical
- No architectural changes to server/client boundaries
- Same data flows to both desktop and mobile

**Adds Simply:**
- Mobile detection with simple `useState`
- Conditional rendering based on screen width
- Reuses all your existing components (ImageCarousel, TradingChart, etc.)
- Clean mobile layout without duplicating business logic

**Risk Level: Very Low**
- Desktop functionality cannot be affected
- Mobile is additive only
- No complex prop drilling or data restructuring
- Simple, predictable component structure

This is much safer and simpler than the previous approach while achieving the same mobile functionality.