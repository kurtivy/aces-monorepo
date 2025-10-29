'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RoyalTradeButtonProps } from './royal-trade-button';

type GraffitiButtonState = Exclude<RoyalTradeButtonProps['state'], undefined>;
type GraffitiButtonSize = Exclude<RoyalTradeButtonProps['size'], undefined>;

export type GraffitiTradeButtonProps = RoyalTradeButtonProps;

const labelFor = (state: GraffitiButtonState) => {
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

const sizeConfig: Record<
  GraffitiButtonSize,
  { container: string; outerLabelClass: string; innerLabelClass: string }
> = {
  md: {
    container:
      'min-w-[140px] h-11 md:min-w-[148px] md:h-[46px] lg:min-w-[170px] lg:h-[56px] xl:min-w-[180px] xl:h-14',
    outerLabelClass: 'text-[26px] md:text-[30px] lg:text-[36px] xl:text-[38px]',
    innerLabelClass: 'text-[36px] md:text-[42px] lg:text-[50px] xl:text-[52px]',
  },
  lg: {
    container:
      'min-w-[156px] h-[48px] md:min-w-[170px] md:h-[56px] lg:min-w-[188px] lg:h-[62px] xl:min-w-[200px] xl:h-16',
    outerLabelClass: 'text-[30px] md:text-[34px] lg:text-[40px] xl:text-[42px]',
    innerLabelClass: 'text-[42px] md:text-[48px] lg:text-[56px] xl:text-[60px]',
  },
  xl: {
    container:
      'min-w-[180px] h-[54px] md:min-w-[190px] md:h-[60px] lg:min-w-[205px] lg:h-[68px] xl:min-w-[224px] xl:h-[72px]',
    outerLabelClass: 'text-[34px] md:text-[38px] lg:text-[44px] xl:text-[48px]',
    innerLabelClass: 'text-[48px] md:text-[56px] lg:text-[64px] xl:text-[68px]',
  },
};

export function GraffitiTradeButton({
  state = 'trade',
  loading = false,
  size = 'lg',
  className,
  style,
  children,
  disabled,
  fullWidth = false,
  ...rest
}: GraffitiTradeButtonProps) {
  const { container, outerLabelClass, innerLabelClass } = sizeConfig[size];
  const content = children ?? labelFor(state);

  return (
    <button
      {...rest}
      disabled={disabled}
      className={cn(
        'group relative inline-flex items-center justify-center overflow-visible rounded-[25px] border-2 border-[#4a6b4a]',
        container,
        fullWidth && 'w-full',
        'bg-[linear-gradient(145deg,#2a3d2a_0%,#1e2b1e_100%)] text-[#4ecdc4]',
        'shadow-[0_4px_15px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(0,0,0,0.2)]',
        'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] active:duration-100',
        'hover:-translate-y-[2px] hover:scale-[1.02]',
        'hover:bg-[linear-gradient(145deg,#2e422e_0%,#223022_100%)] hover:border-[#5a7b5a]',
        'hover:shadow-[0_8px_25px_rgba(0,0,0,0.4),0_4px_10px_rgba(78,205,196,0.2),inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.2)]',
        'active:-translate-y-[1px] active:scale-[1.01]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5fd3cc]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1310]',
        'disabled:cursor-not-allowed disabled:opacity-60 disabled:brightness-75',
        'font-spray-letters uppercase tracking-[0.2em]',
        className,
      )}
      style={style}
    >
      {/* Main label */}
      <span className="pointer-events-none absolute inset-0" aria-hidden="true">
        <span
          className={cn(
            'absolute top-1/2 left-[60%] -translate-x-1/2 -translate-y-1/2 -rotate-[4deg] select-none',
            outerLabelClass,
            'font-normal text-[#4ecdc4] drop-shadow',
            'transition-colors duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
            'group-hover:text-[#5fd3cc]',
            '[text-shadow:2px_2px_0_rgba(78,205,196,0.3),-1px_-1px_0_rgba(78,205,196,0.2),0_0_15px_rgba(78,205,196,0.4),3px_3px_8px_rgba(0,0,0,0.3)]',
            'group-hover:[text-shadow:2px_2px_0_rgba(95,211,204,0.3),-1px_-1px_0_rgba(95,211,204,0.2),0_0_20px_rgba(95,211,204,0.5),3px_3px_10px_rgba(0,0,0,0.4)]',
            'group-active:[text-shadow:2px_2px_0_rgba(213,183,129,0.4),-1px_-1px_0_rgba(213,183,129,0.25),0_0_24px_rgba(213,183,129,0.6),3px_3px_12px_rgba(0,0,0,0.45)]',
          )}
          style={{
            filter: 'drop-shadow(0 0 3px currentColor)',
          }}
        >
          <span
            className={cn(
              'inline-block transition-[filter,text-shadow,color] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:filter-[drop-shadow(0_0_5px_currentColor)] group-active:filter-[drop-shadow(0_0_8px_rgba(213,183,129,0.8))] font-spray-letters uppercase tracking-[0.2em]',
              innerLabelClass,
            )}
          >
            {content}
          </span>
        </span>
      </span>

      {/* Loading indicator */}
      {loading && (
        <span className="relative z-10 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#5fd3cc]" />
        </span>
      )}

      {/* Paint drips */}
      {/* <span
        aria-hidden="true"
        className="pointer-events-none absolute top-[72%] left-[38%] h-5 w-[3px] rounded-t-full opacity-70 transition-opacity duration-300 group-hover:opacity-90"
        style={{
          background: 'linear-gradient(to bottom, #4ecdc4 0%, transparent 100%)',
        }}
      /> */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-[76%] left-[68%] h-6 w-[4px] rounded-t-full opacity-70 transition-opacity duration-300 group-hover:opacity-90"
        style={{
          background: 'linear-gradient(to bottom, #4ecdc4 0%, transparent 100%)',
        }}
      />

      {/* Paint splatters */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-2 right-6 h-1.5 w-1.5 rounded-full opacity-60 transition-opacity duration-300 group-hover:opacity-90"
        style={{
          background: '#4ecdc4',
          boxShadow: '0 0 6px rgba(78,205,196,0.6)',
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-1 left-[85%] h-[10px] w-[10px] rounded-full opacity-60 transition-opacity duration-300 group-hover:opacity-90"
        style={{
          background: '#4ecdc4',
          boxShadow: '0 0 8px rgba(78,205,196,0.55)',
        }}
      />

      {/* Hidden text for accessibility when not loading */}
      <span className="sr-only">{content}</span>
    </button>
  );
}

export default GraffitiTradeButton;
