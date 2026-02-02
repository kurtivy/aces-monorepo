// app/rwa/[symbol]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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
import RightPanel from '@/components/rwa/right-panel'; // Import the new RightPanel component

// V2 Components
import { LeftColumnNavigationV2 } from '@/components/rwa/left-column-v2/left-column-navigation-v2';
import { MiddleContentAreaV2 } from '@/components/rwa/middle-column-v2/middle-content-area-v2';

const columnDividerSize = {
  height: '100%',
  minHeight: '750px',
} as const;

function ColumnDivider({ variant = 'dashed' }: { variant?: 'solid' | 'dashed' }) {
  return (
    <div
      className="relative flex-shrink-0 pointer-events-none"
      style={{ ...columnDividerSize, width: 0 }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="8"
        viewBox="0 0 2 100"
        preserveAspectRatio="none"
        className="absolute"
        style={{ ...columnDividerSize, left: '-4px', top: 0 }}
      >
        <line
          x1="1"
          y1="0"
          x2="1"
          y2="100"
          stroke="#D0B284"
          strokeOpacity={0.3}
          strokeWidth={1}
          strokeDasharray={variant === 'solid' ? '0' : '12 12'}
          vectorEffect="non-scaling-stroke"
          shapeRendering="crispEdges"
        />
      </svg>
    </div>
  );
}

export default function RWAItemPage() {
  const params = useParams();
  const symbol = (params.symbol as string)?.trim() || '';

  // Feature flag for V2 layout
  const USE_NEW_LAYOUT = process.env.NEXT_PUBLIC_USE_NEW_RWA_LAYOUT === 'true' || true; // Default to true for testing

  const tokenDetailsSectionIndex = sections.findIndex(
    (section) => section.id === 'token-details' && !section.isModal,
  );
  const initialSectionIndex = tokenDetailsSectionIndex >= 0 ? tokenDetailsSectionIndex : 0;

  const navigation = useSectionNavigation(sections, initialSectionIndex);
  const { listing, health, loading, error, isLive, launchDate, isLaunched } = useListingBySymbol(
    symbol,
    { includeHealth: true },
  );
  const { capabilities } = useDeviceCapabilities();

  // Chat state for V2 layout
  const [isChatOpen, setIsChatOpen] = useState(false);

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
      <div className="h-screen bg-black text-white flex items-center justify-center">
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
      <div className="h-screen bg-black">
        <PageLoader />
      </div>
    );
  }

  // Not found state
  if (!listing) {
    return (
      <div className="h-screen bg-black text-white flex items-center justify-center">
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
          <div className="relative h-screen text-white overflow-hidden flex flex-col">
            <DashedGridBackground className="absolute inset-0 -z-10" bg="#000000" opacity={0.8} />

            {/* Header */}
            <div className="relative z-50">
              <RWAHeader />
            </div>

            {/* Main 3-Column Layout */}
            <div className="flex flex-1 relative z-10 h-full">
              {USE_NEW_LAYOUT ? (
                <>
                  {/* V2 Layout */}
                  {/* Left Column V2 - New Dashboard */}
                  <LeftColumnNavigationV2
                    listing={listing}
                    health={health}
                    loading={loading}
                    isChatOpen={isChatOpen}
                    onChatToggle={() => setIsChatOpen((prev) => !prev)}
                  />

                  {/* SVG Solid Border - Between Left and Middle columns */}
                  <ColumnDivider variant="solid" />

                  {/* Middle Column V2 - Chart + Learn More */}
                  <div className="flex-1 relative backdrop-blur-sm bg-[#151c16] h-full min-w-0">
                    <div className="h-full min-h-[750px]">
                      <MiddleContentAreaV2
                        listing={listing}
                        isLive={forceShowTokenDetails ? true : isLive}
                        isLaunched={forceShowTokenDetails ? true : isLaunched}
                        selectedImageIndex={navigation.selectedImageIndex}
                        onImageSelect={navigation.setSelectedImageIndex}
                        onChatClick={() => setIsChatOpen((prev) => !prev)}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Old Layout (V1) */}
                  {/* Left Column - Navigation System */}
                  <div className="bg-[#151c16] overflow-hidden flex-shrink-0 w-[18rem] lg:w-[21vw] lg:min-w-[230px] lg:max-w-[280px] xl:w-[18rem] 2xl:w-[20rem]">
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
                  <ColumnDivider />

                  {/* Middle Column - Main Content with Internal Scrolling */}
                  <div className="flex-1 relative backdrop-blur-sm bg-[#151c16] min-w-0">
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
                </>
              )}

              {/* SVG Dashed Border - Between Middle and Right columns */}
              <ColumnDivider variant="solid" />

              {/* Right Column - Token Swap Interface with Progression */}
              <div className="w-96 bg-[#151c16] flex-shrink-0 overflow-hidden backdrop-blur-sm xl:w-96 2xl:w-[28rem]">
                <div
                  className="h-full"
                  style={{
                    height: 'calc(100vh - 120px)',
                    minHeight: '750px',
                  }}
                >
                  {/* New composition */}
                  <RightPanel
                    listing={listing}
                    selectedImageIndex={navigation.selectedImageIndex}
                    onSelectImage={navigation.setSelectedImageIndex}
                  />
                  {/* Legacy component kept for reference/rollback:
                  <TokenSwapWithProgression ... />
                  */}
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
