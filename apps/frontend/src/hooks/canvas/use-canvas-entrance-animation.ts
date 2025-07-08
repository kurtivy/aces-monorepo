'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { easeInOutCubic } from '../../lib/canvas/math-utils';
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
  currentTime: number; // From main render loop
  unitSize: number;
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

            // Force smooth easing during animation (ignore performance settings)
            const eased = easeInOutCubic(progress);
            animationProgress = eased + Math.sin(eased * Math.PI) * 0.05;
          }
        }
      }

      // Calculate animated products
      const animatedProductPlacements: AnimatedProductElement[] = productPlacements.map(
        (placement) => {
          let animatedY = placement.y;
          let animatedOpacity = 1;

          if (animationProgress < 1) {
            // Slide up from bottom
            const startOffset = unitSize * 0.3; // Start 30% of unitSize below
            const currentOffset = startOffset * (1 - animationProgress);
            animatedY = placement.y + currentOffset;

            // Fade in
            animatedOpacity = animationProgress;
          }

          return {
            ...placement,
            animatedX: placement.x,
            animatedY,
            animatedOpacity,
          };
        },
      );

      // Calculate animated tokens
      const animatedTokenPositions: AnimatedTokenElement[] = tokenPositions.map((position) => {
        let animatedY = position.worldY;
        let animatedOpacity = 1;
        let animatedScale = 1;

        if (animationProgress < 1) {
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
          animatedX: position.worldX,
          animatedY,
          animatedOpacity,
          animatedScale,
        };
      });

      return {
        animatedProductPlacements,
        animatedTokenPositions,
        isAnimationActive: currentIsAnimationActive,
        animationProgress,
      };
    },
    [
      isAnimationActive,
      hasAnimationStarted,
      productPlacements,
      tokenPositions,
      unitSize,
      ENTRANCE_ANIMATION_DURATION,
      TOKEN_DELAY,
    ],
  );

  return {
    calculateAnimatedElements,
    resetAnimation,
  };
};
