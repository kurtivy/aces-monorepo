'use client';

import type React from 'react';
import Footer from '@/components/ui/custom/footer';
import LuxuryAssetsBackground from '@/components/ui/custom/luxury-assets-background';
import PageBandTitle from '@/components/ui/custom/page-band-title';
import PageBandSubtitle from '@/components/ui/custom/page-band-subtitle';
import AcesHeader from '@/components/ui/custom/aces-header';
import ListTokenForm from '@/components/forms/list-token-form';

export default function CreateTokenForm() {
  return (
    <div className="min-h-screen relative bg-[#151c16]">
      {/* Header Component */}
      <div className="relative z-50">
        <AcesHeader />
      </div>

      {/* ACES Background + Luxury Tiles */}
      <LuxuryAssetsBackground
        className="absolute inset-0 z-0"
        opacity={1}
        showOnMobile={false}
        minHeight={1400}
        contentWidth={1200}
        topOffset={112}
        bandHeight={96}
      />

      {/* Title band between header bottom and solid horizontal line */}
      <PageBandTitle
        title="Submit Your RWA for Tokenization"
        contentWidth={1200}
        bandHeight={96}
        contentLineOffset={8}
      />
      <PageBandSubtitle
        text="Transform your high-value Real-World Asset into a digital token. Join our exclusive launch by submitting your luxury asset for tokenization."
        contentWidth={1200}
        bandHeight={96}
        contentLineOffset={8}
        offsetY={12}
      />

      {/* Main Content - Fixed 1400px height for background images */}
      <div className="relative z-20 h-[1400px]">
        {/* Scrollable form container positioned underneath text */}
        <div className="absolute top-[200px] left-1/2 -translate-x-1/2 w-full max-w-[1200px] px-4 sm:px-6 z-10 h-[1200px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <ListTokenForm />
          {/* Bottom padding to ensure footer clearance */}
          <div className="h-24" />
        </div>
      </div>

      {/* Footer - Fixed at bottom */}
      <div className="relative z-50">
        <Footer />
      </div>

      {/* Verification Modal - Temporarily commented out */}
      {/* TODO: Re-enable verification system later */}
      {/*
      <Dialog open={showVerificationModal} onOpenChange={setShowVerificationModal}>
        <DialogContent className="sm:max-w-[800px] bg-black border-[#D0B284]">
          <DialogHeader>
            <DialogTitle className="text-[#D0B284] text-2xl">Seller Verification</DialogTitle>
          </DialogHeader>
          <VerificationForm
            onSuccess={() => setShowVerificationModal(false)}
            onCancel={() => setShowVerificationModal(false)}
          />
        </DialogContent>
      </Dialog>
      */}
    </div>
  );
}
