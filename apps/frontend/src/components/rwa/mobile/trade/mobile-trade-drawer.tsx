'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import TokenSwapInterface from '@/components/rwa/token-swap-interface';
import type { DatabaseListing } from '@/types/rwa/section.types';
import { NETWORK_CONFIG } from '@/lib/contracts/addresses';

interface MobileTradeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  listing: DatabaseListing;
}

export default function MobileTradeDrawer({ isOpen, onClose, listing }: MobileTradeDrawerProps) {
  const NAV_OFFSET_PX = 88;
  const bottomOffset = `calc(${NAV_OFFSET_PX}px + env(safe-area-inset-bottom, 0px))`;
  const tokenChainId = listing.token?.chainId ?? NETWORK_CONFIG.DEFAULT_CHAIN_ID;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed top-0 left-0 right-0 z-40 bg-black/50"
            style={{ bottom: bottomOffset }}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            className="fixed left-0 right-0 z-50 max-h-[78vh] overflow-hidden rounded-t-2xl border-t border-[#D0B284]/20 bg-[#151c16] shadow-2xl"
            style={{ bottom: bottomOffset }}
          >
            <div className="flex items-center justify-between border-b border-[#D0B284]/20 p-4">
              <h3 className="text-lg font-bold text-[#D0B284]">
                Trade ${listing.token?.symbol ?? listing.symbol}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 transition-colors hover:bg-[#D0B284]/10"
                aria-label="Close trade drawer"
              >
                <X className="h-5 w-5 text-[#D0B284]" />
              </button>
            </div>

            <div className="max-h-[calc(78vh-70px)] overflow-y-auto scrollbar-hide px-4 pb-6 pt-4">
              <TokenSwapInterface
                tokenSymbol={listing.token?.symbol ?? listing.symbol}
                tokenPrice={listing.token?.currentPriceACES ? Number.parseFloat(listing.token.currentPriceACES) : 0.000268}
                userBalance={1.2547}
                tokenAddress={listing.token?.contractAddress}
                tokenName={listing.token?.name ?? listing.title}
                primaryImage={listing.imageGallery?.[0]}
                imageGallery={listing.imageGallery}
                showFrame={false}
                showProgression={false}
                chainId={tokenChainId}
                dexMeta={listing.dex ?? null}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
