'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { HorizontalProfileHeader } from '@/components/profile/horizontal-profile-header';
import { TokenListTab } from '@/components/profile/token-list-tab';
import { BidsTab } from '@/components/profile/bids-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Footer from '@/components/ui/custom/footer';
import { useState, useLayoutEffect } from 'react';
import { AdminDashboardOverlay } from '@/components/profile/admin-dashboard-overlay';
import LuxuryAssetsBackground from '@/components/ui/custom/luxury-assets-background';
import AcesHeader from '@/components/ui/custom/aces-header';
import PageBandTitle from '@/components/ui/custom/page-band-title';
import PageLoader from '@/components/loading/page-loader';

export default function ProfilePage() {
  const { user, isLoading, error, updateProfile, connectWallet } = useAuth();
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);

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
    const ResizeObserverCtor = (window as unknown as { ResizeObserver?: unknown })
      .ResizeObserver as
      | (new (callback: (...args: unknown[]) => void) => {
          observe: (el: unknown) => void;
          unobserve: (el: unknown) => void;
        })
      | undefined;
    const header = getHeader();
    const ro = ResizeObserverCtor && header ? new ResizeObserverCtor(measure) : null;
    if (ro && header) ro.observe(header);
    window.addEventListener('resize', measure);
    return () => {
      if (ro && header) ro.unobserve(header);
      window.removeEventListener('resize', measure);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#151c16]">
        <PageLoader />
      </div>
    );
  }

  // Don't block UI on backend errors - show warning but let user continue
  // The fallback profile allows basic functionality to work
  const hasBackendError = error && error.includes('Internal Server Error');

  if (error && !hasBackendError) {
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

  const handleUpdateAccount = async ({ email, username }: { email: string; username: string }) => {
    if (!updateProfile) return;
    const result = await updateProfile({
      email: email || null,
      username: username || null,
    });
    if (!result.success) {
      throw new Error(result.error || 'Failed to update account');
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
    username: user?.username || undefined,
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

      {/* Main content */}
      <div className="relative z-20 h-[1400px]">
        <div
          className="absolute left-1/2 -translate-x-1/2 w-full max-w-[1200px] z-10 h-[1200px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-2"
          style={{ top: `${contentTop}px` }}
        >
          {/* Backend error warning banner */}
          {hasBackendError && (
            <div className="mb-4 bg-yellow-900/20 border border-yellow-600/50 rounded-lg p-3">
              <p className="text-yellow-200 text-sm">
                ⚠️ Connection to backend is limited. Some features may not be available. Your wallet
                is connected and you can still trade.
              </p>
            </div>
          )}

          {/* Profile header bar - outside the panel, full content width */}
          <HorizontalProfileHeader
            user={profileData}
            onUpdateAccount={handleUpdateAccount}
            onConnectWallet={connectWallet}
          />

          {/* Main panel below header - no gap */}
          <div className="relative bg-[#151c16]/80 border border-dashed border-[#E6E3D3]/20 rounded-2xl p-8 shadow-[0_10px_40px_rgba(215,191,117,0.06)] space-y-8">
            {/* Tabs */}
            <div className="w-full">
              <Tabs defaultValue="tokens" className="w-full">
                <TabsList className="bg-transparent border-none p-0 h-auto space-x-8 mb-6">
                  <TabsTrigger
                    value="tokens"
                    className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-[#D7BF75]"
                  >
                    TOKENS
                  </TabsTrigger>
                  <TabsTrigger
                    value="bids"
                    className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-[#D7BF75]"
                  >
                    BIDS
                  </TabsTrigger>
                </TabsList>
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
