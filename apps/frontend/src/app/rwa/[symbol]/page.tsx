// app/rwa/[symbol]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import TokenSwapInterface from '@/components/rwa/token-swap-interface';
import { LeftColumnNavigation } from '../../../components/rwa/left-column/left-column-navigation';
import { MiddleContentArea } from '../../../components/rwa/middle-column/middle-content-area';
import { ShareModal, DeliveryModal } from '../../../components/rwa/modals';
import { useSectionNavigation } from '@/hooks/rwa/use-section-navigation';
import { useListingBySymbol } from '@/hooks/rwa/use-listing-by-symbol';
import { sections } from '@/constants/rwa';
import AcesHeader from '@/components/ui/custom/aces-header';
import DashedGridBackground from '@/components/ui/custom/dashed-grid-background';

export default function RWAItemPage() {
  const params = useParams();
  const symbol = params.symbol as string;

  const navigation = useSectionNavigation(sections);
  const { listing, loading, error, isLive, launchDate, isLaunched } = useListingBySymbol(symbol);

  // TEMPORARY: Force show token details for testing the new graph
  const forceShowTokenDetails = true;

  // const handleMakeOffer = () => {
  //   navigation.handleSectionChange(3);
  // };

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
      <div className="h-screen bg-[#151c16] text-white flex items-center justify-center">
        <div className="text-[#D0B284] text-lg">Loading {symbol}...</div>
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

  return (
    <div className="relative min-h-screen text-white overflow-hidden flex flex-col">
      <DashedGridBackground className="absolute inset-0 -z-10" bg="#151c16" opacity={0.8} />

      {/* Header */}
      <div className="relative z-10">
        <AcesHeader />
      </div>

      {/* Main 3-Column Layout */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Left Column - Navigation System */}
        <div className="w-80 bg-[#151c16] border-r border-dashed border-[#D0B284]/30 relative overflow-hidden flex-shrink-0">
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

        {/* Middle Column - Main Content */}
        <div className="flex-1 relative overflow-hidden backdrop-blur-sm bg-[#151c16] ">
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

        {/* Right Column - Token Swap Interface */}
        <div className="w-96 bg-[#151c16] border-l border-[#D0B284]/20 flex-shrink-0 overflow-y-auto backdrop-blur-sm">
          <TokenSwapInterface
            tokenSymbol={listing.token?.symbol || listing.symbol}
            tokenPrice={
              listing.token?.currentPriceACES
                ? parseFloat(listing.token.currentPriceACES)
                : 0.000268
            }
            userBalance={1.2547} // TODO: Make dynamic later - this would come from wallet connection
            tokenAddress={listing.token?.contractAddress}
            tokenName={listing.token?.name || listing.title}
          />
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
  );
}
