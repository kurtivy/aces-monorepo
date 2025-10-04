'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/auth/admin-auth-context';
import { LogOut, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnalyticsTab } from '@/components/profile/admin/analytics-tab';
import { LaunchTab } from '@/components/profile/admin/launch-tab';
import { SubmissionsTab } from '@/components/profile/admin/submissions-tab';
import { VerificationsTab } from '@/components/profile/admin/verifications-tab';
import { AdminListingsTab } from '@/components/profile/admin/admin-listings-tab';
import { BidsTab } from '@/components/profile/admin/bids-tab';
import { SellersTab } from '@/components/profile/admin/sellers-tab';

export default function AdminDashboardPage() {
  const {
    isAuthenticated: isAdminAuthenticated,
    isLoading: isAdminLoading,
    logout: adminLogout,
  } = useAdminAuth();
  const router = useRouter();

  // Check authentication and redirect if necessary
  useEffect(() => {
    console.log('🛡️ Dashboard auth check:', {
      isAdminLoading,
      isAdminAuthenticated,
    });

    if (!isAdminLoading) {
      if (!isAdminAuthenticated) {
        console.log('❌ Dashboard: No admin auth, redirecting to login');
        router.push('/admin/login');
        return;
      }

      console.log('✅ Dashboard: Admin auth verified');
    }
  }, [isAdminAuthenticated, isAdminLoading, router]);

  const handleLogout = async () => {
    await adminLogout();
    router.push('/admin/login');
  };

  // Show loading while checking authentication
  if (isAdminLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-4" />
          <p className="text-[#DCDDCC] font-jetbrains">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Don't render dashboard if not authenticated
  if (!isAdminAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-purple-400/20">
          <div className="flex items-center space-x-4">
            <Shield className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold text-purple-400 font-libre-caslon">
              Admin Dashboard
            </h1>
          </div>
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

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <Tabs defaultValue="analytics" className="w-full">
            <TabsList className="bg-transparent border-none p-0 h-auto space-x-6 mb-6 flex-wrap">
              <TabsTrigger
                value="analytics"
                className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-purple-400"
              >
                Analytics
              </TabsTrigger>
              <TabsTrigger
                value="launch"
                className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-purple-400"
              >
                Launch
              </TabsTrigger>
              <TabsTrigger
                value="sellers"
                className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-purple-400"
              >
                Sellers
              </TabsTrigger>
              <TabsTrigger
                value="submissions"
                className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-purple-400"
              >
                Submissions
              </TabsTrigger>
              <TabsTrigger
                value="verifications"
                className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-purple-400"
              >
                Verifications
              </TabsTrigger>
              <TabsTrigger
                value="listings"
                className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-purple-400"
              >
                Listings
              </TabsTrigger>
              <TabsTrigger
                value="bids"
                className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-purple-400"
              >
                Bids
              </TabsTrigger>
              <TabsTrigger
                value="escrow"
                className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-purple-400"
              >
                Escrow
              </TabsTrigger>
            </TabsList>
            <TabsContent value="analytics" className="mt-6 w-full">
              <AnalyticsTab />
            </TabsContent>
            <TabsContent value="launch" className="mt-6 w-full">
              <LaunchTab />
            </TabsContent>
            <TabsContent value="sellers" className="mt-6 w-full">
              <SellersTab />
            </TabsContent>
            <TabsContent value="submissions" className="mt-6 w-full">
              <SubmissionsTab />
            </TabsContent>
            <TabsContent value="verifications" className="mt-6 w-full">
              <VerificationsTab />
            </TabsContent>
            <TabsContent value="listings" className="mt-6 w-full">
              <AdminListingsTab />
            </TabsContent>
            <TabsContent value="bids" className="mt-6 w-full">
              <BidsTab />
            </TabsContent>
            <TabsContent value="escrow" className="mt-6 w-full">
              <div className="text-center py-16">
                <p className="text-[#DCDDCC] font-jetbrains">Escrow management coming soon...</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
