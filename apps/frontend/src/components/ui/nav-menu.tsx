'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Menu, X, Send } from 'lucide-react';
import Link from 'next/link';
import {
  getBrowserPerformanceSettings,
  getDeviceCapabilities,
} from '../../lib/utils/browser-utils';
import {
  addEventListenerSafe,
  removeEventListenerSafe,
} from '../../lib/utils/event-listener-utils';

// Custom icons
const XIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const InstagramIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
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

const TikTokIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-.88-.05A6.33 6.33 0 0 0 5.16 20.5a6.33 6.33 0 0 0 10.86-4.43V7.83a8.24 8.24 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.2-.26z" />
  </svg>
);

const mainNavItems = [
  { href: '/create-token', label: 'Create Token', external: false },
  { href: '/about', label: 'About', external: false },
  { href: '/terms', label: 'Terms & PP', external: false },
];

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

const NavMenu: React.FC = () => {
  // DEFAULT: Menu starts CLOSED
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isToggling = useRef(false); // Use ref instead of state to avoid re-renders

  // Hydration-safe performance detection - prevents SSR mismatch
  const [browserPerf, setBrowserPerf] = useState<ReturnType<typeof getBrowserPerformanceSettings>>(
    () => ({
      targetFPS: 60,
      animationDuration: 300,
      mouseCheckInterval: 16,
      enableComplexDotPattern: true,
      enableImageSmoothing: true,
      useLinearEasing: false,
      frameThrottling: false,
      gradientCacheSize: 100,
      gradientCacheClearInterval: 60000,
    }),
  );

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

  // Clear any existing timeout to prevent stuck states
  const clearExistingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    isToggling.current = false;
  }, []);

  const handleToggle = useCallback(() => {
    // Prevent rapid clicking while respecting user intent
    if (isToggling.current) {
      return;
    }

    // Clear any existing timeout first
    clearExistingTimeout();

    // Mark as toggling
    isToggling.current = true;

    // Toggle the state
    setIsOpen((prev) => {
      const newState = !prev;
      return newState;
    });

    // Set timeout to clear toggling flag
    timeoutRef.current = setTimeout(() => {
      isToggling.current = false;
      timeoutRef.current = null;
    }, browserPerf.animationDuration + 50); // Add small buffer
  }, [isOpen, browserPerf.animationDuration, clearExistingTimeout]);

  // Outside click handler with improved logic
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: Event) => {
      const target = event.target as Node;

      // Check if click is inside menu or on toggle button
      if (menuRef.current && !menuRef.current.contains(target)) {
        // Find the toggle button to check if it was clicked
        const toggleButton = document.querySelector('[data-nav-toggle]');
        if (toggleButton && toggleButton.contains(target)) {
          // Click was on toggle button, let handleToggle handle it
          return;
        }

        clearExistingTimeout();
        setIsOpen(false);
      }
    };

    const result = addEventListenerSafe(document, 'click', handleOutsideClick);

    return () => {
      if (result.success) {
        removeEventListenerSafe(document, 'click', handleOutsideClick);
      }
    };
  }, [isOpen, clearExistingTimeout]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      clearExistingTimeout();
    };
  }, [clearExistingTimeout]);

  // Get animation duration and determine if we should use animations
  const animationDuration = browserPerf.animationDuration;
  const useAnimations = deviceCaps.performanceTier !== 'low';

  // Close menu when clicking nav links
  const handleNavClick = useCallback(() => {
    clearExistingTimeout();
    setIsOpen(false);
  }, [clearExistingTimeout]);

  return (
    <div className="fixed top-4 right-4 z-50 flex items-start gap-2">
      {/* Menu Panel - Conditional rendering based on state */}
      {isOpen && (
        <div
          ref={menuRef}
          className={`
            bg-black/95 border border-[#D0B264]/40 rounded-lg overflow-hidden 
            max-w-[calc(100vw-5rem)] backdrop-blur-sm
            ${useAnimations ? 'transition-all duration-300 ease-out' : ''}
            opacity-100 translate-x-0 scale-100
          `}
          style={{
            transitionDuration: useAnimations ? `${animationDuration}ms` : '0ms',
          }}
        >
          <div className="p-3 sm:p-4 min-w-[160px] sm:min-w-[180px]">
            {/* Main Navigation */}
            <div className="space-y-1">
              {mainNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleNavClick}
                  className="block text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 px-2 py-1.5 sm:px-3 sm:py-2 text-sm font-medium rounded-md whitespace-nowrap uppercase font-spectral tracking-wide"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Social Links */}
            <div className="border-t border-[#D0B264]/20 mt-3 pt-3">
              <div className="flex justify-center space-x-2 sm:space-x-4">
                {socialLinks.map((social) => {
                  const IconComponent = social.icon;
                  return (
                    <a
                      key={social.href}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleNavClick}
                      className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 rounded-full"
                      aria-label={social.label}
                    >
                      <IconComponent size={16} className="sm:w-5 sm:h-5" />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        data-nav-toggle // Add data attribute for outside click detection
        className={`
          bg-black/90 border border-[#D0B264]/40 text-[#D0B264] 
          rounded-full w-12 h-12 sm:w-16 sm:h-16 
          flex items-center justify-center cursor-pointer flex-shrink-0 
          hover:bg-black/95 hover:border-[#D0B264] 
          transition-colors duration-150
          ${useAnimations && deviceCaps.performanceTier === 'high' ? 'hover:scale-105 transition-transform' : ''}
        `}
        onClick={handleToggle}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        style={{
          transitionDuration: useAnimations ? `${animationDuration}ms` : '150ms',
        }}
      >
        <div
          className={`
            ${useAnimations ? 'transition-transform duration-200' : ''}
            ${isOpen && useAnimations ? 'rotate-90' : 'rotate-0'}
          `}
        >
          {isOpen ? (
            <X className="h-6 w-6 sm:h-8 sm:w-8" />
          ) : (
            <Menu className="h-6 w-6 sm:h-8 sm:w-8" />
          )}
        </div>
      </button>
    </div>
  );
};

export default NavMenu;
