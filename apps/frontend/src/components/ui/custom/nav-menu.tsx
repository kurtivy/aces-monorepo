'use client';

import React, { useState, useEffect } from 'react';
import { Menu, X, Send } from 'lucide-react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  getDeviceCapabilities,
  getBrowserPerformanceSettings,
} from '../../../lib/utils/browser-utils';
import { useModal } from '@/lib/contexts/modal-context';

// Main navigation items
// Main navigation items
const mainNavItems = [
  // { href: '/launch', label: 'ICO Launch', external: false, action: 'navigate' },
  { href: '/launch', label: 'Launch', external: false, action: 'navigate' },
  // { href: '/verify', label: 'Verify', external: false, action: 'navigate' },
  { href: '/drops', label: 'Drops', external: false, action: 'navigate' },
  { href: '/about', label: 'About', external: false, action: 'modal' },
  { href: 'https://docs.aces.fun', label: 'Docs', external: true },
  { href: '/terms', label: 'Terms & PP', external: false, action: 'modal' },
];

// Custom X logo component (modern Twitter/X logo)
export const XIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// Custom Instagram logo component
export const InstagramIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

// Custom TikTok logo component
export const TikTokIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-.88-.05A6.33 6.33 0 0 0 5.16 20.5a6.33 6.33 0 0 0 10.86-4.43V7.83a8.24 8.24 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.2-.26z" />
  </svg>
);

const socialLinks = [
  { href: 'https://x.com/acesdotfun', label: 'X (Twitter)', external: true, icon: XIcon },
  { href: 'https://t.me/acesdotfun/', label: 'Telegram', external: true, icon: Send },
  {
    href: 'https://www.instagram.com/acesdotfun/',
    label: 'Instagram',
    external: true,
    icon: InstagramIcon,
  },
  { href: 'https://www.tiktok.com/@acesdotfun', label: 'TikTok', external: true, icon: TikTokIcon },
];

// Compact animations for the nav menu
const compactMenuVariants: Variants = {
  closed: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.15,
      ease: 'easeInOut',
    },
  },
  open: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const compactNavItemVariants: Variants = {
  closed: {
    opacity: 0,
    y: -10,
  },
  open: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.15,
      ease: 'easeOut',
    },
  },
};

interface NavMenuProps {
  className?: string;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

const NavMenu: React.FC<NavMenuProps> = ({
  className = '',
  isOpen: controlledIsOpen,
  onOpenChange,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = onOpenChange || setInternalIsOpen;

  // Modal context integration
  const { openAboutModal, openTermsModal } = useModal();

  // Hydration-safe performance detection - prevents SSR mismatch
  const [, setBrowserPerf] = useState<ReturnType<typeof getBrowserPerformanceSettings>>(() => ({
    targetFPS: 60,
    animationDuration: 300,
    mouseCheckInterval: 16,
    enableComplexDotPattern: true,
    enableImageSmoothing: true,
    useLinearEasing: false,
    frameThrottling: false,
    gradientCacheSize: 100,
    gradientCacheClearInterval: 60000,
  }));

  const [deviceCaps, setDeviceCaps] = useState<ReturnType<typeof getDeviceCapabilities>>(() => ({
    availableMemory: 2048,
    memoryPressure: 'medium' as const,
    hardwareConcurrency: 4,
    devicePixelRatio: 2,
    supportsWebGL: true,
    supportsOffscreenCanvas: false,
    performanceTier: 'medium' as const,
    isMobileSafari: false,
    screenSize: { width: 375, height: 812 },
    touchCapable: true,
    orientationCapable: true,
    pixelDensityCategory: 'high' as const,
  }));

  // Update browser settings after hydration to get real performance values
  useEffect(() => {
    setBrowserPerf(getBrowserPerformanceSettings());
    setDeviceCaps(getDeviceCapabilities());
  }, []);

  // Mobile device detection
  const isMobileDevice = deviceCaps.touchCapable && deviceCaps.screenSize.width < 768;

  return (
    <div className={`relative ${className}`}>
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            className="absolute top-0 right-16 bg-black/95 border border-[#D0B264]/40 text-[#D0B264] rounded-lg overflow-hidden shadow-lg min-w-[180px] z-50"
            variants={compactMenuVariants}
            initial="closed"
            animate="open"
            exit="closed"
            style={{
              willChange: isMobileDevice ? 'opacity' : 'transform, opacity',
            }}
          >
            <div className="p-3">
              {/* Main Navigation Items */}
              <div className="space-y-1 border-b border-[#D0B264]/20 mb-3 pb-3">
                {mainNavItems.map((item, index) => (
                  <motion.div
                    key={item.href}
                    variants={compactNavItemVariants}
                    custom={index}
                    style={{ willChange: isMobileDevice ? 'opacity' : 'transform, opacity' }}
                  >
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setIsOpen(false)}
                        className="block text-[#D0B264] hover:text-[#D0B264]/80 hover:bg-[#D0B264]/10 transition-colors duration-150 px-2 py-1.5 text-sm font-medium rounded-md whitespace-nowrap uppercase tracking-wide"
                      >
                        {item.label}
                      </a>
                    ) : item.action === 'modal' ? (
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          if (item.href === '/about') {
                            openAboutModal();
                          } else if (item.href === '/terms') {
                            openTermsModal();
                          }
                        }}
                        className="block w-full text-left text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 px-2 py-1.5 text-sm font-medium rounded-md whitespace-nowrap uppercase tracking-wide"
                      >
                        {item.label}
                      </button>
                    ) : (
                      <a
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className="block text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 px-2 py-1.5 text-sm font-medium rounded-md whitespace-nowrap uppercase tracking-wide"
                      >
                        {item.label}
                      </a>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Social Links Footer */}
              <div>
                <div className="flex justify-center space-x-3">
                  {socialLinks.map((social, index) => {
                    const IconComponent = social.icon;
                    return (
                      <motion.div
                        key={social.href}
                        variants={compactNavItemVariants}
                        custom={mainNavItems.length + index}
                        style={{
                          willChange: isMobileDevice ? 'opacity' : 'transform, opacity',
                        }}
                      >
                        <a
                          href={social.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setIsOpen(false)}
                          className="flex items-center justify-center w-8 h-8 text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 rounded-full"
                          aria-label={social.label}
                        >
                          <IconComponent size={14} />
                        </a>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact Hamburger Menu Button */}
      <motion.button
        className="w-12 h-12 sm:w-14 sm:h-14 bg-black/90 border border-[#D0B284]/40 text-[#D0B284] hover:text-[#D0B264]/80 hover:bg-black/95 hover:border-[#D0B284] transition-colors duration-150 flex items-center justify-center rounded-full shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={isMobileDevice ? undefined : { scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={
          isMobileDevice ? { duration: 0.1 } : { type: 'spring', stiffness: 300, damping: 20 }
        }
        style={{ willChange: 'transform' }}
      >
        <motion.div
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          style={{ willChange: 'transform' }}
        >
          {isOpen ? <X className="h-8 w-8" /> : <Menu className="h-8 w-8" />}
        </motion.div>
      </motion.button>
    </div>
  );
};

export default NavMenu;
