'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Zap, X } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useChainSwitching, SUPPORTED_CHAINS } from '@/hooks/contracts/use-chain-switching';

export default function NetworkBanner() {
  const { walletAddress } = useAuth();
  const { isOnBaseMainnet, isSwitching, switchToChain } = useChainSwitching();
  const [isDismissed, setIsDismissed] = useState(false);

  // Debug logging (remove in production)
  // useEffect(() => {
  //   console.log('NetworkBanner debug:', {
  //     user: !!user,
  //     walletAddress: !!walletAddress,
  //     isOnBaseMainnet,
  //     isDismissed,
  //     shouldShow: walletAddress && !isOnBaseMainnet && !isDismissed,
  //   });
  // }, [user, walletAddress, isOnBaseMainnet, isDismissed]);

  // Only show if wallet is connected, is NOT on Base mainnet, and hasn't dismissed
  const shouldShow = walletAddress && !isOnBaseMainnet && !isDismissed;

  const handleSwitchNetwork = async () => {
    try {
      await switchToChain(SUPPORTED_CHAINS.BASE_MAINNET);
    } catch (error) {
      console.error('Failed to switch to Base mainnet:', error);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  if (!shouldShow) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -100, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -100, scale: 0.95 }}
        transition={{ type: 'spring', duration: 0.5, ease: [0.23, 1, 0.32, 1], delay: 0.5 }}
        className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[60] max-w-md mx-auto"
      >
        <div className="bg-gradient-to-r from-orange-900/40 via-orange-800/30 to-orange-900/40 backdrop-blur-md border border-orange-500/40 rounded-xl shadow-2xl shadow-orange-900/20 px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left side - Icon and message */}
            <div className="flex items-center space-x-2">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white">
                  Switch to <span className="font-semibold text-[#D0B264]">Base Mainnet</span> for
                  best experience
                </p>
              </div>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center space-x-2 ml-3">
              {/* Switch Network Button */}
              <motion.button
                onClick={handleSwitchNetwork}
                disabled={isSwitching}
                className="flex items-center space-x-1 bg-[#D0B264] hover:bg-[#D0B264]/90 text-black font-medium py-1.5 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                whileHover={!isSwitching ? { scale: 1.02 } : undefined}
                whileTap={!isSwitching ? { scale: 0.98 } : undefined}
              >
                {isSwitching ? (
                  <>
                    <div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    <span>Switching...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3 h-3" />
                    <span>Switch</span>
                  </>
                )}
              </motion.button>

              {/* Dismiss Button */}
              <motion.button
                onClick={handleDismiss}
                className="flex-shrink-0 text-gray-400 hover:text-white transition-colors p-1"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                disabled={isSwitching}
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
