'use client';

import type React from 'react';
import { UNIT_SIZE } from '../../constants/canvas'; // Adjusted path

interface CreateTokenSquareProps {
  square: { x: number; y: number };
  targetX: number;
  targetY: number;
  targetScale: number;
  onClick: () => void;
}

const CreateTokenSquare: React.FC<CreateTokenSquareProps> = ({
  square,
  targetX,
  targetY,
  targetScale,
  onClick,
}) => {
  // Use target values for immediate positioning (same as canvas)
  const screenX = square.x * targetScale + targetX;
  const screenY = square.y * targetScale + targetY;
  const displaySize = UNIT_SIZE * targetScale;

  return (
    <div
      className="absolute rounded-lg cursor-pointer overflow-hidden"
      style={{
        transform: `translate3d(${screenX}px, ${screenY}px, 0)`,
        width: `${displaySize}px`,
        height: `${displaySize}px`,
        backgroundColor: '#D0B264',
        border: '2px solid #D0B264',
        zIndex: 10,
      }}
      onClick={onClick}
    >
      {/* Content layer - simplified styling, text handled by canvas */}
      <div className="relative flex flex-col items-center justify-center h-full p-4">
        {/* The logo and text are now drawn directly on the canvas for better performance and integration.
            This div remains for hover effects and click handling, but its visual content is minimal. */}
        <span
          className="text-black text-lg font-spectral uppercase font-semibold text-center"
          style={{
            // These styles are mostly for fallback/accessibility, actual text drawn on canvas
            textShadow: '0 1px 3px rgba(255, 255, 255, 0.5)',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none', // Ensure clicks go through to the div
            opacity: 0, // Hide the text as it's drawn on canvas
          }}
        >
          CREATE TOKEN
        </span>
        <span
          className="text-black text-xl font-spectral uppercase text-center"
          style={{
            // These styles are mostly for fallback/accessibility, actual text drawn on canvas
            opacity: 0, // Hide the text as it's drawn on canvas
            textShadow: '0 1px 2px rgba(255, 255, 255, 0.3)',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none', // Ensure clicks go through to the div
          }}
        >
          COMING SOON
        </span>
      </div>
    </div>
  );
};

export default CreateTokenSquare;
