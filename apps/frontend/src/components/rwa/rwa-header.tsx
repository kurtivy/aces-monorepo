'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ConnectWalletNav from '../ui/custom/connect-wallet-nav';
// import { useAcesPrice } from '@/hooks/use-aces-price';

interface RWAHeaderProps {
  className?: string;
  onProfileClick?: () => void;
}

export default function RWAHeader({ className = '', onProfileClick }: RWAHeaderProps) {
  const router = useRouter();
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoError, setLogoError] = useState(false);
  // const { acesUsdPrice, loading: priceLoading, error: priceError } = useAcesPrice();

  const handleLogoClick = () => {
    router.push('/');
  };

  const handleLogoLoad = () => {
    setLogoLoaded(true);
    setLogoError(false);
  };

  const handleLogoError = () => {
    setLogoError(true);
    setLogoLoaded(false);
    console.error('Failed to load ACES logo');
  };

  const formatPrice = (price: number) => {
    if (price >= 1) {
      return `$${price.toFixed(2)}`;
    } else if (price >= 0.01) {
      return `$${price.toFixed(4)}`;
    } else {
      return `$${price.toFixed(6)}`;
    }
  };

  return (
    <header data-rwa-header className={`w-full relative bg-[#151C16] ${className}`}>
      <div className="max-w-[1920px] mx-auto px-3 sm:px-6 py-1.5 sm:py-2.5">
        <div className="grid items-center w-full grid-cols-[1fr_auto] sm:grid-cols-[250px_1fr]">
          {/* Left side - ACES.FUN Logo and Text */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 sm:min-w-[250px]">
            {/* Clickable Logo Only */}
            <button
              onClick={handleLogoClick}
              className="w-8 h-8 sm:w-14 sm:h-14 flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity duration-200 focus:outline-none flex-shrink-0 cursor-pointer relative"
              aria-label="Navigate to home page"
            >
              {!logoError ? (
                <Image
                  src="/aces-logo.png"
                  alt="ACES Logo"
                  width={56}
                  height={56}
                  className={`w-6 h-6 sm:w-12 sm:h-12 object-contain transition-opacity duration-200 ${
                    logoLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  priority
                  onLoad={handleLogoLoad}
                  onError={handleLogoError}
                />
              ) : (
                <div className="w-6 h-6 sm:w-12 sm:h-12 bg-[#D0B284]/20 rounded-full"></div>
              )}
              {!logoLoaded && !logoError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 sm:w-6 sm:h-6 border border-[#D0B284]/30 border-t-[#D0B284] rounded-full animate-spin"></div>
                </div>
              )}
            </button>
            {/* Non-clickable Text - Hidden on mobile, visible on desktop */}
            <div className="hidden sm:flex items-center min-w-0">
              <span className="text-lg sm:text-2xl font-bold text-white mr-0.5 sm:mr-1 font-braah-one">
                ACES.
              </span>
              <span className="text-lg sm:text-2xl font-bold ml-0.5 sm:ml-1 drop-shadow-lg font-spray-letters text-[#D7BF75] tracking-wider sm:tracking-widest">
                FUN
              </span>
            </div>

            {/* ACES Price Display */}
            <div className="hidden sm:flex items-center pl-30">
              {/* <div className="flex items-center gap-1">
                {priceLoading ? (
                  <div className="w-16 h-4 bg-[#D0B284]/20 rounded animate-pulse"></div>
                ) : priceError ? (
                  <span className="text-xs text-red-400">--</span>
                ) : (
                  <span className="text-sm font-medium text-[#D0B284] font-mono">
                    {formatPrice(acesUsdPrice)}
                  </span>
                )}
              </div> */}
            </div>
          </div>

          {/* Right side - Connect Wallet and Nav Menu */}
          <div className="flex items-center justify-end min-w-[120px] sm:min-w-[250px]">
            <ConnectWalletNav onProfileClick={onProfileClick} />
          </div>
        </div>
      </div>
      {/* Full-width dashed bottom border to match ACES design */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="8"
        viewBox="0 0 100 2"
        preserveAspectRatio="none"
        className="pointer-events-none absolute left-0 right-0 bottom-0"
      >
        <line
          x1="0"
          y1="1"
          x2="100"
          y2="1"
          stroke="#D7BF75"
          strokeOpacity={0.5}
          strokeWidth={1}
          strokeDasharray="12 12"
          vectorEffect="non-scaling-stroke"
          shapeRendering="crispEdges"
        />
      </svg>
    </header>
  );
}
