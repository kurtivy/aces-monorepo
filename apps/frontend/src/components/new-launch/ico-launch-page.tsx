'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import LaunchHeader from './launch-header';
import Image from 'next/image';
import BondingCurveChart from './bonding-curve-chart';
import CountdownTimer from './countdown-timer';
import ProgressionBar from './progression-bar';
import BuyNowSection from './buy-now';
import AnimatedDotsBackground from './animated-dots-background';
import { useICOContracts } from '@/hooks/use-ico-contracts';
import { formatEther } from 'viem';

// Image positioning system - 200x200px squares, no gaps, RIGHT AGAINST content edges
// Main content = 5 squares wide (1000px), images positioned directly adjacent
const imagePositions = {
  // Left side - positioned directly against left edge of content, starting from header
  'square-1': { x: -200, y: 0, width: 200, height: 200, type: 'square' },
  'square-2': { x: -400, y: 0, width: 200, height: 200, type: 'square' },
  'square-3': { x: -200, y: 400, width: 200, height: 200, type: 'square' },
  'square-4': { x: -200, y: 600, width: 200, height: 200, type: 'square' },
  'square-5': { x: 0, y: 600, width: 200, height: 200, type: 'square' }, // Bottom left, next to BUY NOW

  // Right side - positioned directly against right edge of content (1000px + 0px = 1000px)
  'square-6': { x: 1200, y: 0, width: 200, height: 200, type: 'square' },
  'square-7': { x: 1000, y: 200, width: 200, height: 200, type: 'square' },
  'square-8': { x: 1000, y: 0, width: 200, height: 200, type: 'square' },
  'square-9': { x: 1200, y: 600, width: 200, height: 200, type: 'square' },
  'square-10': { x: 800, y: 600, width: 200, height: 200, type: 'square' },

  'square-11': { x: -400, y: 800, width: 200, height: 200, type: 'square' },
  'square-12': { x: 1200, y: 800, width: 200, height: 200, type: 'square' },

  // Token Info Squares
  'token-price': { x: 0, y: 400, width: 200, height: 200, type: 'token-info' },
  'token-allocation': { x: 800, y: 400, width: 200, height: 200, type: 'token-info' },

  // Additional rectangles and squares for complete grid coverage
  'rect-horizontal-1': { x: -400, y: 200, width: 400, height: 200, type: 'horizontal' },
  'rect-horizontal-2': { x: -200, y: 800, width: 400, height: 200, type: 'horizontal' },
  'rect-horizontal-3': { x: 800, y: 800, width: 400, height: 200, type: 'horizontal' },

  'rect-vertical-1': { x: -400, y: 400, width: 200, height: 400, type: 'vertical' },
  'rect-vertical-2': { x: 1200, y: 200, width: 200, height: 400, type: 'vertical' },
  'rect-vertical-3': { x: 1000, y: 400, width: 200, height: 400, type: 'vertical' },
};

// Luxury product mapping - using the same high-end products as infinite canvas
const productMapping: Record<string, string> = {
  'square-1': '/canvas-images/outline/Autographed-Jersey-Mathew-Barzal-New-York-Islanders.png',
  'square-2':
    '/canvas-images/Tom-Brady-New-England-Patriots-Autographed-Riddell-1982-1989-Throwback-Speed-Flex-Authentic-Helmet.webp',
  'square-3': '/canvas-images/outline/Andy-Warhol-Signed-Marilyn-Monroe.png',
  'square-4':
    '/canvas-images/outline/Hermes-Matte-Niloticus-Crocodile-Himalaya-Kelly-Retourne-32-White.png',
  'square-5':
    '/canvas-images/outline/Audemars-Piguet-Royal-Oak-Concept-KAWS-Tourbillon-Companion-Dial-Limited-Edition.png',
  'square-6': '/canvas-images/Original-iPhone-Apple.webp',
  'square-7':
    '/canvas-images/outline/Shohei-Ohtani-Los-Angeles-Angels-Autographed-Fanatics-Authentic-Game-Used-MLB-Baseball-from-2018-Rookie-Season-Limited-Edition-Number-1-of-5.png',
  'square-8':
    '/canvas-images/outline/The-Macallan-Red-Collection-Trunk-40yo-50yo-60yo-Limited-Edition.png',
  'square-9': '/canvas-images/outline/Nike-SB-Dunks-Lobster.png',
  'square-10': '/canvas-images/outline/Nike-SB-Dunks-Lobster.png',
  'square-11':
    '/canvas-images/Shohei-Ohtani-Los-Angeles-Angels-Autographed-Fanatics-Authentic-Game-Used-MLB-Baseball-from-2018-Rookie-Season-Limited-Edition-Number-1-of-5.webp',
  'square-12': '/canvas-images/Krug-Clos-dAmbonnay-Trilogy-Prestige-Champagne-Collection.webp',
  // Horizontal
  'rect-horizontal-1': '/canvas-images/outline/2009-F1-McLaren-MP4-24.png',
  'rect-horizontal-2': '/canvas-images/outline/2010-Lamborghini-Murcielago-SV.png',
  'rect-horizontal-3': '/canvas-images/outline/2022-Azimut-Atlantis-45.png',
  // Vertical
  'rect-vertical-1':
    '/canvas-images/Louis-Vuitton-Monogram-Alzer-11-Hard-Case-Trunk-Set-Brown.webp',
  'rect-vertical-2': '/canvas-images/Veuve-Clicquot-Champagne-Vertical-Limit-Fridge.webp',
  'rect-vertical-3': '/canvas-images/outline/Tiffany-and-Co-Rimowa.png',
};

