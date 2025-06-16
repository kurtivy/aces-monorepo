'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  href?: string;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const BackButton: React.FC<BackButtonProps> = ({
  href = '/',
  onClick,
  className = '',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12',
    md: 'w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16',
    lg: 'w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20',
  };

  const iconSizes = {
    sm: 'w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4',
    md: 'w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6',
    lg: 'w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8',
  };

  const buttonContent = (
    <motion.button
      className={`fixed top-4 left-4 z-50 ${sizeClasses[size]} rounded-full bg-black/50 border border-[#D0B264]/40 text-[#D0B264] shadow-lg hover:bg-black/70 hover:border-[#D0B264] transition-all duration-200 flex items-center justify-center ${className}`}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
    >
      <ArrowLeft className={iconSizes[size]} />
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
