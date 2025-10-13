'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { AssetAboutDetailsV2 } from './asset-about-details';
import { PlaceBidsInterfaceV2 } from './place-bids-interface';
import { Button } from '@/components/ui/button';
import { DatabaseListing } from '@/types/rwa/section.types';

interface DetailsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  listing: DatabaseListing;
  isLive: boolean;
  isOwner: boolean;
}

export function DetailsOverlay({ isOpen, onClose, listing, isLive, isOwner }: DetailsOverlayProps) {
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  const handleCloseTerms = () => setIsTermsOpen(false);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          className="absolute inset-0 bg-[#151c16] z-50 flex flex-col"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {/* Scrollable Content */}
          <div className="flex-1">
            <div className="">
              <div className="flex flex-col lg:flex-row lg:items-stretch">
                <div className="w-full lg:w-2/5 lg:flex lg:flex-col">
                  {/* Place Bids */}
                  <PlaceBidsInterfaceV2
                    listingId={listing.id}
                    itemTitle={listing.title}
                    itemImage={listing.imageGallery?.[0] || ''}
                    tokenAddress={listing.token?.contractAddress || listing.symbol}
                    retailPrice={
                      listing.token?.currentPriceACES
                        ? parseFloat(listing.token.currentPriceACES)
                        : 47000
                    }
                    startingBidPrice={
                      listing.startingBidPrice ? parseFloat(listing.startingBidPrice) : undefined
                    }
                    isLive={isLive}
                    isOwner={isOwner}
                    onBidPlaced={(bid) => console.log('Bid placed:', bid)}
                    onOpenTerms={() => setIsTermsOpen(true)}
                  />
                </div>
                <div className="w-full lg:w-3/5 lg:self-stretch lg:border-l lg:border-[#D0B284]/15">
                  {/* Asset Details */}
                  <AssetAboutDetailsV2
                    title={listing.title}
                    description={listing.description}
                    onClose={onClose}
                    listing={listing}
                  />
                </div>
              </div>
            </div>
          </div>

          {isTermsOpen ? (
            <div
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
              onClick={handleCloseTerms}
            >
              <div
                className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-black/10 bg-black/40 p-6 shadow-[0_10px_25px_rgba(0,0,0,0.2)] text-white"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="terms-heading"
              >
                <span className="absolute top-2 left-2 h-2 w-2 rounded-full bg-[#D0B284]/80" />
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#D0B284]/80" />
                <span className="absolute bottom-2 left-2 h-2 w-2 rounded-full bg-[#D0B284]/80" />
                <span className="absolute bottom-2 right-2 h-2 w-2 rounded-full bg-[#D0B284]/80" />

                <h3
                  id="terms-heading"
                  className="text-xl font-neue-world uppercase tracking-[0.35em] text-[#D0B284]"
                >
                  Terms & Conditions
                </h3>

                <div className="mt-4 space-y-4 text-sm font-proxima-nova leading-relaxed text-[#DCDDCC] max-h-[45vh] overflow-y-auto pr-1">
                  <p>
                    By placing a bid you acknowledge that your offer is binding and subject to the
                    platform&apos;s auction policies. Winning bids will be executed in accordance
                    with the listing terms, settlement timelines, and any applicable legal
                    requirements for the underlying asset.
                  </p>
                  <p>
                    You confirm that you are authorized to participate in this auction, that you
                    have completed all necessary compliance checks, and that the funds required to
                    settle the transaction are available. All bids are final and may not be
                    withdrawn once submitted.
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
