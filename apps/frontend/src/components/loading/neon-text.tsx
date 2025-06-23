'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NeonTextProps {
  onComplete?: () => void;
  onTextReady?: () => void; // Callback when initial text animation completes
  // Add loading progress props to connect to actual website loading
  loadingProgress?: number; // 0-100
  isComplete?: boolean; // When website is fully loaded
}

const NeonText: React.FC<NeonTextProps> = ({
  onComplete,
  onTextReady,
  loadingProgress = 0,
  isComplete = false,
}) => {
  const visibleLetters = 8; // Show all letters immediately for testing
  const showFontCycling = true; // Start cycling immediately for testing
  const [currentFontIndex, setCurrentFontIndex] = useState(0);

  const acesText = 'ACES.';
  const funText = 'FUN';

  // Array of fonts to cycle through for the "FUN" part
  const funFonts = [
    { family: 'cursive', weight: 'normal', name: 'Script' },
    { family: "'Times New Roman', serif", weight: 'bold', name: 'Serif' },
    { family: "'Arial Black', sans-serif", weight: '900', name: 'Bold Sans' },
    { family: "'Courier New', monospace", weight: 'bold', name: 'Mono' },
    { family: "'Georgia', serif", weight: 'bold', name: 'Georgia' },
    { family: "'Verdana', sans-serif", weight: 'bold', name: 'Verdana' },
    { family: "'Impact', fantasy", weight: 'normal', name: 'Impact' },
    { family: "'Comic Sans MS', fantasy", weight: 'bold', name: 'Comic' },
  ];

  // Trigger onTextReady immediately for testing
  useEffect(() => {
    if (onTextReady) {
      onTextReady();
    }
  }, [onTextReady]);

  // Font cycling effect - runs until website is loaded
  useEffect(() => {
    if (!showFontCycling || isComplete) return;

    // Cycle through fonts every 1000ms with slot machine animation
    const cycleInterval = setInterval(() => {
      // After slide-down animation completes, change font and slide up
      setTimeout(() => {
        setCurrentFontIndex((prev) => (prev + 1) % funFonts.length);
      }, 200); // Half of the animation duration
    }, 1000); // Faster cycling for more dynamic loading feel

    return () => clearInterval(cycleInterval);
  }, [showFontCycling, isComplete, funFonts.length]);

  // Call onComplete when website loading is finished
  useEffect(() => {
    if (isComplete && showFontCycling && onComplete) {
      onComplete();
    }
  }, [isComplete, showFontCycling, onComplete]);

  // Debug logging to see loading progress
  useEffect(() => {
    if (showFontCycling) {
      console.log('NeonText - Loading Progress:', loadingProgress, 'isComplete:', isComplete);
    }
  }, [loadingProgress, isComplete, showFontCycling]);

  const currentFont = funFonts[currentFontIndex];

  return (
    <div className="relative flex items-center justify-center w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl h-auto">
      {/* Single SVG with separate text elements for ACES and FUN */}
      <svg className="w-full h-auto" viewBox="0 0 600 120" style={{ overflow: 'visible' }}>
        {/* ACES part - Fixed position */}
        <text
          x="200"
          y="80"
          textAnchor="middle"
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl"
        >
          {acesText.split('').map((letter, index) => {
            const isVisible = index < visibleLetters;
            const color = '#D7BF75';
            const fontFamily = "'Neue World', serif";
            const fontWeight = 'bold';

            return (
              <tspan
                key={`aces-${index}`}
                fontFamily={fontFamily}
                fontWeight={fontWeight}
                fill={color}
                style={{
                  filter: `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 16px ${color})`,
                  opacity: isVisible ? 1 : 0,
                  transition: 'opacity 0.3s ease-in-out',
                }}
              >
                {letter}
              </tspan>
            );
          })}
        </text>

        {/* FUN part - Separate text element with fixed position */}
        <text
          x="400"
          y="80"
          textAnchor="middle"
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl"
        >
          {showFontCycling ? (
            <AnimatePresence mode="wait">
              <motion.tspan
                key={currentFontIndex}
                fontFamily={currentFont.family}
                fontWeight={currentFont.weight}
                fill="#ffffff"
                style={{
                  filter: 'drop-shadow(0 0 8px #ffffff) drop-shadow(0 0 16px #ffffff)',
                }}
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 30, opacity: 0 }}
                transition={{
                  duration: 0.4,
                  ease: 'easeInOut',
                }}
              >
                {funText}
              </motion.tspan>
            </AnimatePresence>
          ) : (
            // Static FUN during initial animation
            funText.split('').map((letter, index) => {
              const letterIndex = acesText.length + index;
              const isVisible = letterIndex < visibleLetters;
              const color = '#ffffff';
              const fontFamily = 'cursive';
              const fontWeight = 'normal';

              return (
                <tspan
                  key={`fun-${index}`}
                  fontFamily={fontFamily}
                  fontWeight={fontWeight}
                  fill={color}
                  style={{
                    filter: `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 16px ${color})`,
                    opacity: isVisible ? 1 : 0,
                    transition: 'opacity 0.3s ease-in-out',
                  }}
                >
                  {letter}
                </tspan>
              );
            })
          )}
        </text>
      </svg>

      {/* Enhanced loading progress indicator */}
      {showFontCycling && !isComplete && (
        <div className="absolute bottom-[-60px] left-1/2 transform -translate-x-1/2">
          <div className="text-center space-y-2">
            <div className="text-sm text-white font-mono">
              Loading Website... {Math.round(loadingProgress)}%
            </div>
            <div className="text-xs text-gray-400">Current Font: {currentFont.name}</div>
            <div className="w-48 h-2 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#D0B264] via-[#D7BF75] to-[#D0B264] rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${loadingProgress}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NeonText;
