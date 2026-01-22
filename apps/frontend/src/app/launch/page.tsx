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

export default function CreateTokenForm() {
  const [imageLoaded, setImageLoaded] = useState(false);
  // const [showVerificationModal, setShowVerificationModal] = useState(false);

  // Import useAuth to refresh user profile on page load
  const { refreshUserProfile, isLoading } = useAuth();
  const [profileReady, setProfileReady] = useState(false);
  const [visualReady, setVisualReady] = useState(false);

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

  // Add visual stability delay after all loading conditions are met
  useEffect(() => {
    if (imageLoaded && profileReady && !isLoading) {
      // Add a small delay to ensure visual elements are stable before showing content
      const visualDelayTimer = setTimeout(() => {
        setVisualReady(true);
      }, 100); // 100ms delay for visual stability

      return () => clearTimeout(visualDelayTimer);
    }
  }, [imageLoaded, profileReady, isLoading]);

  // Scroll to top after content is loaded
  useEffect(() => {
    if (visualReady) {
      // Use requestAnimationFrame to ensure DOM has fully rendered
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
      });
    }
  }, [visualReady]);

  if (!visualReady) {
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
    <div className="relative flex min-h-screen flex-col bg-[#151c16]">
      <div className="relative z-50">
        <AcesHeader />
      </div>

      <LuxuryAssetsBackground
        className="absolute inset-0 z-0"
        opacity={1}
        showOnMobile={false}
        minHeight={1400}
        contentWidth={1200}
        topOffset={112}
        bandHeight={96}
      />

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

      <main className="relative z-20 flex-1 px-4 pb-16 pt-44 sm:px-6 sm:pt-48 md:pt-52 lg:px-10 lg:pt-56">
        <div className="mx-auto w-full max-w-[960px] space-y-6 sm:max-w-[1100px] lg:max-w-[1200px]">
          <div
            data-scroll-container
            className="rounded-2xl border border-[#E6E3D3]/15 bg-black/60 p-4 shadow-[0_10px_40px_rgba(215,191,117,0.06)] sm:p-6 lg:p-8"
          >
            <ListTokenForm />
          </div>
        </div>
      </main>

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
