import Image from 'next/image';
import React from 'react';
import SocialIcons from '../ui/custom/social-icons';

interface LaunchFooterProps {
  onTermsClick?: () => void;
}

const LaunchFooter = ({ onTermsClick }: LaunchFooterProps) => {
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <footer className="w-full bg-black border-t border-[#D0B284]/30 rounded-t-xl py-4 sm:py-6 px-2 sm:px-4">
      <div className="max-w-7xl mx-auto">
        {/* Social Icons Section */}
        <SocialIcons className="mb-3 sm:mb-4" />

        {/* Divider */}
        <div className="border-t border-[#D0B284]/30 mb-3 sm:mb-4"></div>

        {/* Main Footer Content */}
        <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
          {/* Left side - Logo/Brand */}
          <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
            <div className="flex items-center space-x-2">
              <div className="w-5 sm:w-6 h-5 sm:h-6 rounded-sm flex items-center justify-center">
                <Image
                  src="/aces-logo.png"
                  alt="ACES Logo"
                  className="w-4 sm:w-5 h-4 sm:h-5"
                  draggable={false}
                  width={20}
                  height={20}
                />
              </div>
              <span className="text-white text-sm sm:text-base">ACEofBASE</span>
            </div>
            <div className="text-[#DCDDCC] text-xs sm:text-sm text-center">
              © 2021-2025 Ace Of Base. All Rights Reserved.
            </div>
          </div>

          {/* Center - Terms of Use */}
          <div className="flex justify-center order-2 sm:order-2">
            {onTermsClick ? (
              <button
                onClick={onTermsClick}
                className="text-[#DCDDCC] hover:text-[#D0B284]/80 transition-colors text-xs sm:text-sm"
              >
                Terms of Use
              </button>
            ) : (
              <a
                href="#"
                className="text-[#D0B284] hover:text-[#D0B284]/80 transition-colors text-xs sm:text-sm"
              >
                Terms of Use
              </a>
            )}
          </div>

          {/* Right side - Token Address (Desktop Only) */}
          <div className="hidden sm:flex items-center space-x-4 order-3">
            <div className="flex items-center gap-2 rounded-md bg-[#231F20]/60 px-2 py-1.5 border border-[#D0B284]/20">
              <span className="text-xs text-[#DCDDCC] font-mono">0x553376...0367</span>
              <button
                onClick={() => copyToClipboard('0x55337650856299363c496065C836B9C6E9dE0367')}
                className="flex h-5 w-5 items-center justify-center rounded bg-[#D0B284]/10 hover:bg-[#D0B284]/20 transition-colors border border-[#D0B284]/20"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#D0B284"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LaunchFooter;
