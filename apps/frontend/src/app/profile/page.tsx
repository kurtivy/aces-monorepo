'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { HorizontalProfileHeader } from '@/components/profile/horizontal-profile-header';
import { TokenListTab } from '@/components/profile/token-list-tab';
import { BidsTab } from '@/components/profile/bids-tab';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import Footer from '@/components/ui/custom/footer';
import { useState, useLayoutEffect, useEffect } from 'react';
import { AdminDashboardOverlay } from '@/components/profile/admin-dashboard-overlay';
import { SubmissionStatusNotifications } from '@/components/profile/submission-status-notifications';
import LuxuryAssetsBackground from '@/components/ui/custom/luxury-assets-background';
import AcesHeader from '@/components/ui/custom/aces-header';
import PageBandTitle from '@/components/ui/custom/page-band-title';
import PageBandSubtitle from '@/components/ui/custom/page-band-subtitle';
import VerificationNotificationPanel from '@/components/ui/verification-notification-panel';
import { VerificationApi, type VerificationDetails } from '@/lib/api/verification';

export default function ProfilePage() {
  const { user, isLoading, error, updateProfile, getAccessToken, connectWallet } = useAuth();
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [verificationDetails, setVerificationDetails] = useState<VerificationDetails | null>(null);

  // Align content start to the solid line below the band
  const BOTTOM_RULE_HEIGHT = 8;
  const BAND_HEIGHT = 24;
  const [contentTop, setContentTop] = useState<number>(0);

  useLayoutEffect(() => {
    const getHeader = () => document.querySelector('[data-aces-header]') as HTMLElement | null;
    const measure = () => {
      const header = getHeader();
      if (header) {
        const rect = header.getBoundingClientRect();
        setContentTop(Math.max(0, Math.round(rect.bottom + BOTTOM_RULE_HEIGHT + BAND_HEIGHT)));
      }
    };
    measure();
    const ResizeObserverCtor: any = (window as any).ResizeObserver;
    const header = getHeader();
    const ro = ResizeObserverCtor && header ? new ResizeObserverCtor(measure) : null;
    if (ro && header) ro.observe(header);
    window.addEventListener('resize', measure);
    return () => {
      if (ro && header) ro.unobserve(header);
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Fetch verification details when user is available
  useEffect(() => {
    const fetchVerificationDetails = async () => {
      if (!user) {
        setVerificationDetails(null);
        return;
      }

      try {
        const authToken = await getAccessToken();
        if (!authToken) return;

        const response = await VerificationApi.getVerificationDetails(authToken);
        if (response.success && response.data) {
          setVerificationDetails(response.data);
        }
      } catch (error) {
        console.error('Error fetching verification details:', error);
        // Silently fail - notification will just not show
      }
    };

    fetchVerificationDetails();
  }, [user, getAccessToken]);

  if (isLoading) {
    return (
      <div className="min-h-screen relative bg-[#151c16]">
        <div className="relative z-50">
          <AcesHeader />
        </div>
        <LuxuryAssetsBackground
          className="absolute inset-0 z-0"
          opacity={0.9}
          showOnMobile={false}
          contentWidth={1200}
          bandHeight={96}
        />
        <PageBandTitle
          title="Portfolio"
          contentWidth={1200}
          bandHeight={96}
          contentLineOffset={8}
        />
        <PageBandSubtitle
          text="Your tokenized RWA portfolio and bids"
          contentWidth={1200}
          bandHeight={96}
          contentLineOffset={8}
          offsetY={12}
        />
        {/* Verification Notification Panel in loading state too */}
        <VerificationNotificationPanel
          verificationDetails={verificationDetails}
          contentWidth={1200}
          bandHeight={96}
          contentLineOffset={8}
        />
        <div className="relative z-20 h-[1000px]">
          <div className="absolute top-[200px] left-1/2 -translate-x-1/2 w-full max-w-[1200px] px-4 sm:px-6 z-10 h-[760px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="relative bg-[#151c16]/80 border border-dashed border-[#E6E3D3]/20 rounded-2xl p-8 shadow-[0_10px_40px_rgba(215,191,117,0.06)]">
              <div className="animate-pulse space-y-6">
                <div className="h-24 bg-[#0f1511] rounded-xl border border-[#D0B284]/10" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="h-64 bg-[#0f1511] rounded-xl border border-[#D0B284]/10" />
                  <div className="md:col-span-2 h-64 bg-[#0f1511] rounded-xl border border-[#D0B284]/10" />
                </div>
              </div>
            </div>
            <div className="h-24" />
          </div>
        </div>
        <div className="relative z-50">
          <Footer />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black">
        <AcesHeader />
        <div className="p-6">
          <div className="bg-[#231F20] rounded-xl p-6 border border-red-500">
            <h2 className="text-red-500 font-bold font-libre-caslon">Error Loading Profile</h2>
            <p className="text-[#DCDDCC] mb-4">{error}</p>
            <p className="text-[#DCDDCC] text-sm">
              If you&apos;re having trouble connecting, try refreshing the page or connecting your
              wallet again.
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const handleUpdateEmail = async (email: string) => {
    if (!updateProfile) return;
    const result = await updateProfile({ email });
    if (!result.success) {
      throw new Error(result.error || 'Failed to update email');
    }
  };

  // const handleSellerDashboard = () => {
  //   setIsSellerDashboardOpen(true);
  // };

  // const handleAdminDashboard = () => {
  //   setIsAdminDashboardOpen(true);
  // };

  const profileData = {
    email: user?.email || undefined,
    walletAddress: user?.walletAddress || undefined, // Using database wallet address directly
    role: user?.role || undefined,
    sellerStatus: user?.sellerStatus || undefined,
  };

  return (
    <div className="min-h-screen relative bg-[#151c16]">
      {/* Header */}
      <div className="relative z-50">
        <AcesHeader />
      </div>

      {/* Background + lines */}
      <LuxuryAssetsBackground
        className="absolute inset-0 z-0"
        opacity={0.9}
        showOnMobile={false}
        minHeight={1400}
        contentWidth={1200}
        bandHeight={96}
      />

      {/* Bands */}
      <PageBandTitle title="Portfolio" contentWidth={1200} bandHeight={96} contentLineOffset={8} />
      {/* Subtitle intentionally removed for profile */}

      {/* Verification Notification Panel - Left side of divider */}
      <VerificationNotificationPanel
        verificationDetails={verificationDetails}
        contentWidth={1200}
        bandHeight={96}
        contentLineOffset={8}
      />

      {/* Main content */}
      <div className="relative z-20 h-[1400px]">
        <div
          className="absolute left-1/2 -translate-x-1/2 w-full max-w-[1200px] z-10 h-[1200px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-2"
          style={{ top: `${contentTop}px` }}
        >
          {/* Profile header bar - outside the panel, full content width */}
          <HorizontalProfileHeader
            user={profileData}
            onUpdateEmail={handleUpdateEmail}
            onConnectWallet={connectWallet}
          />

          {/* Main panel below header - no gap */}
          <div className="relative bg-[#151c16]/80 border border-dashed border-[#E6E3D3]/20 rounded-2xl p-8 shadow-[0_10px_40px_rgba(215,191,117,0.06)] space-y-8">
            {/* Notifications */}
            <SubmissionStatusNotifications />

            {/* Tabs */}
            <div className="w-full">
              <Tabs defaultValue="tokens" className="w-full">
                <TabsContent value="tokens" className="mt-0 w-full">
                  <TokenListTab />
                </TabsContent>
                <TabsContent value="bids" className="mt-0 w-full">
                  <BidsTab />
                </TabsContent>
              </Tabs>
            </div>
          </div>
          <div className="h-24" />
        </div>
      </div>
      {/* Overlays */}
      <AdminDashboardOverlay
        isOpen={isAdminDashboardOpen}
        onClose={() => setIsAdminDashboardOpen(false)}
      />

      {/* Footer */}
      <div className="relative z-50">
        <Footer />
      </div>
    </div>
  );
}
