'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { easeInOutCubic } from '../../lib/canvas/math-utils';
import { getBrowserPerformanceSettings } from '../../lib/utils/browser-utils';
import type { ImageInfo } from '../../types/canvas';

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
  tokenPositions: Array<{ worldX: number; worldY: number }>;

  // Trigger conditions
  shouldAnimate: boolean; // When intro complete + everything loaded
  unitSize: number;
}

interface AnimatedProductElement {
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

interface AnimatedTokenElement {
  worldX: number;
  worldY: number;
  // Animated properties (final calculated values)
  animatedX: number;
  animatedY: number;
  animatedOpacity: number;
  animatedScale: number;
}

interface CanvasEntranceAnimation {
  animatedProductPlacements: AnimatedProductElement[];
  animatedTokenPositions: AnimatedTokenElement[];
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
  shouldAnimate,
  unitSize,
}: UseCanvasEntranceAnimationProps): CanvasEntranceAnimation => {
  // Animation state
  const [isAnimationActive, setIsAnimationActive] = useState(false);
  const [hasAnimationStarted, setHasAnimationStarted] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  const animationStartTime = useRef<number | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Browser-specific settings
  const browserPerf = getBrowserPerformanceSettings();

  // Animation timing constants
  const ENTRANCE_ANIMATION_DURATION = 800; // 800ms total duration
  const TOKEN_DELAY = 100; // Tokens start 100ms after products

  // Animation frame loop to update progress
  const updateAnimation = useCallback(() => {
    if (!isAnimationActive) return;

    const currentTime = performance.now();

    // Set start time on first frame
    if (!hasAnimationStarted) {
      animationStartTime.current = currentTime;
      setHasAnimationStarted(true);
      setAnimationProgress(0);
      animationFrameId.current = requestAnimationFrame(updateAnimation);
      return;
    }

    if (animationStartTime.current === null) {
      setAnimationProgress(0);
      animationFrameId.current = requestAnimationFrame(updateAnimation);
      return;
    }

    const elapsed = currentTime - animationStartTime.current;

    if (elapsed >= ENTRANCE_ANIMATION_DURATION) {
      // Animation complete
      setIsAnimationActive(false);
      setAnimationProgress(1);
      return;
    }

    const progress = elapsed / ENTRANCE_ANIMATION_DURATION;

    // Apply easing based on browser performance
    let finalProgress: number;
    if (browserPerf.useLinearEasing) {
      finalProgress = progress; // Linear for performance mode
    } else {
      // Smooth easing with slight bounce
      const eased = easeInOutCubic(progress);
      finalProgress = eased + Math.sin(eased * Math.PI) * 0.05;
    }

    setAnimationProgress(finalProgress);
    animationFrameId.current = requestAnimationFrame(updateAnimation);
  }, [
    isAnimationActive,
    hasAnimationStarted,
    browserPerf.useLinearEasing,
    ENTRANCE_ANIMATION_DURATION,
  ]);

  // Start animation when conditions are met
  useEffect(() => {
    if (shouldAnimate && !isAnimationActive && !hasAnimationStarted) {
      setIsAnimationActive(true);
      setHasAnimationStarted(false);
      animationStartTime.current = null;
    }
  }, [shouldAnimate, isAnimationActive, hasAnimationStarted]);

  // Start animation loop when animation becomes active
  useEffect(() => {
    if (isAnimationActive && !animationFrameId.current) {
      updateAnimation();
    }

    // Cleanup on unmount or when animation stops
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, [isAnimationActive, updateAnimation]);

  // Animation progress is now managed by state and animation frame loop

  // Calculate animated product placements
  const calculateAnimatedProducts = useCallback(
    (progress: number): AnimatedProductElement[] => {
      return productPlacements.map((placement) => {
        let animatedY = placement.y;
        let animatedOpacity = 1;

        if (progress < 1) {
          // Slide up from bottom
          const startOffset = unitSize * 0.3; // Start 30% of unitSize below
          const currentOffset = startOffset * (1 - progress);
          animatedY = placement.y + currentOffset;

          // Fade in
          animatedOpacity = progress;
        }

        return {
          ...placement,
          animatedX: placement.x, // X position doesn't change
          animatedY,
          animatedOpacity,
        };
      });
    },
    [productPlacements, unitSize],
  );

  // Calculate animated token positions
  const calculateAnimatedTokens = useCallback(
    (progress: number): AnimatedTokenElement[] => {
      return tokenPositions.map((position) => {
        let animatedY = position.worldY;
        let animatedOpacity = 1;
        let animatedScale = 1;

        if (progress < 1) {
          // Calculate token-specific progress with delay
          const tokenProgress = Math.max(
            0,
            (progress * ENTRANCE_ANIMATION_DURATION - TOKEN_DELAY) / ENTRANCE_ANIMATION_DURATION,
          );
          const clampedTokenProgress = Math.min(1, tokenProgress);

          if (clampedTokenProgress > 0) {
            // Apply easing to token progress
            const easedTokenProgress = browserPerf.useLinearEasing
              ? clampedTokenProgress
              : easeInOutCubic(clampedTokenProgress);

            // Slide up from bottom
            const startOffset = unitSize * 0.3;
            const currentOffset = startOffset * (1 - easedTokenProgress);
            animatedY = position.worldY + currentOffset;

            // Fade in
            animatedOpacity = easedTokenProgress;

            // Scale from 95% to 100%
            animatedScale = 0.95 + 0.05 * easedTokenProgress;
          } else {
            // Token hasn't started animating yet
            animatedY = position.worldY + unitSize * 0.3;
            animatedOpacity = 0;
            animatedScale = 0.95;
          }
        }

        return {
          worldX: position.worldX,
          worldY: position.worldY,
          animatedX: position.worldX, // X position doesn't change
          animatedY,
          animatedOpacity,
          animatedScale,
        };
      });
    },
    [
      tokenPositions,
      unitSize,
      browserPerf.useLinearEasing,
      ENTRANCE_ANIMATION_DURATION,
      TOKEN_DELAY,
    ],
  );

  // Calculate current animation state using the state-managed progress
  const animatedProductPlacements = calculateAnimatedProducts(animationProgress);
  const animatedTokenPositions = calculateAnimatedTokens(animationProgress);

  return {
    animatedProductPlacements,
    animatedTokenPositions,
    isAnimationActive,
    animationProgress,
  };
};
