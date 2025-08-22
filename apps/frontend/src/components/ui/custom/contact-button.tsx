'use client';

import React, { memo, useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import {
  getBrowserPerformanceSettings,
  getDeviceCapabilities,
  mobileUtils,
} from '../../../lib/utils/browser-utils';

interface ContactButtonProps {
  onClick: () => void;
}

const ContactButtonComponent: React.FC<ContactButtonProps> = ({ onClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const browserPerf = getBrowserPerformanceSettings();
  const deviceCaps = getDeviceCapabilities();

  // Check if device is mobile using touchCapable or mobile detection
  const isMobile = deviceCaps.touchCapable || mobileUtils.isMobileSafari();

  const useAnimations = deviceCaps.performanceTier !== 'low';
  const useAdvancedAnimations = deviceCaps.performanceTier === 'high';

  useEffect(() => {
    // Disable expansion animation on mobile devices
    if (isMobile) {
      return; // Don't expand on mobile
    }

    const timer = setTimeout(() => {
      setIsExpanded(true);
    }, 6000);

    return () => clearTimeout(timer);
  }, [isMobile]);

  // Determine if we should show expanded state (desktop only)
  const shouldExpand = !isMobile && isExpanded;

  return (
    <button
      className={`
        fixed bottom-4 left-4 z-50 
        ${shouldExpand ? 'px-4 py-3 sm:px-6 sm:py-4' : 'p-3 sm:p-4'}
        rounded-full 
        bg-black/80 border border-[#D0B264]/40 
        text-[#D0B264] 
        flex items-center gap-2 sm:gap-3
        cursor-pointer
        hover:bg-black/90 hover:border-[#D0B264] 
        ${useAnimations && !isMobile ? 'transition-all duration-500' : ''}
        ${useAdvancedAnimations ? 'hover:scale-105 active:scale-95' : ''}
        ${shouldExpand ? 'max-w-xs sm:max-w-sm' : 'w-auto'}
        overflow-hidden
      `}
      onClick={onClick}
      style={{
        transitionDuration:
          useAnimations && !isMobile ? `${browserPerf.animationDuration}ms` : '0ms',
      }}
    >
      <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
      {!isMobile && (
        <span
          className={`
            text-xs sm:text-sm font-medium whitespace-nowrap
            ${useAnimations ? 'transition-all duration-500' : ''}
            ${isExpanded ? 'opacity-100 max-w-full ml-1 sm:ml-2' : 'opacity-0 max-w-0 ml-0'}
          `}
        >
          Don&apos;t see what you&apos;re looking for? Reach out!
        </span>
      )}
    </button>
  );
};

const ContactButton = memo(ContactButtonComponent, (prevProps, nextProps) => {
  return prevProps.onClick === nextProps.onClick;
});

export default ContactButton;
