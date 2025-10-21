'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type RoyalTradeButtonState = 'connect' | 'approve' | 'trade';
type RoyalTradeButtonSize = 'lg' | 'xl';

export type RoyalTradeButtonProps = {
  state?: RoyalTradeButtonState;
  loading?: boolean;
  size?: RoyalTradeButtonSize;
  fullWidth?: boolean;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const labelFor = (state: RoyalTradeButtonState) => {
  switch (state) {
    case 'connect':
      return 'CONNECT';
    case 'approve':
      return 'APPROVE';
    case 'trade':
    default:
      return 'TRADE';
  }
};

const sizes: Record<RoyalTradeButtonSize, string> = {
  lg: 'h-14 px-6 text-[18px] gap-2',
  xl: 'h-18 px-8 text-[28px] gap-3 tracking-widest',
};

const Shine = () => (
  <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
    <span className="absolute -inset-[1px] rounded-2xl bg-[linear-gradient(110deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.08)_45%,rgba(255,255,255,0)_60%)] [mask-image:linear-gradient(#000,transparent)] animate-[shine_2.8s_ease-in-out_infinite]" />
    <style jsx global>{`
      @keyframes shine {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(100%);
        }
      }
    `}</style>
  </span>
);

export function RoyalTradeButton({
  state = 'trade',
  loading = false,
  size = 'xl',
  fullWidth = false,
  className,
  style,
  children,
  disabled,
  ...rest
}: RoyalTradeButtonProps) {
  const content = children ?? labelFor(state);
  const buttonStyle = {
    background:
      'radial-gradient(120% 120% at 50% 0%, rgba(215,191,117,0.08) 0%, rgba(0,0,0,0.2) 70%)',
    ...style,
  };

  return (
    <button
      {...rest}
      disabled={disabled}
      className={cn(
        'relative group inline-flex select-none items-center justify-center rounded-2xl font-spray-letters text-[#f8e28b] transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D0B284]/50 disabled:cursor-not-allowed disabled:opacity-50',
        'active:scale-[0.99]',
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      style={buttonStyle}
    >
      <span className="absolute -inset-px -z-10 rounded-2xl bg-[conic-gradient(from_180deg_at_50%_50%,rgba(215,191,117,0.45),rgba(208,178,132,0.12),rgba(215,191,117,0.45))] opacity-70 blur-[6px]" />
      <span className="absolute inset-0 rounded-2xl border border-[#D0B284]/60" />
      <span className="absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-8px_28px_rgba(215,191,117,0.06)]" />
      <Shine />
      <span className="flex items-center gap-3">
        {/* {loading && <Loader2 className="h-[1.2em] w-[1.2em] animate-spin" />} */}
        <span className="whitespace-nowrap uppercase tracking-[0.2em] font-spray-letters text-3xl">
          {content}
        </span>
      </span>
    </button>
  );
}

export default RoyalTradeButton;
