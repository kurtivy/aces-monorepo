'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Footer from '@/components/ui/custom/footer';
import LuxuryAssetsBackground from '@/components/ui/custom/luxury-assets-background';
import PageBandTitle from '@/components/ui/custom/page-band-title';
import PageBandSubtitle from '@/components/ui/custom/page-band-subtitle';
import AcesHeader from '@/components/ui/custom/aces-header';
import PageLoader from '@/components/loading/page-loader';
import ListTokenForm from '@/components/forms/list-token-form';
import { Dialog, DialogTitle, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { VerificationForm } from '@/components/forms/verification-form';
import { useAuth } from '@/lib/auth/auth-context';

export default function CreateTokenForm() {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  // Import useAuth to refresh user profile on page load
  const { refreshUserProfile } = useAuth();

  // Refresh user profile when page loads to ensure latest verification status
  useEffect(() => {
    console.log('🔄 Launch page loaded, refreshing user profile...');
    refreshUserProfile()
      .then(() => {
        console.log('✅ User profile refreshed on launch page');
      })
      .catch((error) => {
        console.error('❌ Error refreshing profile on launch page:', error);
      });
  }, [refreshUserProfile]);

  if (!imageLoaded) {
    return (
      <div className="min-h-screen bg-[#151c16]">
        <PageLoader />
        {/* Hidden image to trigger loading */}
        <div className="hidden">
          <Image
            src="/webp/aces-booster-pack.webp"
            alt="ACES Booster Pack"
            width={500}
            height={300}
            priority
            onLoad={() => setImageLoaded(true)}
          />
        </div>
      </div>
    );
  }

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
        title="Tokenize your RWA"
        contentWidth={1200}
        bandHeight={96}
        contentLineOffset={8}
      />
      <PageBandSubtitle
        text="Tokenizing your RWAs through ACES.fun will be launching soon."
        contentWidth={1200}
        bandHeight={96}
        contentLineOffset={8}
        offsetY={12}
      />

      {/* Main Content - Fixed 1400px height for background images */}
      <div className="relative z-20 h-[1400px]">
        {/* Booster pack image and Coming Soon banner with grid-style background */}
        <div className="absolute top-[200px] left-1/2 -translate-x-1/2 w-full max-w-[1200px] px-4 sm:px-6 z-10">
          {/* Main container with upcoming-grid styling */}
          <div className="relative pointer-events-auto">
            <div className="relative bg-[#151c16]/80 border border-dashed border-[#E6E3D3]/20 rounded-2xl p-4 sm:p-6 md:p-8 shadow-[0_10px_40px_rgba(215,191,117,0.06)]">
              {/* Corner ticks */}
              <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
              <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
              <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
              <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
              <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
              <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />
              <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
              <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />

              {/* Content within the styled container */}
              <div className="space-y-6 sm:space-y-8">
                {/* Booster Pack Image - responsive sizing, no cropping needed */}
                <div className="relative flex justify-center">
                  {/* <div className="relative w-full max-w-[500px] sm:w-[400px] md:w-[500px]">
                    <Image
                      src="/webp/aces-booster-pack.webp"
                      alt="ACES Booster Pack"
                      width={500}
                      height={300}
                      className="object-contain drop-shadow-lg w-full h-auto"
                      priority
                      sizes="(max-width: 640px) 100vw, (max-width: 768px) 400px, 500px"
                    />
                  </div> */}
                </div>

                {/* Coming Soon Banner - responsive text sizing */}
                <div className="relative">
                  {/* <div className="bg-[#0A120B] border border-[#D7BF75] py-4 sm:py-6 rounded-lg">
                    <div className="text-center">
                      <h2 className="text-[#D7BF75] text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-neue-world uppercase tracking-widest leading-tight">
                        Coming Soon
                      </h2>
                    </div>
                  </div> */}
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Commented out form for future use */}

        <div className="absolute top-[200px] left-1/2 -translate-x-1/2 w-full max-w-[1200px] px-4 sm:px-6 z-10 h-[1200px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <ListTokenForm />
          <div className="h-24" />
        </div>
      </div>

      {/* Footer - Fixed at bottom */}
      <div className="relative z-50">
        <Footer />
      </div>

      {/* Verification Modal - Commented out for Coming Soon page */}
      {/* TODO: Re-enable verification system when form is restored */}
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
      </Dialog> */}
    </div>
  );
}
