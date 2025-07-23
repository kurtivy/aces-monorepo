'use client';

import { X, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnalyticsTab } from './admin/analytics-tab';
import { SubmissionsTab } from './admin/submissions-tab';
import { VerificationsTab } from './admin/verifications-tab';
import { AdminListingsTab } from './admin/admin-listings-tab';
import { AdminBidsTab } from './admin/admin-bids-tab';
import { EscrowTab } from './admin/escrow-tab';
import { SellersTab } from './admin/sellers-tab';

interface AdminDashboardOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminDashboardOverlay({ isOpen, onClose }: AdminDashboardOverlayProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div
        className={`absolute top-0 right-0 h-full w-full bg-black transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-purple-400/20">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-purple-400 hover:bg-purple-400/10"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Profile
              </Button>
              <h1 className="text-2xl font-bold text-purple-400 font-libre-caslon">
                Admin Dashboard
              </h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-[#DCDDCC] hover:bg-purple-400/10"
            >
              <X className="w-5 h-5" />
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
                <AdminBidsTab />
              </TabsContent>
              <TabsContent value="escrow" className="mt-6 w-full">
                <EscrowTab />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
