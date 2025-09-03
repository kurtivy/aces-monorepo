'use client';

import React, { useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import {
  addWindowEventListenerSafe,
  removeWindowEventListenerSafe,
} from '../../../lib/utils/event-listener-utils';
import { getBackdropFilterCSS } from '../../../lib/utils/browser-utils';
import Image from 'next/image';

interface AcesOfBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AcesOfBaseModal({ isOpen, onClose }: AcesOfBaseModalProps) {
  const [backdropStyles, setBackdropStyles] = React.useState<{
    backdropFilter?: string;
    WebkitBackdropFilter?: string;
    background?: string;
    boxShadow?: string;
  }>({
    background: 'rgba(0, 0, 0, 0.7)',
  });

  // Stable onClose callback
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const stableOnClose = useCallback(() => {
    try {
      onCloseRef.current();
    } catch (error) {
      // Modal close error - continue silently
    }
  }, []);

  // Client-side backdrop detection
  React.useEffect(() => {
    const clientBackdropStyles = getBackdropFilterCSS('xl');
    setBackdropStyles(clientBackdropStyles);
  }, []);

  // Escape key handler
  React.useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: Event) => {
      const keyboardEvent = e as KeyboardEvent;
      if (keyboardEvent.key === 'Escape') {
        stableOnClose();
      }
    };

    const keydownListenerResult = addWindowEventListenerSafe('keydown', handleEscape);

    return () => {
      if (keydownListenerResult.success) {
        removeWindowEventListenerSafe('keydown', handleEscape);
      }
    };
  }, [isOpen, stableOnClose]);

  const handleClose = () => {
    stableOnClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          backgroundColor: backdropStyles.background || 'rgba(0, 0, 0, 0.7)',
          backdropFilter: backdropStyles.backdropFilter,
          WebkitBackdropFilter: backdropStyles.WebkitBackdropFilter,
          boxShadow: backdropStyles.boxShadow,
        }}
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.98, opacity: 0 }}
          transition={{
            duration: 0.15,
            ease: 'easeOut',
            scale: {
              duration: typeof window !== 'undefined' && window.innerWidth < 768 ? 0 : 0.15,
            },
          }}
          className="bg-black rounded-2xl sm:rounded-3xl overflow-hidden max-w-full w-auto shadow-goldGlow border border-[#D0B264]/40"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Content */}
          <div className="p-4">
            <div className="flex justify-center">
              <div className="relative">
                <Image
                  src="/png/aces-of-base.png"
                  alt="ACES of Base - Luxury on Base"
                  className="h-auto rounded-lg shadow-lg"
                  style={{
                    width: '280px', // Standard playing card width
                    height: 'auto', // Maintain aspect ratio
                  }}
                  width={280}
                  height={408} // Calculated to maintain 1311:1911 aspect ratio
                />
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
