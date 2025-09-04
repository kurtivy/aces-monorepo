'use client';

import React, { useState, useEffect } from 'react';

interface SimplePageLoadingProps {
  /** Whether the page is still loading */
  isLoading: boolean;
  /** Children to render when loading is complete */
  children: React.ReactNode;
  /** Maximum wait time in milliseconds before forcing content to show */
  maxWaitTime?: number;
  /** Optional loading message */
  loadingMessage?: string;
}

/**
 * Simple page loading overlay with gold spinner on green background
 * Hides all content until loading is complete, with a timeout failsafe
 */
export default function SimplePageLoading({
  isLoading,
  children,
  maxWaitTime = 5000, // 5 second maximum
  //   loadingMessage = 'Loading...',
}: SimplePageLoadingProps) {
  const [forceShow, setForceShow] = useState(false);
  const [showContent, setShowContent] = useState(false);

  // Timeout failsafe - force show content after maxWaitTime
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        console.warn(`⚠️ Loading timeout reached (${maxWaitTime}ms), forcing content display`);
        setForceShow(true);
      }, maxWaitTime);

      return () => clearTimeout(timeout);
    }
  }, [isLoading, maxWaitTime]);

  // Handle content showing with fade-in
  useEffect(() => {
    if (!isLoading || forceShow) {
      // Small delay to ensure smooth transition
      const delay = setTimeout(() => {
        setShowContent(true);
      }, 100);
      return () => clearTimeout(delay);
    } else {
      setShowContent(false);
    }
  }, [isLoading, forceShow]);

  const shouldShowLoading = isLoading && !forceShow;

  return (
    <>
      {/* Loading Overlay */}
      {shouldShowLoading && (
        <div
          className="fixed inset-0 z-[9999] bg-[#151c16] overflow-hidden"
          style={{
            transition: 'opacity 300ms ease-out',
          }}
        >
          {/* Background Lines - Same as LuxuryAssetsBackground */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Left side dashed line */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
              width="2px"
              height="100%"
              viewBox="0 0 2 100"
              style={{
                position: 'absolute',
                top: 0,
                left: 'calc(50% - 600px + 8px)', // contentWidth=1200, contentLineOffset=8
                pointerEvents: 'none',
                opacity: 1,
              }}
            >
              <line
                x1="1"
                y1="0"
                x2="1"
                y2="100"
                stroke="#D7BF75"
                strokeOpacity={0.5}
                strokeWidth={1}
                strokeDasharray="12 12"
                vectorEffect="non-scaling-stroke"
                shapeRendering="crispEdges"
              />
            </svg>

            {/* Right side dashed line */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
              width="2px"
              height="100%"
              viewBox="0 0 2 100"
              style={{
                position: 'absolute',
                top: 0,
                left: 'calc(50% + 600px - 8px)', // contentWidth=1200, contentLineOffset=8
                pointerEvents: 'none',
                opacity: 1,
              }}
            >
              <line
                x1="1"
                y1="0"
                x2="1"
                y2="100"
                stroke="#D7BF75"
                strokeOpacity={0.5}
                strokeWidth={1}
                strokeDasharray="12 12"
                vectorEffect="non-scaling-stroke"
                shapeRendering="crispEdges"
              />
            </svg>

            {/* Center guide line */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
              width="2px"
              height="100%"
              viewBox="0 0 2 100"
              style={{
                position: 'absolute',
                top: 0,
                left: 'calc(50% - 200px)', // contentWidth/3 = 400px
                pointerEvents: 'none',
                opacity: 1,
              }}
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
          </div>

          {/* Centered Spinner */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                {/* Outer ring */}
                <div className="w-16 h-16 border-4 border-[#D0B284]/20 rounded-full"></div>
                {/* Spinning inner ring */}
                <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-[#D0B284] border-r-[#D0B284] rounded-full animate-spin"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page Content */}
      <div
        className={`transition-opacity duration-500 ease-out ${
          showContent ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          visibility: showContent ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </>
  );
}
