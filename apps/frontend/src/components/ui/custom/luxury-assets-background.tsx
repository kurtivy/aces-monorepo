'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

// Image positioning system - 200x200px squares, no gaps, positioned around content edges
// Main content = 5 squares wide (1000px), images positioned directly adjacent
const imagePositions = {
  // Left side - positioned directly against left edge of content, starting from header
  'square-2': { x: -400, y: 0, width: 200, height: 200, type: 'square' },
  'square-3': { x: -200, y: 400, width: 200, height: 200, type: 'square' },
  // 'square-4': { x: -200, y: 600, width: 200, height: 200, type: 'square' },
  'square-5': { x: -200, y: 0, width: 200, height: 200, type: 'square' }, // Bottom left, next to BUY NOW

  // Right side - positioned directly against right edge of content (1000px + 0px = 1000px)
  'square-6': { x: 1200, y: 0, width: 200, height: 200, type: 'square' },
  // 'square-7': { x: 1000, y: 200, width: 200, height: 200, type: 'square' },
  'square-8': { x: 1000, y: 0, width: 200, height: 200, type: 'square' },

  'square-10': { x: 1000, y: 400, width: 200, height: 200, type: 'square' },

  'square-11': { x: 1000, y: 800, width: 200, height: 200, type: 'square' },
  'square-12': { x: 1200, y: 800, width: 200, height: 200, type: 'square' },
  'square-13': { x: 1000, y: 600, width: 200, height: 200, type: 'square' },
  'square-14': { x: -200, y: 1000, width: 200, height: 200, type: 'square' },
  // 'square-15': { x: 0, y: 1000, width: 200, height: 200, type: 'square' },
  'square-16': { x: 1200, y: 1000, width: 200, height: 200, type: 'square' },

  // Additional rectangles and squares for complete grid coverage
  'rect-horizontal-1': { x: -400, y: 200, width: 400, height: 200, type: 'horizontal' },
  'rect-horizontal-2': { x: -400, y: 800, width: 400, height: 200, type: 'horizontal' },
  'rect-horizontal-3': { x: 1000, y: 1000, width: 400, height: 200, type: 'horizontal' },

  'rect-vertical-1': { x: -400, y: 400, width: 200, height: 400, type: 'vertical' },
  'rect-vertical-2': { x: 1200, y: 200, width: 200, height: 400, type: 'vertical' },
};

// Luxury product mapping - using the same high-end products as infinite canvas
const productMapping: Record<string, string> = {
  'square-2':
    '/canvas-images/outline/Tom-Brady-New-England-Patriots-Autographed-Riddell-1982-1989-Throwback-Speed-Flex-Authentic-Helmet.webp',
  'square-3':
    '/canvas-images/outline/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp',
  'square-5':
    '/canvas-images/outline/Audemars-Piguet-Royal-Oak-Concept-KAWS-Tourbillon-Companion-Dial-Limited-Edition.webp',
  'square-6': '/canvas-images/outline/Original-iPhone-Apple.webp',
  'square-8':
    '/canvas-images/outline/The-Macallan-Red-Collection-Trunk-40yo-50yo-60yo-Limited-Edition.webp',
  'square-9': '/canvas-images/outline/Nike-SB-Dunks-Lobster.webp',
  'square-10': '/canvas-images/outline/Nike-SB-Dunks-Lobster.webp',
  'square-11':
    '/canvas-images/outline/Shohei-Ohtani-Los-Angeles-Angels-Autographed-Fanatics-Authentic-Game-Used-MLB-Baseball-from-2018-Rookie-Season-Limited-Edition-Number-1-of-5.webp',
  'square-12':
    '/canvas-images/outline/Krug-Clos-dAmbonnay-Trilogy-Prestige-Champagne-Collection.webp',
  'square-13':
    '/canvas-images/outline/Hermes-Matte-Niloticus-Crocodile-Himalaya-Kelly-Retourne-32-White.webp',
  'square-14': '/canvas-images/outline/Richard-Mille-RM-88-Automatic-Tourbillon-Smiley.webp',
  'square-15': '/canvas-images/outline/Marilyn-Monroe-1953-Signed-Photo.webp',

  // Horizontal
  'rect-horizontal-1': '/canvas-images/outline/2009-F1-McLaren-MP4-24.webp',
  'rect-horizontal-2': '/canvas-images/outline/2010-Lamborghini-Murcielago-SV.webp',
  'rect-horizontal-3': '/canvas-images/outline/2022-Azimut-Atlantis-45.webp',
  // Vertical
  'rect-vertical-1':
    '/canvas-images/outline/Louis-Vuitton-Monogram-Alzer-11-Hard-Case-Trunk-Set-Brown.webp',
  'rect-vertical-2': '/canvas-images/outline/Tiffany-and-Co-Rimowa.webp',
  'rect-vertical-3': '/canvas-images/outline/Tiffany-and-Co-Rimowa.webp',
};

