'use client';

import React, { useState, useEffect } from 'react';

const NeonText: React.FC = () => {
  const [visibleLetters, setVisibleLetters] = useState(0);
  const fullText = 'ACES.FUN';

  useEffect(() => {
    // Letter appearance animation
    const textStartDelay = 2000; // Start after logo animation
    const letterDelay = 100; // ms between each letter

    const animationTimer = setTimeout(() => {
      const letterInterval = setInterval(() => {
        setVisibleLetters((prev) => {
          if (prev < fullText.length) {
            return prev + 1;
          }
          clearInterval(letterInterval);
          return prev;
        });
      }, letterDelay);
      return () => clearInterval(letterInterval);
    }, textStartDelay);

    return () => clearTimeout(animationTimer);
  }, [fullText]);

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
