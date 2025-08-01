'use client';

import React from 'react';

// Skeleton for image tiles
export const ImageTileSkeleton: React.FC<{
  position: { x: number; y: number; width: number; height: number };
}> = ({ position }) => (
  <div
    className="absolute overflow-hidden border border-[#D0B264]/30 shadow-lg animate-pulse"
    style={{
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${position.width}px`,
      height: `${position.height}px`,
      borderRadius: '8px',
      background: 'linear-gradient(135deg, #1A1A1A 0%, #0A0A0A 100%)',
    }}
  >
    <div className="w-full h-full bg-gradient-to-br from-[#231F20] to-[#0A0A0A] flex items-center justify-center">
      <div className="w-8 h-8 border border-[#D0B264]/50 border-t-transparent rounded-full animate-spin"></div>
    </div>
  </div>
);

// Skeleton for token info squares
export const TokenInfoSkeleton: React.FC = () => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#231F20] to-[#0A0A0A] p-4 animate-pulse">
    <div className="text-center w-full">
      {/* Title skeleton */}
      <div className="h-3 bg-[#D0B264]/30 rounded mb-3 w-24 mx-auto"></div>

      {/* Main value skeleton */}
      <div className="h-6 bg-white/20 rounded mb-1 w-32 mx-auto"></div>

      {/* Secondary text skeleton */}
      <div className="h-3 bg-[#DCDDCC]/30 rounded w-20 mx-auto"></div>
    </div>

    {/* Corner accents */}
    <div className="absolute top-2 left-2 w-2 h-2 border-l-2 border-t-2 border-[#D0B264]/20 rounded-tl-lg" />
    <div className="absolute top-2 right-2 w-2 h-2 border-r-2 border-t-2 border-[#D0B264]/20 rounded-tr-lg" />
    <div className="absolute bottom-2 left-2 w-2 h-2 border-l-2 border-b-2 border-[#D0B264]/20 rounded-bl-lg" />
    <div className="absolute bottom-2 right-2 w-2 h-2 border-r-2 border-b-2 border-[#D0B264]/20 rounded-br-lg" />
  </div>
);

// Skeleton for buy now section
export const BuyNowSkeleton: React.FC = () => (
  <div className="w-full p-6 bg-gradient-to-br from-[#231F20] to-[#0A0A0A] rounded-xl border border-[#D0B264]/30 animate-pulse">
    <div className="space-y-4">
      {/* Title */}
      <div className="h-6 bg-[#D0B264]/30 rounded w-32 mx-auto"></div>

      {/* Input area */}
      <div className="h-12 bg-[#1A1A1A] rounded-lg border border-[#D0B264]/20"></div>

      {/* Button */}
      <div className="h-12 bg-[#D0B264]/20 rounded-lg"></div>

      {/* Stats */}
      <div className="flex justify-between">
        <div className="h-4 bg-[#DCDDCC]/20 rounded w-20"></div>
        <div className="h-4 bg-[#DCDDCC]/20 rounded w-24"></div>
      </div>
    </div>
  </div>
);

// Skeleton for countdown timer
export const CountdownSkeleton: React.FC = () => (
  <div className="flex flex-col items-center space-y-4 animate-pulse">
    <div className="h-6 bg-[#D0B264]/30 rounded w-48"></div>
    <div className="flex space-x-4">
      {Array(4)
        .fill(0)
        .map((_, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="h-12 w-16 bg-[#231F20] rounded-lg border border-[#D0B264]/20"></div>
            <div className="h-3 bg-[#DCDDCC]/20 rounded w-8 mt-2"></div>
          </div>
        ))}
    </div>
  </div>
);

// Skeleton for progression bar
export const ProgressionSkeleton: React.FC = () => (
  <div className="w-full max-w-2xl animate-pulse">
    <div className="space-y-3">
      <div className="flex justify-between">
        <div className="h-4 bg-[#D0B264]/30 rounded w-24"></div>
        <div className="h-4 bg-[#DCDDCC]/20 rounded w-16"></div>
      </div>
      <div className="h-3 bg-[#1A1A1A] rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-[#D0B264]/30 to-[#D0B264]/10 rounded-full w-1/3"></div>
      </div>
    </div>
  </div>
);

// Skeleton for bonding curve chart
export const ChartSkeleton: React.FC = () => (
  <div className="w-full h-full bg-gradient-to-br from-[#231F20] to-[#0A0A0A] rounded-xl border border-[#D0B264]/30 flex items-center justify-center animate-pulse">
    <div className="text-center">
      <div className="w-12 h-12 mx-auto mb-4 border border-[#D0B264]/50 border-t-transparent rounded-full animate-spin"></div>
      <div className="h-4 bg-[#D0B264]/30 rounded w-32 mx-auto mb-2"></div>
      <div className="h-3 bg-[#DCDDCC]/20 rounded w-24 mx-auto"></div>
    </div>
  </div>
);

// Loading overlay with progress
interface LoadingOverlayProps {
  progress: number;
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  progress,
  message = 'Loading luxury assets...',
}) => (
  <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center">
    <div className="text-center space-y-6 max-w-md mx-auto p-8">
      {/* ACES Logo area */}
      <div className="flex items-center justify-center mb-8">
        <div className="text-4xl font-bold text-[#D0B264] tracking-wider">ACES</div>
      </div>

      {/* Progress bar */}
      <div className="space-y-3">
        <div className="h-2 bg-[#1A1A1A] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#D0B264] to-[#F4E8C1] rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#DCDDCC]">{message}</span>
          <span className="text-[#D0B264] font-mono">{progress}%</span>
        </div>
      </div>

      {/* Loading animation - Three balls bouncing one at a time */}
      <div className="flex items-center justify-center space-x-2">
        <div
          className="w-3 h-3 bg-[#D0B264] rounded-full animate-bounce"
          style={{ animationDelay: '0ms' }}
        ></div>
        <div
          className="w-3 h-3 bg-[#D0B264] rounded-full animate-bounce"
          style={{ animationDelay: '200ms' }}
        ></div>
        <div
          className="w-3 h-3 bg-[#D0B264] rounded-full animate-bounce"
          style={{ animationDelay: '400ms' }}
        ></div>
      </div>
    </div>
  </div>
);
