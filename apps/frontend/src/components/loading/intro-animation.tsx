'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

import NeonLogo from './neon-logo';
import NeonText from './neon-text';
import LoadingStyles from './loading-styles';

interface IntroAnimationProps {
  isComplete: boolean;
}

const IntroAnimation: React.FC<IntroAnimationProps> = ({ isComplete }) => {
  const [showSpinner, setShowSpinner] = useState(false);

  // Show spinner after neon animation completes (around 2-3 seconds)
  useEffect(() => {
    if (!isComplete) {
      const spinnerTimer = setTimeout(() => {
        if (!isComplete) {
          setShowSpinner(true);
        }
      }, 3200); // Show spinner after neon animation (slightly after phase 2 starts)

      return () => clearTimeout(spinnerTimer);
    } else {
      setShowSpinner(false);
    }
  }, [isComplete]);

  return (
    <AnimatePresence>
      {!isComplete && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 min-h-screen bg-black flex flex-col items-center justify-center overflow-hidden z-50"
        >
          <LoadingStyles />

          {/* Main content container */}
          <div className="relative flex flex-col items-center justify-center z-20">
            {/* Neon Logo and Text - Fixed position */}
            <div className="flex flex-col items-center justify-center space-y-8">
              <NeonLogo />
              <NeonText />
            </div>

            {/* Spinner - absolute positioned to not affect layout */}
            <AnimatePresence>
              {showSpinner && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="absolute top-full mt-12 flex flex-col items-center space-y-4"
                >
                  {/* Loading spinner */}
                  <div className="relative">
                    <div className="w-8 h-8 border-2 border-[#D0B264]/30 rounded-full animate-spin">
                      <div className="absolute top-0 left-0 w-8 h-8 border-2 border-transparent border-t-[#D0B264] rounded-full animate-spin"></div>
                    </div>
                    {/* Subtle glow effect */}
                    <div className="absolute inset-0 w-8 h-8 border-2 border-[#D0B264]/20 rounded-full blur-sm animate-spin">
                      <div className="absolute top-0 left-0 w-8 h-8 border-2 border-transparent border-t-[#D0B264]/40 rounded-full animate-spin"></div>
                    </div>
                  </div>

                  {/* Loading text */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    className="text-[#D0B264]/80 text-sm font-syne tracking-wide"
                  >
                    Loading assets...
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IntroAnimation;
