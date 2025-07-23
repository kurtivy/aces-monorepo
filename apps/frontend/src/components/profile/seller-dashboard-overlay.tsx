'use client';
import { X, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ListingsTab } from './listings-tab';
import { OffersTab } from './offers-tab';

interface SellerDashboardOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SellerDashboardOverlay({ isOpen, onClose }: SellerDashboardOverlayProps) {
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
          <div className="flex items-center justify-between p-6 border-b border-[#D0B284]/20">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-[#D0B284] hover:bg-[#D0B284]/10"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Profile
              </Button>
              <h1 className="text-2xl font-bold text-[#D0B284] font-libre-caslon">
                Seller Dashboard
              </h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-[#DCDDCC] hover:bg-[#D0B284]/10"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            <Tabs defaultValue="listings" className="w-full">
              <TabsList className="bg-transparent border-none p-0 h-auto space-x-8 mb-6">
                <TabsTrigger
                  value="listings"
                  className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-[#D0B284]"
                >
                  Listings
                </TabsTrigger>
                <TabsTrigger
                  value="offers"
                  className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-[#D0B284]"
                >
                  Offers
                </TabsTrigger>
              </TabsList>
              <TabsContent value="listings" className="mt-6 w-full">
                <ListingsTab />
              </TabsContent>
              <TabsContent value="offers" className="mt-6 w-full">
                <OffersTab />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
