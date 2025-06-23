'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
// Phase 2 Step 8 Action 1: Navigation safety coordination
import { useNavigationSafety } from '../../hooks/use-navigation-safety';

interface BackButtonProps {
  href?: string;
  onClick?: () => void;
  className?: string;
  // Phase 2 Step 8 Action 1: Navigation safety coordination
  navigationSafety?: {
    loadingState: 'loading' | 'intro' | 'ready';
    imagesLoaded: boolean;
    canvasReady: boolean;
  };
}

const BackButton: React.FC<BackButtonProps> = ({
  href = '/',
  onClick,
  className = '',
  navigationSafety,
}) => {
  // Phase 2 Step 8 Action 1: Navigation safety coordination
  const { withNavigationSafety } = useNavigationSafety(
    navigationSafety || {
      loadingState: 'ready',
      imagesLoaded: true,
      canvasReady: true,
    },
  );

  const buttonContent = (
    <motion.button
      className={`fixed top-4 left-4 z-50 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black/50 border border-[#D0B264]/40 text-[#D0B264] shadow-lg hover:bg-black/70 hover:border-[#D0B264] transition-all duration-200 flex items-center justify-center ${className}`}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick ? withNavigationSafety(onClick, 'back-button-click') : undefined}
    >
      <ArrowLeft className="w-6 h-6 sm:w-8 sm:h-8" />
    </motion.button>
  );

  // If onClick is provided, render as button without Link wrapper
  if (onClick) {
    return buttonContent;
  }

  // Otherwise, render with Link wrapper
  return <Link href={href}>{buttonContent}</Link>;
};

export default BackButton;
