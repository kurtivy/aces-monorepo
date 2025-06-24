'use client';

import type React from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import NeonText from './neon-text';

interface IntroAnimationProps {
  onIntroAnimationComplete?: () => void;
  isComplete?: boolean;
  skipLetterAnimation?: boolean;
}

const IntroAnimation: React.FC<IntroAnimationProps> = ({
  onIntroAnimationComplete,
  isComplete = false,
  skipLetterAnimation = false,
}) => {
  const [minimumTimeElapsed, setMinimumTimeElapsed] = useState(false);

  useEffect(() => {
    const minimumTimer = setTimeout(
      () => {
        setMinimumTimeElapsed(true);
      },
      skipLetterAnimation ? 1000 : 4000,
    );

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
      }, 800); // Increased delay to allow for fade-out animation

      return () => clearTimeout(completionTimer);
    }
  }, [isComplete, minimumTimeElapsed, onIntroAnimationComplete]);

  return (
    <AnimatePresence>
      {!(isComplete && minimumTimeElapsed) && (
        <motion.div
          data-testid="intro-animation"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }} // Shorter, smoother fade-out
          className="fixed inset-0 min-h-screen bg-black flex flex-col items-center justify-center overflow-hidden z-50"
        >
          {/* Main content container */}
          <div className="relative flex flex-col items-center justify-center z-20 px-8">
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
