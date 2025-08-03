'use client';

import React, { memo, useState, useEffect } from 'react';
import {
  getBrowserPerformanceSettings,
  getDeviceCapabilities,
} from '../../../lib/utils/browser-utils';

interface ContactButtonProps {
  onClick: () => void;
}

const ContactButtonComponent: React.FC<ContactButtonProps> = ({ onClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const browserPerf = getBrowserPerformanceSettings();
  const deviceCaps = getDeviceCapabilities();

  const useAnimations = deviceCaps.performanceTier !== 'low';
  const useAdvancedAnimations = deviceCaps.performanceTier === 'high';

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExpanded(true);
    }, 6000);

    return () => clearTimeout(timer);
  }, []);

  // Message bubble SVG paths
  const messageBubble =
    'M218 64C141.16 64 78 127.16 78 204c0 32.94 11.44 63.1 30.46 86.82L86 356.67c-1.45 2.54-.52 5.8 2.08 7.29 1.06.61 2.26.92 3.47.92 1.65 0 3.29-.54 4.67-1.59L150 323.05C171.86 341.56 193.43 348 218 348c76.84 0 140-63.16 140-140S294.84 64 218 64Z';
  const innerDot1 = 'M164 204c0 11.05 8.95 20 20 20s20-8.95 20-20-8.95-20-20-20-20 8.95-20 20Z';
  const innerDot2 = 'M198 204c0 11.05 8.95 20 20 20s20-8.95 20-20-8.95-20-20-20-20 8.95-20 20Z';
  const innerDot3 = 'M232 204c0 11.05 8.95 20 20 20s20-8.95 20-20-8.95-20-20-20-20 8.95-20 20Z';

  return (
    <button
      className={`
        fixed bottom-4 left-4 z-50 
        ${isExpanded ? 'px-4 py-3 sm:px-6 sm:py-4' : 'p-3 sm:p-4'}
        rounded-full 
        bg-black/80 border border-[#D0B264]/40 
        text-[#D0B264] 
        flex items-center gap-2 sm:gap-3
        cursor-pointer
        hover:bg-black/90 hover:border-[#D0B264] 
        ${useAnimations ? 'transition-all duration-500' : ''}
        ${useAdvancedAnimations ? 'hover:scale-105 active:scale-95' : ''}
        ${isExpanded ? 'max-w-xs sm:max-w-sm' : 'w-auto'}
        overflow-hidden
      `}
      onClick={onClick}
      style={{
        transitionDuration: useAnimations ? `${browserPerf.animationDuration}ms` : '0ms',
      }}
    >
      <svg
        className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0"
        viewBox="70 50 276 315"
        fill="currentColor"
      >
        <path d={messageBubble} />
        <path d={innerDot1} />
        <path d={innerDot2} />
        <path d={innerDot3} />
      </svg>
      <span
        className={`
          text-xs sm:text-sm font-medium whitespace-nowrap
          ${useAnimations ? 'transition-all duration-500' : ''}
          ${isExpanded ? 'opacity-100 max-w-full ml-1 sm:ml-2' : 'opacity-0 max-w-0 ml-0'}
        `}
      >
        Don&apos;t see what you&apos;re looking for? Reach out!
      </span>
    </button>
  );
};

const ContactButton = memo(ContactButtonComponent, (prevProps, nextProps) => {
  return prevProps.onClick === nextProps.onClick;
});

export default ContactButton;
