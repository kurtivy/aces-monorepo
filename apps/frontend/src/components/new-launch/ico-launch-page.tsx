'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
// import AcesHeader from '@/components/ui/custom/aces-header';
import LaunchHeader from './launch-header';
import Image from 'next/image';
import BondingCurveChart from './bonding-curve-chart';
import CountdownTimer from './countdown-timer';
import ProgressionBar from './progression-bar';
import BuyNowSection from './buy-now';
import AnimatedDotsBackground from '../ui/custom/animated-dots-background';
import { useBondingCurveContracts } from '@/hooks/contracts/use-bonding-curve-contract';
import { useAuth } from '@/lib/auth/auth-context';
import { usePageLoading } from '@/hooks/use-page-loading';
import { formatEther } from 'viem';
import Footer from '@/components/ui/custom/footer';
import LaunchIntroAnimation from '../loading/launch-intro-animation';

// Import skeleton components
import {
  ImageTileSkeleton,
  TokenInfoSkeleton,
  BuyNowSkeleton,
  CountdownSkeleton,
  ProgressionSkeleton,
  ChartSkeleton,
} from './skeleton-components';

// Image positioning system - 200x200px squares, no gaps, RIGHT AGAINST content edges
// Main content = 5 squares wide (1000px), images positioned directly adjacent
const imagePositions = {
  // Left side - positioned directly against left edge of content, starting from header
  'square-1': { x: -200, y: 0, width: 200, height: 200, type: 'square' },
  'square-2': { x: -400, y: 0, width: 200, height: 200, type: 'square' },
  'square-3': { x: -200, y: 400, width: 200, height: 200, type: 'square' },
  'square-4': { x: -200, y: 600, width: 200, height: 200, type: 'square' },
  // 'square-5': { x: 0, y: 600, width: 200, height: 200, type: 'square' },

  // Right side - positioned directly against right edge of content (1000px + 0px = 1000px)
  'square-6': { x: 1200, y: 0, width: 200, height: 200, type: 'square' },
  'square-7': { x: 1000, y: 200, width: 200, height: 200, type: 'square' },
  'square-8': { x: 1000, y: 0, width: 200, height: 200, type: 'square' },
  'square-9': { x: -400, y: 1000, width: 200, height: 200, type: 'square' },
  // 'square-10': { x: 800, y: 600, width: 200, height: 200, type: 'square' },

  'square-11': { x: 1000, y: 800, width: 200, height: 200, type: 'square' },
  'square-12': { x: 1200, y: 800, width: 200, height: 200, type: 'square' },
  'square-13': { x: 800, y: 800, width: 200, height: 200, type: 'square' },
  'square-14': { x: -200, y: 1000, width: 200, height: 200, type: 'square' },
  'square-15': { x: 0, y: 1000, width: 200, height: 200, type: 'square' },
  'square-16': { x: 1200, y: 1000, width: 200, height: 200, type: 'square' },
  'square-17': { x: 1200, y: 600, width: 200, height: 200, type: 'square' },
  'square-18': { x: -400, y: 800, width: 200, height: 200, type: 'square' },

  //new
  'square-19': { x: -600, y: 0, width: 200, height: 200, type: 'square' },
  'square-20': { x: -600, y: 400, width: 200, height: 200, type: 'square' },
  'square-21': { x: -600, y: 200, width: 200, height: 200, type: 'square' },
  'square-22': { x: -600, y: 1000, width: 200, height: 200, type: 'square' },
  //new
  'square-23': { x: 1400, y: 0, width: 200, height: 200, type: 'square' },
  'square-24': { x: 1400, y: 200, width: 200, height: 200, type: 'square' },
  'square-25': { x: 1400, y: 400, width: 200, height: 200, type: 'square' },
  'square-26': { x: 1400, y: 1000, width: 200, height: 200, type: 'square' },

  // Token Info Squares
  'token-price': { x: 0, y: 400, width: 200, height: 200, type: 'token-info' },
  'token-allocation': { x: 800, y: 400, width: 200, height: 200, type: 'token-info' },

  // Additional rectangles and squares for complete grid coverage
  'rect-horizontal-1': { x: -400, y: 200, width: 400, height: 200, type: 'horizontal' },
  'rect-horizontal-2': { x: -200, y: 800, width: 400, height: 200, type: 'horizontal' },
  'rect-horizontal-3': { x: 800, y: 1000, width: 400, height: 200, type: 'horizontal' },

  'rect-vertical-1': { x: -400, y: 400, width: 200, height: 400, type: 'vertical' },
  'rect-vertical-2': { x: 1200, y: 200, width: 200, height: 400, type: 'vertical' },
  'rect-vertical-3': { x: 1000, y: 400, width: 200, height: 400, type: 'vertical' },
  'rect-vertical-4': { x: -600, y: 600, width: 200, height: 400, type: 'vertical' },
  'rect-vertical-5': { x: 1400, y: 600, width: 200, height: 400, type: 'vertical' },
};

