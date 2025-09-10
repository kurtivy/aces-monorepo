'use client';

import type React from 'react';
import { memo, useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import {
  // getBrowserPerformanceSettings,
  getDeviceCapabilities,
  mobileUtils,
} from '@/lib/utils/browser-utils';

interface ContactButtonProps {
  onClick: () => void;
}

const ContactButtonComponent: React.FC<ContactButtonProps> = ({ onClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  // const browserPerf = getBrowserPerformanceSettings();
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

    let expandTimer: NodeJS.Timeout;
    let collapseTimer: NodeJS.Timeout;

    expandTimer = setTimeout(() => {
      setIsExpanded(true);

      collapseTimer = setTimeout(() => {
        setIsExpanded(false);
      }, 6000);
    }, 8000);

    return () => {
      clearTimeout(expandTimer);
      clearTimeout(collapseTimer);
    };
  }, [isMobile]);

  return (
    <button
      className={`
        fixed bottom-4 left-4 z-50 
        h-10 sm:h-14
        rounded-full 
        border border-[#D0B264]/60 
        text-white
        flex items-center
        cursor-pointer
        ${useAnimations && !isMobile ? 'transition-all duration-700 ease-in-out' : ''}
        ${useAdvancedAnimations ? 'hover:scale-105 active:scale-95' : ''}
        overflow-hidden
      `}
      onClick={onClick}
      style={{
        backgroundColor: 'rgb(0, 0, 0)',
        width: !isMobile && isExpanded ? '380px' : window.innerWidth >= 640 ? '54px' : '41px',
        transitionDuration: useAnimations && !isMobile ? '700ms' : '0ms',
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onMouseEnter={(e) => {
        if (useAdvancedAnimations && !isMobile) {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.backgroundColor = 'rgb(0, 0, 0)';
        }
      }}
      onMouseLeave={(e) => {
        if (useAdvancedAnimations && !isMobile) {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.backgroundColor = 'rgb(0, 0, 0)';
        }
      }}
      onMouseDown={(e) => {
        if (useAdvancedAnimations && !isMobile) {
          e.currentTarget.style.transform = 'scale(0.95)';
        }
      }}
      onMouseUp={(e) => {
        if (useAdvancedAnimations && !isMobile) {
          e.currentTarget.style.transform = 'scale(1.05)';
        }
      }}
    >
      <div
        className="absolute flex items-center justify-center"
        style={{
          left: window.innerWidth >= 640 ? '27px' : '20px', // Center of circle (half of circle width)
          top: '50%',
          transform: 'translate(-50%, -50%)', // Center the icon perfectly
          width: window.innerWidth >= 640 ? '54px' : '41px',
          height: window.innerWidth >= 640 ? '54px' : '41px',
        }}
      >
        <MessageSquare
          className="text-[#D0B264]"
          style={{
            width: window.innerWidth >= 640 ? '24px' : '20px', // Sized to fit nicely in circle
            height: window.innerWidth >= 640 ? '24px' : '20px',
          }}
        />
      </div>

      {!isMobile && (
        <div
          className="flex items-center"
          style={{
            marginLeft: window.innerWidth >= 640 ? '68px' : '54px', // Space for icon + padding
            opacity: isExpanded ? 1 : 0,
            width: isExpanded ? 'auto' : '0px',
            transition: useAnimations ? 'opacity 700ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
            transitionDelay: isExpanded ? '200ms' : '0ms',
          }}
        >
          <span className="text-xs sm:text-sm font-medium whitespace-nowrap text-[#D0B264]">
            Don&apos;t see what you&apos;re looking for? Reach out!
          </span>
        </div>
      )}
    </button>
  );
};

const ContactButton = memo(ContactButtonComponent, (prevProps, nextProps) => {
  return prevProps.onClick === nextProps.onClick;
});

export default ContactButton;
