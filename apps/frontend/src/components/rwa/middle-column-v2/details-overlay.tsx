'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, X } from 'lucide-react';
import { AssetAboutDetailsV2 } from './asset-about-details';
import { PlaceBidsInterfaceV2 } from './place-bids-interface';
import { DatabaseListing } from '@/types/rwa/section.types';

interface DetailsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  listing: DatabaseListing;
  isLive: boolean;
  isOwner: boolean;
}

export function DetailsOverlay({ isOpen, onClose, listing, isLive, isOwner }: DetailsOverlayProps) {
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
          {/* Header with Back and Close buttons */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-[#D0B284]/20">
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-[#D0B284] hover:text-white transition-colors font-spray-letters uppercase tracking-wider"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-semibold">Back</span>
            </button>
            <button
              onClick={onClose}
              className="text-[#D0B284] hover:text-white transition-colors"
              aria-label="Close overlay"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-2 pt-2">
              {/* Asset Details */}
              <AssetAboutDetailsV2
                title={listing.title}
                description={listing.description}
                images={listing.imageGallery}
              />

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
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
