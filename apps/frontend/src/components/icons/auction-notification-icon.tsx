import React from 'react';

interface AuctionNotificationIconProps {
  size?: number;
  className?: string;
  isHovered?: boolean;
}

export function AuctionNotificationIcon({
  size = 24,
  className,
  isHovered = false,
}: AuctionNotificationIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`flex-shrink-0 ${className || ''}`}
      style={{
        transform: `scale(${0.65 * (isHovered ? 1.08 : 1)}) translateX(8px)`,
        transition: 'transform 0.2s ease-in-out',
      }}
    >
      {/* Bell-plus notification icon */}
      <path
        d="M10.268 21a2 2 0 0 0 3.464 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 8h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 5v6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.002 14.464a9 9 0 0 0 .738.863A1 1 0 0 1 20 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 8.75-5.332"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
