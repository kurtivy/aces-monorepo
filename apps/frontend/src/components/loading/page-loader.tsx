'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PageLoaderProps {
  className?: string;
  transparentBackground?: boolean; // when false, use opaque background to avoid flash
}

const PageLoader: React.FC<PageLoaderProps> = ({
  className = '',
  transparentBackground = true,
}) => {
  const [showFontCycling, setShowFontCycling] = useState(false);
  const [currentFontIndex, setCurrentFontIndex] = useState(0);

  const acesText = 'ACES.';
  const funText = 'FUN';

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

  // Start font cycling after 1 second pause
  useEffect(() => {
    const cyclingTimer = setTimeout(() => {
      setShowFontCycling(true);
    }, 1000);
    return () => clearTimeout(cyclingTimer);
  }, []);

  // Font cycling effect - continues indefinitely
  useEffect(() => {
    if (showFontCycling) {
      const cycleInterval = setInterval(() => {
        setCurrentFontIndex((prev) => (prev + 1) % funFonts.length);
      }, 1500);
      return () => clearInterval(cycleInterval);
    }
  }, [showFontCycling, funFonts.length]);

  const currentFont = funFonts[currentFontIndex];

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center ${className}`}
      style={{ backgroundColor: transparentBackground ? 'transparent' : '#151c16' }}
    >
      <div className="w-full max-w-5xl mx-auto text-center px-8">
        {/* Main Logo Text */}
        <motion.div
          className="flex items-center justify-center flex-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          {/* ACES part */}
          <div className="flex">
            {acesText.split('').map((letter, index) => (
              <span
                key={`aces-${index}`}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-6xl xl:text-6xl font-braah-one font-normal tracking-tight text-white leading-none"
                style={{
                  color: '#FFFFFF',
                  textShadow: '0 0 20px rgba(255, 255, 255, 0.3)',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                }}
              >
                {letter}
              </span>
            ))}
          </div>

          {/* FUN part - Using the v8 approach with fixed min-widths */}
          <div className="ml-0.5 sm:ml-1 md:ml-1 -mt-1 sm:-mt-1.5 md:-mt-2">
            <div className="inline-block w-[70px] sm:w-[80px] md:w-[150px] lg:w-[150px] xl:w-[150px] text-center">
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
                    className={`text-3xl sm:text-4xl md:text-[5.25rem] lg:text-[5.25rem] xl:text-[5.25rem] font-bold tracking-tight leading-none ${currentFont.className || ''}`}
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
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PageLoader;
