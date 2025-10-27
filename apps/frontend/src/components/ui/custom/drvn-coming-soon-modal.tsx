'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Hourglass } from 'lucide-react';

interface DrvnComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DrvnComingSoonModal({ isOpen, onClose }: DrvnComingSoonModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/80 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="max-w-md w-full bg-black rounded-2xl overflow-hidden border border-[#D0B264]/40 shadow-goldGlow">
              <div className="p-6 text-center space-y-4">
                <div className="mx-auto w-14 h-14 rounded-full bg-[#D0B264]/10 flex items-center justify-center">
                  <Hourglass className="w-7 h-7 text-[#D0B264]" />
                </div>
                <h3 className="text-2xl font-semibold text-white">Coming Soon</h3>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
