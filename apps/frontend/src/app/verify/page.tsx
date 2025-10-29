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
import { useAuth } from '@/lib/auth/auth-context';
import { VerificationApi, type VerificationDetails } from '@/lib/api/verification';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';

export default function VerifyPage() {
  const { user, getAccessToken, connectWallet } = useAuth();
  const [verificationDetails, setVerificationDetails] = useState<VerificationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [visualReady, setVisualReady] = useState(false);

  // Check user's verification status on page load
  useEffect(() => {
    const checkVerificationStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
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

  // Add visual stability delay after loading is complete
  useEffect(() => {
    if (!loading) {
      // Add a small delay to ensure visual elements are stable before showing content
      const visualDelayTimer = setTimeout(() => {
        setVisualReady(true);
      }, 100); // 100ms delay for visual stability

      return () => clearTimeout(visualDelayTimer);
    }
  }, [loading]);

  // Scroll to top after content is loaded
  useEffect(() => {
    if (visualReady) {
      // Use window.requestAnimationFrame to ensure DOM has fully rendered
      window.requestAnimationFrame(() => {
        const container = document.querySelector('[data-scroll-container]') as HTMLElement | null;
        if (container) {
          const rect = container.getBoundingClientRect();
          const offset = 120; // keep title band visible
          const targetY = Math.max(window.scrollY + rect.top - offset, 0);
          window.scrollTo({ top: targetY, behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }
  }, [visualReady]);

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

      <main className="relative z-20 flex-1 px-4 pb-16 pt-44 sm:px-6 sm:pt-48 md:pt-52 lg:px-10 lg:pt-56">
        <div
          data-scroll-container
          className="mx-auto w-full max-w-[960px] space-y-6 sm:max-w-[1100px] lg:max-w-[1200px]"
        >
          {!visualReady ? (
            <div className="flex items-center justify-center py-16 sm:py-20">
              <div className="h-8 w-8 rounded-full border-2 border-[#D0B284] border-t-transparent animate-spin" />
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
              {!user && (
                <div className="rounded-2xl border border-[#D7BF75]/40 bg-gradient-to-br from-[#D7BF75]/15 to-[#C9AE6A]/10 p-5 shadow-[0_10px_30px_rgba(215,191,117,0.08)] sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-1 items-start gap-4">
                      <div className="shrink-0 rounded-xl border border-[#D7BF75]/40 bg-black/50 p-3">
                        <Shield className="h-8 w-8 text-[#D7BF75]" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-bold text-[#D7BF75]">
                          Connect wallet first to submit
                        </h3>
                        <p className="text-sm text-[#DCDDCC]/85">
                          Connect your wallet to start verification and submit your listing.
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={connectWallet}
                      className="w-full bg-[#D7BF75] px-4 font-semibold text-black hover:bg-[#D7BF75]/80 sm:w-auto"
                    >
                      Connect Wallet
                    </Button>
                  </div>
                </div>
              )}
              <div className="rounded-2xl border border-[#E6E3D3]/15 bg-black/60 p-4 shadow-[0_10px_40px_rgba(215,191,117,0.06)] sm:p-6 lg:p-8">
                <VerificationForm disabled={isDisabled} />
              </div>
            </>
          ) : null}
        </div>
      </main>

      <div className="relative z-50">
        <Footer />
      </div>
    </div>
  );
}
