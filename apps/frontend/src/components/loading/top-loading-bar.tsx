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
        // More reliable checks for Firefox compatibility
        const checks = [
          // Font loading check with Firefox fallback
          new Promise<void>((resolve) => {
            if (document.fonts && typeof document.fonts.ready === 'object') {
              // Firefox-specific timeout for font loading
              const fontTimeout = setTimeout(() => {
                console.warn('Font loading timeout reached, continuing');
                resolve();
              }, 1000);

              document.fonts.ready
                .then(() => {
                  clearTimeout(fontTimeout);
                  resolve();
                })
                .catch(() => {
                  clearTimeout(fontTimeout);
                  console.warn('Font loading promise failed, using fallback');
                  resolve();
                });
            } else {
              // Fallback for older browsers, Firefox issues, or when fonts API is unavailable
              console.warn('Fonts API not available, using timeout fallback');
              setTimeout(resolve, 500);
            }
          }),

          // Document ready check with Firefox-specific handling
          new Promise<void>((resolve) => {
            if (document.readyState === 'complete') {
              resolve();
            } else {
              const handleLoad = () => {
                resolve();
                window.removeEventListener('load', handleLoad);
                document.removeEventListener('DOMContentLoaded', handleLoad);
              };

              // Listen to both events for Firefox reliability
              window.addEventListener('load', handleLoad);
              document.addEventListener('DOMContentLoaded', handleLoad);

              // Firefox-specific fallback timeout
              setTimeout(() => {
                resolve();
                window.removeEventListener('load', handleLoad);
                document.removeEventListener('DOMContentLoaded', handleLoad);
              }, 2500); // Increased timeout for Firefox
            }
          }),

          // Image preloading check (Firefox-specific)
          new Promise<void>((resolve) => {
            const images = document.querySelectorAll('img');
            if (images.length === 0) {
              resolve();
              return;
            }

            let loadedImages = 0;
            const checkImageLoad = () => {
              loadedImages++;
              if (loadedImages >= images.length) {
                resolve();
              }
            };

            images.forEach((img) => {
              if (img.complete) {
                checkImageLoad();
              } else {
                img.onload = checkImageLoad;
                img.onerror = checkImageLoad; // Still resolve on error
                // Firefox timeout for stuck images
                setTimeout(checkImageLoad, 500);
              }
            });

            // Overall timeout for image loading
            setTimeout(resolve, 1500);
          }),
        ];

        // Progress simulation with Firefox-friendly increments
        const progressInterval = setInterval(() => {
          if (!mounted) {
            clearInterval(progressInterval);
            return;
          }

          setProgress((prev) => {
            const elapsed = Date.now() - startTime;
            const timeProgress = Math.min((elapsed / minimumLoadTime) * 100, 85);

            // Firefox-specific: slower, more predictable increments
            const increment = Math.random() * 1.5 + 0.5; // 0.5-2.0 increment
            const newProgress = Math.min(Math.max(prev + increment, timeProgress), 95);

            return newProgress;
          });
        }, 120); // Slightly slower for Firefox smoothness

        // Wait for all checks with extended timeout for Firefox
        await Promise.race([
          Promise.all(checks),
          new Promise((resolve) => setTimeout(resolve, 4000)), // Extended timeout for Firefox
        ]);

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

          // Firefox-specific: slightly longer delay before completion
          setTimeout(() => {
            if (mounted) {
              setIsComplete(true);
              setTimeout(() => {
                if (mounted) {
                  onLoadingComplete();
                }
              }, 500); // Increased delay for Firefox fade-out
            }
          }, 300);
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
              }, 500);
            }
          }, 300);
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

      {/* Optional subtle text indicator */}
      {progress < 100 && (
        <motion.div
          className="absolute top-2 left-4 text-[#D0B264] text-xs font-syne font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ delay: 0.5 }}
        >
          Loading ACES...
        </motion.div>
      )}
    </motion.div>
  );
};

export default TopLoadingBar;
