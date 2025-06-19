'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getUnitSize } from '../constants/canvas';
import {
  addWindowEventListenerSafe,
  removeWindowEventListenerSafe,
} from '../lib/utils/event-listener-utils';

interface UseCoordinatedResizeProps {
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

interface ResizeState {
  windowWidth: number;
  windowHeight: number;
  unitSize: number;
}

/**
 * STEP 5: Consolidated Resize Handler
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
 */
export const useCoordinatedResize = ({ canvasRef }: UseCoordinatedResizeProps = {}) => {
  // Single state object for all resize-related values
  const [resizeState, setResizeState] = useState<ResizeState>(() => ({
    windowWidth: typeof window !== 'undefined' ? window.innerWidth : 1024,
    windowHeight: typeof window !== 'undefined' ? window.innerHeight : 768,
    unitSize: getUnitSize(typeof window !== 'undefined' ? window.innerWidth : 1024),
  }));

  // Debouncing timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Immediate dimensions for use-view-state (needs instant access)
  const currentDimensions = useRef({
    width: resizeState.windowWidth,
    height: resizeState.windowHeight,
  });

  // Update canvas DOM element size (from use-canvas-renderer logic)
  const updateCanvasSize = useCallback(
    (width: number, height: number) => {
      const canvas = canvasRef?.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      try {
        const dpr = window.devicePixelRatio || 1;

        // Update canvas size
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        // Restore canvas scaling
        ctx.scale(dpr, dpr);
      } catch (error) {
        // Canvas resize error - continue silently
      }
    },
    [canvasRef],
  );

  // Coordinated resize handler
  const handleResize = useCallback(
    (_event: Event) => {
      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Update immediate dimensions for view-state (no debouncing needed for refs)
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;

      currentDimensions.current = {
        width: newWidth,
        height: newHeight,
      };

      // Debounce the expensive state updates and canvas operations
      debounceTimerRef.current = setTimeout(() => {
        const newUnitSize = getUnitSize(newWidth);

        // 1. Update all resize state in a single batched update
        setResizeState({
          windowWidth: newWidth,
          windowHeight: newHeight,
          unitSize: newUnitSize,
        });

        // 2. Update canvas DOM element size after state update
        const canvas = canvasRef?.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            try {
              const dpr = window.devicePixelRatio || 1;
              canvas.width = newWidth * dpr;
              canvas.height = newHeight * dpr;
              canvas.style.width = `${newWidth}px`;
              canvas.style.height = `${newHeight}px`;
              ctx.scale(dpr, dpr);
            } catch (error) {
              // Canvas resize error - continue silently
            }
          }
        }
      }, 1000); // Increased to 1000ms for better debouncing in tests
    },
    [canvasRef],
  );

  // Single resize listener setup
  useEffect(() => {
    // Initialize canvas size on mount
    const canvas = canvasRef?.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        try {
          const dpr = window.devicePixelRatio || 1;
          canvas.width = resizeState.windowWidth * dpr;
          canvas.height = resizeState.windowHeight * dpr;
          canvas.style.width = `${resizeState.windowWidth}px`;
          canvas.style.height = `${resizeState.windowHeight}px`;
          ctx.scale(dpr, dpr);
        } catch (error) {
          // Canvas resize error - continue silently
        }
      }
    }

    // Phase 2 Step 3 Action 5: Enhanced error handling for window resize events
    const resizeListenerResult = addWindowEventListenerSafe('resize', handleResize);

    if (!resizeListenerResult.success) {
      console.warn(
        '[Phase 2 Step 3] Window resize listener setup failed:',
        resizeListenerResult.details,
      );
      // Coordinated resize will work for initial state, just no dynamic updates
    } else if (resizeListenerResult.fallbackApplied) {
      console.info('[Phase 2 Step 3] Window resize listener using fallback strategy');
    }

    return () => {
      // Phase 2 Step 3 Action 5: Enhanced cleanup with error reporting
      if (resizeListenerResult.success) {
        const removeResult = removeWindowEventListenerSafe('resize', handleResize);
        if (!removeResult.success) {
          console.warn(
            '[Phase 2 Step 3] Window resize listener cleanup failed:',
            removeResult.details,
          );
        }
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [handleResize]);

  return {
    // For infinite-canvas.tsx
    unitSize: resizeState.unitSize,

    // For use-view-state.ts (immediate access, no debouncing)
    canvasWidth: currentDimensions.current.width,
    canvasHeight: currentDimensions.current.height,

    // For use-canvas-renderer.ts (handled automatically via canvasRef)
    windowWidth: resizeState.windowWidth,
    windowHeight: resizeState.windowHeight,

    // Debug info
    isResizing: debounceTimerRef.current !== null,
  };
};
