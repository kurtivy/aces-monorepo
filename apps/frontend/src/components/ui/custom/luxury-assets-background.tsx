'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';

// Image positioning system - 200x200px squares, no gaps, positioned around content edges
// Main content = 5 squares wide (1000px), images positioned directly adjacent
// Grid-based spec so we can scale with contentWidth and squareSize
// Coordinates are in grid units (squareSize). col=0 is left edge of content, rows start at 0.
const imageGridSpec: Record<string, { col: number; row: number; w: number; h: number; type: string }> = {
  // Left side - positioned directly against left edge of content, starting from header
  'square-2': { col: -2, row: 0, w: 1, h: 1, type: 'square' },
  'square-3': { col: -1, row: 4, w: 1, h: 1, type: 'square' }, // below rect-vertical-1
  // 'square-4': { col: -1, row: 3, w: 1, h: 1, type: 'square' },
  'square-5': { col: -1, row: 0, w: 1, h: 1, type: 'square' },

  // Right side - positioned directly against right edge of content (1000px + 0px = 1000px)
  'square-6': { col: 6, row: 0, w: 1, h: 1, type: 'square' },
  // 'square-7': { col: 5, row: 1, w: 1, h: 1, type: 'square' },
  'square-8': { col: 5, row: 0, w: 1, h: 1, type: 'square' },

  'square-10': { col: 5, row: 2, w: 1, h: 1, type: 'square' },

  'square-11': { col: 5, row: 4, w: 1, h: 1, type: 'square' },
  'square-12': { col: 6, row: 4, w: 1, h: 1, type: 'square' },
  'square-13': { col: 5, row: 3, w: 1, h: 1, type: 'square' },
  'square-14': { col: -1, row: 5, w: 1, h: 1, type: 'square' },
  // 'square-15': { col: 0, row: 5, w: 1, h: 1, type: 'square' },
  'square-16': { col: 6, row: 5, w: 1, h: 1, type: 'square' },

  // Additional rectangles and squares for complete grid coverage
  'rect-horizontal-1': { col: -2, row: 1, w: 2, h: 1, type: 'horizontal' },
  'rect-horizontal-2': { col: -2, row: 4, w: 2, h: 1, type: 'horizontal' },
  'rect-horizontal-3': { col: 5, row: 5, w: 2, h: 1, type: 'horizontal' },

  'rect-vertical-1': { col: -2, row: 2, w: 1, h: 2, type: 'vertical' },
  'rect-vertical-2': { col: 6, row: 1, w: 1, h: 2, type: 'vertical' },
};

// Luxury product mapping - using the same high-end products as infinite canvas
const productMapping: Record<string, string> = {
  'square-2':
    '/canvas-images/outline/new/webp/Tom-Brady-New-England-Patriots-Autographed-Riddell-1982-1989-Throwback-Speed-Flex-Authentic-Helmet.webp',
  'square-3':
    '/canvas-images/outline/new/webp/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp',
  'square-5':
    '/canvas-images/outline/new/webp/Audemars-Piguet-Royal-Oak-Concept-KAWS-Tourbillon-Companion-Dial-Limited-Edition.webp',
  'square-6': '/canvas-images/outline/new/webp/Original-iPhone-Apple.webp',
  'square-8':
    '/canvas-images/outline/new/webp/The-Macallan-Red-Collection-Trunk-40yo-50yo-60yo-Limited-Edition.webp',
  'square-9': '/canvas-images/outline/new/webp/Nike-SB-Dunks-Lobster.webp',
  'square-10': '/canvas-images/outline/new/webp/Nike-SB-Dunks-Lobster.webp',
  'square-11':
    '/canvas-images/outline/new/webp/Shohei-Ohtani-Los-Angeles-Angels-Autographed-Fanatics-Authentic-Game-Used-MLB-Baseball-from-2018-Rookie-Season-Limited-Edition-Number-1-of-5.webp',
  'square-12':
    '/canvas-images/outline/new/webp/Krug-Clos-dAmbonnay-Trilogy-Prestige-Champagne-Collection.webp',
  'square-13':
    '/canvas-images/outline/new/webp/Hermes-Matte-Niloticus-Crocodile-Himalaya-Kelly-Retourne-32-White.webp',
  'square-14':
    '/canvas-images/outline/new/webp/Richard-Mille-RM-88-Automatic-Tourbillon-Smiley.webp',
  'square-15': '/canvas-images/outline/new/webp/Marilyn-Monroe-1953-Signed-Photo.webp',

  // Horizontal
  'rect-horizontal-1': '/canvas-images/outline/new/webp/2009-F1-McLaren-MP4-24.webp',
  'rect-horizontal-2': '/canvas-images/outline/new/webp/2010-Lamborghini-Murcielago-SV.webp',
  'rect-horizontal-3': '/canvas-images/outline/new/webp/2022-Azimut-Atlantis-45.webp',
  // Vertical
  'rect-vertical-1':
    '/canvas-images/outline/new/webp/Louis-Vuitton-Monogram-Alzer-11-Hard-Case-Trunk-Set-Brown.webp',
  'rect-vertical-2': '/canvas-images/outline/new/webp/Tiffany-and-Co-Rimowa.webp',
  'rect-vertical-3':
    '/canvas-images/outline/new/webp/Veuve-Clicquot-Yellow-Label-Champagne-Magnum-1-of-1.webp',
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
        backgroundColor: '#0f1511',
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
  contentWidth?: number; // width of central content in px (5 grid units)
  topOffset?: number; // push image grid below header dashed line
  lineInset?: number; // how far lines sit into image columns (px) when mode='inside-images'
  lineMode?: 'inside-images' | 'inside-content'; // where to place the side dashed lines
  contentLineOffset?: number; // px offset inside content from each edge when mode='inside-content'
  alignToHeader?: boolean; // measure header height and align grid top flush with its bottom
  bandHeight?: number; // height of the band between header bottom and solid line
}

