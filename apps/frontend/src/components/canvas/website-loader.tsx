'use client';

import type React from 'react';
import { useEffect, useState, useRef, useCallback } from 'react';

interface WebsiteLoaderProps {
  progress: number;
  isComplete: boolean;
}

// Component to render spray particles at current drawing position
const SprayParticles = ({
  path,
  progress,
  color,
  scale,
}: {
  path: SVGPathElement | null;
  progress: number;
  color: string;
  scale: number;
}) => {
  if (!path || progress <= 0) return null;

  const length = path.getTotalLength();
  const currentLength = length * progress;
  const point = path.getPointAtLength(currentLength);

  return (
    <>
      {[...Array(5)].map((_, i) => {
        const angle = (Math.PI * 2 * i) / 5;
        const radius = 2 + Math.random() * 3;
        return (
          <circle
            key={i}
            cx={point.x * scale + Math.cos(angle) * radius}
            cy={point.y * scale + Math.sin(angle) * radius}
            r={0.5 + Math.random()}
            fill={color}
            opacity={0.3 + Math.random() * 0.4}
          >
            <animate
              attributeName="opacity"
              from="0.7"
              to="0"
              dur="0.5s"
              begin="0s"
              fill="freeze"
            />
            <animate attributeName="r" from="0.5" to="2" dur="0.5s" begin="0s" fill="freeze" />
          </circle>
        );
      })}
    </>
  );
};

