'use client';

import type React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';

const navItems = [
  { href: '/create-token', label: 'Create Token', external: false },
  { href: '/terms', label: 'Terms', external: false },
  { href: 'https://docs.aces.fun', label: 'About', external: true },
  { href: '/privacy', label: 'Privacy', external: false },
  { href: 'https://x.com/acesdotfun', label: 'X', external: true },
  { href: 'https://t.me', label: 'Telegram', external: true },
];

const menuVariants: Variants = {
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

const navItemVariants: Variants = {
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

const NavMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

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
              willChange: 'transform, opacity',
            }}
          >
            <div className="p-3 sm:p-4 min-w-[160px] sm:min-w-[180px]">
              <div className="space-y-1">
                {navItems.map((item, index) => (
                  <motion.div
                    key={item.href}
                    variants={navItemVariants}
                    custom={index}
                    style={{ willChange: 'transform, opacity' }}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        className="bg-black/90 border border-[#D0B264]/40 text-[#D0B264] shadow-lg rounded-full w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center cursor-pointer flex-shrink-0 hover:bg-black/95 hover:border-[#D0B264] transition-colors duration-150"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{ willChange: 'transform' }}
      >
        <motion.div
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
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
