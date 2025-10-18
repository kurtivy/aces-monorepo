'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { easeInOutCubic } from '../../lib/canvas/math-utils';
import type { ImageInfo } from '../../types/canvas';

/**
 * Check if an element is within viewport bounds (with buffer)
 * Optimized for entrance animation performance
 */
const isElementInViewport = (
  elementX: number,
  elementY: number,
  elementWidth: number,
  elementHeight: number,
  viewState: { x: number; y: number; scale: number },
  canvasWidth: number,
  canvasHeight: number,
  buffer: number = 100, // Extra buffer for smooth entrance
): boolean => {
  // Convert world coordinates to screen coordinates
  const screenX = elementX * viewState.scale + viewState.x;
  const screenY = elementY * viewState.scale + viewState.y;
  const screenWidth = elementWidth * viewState.scale;
  const screenHeight = elementHeight * viewState.scale;

  // Check if element overlaps with viewport (with buffer)
  return (
    screenX + screenWidth > -buffer &&
    screenX < canvasWidth + buffer &&
    screenY + screenHeight > -buffer &&
    screenY < canvasHeight + buffer
  );
};

interface UseCanvasEntranceAnimationProps {
  // Data inputs
  productPlacements: Array<{
    image: ImageInfo;
    x: number;
    y: number;
    width: number;
    height: number;
    index: number;
  }>;
  tokenPositions: Array<{
    worldX: number;
    worldY: number;
    element: HTMLImageElement | HTMLVideoElement;
  }>;
  featuredSectionPosition?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // Trigger conditions
  shouldAnimate: boolean; // When intro complete + everything loaded
  currentTime: number; // From main render loop
  unitSize: number;

