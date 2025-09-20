'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ConnectWalletNav from './connect-wallet-nav';

interface AcesHeaderProps {
  className?: string;
  title?: string;
  onProfileClick?: () => void;
}

export default function AcesHeader({ className = '', title, onProfileClick }: AcesHeaderProps) {
  const router = useRouter();

  const handleLogoClick = () => {
    router.push('/');
  };

  return (
    <header data-aces-header className={`w-full relative ${className}`}>
      <div className="max-w-[1920px] mx-auto px-3 sm:px-6 py-2 sm:py-4">
        <div
          className={`grid items-center w-full ${title ? 'grid-cols-[1fr_auto_1fr] sm:grid-cols-[250px_1fr_250px]' : 'grid-cols-[1fr_auto] sm:grid-cols-[250px_1fr]'}`}
        >
          {/* Left side - ACES.FUN Logo and Text */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 sm:min-w-[250px]">
            {/* Clickable Logo Only */}
            <button
              onClick={handleLogoClick}
              className="w-8 h-8 sm:w-14 sm:h-14 flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity duration-200 focus:outline-none flex-shrink-0 cursor-pointer"
              aria-label="Navigate to home page"
            >
              <Image
                src="/aces-logo.png"
                alt="ACES Logo"
                width={56}
                height={56}
                className="w-6 h-6 sm:w-12 sm:h-12 object-contain"
              />
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
          </div>

          {/* Center - Title (conditionally rendered) */}
          {title && (
            <div className="flex justify-center px-2 sm:px-4 min-w-0">
              <h1
                className="text-sm sm:text-xl lg:text-2xl xl:text-3xl text-center truncate sm:whitespace-nowrap text-[#D0B284] text-shadow-lg/30 text-shadow-[#231F20]"
                style={{ fontFamily: 'Spray Letters' }}
              >
                {title}
              </h1>
            </div>
          )}

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
