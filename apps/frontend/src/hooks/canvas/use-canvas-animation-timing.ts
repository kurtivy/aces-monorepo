'use client';

import { useState, useRef, useCallback } from 'react';
import { easeInOutCubic } from '../../lib/canvas/math-utils';
import { getBrowserPerformanceSettings } from '../../lib/utils/browser-utils';

interface UseCanvasAnimationTimingProps {
  isProductAnimationActive: boolean;
  isHoveringToken: boolean;
  imagesLoaded: boolean;
  placementsCalculated: boolean;
  canvasVisible: boolean;
}

interface CanvasAnimationTiming {
  // Animation progress values (0 to 1)
  productAnimationProgress: number;
  hoverAnimationProgress: number;
  currentHoverProgress: number;

  // Animation state
  hasAnimationStarted: boolean;

  // Control functions
  startProductAnimation: () => void;
  updateHoverState: (isHovering: boolean, currentTime: number) => void;

  // Animation frame callback - returns whether animations are active
  updateAnimations: (currentTime: number) => boolean;
}

/**
 * Surgical extraction of animation timing calculations from useCanvasRenderer
 *
 * EXTRACTED:
 * - Animation progress calculations
 * - Animation timing state management
 * - Animation easing functions
 * - Animation start/update logic
 *
 * PRESERVED IN MAIN HOOK:
 * - All rendering logic (draw function)
 * - All useEffects
 * - All browser optimizations
 * - All coordinate calculations
 * - All event handlers
 */
export const useCanvasAnimationTiming = ({
  isProductAnimationActive,
  isHoveringToken,
  imagesLoaded,
  placementsCalculated,
  canvasVisible,
}: UseCanvasAnimationTimingProps): CanvasAnimationTiming => {
  // Animation state - extracted from main hook
  const [hasAnimationStarted, setHasAnimationStarted] = useState(false);
  const [currentHoverProgress, setCurrentHoverProgress] = useState(0);

  // Animation timing refs - extracted from main hook
  const productAnimationStartTime = useRef<number | null>(null);
  const hoverAnimationStartTime = useRef(0);

  // Get browser-specific animation settings
  const browserPerf = getBrowserPerformanceSettings();
  const ENTRANCE_ANIMATION_DURATION = 800; // Longer duration for entrance animation
  const hoverAnimationDuration = browserPerf.animationDuration; // Browser-specific hover duration

  // Start product animation - extracted from main hook useEffect
  const startProductAnimation = useCallback(() => {
    if (!imagesLoaded || !placementsCalculated || !canvasVisible) return;

    // Reset animation state
    setHasAnimationStarted(false);
    productAnimationStartTime.current = null;
  }, [imagesLoaded, placementsCalculated, canvasVisible]);

  // Update hover state - extracted from main hook mouse detection logic
  const updateHoverState = useCallback(
    (isHovering: boolean, currentTime: number) => {
      // Only update if hover state actually changed
      const wasHovering = currentHoverProgress > 0;
      if (wasHovering === isHovering) return;

      hoverAnimationStartTime.current = currentTime;
    },
    [currentHoverProgress],
  );

  // Main animation update function - extracted from main hook draw function
  const updateAnimations = useCallback(
    (currentTime: number): boolean => {
      let hasActiveAnimations = false;

      // Calculate product animation progress - extracted from main hook
      if (isProductAnimationActive) {
        // Set start time on first frame only
        if (!hasAnimationStarted) {
          productAnimationStartTime.current = currentTime;
          setHasAnimationStarted(true);
        }

        if (productAnimationStartTime.current !== null) {
          const elapsed = currentTime - productAnimationStartTime.current;
          if (elapsed >= ENTRANCE_ANIMATION_DURATION) {
            // Animation complete - no longer active
            hasActiveAnimations = false;
          } else {
            // Animation in progress
            hasActiveAnimations = true;
          }
        }
      }

      // Update hover animation progress - extracted from main hook
      if (isHoveringToken || currentHoverProgress > 0) {
        const elapsed = currentTime - hoverAnimationStartTime.current;
        let progress = Math.min(1, elapsed / hoverAnimationDuration);
        if (!isHoveringToken) {
          progress = 1 - progress;
        }

        if (browserPerf.useLinearEasing) {
          progress = progress; // Linear interpolation for performance mode
        } else {
          progress = easeInOutCubic(progress);
        }

        setCurrentHoverProgress(progress);

        if (!isHoveringToken && progress <= 0) {
          setCurrentHoverProgress(0);
        } else {
          hasActiveAnimations = true;
        }
      }

      return hasActiveAnimations;
    },
    [
      isProductAnimationActive,
      isHoveringToken,
      hasAnimationStarted,
      currentHoverProgress,
      hoverAnimationDuration,
      browserPerf.useLinearEasing,
      ENTRANCE_ANIMATION_DURATION,
    ],
  );

  // Calculate current animation progress values
  let productAnimationProgress = 0;
  if (isProductAnimationActive) {
    if (productAnimationStartTime.current !== null && hasAnimationStarted) {
      const now = performance.now();
      const elapsed = now - productAnimationStartTime.current;
      if (elapsed >= ENTRANCE_ANIMATION_DURATION) {
        productAnimationProgress = 1;
      } else {
        const progress = elapsed / ENTRANCE_ANIMATION_DURATION;
        const eased = easeInOutCubic(progress);
        productAnimationProgress = eased + Math.sin(eased * Math.PI) * 0.05;
      }
    }
  } else {
    productAnimationProgress = 1;
  }

  // Calculate current hover progress
  let hoverAnimationProgress = 0;
  if (isHoveringToken || currentHoverProgress > 0) {
    if (browserPerf.useLinearEasing) {
      hoverAnimationProgress = currentHoverProgress;
    } else {
      hoverAnimationProgress = easeInOutCubic(currentHoverProgress);
    }
  }

  return {
    productAnimationProgress,
    hoverAnimationProgress,
    currentHoverProgress,
    hasAnimationStarted,
    startProductAnimation,
    updateHoverState,
    updateAnimations,
  };
};
