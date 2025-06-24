'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NeonTextProps {
  isComplete?: boolean; // When website is fully loaded
  skipLetterAnimation?: boolean; // Skip letter animation for returning users
}

const NeonText: React.FC<NeonTextProps> = ({ isComplete = false, skipLetterAnimation = false }) => {
  // Progressive animation states
  const [visibleLetters, setVisibleLetters] = useState(0);
  const [letterRevealComplete, setLetterRevealComplete] = useState(false);
  const [showFontCycling, setShowFontCycling] = useState(false);
  const [currentFontIndex, setCurrentFontIndex] = useState(0);

  const acesText = 'ACES.';
  const funText = 'FUN';
  const totalLetters = acesText.length + funText.length; // 8 letters total

  // Array of fonts to cycle through for the "FUN" part
  const funFonts = [
    { family: "'Avenir Next', 'Helvetica Neue', sans-serif", weight: '500', name: 'Modern' },
    { family: "'Didot', 'Bodoni MT', serif", weight: 'normal', name: 'Elegant Serif' },
    { family: "'Futura', 'Century Gothic', sans-serif", weight: 'bold', name: 'Geometric' },
    { family: "'Rockwell', 'Georgia', serif", weight: 'bold', name: 'Slab Serif' },
    { family: "'Bebas Neue', 'Impact', sans-serif'", weight: 'bold', name: 'Display' },
    { family: "'Brush Script MT', cursive", weight: 'normal', name: 'Script' },
    { family: "'Copperplate', fantasy", weight: 'bold', name: 'Classic' },
  ];

  // Phase 1: Letter-by-letter reveal animation (or skip if returning user)
  useEffect(() => {
    if (letterRevealComplete) return; // Only check if letter reveal is already complete

    if (skipLetterAnimation) {
      // Skip letter animation - show all letters immediately
      setVisibleLetters(totalLetters);
      setLetterRevealComplete(true);
      return;
    }

    const letterInterval = setInterval(() => {
      setVisibleLetters((prev) => {
        const nextCount = prev + 1;

        // If we've revealed all letters, mark letter reveal as complete
        if (nextCount >= totalLetters) {
          setLetterRevealComplete(true);
          clearInterval(letterInterval);
          return totalLetters;
        }

        return nextCount;
      });
    }, 188); // ~1.5 seconds for "ACES.FUN"

    return () => clearInterval(letterInterval);
  }, [letterRevealComplete, totalLetters, skipLetterAnimation]); // Removed onTextReady from dependencies

  // Start font cycling at the 4-second mark for testing.
  useEffect(() => {
    const cyclingTimer = setTimeout(() => {
      setShowFontCycling(true);
    }, 4000);
    return () => clearTimeout(cyclingTimer);
  }, []);

  // Unified animation effect
  useEffect(() => {
    // if (isComplete) return; // Temporarily disabled for testing

    if (showFontCycling) {
      // Font cycling effect
      const cycleInterval = setInterval(() => {
        setCurrentFontIndex((prev) => (prev + 1) % funFonts.length);
      }, 1500); // 1.5 seconds per font change
      return () => clearInterval(cycleInterval);
    } else if (letterRevealComplete) {
      // Ensure it's on the first font ('cursive') after reveal, before cycling starts
      setCurrentFontIndex(0);
    }
  }, [showFontCycling, isComplete, letterRevealComplete, funFonts.length]);

  const currentFont = funFonts[currentFontIndex];

  // Animation variants for letter-by-letter reveal
  const sentence = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        delay: 0,
        staggerChildren: 0.15, // Time between each letter
      },
    },
  };

  const letterVariant = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="relative flex items-center justify-center w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl h-auto">
      {/* Single SVG with separate text elements for ACES and FUN */}
      <svg className="w-full h-auto" viewBox="0 0 600 280" style={{ overflow: 'visible' }}>
        <motion.text
          x="300"
          y="180"
          textAnchor="middle"
          className="text-4xl"
          fill="#ffffff"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ duration: 1, delay: 2.5 }}
        >
          The best collectibles. Tokenized.
        </motion.text>
        <motion.text
          x="300"
          y="220"
          textAnchor="middle"
          className="text-4xl"
          fill="#ffffff"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ duration: 1, delay: 2.5 }}
        >
          Be part of history. Own differently.
        </motion.text>

        {/* ACES part - Progressive letter reveal */}
        <text
          x="130"
          y="110"
          textAnchor="middle"
          className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl"
        >
          {acesText.split('').map((letter, index) => {
            const isVisible = index < visibleLetters;
            const color = '#D7BF75';
            const fontFamily = "'Neue World', serif";
            const fontWeight = 'bold';

            return (
              <motion.tspan
                key={`aces-${index}`}
                fontFamily={fontFamily}
                fontWeight={fontWeight}
                fill={color}
                style={{
                  filter: `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 8px ${color})`,
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: isVisible ? 1 : 0,
                  y: isVisible ? 0 : 10,
                }}
                transition={{
                  duration: 0.3,
                  ease: 'easeOut',
                  delay: isVisible ? 0.1 : 0, // Small delay for smoother appearance
                }}
              >
                {letter}
              </motion.tspan>
            );
          })}
        </text>

        {/* FUN part - Progressive reveal then font cycling */}
        <text
          x="470"
          y="110"
          textAnchor="middle"
          className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl"
        >
          {letterRevealComplete ? (
            // UNIFIED animation system: Font cycling is now the primary animation.
            // The initial state (index 0) is the "cursive" font, ensuring no "switch".
            <AnimatePresence mode="wait" initial={false}>
              <motion.tspan
                key={currentFontIndex}
                fontFamily={currentFont.family}
                fontWeight={currentFont.weight}
                fill="#ffffff"
                style={{
                  filter: 'drop-shadow(0 0 4px #ffffff) drop-shadow(0 0 8px #ffffff)',
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
            // Initial letter-by-letter reveal for FUN - now renders the entire word
            // with animated characters to maintain consistent spacing from the start.
            <motion.tspan
              fontFamily={funFonts[0].family}
              fontWeight={funFonts[0].weight}
              fill="#ffffff"
              style={{
                filter: `drop-shadow(0 0 4px #ffffff) drop-shadow(0 0 8px #ffffff)`,
              }}
              variants={sentence}
              initial="hidden"
              animate={visibleLetters > acesText.length ? 'visible' : 'hidden'}
            >
              {funText.split('').map((char, index) => (
                <motion.tspan key={`fun-char-${index}`} variants={letterVariant}>
                  {char}
                </motion.tspan>
              ))}
            </motion.tspan>
          )}
        </text>
      </svg>
    </div>
  );
};

export default NeonText;
