'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { HorizontalProfileHeader } from '@/components/profile/horizontal-profile-header';
// Profile simplified to show only token holdings (verification/submissions removed)
import Footer from '@/components/ui/custom/footer';
import { useState, useLayoutEffect, startTransition } from 'react';
import Link from 'next/link';
import { AdminDashboardOverlay } from '@/components/profile/admin-dashboard-overlay';
import LuxuryAssetsBackground from '@/components/ui/custom/luxury-assets-background';
import AcesHeader from '@/components/ui/custom/aces-header';
import PageBandTitle from '@/components/ui/custom/page-band-title';
// OffersTab removed - not used in simplified profile
import { Button } from '@/components/ui/button';
import { useProfileTokenHoldings } from '@/hooks/use-profile-token-holdings';
import { useAllBaseTokenBalances } from '@/hooks/use-all-base-token-balances';
import { Loader2, ExternalLink } from 'lucide-react';
import ErrorBoundary from '@/components/error-boundary';

function ProfileContentSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      {/* Profile header skeleton */}
      <div className="relative bg-[#0f1511] rounded-b-xl p-6 border-b border-dashed border-[#E6E3D3]/25">
        <div className="flex flex-col md:flex-row md:items-start md:justify-center gap-8">
          <div className="min-w-0 space-y-4 md:basis-[58%]">
            <div className="h-8 w-32 bg-[#D0B264]/20 rounded" />
          </div>
          <div className="w-full md:max-w-[640px] md:pr-12">
            <div className="bg-black/30 border border-[#D0B284]/20 rounded-xl px-6 py-5 backdrop-blur-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="h-3 w-24 bg-[#D0B264]/20 rounded" />
                  <div className="h-6 w-20 bg-[#D0B264]/30 rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-20 bg-[#D0B264]/20 rounded" />
                  <div className="h-6 w-16 bg-[#D0B264]/30 rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Token holdings skeleton */}
      <div className="space-y-6 rounded-2xl border border-dashed border-[#E6E3D3]/20 bg-[#151c16]/80 p-6 sm:p-8">
        <div className="h-7 w-40 bg-[#D0B264]/20 rounded" />
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#D0B264]/60" />
          <p className="text-sm text-[#DCDDCC]/70">Loading profile...</p>
        </div>
      </div>
    </div>
  );
}

function TokenHoldingsFallback({ resetError }: { error?: Error; resetError: () => void }) {
  return (
    <div className="space-y-6 rounded-2xl border border-dashed border-[#E6E3D3]/20 bg-[#151c16]/80 p-6 shadow-[0_10px_40px_rgba(215,191,117,0.06)] sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-semibold tracking-wider text-[#D0B264]">Token Holdings</h2>
      </div>
      <div className="space-y-2 py-12 text-center text-[#DCDDCC]/70">
        <p className="mb-2">Token holdings temporarily unavailable</p>
        <p className="text-sm mb-4">
          Run <code className="rounded bg-black/30 px-1 py-0.5">npx convex deploy</code> to sync the
          token list, or try again later.
        </p>
        <Button
          onClick={resetError}
          variant="outline"
          className="border-[#D7BF75]/40 text-[#D7BF75] hover:bg-[#D7BF75]/10"
        >
          Try again
        </Button>
      </div>
    </div>
  );
}

