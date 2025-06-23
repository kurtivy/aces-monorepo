'use client';

import type React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import type { ImageInfo, ViewState } from '../../types/canvas';
import { isHomeArea } from '../../lib/canvas/grid-placement';
import { mobileUtils } from '../../lib/utils/browser-utils';

interface UseCanvasInteractionsProps {
  viewState: ViewState;
  setSelectedImage: (image: ImageInfo | null) => void;
  imagePlacementMap: React.MutableRefObject<
    Map<string, { image: ImageInfo; x: number; y: number; width: number; height: number }>
  >;
  unitSize: number;
  updateViewState: (deltaX: number, deltaY: number) => void;
  repeatedPlacements?: Map<
    string,
    Array<{
      image: ImageInfo;
      x: number;
      y: number;
      width: number;
      height: number;
      index: number;
      tileId: string;
    }>
  >;
  repeatedTokens?: Map<
    string,
    Array<{
      worldX: number;
      worldY: number;
      tileId: string;
    }>
  >;
}

// Ultra-high sensitivity for maximum responsiveness
const TOUCH_SETTINGS = {
  touchSensitivity: mobileUtils.isMobileSafari() ? 18.0 : 15.0,
  mouseSensitivity: 15.0,
  velocityMultiplier: 3.75,
  momentumFriction: 0.85,
  minVelocity: 0.1,
  tapThreshold: 10,
  tapTimeLimit: 180,
  dragThreshold: 1.5,
} as const;

// Optimized touch physics tracking
interface TouchPhysics {
  velocity: { x: number; y: number };
  lastPos: { x: number; y: number; time: number } | null;
  momentumId: number | null;
  isDragging: boolean;
}

const createTouchPhysics = (): TouchPhysics => ({
  velocity: { x: 0, y: 0 },
  lastPos: null,
  momentumId: null,
  isDragging: false,
});

