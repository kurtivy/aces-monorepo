'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface TopLoadingBarProps {
  onLoadingComplete: () => void;
  minimumLoadTime?: number;
}

const TopLoadingBar: React.FC<TopLoadingBarProps> = ({
  onLoadingComplete,
  minimumLoadTime = 1200,
}) => {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let mounted = true;
    const startTime = Date.now();

    const checkReadiness = async () => {
      try {
        // Simple, universal loading check - works consistently across all browsers

        // Single check for document readiness - no browser-specific timing
        const documentReady = new Promise<void>((resolve) => {
          if (document.readyState === 'complete') {
            resolve();
          } else {
            const handleLoad = () => {
              resolve();
              window.removeEventListener('load', handleLoad);
              document.removeEventListener('DOMContentLoaded', handleLoad);
            };

            window.addEventListener('load', handleLoad);
            document.addEventListener('DOMContentLoaded', handleLoad);
          }
        });

        // Universal timeout - same for all browsers (no Firefox-specific workarounds)
        const universalTimeout = new Promise<void>((resolve) => {
          setTimeout(resolve, 2000); // Single 2-second maximum wait
        });

        // Simple progress simulation without browser-specific increments
        const progressInterval = setInterval(() => {
          if (!mounted) {
            clearInterval(progressInterval);
            return;
          }

          setProgress((prev) => {
            const elapsed = Date.now() - startTime;
            const timeProgress = Math.min((elapsed / minimumLoadTime) * 100, 85);
            const increment = Math.random() * 2 + 1; // 1-3 increment (consistent across browsers)
            const newProgress = Math.min(Math.max(prev + increment, timeProgress), 95);
            return newProgress;
          });
        }, 100); // Standard 100ms interval for all browsers

        // Wait for document ready OR timeout (whichever comes first)
        await Promise.race([documentReady, universalTimeout]);

        // Ensure minimum load time
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, minimumLoadTime - elapsed);

        if (remainingTime > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingTime));
        }

        clearInterval(progressInterval);

        if (mounted) {
          // Final progress animation to 100%
          setProgress(100);

          // Standard completion timing for all browsers
          setTimeout(() => {
            if (mounted) {
              setIsComplete(true);
              setTimeout(() => {
                if (mounted) {
                  onLoadingComplete();
                }
              }, 400); // Standard 400ms delay for all browsers
            }
          }, 200); // Standard 200ms delay for all browsers
        }
      } catch (error) {
        console.warn('Loading check error:', error);
        // Still complete loading even if there are errors
        if (mounted) {
          setProgress(100);
          setTimeout(() => {
            if (mounted) {
              setIsComplete(true);
              setTimeout(() => {
                if (mounted) {
                  onLoadingComplete();
                }
              }, 400);
            }
          }, 200);
        }
      }
    };

    checkReadiness();

    return () => {
      mounted = false;
    };
  }, [onLoadingComplete, minimumLoadTime]);

  return (
    <motion.div
      data-testid="top-loading-bar"
      className="fixed top-0 left-0 right-0 z-[70]"
      initial={{ opacity: 1 }}
      animate={{ opacity: isComplete ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Loading bar background */}
      <div className="w-full h-1 bg-black/20 backdrop-blur-sm">
        <motion.div
          className="h-full bg-gradient-to-r from-[#D0B264] via-[#D7BF75] to-[#D0B264] relative overflow-hidden"
          initial={{ width: '0%' }}
          animate={{ width: `${progress}%` }}
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