// Token Info Components
const CurrentPriceSquare: React.FC<{ currentPrice: bigint }> = ({ currentPrice }) => {
  const priceInETH = currentPrice ? Number(formatEther(currentPrice)) : 0;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#231F20] to-[#0A0A0A] p-4">
      <div className="text-center">
        <h3
          className="text-[#D0B264] text-sm font-medium tracking-wider mb-3 uppercase"
          style={{ fontFamily: 'Spectral, serif' }}
        >
          Current Price
        </h3>
        <div className="flex flex-col items-center">
          <span
            className="text-white text-2xl font-bold mb-1"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {priceInETH.toFixed(6)}
          </span>
          <span
            className="text-[#DCDDCC] text-lg font-medium"
            style={{ fontFamily: 'Spectral, serif' }}
          >
            ETH
          </span>
        </div>
      </div>
      {/* Corner accents */}
      <div className="absolute top-2 left-2 w-2 h-2 border-l-2 border-t-2 border-[#D0B264]/40 rounded-tl-lg" />
      <div className="absolute top-2 right-2 w-2 h-2 border-r-2 border-t-2 border-[#D0B264]/40 rounded-tr-lg" />
      <div className="absolute bottom-2 left-2 w-2 h-2 border-l-2 border-b-2 border-[#D0B264]/40 rounded-bl-lg" />
      <div className="absolute bottom-2 right-2 w-2 h-2 border-r-2 border-b-2 border-[#D0B264]/40 rounded-br-lg" />
    </div>
  );
};

const TotalAllocationSquare: React.FC<{ totalSupply: bigint }> = ({ totalSupply }) => {
  const totalSupplyNumber = totalSupply ? Number(formatEther(totalSupply)) : 0;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#231F20] to-[#0A0A0A] p-4">
      <div className="text-center">
        <h3
          className="text-[#D0B264] text-sm font-medium tracking-wider mb-3 uppercase"
          style={{ fontFamily: 'Spectral, serif' }}
        >
          Total Allocation
        </h3>
        <div className="flex flex-col items-center">
          <span
            className="text-white text-xl font-bold mb-1"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {totalSupplyNumber > 1000
              ? `${(totalSupplyNumber / 1000).toFixed(1)}K`
              : totalSupplyNumber.toFixed(0)}
          </span>
          <span
            className="text-[#DCDDCC] text-lg font-medium"
            style={{ fontFamily: 'Spectral, serif' }}
          >
            ACES
          </span>
        </div>
      </div>
      {/* Corner accents */}
      <div className="absolute top-2 left-2 w-2 h-2 border-l-2 border-t-2 border-[#D0B264]/40 rounded-tl-lg" />
      <div className="absolute top-2 right-2 w-2 h-2 border-r-2 border-t-2 border-[#D0B264]/40 rounded-tr-lg" />
      <div className="absolute bottom-2 left-2 w-2 h-2 border-l-2 border-b-2 border-[#D0B264]/40 rounded-bl-lg" />
      <div className="absolute bottom-2 right-2 w-2 h-2 border-r-2 border-b-2 border-[#D0B264]/40 rounded-br-lg" />
    </div>
  );
};

// Image tile component that mimics the infinite canvas drawing system
interface ImageTileProps {
  position: { x: number; y: number; width: number; height: number; type: string };
  imageUrl?: string;
  alt: string;
  tileKey: string;
  currentPrice: bigint;
  totalSupply: bigint;
}

