'use client';

import { forwardRef } from 'react';
import AssetAboutDetails from '@/components/rwa/middle-column/product/asset-about-details';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface MobileAssetDetailsSectionProps {
  listing: DatabaseListing;
}

const MobileAssetDetailsSection = forwardRef<HTMLDivElement, MobileAssetDetailsSectionProps>(
  ({ listing }, ref) => (
    <section
      ref={ref}
      data-section-id="details"
      className="w-full bg-[#151c16] border-t border-[#D0B284]/20 px-4 py-6"
    >
      <div className="space-y-4">
        <h2 className="text-[#D0B284] text-xl font-bold">Asset Details</h2>
        <div className="bg-[#151c16] rounded-lg border border-[#D0B284]/15">
          <AssetAboutDetails description={listing.description} assetDetails={listing.assetDetails} />
        </div>
      </div>
    </section>
  ),
);

MobileAssetDetailsSection.displayName = 'MobileAssetDetailsSection';

export default MobileAssetDetailsSection;
