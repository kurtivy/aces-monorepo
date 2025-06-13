'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { lerp, easeInOutCubic } from '../../lib/canvas/math-utils'; // Adjusted path
import {
  HOME_AREA_WIDTH,
  HOME_AREA_HEIGHT,
  HOME_AREA_WORLD_X,
  HOME_AREA_WORLD_Y,
} from '../../constants/canvas'; // Adjusted path
import { ViewState } from '../../types/canvas'; // Adjusted path

interface UseViewStateProps {
  imagesLoaded: boolean; // Added this prop
  initialX?: number;
  initialY?: number;
  initialScale?: number;
  panSensitivity?: number;
  animationDuration?: number;
  panInterpolationFactor?: number; // Preserved this prop
}

export const useViewState = ({
  imagesLoaded, // Destructure the new prop
  initialX = 0,
  initialY = 0,
  initialScale = 1,
  animationDuration = 0.15, // Default animation duration for regular interactions
  panInterpolationFactor = 0.3, // Preserved this prop
}: UseViewStateProps) => {
  const [viewState, setViewState] = useState<ViewState>({
    x: initialX,
    y: initialY,
    scale: initialScale,
    targetX: initialX,
    targetY: initialY,
    targetScale: initialScale,
  });

  const [isAnimating, setIsAnimating] = useState(false);
  const animationStartTime = useRef(0);
  const velocityX = useRef(0);
  const velocityY = useRef(0);
  const friction = 0.9; // Adjust this for how quickly scrolling slows down
  const homeAnimationDuration = useRef(0.8); // 800ms for home animation
  const centeredOnce = useRef(false); // Add this ref

  // Set initial view to center the home area
  useEffect(() => {
    const updateCenter = () => {
      const canvasWidth = window.innerWidth;
      const canvasHeight = window.innerHeight;

      // Calculate new x and y to center the HOME_AREA in world coordinates on the screen
      const screenCenterX = canvasWidth / 2;
      const screenCenterY = canvasHeight / 2;

      const newX = screenCenterX - (HOME_AREA_WORLD_X + HOME_AREA_WIDTH / 2) * viewState.scale;
      const newY = screenCenterY - (HOME_AREA_WORLD_Y + HOME_AREA_HEIGHT / 2) * viewState.scale;

      setViewState((prev) => ({
        ...prev,
        x: newX,
        y: newY,
        targetX: newX,
        targetY: newY,
      }));

      animationStartTime.current = performance.now();
      setIsAnimating(true);
    };

    // Only run the centering logic ONCE when the images have finished loading.
    if (imagesLoaded && !centeredOnce.current) {
      updateCenter();
      centeredOnce.current = true; // Mark as done
    }

    window.addEventListener('resize', updateCenter);
    return () => {
      window.removeEventListener('resize', updateCenter);
    };
  }, [imagesLoaded]); // Remove viewState.scale from dependencies

  const animateToHome = useCallback(() => {
    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight;

    // Calculate target x and y to center the HOME_AREA in world coordinates on the screen
    const screenCenterX = canvasWidth / 2;
    const screenCenterY = canvasHeight / 2;

    const targetX = screenCenterX - (HOME_AREA_WORLD_X + HOME_AREA_WIDTH / 2) * initialScale;
    const targetY = screenCenterY - (HOME_AREA_WORLD_Y + HOME_AREA_HEIGHT / 2) * initialScale;

    // Reset velocities to ensure direct animation to home
    velocityX.current = 0;
    velocityY.current = 0;

    setViewState((prev) => ({
      ...prev,
      targetX: targetX,
      targetY: targetY,
      targetScale: initialScale, // Use the initial scale
    }));

    animationStartTime.current = performance.now();
    setIsAnimating(true);
  }, [initialScale]); // Depend on initialScale

  const animateViewState = useCallback(() => {
    if (!isAnimating) return;

    const elapsed = performance.now() - animationStartTime.current;
    // Use longer duration for home animation (when velocities are 0)
    const currentDuration =
      Math.abs(velocityX.current) < 0.001 && Math.abs(velocityY.current) < 0.001
        ? homeAnimationDuration.current
        : animationDuration;
    let progress = Math.min(1, elapsed / (currentDuration * 1000));
    progress = easeInOutCubic(progress); // Apply easing function

    setViewState((prev) => {
      // If velocities are 0, we're doing a direct animation (like to home)
      if (Math.abs(velocityX.current) < 0.001 && Math.abs(velocityY.current) < 0.001) {
        const newX = lerp(prev.x, prev.targetX, progress);
        const newY = lerp(prev.y, prev.targetY, progress);
        const newScale = lerp(prev.scale, prev.targetScale, progress);

        // Check if animation is complete
        const isComplete =
          Math.abs(newX - prev.targetX) < 0.1 &&
          Math.abs(newY - prev.targetY) < 0.1 &&
          Math.abs(newScale - prev.targetScale) < 0.0001;

        if (isComplete) {
          setIsAnimating(false);
          return {
            x: prev.targetX,
            y: prev.targetY,
            scale: prev.targetScale,
            targetX: prev.targetX,
            targetY: prev.targetY,
            targetScale: prev.targetScale,
          };
        }

        return {
          x: newX,
          y: newY,
          scale: newScale,
          targetX: prev.targetX,
          targetY: prev.targetY,
          targetScale: prev.targetScale,
        };
      }

      // For velocity-based animations (like scrolling)
      velocityX.current *= friction;
      velocityY.current *= friction;

      const newTargetX = prev.x + velocityX.current;
      const newTargetY = prev.y + velocityY.current;

      const newX = lerp(prev.x, newTargetX, panInterpolationFactor);
      const newY = lerp(prev.y, newTargetY, panInterpolationFactor);
      const newScale = lerp(prev.scale, prev.targetScale, progress);

      const isComplete =
        Math.abs(velocityX.current) < 0.1 &&
        Math.abs(velocityY.current) < 0.1 &&
        Math.abs(newX - newTargetX) < 0.1 &&
        Math.abs(newY - newTargetY) < 0.1 &&
        Math.abs(newScale - prev.targetScale) < 0.0001;

      if (isComplete) {
        setIsAnimating(false);
        velocityX.current = 0;
        velocityY.current = 0;
        return {
          x: newTargetX,
          y: newTargetY,
          scale: prev.targetScale,
          targetX: newTargetX,
          targetY: newTargetY,
          targetScale: prev.targetScale,
        };
      }

      return {
        x: newX,
        y: newY,
        scale: newScale,
        targetX: newTargetX,
        targetY: newTargetY,
        targetScale: prev.targetScale,
      };
    });
  }, [isAnimating, animationDuration, panInterpolationFactor]);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLCanvasElement>) => {
      event.preventDefault(); // Prevent default scrolling behavior

      let deltaX = event.deltaX;
      let deltaY = event.deltaY;

      const isTrackpad = event.deltaMode === 0 && Math.abs(event.deltaY) < 100;

      const sensitivity = isTrackpad ? 1.0 : 2.0; // Keep current sensitivity for now
      deltaX *= sensitivity;
      deltaY *= sensitivity;

      // Apply zoom scaling
      const zoomFactor = 1 / Math.max(0.1, viewState.scale);
      deltaX *= zoomFactor;
      deltaY *= zoomFactor;

      // Add delta to velocity
      velocityX.current -= deltaX; // Invert for natural scroll
      velocityY.current -= deltaY;

      // Start animation if not already animating
      if (!isAnimating) {
        animationStartTime.current = performance.now();
        setIsAnimating(true);
      }
    },
    [isAnimating, viewState.scale],
  );

  return {
    viewState,
    handleWheel,
    animateViewState,
    isAnimating,
    animateToHome, // Export animateToHome
    targetX: viewState.targetX,
    targetY: viewState.targetY,
    targetScale: viewState.targetScale,
  };
};
