'use client';

import type React from 'react';
import { useState } from 'react';
import ConnectWalletProfile from './connect-wallet-profile';
import NavMenu from './nav-menu';

export interface ConnectWalletNavProps {
  className?: string;
  onProfileClick?: () => void;
  isMobileHeader?: boolean;
}

type OpenDropdown = 'wallet' | 'nav' | null;

export default function ConnectWalletNav({
  className = '',
  // onProfileClick,
  isMobileHeader = false,
}: ConnectWalletNavProps) {
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);

  const containerClassName = [
    'flex items-center gap-2 relative',
    isMobileHeader ? 'justify-center w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleWalletDropdownChange = (isOpen: boolean) => {
    setOpenDropdown(isOpen ? 'wallet' : null);
  };

  const handleNavDropdownChange = (isOpen: boolean) => {
    setOpenDropdown(isOpen ? 'nav' : null);
  };

  return (
    <div className={containerClassName}>
      {/* Wallet Profile Component */}
      <ConnectWalletProfile
        // onProfileClick={onProfileClick}
        isDropdownOpen={openDropdown === 'wallet'}
        onDropdownChange={handleWalletDropdownChange}
      />

      {/* Vertical Line Separator */}
      <div className="w-px h-6 bg-[#D0B264] mx-2" />

      {/* Navigation Menu Component */}
      <NavMenu isOpen={openDropdown === 'nav'} onOpenChange={handleNavDropdownChange} />
    </div>
  );
}
