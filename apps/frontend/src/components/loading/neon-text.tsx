'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NeonTextProps {
  isComplete?: boolean;
  skipLetterAnimation?: boolean;
  minimumTimeElapsed?: boolean;
}

const NeonText: React.FC<NeonTextProps> = ({
  isComplete = false,
  skipLetterAnimation = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  minimumTimeElapsed = false,
}) => {
  const [visibleLetters, setVisibleLetters] = useState(0);
  const [letterRevealComplete, setLetterRevealComplete] = useState(false);
  const [showFontCycling, setShowFontCycling] = useState(false);
  const [currentFontIndex, setCurrentFontIndex] = useState(0);

  const acesText = 'ACES.';
  const funText = 'FUN';
  const totalLetters = acesText.length + funText.length;

  const funFonts = [
    { family: 'cursive', weight: 'normal' },
    { family: "'Avenir Next', 'Helvetica Neue', sans-serif", weight: '500' },
    { family: "'Didot', 'Bodoni MT', serif", weight: 'normal' },
    { family: "'Futura', 'Century Gothic', sans-serif", weight: 'bold' },
    { family: "'Rockwell', 'Georgia', serif", weight: 'bold' },
    { family: "'Bebas Neue', 'Impact', sans-serif", weight: 'bold' },
    { family: "'Copperplate', fantasy", weight: 'bold' },
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
    }, 188);

    return () => clearInterval(letterInterval);
  }, [letterRevealComplete, totalLetters, skipLetterAnimation]);

  // Start font cycling
  useEffect(() => {
    const cyclingTimer = setTimeout(() => {
      setShowFontCycling(true);
    }, 4000);
    return () => clearTimeout(cyclingTimer);
  }, []);

  // Font cycling effect
  useEffect(() => {
    if (showFontCycling) {
      const cycleInterval = setInterval(() => {
        setCurrentFontIndex((prev) => (prev + 1) % funFonts.length);
      }, 1500);
      return () => clearInterval(cycleInterval);
    } else if (letterRevealComplete) {
      setCurrentFontIndex(0);
    }
  }, [showFontCycling, isComplete, letterRevealComplete, funFonts.length]);

  const currentFont = funFonts[currentFontIndex];

  const sentence = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        delay: 0,
        staggerChildren: 0.15,
      },
    },
  };

  const letterVariant = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4">
      {/* Main Logo Text */}
      <div className="flex items-baseline justify-center mb-4 sm:mb-6 md:mb-8">
        {/* ACES part */}
        <div className="flex">
          {acesText.split('').map((letter, index) => {
            const isVisible = index < visibleLetters;
            return (
              <motion.span
                key={`aces-${index}`}
                className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold"
                style={{
                  fontFamily: "'Neue World', serif",
                  color: '#D7BF75',
                  textShadow:
                    '0 0 2px #D7BF75, 0 0 4px #d0b284, 0 0 6px #d7bf75, 0 0 8px #d7bf75, 0 0 10px rgba(215, 191, 117, 0.4)',
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: isVisible ? 1 : 0,
                  y: isVisible ? 0 : 10,
                }}
                transition={{
                  duration: 0.3,
                  ease: 'easeOut',
                  delay: isVisible ? 0.1 : 0,
                }}
              >
                {letter}
              </motion.span>
            );
          })}
        </div>

        {/* FUN part */}
        <div className="ml-2 sm:ml-3 md:ml-4">
          <div className="inline-block min-w-[120px] sm:min-w-[150px] md:min-w-[200px] lg:min-w-[250px] xl:min-w-[300px] text-center">
            {letterRevealComplete ? (
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={currentFontIndex}
                  className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl neon-text inline-block"
                  style={{
                    fontFamily: currentFont.family,
                    fontWeight: currentFont.weight,
                    color: '#ffffff',
                    textShadow:
                      '0 0 2px #ffffff, 0 0 4px #ffffff, 0 0 6px #ffffff, 0 0 8px #ffffff, 0 0 10px rgba(255, 255, 255, 0.4)',
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
                </motion.span>
              </AnimatePresence>
            ) : (
              <motion.span
                className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl neon-text inline-block"
                style={{
                  fontFamily: funFonts[0].family,
                  fontWeight: funFonts[0].weight,
                  color: '#ffffff',
                  display: 'inline-block',
                  textShadow:
                    '0 0 2px #ffffff, 0 0 4px #ffffff, 0 0 6px #ffffff, 0 0 8px #ffffff, 0 0 10px rgba(255, 255, 255, 0.4)',
                }}
                variants={sentence}
                initial="hidden"
                animate={visibleLetters > acesText.length ? 'visible' : 'hidden'}
              >
                {funText.split('').map((char, index) => (
                  <motion.span
                    key={`fun-char-${index}`}
                    variants={letterVariant}
                    style={{ display: 'inline-block' }}
                  >
                    {char}
                  </motion.span>
                ))}
              </motion.span>
            )}
          </div>
        </div>
      </div>

      {/* Subtitle Text */}
      <div className="text-center space-y-2 sm:space-y-3">
        <motion.p
          className="text-sm sm:text-base md:text-lg lg:text-xl text-white/80 font-light"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ duration: 1, delay: 2.5 }}
        >
          The best collectibles. Tokenized.
        </motion.p>
        <motion.p
          className="text-sm sm:text-base md:text-lg lg:text-xl text-white/80 font-light"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ duration: 1, delay: 2.5 }}
        >
          Be part of history. Own differently.
        </motion.p>
      </div>
    </div>
  );
};

export default NeonText;
