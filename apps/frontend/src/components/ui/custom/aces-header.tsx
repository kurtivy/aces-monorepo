'use client';

import Image from 'next/image';
import ConnectWalletProfile from './connect-wallet-profile';

interface AcesHeaderProps {
  className?: string;
  title?: string;
  onAboutClick?: () => void;
  onTermsClick?: () => void;
  onProfileClick?: () => void;
}

export default function AcesHeader({
  className = '',
  title = '1991 Porsche 964 Turbo Rubystone Red',
  onAboutClick,
  onTermsClick,
  onProfileClick,
}: AcesHeaderProps) {
  return (
    <header className={`w-full bg-[#231F20]/30 border-b border-[#D0B284]/20 ${className}`}>
      <div className="max-w-[1920px] mx-auto px-6 py-4">
        <div className="grid grid-cols-[250px_1fr_250px] items-center w-full">
          {/* Left side - ACES.FUN Logo */}
          <div className="flex items-center gap-4 min-w-[250px]">
            <div className="w-12 h-12 flex items-center justify-center overflow-hidden">
              <Image
                src="/aces-logo.png"
                alt="ACES Logo"
                width={48}
                height={48}
                className="w-10 h-10 object-contain"
              />
            </div>
            <div className="flex items-center">
              <span
                className="text-2xl font-bold text-white mr-1"
                style={{ fontFamily: 'var(--font-heading), sans-serif' }}
              >
                ACES.
              </span>
              <span
                className="text-2xl font-bold ml-1 drop-shadow-lg"
                style={{
                  fontFamily: 'Spray Letters',
                  fontWeight: '400',
                  letterSpacing: '0.1em',
                  color: '#D7BF75',
                  textShadow: '0 0 30px rgba(215, 191, 117, 0.2)',
                }}
              >
                FUN
              </span>
            </div>
          </div>

          {/* Center - Title (perfectly centered) */}
          <div className="flex justify-center px-4">
            <h1
              className="text-xl sm:text-2xl lg:text-3xl text-center whitespace-nowrap text-[#D0B284] text-shadow-lg/30 text-shadow-[#231F20]"
              style={{ fontFamily: 'Spray Letters' }}
            >
              {title}
            </h1>
          </div>

          {/* Right side - Connect Wallet and Nav Menu */}
          <div className="flex items-center justify-end min-w-[250px]">
            <ConnectWalletProfile
              onAboutClick={onAboutClick}
              onTermsClick={onTermsClick}
              onProfileClick={onProfileClick}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
