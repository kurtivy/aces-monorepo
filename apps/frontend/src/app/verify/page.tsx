'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import Footer from '@/components/ui/custom/footer';
import LuxuryAssetsBackground from '@/components/ui/custom/luxury-assets-background';
import PageBandTitle from '@/components/ui/custom/page-band-title';
import PageBandSubtitle from '@/components/ui/custom/page-band-subtitle';
import AcesHeader from '@/components/ui/custom/aces-header';
import { VerificationForm } from '@/components/forms/verification-form';
import { VerificationStatusDisplay } from '@/components/ui/verification-status-display';
import { VerificationLoginPrompt } from '@/components/ui/verification-login-prompt';
import { useAuth } from '@/lib/auth/auth-context';
import { VerificationApi, type VerificationDetails } from '@/lib/api/verification';

export default function VerifyPage() {
  const { user, getAccessToken } = useAuth();
  const [verificationDetails, setVerificationDetails] = useState<VerificationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Check user's verification status on page load
  useEffect(() => {
    const checkVerificationStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const authToken = await getAccessToken();
        if (!authToken) {
          setLoading(false);
          return;
        }

        // Get verification details from API
        const response = await VerificationApi.getVerificationDetails(authToken);

        if (response.success && response.data) {
          setVerificationDetails(response.data);
        } else {
          // No verification found, user can apply
          setShowForm(true);
        }
      } catch (error) {
        console.error('Error checking verification status:', error);
        // On error, default to showing the form
        setShowForm(true);
      } finally {
        setLoading(false);
      }
    };

    checkVerificationStatus();
  }, [user, getAccessToken]);

  const handleTryAgain = () => {
    setVerificationDetails(null);
    setShowForm(true);
  };

  const shouldShowForm =
    showForm ||
    (verificationDetails?.status === 'REJECTED' && verificationDetails.attempts < 3) ||
    !user;
  const shouldShowStatus = verificationDetails && !showForm && user;
  const isDisabled = !user; // Disable form when user is not logged in

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
        title="Identity Verification"
        contentWidth={1200}
        bandHeight={96}
        contentLineOffset={8}
        tag="BETA"
      />
      <PageBandSubtitle
        text="Complete your identity verification to unlock the ability to submit luxury assets for tokenization. This process ensures the security and authenticity of our marketplace."
        contentWidth={1200}
        bandHeight={96}
        contentLineOffset={8}
        offsetY={12}
      />

      {/* Main Content - Fixed 1400px height for background images */}
      <div className="relative z-20 h-[1400px]">
        {/* Scrollable form container positioned underneath text */}
        <div className="absolute top-[200px] left-1/2 -translate-x-1/2 w-full max-w-[1200px] px-4 sm:px-6 z-10 h-[1200px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-[#D0B284] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : shouldShowStatus ? (
            <VerificationStatusDisplay
              status={verificationDetails.status}
              attemptsUsed={verificationDetails.attempts}
              maxAttempts={3}
              rejectionReason={verificationDetails.rejectionReason}
              submittedAt={verificationDetails.submittedAt}
              onTryAgain={
                verificationDetails.status === 'REJECTED' && verificationDetails.attempts < 3
                  ? handleTryAgain
                  : undefined
              }
            />
          ) : shouldShowForm ? (
            <>
              {isDisabled && <VerificationLoginPrompt />}
              <VerificationForm disabled={isDisabled} />
            </>
          ) : null}

          {/* Bottom padding to ensure footer clearance */}
          <div className="h-24" />
        </div>
      </div>

      {/* Footer - Fixed at bottom */}
      <div className="relative z-50">
        <Footer />
      </div>
    </div>
  );
}