export const useCanvasInteractions = ({
  viewState,
  setSelectedImage,
  imagePlacementMap,
  unitSize,
  updateViewState,
  repeatedPlacements,
  repeatedTokens,
}: UseCanvasInteractionsProps) => {
  const [isPanning, setIsPanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const touchPhysicsRef = useRef<TouchPhysics>(createTouchPhysics());
  const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boundsRef = useRef<DOMRect | null>(null);

  const homeAreaWidth = unitSize * 2;
  const homeAreaHeight = unitSize;
  const homeAreaWorldX = -unitSize;
  const homeAreaWorldY = -unitSize;

  // Optimized coordinate calculation with caching
  const getWorldCoordinates = useCallback(
    (clientX: number, clientY: number) => {
      if (!boundsRef.current && canvasRef.current) {
        boundsRef.current = canvasRef.current.getBoundingClientRect();
      }

      const rect = boundsRef.current;
      if (!rect) return null;

      return {
        worldX: (clientX - rect.left - viewState.x) / viewState.scale,
        worldY: (clientY - rect.top - viewState.y) / viewState.scale,
      };
    },
    [viewState],
  );

  // Simplified momentum animation - no complex physics, just smooth deceleration
  const startMomentum = useCallback(() => {
    const physics = touchPhysicsRef.current;

    if (
      Math.abs(physics.velocity.x) < TOUCH_SETTINGS.minVelocity &&
      Math.abs(physics.velocity.y) < TOUCH_SETTINGS.minVelocity
    ) {
      return;
    }

    const animate = () => {
      // Apply movement with enhanced velocity
      updateViewState(physics.velocity.x, physics.velocity.y);

      // Smooth deceleration curve
      physics.velocity.x *= TOUCH_SETTINGS.momentumFriction;
      physics.velocity.y *= TOUCH_SETTINGS.momentumFriction;

      // Continue if still moving
      if (
        Math.abs(physics.velocity.x) > TOUCH_SETTINGS.minVelocity ||
        Math.abs(physics.velocity.y) > TOUCH_SETTINGS.minVelocity
      ) {
        physics.momentumId = requestAnimationFrame(animate);
      } else {
        physics.momentumId = null;
        physics.velocity = { x: 0, y: 0 };
      }
    };

    physics.momentumId = requestAnimationFrame(animate);
  }, [updateViewState]);

  const stopMomentum = useCallback(() => {
    const physics = touchPhysicsRef.current;
    if (physics.momentumId) {
      cancelAnimationFrame(physics.momentumId);
      physics.momentumId = null;
    }
    physics.velocity = { x: 0, y: 0 };
  }, []);

  // Simplified click handling - minimal validation for speed
  const handleClick = useCallback(
    (clientX: number, clientY: number) => {
      const coords = getWorldCoordinates(clientX, clientY);
      if (!coords) return;

      const { worldX, worldY } = coords;

      // Check home area
      if (
        isHomeArea(worldX, worldY, homeAreaWorldX, homeAreaWorldY, homeAreaWidth, homeAreaHeight)
      ) {
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
          window.open('https://docs.aces.fun/', '_blank');
          return;
        }

        if (
          worldX >= createQuadX &&
          worldX < createQuadX + quadWidth &&
          worldY >= createQuadY &&
          worldY < createQuadY + quadHeight
        ) {
          window.location.href = '/create-token';
          return;
        }
        return;
      }

      // Check image placements
      let clickedImage: ImageInfo | null = null;

      // Original placements
      for (const placedItem of imagePlacementMap.current?.values() || []) {
        if (!placedItem?.image) continue;
        const { image, x, y, width, height } = placedItem;

        if (worldX >= x && worldX <= x + width && worldY >= y && worldY <= y + height) {
          clickedImage = image;
          break;
        }
      }

      // Repeated placements
      if (!clickedImage && repeatedPlacements) {
        for (const tilePlacements of repeatedPlacements.values()) {
          for (const placement of tilePlacements) {
            if (
              worldX >= placement.x &&
              worldX <= placement.x + placement.width &&
              worldY >= placement.y &&
              worldY <= placement.y + placement.height
            ) {
              clickedImage = placement.image;
              break;
            }
          }
          if (clickedImage) break;
        }
      }

      // Repeated tokens
      if (!clickedImage && repeatedTokens) {
        for (const tileTokens of repeatedTokens.values()) {
          for (const tokenPos of tileTokens) {
            if (
              worldX >= tokenPos.worldX &&
              worldX <= tokenPos.worldX + unitSize &&
              worldY >= tokenPos.worldY &&
              worldY <= tokenPos.worldY + unitSize
            ) {
              window.location.href = '/create-token';
              return;
            }
          }
        }
      }

      if (clickedImage) {
        if (clickedImage.type === 'create-token') {
          window.location.href = '/create-token';
        } else {
          setSelectedImage(clickedImage);
        }
      }
    },
    [
      getWorldCoordinates,
      homeAreaWorldX,
      homeAreaWorldY,
      homeAreaWidth,
      homeAreaHeight,
      imagePlacementMap,
      repeatedPlacements,
      repeatedTokens,
      unitSize,
      setSelectedImage,
    ],
  );

  // Mouse handlers - simplified for speed
  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) return;

      canvasRef.current = event.currentTarget as HTMLCanvasElement;
      boundsRef.current = null; // Reset bounds cache

      stopMomentum();

      const physics = touchPhysicsRef.current;
      physics.lastPos = { x: event.clientX, y: event.clientY, time: performance.now() };
      physics.isDragging = false;

      dragStartRef.current = { x: event.clientX, y: event.clientY, time: Date.now() };
      setIsPanning(true);

      event.preventDefault();
    },
    [stopMomentum],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isPanning) return;

      const physics = touchPhysicsRef.current;
      if (!physics.lastPos) return;

      const deltaX = (event.clientX - physics.lastPos.x) * TOUCH_SETTINGS.mouseSensitivity;
      const deltaY = (event.clientY - physics.lastPos.y) * TOUCH_SETTINGS.mouseSensitivity;

      // Immediate movement - no validation overhead
      updateViewState(deltaX, deltaY);

      // Update velocity for momentum
      const now = performance.now();
      const timeDelta = now - physics.lastPos.time;
      if (timeDelta > 0) {
        physics.velocity.x = (deltaX / timeDelta) * TOUCH_SETTINGS.velocityMultiplier;
        physics.velocity.y = (deltaY / timeDelta) * TOUCH_SETTINGS.velocityMultiplier;
      }

      physics.lastPos = { x: event.clientX, y: event.clientY, time: now };

      // Mark as dragging if moved enough
      if (!physics.isDragging && dragStartRef.current) {
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance > TOUCH_SETTINGS.dragThreshold) {
          physics.isDragging = true;
          setIsDragging(true);
        }
      }

      event.preventDefault();
    },
    [isPanning, updateViewState],
  );

  const handleMouseUp = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) return;

      const physics = touchPhysicsRef.current;

      // Handle click vs drag
      if (!physics.isDragging && dragStartRef.current) {
        const timeDelta = Date.now() - dragStartRef.current.time;
        const distance = Math.sqrt(
          (event.clientX - dragStartRef.current.x) ** 2 +
            (event.clientY - dragStartRef.current.y) ** 2,
        );

        if (timeDelta < TOUCH_SETTINGS.tapTimeLimit && distance < TOUCH_SETTINGS.tapThreshold) {
          handleClick(event.clientX, event.clientY);
        }
      } else if (physics.isDragging) {
        // Start momentum
        startMomentum();
      }

      // Reset state
      setIsPanning(false);
      setIsDragging(false);
      physics.isDragging = false;
      physics.lastPos = null;
      dragStartRef.current = null;

      event.preventDefault();
    },
    [handleClick, startMomentum],
  );

  // Touch handlers - optimized for maximum responsiveness
  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (event.touches.length !== 1) return;

      canvasRef.current = event.currentTarget as HTMLCanvasElement;
      boundsRef.current = null; // Reset bounds cache

      const touch = event.touches[0];
      stopMomentum();

      const physics = touchPhysicsRef.current;
      physics.lastPos = { x: touch.clientX, y: touch.clientY, time: performance.now() };
      physics.isDragging = false;

      dragStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      setIsPanning(true);

      // Only prevent default for non-clickable areas to maintain native behavior
      const coords = getWorldCoordinates(touch.clientX, touch.clientY);
      if (coords) {
        const { worldX, worldY } = coords;
        const isClickable = isHomeArea(
          worldX,
          worldY,
          homeAreaWorldX,
          homeAreaWorldY,
          homeAreaWidth,
          homeAreaHeight,
        );
        if (!isClickable) {
          event.preventDefault();
        }
      }
    },
    [
      stopMomentum,
      getWorldCoordinates,
      homeAreaWorldX,
      homeAreaWorldY,
      homeAreaWidth,
      homeAreaHeight,
    ],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!isPanning || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const physics = touchPhysicsRef.current;
      if (!physics.lastPos) return;

      // Ultra-responsive movement calculation
      const deltaX = (touch.clientX - physics.lastPos.x) * TOUCH_SETTINGS.touchSensitivity;
      const deltaY = (touch.clientY - physics.lastPos.y) * TOUCH_SETTINGS.touchSensitivity;

      // Immediate movement application
      updateViewState(deltaX, deltaY);

      // Efficient velocity calculation
      const now = performance.now();
      const timeDelta = now - physics.lastPos.time;
      if (timeDelta > 0) {
        physics.velocity.x = (deltaX / timeDelta) * TOUCH_SETTINGS.velocityMultiplier;
        physics.velocity.y = (deltaY / timeDelta) * TOUCH_SETTINGS.velocityMultiplier;
      }

      physics.lastPos = { x: touch.clientX, y: touch.clientY, time: now };

      // Quick drag detection
      if (!physics.isDragging) {
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance > TOUCH_SETTINGS.dragThreshold) {
          physics.isDragging = true;
          setIsDragging(true);
        }
      }

      event.preventDefault();
    },
    [isPanning, updateViewState],
  );

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      const physics = touchPhysicsRef.current;

      if (event.changedTouches.length === 1 && dragStartRef.current) {
        const touch = event.changedTouches[0];
        const timeDelta = Date.now() - dragStartRef.current.time;
        const distance = Math.sqrt(
          (touch.clientX - dragStartRef.current.x) ** 2 +
            (touch.clientY - dragStartRef.current.y) ** 2,
        );

        if (
          !physics.isDragging &&
          timeDelta < TOUCH_SETTINGS.tapTimeLimit &&
          distance < TOUCH_SETTINGS.tapThreshold
        ) {
          handleClick(touch.clientX, touch.clientY);
        } else if (physics.isDragging) {
          // Start momentum with current velocity
          startMomentum();
        }
      }

      // Reset state
      setIsPanning(false);
      setIsDragging(false);
      physics.isDragging = false;
      physics.lastPos = null;
      dragStartRef.current = null;

      event.preventDefault();
    },
    [handleClick, startMomentum],
  );

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    setIsDragging(false);
    touchPhysicsRef.current.isDragging = false;
    touchPhysicsRef.current.lastPos = null;
    dragStartRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMomentum();
    };
  }, [stopMomentum]);

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
