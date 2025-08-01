'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import SeesawAnimation from '@/components/rwa/left-column/token-details/seesaw-animation';
import ProductHeroLocation from '@/components/rwa/left-column/product/product-hero-location';
import type { ActiveSectionContentProps } from '../../../types/rwa/section.types';
import { mockImages } from '../../../constants/rwa';
import BondingCurveChart from './overview/bonding-curve-chart';

export function ActiveSectionContent({
  sectionIndex,
  selectedImageIndex,
  setSelectedImageIndex,
}: ActiveSectionContentProps) {
  const content = [
    // Overview
    <div key="overview" className="h-full flex flex-col space-y-3 overflow-hidden">
      {/* Bonding Curve Chart */}
      <div className="flex-1 rounded-lg border-dashed p-3 min-h-0">
        <BondingCurveChart />
      </div>

      {/* Image Thumbnails */}
      <div className="flex-shrink-0 p-3">
        <h4 className="text-[#D0B284] text-xs font-bold mb-2 tracking-wider">GALLERY</h4>
        <div className="grid grid-cols-4 gap-1.5">
          {mockImages.map((image, index) => (
            <div
              key={image.id}
              className={cn(
                'aspect-square  rounded border transition-all duration-200 overflow-hidden cursor-pointer',
                selectedImageIndex === index
                  ? 'border-[#D0B284] ring-2 ring-[#D0B284]/50'
                  : 'border-[#D0B284]/20 hover:border-[#D0B284]',
              )}
              onClick={() => setSelectedImageIndex(index)}
            >
              {/* Show actual image thumbnails for the first 4, numbers for the rest */}
              {index < 4 ? (
                <Image
                  src={image.thumbnail || '/placeholder.svg'}
                  alt={image.alt}
                  width={100}
                  height={100}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#D0B284] font-bold text-sm">
                  {index + 1}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>,

    // Token Details - Compact version
    <div key="token-details" className="h-full flex flex-col space-y-3 overflow-hidden ">
      <div className="flex-1 min-h-0">
        <SeesawAnimation />
      </div>
    </div>,

    // Product Manifesto - Ensure it fits in smaller space
    <div key="manifesto" className="h-full overflow-hidden">
      <ProductHeroLocation />
    </div>,

    // Place Bids - Compact version
    <div key="place-bids" className="h-full flex flex-col space-y-3 p-4 overflow-hidden bg-black">
      {/* Bidding Details */}
      <div className="flex-1 space-y-2 min-h-0 overflow-y-auto">
        <h4 className="text-[#D0B284] text-xs font-bold mb-2 tracking-wider">BIDDING</h4>

        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-3">
            <span className="text-[#DCDDCC] text-xs font-medium">Current High Bid:</span>
            <span className="text-white text-xs font-semibold">$45,200</span>
          </div>
        </div>
      </div>
    </div>,

    // Chats - Compact version
    <div key="chats" className="h-full flex flex-col space-y-3 p-4 overflow-hidden bg-black">
      {/* Community Stats */}
      <div className="flex-1 space-y-2 min-h-0 overflow-y-auto">
        <h4 className="text-[#D0B284] text-xs font-bold mb-2 tracking-wider">COMMUNITY</h4>

        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-3">
            <span className="text-[#DCDDCC] text-xs font-medium">Active Members:</span>
            <span className="text-white text-xs font-semibold">1,247</span>
          </div>
        </div>

        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-3">
            <span className="text-[#DCDDCC] text-xs font-medium">Total Comments:</span>
            <span className="text-white text-xs font-semibold">3,891</span>
          </div>
        </div>
      </div>
    </div>,
  ];

  return content[sectionIndex];
}
