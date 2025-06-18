'use client';

import React, { useState, useEffect } from 'react';

interface NeonTextProps {
  onComplete?: () => void;
}

const NeonText: React.FC<NeonTextProps> = ({ onComplete }) => {
  const [visibleLetters, setVisibleLetters] = useState(0);
  const fullText = 'ACES.FUN';

  useEffect(() => {
    const textStartDelay = 2200; // Standard delay for all browsers
    const letterDelay = 120; // Standard timing for all browsers

    const startTimer = setTimeout(() => {
      let currentLetter = 0;

      const animateNextLetter = () => {
        if (currentLetter < fullText.length) {
          setVisibleLetters(currentLetter + 1);
          currentLetter++;

          // Schedule next letter animation
          setTimeout(animateNextLetter, letterDelay);
        } else {
          if (onComplete) {
            onComplete();
          }
        }
      };

      // Start the letter animation
      animateNextLetter();
    }, textStartDelay);

    return () => clearTimeout(startTimer);
  }, [fullText.length, onComplete]);

  return (
    <div className="relative flex items-center justify-center w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl h-auto">
      <svg className="w-full h-auto" viewBox="0 0 600 120" style={{ overflow: 'visible' }}>
        <text
          x="50%"
          y="80"
          textAnchor="middle"
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl"
        >
          {fullText.split('').map((letter, index) => {
            const isVisible = index < visibleLetters;
            const isAces = index < 4;
            const color = isAces ? '#D7BF75' : '#ffffff';
            const fontFamily = isAces ? "'Neue World', serif" : 'cursive';
            const fontWeight = isAces ? 'bold' : 'normal';

            return (
              <tspan
                key={index}
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
      </svg>
    </div>
  );
};

export default NeonText;
