'use client';

import { forwardRef } from 'react';
import PlaceBidsInterface from '@/components/rwa/middle-column/bids/place-bids-interface';
import { useAuth } from '@/lib/auth/auth-context';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface MobilePlaceBidsSectionProps {
  listing: DatabaseListing;
  isLive: boolean;
  isLaunched: boolean;
}

const MobilePlaceBidsSection = forwardRef<HTMLDivElement, MobilePlaceBidsSectionProps>(
  ({ listing, isLive, isLaunched }, ref) => {
    const { user } = useAuth();

    if (!isLive || !isLaunched) {
      return (
        <section
          ref={ref}
          data-section-id="bids"
          className="w-full bg-[#151c16] border-t border-[#D0B284]/20 px-4 py-6"
        >
          <div className="text-center py-12 space-y-2">
            <div className="text-[#D0B284] text-xl font-semibold">Place Bids</div>
            <div className="text-gray-400 text-base">Coming Soon</div>
            <div className="text-gray-500 text-sm">
              Bidding will be available when {listing.title} goes live
            </div>
          </div>
        </section>
      );
    }

    return (
      <section
        ref={ref}
        data-section-id="bids"
        className="w-full bg-[#151c16] border-t border-[#D0B284]/20 px-4 py-6 pb-36"
      >
        <div className="space-y-4">
          <h2 className="text-[#D0B284] text-xl font-bold">Place Bids</h2>
          <div className="bg-[#151c16] rounded-lg border border-[#D0B284]/15">
            <PlaceBidsInterface
              listingId={listing.id}
              itemTitle={listing.title}
              itemImage={listing.imageGallery?.[0] ?? ''}
              tokenAddress={listing.token?.contractAddress ?? listing.symbol}
              retailPrice={listing.token?.currentPriceACES ? Number.parseFloat(listing.token.currentPriceACES) : 47000}
              startingBidPrice={
                listing.startingBidPrice ? Number.parseFloat(listing.startingBidPrice) : undefined
              }
              isLive={isLive}
              isOwner={Boolean(user && user.id === listing.ownerId)}
              onBidPlaced={() => {
                // Placeholder callback; can be connected to toast/refresh later
              }}
              variant="mobile"
            />
          </div>
        </div>
      </section>
    );
  },
);

MobilePlaceBidsSection.displayName = 'MobilePlaceBidsSection';

export default MobilePlaceBidsSection;