// Luxury product mapping - using the same high-end products as infinite canvas
const productMapping: Record<string, string> = {
  'square-1':
    '/canvas-images/outline/new/webp/Audemars-Piguet-Royal-Oak-Concept-KAWS-Tourbillon-Companion-Dial-Limited-Edition.webp',
  'square-2':
    '/canvas-images/outline/new/webp/Tom-Brady-New-England-Patriots-Autographed-Riddell-1982-1989-Throwback-Speed-Flex-Authentic-Helmet.webp',
  'square-3': '/canvas-images/outline/new/webp/Keith-Haring-1989.webp',
  'square-4': '/canvas-images/outline/new/webp/tokenize-your-shit.webp',
  'square-5': '/canvas-images/outline/new/webp/Nike-SB-Dunks-Freddy-Krueger.webp',
  'square-6': '/canvas-images/outline/new/webp/Andy-Warhol-Signed-Marilyn-Monroe.webp',
  'square-7': '/canvas-images/outline/new/webp/tokenize-your-shit.webp',
  'square-8':
    '/canvas-images/outline/new/webp/Hermes-Matte-Niloticus-Crocodile-Himalaya-Kelly-Retourne-32-White.webp',
  'square-9':
    '/canvas-images/outline/new/webp/Autographed-Jersey-Mathew-Barzal-New-York-Islanders.webp',
  'square-10': '/canvas-images/outline/new/webp/2010-Lamborghini-Murcielago-SV.webp',
  'square-11':
    '/canvas-images/outline/new/webp/Shohei-Ohtani-Los-Angeles-Angels-Autographed-Fanatics-Authentic-Game-Used-MLB-Baseball-from-2018-Rookie-Season-Limited-Edition-Number-1-of-5.webp',
  'square-12': '/canvas-images/outline/new/webp/Kanye-West-College-Dropout-Signed.webp',
  'square-13': '/canvas-images/outline/new/webp/Nike-SB-Dunks-Freddy-Krueger.webp',
  'square-14':
    '/canvas-images/outline/new/webp/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp',
  'square-15':
    '/canvas-images/outline/new/webp/Richard-Mille-RM-88-Automatic-Tourbillon-Smiley.webp',
  'square-16':
    '/canvas-images/outline/new/webp/The-Macallan-Red-Collection-Trunk-40yo-50yo-60yo-Limited-Edition.webp',
  'square-17': '/canvas-images/outline/new/webp/tokenize-your-shit.webp',
  'square-18': '/canvas-images/outline/new/webp/Hermes-Ostrich-Birkin-25.webp',
  'square-19': '/canvas-images/outline/new/webp/Original-iPhone-Apple.webp',
  'square-20': '/canvas-images/outline/new/webp/Louis-XIII-Rare-Cask-Cognac.webp',
  'square-21': '/canvas-images/outline/new/webp/tokenize-your-shit.webp',
  'square-22': '/canvas-images/outline/new/webp/tokenize-your-shit.webp',
  'square-23': '/canvas-images/outline/new/webp/Nike-SB-Dunks-Lobster.webp',
  'square-24': '/canvas-images/outline/new/webp/10xSouth-African-Gold-Krugerrands.webp',
  'square-25':
    '/canvas-images/outline/new/webp/Krug-Clos-dAmbonnay-Trilogy-Prestige-Champagne-Collection.webp',
  'square-26': '/canvas-images/outline/new/webp/tokenize-your-shit.webp',

  // Horizontal
  'rect-horizontal-1': '/canvas-images/outline/new/webp/2009-F1-McLaren-MP4-24.webp',
  'rect-horizontal-2': '/canvas-images/outline/new/webp/2010-Lamborghini-Murcielago-SV.webp',
  'rect-horizontal-3': '/canvas-images/outline/new/webp/2022-Azimut-Atlantis-45.webp',
  // Vertical
  'rect-vertical-1':
    '/canvas-images/outline/new/webp/Louis-Vuitton-Monogram-Alzer-11-Hard-Case-Trunk-Set-Brown.webp',
  'rect-vertical-2':
    '/canvas-images/outline/new/webp/Veuve-Clicquot-Champagne-Vertical-Limit-Fridge.webp',
  'rect-vertical-3': '/canvas-images/outline/new/webp/Tiffany-and-Co-Rimowa.webp',
  'rect-vertical-4':
    '/canvas-images/outline/new/webp/Veuve-Clicquot-Champagne-Vertical-Limit-Fridge.webp',
  'rect-vertical-5':
    '/canvas-images/outline/new/webp/Louis-Vuitton-Monogram-Alzer-11-Hard-Case-Trunk-Set-Brown.webp',
};

