'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

import NeonLogo from './neon-logo';
import NeonText from './neon-text';
import LoadingStyles from './loading-styles';

interface IntroAnimationProps {
  onIntroAnimationComplete?: () => void;
}

const IntroAnimation: React.FC<IntroAnimationProps> = ({ onIntroAnimationComplete }) => {
  const [logoComplete, setLogoComplete] = useState(false);
  const [textComplete, setTextComplete] = useState(false);

  // Track when both logo and text animations are complete
  useEffect(() => {
    console.log('🔄 IntroAnimation State Update:', {
      logoComplete,
      textComplete,
      timestamp: Date.now(),
    });

    if (logoComplete && textComplete) {
      console.log('✅ Both animations complete, starting completion timer');
      // TEMPORARY: Add a small delay for Playwright to detect the element
      const debugTimer = setTimeout(() => {
        console.log('✅ IntroAnimation complete callback triggered');
        if (onIntroAnimationComplete) {
          onIntroAnimationComplete();
        }
      }, 500); // 500ms delay for debugging

      return () => clearTimeout(debugTimer);
    }
  }, [logoComplete, textComplete, onIntroAnimationComplete]);

  return (
    <AnimatePresence>
      {!(logoComplete && textComplete) && ( // Only show while animations are not complete
        <motion.div
          data-testid="intro-animation"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.0 }} // Increased for debugging Playwright detection
          className="fixed inset-0 min-h-screen bg-black flex flex-col items-center justify-center overflow-hidden z-50"
        >
          <LoadingStyles />

          {/* Main content container */}
          <div className="relative flex flex-col items-center justify-center z-20">
            {/* Neon Logo and Text - Fixed position */}
            <div className="flex flex-col items-center justify-center space-y-8">
              <NeonLogo onComplete={() => setLogoComplete(true)} />
              <NeonText onComplete={() => setTextComplete(true)} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IntroAnimation;
