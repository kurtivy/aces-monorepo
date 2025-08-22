'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LaunchNeonTextProps {
  isComplete?: boolean;
  skipLetterAnimation?: boolean;
  minimumTimeElapsed?: boolean;
}

const LaunchNeonText: React.FC<LaunchNeonTextProps> = ({
  isComplete = false,
  skipLetterAnimation = false,
}) => {
  const [visibleLetters, setVisibleLetters] = useState(0);
  const [letterRevealComplete, setLetterRevealComplete] = useState(false);
  const [showFontCycling, setShowFontCycling] = useState(false);
  const [currentFontIndex, setCurrentFontIndex] = useState(0);

  const acesText = 'ACES.';
  const funText = 'TOKEN';
  const totalLetters = acesText.length + funText.length;

  const funFonts = [
    {
      family: 'var(--font-spray-letters), "Spray Letters", cursive',
      weight: '400',
      name: 'Spray Letters',
      className: 'font-spray-letters',
    },
    { family: 'Verdana, Geneva, sans-serif', weight: '700', name: 'Clear' },
    { family: '"Lucida Console", Monaco, monospace', weight: '400', name: 'Code' },
    { family: 'ui-monospace, Menlo, monospace', weight: '500', name: 'Mono' },
    {
      family: '"Palatino Linotype", "Book Antiqua", Palatino, serif',
      weight: '700',
      name: 'Classic',
    },
    { family: 'ui-serif, Georgia, serif', weight: '400', name: 'Serif' },

    { family: 'Impact, "Arial Black", sans-serif', weight: '900', name: 'Impact' },
    { family: '"Times New Roman", serif', weight: '700', name: 'Times' },
    { family: '"Helvetica Neue", Arial, sans-serif', weight: '300', name: 'Helvetica' },
    { family: 'Futura, "Century Gothic", sans-serif', weight: '700', name: 'Futura' },
  ];

  // Letter reveal animation
  useEffect(() => {
    if (letterRevealComplete) return;

    if (skipLetterAnimation) {
      setVisibleLetters(totalLetters);
      setLetterRevealComplete(true);
      return;
    }

    const letterInterval = setInterval(() => {
      setVisibleLetters((prev) => {
        const nextCount = prev + 1;
        if (nextCount >= totalLetters) {
          setLetterRevealComplete(true);
          clearInterval(letterInterval);
          return totalLetters;
        }
        return nextCount;
      });
    }, 120);

    return () => clearInterval(letterInterval);
  }, [letterRevealComplete, totalLetters, skipLetterAnimation]);

  // Start font cycling
  useEffect(() => {
    if (letterRevealComplete) {
      const cyclingTimer = setTimeout(() => {
        setShowFontCycling(true);
      }, 800);
      return () => clearTimeout(cyclingTimer);
    }
  }, [letterRevealComplete]);

  // Font cycling effect - continues until website is loaded
  useEffect(() => {
    if (showFontCycling && !isComplete) {
      const cycleInterval = setInterval(() => {
        setCurrentFontIndex((prev) => (prev + 1) % funFonts.length);
      }, 1500);
      return () => clearInterval(cycleInterval);
    }
  }, [showFontCycling, isComplete, funFonts.length]);

  const currentFont = funFonts[currentFontIndex];

  return (
    <div className="w-full max-w-6xl mx-auto text-center px-4">
      {/* Main Logo Text */}
      <div className="flex items-baseline justify-center mb-6 sm:mb-8 md:mb-10">
        {/* ACES part */}
        <div className="flex items-baseline">
          {acesText.split('').map((letter, index) => {
            const isVisible = index < visibleLetters;
            return (
              <motion.span
                key={`aces-${index}`}
                className="text-6xl sm:text-6xl md:text-9xl lg:text-9xl xl:text-9xl font-braah-one font-normal tracking-tight text-white leading-none"
                style={{
                  color: '#FFFFFF',
                  textShadow: '0 0 20px rgba(255, 255, 255, 0.3)',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                }}
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{
                  opacity: isVisible ? 1 : 0,
                  y: isVisible ? 0 : 20,
                  scale: isVisible ? 1 : 0.8,
                }}
                transition={{
                  duration: 0.3,
                  ease: [0.25, 0.46, 0.45, 0.94],
                  delay: index * 0.06,
                }}
              >
                {letter}
              </motion.span>
            );
          })}
        </div>

        {/* TOKEN part - Simplified without fixed widths */}
        <div className="ml-1 sm:ml-2 md:ml-3">
          <div className="inline-block text-center">
            {letterRevealComplete ? (
              <motion.div
                className="relative"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={currentFontIndex}
                    className="relative"
                    initial={{ y: -40, opacity: 0, rotateX: -90 }}
                    animate={{ y: 0, opacity: 1, rotateX: 0 }}
                    exit={{ y: 40, opacity: 0, rotateX: 90 }}
                    transition={{
                      duration: 0.6,
                      ease: [0.25, 0.46, 0.45, 0.94],
                    }}
                  >
                    <span
                      className={`text-5xl sm:text-5xl md:text-[8.5rem] lg:text-[8.5rem] xl:text-[8.5rem] font-bold tracking-tight leading-none ${currentFont.className || ''}`}
                      style={{
                        fontFamily: currentFont.family,
                        fontWeight: currentFont.weight,
                        letterSpacing: currentFont.name === 'Spray Letters' ? '0.2em' : 'normal',
                        color: '#D7BF75',
                        textShadow: '0 0 30px rgba(215, 191, 117, 0.2)',
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                      }}
                    >
                      {funText}
                    </span>
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            ) : (
              <div className="flex">
                {funText.split('').map((char, index) => {
                  const letterIndex = acesText.length + index;
                  const isVisible = letterIndex < visibleLetters;
                  return (
                    <motion.span
                      key={`fun-char-${index}`}
                      className="text-5xl sm:text-5xl md:text-[8.5rem] lg:text-[8.5rem] xl:text-[8.5rem] font-bold tracking-tight text-white leading-none"
                      style={{
                        fontFamily: currentFont.family,
                        fontWeight: currentFont.weight,
                        letterSpacing: currentFont.name === 'Spray Letters' ? '0.1em' : 'normal',
                        color: '#D7BF75',
                        textShadow: '0 0 30px rgba(215, 191, 117, 0.2)',
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                      }}
                      initial={{ opacity: 0, y: 20, scale: 0.8 }}
                      animate={{
                        opacity: isVisible ? 1 : 0,
                        y: isVisible ? 0 : 20,
                        scale: isVisible ? 1 : 0.8,
                      }}
                      transition={{
                        duration: 0.4,
                        ease: [0.25, 0.46, 0.45, 0.94],
                        delay: letterIndex * 0.15 + 0.05,
                      }}
                    >
                      {char}
                    </motion.span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaunchNeonText;
