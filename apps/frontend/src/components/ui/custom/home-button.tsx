'use client';

import type React from 'react';
import { memo } from 'react';
import {
  // getBrowserPerformanceSettings,
  getDeviceCapabilities,
  mobileUtils,
} from '@/lib/utils/browser-utils';

interface HomeButtonProps {
  onClick: () => void;
}

const HomeButtonComponent: React.FC<HomeButtonProps> = ({ onClick }) => {
  // const browserPerf = getBrowserPerformanceSettings();
  const deviceCaps = getDeviceCapabilities();

  // Check if device is mobile using touchCapable or mobile detection
  const isMobile = deviceCaps.touchCapable || mobileUtils.isMobileSafari();

  const useAdvancedAnimations = deviceCaps.performanceTier === 'high';

  // Crown SVG paths
  const crown =
    'M222.044 67.262C223.993 70.143 235.405 87.125 247.403 105C268.177 135.947 272.503 141.955 273.291 140.944C273.481 140.7 279.154 131.95 285.896 121.5C309.229 85.334 322.186 65.496 323.091 64.55C323.637 63.979 324 83.852 324 114.3V165H218H112L112.016 113.75L112.032 62.5L120.766 75.992C149.518 120.409 162.763 140.418 163.577 140.672C164.424 140.935 175.646 124.694 205.994 79.283C212.322 69.813 217.725 62.056 218 62.045C218.275 62.034 220.095 64.381 222.044 67.262Z';
  const horizontalLine = 'M325 207.5V224H218H111V207.5V191H218H325V207.5Z';
  const smileyFace =
    'M97.598 252.5C106.692 289.537 130.281 319.248 163.5 335.504C183.004 345.048 196.869 348.323 218 348.38C233.347 348.421 242.384 347.087 256 342.77C275.218 336.676 291.242 326.854 306.102 312.06C323.557 294.681 335.384 273.126 340.165 249.979L341.4 244H361.745H382.091L381.488 247.75C375.425 285.473 360.933 314.132 334.549 340.58C310.362 364.826 284.247 378.901 250 386.149C241.217 388.008 236.23 388.379 219.5 388.417C198.028 388.466 189.446 387.375 172.264 382.411C119.227 367.089 75.38 323.139 60.613 270.5C58.643 263.478 55 246.551 55 244.42C55 244.001 75.947 243.373 87.444 243.448L95.388 243.5L97.598 252.5Z';

  return (
    <button
      className={`
        fixed top-4 left-4 z-50 
        h-10 sm:h-14
        rounded-full 
        border border-[#D0B264]/60 
        text-white
        flex items-center
        cursor-pointer
        ${useAdvancedAnimations ? 'hover:scale-105 active:scale-95' : ''}
        overflow-hidden
      `}
      onClick={onClick}
      style={{
        backgroundColor: 'rgb(0, 0, 0)',
        width: window.innerWidth >= 640 ? '54px' : '41px',
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
          transform: 'translate(-50%, -50%)', // Center the logo perfectly
          width: window.innerWidth >= 640 ? '54px' : '41px',
          height: window.innerWidth >= 640 ? '54px' : '41px',
        }}
      >
        <svg
          className="text-[#D0B264]"
          viewBox="0 0 400 400"
          fill="currentColor"
          style={{
            width: window.innerWidth >= 640 ? '44px' : '34px', // 80-85% of circle size
            height: window.innerWidth >= 640 ? '44px' : '34px',
          }}
        >
          <g transform="translate(-25, -20) scale(1)">
            <path d={crown} />
            <path d={horizontalLine} />
            <path d={smileyFace} />
          </g>
        </svg>
      </div>
    </button>
  );
};

const HomeButton = memo(HomeButtonComponent, (prevProps, nextProps) => {
  return prevProps.onClick === nextProps.onClick;
});

export default HomeButton;