// Image tile component that mimics the infinite canvas drawing system
interface ImageTileProps {
  position: { x: number; y: number; width: number; height: number; type: string };
  imageUrl?: string;
  alt: string;
  tileKey: string;
}

const ImageTile: React.FC<ImageTileProps> = ({ position, imageUrl, alt }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <div
      className="absolute overflow-hidden border border-[#D0B264] shadow-lg"
      style={{
        // Position relative to the content container, not viewport
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${position.width}px`,
        height: `${position.height}px`,
        boxShadow: '0 8px 32px rgba(208, 178, 100, 0.15)',
        borderRadius: '8px',
        background: 'linear-gradient(135deg, #1A1A1A 0%, #0A0A0A 100%)',
      }}
    >
      {!imageError ? (
        <Image
          src={imageUrl || '/canvas-images/10xSouth-African-Gold-Krugerrands.webp'}
          alt={alt}
          width={position.width}
          height={position.height}
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImageError(true);
            setImageLoaded(true);
          }}
          style={{
            imageRendering: 'crisp-edges',
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#231F20] to-[#0A0A0A]">
          <div className="text-center">
            <div className="w-8 h-8 mx-auto mb-2 border border-[#D0B264] border-t-transparent rounded-full animate-spin"></div>
            <span
              className="text-xs text-[#D0B264] font-medium"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              Luxury Asset
            </span>
          </div>
        </div>
      )}
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 bg-[#231F20] flex items-center justify-center">
          <div className="w-8 h-8 border border-[#D0B264] border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};

/**
 * LuxuryAssetsBackground - A reusable background component that displays luxury asset images
 * positioned around the content area, similar to the ICO launch page.
 *
 * Usage:
 * ```tsx
 * import LuxuryAssetsBackground from '@/components/ui/custom/luxury-assets-background';
 *
 * // Basic usage
 * <LuxuryAssetsBackground />
 *
 * // With custom opacity and mobile visibility
 * <LuxuryAssetsBackground
 *   opacity={0.8}
 *   showOnMobile={true}
 *   headerHeight={80}
 *   minHeight={1000}
 *   className="custom-class"
 * />
 * ```
 */
interface PageBackgroundProps {
  className?: string;
  opacity?: number;
  showOnMobile?: boolean;
  minHeight?: number; // Minimum height, but will expand as needed
}

const LuxuryAssetsBackground: React.FC<PageBackgroundProps> = ({
  className = '',
  opacity = 1,
  showOnMobile = false,
  minHeight = 1000, // Default minimum height
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1100); // Increased mobile breakpoint for wider content
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Hide on mobile unless explicitly requested
  if (isMobile && !showOnMobile) {
    return null;
  }

  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      style={{
        opacity,
        minHeight: `${minHeight}px`, // Use minHeight instead of fixed height
      }}
    >
      {/* Image Grid Background - positioned around content */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
        {/* Image positioning container - positioned relative to content start */}
        <div className="relative w-[1000px] h-full" style={{ minHeight: `${minHeight}px` }}>
          {Object.entries(imagePositions).map(([key, position]) => (
            <ImageTile
              key={key}
              position={position}
              imageUrl={productMapping[key]}
              alt={`Luxury asset ${key}`}
              tileKey={key}
            />
          ))}

          {/* Add additional images for extended coverage */}
          <ImageTile
            key="extended-1"
            position={{ x: -400, y: 1100, width: 200, height: 200, type: 'square' }}
            imageUrl="/canvas-images/outline/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp"
            alt="Extended luxury asset 1"
            tileKey="extended-1"
          />
          <ImageTile
            key="extended-2"
            position={{ x: 1200, y: 1200, width: 200, height: 200, type: 'square' }}
            imageUrl="/canvas-images/outline/Audemars-Piguet-Royal-Oak-Concept-KAWS-Tourbillon-Companion-Dial-Limited-Edition.webp"
            alt="Extended luxury asset 2"
            tileKey="extended-2"
          />
          <ImageTile
            key="extended-3"
            position={{ x: -200, y: 1200, width: 200, height: 200, type: 'square' }}
            imageUrl="/canvas-images/outline/Andy-Warhol-Signed-Marilyn-Monroe.webp"
            alt="Extended luxury asset 3"
            tileKey="extended-3"
          />
          <ImageTile
            key="extended-4"
            position={{ x: 0, y: 1200, width: 200, height: 200, type: 'square' }}
            imageUrl="/canvas-images/outline/Original-iPhone-Apple.webp"
            alt="Extended luxury asset 4"
            tileKey="extended-4"
          />
        </div>
      </div>
    </div>
  );
};

export default LuxuryAssetsBackground;