const LuxuryAssetsBackground: React.FC<PageBackgroundProps> = ({
  className = '',
  opacity = 1,
  showOnMobile = false,
  minHeight = 1000,
  contentWidth = 1200,
  topOffset = 96,
  lineInset,
  lineMode = 'inside-content',
  contentLineOffset = 8,
  alignToHeader = true,
  bandHeight = 96,
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [dynamicTopOffset, setDynamicTopOffset] = useState<number>(topOffset);
  const squareSize = useMemo(() => Math.max(1, Math.round(contentWidth / 5)), [contentWidth]);
  const effectiveLineInset = useMemo(() => (typeof lineInset === 'number' ? lineInset : Math.round(squareSize * 0.1)), [lineInset, squareSize]);

  // Build dynamic positions from grid spec
  const imagePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number; width: number; height: number; type: string }> = {};
    Object.entries(imageGridSpec).forEach(([key, spec]) => {
      const x = spec.col * squareSize; // col 0 is content left; col 5 is content right
      const y = spec.row * squareSize; // rows scale with square size
      positions[key] = {
        x,
        y,
        width: spec.w * squareSize,
        height: spec.h * squareSize,
        type: spec.type,
      };
    });
    return positions;
  }, [squareSize]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1100); // Increased mobile breakpoint for wider content
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Align the image grid top to the header's bottom dashed rule
  useEffect(() => {
    if (!alignToHeader) {
      setDynamicTopOffset(topOffset);
      return;
    }
    const headerEl = document.querySelector('[data-aces-header]') as HTMLElement | null;
    const measure = () => {
      const target = headerEl || (document.querySelector('[data-aces-header]') as HTMLElement | null);
      if (target) {
        const rect = target.getBoundingClientRect();
        setDynamicTopOffset(Math.max(0, Math.round(rect.bottom)));
      } else {
        setDynamicTopOffset(topOffset);
      }
    };
    measure();
    const ResizeObserverCtor: any = (window as any).ResizeObserver;
    const ro = ResizeObserverCtor ? new ResizeObserverCtor(() => measure()) : null;
    if (ro && headerEl) ro.observe(headerEl);
    window.addEventListener('resize', measure);
    return () => {
      if (ro && headerEl) ro.unobserve(headerEl);
      window.removeEventListener('resize', measure);
    };
  }, [alignToHeader, topOffset]);

  // Hide on mobile unless explicitly requested
  if (isMobile && !showOnMobile) {
    return null;
  }

  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      style={{
        opacity,
        minHeight: `${Math.max(minHeight, 0)}px`,
        backgroundColor: '#151C16',
      }}
    >
      {/* ACES background lines: side dashed lines and optional center guide */}
      {/* Side dashed lines: controlled placement to avoid overlapping tiles */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        width="2px"
        height="100%"
        viewBox="0 0 2 100"
        style={{
          position: 'absolute',
          top: 0,
          left:
            lineMode === 'inside-images'
              ? `calc(50% - ${contentWidth / 2}px - ${effectiveLineInset}px)`
              : `calc(50% - ${contentWidth / 2}px + ${contentLineOffset}px)`,
          pointerEvents: 'none',
          opacity: 1,
        }}
      >
        <line x1="1" y1="0" x2="1" y2="100" stroke="#D7BF75" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="12 12" vectorEffect="non-scaling-stroke" shapeRendering="crispEdges" />
      </svg>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        width="2px"
        height="100%"
        viewBox="0 0 2 100"
        style={{
          position: 'absolute',
          top: 0,
          left:
            lineMode === 'inside-images'
              ? `calc(50% + ${contentWidth / 2}px + ${effectiveLineInset}px)`
              : `calc(50% + ${contentWidth / 2}px - ${contentLineOffset}px)`,
          pointerEvents: 'none',
          opacity: 1,
        }}
      >
        <line x1="1" y1="0" x2="1" y2="100" stroke="#D7BF75" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="12 12" vectorEffect="non-scaling-stroke" shapeRendering="crispEdges" />
      </svg>

      {/* Center guide line inside content at ~1/3 from left (faint) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        width="2px"
        height="100%"
        viewBox="0 0 2 100"
        style={{
          position: 'absolute',
          top: 0,
          left: `calc(50% - ${contentWidth / 2}px + ${Math.round(contentWidth / 3)}px)`,
          pointerEvents: 'none',
          opacity: 1,
        }}
      >
        <line x1="1" y1="0" x2="1" y2="100" stroke="#D7BF75" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="12 12" vectorEffect="non-scaling-stroke" shapeRendering="crispEdges" />
      </svg>

      {/* Solid horizontal accent near top between content edges */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        width={`${contentWidth}px`}
        height="8px"
        viewBox="0 0 100 2"
        style={{ position: 'absolute', left: `calc(50% - ${contentWidth / 2}px)`, top: `${dynamicTopOffset + bandHeight}px`, pointerEvents: 'none' }}
      >
        <line x1="0" y1="1" x2="100" y2="1" stroke="#D7BF75" strokeOpacity={0.5} strokeWidth={1} vectorEffect="non-scaling-stroke" shapeRendering="crispEdges" />
      </svg>
      {/* Bottom dashed horizontal between content edges */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        width={`${contentWidth}px`}
        height="8px"
        viewBox="0 0 100 2"
        style={{
          position: 'absolute',
          left: `calc(50% - ${contentWidth / 2}px)`,
          top: `${dynamicTopOffset + (5 + 0.5) * squareSize}px`,
          pointerEvents: 'none',
        }}
      >
        <line x1="0" y1="1" x2="100" y2="1" stroke="#D7BF75" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="12 12" vectorEffect="non-scaling-stroke" shapeRendering="crispEdges" />
      </svg>

      {/* Image Grid Background - positioned around content */}
      <div className="absolute left-1/2 transform -translate-x-1/2" style={{ top: `${dynamicTopOffset}px` }}>
        {/* Image positioning container - positioned relative to content start */}
        <div className="relative h-full" style={{ minHeight: `${minHeight}px`, width: `${contentWidth}px` }}>
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
            position={{ x: -2 * squareSize, y: 5 * squareSize, width: 1 * squareSize, height: 1 * squareSize, type: 'square' }}
            imageUrl="/canvas-images/outline/new/webp/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp"
            alt="Extended luxury asset 1"
            tileKey="extended-1"
          />
          <ImageTile
            key="extended-2"
            position={{ x: 6 * squareSize, y: 6 * squareSize, width: 1 * squareSize, height: 1 * squareSize, type: 'square' }}
            imageUrl="/canvas-images/outline/new/webp/Audemars-Piguet-Royal-Oak-Concept-KAWS-Tourbillon-Companion-Dial-Limited-Edition.webp"
            alt="Extended luxury asset 2"
            tileKey="extended-2"
          />
          <ImageTile
            key="extended-3"
            position={{ x: -1 * squareSize, y: 6 * squareSize, width: 1 * squareSize, height: 1 * squareSize, type: 'square' }}
            imageUrl="/canvas-images/outline/new/webp/Andy-Warhol-Signed-Marilyn-Monroe.webp"
            alt="Extended luxury asset 3"
            tileKey="extended-3"
          />
        </div>
      </div>
    </div>
  );
};

export default LuxuryAssetsBackground;
