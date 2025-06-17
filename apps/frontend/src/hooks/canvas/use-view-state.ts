'use client';

import type React from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { lerp, easeInOutCubic } from '../../lib/canvas/math-utils';
import type { ViewState } from '../../types/canvas';

interface UseViewStateProps {
  imagesLoaded: boolean;
  _unitSize?: number; // optional, ignored
  initialX?: number;
  initialY?: number;
  initialScale?: number;
  panSensitivity?: number;
  animationDuration?: number;
  panInterpolationFactor?: number;
}

export const useViewState = ({
  imagesLoaded,
  _unitSize, // ignored
  initialX = 0,
  initialY = 0,
  initialScale = 1,
  animationDuration = 0.15,
  panInterpolationFactor = 0.3,
}: UseViewStateProps) => {
  void _unitSize; // explicitly ignore _unitSize to satisfy linter
  const [viewState, setViewState] = useState<ViewState>({
    x: initialX,
    y: initialY,
    scale: initialScale,
    targetX: initialX,
    targetY: initialY,
    targetScale: initialScale,
  });
  const [showHomeButton, setShowHomeButton] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const animationStartTime = useRef(0);
  const velocityX = useRef(0);
  const velocityY = useRef(0);
  const friction = 0.9;
  const homeAnimationDuration = useRef(0.8);
  const centeredOnce = useRef(false);

  const canvasWidth = useRef(0);
  const canvasHeight = useRef(0);

  // STEP 5: Canvas dimensions now managed by useCoordinatedResize hook
  // Initialize dimensions immediately
  canvasWidth.current = typeof window !== 'undefined' ? window.innerWidth : 1024;
  canvasHeight.current = typeof window !== 'undefined' ? window.innerHeight : 768;

  useEffect(() => {
    if (!imagesLoaded || centeredOnce.current) return;

    const currentUnitSize = canvasWidth.current < 768 ? 150 : 200;
    const currentHomeAreaWidth = currentUnitSize * 2;
    const currentHomeAreaHeight = currentUnitSize;
    const currentHomeAreaWorldX = -currentUnitSize;
    const currentHomeAreaWorldY = -currentUnitSize;

    const screenCenterX = canvasWidth.current / 2;
    const screenCenterY = canvasHeight.current / 2;

    const newX = screenCenterX - (currentHomeAreaWorldX + currentHomeAreaWidth / 2) * initialScale;
    const newY = screenCenterY - (currentHomeAreaWorldY + currentHomeAreaHeight / 2) * initialScale;

    setViewState((prev) => ({
      ...prev,
      x: newX,
      y: newY,
      targetX: newX,
      targetY: newY,
    }));

    centeredOnce.current = true;
  }, [imagesLoaded, initialScale]);

  useEffect(() => {
    const currentUnitSize = canvasWidth.current < 768 ? 150 : 200;
    const currentHomeAreaWidth = currentUnitSize * 2;
    const currentHomeAreaHeight = currentUnitSize;
    const currentHomeAreaWorldX = -currentUnitSize;
    const currentHomeAreaWorldY = -currentUnitSize;

    const homeAreaCenterX =
      (currentHomeAreaWorldX + currentHomeAreaWidth / 2) * viewState.scale + viewState.x;
    const homeAreaCenterY =
      (currentHomeAreaWorldY + currentHomeAreaHeight / 2) * viewState.scale + viewState.y;

    const screenCenterX = canvasWidth.current / 2;
    const screenCenterY = canvasHeight.current / 2;

    const panThresholdX = canvasWidth.current / 4;
    const panThresholdY = canvasHeight.current / 4;
    const scaleThreshold = 0.1;

    const isPannedFar =
      Math.abs(homeAreaCenterX - screenCenterX) > panThresholdX ||
      Math.abs(homeAreaCenterY - screenCenterY) > panThresholdY;

    const isZoomedEnough = Math.abs(viewState.scale - initialScale) / initialScale > scaleThreshold;

    setShowHomeButton(isPannedFar || isZoomedEnough);
  }, [viewState.x, viewState.y, viewState.scale, initialScale]);

  const animateToHome = useCallback(() => {
    const currentUnitSize = canvasWidth.current < 768 ? 150 : 200;
    const currentHomeAreaWidth = currentUnitSize * 2;
    const currentHomeAreaHeight = currentUnitSize;
    const currentHomeAreaWorldX = -currentUnitSize;
    const currentHomeAreaWorldY = -currentUnitSize;

    const screenCenterX = canvasWidth.current / 2;
    const screenCenterY = canvasHeight.current / 2;

    const targetX =
      screenCenterX - (currentHomeAreaWorldX + currentHomeAreaWidth / 2) * initialScale;
    const targetY =
      screenCenterY - (currentHomeAreaWorldY + currentHomeAreaHeight / 2) * initialScale;

    velocityX.current = 0;
    velocityY.current = 0;

    setViewState((prev) => ({
      ...prev,
      targetX: targetX,
      targetY: targetY,
      targetScale: initialScale,
    }));

    animationStartTime.current = performance.now();
    setIsAnimating(true);
  }, [initialScale]);

  const animateViewState = useCallback(() => {
    const elapsed = performance.now() - animationStartTime.current;
    const currentDuration =
      Math.abs(velocityX.current) < 0.001 && Math.abs(velocityY.current) < 0.001
        ? homeAnimationDuration.current
        : animationDuration;
    const progress = Math.min(1, elapsed / (currentDuration * 1000));
    const easedProgress = easeInOutCubic(progress);

    setViewState((prev) => {
      if (Math.abs(velocityX.current) < 0.001 && Math.abs(velocityY.current) < 0.001) {
        const newX = lerp(prev.x, prev.targetX, easedProgress);
        const newY = lerp(prev.y, prev.targetY, easedProgress);
        const newScale = lerp(prev.scale, prev.targetScale, easedProgress);

        if (progress === 1) {
          // Use a setTimeout to avoid calling setIsAnimating during render
          setTimeout(() => setIsAnimating(false), 0);
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

      velocityX.current *= friction;
      velocityY.current *= friction;

      const newX = lerp(prev.x, prev.targetX, panInterpolationFactor);
      const newY = lerp(prev.y, prev.targetY, panInterpolationFactor);
      const newScale = lerp(prev.scale, prev.targetScale, easedProgress);

      const isComplete =
        Math.abs(velocityX.current) < 0.1 &&
        Math.abs(velocityY.current) < 0.1 &&
        Math.abs(newX - prev.targetX) < 0.1 &&
        Math.abs(newY - prev.targetY) < 0.1 &&
        Math.abs(newScale - prev.targetScale) < 0.0001;

      if (isComplete) {
        // Use a setTimeout to avoid calling setIsAnimating during render
        setTimeout(() => setIsAnimating(false), 0);
        velocityX.current = 0;
        velocityY.current = 0;
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
    });
  }, [animationDuration, panInterpolationFactor]);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLCanvasElement>) => {
      event.preventDefault();

      let deltaX = event.deltaX;
      let deltaY = event.deltaY;

      const isTrackpad = event.deltaMode === 0 && Math.abs(event.deltaY) < 100;
      const sensitivity = isTrackpad ? 1.0 : 2.0;
      deltaX *= sensitivity;
      deltaY *= sensitivity;

      const zoomFactor = 1 / Math.max(0.1, viewState.scale);
      deltaX *= zoomFactor;
      deltaY *= zoomFactor;

      setViewState((prev) => {
        const newTargetX = prev.targetX - deltaX;
        const newTargetY = prev.targetY - deltaY;
        return {
          ...prev,
          targetX: newTargetX,
          targetY: newTargetY,
        };
      });

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
    animateToHome,
    showHomeButton,
    targetX: viewState.targetX,
    targetY: viewState.targetY,
    targetScale: viewState.targetScale,
  };
};
