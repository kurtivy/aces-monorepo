'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getUnitSize } from '../constants/canvas';
import {
  addWindowEventListenerSafe,
  removeWindowEventListenerSafe,
} from '../lib/utils/event-listener-utils';
import { browserUtils, mobileUtils } from '../lib/utils/browser-utils';
import { roundTo2Decimals } from '../lib/canvas/math-utils';

interface UseCoordinatedResizeProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

interface ResizeState {
  windowWidth: number;
  windowHeight: number;
  unitSize: number;
}

/**
 * STEP 5: Consolidated Resize Handler
 * Phase 2 Step 7 Action 1: Enhanced with mobile-specific optimizations
 *
 * Replaces 3 separate resize listeners with 1 coordinated handler:
 * - infinite-canvas.tsx: unitSize updates
 * - use-view-state.ts: canvas width/height tracking
 * - use-canvas-renderer.ts: canvas DOM element sizing
 *
 * Features:
 * - 300ms debounced updates (prevents excessive re-renders)
 * - Coordinated update order (dimensions → unitSize → canvas sizing)
 * - Single resize listener (eliminates race conditions)
 * - Batch state updates (reduces React re-renders)
 * - Phase 2 Step 7 Action 1: Mobile-optimized canvas memory management
 * - Phase 2 Step 7 Action 1: Safari mobile DPR stabilization
 * - Phase 2 Step 7 Action 1: Orientation change handling
 */
