'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface TopLoadingBarProps {
  onLoadingComplete: () => void;
  loadingProgress: number; // Real progress from image loader (0-100)
  isComplete: boolean; // When all loading is actually complete
}

const TopLoadingBar: React.FC<TopLoadingBarProps> = ({
  onLoadingComplete,
  loadingProgress,
  isComplete,
}) => {
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    // When loading is complete, trigger immediate callback (no delay needed)
    if (isComplete && !isAnimatingOut) {
      setIsAnimatingOut(true);
      onLoadingComplete(); // Call immediately - canvas is ready!
    }
  }, [isComplete, isAnimatingOut, onLoadingComplete, loadingProgress]);

  return (
    <motion.div
      data-testid="top-loading-bar"
      className="fixed top-0 left-0 right-0 z-[70]"
      initial={{ opacity: 1 }}
      animate={{ opacity: isAnimatingOut ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 4.0, ease: 'easeOut' }} // Increased to 4s for reliable test detection
    >
      {/* Loading bar background */}
      <div className="w-full h-1 bg-black/20 backdrop-blur-sm">
        <motion.div
          className="h-full bg-gradient-to-r from-[#D0B264] via-[#D7BF75] to-[#D0B264] relative overflow-hidden"
          initial={{ width: '0%' }}
          animate={{ width: `${loadingProgress}%` }}
          transition={{
            duration: 0.3,
            ease: 'easeOut',
            type: 'tween',
          }}
        >
          {/* Animated shine effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            animate={{ x: ['-100%', '100%'] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default TopLoadingBar;