const ImageTile: React.FC<ImageTileProps> = ({
  position,
  imageUrl,
  alt,
  tileKey,
  currentPrice,
  totalSupply,
}) => {
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
      {position.type === 'token-info' ? (
        // Render token info components
        tileKey === 'token-price' ? (
          <CurrentPriceSquare currentPrice={currentPrice} />
        ) : tileKey === 'token-allocation' ? (
          <TotalAllocationSquare totalSupply={totalSupply} />
        ) : null
      ) : (
        // Render image content for regular squares
        <>
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
        </>
      )}
    </div>
  );
};

// Main ICO Launch Page Component
const ICOLaunchPage: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { contractState } = useICOContracts();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1100); // Increased mobile breakpoint for wider content
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Get contract data with fallbacks
  const currentPrice = contractState?.currentPrice || BigInt(0);
  const totalSupply = contractState?.totalSupply || BigInt(0);
  const tokensSold = contractState?.tokensSold || BigInt(0);
  const totalETHRaised = contractState?.totalETHRaised || BigInt(0);
  const totalUSDCRaised = contractState?.totalUSDCRaised || BigInt(0);

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen w-full overflow-hidden"
      style={{
        fontFamily: 'Cinzel, serif',
        background: 'linear-gradient(180deg, #000000 0%, #1A1A1A 100%)',
      }}
    >
      {/* Add animated dots background */}
      <AnimatedDotsBackground
        opacity={0.22}
        dotSpacing={32}
        dotSize={1}
        animationSpeed={0.8}
        waveType="horizontal"
        minOpacity={0.08}
        className="z-0"
      />

      {/* Add a subtle radial gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(26, 26, 26, 0) 0%, rgba(0, 0, 0, 0.3) 100%)',
        }}
      />

      {/* Header - spans full width */}
      <div className="relative z-50">
        <LaunchHeader />
      </div>

      {/* Main Layout Container - content starts right after header */}
      <div className="relative w-full">
        {/* Image Grid Background - Hidden on mobile, positioned around content */}
        {!isMobile && (
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
            {/* Image positioning container - positioned relative to content start */}
            <div className="relative w-[1000px]">
              {Object.entries(imagePositions).map(([key, position]) => (
                <ImageTile
                  key={key}
                  position={position}
                  imageUrl={productMapping[key]}
                  alt={`Luxury asset ${key}`}
                  tileKey={key}
                  currentPrice={currentPrice}
                  totalSupply={totalSupply}
                />
              ))}
            </div>
          </div>
        )}

        {/* Central Content Area - 1000px max width, starts right after header */}
        <motion.div
          className="relative z-10 flex flex-col items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <div className="w-full max-w-[1000px] mx-auto">
            {/* Page Info Header - seamlessly connected to header */}
            {/* Combined: BUY ACES ICO NOW + Countdown + USDT Raised = 2 squares = 400px total */}
            <div className="w-full rounded-xl flex flex-col h-[400px]">
              {/* BUY ACES ICO NOW section */}
              <div className="w-full flex flex-col items-center py-4 flex-[1.2]">
                <h2
                  className="text-5xl font-bold text-white mb-2"
                  style={{
                    fontFamily: 'Cinzel, serif',
                    textShadow: '0 0 20px rgba(208, 178, 100, 0.3)',
                  }}
                >
                  BUY $ACES ICO NOW
                </h2>
                <p
                  className="text-lg text-[#DCDDCC] max-w-2xl text-center leading-relaxed"
                  style={{ fontFamily: 'Spectral, serif' }}
                >
                  Participate in the ACES ICO and own a piece of the future of luxury asset
                  tokenization.
                </p>
              </div>

              {/* Countdown Timer section */}
              <div className="w-full flex flex-col items-center justify-center rounded-xl flex-1">
                <CountdownTimer />
              </div>

              {/* USDT Raised section */}
              <div className="w-full flex flex-col items-center justify-center rounded-xl flex-1">
                <ProgressionBar
                  totalETHRaised={totalETHRaised}
                  totalUSDCRaised={totalUSDCRaised}
                  totalSupply={totalSupply}
                />
              </div>
            </div>

            {/* Token Info and Chart - 1 square = 200px high */}
            <div
              className="w-full max-w-[1000px] mx-auto flex items-center justify-center gap-0"
              style={{ height: '400px' }}
            >
              {/* Price Chart - Centered */}
              <div className="w-[600px] h-[400px] rounded-xl flex items-center justify-center overflow-hidden">
                <div className="w-full h-full">
                  <BondingCurveChart currentPrice={currentPrice} tokensSold={tokensSold} />
                </div>
              </div>
            </div>

            {/* Buy Button - 1 square high (200px) × 2 squares wide (400px) - centered */}
            <div className="flex items-center justify-center">
              <div className="w-[600px] border-b border-[#D0B264] rounded-xl">
                <BuyNowSection />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ICOLaunchPage;