  // Viewport optimization (optional for mobile performance)
  viewState?: { x: number; y: number; scale: number };
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface AnimatedProductElement {
  image: ImageInfo;
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  // Animated properties (final calculated values)
  animatedX: number;
  animatedY: number;
  animatedOpacity: number;
}

export interface AnimatedTokenElement {
  worldX: number;
  worldY: number;
  element: HTMLImageElement | HTMLVideoElement;
  // Animated properties (final calculated values)
  animatedX: number;
  animatedY: number;
  animatedOpacity: number;
  animatedScale: number;
}

export interface AnimatedFeaturedElement {
  x: number;
  y: number;
  width: number;
  height: number;
  // Animated properties (final calculated values)
  animatedX: number;
  animatedY: number;
  animatedOpacity: number;
  animatedScale: number;
}

interface CanvasEntranceAnimation {
  animatedProductPlacements: AnimatedProductElement[];
  animatedTokenPositions: AnimatedTokenElement[];
  animatedFeaturedSection: AnimatedFeaturedElement | null;
  isAnimationActive: boolean;
  animationProgress: number; // For debugging
}

/**
 * Centralized Canvas Entrance Animation Hook
 *
 * Handles all entrance animation logic in one place:
 * - Product images sliding up from bottom with fade
 * - Create token squares sliding up with scale + fade (100ms delay)
 * - Browser-specific performance optimizations
 * - Cross-browser timing consistency
 *
 * Replaces split animation logic between main hook and draw-image.ts
 */
export const useCanvasEntranceAnimation = ({
  productPlacements,
  tokenPositions,
  featuredSectionPosition,
  shouldAnimate,
  unitSize,
  viewState,
  canvasWidth = 1920,
  canvasHeight = 1080,
}: Omit<UseCanvasEntranceAnimationProps, 'currentTime'>): {
  calculateAnimatedElements: (currentTime: number) => CanvasEntranceAnimation;
  resetAnimation: () => void;
} => {
  // Animation state
  const [isAnimationActive, setIsAnimationActive] = useState(false);
  const [hasAnimationStarted, setHasAnimationStarted] = useState(false);
  const animationStartTime = useRef<number | null>(null);

  // Animation timing constants
  const ENTRANCE_ANIMATION_DURATION = 800; // 800ms total duration
  const TOKEN_DELAY = 100; // Tokens start 100ms after products

  // Pre-calculate base values to avoid expensive array mapping every frame
  // OPTIMIZATION: Filter viewport-visible elements during animation for mobile performance
  const baseProductCalculations = useMemo(() => {
    const baseCalcs = productPlacements.map((placement) => ({
      ...placement,
      baseY: placement.y,
      startOffset: unitSize * 0.3, // Pre-calculate start offset
      isVisible:
        !viewState ||
        isElementInViewport(
          placement.x,
          placement.y,
          placement.width,
          placement.height,
          viewState,
          canvasWidth,
          canvasHeight,
        ),
    }));

    // During animation, only process visible elements for performance
    return baseCalcs;
  }, [productPlacements, unitSize, viewState, canvasWidth, canvasHeight]);

  const baseTokenCalculations = useMemo(() => {
    const baseCalcs = tokenPositions.map((position) => ({
      ...position,
      baseY: position.worldY,
      startOffset: unitSize * 0.3, // Pre-calculate start offset
      isVisible:
        !viewState ||
        isElementInViewport(
          position.worldX,
          position.worldY,
          unitSize,
          unitSize,
          viewState,
          canvasWidth,
          canvasHeight,
        ),
    }));

    return baseCalcs;
  }, [tokenPositions, unitSize, viewState, canvasWidth, canvasHeight]);

  // Featured section calculation (simplified for fade-in only)
  const baseFeaturedCalculation = useMemo(() => {
    if (!featuredSectionPosition) return null;

    return {
      ...featuredSectionPosition,
      baseY: featuredSectionPosition.y,
      startOffset: 0, // No sliding animation needed
      isVisible: true, // Always visible for fade-in
    };
  }, [featuredSectionPosition]);

  // Start animation when conditions are met
  useEffect(() => {
    if (shouldAnimate && !isAnimationActive && !hasAnimationStarted) {
      setIsAnimationActive(true);
      setHasAnimationStarted(false);
      animationStartTime.current = null;
    }
  }, [shouldAnimate, isAnimationActive, hasAnimationStarted]);

  // Reset animation function
  const resetAnimation = useCallback(() => {
    setIsAnimationActive(false);
    setHasAnimationStarted(false);
    animationStartTime.current = null;
  }, []);

  // Calculator function that can be called from draw loop
  const calculateAnimatedElements = useCallback(
    (currentTime: number): CanvasEntranceAnimation => {
      // Calculate animation progress
      let animationProgress = 1;
      let currentIsAnimationActive = isAnimationActive;

      if (isAnimationActive) {
        // Set start time on first frame
        if (!hasAnimationStarted) {
          animationStartTime.current = currentTime;
          setHasAnimationStarted(true);
          animationProgress = 0;
        } else if (animationStartTime.current !== null) {
          const elapsed = currentTime - animationStartTime.current;

          if (elapsed >= ENTRANCE_ANIMATION_DURATION) {
            // Animation complete
            setIsAnimationActive(false);
            currentIsAnimationActive = false;
            animationProgress = 1;
          } else {
            const progress = elapsed / ENTRANCE_ANIMATION_DURATION;

            // Optimized smooth easing - removed expensive Math.sin() calculation
            animationProgress = easeInOutCubic(progress);
          }
        }
      }

      // Calculate animated products using pre-calculated base values
      // OPTIMIZATION: During animation, prioritize visible elements for mobile performance
      const elementsToProcess =
        currentIsAnimationActive && viewState
          ? baseProductCalculations.filter((base) => base.isVisible)
          : baseProductCalculations;

      const animatedProductPlacements: AnimatedProductElement[] = elementsToProcess.map((base) => {
        if (animationProgress >= 1) {
          // Animation complete - use final positions
          return {
            ...base,
            animatedX: base.x,
            animatedY: base.baseY,
            animatedOpacity: 1,
          };
        }

        // During animation - fast inline calculation
        const currentOffset = base.startOffset * (1 - animationProgress);
        return {
          ...base,
          animatedX: base.x,
          animatedY: base.baseY + currentOffset,
          animatedOpacity: animationProgress,
        };
      });

      // Calculate animated tokens using pre-calculated base values
      // OPTIMIZATION: During animation, prioritize visible tokens for mobile performance
      const tokensToProcess =
        currentIsAnimationActive && viewState
          ? baseTokenCalculations.filter((base) => base.isVisible)
          : baseTokenCalculations;

      const animatedTokenPositions: AnimatedTokenElement[] = tokensToProcess.map((base) => {
        if (animationProgress >= 1) {
          // Animation complete - use final positions
          return {
            worldX: base.worldX,
            worldY: base.worldY,
            element: base.element,
            animatedX: base.worldX,
            animatedY: base.baseY,
            animatedOpacity: 1,
            animatedScale: 1,
          };
        }

        // Calculate token-specific progress with delay
        const tokenProgress = Math.max(
          0,
          (animationProgress * ENTRANCE_ANIMATION_DURATION - TOKEN_DELAY) /
            ENTRANCE_ANIMATION_DURATION,
        );
        const clampedTokenProgress = Math.min(1, tokenProgress);

        if (clampedTokenProgress > 0) {
          // Always use smooth easing for tokens
          const easedTokenProgress = easeInOutCubic(clampedTokenProgress);

          // Fast inline calculations using pre-calculated values
          const currentOffset = base.startOffset * (1 - easedTokenProgress);
          return {
            worldX: base.worldX,
            worldY: base.worldY,
            element: base.element,
            animatedX: base.worldX,
            animatedY: base.baseY + currentOffset,
            animatedOpacity: easedTokenProgress,
            animatedScale: 0.95 + 0.05 * easedTokenProgress,
          };
        } else {
          // Token hasn't started animating yet
          return {
            worldX: base.worldX,
            worldY: base.worldY,
            element: base.element,
            animatedX: base.worldX,
            animatedY: base.baseY + base.startOffset,
            animatedOpacity: 0,
            animatedScale: 0.95,
          };
        }
      });

      // Replace the complex featured section animation with:
      let animatedFeaturedSection: AnimatedFeaturedElement | null = null;
      if (baseFeaturedCalculation) {
        animatedFeaturedSection = {
          x: baseFeaturedCalculation.x,
          y: baseFeaturedCalculation.y,
          width: baseFeaturedCalculation.width,
          height: baseFeaturedCalculation.height,
          animatedX: baseFeaturedCalculation.x,
          animatedY: baseFeaturedCalculation.y, // No offset needed
          animatedOpacity: animationProgress, // Use the same progress as other elements
          animatedScale: 1, // No scaling needed
        };
      }

      return {
        animatedProductPlacements,
        animatedTokenPositions,
        animatedFeaturedSection,
        isAnimationActive: currentIsAnimationActive,
        animationProgress,
      };
    },
    [
      isAnimationActive,
      hasAnimationStarted,
      baseProductCalculations,
      baseTokenCalculations,
      baseFeaturedCalculation,
      ENTRANCE_ANIMATION_DURATION,
      TOKEN_DELAY,
    ],
  );

  return {
    calculateAnimatedElements,
    resetAnimation,
  };
};
