import { useState, useRef, useCallback } from 'react';

// Animation timing utilities
const easeInOutCubic = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

interface UseCanvasAnimationTimingProps {
  hoverAnimationDuration: number;
  useLinearEasing?: boolean;
}

interface AnimationTimingState {
  // Hover animation state
  currentHoverProgress: number;
  isHoveringToken: boolean;

  // Product animation state
  isProductAnimationActive: boolean;
  hasAnimationStarted: boolean;
}

interface AnimationTimingActions {
  // Hover animation actions
  updateHoverState: (isHovering: boolean, currentTime: number) => void;
  updateHoverAnimationProgress: (currentTime: number) => void;

  // Product animation actions
  startProductAnimation: () => void;
  stopProductAnimation: () => void;

  // Animation progress calculations
  calculateHoverProgress: (currentTime: number) => number;
}

/**
 * Canvas Animation Timing Hook
 *
 * Extracts pure animation timing calculations from the main canvas renderer.
 * Handles:
 * - Hover animation progress calculation and state management
 * - Product animation lifecycle management
 * - Animation timing math (easing, progress calculation)
 * - Animation state coordination
 *
 * EXTRACTED FROM: useCanvasRenderer (Phase 1 of surgical refactoring)
 * PRESERVES: All existing animation behavior and performance characteristics
 */
export const useCanvasAnimationTiming = ({
  hoverAnimationDuration,
  useLinearEasing = false,
}: UseCanvasAnimationTimingProps): AnimationTimingState & AnimationTimingActions => {
  // ===== EXTRACTED STATE =====
  // Animation state - these were in main hook but are purely timing-related
  const [isProductAnimationActive, setIsProductAnimationActive] = useState(false);
  const [isHoveringToken, setIsHoveringToken] = useState(false);
  const [hasAnimationStarted, setHasAnimationStarted] = useState(false);

  // Hover animation state (extracted from main hook)
  const [currentHoverProgress, setCurrentHoverProgress] = useState(0);
  const hoverAnimationStartTime = useRef(0);

  // ===== EXTRACTED FUNCTIONS =====

  // Update hover state function (extracted from main hook lines 503-511)
  const updateHoverState = useCallback(
    (isHovering: boolean, currentTime: number) => {
      const wasHovering = currentHoverProgress > 0;
      if (wasHovering === isHovering) return;

      setIsHoveringToken(isHovering);
      hoverAnimationStartTime.current = currentTime;
    },
    [currentHoverProgress],
  );

  // Hover animation progress calculation (extracted from main hook lines 1434-1449)
  const updateHoverAnimationProgress = useCallback(
    (currentTime: number) => {
      if (isHoveringToken || currentHoverProgress > 0) {
        const elapsed = currentTime - hoverAnimationStartTime.current;
        let progress = Math.min(1, elapsed / hoverAnimationDuration);

        if (!isHoveringToken) {
          progress = 1 - progress;
        }

        // Apply easing (preserve existing logic)
        progress = useLinearEasing ? progress : easeInOutCubic(progress);
        setCurrentHoverProgress(progress);

        if (!isHoveringToken && progress <= 0) {
          setCurrentHoverProgress(0);
        }
      }
    },
    [isHoveringToken, currentHoverProgress, hoverAnimationDuration, useLinearEasing],
  );

  // Calculate hover progress (utility for external use)
  const calculateHoverProgress = useCallback(
    (currentTime: number): number => {
      if (!isHoveringToken && currentHoverProgress === 0) {
        return 0;
      }

      const elapsed = currentTime - hoverAnimationStartTime.current;
      let progress = Math.min(1, elapsed / hoverAnimationDuration);

      if (!isHoveringToken) {
        progress = 1 - progress;
      }

      return useLinearEasing ? progress : easeInOutCubic(progress);
    },
    [isHoveringToken, currentHoverProgress, hoverAnimationDuration, useLinearEasing],
  );

  // Product animation lifecycle (extracted logic from main hook lines 1458-1464)
  const startProductAnimation = useCallback(() => {
    setIsProductAnimationActive(true);
    setHasAnimationStarted(true);
  }, []);

  const stopProductAnimation = useCallback(() => {
    setIsProductAnimationActive(false);
  }, []);

  // Return extracted state and actions
  return {
    // State
    currentHoverProgress,
    isHoveringToken,
    isProductAnimationActive,
    hasAnimationStarted,

    // Actions
    updateHoverState,
    updateHoverAnimationProgress,
    startProductAnimation,
    stopProductAnimation,
    calculateHoverProgress,
  };
};
