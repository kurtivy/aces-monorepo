'use client';

import { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import SwapBox from '@/components/rwa/right-panel/swap-box';
import type { DatabaseListing } from '@/types/rwa/section.types';
import { NETWORK_CONFIG } from '@/lib/contracts/addresses';
import { cn } from '@/lib/utils';

interface MobileTradeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  listing: DatabaseListing;
}

export default function MobileTradeDrawer({ isOpen, onClose, listing }: MobileTradeDrawerProps) {
  const bottomNavHeight = 'var(--mobile-bottom-nav-height, 96px)';
  const bottomOffset = bottomNavHeight;
  const contentRef = useRef<HTMLDivElement>(null);
  const [drawerHeight, setDrawerHeight] = useState<string>('auto');
  const tokenChainId = listing.token?.chainId ?? NETWORK_CONFIG.DEFAULT_CHAIN_ID;
  const [transactionStatus, setTransactionStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Calculate max height based on viewport
  const maxDrawerHeight = `calc(100dvh - ${bottomNavHeight})`;

  // Measure content and adjust drawer height dynamically
  const updateHeight = () => {
    if (!contentRef.current || typeof window === 'undefined') return;

    const contentHeight = contentRef.current.scrollHeight;
    const viewportHeight = window.innerHeight;
    const computedStyle = window.getComputedStyle(document.documentElement);
    const bottomNav = parseInt(
      computedStyle.getPropertyValue('--mobile-bottom-nav-height') || '96',
    );
    const availableHeight = viewportHeight - bottomNav;

    // Use content height if it fits, otherwise use available height
    if (contentHeight < availableHeight) {
      setDrawerHeight(`${contentHeight}px`);
    } else {
      setDrawerHeight(`${availableHeight}px`);
    }
  };

  useEffect(() => {
    if (!isOpen || !contentRef.current || typeof window === 'undefined') return;

    // Initial measurement with delays to ensure content is fully rendered
    // Multiple timeouts handle different content loading scenarios
    const timeoutId1 = setTimeout(updateHeight, 50);
    const timeoutId2 = setTimeout(updateHeight, 200);
    const timeoutId3 = setTimeout(updateHeight, 500);

    // Update on resize and orientation change
    window.addEventListener('resize', updateHeight);
    window.addEventListener('orientationchange', updateHeight);

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
      window.removeEventListener('resize', updateHeight);
      window.removeEventListener('orientationchange', updateHeight);
    };
  }, [isOpen]);

  // Re-measure when transaction status changes (content might have updated)
  useEffect(() => {
    if (isOpen && transactionStatus) {
      // Small delay to allow UI to update
      const timeoutId = setTimeout(updateHeight, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, transactionStatus]);

  useEffect(() => {
    if (!transactionStatus) return;

    const timeout = setTimeout(() => setTransactionStatus(null), 5000);
    return () => clearTimeout(timeout);
  }, [transactionStatus]);

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
            className="fixed left-0 right-0 z-50 overflow-hidden rounded-t-2xl border-t border-[#D0B284]/20 bg-[#151c16] shadow-2xl"
            style={{ 
              bottom: bottomOffset, 
              height: drawerHeight, 
              maxHeight: maxDrawerHeight,
            }}
          >
            <div 
              ref={contentRef}
              className="relative flex flex-col overflow-y-auto scrollbar-hide pb-0 safe-area-pb"
              style={{ maxHeight: maxDrawerHeight }}
            >
              <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#D0B284]/20 bg-[#131a13]/95 p-4 shadow-[0_15px_35px_rgba(0,0,0,0.45)]">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 transition-colors hover:bg-[#D0B284]/10"
                  aria-label="Close trade drawer"
                >
                  <X className="h-5 w-5 text-[#D0B284]" />
                </button>
                <SwapBox
                  tokenSymbol={listing.token?.symbol ?? listing.symbol}
                  tokenAddress={listing.token?.contractAddress}
                  tokenName={listing.token?.name ?? listing.title}
                  primaryImage={listing.imageGallery?.[0]}
                  imageGallery={listing.imageGallery}
                  chainId={tokenChainId}
                  showProgression={false}
                  showHeader={false}
                  showFrame
                  transactionStatus={transactionStatus}
                  onTransactionStatusChange={setTransactionStatus}
                />
              </div>
            </div>

            <AnimatePresence>
              {transactionStatus && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 30 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="pointer-events-none absolute left-1/2 top-[72px] z-50 w-full max-w-xs -translate-x-1/2 px-4"
                >
                  <div
                    className={cn(
                      'rounded-xl border px-4 py-3 text-sm shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur-md',
                      transactionStatus.type === 'success'
                        ? 'bg-green-900/80 border-green-500/30 text-green-100'
                        : 'bg-red-900/80 border-red-600/40 text-red-100',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="leading-snug">{transactionStatus.message}</span>
                      <button
                        type="button"
                        onClick={() => setTransactionStatus(null)}
                        className="pointer-events-auto text-xs font-semibold uppercase tracking-wide opacity-80 transition-opacity hover:opacity-100"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
