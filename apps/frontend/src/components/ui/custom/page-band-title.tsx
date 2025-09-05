'use client';

import React, { useLayoutEffect, useState } from 'react';

type Props = {
  title: string;
  contentWidth?: number; // px
  bandHeight?: number; // px between header bottom rule and solid line
  gapFromDivider?: number; // px padding to the right of the divider
  className?: string;
  contentLineOffset?: number; // px inside-content side dashed line inset
};

const BOTTOM_RULE_HEIGHT = 8; // header's dashed bottom rule visual height in px

export default function PageBandTitle({
  title,
  contentWidth = 1200,
  bandHeight = 96,
  gapFromDivider = 24,
  className = '',
  contentLineOffset = 8,
}: Props) {
  const [top, setTop] = useState<number>(0);
  const [isMeasured, setIsMeasured] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useLayoutEffect(() => {
    const getHeader = () => document.querySelector('[data-aces-header]') as HTMLElement | null;

    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768); // Standard mobile breakpoint
    };

    const measure = () => {
      const header = getHeader();
      if (header) {
        const rect = header.getBoundingClientRect();
        // Position the band directly below header's bottom dashed rule
        setTop(Math.max(0, Math.round(rect.bottom + BOTTOM_RULE_HEIGHT)));
        if (!isMeasured) setIsMeasured(true);
      } else {
        // Fallback: reveal with provided bandHeight if header not found
        if (!isMeasured) setIsMeasured(true);
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
  }, []);

  // Positions within content
  const contentLeft = `calc(50% - ${contentWidth / 2}px)`;
  const dividerLeft = `calc(${contentLeft} + ${Math.round(contentWidth / 3)}px)`;
  const rightGuide = `calc(${contentLeft} + ${contentWidth - contentLineOffset}px)`;

  return (
    <>
      {/* Mobile version - simple centered layout */}
      <div
        className={`pointer-events-none absolute left-0 right-0 z-40 flex items-center justify-center px-4 md:hidden ${className}`}
        style={{
          top: top + 8, // Reduced offset from header for mobile
          height: `${bandHeight}px`,
          visibility: isMeasured ? 'visible' : 'hidden',
        }}
      >
        <h1 className="text-xl sm:text-2xl font-bold text-[#D7BF75] tracking-tight drop-shadow-sm text-center">
          {title}
        </h1>
      </div>

      {/* Desktop version - original positioning */}
      <div
        className={`pointer-events-none absolute left-1/2 -translate-x-1/2 z-40 hidden md:block ${className}`}
        style={{
          top,
          width: `${contentWidth}px`,
          height: `${bandHeight}px`,
          visibility: isMeasured ? 'visible' : 'hidden',
        }}
      >
        {/* Title sits centered between the divider and right inner dashed line */}
        <div
          className="absolute inset-y-0 flex items-center justify-center px-4"
          style={{
            left: `calc(${dividerLeft} + ${gapFromDivider}px - ${contentLeft})`,
            width: `calc(${rightGuide} - (${dividerLeft} + ${gapFromDivider}px))`,
          }}
        >
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#D7BF75] tracking-tight drop-shadow-sm text-center">
            {title}
          </h1>
        </div>

        {/* Visual divider reference (non-interactive overlay) - desktop only */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          width="2px"
          height="100%"
          viewBox="0 0 2 100"
          style={{ position: 'absolute', top: 0, left: dividerLeft, opacity: 0 }}
        >
          <line
            x1="1"
            y1="0"
            x2="1"
            y2="100"
            stroke="#D7BF75"
            strokeOpacity={0.35}
            strokeWidth={1}
            strokeDasharray="12 12"
            vectorEffect="non-scaling-stroke"
            shapeRendering="crispEdges"
          />
        </svg>

        {/* Content bounds helper (invisible) */}
        <div className="absolute inset-0" style={{ left: contentLeft }} />
      </div>
    </>
  );
}
