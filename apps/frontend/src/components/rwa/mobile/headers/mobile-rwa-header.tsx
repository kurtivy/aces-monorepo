'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import ConnectWalletProfile from '@/components/ui/custom/connect-wallet-profile';
import NavMenu from '@/components/ui/custom/nav-menu';

interface MobileRWAHeaderProps {
  title?: string;
}

export default function MobileRWAHeader({ title }: MobileRWAHeaderProps) {
  const router = useRouter();
  const [openDropdown, setOpenDropdown] = useState<'wallet' | 'nav' | null>(null);

  // Prefetch home page when header mounts so logo click feels instant
  useEffect(() => {
    router.prefetch('/');
  }, [router]);

  const handleWalletDropdownChange = (isOpen: boolean) => {
    setOpenDropdown(isOpen ? 'wallet' : null);
  };

  const handleNavDropdownChange = (isOpen: boolean) => {
    setOpenDropdown(isOpen ? 'nav' : null);
  };

  return (
    <header className="w-full bg-[#151c16] relative z-50 flex-shrink-0 shadow-lg/5">
      <div className="px-4 py-3">
        {title ? <span className="sr-only">{title}</span> : null}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <div className="flex items-center">
            <Link
              href="/"
              className="w-8 h-8 flex items-center justify-center overflow-hidden rounded-full border border-[#D0B284]/20 bg-[#0f1510] transition-opacity duration-200 hover:opacity-80"
              aria-label="Go to ACES home"
            >
              <Image
                src="/aces-logo.png"
                alt="ACES Logo"
                width={32}
                height={32}
                className="w-6 h-6 object-contain"
              />
            </Link>
          </div>

          <ConnectWalletProfile
            className="justify-self-center flex justify-center"
            isDropdownOpen={openDropdown === 'wallet'}
            onDropdownChange={handleWalletDropdownChange}
          />

          <NavMenu
            className="justify-self-end"
            isOpen={openDropdown === 'nav'}
            onOpenChange={handleNavDropdownChange}
          />
        </div>
      </div>

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
