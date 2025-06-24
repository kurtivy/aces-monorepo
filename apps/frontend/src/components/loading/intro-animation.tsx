'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

import NeonText from './neon-text';
import LoadingStyles from './loading-styles';

interface IntroAnimationProps {
  onIntroAnimationComplete?: () => void;
  // Add loading progress props to connect to actual website loading
  loadingProgress?: number; // 0-100
  isComplete?: boolean; // When website is fully loaded
  skipLetterAnimation?: boolean; // Skip letter animation for returning users
}

const IntroAnimation: React.FC<IntroAnimationProps> = ({
  onIntroAnimationComplete,
  loadingProgress = 0,
  isComplete = false,
  skipLetterAnimation = false,
}) => {
  const [minimumTimeElapsed, setMinimumTimeElapsed] = useState(false);

  // Minimum display time to ensure animation always completes
  useEffect(() => {
    const minimumTimer = setTimeout(
      () => {
        setMinimumTimeElapsed(true);
      },
      skipLetterAnimation ? 1000 : 4000,
    ); // 1s for skip, 10s for full animation test

    return () => clearTimeout(minimumTimer);
  }, [skipLetterAnimation]);

  // Complete when loading is finished AND minimum time has elapsed
  useEffect(() => {
    if (isComplete && minimumTimeElapsed) {
      // Add a small delay for smooth transition
      const completionTimer = setTimeout(() => {
        if (onIntroAnimationComplete) {
          onIntroAnimationComplete();
        }
      }, 500);

      return () => clearTimeout(completionTimer);
    }
  }, [isComplete, minimumTimeElapsed, onIntroAnimationComplete]);

  // Debug logging
  useEffect(() => {
    // Only log on significant changes to reduce console noise
    if (isComplete || minimumTimeElapsed) {
      console.log(
        'IntroAnimation - Loading Progress:',
        loadingProgress,
        'isComplete:',
        isComplete,
        'minimumTimeElapsed:',
        minimumTimeElapsed,
      );
    }
  }, [loadingProgress, isComplete, minimumTimeElapsed]);

  return (
    <AnimatePresence>
      {!(isComplete && minimumTimeElapsed) && ( // Show until both loading complete AND minimum time elapsed
        <motion.div
          data-testid="intro-animation"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.0 }}
          className="fixed inset-0 min-h-screen bg-black flex flex-col items-center justify-center overflow-hidden z-50"
        >
          <LoadingStyles />

          {/* Main content container */}
          <div className="relative flex flex-col items-center justify-center z-20">
            {/* Only Neon Text */}
            <NeonText
              isComplete={isComplete}
              minimumTimeElapsed={minimumTimeElapsed}
              skipLetterAnimation={skipLetterAnimation}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IntroAnimation;
