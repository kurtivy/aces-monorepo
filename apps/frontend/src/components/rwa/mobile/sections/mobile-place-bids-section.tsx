'use client';

import { forwardRef, useState } from 'react';
import { PlaceBidsInterfaceV2 } from '@/components/rwa/middle-column-v2/place-bids-interface';
import { AssetAboutDetailsV2 } from '@/components/rwa/middle-column-v2/asset-about-details';
import { Button } from '@/components/ui/button';
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
    const [isTermsOpen, setIsTermsOpen] = useState(false);

    const handleOpenTerms = () => setIsTermsOpen(true);
    const handleCloseTerms = () => setIsTermsOpen(false);

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
        className="relative w-full bg-[#151c16] border-t border-[#D0B284]/20 px-4 py-6 pb-36"
      >
        <div className="space-y-6">
          <div>
            <h2 className="text-[#D0B284] text-xl font-bold uppercase tracking-widest">Auction</h2>
            <p className="text-sm text-[#D0B284]/70 font-proxima-nova tracking-wide">
              Submit your bid and review the asset overview.
            </p>
          </div>

          <div className="rounded-lg border border-[#D0B284]/15 bg-[#151c16] shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
            <PlaceBidsInterfaceV2
              listingId={listing.id}
              itemTitle={listing.title}
              itemImage={listing.imageGallery?.[0] ?? ''}
              tokenAddress={listing.token?.contractAddress ?? listing.symbol}
              retailPrice={
                listing.token?.currentPriceACES
                  ? Number.parseFloat(listing.token.currentPriceACES)
                  : 47000
              }
              startingBidPrice={
                listing.startingBidPrice ? Number.parseFloat(listing.startingBidPrice) : undefined
              }
              isLive={isLive}
              isOwner={Boolean(user && user.id === listing.ownerId)}
              onBidPlaced={() => {
                // Placeholder callback; can be connected to toast/refresh later
              }}
              variant="mobile"
              onOpenTerms={handleOpenTerms}
            />
          </div>

          <div className="rounded-lg border border-[#D0B284]/15 bg-[#151c16]/80">
            <AssetAboutDetailsV2
              title={listing.title}
              description={listing.description}
              listing={listing}
            />
          </div>
        </div>

        {isTermsOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={handleCloseTerms}
          >
            <div
              className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-black/10 bg-black/40 p-6 shadow-[0_10px_25px_rgba(0,0,0,0.2)] text-white"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-terms-heading"
            >
              <span className="absolute top-2 left-2 h-2 w-2 rounded-full bg-[#D0B284]/80" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#D0B284]/80" />
              <span className="absolute bottom-2 left-2 h-2 w-2 rounded-full bg-[#D0B284]/80" />
              <span className="absolute bottom-2 right-2 h-2 w-2 rounded-full bg-[#D0B284]/80" />

              <h3
                id="mobile-terms-heading"
                className="text-xl font-neue-world uppercase tracking-[0.35em] text-[#D0B284]"
              >
                Terms & Conditions
              </h3>

              <div className="mt-4 space-y-4 text-sm font-proxima-nova leading-relaxed text-[#DCDDCC] max-h-[45vh] overflow-y-auto pr-1">
                <p>
                  By placing a bid you acknowledge that your offer is binding and subject to the
                  platform&apos;s auction policies. Winning bids will be executed in accordance with
                  the listing terms, settlement timelines, and any applicable legal requirements for
                  the underlying asset.
                </p>
                <p>
                  You confirm that you are authorized to participate in this auction, that you have
                  completed all necessary compliance checks, and that the funds required to settle
                  the transaction are available. All bids are final and may not be withdrawn once
                  submitted.
                </p>
                <p>
                  Additional documentation, disclosures, or jurisdiction-specific requirements may
                  apply. Please review the asset documentation and consult your advisors before
                  submitting a bid.
                </p>
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  variant="outline"
                  className="border-[#D0B284]/40 text-[#D0B284] hover:bg-[#D0B284]/10"
                  onClick={handleCloseTerms}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    );
  },
);

MobilePlaceBidsSection.displayName = 'MobilePlaceBidsSection';

export default MobilePlaceBidsSection;
