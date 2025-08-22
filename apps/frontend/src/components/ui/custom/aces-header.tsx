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
    <header className={`w-full  ${className}`}>
      <div className="max-w-[1920px] mx-auto px-6 py-4">
        <div
          className={`grid items-center w-full ${title ? 'grid-cols-[250px_1fr_250px]' : 'grid-cols-[250px_1fr]'}`}
        >
          {/* Left side - ACES.FUN Logo and Text */}
          <div className="flex items-center gap-4 min-w-[250px]">
            {/* Clickable Logo Only */}
            <button
              onClick={handleLogoClick}
              className="w-14 h-14 flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity duration-200 focus:outline-none"
              aria-label="Navigate to home page"
            >
              <Image
                src="/aces-logo.png"
                alt="ACES Logo"
                width={56}
                height={56}
                className="w-12 h-12 object-contain"
              />
            </button>
            {/* Non-clickable Text */}
            <div className="flex items-center">
              <span className="text-2xl font-bold text-white mr-1 font-braah-one">ACES.</span>
              <span className="text-2xl font-bold ml-1 drop-shadow-lg font-spray-letters text-[#D7BF75] tracking-widest">
                FUN
              </span>
            </div>
          </div>

          {/* Center - Title (conditionally rendered) */}
          {title && (
            <div className="flex justify-center px-4">
              <h1
                className="text-xl sm:text-2xl lg:text-3xl text-center whitespace-nowrap text-[#D0B284] text-shadow-lg/30 text-shadow-[#231F20]"
                style={{ fontFamily: 'Spray Letters' }}
              >
                {title}
              </h1>
            </div>
          )}

          {/* Right side - Connect Wallet and Nav Menu */}
          <div className="flex items-center justify-end min-w-[250px]">
            <ConnectWalletNav onProfileClick={onProfileClick} />
          </div>
        </div>
      </div>
    </header>
  );
}
