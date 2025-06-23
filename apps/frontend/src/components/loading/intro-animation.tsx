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
}

const IntroAnimation: React.FC<IntroAnimationProps> = ({
  onIntroAnimationComplete,
  loadingProgress = 0,
  isComplete = false,
}) => {
  const [textReady, setTextReady] = useState(false);

  // Complete when text is ready and loading is finished
  useEffect(() => {
    if (textReady && isComplete) {
      // Add a small delay for smooth transition
      const completionTimer = setTimeout(() => {
        if (onIntroAnimationComplete) {
          onIntroAnimationComplete();
        }
      }, 500);

      return () => clearTimeout(completionTimer);
    }
  }, [textReady, isComplete, onIntroAnimationComplete]);

  // Debug logging
  useEffect(() => {
    console.log(
      'IntroAnimation - Loading Progress:',
      loadingProgress,
      'isComplete:',
      isComplete,
      'textReady:',
      textReady,
    );
  }, [loadingProgress, isComplete, textReady]);

  return (
    <AnimatePresence>
      {!(textReady && isComplete) && ( // Show while text is not ready OR loading is not finished
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
              onComplete={onIntroAnimationComplete}
              loadingProgress={loadingProgress}
              isComplete={isComplete}
              onTextReady={() => setTextReady(true)}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IntroAnimation;