const WebsiteLoader: React.FC<WebsiteLoaderProps> = ({ progress, isComplete }) => {
  const [letterPaths, setLetterPaths] = useState<Record<string, string>>({});
  const [pathLengths, setPathLengths] = useState<Record<string, number>>({});
  const pathRefs = useRef<Record<string, SVGPathElement | null>>({});
  const isLoadingRef = useRef(false);

  // Load SVG paths and calculate their lengths
  useEffect(() => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    const loadSvgPaths = async () => {
      try {
        const paths: Record<string, string> = {};
        const lengths: Record<string, number> = {};
        const letters = [
          'A',
          'C',
          'E',
          'S',
          'F',
          'U',
          'N',
          'T',
          'O',
          'K',
          'I',
          'Z',
          'Y',
          'R',
          'H',
          '1',
        ];

        await Promise.all(
          letters.map(async (letter) => {
            try {
              const response = await fetch(
                letter === '1'
                  ? `/fonts/svg/one_SprayLetters.svg`
                  : `/fonts/svg/$${letter}_SprayLetters.svg`,
              );

              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }

              const text = await response.text();
              const match = text.match(/<path[^>]*d="([^"]*)"[^>]*>/);
              if (match) {
                paths[letter] = match[1];
                const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                tempPath.setAttribute('d', match[1]);
                document.body.appendChild(tempPath);
                lengths[letter] = tempPath.getTotalLength();
                document.body.removeChild(tempPath);
              }
            } catch (error) {
              console.error(`Failed to load SVG for ${letter}:`, error);
              // Don't throw here, just log and continue with other letters
            }
          }),
        );

        try {
          const response = await fetch('/fonts/svg/period_SprayLetters.svg');
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const text = await response.text();
          const match = text.match(/<path[^>]*d="([^"]*)"[^>]*>/);
          if (match) {
            paths['period'] = match[1];
            const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            tempPath.setAttribute('d', match[1]);
            document.body.appendChild(tempPath);
            lengths['period'] = tempPath.getTotalLength();
            document.body.removeChild(tempPath);
          }
        } catch (error) {
          console.error('Failed to load period SVG:', error);
          // Don't throw here, just log the error
        }

        setLetterPaths(paths);
        setPathLengths(lengths);
      } catch (error) {
        console.error('Error loading SVG paths:', error);
      } finally {
        isLoadingRef.current = false;
      }
    };

    loadSvgPaths().catch((error) => {
      console.error('Unhandled error in loadSvgPaths:', error);
      isLoadingRef.current = false;
    });
  }, []);

  const TITLE_LETTERS = ['A', 'C', 'E', 'S', 'period', 'F', 'U', 'N'];
  const SUBTITLE_LETTERS = [
    'T',
    'O',
    'K',
    'E',
    'N',
    'I',
    'Z',
    'E',
    ' ',
    'Y',
    'O',
    'U',
    'R',
    ' ',
    'S',
    'H',
    '1',
    'T',
  ];

  const getLetterProgress = useCallback(
    (index: number, isTitle: boolean) => {
      const baseProgress = progress;
      const letterDelay = isTitle ? 500 : 300; // ms between letters
      const letterDuration = isTitle ? 1000 : 800; // ms to draw each letter
      const totalDuration = isTitle ? 8000 : 6000; // total animation duration

      const startTime = index * letterDelay;
      const endTime = startTime + letterDuration;

      // Convert times to progress percentages
      const startProgress = (startTime / totalDuration) * (isTitle ? 50 : 50);
      const endProgress = (endTime / totalDuration) * (isTitle ? 50 : 50);

      // Adjust base progress based on whether we're in title or subtitle phase
      const adjustedProgress = isTitle ? baseProgress : Math.max(0, baseProgress - 50);

      if (adjustedProgress < startProgress) return 0;
      if (adjustedProgress > endProgress) return 1;

      return (adjustedProgress - startProgress) / (endProgress - startProgress);
    },
    [progress],
  );

  // Stable positions for ambient particles
  const AMBIENT_PARTICLES = [
    { left: 20, top: 30 },
    { left: 80, top: 20 },
    { left: 40, top: 80 },
    { left: 60, top: 40 },
    { left: 10, top: 60 },
    { left: 90, top: 70 },
    { left: 30, top: 90 },
    { left: 70, top: 10 },
  ];

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-[#231F20] via-[#1a1718] to-[#231F20] z-50 overflow-hidden"
      style={{
        opacity: isComplete ? 0 : 1,
        pointerEvents: isComplete ? 'none' : 'auto',
        transition: 'opacity 1.5s ease-in-out',
      }}
    >
      {/* Concrete wall texture */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 50%, rgba(255,255,255,0.05) 1px, transparent 1px),
            radial-gradient(circle at 80% 20%, rgba(255,255,255,0.025) 1px, transparent 1px),
            radial-gradient(circle at 40% 80%, rgba(255,255,255,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px, 150px 150px, 80px 80px',
        }}
      />

      <div className="text-center relative">
        {/* Main title: Aces.fun */}
        <div className="relative mb-16">
          <svg
            width="600"
            height="120"
            viewBox="0 0 1800 400"
            className="mx-auto"
            style={{ filter: 'drop-shadow(0 0 10px rgba(208,178,100,0.3))' }}
          >
            {TITLE_LETTERS.map((letter, index) => {
              if (letter === ' ' || !letterPaths[letter]) return null;

              const letterProgress = getLetterProgress(index, true);
              const pathLength = pathLengths[letter] || 0;
              const letterSpacing = 220;
              const totalWidth = TITLE_LETTERS.length * letterSpacing;
              const startX = (1800 - totalWidth) / 2;

              return (
                <g
                  key={index}
                  transform={`translate(${startX + index * letterSpacing}, 50) scale(0.15)`}
                >
                  <path
                    ref={(el: SVGPathElement | null) => {
                      if (el) pathRefs.current[`title-${letter}-${index}`] = el;
                    }}
                    d={letterPaths[letter]}
                    stroke="#D0B264"
                    strokeWidth="3"
                    fill="#D0B264"
                    fillOpacity={Math.max(0, Math.min(1, letterProgress))}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      filter: 'drop-shadow(0 0 5px rgba(208,178,100,0.5))',
                      strokeDasharray: pathLength,
                      strokeDashoffset: pathLength * (1 - Math.max(0, Math.min(1, letterProgress))),
                    }}
                  />
                  {letterProgress > 0 && letterProgress < 1 && (
                    <SprayParticles
                      path={pathRefs.current[`title-${letter}-${index}`]}
                      progress={letterProgress}
                      color="#D0B264"
                      scale={0.15}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Subtitle */}
        <div className="relative mb-8">
          <svg
            width="600"
            height="80"
            viewBox="0 0 1800 300"
            className="mx-auto"
            style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.2))' }}
          >
            {SUBTITLE_LETTERS.map((letter, index) => {
              if (letter === ' ' || !letterPaths[letter]) return null;

              const letterProgress = getLetterProgress(index, false);
              const pathLength = pathLengths[letter] || 0;

              const getLetterSpacing = (letter: string) => {
                if (letter === 'I' || letter === '1') return 100;
                if (letter === 'T') return 120;
                return 140;
              };

              const position = SUBTITLE_LETTERS.slice(0, index).reduce(
                (acc, l) => acc + (l === ' ' ? 60 : getLetterSpacing(l)),
                0,
              );

              const totalWidth = SUBTITLE_LETTERS.reduce(
                (acc, l) => acc + (l === ' ' ? 60 : getLetterSpacing(l)),
                0,
              );
              const startX = (1800 - totalWidth) / 2;

              return (
                <g key={index} transform={`translate(${startX + position}, 30) scale(0.1)`}>
                  <path
                    ref={(el: SVGPathElement | null) => {
                      if (el) pathRefs.current[`subtitle-${letter}-${index}`] = el;
                    }}
                    d={letterPaths[letter]}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    fill="#FFFFFF"
                    fillOpacity={Math.max(0, Math.min(1, letterProgress))}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.4))',
                      strokeDasharray: pathLength,
                      strokeDashoffset: pathLength * (1 - Math.max(0, Math.min(1, letterProgress))),
                    }}
                  />
                  {letterProgress > 0 && letterProgress < 1 && (
                    <SprayParticles
                      path={pathRefs.current[`subtitle-${letter}-${index}`]}
                      progress={letterProgress}
                      color="#FFFFFF"
                      scale={0.1}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Progress indicator */}
        <div className="mt-12 w-80 h-2 bg-[#231F20] rounded-full overflow-hidden mx-auto relative border border-gray-600">
          <div
            className="h-full bg-[#D0B264] relative transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-0 h-full w-6 bg-gradient-to-r from-[#D0B264] to-transparent opacity-60" />
          </div>
        </div>

        {/* Progress percentage */}
        <p className="text-white text-lg mt-4 font-mono">{Math.round(progress)}%</p>
      </div>

      {/* Ambient floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {AMBIENT_PARTICLES.map((position, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full opacity-30"
            style={{
              left: `${position.left}%`,
              top: `${position.top}%`,
              animation: `float-${i} 4s infinite ease-in-out`,
            }}
          />
        ))}
      </div>

      {/* CSS animations */}
      <style jsx>{`
        @keyframes spray-particle-0 {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          50% {
            opacity: 0.8;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(0.5) translate(10px, -10px);
          }
        }
        @keyframes spray-particle-1 {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.2);
          }
          100% {
            opacity: 0;
            transform: scale(0.3) translate(-8px, -15px);
          }
        }
        @keyframes spray-particle-2 {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          50% {
            opacity: 0.9;
            transform: scale(0.8);
          }
          100% {
            opacity: 0;
            transform: scale(0.4) translate(15px, -5px);
          }
        }
        @keyframes spray-particle-3 {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.1);
          }
          100% {
            opacity: 0;
            transform: scale(0.2) translate(-12px, -8px);
          }
        }
        @keyframes spray-particle-4 {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          50% {
            opacity: 0.5;
            transform: scale(0.9);
          }
          100% {
            opacity: 0;
            transform: scale(0.6) translate(8px, -12px);
          }
        }
        @keyframes spray-particle-subtitle-0 {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          50% {
            opacity: 0.7;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(0.4) translate(8px, -8px);
          }
        }
        @keyframes spray-particle-subtitle-1 {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.1);
          }
          100% {
            opacity: 0;
            transform: scale(0.3) translate(-6px, -10px);
          }
        }
        @keyframes spray-particle-subtitle-2 {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          50% {
            opacity: 0.8;
            transform: scale(0.8);
          }
          100% {
            opacity: 0;
            transform: scale(0.5) translate(10px, -6px);
          }
        }
        ${AMBIENT_PARTICLES.map(
          (_, i) => `
          @keyframes float-${i} {
            0%, 100% { opacity: 0.3; transform: translateY(0) scale(0.5); }
            50% { opacity: 0.6; transform: translateY(-20px) scale(1); }
          }
        `,
        ).join('')}
      `}</style>
    </div>
  );
};

export default WebsiteLoader;
