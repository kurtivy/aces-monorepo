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
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
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
