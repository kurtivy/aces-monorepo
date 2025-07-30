'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { HorizontalProfileHeader } from '@/components/profile/horizontal-profile-header';
import { TokenListTab } from '@/components/profile/token-list-tab';
import { BidsTab } from '@/components/profile/bids-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Footer from '@/components/ui/custom/footer';
import { SellerDashboardOverlay } from '@/components/profile/seller-dashboard-overlay';
import { useState } from 'react';
import { AdminDashboardOverlay } from '@/components/profile/admin-dashboard-overlay';
import AnimatedDotsBackground from '@/components/ui/custom/animated-dots-background';
import LuxuryAssetsBackground from '@/components/ui/custom/luxury-assets-background';
import AcesHeader from '@/components/ui/custom/aces-header';

export default function ProfilePage() {
  const { user, isLoading, error, updateProfile, walletAddress } = useAuth();
  const [isSellerDashboardOpen, setIsSellerDashboardOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black">
        <AcesHeader />
        <div className="p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-24 bg-[#231F20] rounded-xl border border-[#D0B284]/10" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="h-64 bg-[#231F20] rounded-xl border border-[#D0B284]/10" />
              <div className="md:col-span-2 h-64 bg-[#231F20] rounded-xl border border-[#D0B284]/10" />
            </div>
          </div>
        </div>
        <Footer />
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
            <p className="text-[#DCDDCC]">{error}</p>
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

  const handleSellerDashboard = () => {
    setIsSellerDashboardOpen(true);
  };

  const handleAdminDashboard = () => {
    setIsAdminDashboardOpen(true);
  };

  const profileData = {
    displayName: user?.displayName || undefined,
    email: user?.email || undefined,
    walletAddress: walletAddress || undefined,
    role: user?.role || undefined,
    sellerStatus: user?.sellerStatus || undefined,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-[#231F20] relative">
      {/* Header Component - Fixed at top with z-50 */}
      <div className="relative z-50">
        <AcesHeader />
      </div>

      {/* Animated Dots Background - Full screen, outside of scroll container */}
      <AnimatedDotsBackground
        opacity={0.18}
        dotSpacing={40}
        dotSize={1.2}
        animationSpeed={0.6}
        waveType="radial"
        minOpacity={0.06}
        className="absolute inset-0 z-0"
      />

      {/* Subtle radial gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(26, 26, 26, 0) 0%, rgba(0, 0, 0, 0.3) 100%)',
        }}
      />

      {/* Main Content Container - Fixed height with overflow hidden */}
      <div className="relative overflow-hidden" style={{ height: '800px' }}>
        {/* Background System - Static background that doesn't scroll */}
        <div className="absolute inset-0 z-0">
          <LuxuryAssetsBackground opacity={0.8} className="z-0" />
        </div>

        {/* Profile Content Layer - Scrollable within fixed container */}
        <div className="relative z-10 h-full overflow-y-auto">
          <div className="p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Horizontal Profile Header */}
              <HorizontalProfileHeader
                user={profileData}
                onUpdateEmail={handleUpdateEmail}
                onSellerDashboardClick={handleSellerDashboard}
                onAdminDashboardClick={handleAdminDashboard}
              />

              {/* Main Content - Full Width Tabs */}
              <div className="w-full">
                <div className="flex justify-start mb-6">
                  <Tabs defaultValue="tokens" className="w-full">
                    <TabsList className="bg-transparent border-none p-0 h-auto space-x-8">
                      <TabsTrigger
                        value="tokens"
                        className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-[#D0B284]"
                      >
                        Tokens
                      </TabsTrigger>
                      <TabsTrigger
                        value="bids"
                        className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-[#D0B284]"
                      >
                        Bids
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="tokens" className="mt-6 w-full">
                      <TokenListTab />
                    </TabsContent>
                    <TabsContent value="bids" className="mt-6 w-full">
                      <BidsTab />
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seller Dashboard Overlay */}
      <SellerDashboardOverlay
        isOpen={isSellerDashboardOpen}
        onClose={() => setIsSellerDashboardOpen(false)}
      />
      {/* Admin Dashboard Overlay */}
      <AdminDashboardOverlay
        isOpen={isAdminDashboardOpen}
        onClose={() => setIsAdminDashboardOpen(false)}
      />

      {/* Footer Component - Below main container with z-50 */}
      <div className="relative z-50">
        <Footer />
      </div>
    </div>
  );
}
