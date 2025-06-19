'use client';

import type React from 'react';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ImageInfo, ViewState } from '../../types/canvas';
import { isHomeArea } from '../../lib/canvas/grid-placement';
import { LuxuryLogger, getImageMetadata } from '../../lib/utils/luxury-logger';
import { browserUtils, mobileUtils, getDeviceCapabilities } from '../../lib/utils/browser-utils';

interface UseCanvasInteractionsProps {
  viewState: ViewState;
  imagesRef: React.MutableRefObject<ImageInfo[]>;
  setSelectedImage: (image: ImageInfo | null) => void;
  imagePlacementMap: React.MutableRefObject<
    Map<string, { image: ImageInfo; x: number; y: number; width: number; height: number }>
  >;
  unitSize: number;
  updateViewState: (deltaX: number, deltaY: number) => void;
}

// Phase 2 Step 7 Action 2: Touch Physics for Google Maps-like feel
interface TouchPhysics {
  velocity: { x: number; y: number };
  lastPositions: Array<{ x: number; y: number; time: number }>;
  momentumAnimationId: number | null;
  isDecelerating: boolean;
}

interface TouchSettings {
  // Device-capability based sensitivity
  touchSensitivity: number;
  mouseSensitivity: number;

  // Momentum physics configuration
  momentumFriction: number;
  velocityDecayFactor: number;
  minimumVelocityThreshold: number;
  maxVelocityTrackingPoints: number;

  // Gesture detection thresholds
  tapTimeThreshold: number;
  tapDistanceThreshold: number;
  dragDistanceThreshold: number;

  // Performance optimization
  trackingThrottleMs: number;
}

// Phase 2 Step 7 Action 2: Device-capability based touch settings
const getTouchSettings = (): TouchSettings => {
  const capabilities = getDeviceCapabilities();
  const isMobile = mobileUtils.isMobileSafari() || capabilities.touchCapable;
  const performanceTier = capabilities.performanceTier;

  // Base settings optimized for device type
  const baseSettings: TouchSettings = {
    // True 1:1 finger tracking - no sensitivity scaling needed
    touchSensitivity: 1.0, // Perfect 1:1 tracking
    mouseSensitivity: 1.0, // No scaling - let browser handle precision

    // Momentum physics - natural Google Maps-like feel
    momentumFriction: 0.95, // 5% deceleration per frame
    velocityDecayFactor: 0.92, // Velocity tracking smoothing
    minimumVelocityThreshold: 0.1, // px/ms minimum for momentum
    maxVelocityTrackingPoints: 3, // Reduced for smoother momentum (less noise)

    // Gesture detection - finger-friendly thresholds
    tapTimeThreshold: 200, // ms
    tapDistanceThreshold: isMobile ? 12 : 8, // px (larger for touch)
    dragDistanceThreshold: isMobile ? 8 : 5, // px

    // NO throttling for live tracking - only throttle momentum calculation
    trackingThrottleMs: 0, // No throttling for responsive 1:1 tracking
  };

  return baseSettings;
};

