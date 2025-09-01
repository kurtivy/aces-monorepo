'use client';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ListingsTab } from './listings-tab';
import { OffersTab } from './offers-tab';
import { useLayoutEffect, useState } from 'react';

interface SellerDashboardOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SellerDashboardOverlay({ isOpen, onClose }: SellerDashboardOverlayProps) {
  const [profileHeaderHeight, setProfileHeaderHeight] = useState<number>(0);

  useLayoutEffect(() => {
    if (!isOpen) return;

    const measureProfileHeader = () => {
      // Find the horizontal profile header to calculate its height
      const profileHeader = document.querySelector('[data-profile-header]') as HTMLElement;
      if (profileHeader) {
        const rect = profileHeader.getBoundingClientRect();
        setProfileHeaderHeight(rect.height);
      } else {
        // Fallback - estimate based on typical profile header height
        setProfileHeaderHeight(120);
      }
    };

    measureProfileHeader();
    window.addEventListener('resize', measureProfileHeader);
    return () => window.removeEventListener('resize', measureProfileHeader);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm">
      <div
        className={`absolute right-0 h-full w-full bg-[#0A120B] transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          top: `${profileHeaderHeight}px`,
          height: `calc(100% - ${profileHeaderHeight}px)`,
        }}
      >
        {/* Main Content - styled like token-list-tab */}
        <div className="h-full bg-[#0A120B] border border-dashed border-[#D7BF75]/25 relative">
          {/* Corner ticks */}
          <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#D7BF75]" />
          <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#D7BF75]" />
          <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#D7BF75]" />
          <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#D7BF75]" />
          <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#D7BF75]" />
          <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#D7BF75]" />
          <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#D7BF75]" />
          <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#D7BF75]" />

          {/* Close button in top-right */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 text-[#D7BF75] hover:bg-[#D7BF75]/10 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>

          {/* Content */}
          <div className="h-full p-6 overflow-y-auto">
            <Tabs defaultValue="listings" className="w-full h-full">
              {/* Tab selectors */}
              <div className="flex justify-start items-center mb-6 pt-8">
                <TabsList className="bg-transparent border-none p-0 h-auto space-x-8">
                  <TabsTrigger
                    value="listings"
                    className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-[#D7BF75]"
                  >
                    LISTINGS
                  </TabsTrigger>
                  <TabsTrigger
                    value="offers"
                    className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-[#D7BF75]"
                  >
                    OFFERS
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="listings" className="mt-0 w-full h-full">
                <ListingsTab />
              </TabsContent>
              <TabsContent value="offers" className="mt-0 w-full h-full">
                <OffersTab />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
