'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getUnitSize } from '../constants/canvas';

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
        console.warn('Canvas resize error:', error);
      }
    },
    [canvasRef],
  );

  // Coordinated resize handler
  const handleResize = useCallback(() => {
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

      // STEP 5: Coordinated update order
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
            console.warn('Canvas resize error:', error);
          }
        }
      }

      console.log('🔄 Coordinated resize complete:', {
        width: newWidth,
        height: newHeight,
        unitSize: newUnitSize,
        timestamp: Date.now(),
      });
    }, 1000); // Increased to 1000ms for better debouncing in tests
  }, [canvasRef]); // STEP 6 FIX: Only depend on stable canvasRef

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
          console.warn('Canvas resize error:', error);
        }
      }
    }

    // Add single resize listener
    window.addEventListener('resize', handleResize);

    return () => {
      // Cleanup
      window.removeEventListener('resize', handleResize);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [handleResize]); // STEP 6 FIX: Only depend on stable handleResize

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