export const useCanvasInteractions = ({
  viewState,
  setSelectedImage,
  imagePlacementMap,
  unitSize,
  updateViewState,
}: UseCanvasInteractionsProps) => {
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Phase 2 Step 7 Action 2: Touch physics state
  const touchPhysicsRef = useRef<TouchPhysics>({
    velocity: { x: 0, y: 0 },
    lastPositions: [],
    momentumAnimationId: null,
    isDecelerating: false,
  });

  const touchSettingsRef = useRef<TouchSettings>(getTouchSettings());

  const homeAreaWidth = unitSize * 2;
  const homeAreaHeight = unitSize;
  const homeAreaWorldX = -unitSize;
  const homeAreaWorldY = -unitSize;

  // Phase 2 Step 7 Action 2: Momentum physics implementation
  const startMomentumAnimation = useCallback(() => {
    const physics = touchPhysicsRef.current;
    const settings = touchSettingsRef.current;

    if (physics.isDecelerating || physics.momentumAnimationId) return;

    // Calculate initial velocity from recent positions (simpler, more responsive)
    if (physics.lastPositions.length < 2) return;

    const positions = physics.lastPositions;
    const latest = positions[positions.length - 1];
    const previous = positions[positions.length - 2];

    const timeDelta = latest.time - previous.time;
    if (timeDelta <= 0) return;

    const velocityX = (latest.x - previous.x) / timeDelta;
    const velocityY = (latest.y - previous.y) / timeDelta;

    // Only start momentum if velocity exceeds threshold
    const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    if (speed < settings.minimumVelocityThreshold) return;

    physics.velocity = { x: velocityX, y: velocityY };
    physics.isDecelerating = true;

    const animateMomentum = () => {
      const currentSpeed = Math.sqrt(
        physics.velocity.x * physics.velocity.x + physics.velocity.y * physics.velocity.y,
      );

      if (currentSpeed < settings.minimumVelocityThreshold) {
        physics.isDecelerating = false;
        physics.momentumAnimationId = null;
        physics.velocity = { x: 0, y: 0 };
        return;
      }

      // Apply momentum movement with device-optimized sensitivity
      const sensitivity = touchSettingsRef.current.touchSensitivity;
      updateViewState(physics.velocity.x * sensitivity, physics.velocity.y * sensitivity);

      // Apply friction
      physics.velocity.x *= settings.momentumFriction;
      physics.velocity.y *= settings.momentumFriction;

      physics.momentumAnimationId = requestAnimationFrame(animateMomentum);
    };

    physics.momentumAnimationId = requestAnimationFrame(animateMomentum);
  }, [updateViewState]);

  // Phase 2 Step 7 Action 2: Stop momentum on new interaction
  const stopMomentum = useCallback(() => {
    const physics = touchPhysicsRef.current;

    if (physics.momentumAnimationId) {
      cancelAnimationFrame(physics.momentumAnimationId);
      physics.momentumAnimationId = null;
    }

    physics.isDecelerating = false;
    physics.velocity = { x: 0, y: 0 };
    physics.lastPositions = [];
  }, []);

  // Phase 2 Step 7 Action 2: Lightweight position tracking for momentum
  const trackPosition = useCallback((x: number, y: number) => {
    const physics = touchPhysicsRef.current;
    const settings = touchSettingsRef.current;

    // Always track for momentum - no throttling for responsiveness
    physics.lastPositions.push({ x, y, time: performance.now() });

    // Keep only recent positions for smooth momentum calculation
    if (physics.lastPositions.length > settings.maxVelocityTrackingPoints) {
      physics.lastPositions.shift();
    }
  }, []);

  // Phase 2 Step 7 Action 2: Enhanced gesture detection
  const isQuickTap = useCallback(
    (startTime: number, startX: number, startY: number, endX: number, endY: number): boolean => {
      const settings = touchSettingsRef.current;
      const timeDelta = Date.now() - startTime;
      const distance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);

      return timeDelta < settings.tapTimeThreshold && distance < settings.tapDistanceThreshold;
    },
    [],
  );

  // Cleanup momentum animation on unmount
  useEffect(() => {
    return () => {
      stopMomentum();
    };
  }, [stopMomentum]);

  const handleClick = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      // CRITICAL: Early exit if anything isn't ready (Firefox-specific safeguard)
      try {
        if (!viewState || !imagePlacementMap.current || !setSelectedImage) {
          // Dependencies not ready for click handling
          return;
        }
      } catch (error) {
        console.error('[Firefox] Error checking dependencies:', error);
        return;
      }

      let clientX: number;
      let clientY: number;

      if ('touches' in event) {
        // For touch events, use changedTouches if touches is empty (on touchend)
        const touch = event.touches[0] || event.changedTouches?.[0];
        if (!touch) {
          // No touch data available
          return;
        }
        clientX = touch.clientX;
        clientY = touch.clientY;
      } else {
        // Mouse event
        clientX = event.clientX;
        clientY = event.clientY;
      }

      const canvas = event.currentTarget as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();

      const worldX = (clientX - rect.left - viewState.x) / viewState.scale;
      const worldY = (clientY - rect.top - viewState.y) / viewState.scale;

      // Check for click within the Home Area
      if (
        isHomeArea(worldX, worldY, homeAreaWorldX, homeAreaWorldY, homeAreaWidth, homeAreaHeight)
      ) {
        LuxuryLogger.log(`Clicked home area at world: ${worldX}, ${worldY}`, 'info');

        const quadWidth = homeAreaWidth / 2;
        const quadHeight = homeAreaHeight / 2;

        const createQuadX = homeAreaWorldX + quadWidth;
        const createQuadY = homeAreaWorldY;

        const aboutQuadX = homeAreaWorldX;
        const aboutQuadY = homeAreaWorldY;

        if (
          worldX >= aboutQuadX &&
          worldX < aboutQuadX + quadWidth &&
          worldY >= aboutQuadY &&
          worldY < aboutQuadY + quadHeight
        ) {
          LuxuryLogger.log('About quadrant clicked! Opening docs.', 'info');
          window.open('https://docs.aces.fun/', '_blank');
          return;
        }

        if (
          worldX >= createQuadX &&
          worldX < createQuadX + quadWidth &&
          worldY >= createQuadY &&
          worldY < createQuadY + quadHeight
        ) {
          LuxuryLogger.log('CREATE quadrant clicked! Navigating to /create-token', 'info');
          window.location.href = '/create-token';
          return;
        }
        return;
      }

      let clickedImageInfo: ImageInfo | null = null;

      // Firefox-specific: Additional safety check for placement map
      if (!imagePlacementMap.current || imagePlacementMap.current.size === 0) {
        // Image placement map not ready, ignoring click
        return;
      }

      // Iterate over the placed items to find the one that was clicked
      try {
        for (const placedItem of imagePlacementMap.current.values()) {
          // Firefox-specific: Extra validation
          if (!placedItem || !placedItem.image) {
            // Invalid placed item detected, skipping
            continue;
          }

          const { image, x, y, width, height } = placedItem;

          if (worldX >= x && worldX <= x + width && worldY >= y && worldY <= y + height) {
            clickedImageInfo = image;
            break;
          }
        }
      } catch (error) {
        // Error iterating placement map
        return;
      }

      if (clickedImageInfo) {
        try {
          if (clickedImageInfo.type === 'create-token') {
            LuxuryLogger.log(`Create Token Square clicked`, 'info');
            window.location.href = '/create-token';
          } else {
            setSelectedImage(clickedImageInfo);
            const safeMetadata = getImageMetadata(clickedImageInfo);
            LuxuryLogger.log(`Product image clicked: ${safeMetadata.title}`, 'info');
          }
        } catch (error) {
          console.error('[Firefox] Error handling image click:', error);
          // Fallback: still try to open modal even if logging fails
          if (clickedImageInfo.type !== 'create-token') {
            setSelectedImage(clickedImageInfo);
          }
        }
      }
    },
    [
      viewState,
      setSelectedImage,
      imagePlacementMap,
      homeAreaWorldX,
      homeAreaWorldY,
      homeAreaWidth,
      homeAreaHeight,
    ],
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      // Only handle left mouse button for panning
      if (event.button !== 0) return;

      // Phase 2 Step 7 Action 2: Stop any ongoing momentum
      stopMomentum();

      event.preventDefault();
      setIsDragging(false);
      dragStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        time: Date.now(),
      };
      setLastMousePos({ x: event.clientX, y: event.clientY });
      setIsPanning(true);

      // Phase 2 Step 7 Action 2: Start position tracking for momentum
      trackPosition(event.clientX, event.clientY);
    },
    [stopMomentum, trackPosition],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isPanning) return;

      event.preventDefault();

      // Phase 2 Step 7 Action 2: Enhanced position tracking
      trackPosition(event.clientX, event.clientY);

      const deltaX = event.clientX - lastMousePos.x;
      const deltaY = event.clientY - lastMousePos.y;

      if (!isDragging && dragStartRef.current) {
        const settings = touchSettingsRef.current;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance > settings.dragDistanceThreshold) {
          setIsDragging(true);
        }
      }

      // Phase 2 Step 7 Action 2: Apply movement with device-optimized sensitivity
      const sensitivity = touchSettingsRef.current.mouseSensitivity;
      updateViewState(deltaX * sensitivity, deltaY * sensitivity);

      setLastMousePos({ x: event.clientX, y: event.clientY });
    },
    [isPanning, isDragging, updateViewState, trackPosition],
  );

  const handleMouseUp = useCallback(
    (event: React.MouseEvent) => {
      // Only handle left mouse button
      if (event.button !== 0) return;

      event.preventDefault();

      // Phase 2 Step 7 Action 2: Enhanced tap detection
      if (!isDragging && dragStartRef.current) {
        const isQuickClick = isQuickTap(
          dragStartRef.current.time,
          dragStartRef.current.x,
          dragStartRef.current.y,
          event.clientX,
          event.clientY,
        );

        if (isQuickClick) {
          handleClick(event);
        } else if (isPanning) {
          // Phase 2 Step 7 Action 2: Start momentum animation for mouse drag
          startMomentumAnimation();
        }
      }

      // Reset panning state
      setIsPanning(false);
      setIsDragging(false);
      dragStartRef.current = null;
    },
    [handleClick, isDragging, isPanning, isQuickTap, startMomentumAnimation],
  );

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      // Phase 2 Step 7 Action 2: Stop any ongoing momentum immediately
      stopMomentum();

      // Only handle single finger touch for panning (no zoom support)
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        setIsDragging(false);
        dragStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          time: Date.now(),
        };
        setLastMousePos({ x: touch.clientX, y: touch.clientY });
        setIsPanning(true);

        // Phase 2 Step 7 Action 2: Start position tracking for momentum
        trackPosition(touch.clientX, touch.clientY);

        // Smart preventDefault - only prevent when we're sure we're panning
        event.preventDefault();
      } else {
        // Multiple touches - prevent default to disable zoom/pinch
        event.preventDefault();
        setIsPanning(false);
        setIsDragging(false);
        dragStartRef.current = null;
      }
    },
    [stopMomentum, trackPosition],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      // Only handle single finger touch for panning
      if (!isPanning || event.touches.length !== 1) {
        // Multiple touches - stop momentum and prevent zoom
        if (event.touches.length > 1) {
          stopMomentum();
          event.preventDefault();
        }
        return;
      }

      const touch = event.touches[0];

      // Phase 2 Step 7 Action 2: Track position for momentum calculation
      trackPosition(touch.clientX, touch.clientY);

      const deltaX = touch.clientX - lastMousePos.x;
      const deltaY = touch.clientY - lastMousePos.y;

      if (!isDragging && dragStartRef.current) {
        const settings = touchSettingsRef.current;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance > settings.dragDistanceThreshold) {
          setIsDragging(true);
          event.preventDefault();
        }
      } else if (isDragging) {
        event.preventDefault();
      }

      // Phase 2 Step 7 Action 2: Apply movement with mobile-optimized sensitivity (1:1 finger tracking)
      const sensitivity = touchSettingsRef.current.touchSensitivity;
      updateViewState(deltaX * sensitivity, deltaY * sensitivity);

      setLastMousePos({ x: touch.clientX, y: touch.clientY });
    },
    [isPanning, isDragging, updateViewState, trackPosition, stopMomentum],
  );

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      event.preventDefault();

      // Phase 2 Step 7 Action 2: Enhanced touch gesture detection
      if (!isDragging && dragStartRef.current) {
        // Use the last touch position from changedTouches (finger that was lifted)
        const lastTouch = event.changedTouches[0];
        if (lastTouch) {
          const isTap = isQuickTap(
            dragStartRef.current.time,
            dragStartRef.current.x,
            dragStartRef.current.y,
            lastTouch.clientX,
            lastTouch.clientY,
          );

          if (isTap) {
            handleClick(event);
          }
        }
      } else if (isDragging && isPanning) {
        // Phase 2 Step 7 Action 2: Start momentum animation for touch gestures
        startMomentumAnimation();
      }

      // Reset panning state
      setIsPanning(false);
      setIsDragging(false);
      dragStartRef.current = null;
    },
    [handleClick, isDragging, isPanning, isQuickTap, startMomentumAnimation],
  );

  return {
    isPanning,
    isDragging,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
};
