'use client';

import type React from 'react';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Menu, X, Send } from 'lucide-react';
import Link from 'next/link';
import { getDeviceCapabilities } from '../../lib/utils/browser-utils';

// Separate main navigation items from social links
const mainNavItems = [
  { href: '/create-token', label: 'Create Token', external: false },
  { href: '/terms', label: 'Terms', external: false },
  { href: 'https://docs.aces.fun', label: 'About', external: true },
  { href: '/privacy', label: 'Privacy', external: false },
];

// Custom X logo component (modern Twitter/X logo)
const XIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
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

// Social links as icons in footer section
const socialLinks = [
  { href: 'https://x.com/acesdotfun', label: 'X (Twitter)', external: true, icon: XIcon },
  { href: 'https://t.me/acesdotfun/', label: 'Telegram', external: true, icon: Send },
];

// Desktop animations (full experience)
const desktopMenuVariants: Variants = {
  closed: {
    opacity: 0,
    x: '100%',
    transition: {
      duration: 0.2,
      ease: 'easeInOut',
    },
  },
  open: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const desktopNavItemVariants: Variants = {
  closed: {
    opacity: 0,
    x: 20,
  },
  open: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
};

// Mobile animations (performance-optimized)
const mobileMenuVariants: Variants = {
  closed: {
    opacity: 0,
    transition: {
      duration: 0.15,
      ease: 'easeInOut',
    },
  },
  open: {
    opacity: 1,
    transition: {
      duration: 0.15,
      ease: 'easeOut',
    },
  },
};

const mobileNavItemVariants: Variants = {
  closed: {
    opacity: 0,
  },
  open: {
    opacity: 1,
    transition: {
      duration: 0.1,
      ease: 'easeOut',
    },
  },
};

const NavMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  // Smart mobile detection using our existing device capabilities
  const isMobileDevice = useMemo(() => {
    const capabilities = getDeviceCapabilities();
    return capabilities.touchCapable || capabilities.isMobileSafari;
  }, []);

  // Choose animation variants based on device capability
  const menuVariants = isMobileDevice ? mobileMenuVariants : desktopMenuVariants;
  const navItemVariants = isMobileDevice ? mobileNavItemVariants : desktopNavItemVariants;

  return (
    <div className="fixed top-4 right-4 z-50 flex items-start">
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            className="bg-black/95 border border-[#D0B264]/40 text-[#D0B264] rounded-lg mr-2 overflow-hidden shadow-lg max-w-[calc(100vw-4rem)]"
            variants={menuVariants}
            initial="closed"
            animate="open"
            exit="closed"
            style={{
              marginTop: '0px',
              willChange: isMobileDevice ? 'opacity' : 'transform, opacity',
            }}
          >
            <div className="p-3 sm:p-4 min-w-[160px] sm:min-w-[180px]">
              {/* Main Navigation Items */}
              <div className="space-y-1">
                {mainNavItems.map((item, index) => (
                  <motion.div
                    key={item.href}
                    variants={navItemVariants}
                    custom={index}
                    style={{ willChange: isMobileDevice ? 'opacity' : 'transform, opacity' }}
                  >
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setIsOpen(false)}
                        className="block text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 px-2 py-1.5 sm:px-3 sm:py-2 text-sm font-medium rounded-md whitespace-nowrap uppercase font-spectral tracking-wide"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className="block text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 px-2 py-1.5 sm:px-3 sm:py-2 text-sm font-medium rounded-md whitespace-nowrap uppercase font-spectral tracking-wide"
                      >
                        {item.label}
                      </Link>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Social Links Footer */}
              <div className="border-t border-[#D0B264]/20 mt-3 pt-3">
                <div className="flex justify-center space-x-4">
                  {socialLinks.map((social, index) => {
                    const IconComponent = social.icon;
                    return (
                      <motion.div
                        key={social.href}
                        variants={navItemVariants}
                        custom={mainNavItems.length + index}
                        style={{ willChange: isMobileDevice ? 'opacity' : 'transform, opacity' }}
                      >
                        <a
                          href={social.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setIsOpen(false)}
                          className="flex items-center justify-center w-10 h-10 text-[#D0B264] hover:text-white hover:bg-[#D0B264]/10 transition-colors duration-150 rounded-full"
                          aria-label={social.label}
                        >
                          <IconComponent size={20} />
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

      <motion.button
        className="bg-black/90 border border-[#D0B264]/40 text-[#D0B264] shadow-lg rounded-full w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center cursor-pointer flex-shrink-0 hover:bg-black/95 hover:border-[#D0B264] transition-colors duration-150"
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
          transition={{ duration: isMobileDevice ? 0.1 : 0.2, ease: 'easeInOut' }}
          style={{ willChange: 'transform' }}
        >
          {isOpen ? (
            <X className="h-6 w-6 sm:h-8 sm:w-8" />
          ) : (
            <Menu className="h-6 w-6 sm:h-8 sm:w-8" />
          )}
        </motion.div>
      </motion.button>
    </div>
  );
};

export default NavMenu;
