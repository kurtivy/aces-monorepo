'use client';

import TokenSwapInterface from '@/components/new-rwa/token-swap-interface';
import { LeftColumnNavigation } from './components/left-column/left-column-navigation';
import { MiddleContentArea } from './components/middle-column/middle-content-area';
import { ShareModal, DeliveryModal } from './components/modals';
import { useSectionNavigation } from './hooks/use-section-navigation';
import { sections } from './constants';

export default function RWAPage() {
  const navigation = useSectionNavigation(sections);

  return (
    <div
      className="h-screen bg-black text-white overflow-hidden flex flex-col"
      onWheel={navigation.handlePageWheel}
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
          />
        </div>

        {/* Right Column - Token Swap Interface */}
        <div className="w-96 bg-[#231F20] border-l border-[#D0B284]/20 flex-shrink-0 overflow-y-auto">
          <TokenSwapInterface tokenSymbol="RWA" tokenPrice={0.000268} userBalance={1.2547} />
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