export const useCoordinatedResize = ({ canvasRef }: UseCoordinatedResizeProps) => {
  // Phase 2 Step 7 Action 1: Get stable mobile dimensions for initial state
  const getInitialDimensions = () => {
    if (typeof window === 'undefined') return { width: 1024, height: 768 };

    if (browserUtils.isMobileSafari()) {
      return browserUtils.getStableMobileDimensions();
    }

    return { width: window.innerWidth, height: window.innerHeight };
  };

  // Single state object for all resize-related values
  const [resizeState, setResizeState] = useState<ResizeState>(() => {
    const initialDimensions = getInitialDimensions();
    return {
      windowWidth: initialDimensions.width,
      windowHeight: initialDimensions.height,
      unitSize: getUnitSize(initialDimensions.width),
    };
  });

  // Debouncing timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Phase 2 Step 7 Action 1: Orientation cleanup ref
  const orientationCleanupRef = useRef<(() => void) | null>(null);

  // Immediate dimensions for use-view-state (needs instant access)
  const currentDimensions = useRef({
    width: resizeState.windowWidth,
    height: resizeState.windowHeight,
  });

  // Phase 2 Step 7 Action 1: Mobile-optimized canvas sizing
  const updateCanvasSize = useCallback(
    (width: number, height: number) => {
      const canvas = canvasRef?.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      try {
        // Phase 3: Enhanced canvas scaling system (client-side only)
        const optimalScale =
          typeof window !== 'undefined'
            ? mobileUtils.getOptimalCanvasScale()
            : { scaleFactor: 1.0, qualityMode: 'standard' };

        // Phase 2 Step 7 Action 1: Use mobile-optimized canvas dimensions when appropriate
        if (browserUtils.isMobile() || browserUtils.isMobileSafari()) {
          const mobileDimensions = browserUtils.getMobileCanvasDimensions();

          // MOBILE SHIMMER FIX: Ensure canvas dimensions are integers
          // Apply optimal scaling to mobile dimensions with proper rounding
          const scaledWidth = Math.round(mobileDimensions.width * optimalScale.scaleFactor);
          const scaledHeight = Math.round(mobileDimensions.height * optimalScale.scaleFactor);

          // Update canvas with mobile-optimized dimensions
          canvas.width = scaledWidth;
          canvas.height = scaledHeight;
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;

          // MOBILE SHIMMER FIX: Round the total scale factor to prevent subpixel scaling
          // Scale by the combined optimization factors with proper precision
          const combinedScale =
            mobileDimensions.dpr * mobileDimensions.scaleFactor * optimalScale.scaleFactor;
          const roundedScaleFactor = roundTo2Decimals(combinedScale);

          // Reset any existing transforms before applying new scale
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(roundedScaleFactor, roundedScaleFactor);

          // Remove development console log for production optimization
          // console.log(`[Canvas Scaling] Mobile: ${scaledWidth}x${scaledHeight} (${optimalScale.qualityMode} mode, scale: ${roundedScaleFactor})`);
        } else {
          // Desktop/standard canvas sizing with enhanced scaling
          const dpr = window.devicePixelRatio || 1;

          // MOBILE SHIMMER FIX: Apply same rounding logic to desktop for consistency
          const scaledWidth = Math.round(width * dpr * optimalScale.scaleFactor);
          const scaledHeight = Math.round(height * dpr * optimalScale.scaleFactor);

          canvas.width = scaledWidth;
          canvas.height = scaledHeight;
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;

          // MOBILE SHIMMER FIX: Round the scale factor for desktop too
          const combinedScale = dpr * optimalScale.scaleFactor;
          const roundedScaleFactor = roundTo2Decimals(combinedScale);

          // Reset any existing transforms before applying new scale
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(roundedScaleFactor, roundedScaleFactor);

          // Remove development console log for production optimization
          // console.log(`[Canvas Scaling] Desktop: ${scaledWidth}x${scaledHeight} (${optimalScale.qualityMode} mode, scale: ${roundedScaleFactor})`);
        }
      } catch (error) {
        console.warn('[Phase 2 Step 7] Canvas resize error:', error);
        // Fallback to original sizing on error
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        // MOBILE SHIMMER FIX: Apply rounding to fallback too
        const roundedDPR = roundTo2Decimals(dpr);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(roundedDPR, roundedDPR);
      }
    },
    [canvasRef],
  );

  // Phase 2 Step 7 Action 1: Enhanced resize handler with mobile optimizations
  const handleResize = useCallback(
    (_event: Event) => {
      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Phase 2 Step 7 Action 1: Get dimensions using mobile-aware utilities
      const dimensions = browserUtils.isMobileSafari()
        ? browserUtils.getStableMobileDimensions()
        : { width: window.innerWidth, height: window.innerHeight };

      const newWidth = dimensions.width;
      const newHeight = dimensions.height;

      // Update immediate dimensions for view-state (no debouncing needed for refs)
      currentDimensions.current = {
        width: newWidth,
        height: newHeight,
      };

      // Phase 2 Step 7 Action 1: Adjust debounce timing for mobile Safari
      const debounceDelay = browserUtils.isMobileSafari() ? 1500 : 1000; // Longer delay for Safari mobile

      // Debounce the expensive state updates and canvas operations
      debounceTimerRef.current = setTimeout(() => {
        const newUnitSize = getUnitSize(newWidth);

        // Coordinated resize completed

        // Phase 2 Step 7 Action 4: Safe mobile resize operations
        mobileUtils.safeMobileViewportOperation(() => {
          // 1. Update all resize state in a single batched update
          setResizeState({
            windowWidth: newWidth,
            windowHeight: newHeight,
            unitSize: newUnitSize,
          });

          // 2. Update canvas DOM element size after state update
          updateCanvasSize(newWidth, newHeight);
        }, 'coordinated-resize');
      }, debounceDelay);
    },
    [updateCanvasSize],
  );

  // Single resize listener setup with mobile orientation support
  useEffect(() => {
    // Phase 2 Step 7 Action 1: Initialize canvas size on mount with mobile optimization
    updateCanvasSize(resizeState.windowWidth, resizeState.windowHeight);

    // Phase 2 Step 7 Action 1: Enhanced error handling for window resize events
    const resizeListenerResult = addWindowEventListenerSafe('resize', handleResize);

    if (!resizeListenerResult.success) {
      console.warn(
        '[Phase 2 Step 7] Window resize listener setup failed:',
        resizeListenerResult.details,
      );
    } else if (resizeListenerResult.fallbackApplied) {
      console.info('[Phase 2 Step 7] Window resize listener using fallback strategy');
    }

    // Phase 2 Step 7 Action 1: Set up mobile orientation change handling
    if (browserUtils.isMobile() || browserUtils.isMobileSafari()) {
      const orientationCleanup = mobileUtils.handleMobileOrientationChange(() => {
        // Mobile orientation change detected, triggering coordinated resize
        handleResize(new Event('orientationchange'));
      });
      orientationCleanupRef.current = orientationCleanup;
    }

    return () => {
      // Phase 2 Step 7 Action 1: Enhanced cleanup with mobile orientation
      if (resizeListenerResult.success) {
        const removeResult = removeWindowEventListenerSafe('resize', handleResize);
        if (!removeResult.success) {
          console.warn(
            '[Phase 2 Step 7] Window resize listener cleanup failed:',
            removeResult.details,
          );
        }
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Phase 2 Step 7 Action 1: Clean up mobile orientation listener
      if (orientationCleanupRef.current) {
        orientationCleanupRef.current();
        orientationCleanupRef.current = null;
      }
    };
  }, [handleResize, updateCanvasSize]);

  return {
    // For infinite-canvas.tsx
    unitSize: resizeState.unitSize,

    // For use-view-state.ts (immediate access, no debouncing)
    canvasWidth: currentDimensions.current.width,
    canvasHeight: currentDimensions.current.height,

    // For use-canvas-renderer.ts (handled automatically via canvasRef)
    windowWidth: resizeState.windowWidth,
    windowHeight: resizeState.windowHeight,

    // Debug info - Phase 2 Step 7 Action 1: Enhanced with mobile info
    isResizing: debounceTimerRef.current !== null,
    isMobileOptimized: browserUtils.isMobile() || browserUtils.isMobileSafari(),
  };
};
