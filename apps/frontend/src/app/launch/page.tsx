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
// import { Dialog, DialogTitle, DialogContent, DialogHeader } from '@/components/ui/dialog';
// import { VerificationForm } from '@/components/forms/verification-form';
import { useAuth } from '@/lib/auth/auth-context';
import ListingVerificationBanner from '@/components/ui/listing-verification-banner';

export default function CreateTokenForm() {
  const [imageLoaded, setImageLoaded] = useState(false);
  // const [showVerificationModal, setShowVerificationModal] = useState(false);

  // Import useAuth to refresh user profile on page load
  const { refreshUserProfile, isLoading } = useAuth();
  const [profileReady, setProfileReady] = useState(false);

  // Refresh user profile when page loads to ensure latest verification status
  useEffect(() => {
    console.log('🔄 Launch page loaded, refreshing user profile...');
    refreshUserProfile()
      .then(() => {
        console.log('✅ User profile refreshed on launch page');
      })
      .catch((error) => {
        console.error('❌ Error refreshing profile on launch page:', error);
      })
      .finally(() => {
        setProfileReady(true);
      });
  }, [refreshUserProfile]);

  // Scroll to top after content is loaded
  useEffect(() => {
    if (imageLoaded && profileReady && !isLoading) {
      // Use requestAnimationFrame to ensure DOM has fully rendered
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
      });
    }
  }, [imageLoaded, profileReady, isLoading]);

  if (!imageLoaded || !profileReady || isLoading) {
    return (
      <div className="min-h-screen bg-[#151c16]">
        <PageLoader transparentBackground={false} />
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
        tag="BETA"
      />
      <PageBandSubtitle
        text="Tokenizing your RWAs through ACES.fun will be launching soon."
        contentWidth={1200}
        bandHeight={96}
        contentLineOffset={8}
        offsetY={12}
      />

      {/* Main Content - Fixed 1400px height for background images (match verify page) */}
      <div className="relative z-20 h-[1400px]">
        <div className="absolute top-[200px] left-1/2 -translate-x-1/2 w-full max-w-[1200px] px-4 sm:px-6 z-10">
          <ListingVerificationBanner />
        </div>

        {/* Scrollable form container under the banner */}
        <div
          data-scroll-container
          className="absolute top-[270px] left-1/2 -translate-x-1/2 w-full max-w-[1200px] px-4 sm:px-6 z-10 h-[1130px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
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
