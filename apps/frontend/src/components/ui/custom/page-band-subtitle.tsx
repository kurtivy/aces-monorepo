'use client';

import React, { useEffect, useState } from 'react';

type Props = {
  text: string;
  contentWidth?: number; // px
  bandHeight?: number; // px (to position below band)
  gapFromDivider?: number; // px padding right of the divider
  contentLineOffset?: number; // px inset for right inner line
  offsetY?: number; // px below the solid line
  className?: string;
};

export default function PageBandSubtitle({
  text,
  contentWidth = 1200,
  bandHeight = 96,
  gapFromDivider = 24,
  contentLineOffset = 8,
  offsetY = 12,
  className = '',
}: Props) {
  const [top, setTop] = useState<number>(0);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const getHeader = () => document.querySelector('[data-aces-header]') as HTMLElement | null;

    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768); // Standard mobile breakpoint
    };

    const measure = () => {
      const header = getHeader();
      if (header) {
        const rect = header.getBoundingClientRect();
        setTop(Math.max(0, Math.round(rect.bottom)) + bandHeight + offsetY);
      }
      checkMobile(); // Check mobile on each measure
    };

    measure();
    const ResizeObserverCtor: any = (window as any).ResizeObserver;
    const header = getHeader();
    const ro = ResizeObserverCtor && header ? new ResizeObserverCtor(measure) : null;
    if (ro && header) ro.observe(header);
    window.addEventListener('resize', measure);
    return () => {
      if (ro && header) ro.unobserve(header);
      window.removeEventListener('resize', measure);
    };
  }, [bandHeight, offsetY]);

  const contentLeft = `calc(50% - ${contentWidth / 2}px)`;
  const dividerLeft = `calc(${contentLeft} + ${Math.round(contentWidth / 3)}px)`;
  const rightGuide = `calc(${contentLeft} + ${contentWidth - contentLineOffset}px)`;

  return (
    <>
      {/* Mobile version - simple centered layout */}
      <div
        className={`pointer-events-none absolute left-0 right-0 z-40 flex items-center justify-center px-4 md:hidden ${className}`}
        style={{
          top: top,
        }}
      >
        <p className="text-sm sm:text-base text-[#E6E3D3]/80 leading-relaxed max-w-sm text-center">
          {text}
        </p>
      </div>

      {/* Desktop version - original positioning */}
      <div
        className={`pointer-events-none absolute left-1/2 -translate-x-1/2 z-40 hidden md:block ${className}`}
        style={{
          top,
          width: `${contentWidth}px`,
        }}
      >
        <div
          className="relative px-4"
          style={{
            left: `calc(${dividerLeft} + ${gapFromDivider}px - ${contentLeft})`,
            width: `calc(${rightGuide} - (${dividerLeft} + ${gapFromDivider}px))`,
          }}
        >
          <p className="text-lg md:text-xl text-[#E6E3D3]/80 leading-relaxed max-w-3xl ml-auto text-right">
            {text}
          </p>
        </div>
      </div>
    </>
  );
}
