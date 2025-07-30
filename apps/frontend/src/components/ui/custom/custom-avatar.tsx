'use client';

import type React from 'react';

import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

export type AvatarVariant = 'golden-luxury' | 'brand-fusion' | 'dramatic-contrast' | 'golden-flow';
export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  variant?: AvatarVariant;
  size?: AvatarSize;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

const avatarVariants = {
  'golden-luxury': 'bg-gradient-to-br from-[#D0B284] via-[#D7BF75] to-[#928357] ring-[#D7BF75]/30',
  'brand-fusion': 'bg-gradient-to-br from-[#184D37] via-[#D0B284] to-[#D7BF75] ring-[#184D37]/40',
  'dramatic-contrast':
    'bg-gradient-to-br from-[#231F20] via-[#D0B284] to-[#FFFFFF] ring-[#D0B284]/50',
  'golden-flow': 'bg-gradient-to-br from-[#D0B284] via-[#184D37] to-[#231F20] ring-[#D0B284]/30',
};

const avatarSizes = {
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-20 h-20',
  xl: 'w-24 h-24',
};

const innerRingVariants = {
  'golden-luxury': {
    outer: 'border-[#D7BF75]/40',
    inner: 'border-[#D0B284]/30',
    glow: 'from-[#D7BF75]/20',
  },
  'brand-fusion': {
    outer: 'border-[#D0B284]/40',
    inner: 'border-[#184D37]/30',
    glow: 'from-[#184D37]/20',
  },
  'dramatic-contrast': {
    outer: 'border-[#D0B284]/40',
    inner: 'border-[#FFFFFF]/20',
    glow: 'from-[#D0B284]/20',
  },
  'golden-flow': {
    outer: 'border-[#D0B284]/30',
    inner: 'border-[#184D37]/20',
    glow: 'from-[#D0B284]/25',
  },
};

export const CustomAvatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ variant = 'golden-luxury', size = 'md', className, children, onClick, ...props }, ref) => {
    const rings = innerRingVariants[variant];

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-full shadow-2xl ring-2 ring-offset-4 ring-offset-[#231F20] relative cursor-pointer transition-all duration-300 hover:scale-105',
          avatarVariants[variant],
          avatarSizes[size],
          onClick && 'hover:shadow-[0_0_30px_rgba(215,191,117,0.5)]',
          className,
        )}
        onClick={onClick}
        {...props}
      >
        {/* Inner rings */}
        <div className={cn('absolute inset-2 rounded-full border', rings.outer)} />
        <div className={cn('absolute inset-4 rounded-full border', rings.inner)} />

        {/* Subtle glow overlay */}
        <div
          className={cn(
            'absolute inset-0 rounded-full bg-gradient-to-tr via-transparent to-transparent',
            rings.glow,
          )}
        />

        {/* Content */}
        {children && (
          <div className="absolute inset-0 flex items-center justify-center text-white font-semibold">
            {children}
          </div>
        )}
      </div>
    );
  },
);

CustomAvatar.displayName = 'CustomAvatar';