// Token Info Components - Updated to use new hooks
const CurrentPriceSquare: React.FC = () => {
  const { contractState, ethPrice } = useBondingCurveContracts();

  // Show loading state if contract data isn't ready
  if (!contractState || ethPrice.isLoading) {
    return <TokenInfoSkeleton />;
  }

  // Get the price for 1 share from the current price
  const nextSharePriceETH = contractState?.currentPrice
    ? Number(formatEther(contractState.currentPrice))
    : 0;

  // Use LIVE ETH price from the reliable price hook
  const liveETHPriceUSD = ethPrice.current;
  const nextSharePriceUSD = nextSharePriceETH * liveETHPriceUSD;

  // Format price display - show more precision for small values with better UX for very small numbers
  const formatUSDPrice = (price: number) => {
    if (price === 0) return '0.00';
    if (price >= 1) return price.toFixed(4);
    if (price >= 0.01) return price.toFixed(6);
    if (price >= 0.001) return price.toFixed(8);
    if (price >= 0.0001) return price.toFixed(10);
    // For very small numbers, show in a more readable format
    if (price >= 0.000000001) {
      // Show as "< $0.000001" for very small values
      return '< 0.000001';
    }
    // For extremely small numbers, use scientific notation
    return price.toExponential(2);
  };

  const formatETHPrice = (price: number) => {
    if (price === 0) return '0.000000';
    if (price >= 0.01) return price.toFixed(6);
    if (price >= 0.001) return price.toFixed(9);
    if (price >= 0.0001) return price.toFixed(12);
    if (price >= 0.000000001) {
      // Show as "< 0.000001 ETH" for very small values
      return '< 0.000001';
    }
    // For extremely small numbers, use scientific notation
    return price.toExponential(2);
  };

  // Debug logging for price values
  // console.log('🏷️ [Price Display] Current Price Square:', {
  //   contractState: !!contractState,
  //   currentPrice: contractState?.currentPrice?.toString(),
  //   nextSharePriceETH,
  //   nextSharePriceUSD,
  //   liveETHPriceUSD,
  //   ethPriceLoading: ethPrice.isLoading,
  //   ethPriceError: ethPrice.error,
  // });
  // console.log('🎯 Price Debug:', {
  //   currentPriceWei: contractState?.currentPrice?.toString(),
  //   nextSharePriceETH,
  //   liveETHPriceUSD,
  //   nextSharePriceUSD,
  //   formatted: {
  //     usd: formatUSDPrice(nextSharePriceUSD),
  //     eth: formatETHPrice(nextSharePriceETH),
  //   },
  // });

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#231F20] to-[#0A0A0A] p-4 relative">
      <div className="text-center">
        <h3
          className="text-[#D0B264] text-sm font-medium tracking-wider mb-3 uppercase"
          style={{ fontFamily: 'system, serif' }}
        >
          Next Token Price
        </h3>
        <div className="flex flex-col items-center">
          {/* USD Price - Primary display */}
          <span
            className="text-white text-lg sm:text-xl font-bold mb-1"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            ${formatUSDPrice(nextSharePriceUSD)}
          </span>

          {/* ETH Price - Secondary display in brackets */}
          <span
            className="text-[#DCDDCC] text-xs sm:text-sm font-medium"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            ({formatETHPrice(nextSharePriceETH)} ETH)
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

const UserBalanceSquare: React.FC = () => {
  const { contractState, ethPrice } = useBondingCurveContracts();
  const { isAuthenticated, connectWallet } = useAuth();

  // If wallet not connected, show connect prompt
  if (!isAuthenticated) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#231F20] to-[#0A0A0A] p-4 cursor-pointer hover:bg-gradient-to-br hover:from-[#2A1F20] hover:to-[#1A0A0A] transition-all duration-300"
        onClick={connectWallet}
      >
        <div className="text-center">
          <h3
            className="text-[#D0B264] text-sm font-medium tracking-wider mb-3 uppercase"
            style={{ fontFamily: 'system, serif' }}
          >
            Your Balance
          </h3>
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 mx-auto mb-2 border border-[#D0B264] rounded-lg flex items-center justify-center">
              <svg
                className="w-4 h-4 text-[#D0B264]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <span
              className="text-[#D0B264] text-sm font-medium text-center leading-tight"
              style={{ fontFamily: 'system, serif' }}
            >
              Connect Wallet
              <br />
              <span className="text-xs text-[#928357]">to view balance</span>
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
  }

  // Show loading if contract data not ready
  if (!contractState) {
    return <TokenInfoSkeleton />;
  }

  // Get user's token balance from contract state (this is share count, not minted tokens)
  const userShareBalance = contractState?.tokenBalance
    ? Number(contractState.tokenBalance) // This is already in share count
    : 0;

  // Calculate USD value of user's shares
  const sharePriceETH = contractState?.currentPrice
    ? Number(formatEther(contractState.currentPrice))
    : 0;

  const ethPriceUSD = ethPrice?.current || 3000;
  const userBalanceUSD = userShareBalance * sharePriceETH * ethPriceUSD;

  // Format balance display
  const formatBalance = (balance: number) => {
    if (balance === 0) return '0';
    if (balance >= 1000000) return `${(balance / 1000000).toFixed(1)}M`;
    if (balance >= 1000) return `${(balance / 1000).toFixed(1)}K`;
    if (balance < 1) return balance.toFixed(3);
    return balance.toFixed(0);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#231F20] to-[#0A0A0A] p-4">
      <div className="text-center">
        <h3
          className="text-[#D0B264] text-sm font-medium tracking-wider mb-3 uppercase"
          style={{ fontFamily: 'system, serif' }}
        >
          Your Balance
        </h3>
        <div className="flex flex-col items-center">
          <span
            className="text-white text-base sm:text-lg font-bold mb-1"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {formatBalance(userShareBalance)}
          </span>
          <span
            className="text-[#DCDDCC] text-xs font-medium"
            style={{ fontFamily: 'system, serif' }}
          >
            ACES Tokens
          </span>
          {userShareBalance > 0 && (
            <span
              className="text-[#D0B264] text-xs font-medium mt-1"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              ≈ ${userBalanceUSD.toFixed(2)}
            </span>
          )}
          {userShareBalance === 0 && (
            <span
              className="text-[#928357] text-xs font-medium mt-1"
              style={{ fontFamily: 'system, serif' }}
            >
              No Tokens yet
            </span>
          )}
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
}

const ImageTile: React.FC<ImageTileProps> = ({ position, imageUrl, alt, tileKey }) => {
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
        // Render token info components - now they get their own data
        tileKey === 'token-price' ? (
          <CurrentPriceSquare />
        ) : tileKey === 'token-allocation' ? (
          <UserBalanceSquare />
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
  const [showIntroAnimation, setShowIntroAnimation] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const { contractState } = useBondingCurveContracts();

  // Get all image paths for preloading - filter out empty/invalid paths
  const imagePaths = Object.values(productMapping).filter(
    (path) => path && path.length > 0 && path !== '/canvas-images/outline/' && !path.endsWith('/'),
  );

  // Page loading coordination - now using real contract state since public data is available
  // Allow page to load in dev mode or on aceofbase domain
  const isDevMode = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const isAceofbaseDomain =
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('aceofbase') || (window as any).__ACEOFBASE_DOMAIN);

  const pageLoading = usePageLoading({
    imagePaths,
    contractReady: !!contractState || isDevMode || isAceofbaseDomain, // Allow loading on aceofbase domain
    enableIntroAnimation: true,
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1100);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle intro animation completion
  const handleIntroAnimationComplete = () => {
    setShowIntroAnimation(false);
  };

  // Debug logging for aceofbase domain
  useEffect(() => {
    if (isAceofbaseDomain) {
      console.log('🎯 Aceofbase domain detected:', {
        contractState: !!contractState,
        pageLoadingReady: pageLoading.isReady,
        showIntroAnimation,
        imagePaths: imagePaths.length,
      });
    }
  }, [
    contractState,
    pageLoading.isReady,
    showIntroAnimation,
    isAceofbaseDomain,
    imagePaths.length,
  ]);

  // Show launch intro animation while images and contract data load
  if (!pageLoading.isReady) {
    return (
      <>
        <LaunchIntroAnimation
          isComplete={false}
          onIntroAnimationComplete={() => {}}
          skipLetterAnimation={false}
        />
        {/* Pre-render the page structure for faster transition */}
        <div className="opacity-0 pointer-events-none fixed inset-0">
          <ICOPageContent isMobile={isMobile} containerRef={containerRef} isReady={false} />
        </div>
      </>
    );
  }

  // Show intro animation when ready, then transition to main content
  if (showIntroAnimation) {
    return (
      <>
        <LaunchIntroAnimation
          isComplete={pageLoading.isReady}
          onIntroAnimationComplete={handleIntroAnimationComplete}
          skipLetterAnimation={false}
        />
        {/* Pre-render the page structure for faster transition */}
        <div className="opacity-0 pointer-events-none fixed inset-0">
          <ICOPageContent isMobile={isMobile} containerRef={containerRef} isReady={true} />
        </div>
      </>
    );
  }

  // Page is ready and intro animation is complete - show main content
  return <ICOPageContent isMobile={isMobile} containerRef={containerRef} isReady={true} />;
};

// Separated page content for cleaner loading logic
interface ICOPageContentProps {
  isMobile: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isReady: boolean;
}

const ICOPageContent: React.FC<ICOPageContentProps> = ({ isMobile, containerRef, isReady }) => {
  return (
    <motion.div
      ref={containerRef}
      className="relative min-h-screen w-full overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #000000 0%, #1A1A1A 100%)',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: isReady ? 1 : 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      {/* Add animated dots background - reduced complexity during intro */}
      <AnimatedDotsBackground
        opacity={isReady ? 0.22 : 0.1}
        dotSpacing={isReady ? 32 : 48}
        dotSize={1}
        animationSpeed={isReady ? 0.8 : 0.3}
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
        {/* <AcesHeader /> */}
        <LaunchHeader />
      </div>

      {/* Main Layout Container - content starts right after header */}
      <div className="relative w-full" style={{ minHeight: isMobile ? '800px' : '1200px' }}>
        {/* Image Grid Background - Hidden on mobile, positioned around content */}
        {!isMobile && (
          <motion.div
            className="absolute top-0 left-1/2 transform -translate-x-1/2"
            initial={{ opacity: 0 }}
            animate={{ opacity: isReady ? 1 : 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
          >
            {/* Image positioning container - positioned relative to content start */}
            <div className="relative w-[1000px]">
              {Object.entries(imagePositions).map(([key, position]) =>
                isReady ? (
                  <ImageTile
                    key={key}
                    position={position}
                    imageUrl={productMapping[key]}
                    alt={`Luxury asset ${key}`}
                    tileKey={key}
                  />
                ) : (
                  <ImageTileSkeleton key={key} position={position} />
                ),
              )}
            </div>
          </motion.div>
        )}

        {/* Central Content Area - responsive width, starts right after header */}
        <motion.div
          className="relative z-10 flex flex-col items-center px-4 sm:px-6 lg:px-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: isReady ? 1 : 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
        >
          <div className="w-full max-w-[1000px] mx-auto">
            {/* BUY ACES ICO NOW Header */}
            <div className="w-full flex flex-col items-center py-4 mb-4">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 tracking-widest font-proxima-nova text-center">
                BUY $ACES TOKEN NOW
              </h2>
              <p className="text-sm sm:text-base text-[#DCDDCC] max-w-2xl text-center leading-relaxed font-proxima-nova px-4">
                Participate in the ACES Token launch and own a piece of the future of luxury asset
                tokenization.
              </p>
            </div>

            {/* Buy Now Section - standalone */}
            <motion.div
              className="w-full mx-auto flex items-center justify-center mb-4 px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: isReady ? 1 : 0 }}
              transition={{ duration: 0.4, delay: 0.3, ease: 'easeOut' }}
            >
              <div className="w-full max-w-[600px]">
                {isReady ? <BuyNowSection /> : <BuyNowSkeleton />}
              </div>
            </motion.div>

            {/* Countdown Timer section - standalone */}
            <motion.div
              className="w-full flex flex-col items-center justify-center mb-4 px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: isReady ? 1 : 0 }}
              transition={{ duration: 0.4, delay: 0.4, ease: 'easeOut' }}
            >
              {isReady ? <CountdownTimer /> : <CountdownSkeleton />}
            </motion.div>

            {/* Progression Bar - No props needed, gets data from hook */}
            <motion.div
              className="w-full flex flex-col items-center justify-center mb-8 sm:mb-12 relative z-10 px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: isReady ? 1 : 0 }}
              transition={{ duration: 0.4, delay: 0.5, ease: 'easeOut' }}
            >
              {isReady ? <ProgressionBar /> : <ProgressionSkeleton />}
            </motion.div>

            {/* Bonding Curve Chart - No props needed, gets data from hook */}
            <motion.div
              className="w-full mx-auto flex items-center justify-center relative z-0 px-4"
              style={{ minHeight: isMobile ? '350px' : '500px' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: isReady ? 1 : 0 }}
              transition={{ duration: 0.4, delay: 0.6, ease: 'easeOut' }}
            >
              {/* Chart - Responsive sizing */}
              <div
                className={`w-full max-w-[600px] rounded-xl flex items-center justify-center overflow-hidden ${isMobile ? 'h-[350px]' : 'h-[500px]'}`}
              >
                <div className="w-full h-full">
                  {isReady ? <BondingCurveChart /> : <ChartSkeleton />}
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Footer positioned to sit flush with bottom of images */}
      <motion.div
        className="relative border-0.5 border-t rounded-t-xl border-[#D0B264]"
        initial={{ opacity: 0 }}
        animate={{ opacity: isReady ? 1 : 0 }}
        transition={{ duration: 0.4, delay: 0.7, ease: 'easeOut' }}
      >
        <Footer />
      </motion.div>
    </motion.div>
  );
};

export default ICOLaunchPage;