function ProfileTokenHoldings({
  needsWalletConnection,
  onConnectWallet,
}: {
  needsWalletConnection: boolean;
  onConnectWallet: () => void;
}) {
  const { holdings, isLoading, error, hasWallet, tokenListCount } = useProfileTokenHoldings();

  return (
    <div className="space-y-6 rounded-2xl border border-dashed border-[#E6E3D3]/20 bg-[#151c16]/80 p-6 shadow-[0_10px_40px_rgba(215,191,117,0.06)] sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-semibold tracking-wider text-[#D0B264]">Token Holdings</h2>
      </div>

      {needsWalletConnection ? (
        <div className="space-y-2 py-12 text-center text-[#DCDDCC]/70">
          <p className="mb-2">Connect your wallet to view your token holdings</p>
          <p className="text-sm">Your token holdings and offers will appear here once connected.</p>
          <Button
            onClick={onConnectWallet}
            className="mt-4 bg-[#D7BF75] px-4 font-semibold text-black hover:bg-[#D7BF75]/80"
          >
            Connect Wallet
          </Button>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#DCDDCC]/70">
          <Loader2 className="h-8 w-8 animate-spin text-[#D0B264]" />
          <p className="mt-3 text-sm">Loading your holdings...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          Failed to load token balances. Please try again later.
        </div>
      ) : holdings.length === 0 ? (
        <div className="space-y-2 py-12 text-center text-[#DCDDCC]/70">
          <p className="mb-2">No token holdings on our list</p>
          <p className="text-sm">
            {tokenListCount === 0
              ? 'Our curated token list is empty. Add active tokens in the database (Base mainnet) to see holdings here.'
              : `We check your wallet against ${tokenListCount} token(s) on Base mainnet. You have no balance for any of them.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {holdings.map((h) => (
            <Link
              key={h.contractAddress}
              href={`/rwa/${h.symbol.toLowerCase()}`}
              className="flex items-center justify-between rounded-xl border border-[#E6E3D3]/20 bg-[#0f1410]/60 p-4 transition-colors hover:border-[#D7BF75]/40 hover:bg-[#0f1410]/80"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[#DCDDCC]">
                  {h.symbol}
                  <span className="ml-1.5 text-xs font-normal text-[#DCDDCC]/60">{h.name}</span>
                </p>
                <p className="mt-0.5 text-sm text-[#D7BF75]">
                  {parseFloat(h.balance).toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                    minimumFractionDigits: 0,
                  })}{' '}
                  {h.symbol}
                </p>
                <p className="mt-1 font-mono text-xs text-[#DCDDCC]/50" title={h.contractAddress}>
                  {h.contractAddress.slice(0, 6)}…{h.contractAddress.slice(-4)}
                </p>
                {h.usdValue != null && (
                  <p className="mt-0.5 text-sm font-medium text-[#D7BF75]/90">
                    $
                    {h.usdValue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                )}
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-[#D7BF75]/60" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function AllBaseTokenHoldings({
  needsWalletConnection,
  onConnectWallet,
}: {
  needsWalletConnection: boolean;
  onConnectWallet: () => void;
}) {
  const { holdings, isLoading, error, hasWallet, tokenListCount } = useAllBaseTokenBalances();

  return (
    <div className="space-y-6 rounded-2xl border border-dashed border-[#E6E3D3]/20 bg-[#151c16]/80 p-6 shadow-[0_10px_40px_rgba(215,191,117,0.06)] sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-semibold tracking-wider text-[#D0B264]">All tokens on Base</h2>
      </div>
      <p className="text-sm text-[#DCDDCC]/70">
        ERC20 balances for your wallet on Base mainnet (via QuickNode RPC). Includes common tokens
        and platform tokens.
      </p>

      {needsWalletConnection ? (
        <div className="space-y-2 py-12 text-center text-[#DCDDCC]/70">
          <p className="mb-2">Connect your wallet to see all Base token balances</p>
          <Button
            onClick={onConnectWallet}
            className="mt-4 bg-[#D7BF75] px-4 font-semibold text-black hover:bg-[#D7BF75]/80"
          >
            Connect Wallet
          </Button>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#DCDDCC]/70">
          <Loader2 className="h-8 w-8 animate-spin text-[#D0B264]" />
          <p className="mt-3 text-sm">Loading Base token balances...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          Failed to load Base token balances. Please try again later.
        </div>
      ) : holdings.length === 0 ? (
        <div className="space-y-2 py-12 text-center text-[#DCDDCC]/70">
          <p className="mb-2">No ERC20 token balances on Base</p>
          <p className="text-sm">
            We checked {tokenListCount} token(s) on Base mainnet. Your wallet has no balance for any
            of them.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {holdings.map((h) => (
            <a
              key={h.contractAddress}
              href={`https://basescan.org/token/${h.contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl border border-[#E6E3D3]/20 bg-[#0f1410]/60 p-4 transition-colors hover:border-[#D7BF75]/40 hover:bg-[#0f1410]/80"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[#DCDDCC]">
                  {h.symbol}
                  <span className="ml-1.5 text-xs font-normal text-[#DCDDCC]/60">{h.name}</span>
                </p>
                <p className="mt-0.5 text-sm text-[#D7BF75]">
                  {parseFloat(h.balance).toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                    minimumFractionDigits: 0,
                  })}{' '}
                  {h.symbol}
                </p>
                <p className="mt-1 font-mono text-xs text-[#DCDDCC]/50" title={h.contractAddress}>
                  {h.contractAddress.slice(0, 6)}…{h.contractAddress.slice(-4)}
                </p>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-[#D7BF75]/60" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

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
        const top = Math.max(
          0,
          Math.round(rect.bottom + BOTTOM_RULE_HEIGHT + BAND_HEIGHT + TITLE_CLEARANCE),
        );
        const mobile = window.innerWidth <= 768;
        // Defer state updates so they don't interrupt Suspense hydration (avoids
        // "Offscreen Fiber child in a hydrated Suspense boundary" error)
        startTransition(() => {
          setContentTop(top);
          setIsMobile(mobile);
        });
      } else {
        startTransition(() => setIsMobile(window.innerWidth <= 768));
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

  const authLoading = !authReady || isLoading;

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
          {authLoading ? (
            <ProfileContentSkeleton />
          ) : (
            <>
              {hasBackendError && (
                <div className="rounded-xl border border-yellow-600/50 bg-yellow-900/20 p-3 text-sm text-yellow-200">
                  ⚠️ Connection to backend is limited. Some features may not be available. Your
                  wallet is connected and you can still trade.
                </div>
              )}

              {needsWalletConnection && (
                <div className="flex flex-col gap-4 rounded-2xl border border-[#D7BF75]/40 bg-gradient-to-br from-[#D7BF75]/15 to-[#C9AE6A]/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2 text-sm text-[#DCDDCC]/85 sm:pr-4">
                    <h3 className="text-lg font-bold text-[#D7BF75]">Connect your wallet</h3>
                    <p>
                      You must connect a wallet to view your portfolio, bids, listings, and offers.
                    </p>
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

              <ErrorBoundary fallback={TokenHoldingsFallback}>
                <ProfileTokenHoldings
                  needsWalletConnection={needsWalletConnection}
                  onConnectWallet={connectWallet}
                />
              </ErrorBoundary>

              <AllBaseTokenHoldings
                needsWalletConnection={needsWalletConnection}
                onConnectWallet={connectWallet}
              />
            </>
          )}
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
