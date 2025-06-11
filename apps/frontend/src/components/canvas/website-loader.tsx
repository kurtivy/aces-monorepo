'use client';

import type React from 'react';
import { useEffect, useState } from 'react';

interface WebsiteLoaderProps {
  progress: number;
  isComplete: boolean;
}

const WebsiteLoader: React.FC<WebsiteLoaderProps> = ({ progress, isComplete }) => {
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimationPhase(1), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-[#231F20] via-[#1a1718] to-[#231F20] z-50 overflow-hidden"
      style={{
        opacity: isComplete ? 0 : 1,
        pointerEvents: isComplete ? 'none' : 'auto',
        transition: 'opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Subtle background pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(45deg, rgba(208,178,100,0.03) 1px, transparent 1px),
            linear-gradient(-45deg, rgba(208,178,100,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      <div className="text-center relative z-10">
        {/* Main Animation - Geometric Asset Symbol */}
        <div className="mb-12 relative">
          <svg width="120" height="120" viewBox="0 0 120 120" className="mx-auto">
            {/* Outer Ring - Represents Marketplace */}
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="#D0B264"
              strokeWidth="2"
              opacity="0.6"
              style={{
                strokeDasharray: '314',
                strokeDashoffset: `${314 - (314 * progress) / 100}`,
                transform: 'rotate(-90deg)',
                transformOrigin: '60px 60px',
                transition: 'stroke-dashoffset 0.3s ease-out',
              }}
            />

            {/* Inner Diamond - Represents Luxury Assets */}
            <g
              style={{
                animation: 'diamond-rotate 4s ease-in-out infinite',
                transformOrigin: '60px 60px',
              }}
            >
              <path
                d="M60 25 L85 60 L60 95 L35 60 Z"
                fill="none"
                stroke="#184D37"
                strokeWidth="2"
                style={{
                  strokeDasharray: '173',
                  strokeDashoffset: animationPhase ? '0' : '173',
                  transition: 'stroke-dashoffset 2s ease-out 0.5s',
                }}
              />
              <path
                d="M60 25 L85 60 L60 95 L35 60 Z"
                fill="rgba(24,77,55,0.1)"
                style={{
                  opacity: animationPhase ? 0.3 : 0,
                  transition: 'opacity 1s ease-out 2s',
                }}
              />
            </g>

            {/* Center Dot - Represents AI/Technology Core */}
            <circle
              cx="60"
              cy="60"
              r="4"
              fill="#D0B264"
              style={{
                opacity: animationPhase ? 1 : 0,
                transform: animationPhase ? 'scale(1)' : 'scale(0)',
                transition: 'all 0.8s ease-out 1.5s',
                filter: 'drop-shadow(0 0 8px rgba(208,178,100,0.6))',
              }}
            />

            {/* Connecting Lines - Represents Network/Community */}
            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
              <line
                key={i}
                x1="60"
                y1="60"
                x2={60 + Math.cos((angle * Math.PI) / 180) * 35}
                y2={60 + Math.sin((angle * Math.PI) / 180) * 35}
                stroke="#FFFFFF"
                strokeWidth="1"
                opacity="0.4"
                style={{
                  strokeDasharray: '35',
                  strokeDashoffset: animationPhase ? '0' : '35',
                  transition: `stroke-dashoffset 0.6s ease-out ${2.5 + i * 0.1}s`,
                }}
              />
            ))}

            {/* Orbital Elements - Represents Trading Activity */}
            {[...Array(3)].map((_, i) => (
              <circle
                key={i}
                cx="60"
                cy="60"
                r={25 + i * 8}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="0.5"
                opacity="0.2"
                style={{
                  strokeDasharray: '8 12',
                  animation: `orbit-${i} ${6 + i * 2}s linear infinite`,
                  animationDelay: `${3 + i * 0.5}s`,
                }}
              />
            ))}
          </svg>
        </div>

        {/* Progress Container */}
        <div className="w-80 mx-auto">
          {/* Progress Bar */}
          <div className="relative h-1 bg-white/10 rounded-full overflow-hidden mb-6">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#D0B264] to-[#184D37] rounded-full"
              style={{ width: `${progress}%`, transition: 'width 0.1s linear' }}
            >
              <div className="absolute right-0 top-0 h-full w-8 bg-gradient-to-r from-transparent to-white/20 rounded-full" />
            </div>
          </div>

          {/* Progress Text */}
          <div className="flex justify-center items-center text-sm text-white/60 font-mono">
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Loading Indicator */}
        <div className="flex justify-center space-x-1 mt-8">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 h-1 rounded-full bg-[#D0B264]/60"
              style={{
                animation: `pulse-wave ${2}s infinite ease-in-out`,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes diamond-rotate {
          0%,
          100% {
            transform: rotate(0deg);
          }
          50% {
            transform: rotate(180deg);
          }
        }

        @keyframes orbit-0 {
          0% {
            transform: rotate(0deg);
            stroke-dasharray: 8 12;
          }
          50% {
            stroke-dasharray: 12 8;
          }
          100% {
            transform: rotate(360deg);
            stroke-dasharray: 8 12;
          }
        }

        @keyframes orbit-1 {
          0% {
            transform: rotate(0deg);
            stroke-dasharray: 8 12;
          }
          50% {
            stroke-dasharray: 12 8;
          }
          100% {
            transform: rotate(-360deg);
            stroke-dasharray: 8 12;
          }
        }

        @keyframes orbit-2 {
          0% {
            transform: rotate(0deg);
            stroke-dasharray: 8 12;
          }
          50% {
            stroke-dasharray: 4 16;
          }
          100% {
            transform: rotate(360deg);
            stroke-dasharray: 8 12;
          }
        }

        @keyframes pulse-wave {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.5);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default WebsiteLoader;
