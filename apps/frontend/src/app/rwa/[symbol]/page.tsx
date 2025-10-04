// app/rwa/[symbol]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import TokenSwapWithProgression from '@/components/rwa/token-swap-with-progression';
import { LeftColumnNavigation } from '../../../components/rwa/left-column/left-column-navigation';
import { MiddleContentArea } from '../../../components/rwa/middle-column/middle-content-area';
import { ShareModal, DeliveryModal } from '../../../components/rwa/modals';
import { useSectionNavigation } from '@/hooks/rwa/use-section-navigation';
import { useListingBySymbol } from '@/hooks/rwa/use-listing-by-symbol';
import { sections } from '@/constants/rwa';
import RWAHeader from '@/components/rwa/rwa-header';
import DashedGridBackground from '@/components/ui/custom/dashed-grid-background';
import { useDeviceCapabilities } from '@/contexts/device-provider';
import MobileRWAItemPage from './mobile-page';
import PageLoader from '@/components/loading/page-loader';
import { NETWORK_CONFIG } from '@/lib/contracts/addresses';

export default function RWAItemPage() {
  const params = useParams();
  const symbol = params.symbol as string;

  const tokenDetailsSectionIndex = sections.findIndex(
    (section) => section.id === 'token-details' && !section.isModal,
  );
  const initialSectionIndex = tokenDetailsSectionIndex >= 0 ? tokenDetailsSectionIndex : 0;

  const navigation = useSectionNavigation(sections, initialSectionIndex);
  const { listing, loading, error, isLive, launchDate, isLaunched } = useListingBySymbol(symbol);
  const { capabilities } = useDeviceCapabilities();

  const MOBILE_BREAKPOINT = 768;

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  // TEMPORARY: Force show token details for testing the new graph
  const forceShowTokenDetails = true;

  useEffect(() => {
    const checkMobile = () => {
      const windowWidth = window.innerWidth;
      const isMobileWidth = windowWidth < MOBILE_BREAKPOINT;
      const isMobileDevice = capabilities?.touchCapable || false;

      setIsMobile(isMobileWidth || (isMobileDevice && windowWidth < MOBILE_BREAKPOINT));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [capabilities]);

  // Error state
  if (error) {
    return (
      <div className="h-screen bg-[#151c16] text-white flex items-center justify-center">
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
      <div className="h-screen bg-[#151c16]">
        <PageLoader />
      </div>
    );
  }

  // Not found state
  if (!listing) {
    return (
      <div className="h-screen bg-[#151c16] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-2">Listing Not Found</div>
          <div className="text-gray-400">The asset &quot;{symbol}&quot; could not be found.</div>
        </div>
      </div>
    );
  }

  const tokenChainId = listing.token?.chainId ?? NETWORK_CONFIG.DEFAULT_CHAIN_ID;

  return (
    <>
      {!isMobile && (
        <div className="hidden md:block">
          <div className="relative min-h-screen text-white overflow-hidden flex flex-col">
            <DashedGridBackground className="absolute inset-0 -z-10" bg="#151c16" opacity={0.8} />

            {/* Header */}
            <div className="relative z-50">
              <RWAHeader title={listing?.title} />
            </div>

            {/* Main 3-Column Layout */}
            <div className="flex flex-1 relative z-10 min-h-0">
              {/* Left Column - Navigation System */}
              <div className="w-72 bg-[#151c16] overflow-hidden flex-shrink-0">
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
                    userBalance={1.2547} // TODO: Make dynamic later - this would come from wallet connection
                    tokenAddress={listing.token?.contractAddress}
                    tokenName={listing.token?.name || listing.title}
                    // Image props - pass the first image from the gallery
                    primaryImage={listing.imageGallery?.[0]}
                    imageGallery={listing.imageGallery}
                    // Progression bar props - now fetched from contract
                    chainId={tokenChainId}
                    dexMeta={listing.dex ?? null}
                  />
                </div>
              </div>
            </div>

            {/* Modals */}
            {navigation.showShareModal && (
              <ShareModal
                onClose={() => navigation.setShowShareModal(false)}
                title={listing.title}
                symbol={listing.symbol}
              />
            )}
            {navigation.showDeliveryModal && (
              <DeliveryModal onClose={() => navigation.setShowDeliveryModal(false)} />
            )}
          </div>
        </div>
      )}

      {isMobile && (
        <div className="block md:hidden">
          <MobileRWAItemPage
            listing={listing}
            loading={loading}
            error={error}
            isLive={forceShowTokenDetails ? true : isLive}
            launchDate={launchDate ?? null}
            isLaunched={forceShowTokenDetails ? true : isLaunched}
            symbol={symbol}
          />
        </div>
      )}
    </>
  );
}
