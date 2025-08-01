'use client';

import TokenSwapInterface from '@/components/rwa/token-swap-interface';
import { LeftColumnNavigation } from '../../components/rwa/left-column/left-column-navigation';
import { MiddleContentArea } from '../../components/rwa/middle-column/middle-content-area';
import { ShareModal, DeliveryModal } from '../../components/rwa/modals';
import { useSectionNavigation } from '@/hooks/rwa/use-section-navigation';
import { sections } from '@/constants/rwa';
import AcesHeader from '@/components/ui/custom/aces-header';

export default function RWAPage() {
  const navigation = useSectionNavigation(sections);

  const handleMakeOffer = () => {
    // Navigate to the "PLACE BIDS" section (index 3)
    navigation.handleSectionChange(3);
  };

  return (
    <div className="h-screen bg-black text-white overflow-hidden flex flex-col">
      {/* Header */}
      <AcesHeader />

      {/* Main 3-Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column - Navigation System */}
        <div className="w-80 bg-[#231F20]/30 border-r border-dashed border-[#D0B284]/30 relative overflow-hidden flex-shrink-0">
          <LeftColumnNavigation
            sections={sections}
            activeSection={navigation.activeSection}
            onSectionChange={navigation.handleSectionChange}
            isAnimating={navigation.isAnimating}
            selectedImageIndex={navigation.selectedImageIndex}
            setSelectedImageIndex={navigation.setSelectedImageIndex}
            previousActiveSection={navigation.previousActiveSection}
          />
        </div>

        {/* Middle Column - Main Content */}
        <div className="flex-1 bg-black relative overflow-hidden">
          <MiddleContentArea
            activeSection={navigation.activeSection}
            selectedImageIndex={navigation.selectedImageIndex}
            setSelectedImageIndex={navigation.setSelectedImageIndex}
            isAnimating={navigation.isAnimating}
            navigationDirection={navigation.navigationDirection}
          />
        </div>

        {/* Right Column - Token Swap Interface */}
        <div className="w-96 bg-[#231F20] border-l border-[#D0B284]/20 flex-shrink-0 overflow-y-auto">
          <TokenSwapInterface
            tokenSymbol="RWA"
            tokenPrice={0.000268}
            userBalance={1.2547}
            onMakeOffer={handleMakeOffer}
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
