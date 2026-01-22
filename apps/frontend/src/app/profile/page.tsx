'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { HorizontalProfileHeader } from '@/components/profile/horizontal-profile-header';
// Tabs removed in favor of a single "My Collectibles" view on this page
import Footer from '@/components/ui/custom/footer';
import { useState, useLayoutEffect } from 'react';
import Link from 'next/link';
import { AdminDashboardOverlay } from '@/components/profile/admin-dashboard-overlay';
import LuxuryAssetsBackground from '@/components/ui/custom/luxury-assets-background';
import AcesHeader from '@/components/ui/custom/aces-header';
import PageBandTitle from '@/components/ui/custom/page-band-title';
import PageLoader from '@/components/loading/page-loader';
import { UserSubmissionsTab } from '@/components/profile/user-submissions-tab';
import { OffersTab } from '@/components/profile/offers-tab';
import { Button } from '@/components/ui/button';

export default function ProfilePage() {
  const { user, isLoading, error, updateProfile, connectWallet, authReady, isAuthenticated } =
    useAuth();
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Align content start to the solid line below the band
  const BOTTOM_RULE_HEIGHT = 8;
  const BAND_HEIGHT = 72;
  const TITLE_CLEARANCE = 8; // tighter clearance under the title band
  const [contentTop, setContentTop] = useState<number>(0);

  useLayoutEffect(() => {
    const getHeader = () => document.querySelector('[data-aces-header]') as HTMLElement | null;
    const measure = () => {
      const header = getHeader();
      if (header) {
        const rect = header.getBoundingClientRect();
        // Reduce overlap by adding a bit of extra clearance under the title band
        setContentTop(
          Math.max(0, Math.round(rect.bottom + BOTTOM_RULE_HEIGHT + BAND_HEIGHT + TITLE_CLEARANCE)),
        );
      }
      setIsMobile(window.innerWidth <= 768);
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

  if (!authReady || isLoading) {
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
  };

  const needsWalletConnection = !isAuthenticated || !user?.walletAddress;

  return (
    <div className="relative flex min-h-screen flex-col bg-[#151c16]">
      <div className="relative z-50">
        <AcesHeader />
      </div>

      <LuxuryAssetsBackground
        className="absolute inset-0 z-0"
        opacity={0.9}
        showOnMobile={false}
        minHeight={1400}
        contentWidth={1200}
        bandHeight={72}
      />

      <PageBandTitle title="Profile" contentWidth={1200} bandHeight={72} contentLineOffset={8} />

      <main
        className="relative z-20 flex-1 px-4 pb-16 pt-20 sm:px-6 sm:pt-24 lg:px-10"
        style={!isMobile && contentTop > 0 ? { paddingTop: `${contentTop}px` } : undefined}
      >
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 sm:max-w-[1100px] lg:max-w-[1200px]">
          {hasBackendError && (
            <div className="rounded-xl border border-yellow-600/50 bg-yellow-900/20 p-3 text-sm text-yellow-200">
              ⚠️ Connection to backend is limited. Some features may not be available. Your wallet
              is connected and you can still trade.
            </div>
          )}

          {needsWalletConnection && (
            <div className="flex flex-col gap-4 rounded-2xl border border-[#D7BF75]/40 bg-gradient-to-br from-[#D7BF75]/15 to-[#C9AE6A]/10 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2 text-sm text-[#DCDDCC]/85 sm:pr-4">
                <h3 className="text-lg font-bold text-[#D7BF75]">Connect your wallet</h3>
                <p>You must connect a wallet to view your portfolio, bids, listings, and offers.</p>
              </div>
              <Button
                onClick={connectWallet}
                className="w-full bg-[#D7BF75] px-4 font-semibold text-black hover:bg-[#D7BF75]/80 sm:w-auto"
              >
                Connect Wallet
              </Button>
            </div>
          )}


          <HorizontalProfileHeader
            user={profileData}
            onUpdateAccount={handleUpdateAccount}
            onConnectWallet={connectWallet}
          />

          <div className="space-y-6 rounded-2xl border border-dashed border-[#E6E3D3]/20 bg-[#151c16]/80 p-6 shadow-[0_10px_40px_rgba(215,191,117,0.06)] sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-semibold tracking-wider text-[#D0B264]">
                My Collectibles
              </h2>
              <Link href="/launch" className="inline-flex">
                <Button className="w-full bg-[#D7BF75] px-4 py-2 text-sm text-black hover:bg-[#D7BF75]/80 sm:w-auto">
                  Launch Collectible
                </Button>
              </Link>
            </div>

            {!needsWalletConnection ? (
              <UserSubmissionsTab />
            ) : (
              <div className="space-y-2 py-12 text-center text-[#DCDDCC]/70">
                <p className="mb-2">Connect your wallet to view your collectibles</p>
                <p className="text-sm">
                  Your submissions, listings, and offers will appear here once connected.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <AdminDashboardOverlay
        isOpen={isAdminDashboardOpen}
        onClose={() => setIsAdminDashboardOpen(false)}
      />

      <div className="relative z-50">
        <Footer />
      </div>
    </div>
  );
}
