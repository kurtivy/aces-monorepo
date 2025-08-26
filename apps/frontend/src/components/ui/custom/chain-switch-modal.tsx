'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Zap, X } from 'lucide-react';

interface ChainSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitch: () => void;
  onSkip?: () => void;
  currentChainName?: string;
  targetChainName: string;
  isSwitching?: boolean;
  showSkipOption?: boolean;
}

export default function ChainSwitchModal({
  isOpen,
  onClose,
  onSwitch,
  onSkip,
  currentChainName,
  targetChainName,
  isSwitching = false,
  showSkipOption = true,
}: ChainSwitchModalProps) {
  if (!isOpen) return null;

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={!isSwitching ? onClose : undefined}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className="relative z-10 w-full max-w-md mx-4"
        >
          <div className="bg-black/90 backdrop-blur-xl rounded-xl border border-[#D0B264]/30 p-6 shadow-2xl">
            {/* Close button */}
            {!isSwitching && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                disabled={isSwitching}
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-orange-400" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-white text-center mb-2">
              Switch to {targetChainName}
            </h2>

            {/* Description */}
            <div className="text-gray-300 text-center mb-6 space-y-2">
              <p>
                You're currently connected to{' '}
                <span className="text-orange-400 font-medium">
                  {currentChainName || 'an unsupported network'}
                </span>
                .
              </p>
              <p>
                For the best experience and to use all features, we recommend switching to{' '}
                <span className="text-[#D0B264] font-medium">{targetChainName}</span>.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-col space-y-3">
              {/* Switch button */}
              <motion.button
                onClick={onSwitch}
                disabled={isSwitching}
                className="flex items-center justify-center space-x-2 bg-[#D0B264] hover:bg-[#D0B264]/90 text-black font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={!isSwitching ? { scale: 1.02 } : undefined}
                whileTap={!isSwitching ? { scale: 0.98 } : undefined}
              >
                {isSwitching ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    <span>Switching...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Switch to {targetChainName}</span>
                  </>
                )}
              </motion.button>

              {/* Skip button */}
              {showSkipOption && !isSwitching && (
                <motion.button
                  onClick={handleSkip}
                  className="py-3 px-4 text-gray-400 hover:text-white transition-colors text-sm font-medium"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Continue on {currentChainName || 'current network'}
                </motion.button>
              )}
            </div>

            {/* Additional info */}
            <div className="mt-4 text-xs text-gray-500 text-center">
              <p>You can always switch networks later from your wallet or the network dropdown.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
