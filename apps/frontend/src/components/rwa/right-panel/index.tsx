'use client';

import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import DynamicImageGallery from '../left-column/overview/dynamic-image-gallery';
import SwapBox from './swap-box';
import type { DatabaseListing } from '@/types/rwa/section.types';
import { validateEthereumAddress } from '@/lib/validation/address';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface RightPanelProps {
  listing: DatabaseListing;
  selectedImageIndex: number;
  onSelectImage: Dispatch<SetStateAction<number>>;
  loading?: boolean;
}

export default function RightPanel({
  listing,
  selectedImageIndex,
  onSelectImage,
  loading = false,
}: RightPanelProps) {
  // Lift transaction status state to show toast at top of right panel
  const [transactionStatus, setTransactionStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Auto-dismiss transaction status after 5 seconds
  useEffect(() => {
    if (!transactionStatus) return;
    const timeout = setTimeout(() => setTransactionStatus(null), 5000);
    return () => clearTimeout(timeout);
  }, [transactionStatus]);
  const tokenSymbol = listing.token?.symbol || listing.symbol || 'RWA';
  // Validate token address format (must be 40-char Ethereum address)
  const tokenAddress = validateEthereumAddress(listing.token?.contractAddress);
  const tokenName = listing.token?.name || listing.title;
  const chainId = listing.token?.chainId;
  const images = listing.imageGallery ?? [];

  // Transform image gallery URLs into ImageData format
  const displayImages =
    listing.imageGallery?.map((url, index) => ({
      id: index + 1,
      src: url,
      thumbnail: url,
      alt: `${listing.title || tokenName} - Image ${index + 1}`,
    })) ?? [];

  return (
    <div className="h-full w-full bg-[#151c16] flex flex-col gap-1 relative md:scale-[0.75] md:origin-top-right lg:scale-100 lg:origin-center">
      {/* Toast notifications at top of right panel */}
      <AnimatePresence>
        {transactionStatus && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="absolute top-4 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 px-4"
            style={{ pointerEvents: 'auto' }}
          >
            <div
              className={cn(
                'flex-1 rounded-xl border px-4 py-3 text-sm shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur-md',
                transactionStatus.type === 'success'
                  ? 'bg-green-900/80 border-green-500/30 text-green-100'
                  : 'bg-red-900/80 border-red-600/40 text-red-100',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="leading-snug">{transactionStatus.message}</span>
                <button
                  onClick={() => setTransactionStatus(null)}
                  className="text-xs font-semibold uppercase tracking-wide opacity-80 transition-opacity hover:opacity-100"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top: Progress */}
      <div className="px-2 md:px-1.5">
        {/* <BondingProgressSection
          tokenAddress={tokenAddress}
          chainId={chainId}
          tokenSymbol={tokenSymbol}
        /> */}

        {/* Image Gallery */}
        <DynamicImageGallery
          images={displayImages}
          selectedImageIndex={selectedImageIndex}
          onImageSelect={onSelectImage}
          loading={loading}
        />
      </div>

      {/* Bottom: Swap */}
      <div className="px-0.5 md:px-0">
        <SwapBox
          tokenSymbol={tokenSymbol}
          tokenAddress={tokenAddress}
          tokenName={tokenName}
          primaryImage={images?.[0] ?? undefined}
          imageGallery={images}
          chainId={chainId}
          // Hide internal headers/progression inside the swap component
          showProgression={false}
          showHeader={false}
          showFrame={true}
          // Pass transaction status state for error notifications
          transactionStatus={transactionStatus}
          onTransactionStatusChange={setTransactionStatus}
        />
      </div>
    </div>
  );
}
