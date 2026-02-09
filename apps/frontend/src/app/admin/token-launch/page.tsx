'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut } from 'lucide-react';
import ConnectWalletProfile from '@/components/ui/custom/connect-wallet-profile';
import Footer from '@/components/ui/custom/footer';
import LuxuryAssetsBackground from '@/components/ui/custom/luxury-assets-background';
import PageBandTitle from '@/components/ui/custom/page-band-title';
import PageBandSubtitle from '@/components/ui/custom/page-band-subtitle';
import AcesHeader from '@/components/ui/custom/aces-header';
import PageLoader from '@/components/loading/page-loader';
import { TokenLaunchProvider, useTokenLaunch } from './context';
import { FixedSupplyTokenCard } from './components/fixed-supply-token-card';
import { CreateListingCard } from './components/create-listing-card';
import { CanvasTokenPoolCard } from './components/canvas-token-pool-card';
import { LaunchPoolCard } from './components/launch-pool-card';
import { TestAerodromeLockerCard } from './components/test-aerodrome-locker-card';
import { ManageListingsCard } from './components/manage-listings-card';
import { SKIP_ADMIN_AUTH } from './types';

function TokenLaunchContent() {
  const { isAdminLoading, isAdminAuthenticated, loadingElapsed, handleLogout } = useTokenLaunch();

  const showRefreshHint = loadingElapsed >= 8;

  if (!SKIP_ADMIN_AUTH && isAdminLoading) {
    return (
      <div className="min-h-screen bg-[#151c16] flex flex-col items-center justify-center px-4">
        <PageLoader />
        <p className="mt-4 text-[#DCDDCC] font-jetbrains text-sm">Checking authentication...</p>
        {showRefreshHint && (
          <div className="mt-6 max-w-sm text-center">
            <p className="text-amber-200/90 font-jetbrains text-sm mb-3">
              Taking longer than usual. If you just signed in, try refreshing to load your session.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="border-purple-400/50 text-purple-300"
              onClick={() => window.location.reload()}
            >
              Refresh page
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (!SKIP_ADMIN_AUTH && !isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-[#151c16] flex flex-col items-center justify-center">
        <PageLoader />
        <p className="mt-4 text-[#DCDDCC] font-jetbrains text-sm">Loading Token Launch...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-[#151c16] flex flex-col">
      <div className="relative z-50">
        <AcesHeader />
      </div>

      <LuxuryAssetsBackground
        className="absolute inset-0 z-0"
        opacity={1}
        showOnMobile={false}
        minHeight={3000}
        contentWidth={1200}
        topOffset={112}
        bandHeight={96}
      />

      <PageBandTitle
        title="Token Launch Center"
        contentWidth={1200}
        bandHeight={96}
        contentLineOffset={8}
      />
      <PageBandSubtitle
        text="Create and manage ERC20 tokens on Base blockchain. Deploy tokens with custom bonding curves, link them to listings, and manage the full token lifecycle."
        contentWidth={1200}
        bandHeight={96}
        contentLineOffset={8}
        offsetY={12}
      />

      <div className="relative z-20 flex-1 w-full min-h-0">
        <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 pt-[200px] pb-24">
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <Badge variant="outline" className="text-purple-400 border-purple-400">
                Admin Only
              </Badge>
              <div className="flex items-center gap-4">
                <ConnectWalletProfile />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="text-red-400 border-red-400 hover:bg-red-400/10"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>

            <FixedSupplyTokenCard />
            <CreateListingCard />
            <CanvasTokenPoolCard />
            <LaunchPoolCard />
            <TestAerodromeLockerCard />
            <ManageListingsCard />
          </div>
        </div>
      </div>

      <div className="relative z-50 mt-auto">
        <Footer />
      </div>
    </div>
  );
}

export default function AdminTokenLaunchPage() {
  return (
    <TokenLaunchProvider>
      <TokenLaunchContent />
    </TokenLaunchProvider>
  );
}
