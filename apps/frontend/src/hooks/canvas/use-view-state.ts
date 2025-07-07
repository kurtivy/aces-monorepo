'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type React from 'react';
import { lerp, easeInOutCubic } from '../../lib/canvas/math-utils';
import type { ViewState } from '../../types/canvas';
import { browserUtils } from '../../lib/utils/browser-utils';

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

  const viewStateRef = useRef(viewState);
  viewStateRef.current = viewState;

  const animationStartTime = useRef(0);
  const homeAnimationDuration = useRef(0.8);
  const centeredOnce = useRef(false);

  const canvasWidth = useRef(0);
  const canvasHeight = useRef(0);

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

  const showHomeButtonDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const initialScaleRef = useRef(initialScale);
  initialScaleRef.current = initialScale;

  const updateHomeButtonVisibility = useCallback(() => {
    // Clear existing timeout
    if (showHomeButtonDebounceRef.current) {
      clearTimeout(showHomeButtonDebounceRef.current);
    }

    showHomeButtonDebounceRef.current = setTimeout(() => {
      const currentUnitSize = canvasWidth.current < 768 ? 150 : 200;
      const currentHomeAreaWidth = currentUnitSize * 2;
      const currentHomeAreaHeight = currentUnitSize;
      const currentHomeAreaWorldX = -currentUnitSize;
      const currentHomeAreaWorldY = -currentUnitSize;

      const vsRef = viewStateRef.current;
      const homeAreaCenterX =
        (currentHomeAreaWorldX + currentHomeAreaWidth / 2) * vsRef.scale + vsRef.x;
      const homeAreaCenterY =
        (currentHomeAreaWorldY + currentHomeAreaHeight / 2) * vsRef.scale + vsRef.y;

      const screenCenterX = canvasWidth.current / 2;
      const screenCenterY = canvasHeight.current / 2;

      const panThresholdX = canvasWidth.current / 4;
      const panThresholdY = canvasHeight.current / 4;
      const scaleThreshold = 0.1;

      const isPannedFar =
        Math.abs(homeAreaCenterX - screenCenterX) > panThresholdX ||
        Math.abs(homeAreaCenterY - screenCenterY) > panThresholdY;

      const isZoomedEnough =
        Math.abs(vsRef.scale - initialScaleRef.current) / initialScaleRef.current > scaleThreshold;

      setShowHomeButton(isPannedFar || isZoomedEnough);
    }, 100);
  }, []);

  // Store the function in a ref to access latest version
  const updateHomeButtonVisibilityRef = useRef(updateHomeButtonVisibility);
  useEffect(() => {
    updateHomeButtonVisibilityRef.current = updateHomeButtonVisibility;
  }, [updateHomeButtonVisibility]);

  const prevTargetRef = useRef({
    x: viewState.targetX,
    y: viewState.targetY,
    scale: viewState.targetScale,
  });

  useEffect(() => {
    const prev = prevTargetRef.current;
    const current = { x: viewState.targetX, y: viewState.targetY, scale: viewState.targetScale };

    if (prev.x !== current.x || prev.y !== current.y || prev.scale !== current.scale) {
      updateHomeButtonVisibilityRef.current();
      prevTargetRef.current = current;
    }

    return () => {
      if (showHomeButtonDebounceRef.current) {
        clearTimeout(showHomeButtonDebounceRef.current);
      }
    };
  }, [viewState.targetX, viewState.targetY, viewState.targetScale]);

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
    const progress = Math.min(1, elapsed / (homeAnimationDuration.current * 1000));
    const easedProgress = easeInOutCubic(progress);

    setViewState((prev) => {
      const newX = lerp(prev.x, prev.targetX, easedProgress);
      const newY = lerp(prev.y, prev.targetY, easedProgress);
      const newScale = lerp(prev.scale, prev.targetScale, easedProgress);

      if (progress === 1) {
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
    });
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();

    let deltaX = event.deltaX;
    let deltaY = event.deltaY;

    // Browser-specific wheel delta normalization for consistent scrolling feel
    const isFirefox = browserUtils.isFirefox();
    const isBrave = navigator.userAgent.includes('Brave');
    const isChrome = browserUtils.isChrome();
    const isWindows = typeof navigator !== 'undefined' && navigator.platform.includes('Win');
    const isTrackpad = event.deltaMode === 0 && Math.abs(event.deltaY) < 100;

    // Base sensitivity (trackpad vs mouse)
    let sensitivity = isTrackpad ? 1.0 : 2.0;

    // Browser-specific delta scaling for consistent feel across all browsers
    if (isFirefox) {
      // Firefox reports larger delta values, need to scale them down
      sensitivity *= isTrackpad ? 0.7 : 0.8; // More aggressive scaling for Firefox
    } else if (isBrave) {
      // Brave has slight privacy processing overhead, compensate with sensitivity boost
      sensitivity *= isTrackpad ? 1.1 : 1.15; // Slightly more sensitive for Brave
    } else if (isChrome && isWindows) {
      // Windows Chrome wheel events need different handling than Mac Chrome
      // Windows reports different wheel delta values and has different mouse/trackpad behavior
      sensitivity *= isTrackpad ? 0.9 : 1.2; // Slightly reduced for trackpad, increased for mouse
    }
    // Mac Chrome/Safari use baseline sensitivity (no modification needed)

    deltaX *= sensitivity;
    deltaY *= sensitivity;

    setViewState((prev) => {
      const zoomFactor = 1 / Math.max(0.1, prev.scale);
      const adjustedDeltaX = deltaX * zoomFactor;
      const adjustedDeltaY = deltaY * zoomFactor;

      const newX = prev.x - adjustedDeltaX;
      const newY = prev.y - adjustedDeltaY;
      const newTargetX = prev.targetX - adjustedDeltaX;
      const newTargetY = prev.targetY - adjustedDeltaY;

      return {
        ...prev,
        x: newX,
        y: newY,
        targetX: newTargetX,
        targetY: newTargetY,
      };
    });
  }, []);

  const updateViewState = useCallback((deltaX: number, deltaY: number) => {
    const sensitivity = 1.0;
    const adjustedDeltaX = deltaX * sensitivity;
    const adjustedDeltaY = deltaY * sensitivity;

    setViewState((prev) => {
      const newX = prev.x + adjustedDeltaX;
      const newY = prev.y + adjustedDeltaY;
      const newTargetX = prev.targetX + adjustedDeltaX;
      const newTargetY = prev.targetY + adjustedDeltaY;

      return {
        ...prev,
        x: newX,
        y: newY,
        targetX: newTargetX,
        targetY: newTargetY,
      };
    });
  }, []);

  return {
    viewState,
    handleWheel,
    animateViewState,
    isAnimating,
    animateToHome,
    showHomeButton,
    updateViewState,
    targetX: viewState.targetX,
    targetY: viewState.targetY,
    targetScale: viewState.targetScale,
  };
};
