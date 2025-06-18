'use client';

import type React from 'react';

import { useState, useCallback, useRef } from 'react';
import type { ImageInfo, ViewState } from '../../types/canvas';
import { isHomeArea } from '../../lib/canvas/grid-placement';
import { LuxuryLogger, getImageMetadata } from '../../lib/utils/luxury-logger';
import { browserUtils } from '../../lib/utils/browser-utils';

interface UseCanvasInteractionsProps {
  viewState: ViewState;
  imagesRef: React.MutableRefObject<ImageInfo[]>;
  setSelectedImage: (image: ImageInfo | null) => void;
  imagePlacementMap: React.MutableRefObject<
    Map<string, { image: ImageInfo; x: number; y: number; width: number; height: number }>
  >;
  unitSize: number;
  updateViewState: (deltaX: number, deltaY: number) => void; // Add callback for view state updates
}

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

  const homeAreaWidth = unitSize * 2;
  const homeAreaHeight = unitSize;
  const homeAreaWorldX = -unitSize;
  const homeAreaWorldY = -unitSize;

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

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    // Only handle left mouse button for panning
    if (event.button !== 0) return;

    event.preventDefault(); // Prevent default mouse behaviors
    setIsDragging(false);
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: Date.now(),
    };
    setLastMousePos({ x: event.clientX, y: event.clientY });
    setIsPanning(true);
  }, []);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isPanning) return;

      event.preventDefault(); // Prevent default mouse behaviors during drag
      const deltaX = event.clientX - lastMousePos.x;
      const deltaY = event.clientY - lastMousePos.y;

      if (!isDragging && dragStartRef.current) {
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance > 5) {
          setIsDragging(true);
        }
      }

      // Apply mouse movement to canvas panning using callback
      updateViewState(deltaX, deltaY);

      setLastMousePos({ x: event.clientX, y: event.clientY });
    },
    [isPanning, isDragging, updateViewState], // Use stable updateViewState callback
  );

  const handleMouseUp = useCallback(
    (event: React.MouseEvent) => {
      // Only handle left mouse button
      if (event.button !== 0) return;

      event.preventDefault(); // Prevent default mouse behaviors

      // If it was a quick click (not a drag), treat it as a click
      if (!isDragging && dragStartRef.current && Date.now() - dragStartRef.current.time < 200) {
        handleClick(event);
      }

      // Reset panning state
      setIsPanning(false);
      setIsDragging(false);
      dragStartRef.current = null;
    },
    [handleClick, isDragging],
  );

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    // Only handle single finger touch for panning (no zoom support)
    if (event.touches.length === 1) {
      // Only prevent default if we're actually starting a pan operation
      const touch = event.touches[0];
      setIsDragging(false);
      dragStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      setLastMousePos({ x: touch.clientX, y: touch.clientY });
      setIsPanning(true);

      // Prevent default after we've set up panning to avoid conflicts
      event.preventDefault();
    } else {
      // Multiple touches - prevent default to disable zoom/pinch
      event.preventDefault();
      setIsPanning(false);
      setIsDragging(false);
      dragStartRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      // Only handle single finger touch for panning
      if (!isPanning || event.touches.length !== 1) {
        // Only prevent default for multi-touch to disable zoom
        if (event.touches.length > 1) {
          event.preventDefault();
        }
        return;
      }

      const touch = event.touches[0];
      const deltaX = touch.clientX - lastMousePos.x;
      const deltaY = touch.clientY - lastMousePos.y;

      if (!isDragging && dragStartRef.current) {
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance > 5) {
          setIsDragging(true);
          // Only prevent default once we're actually dragging
          event.preventDefault();
        }
      } else if (isDragging) {
        // Prevent default during active dragging
        event.preventDefault();
      }

      // Apply touch movement to canvas panning using callback
      updateViewState(deltaX, deltaY);

      setLastMousePos({ x: touch.clientX, y: touch.clientY });
    },
    [isPanning, isDragging, updateViewState], // Use stable updateViewState callback
  );

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      event.preventDefault(); // Prevent default touch behaviors

      // If it was a quick tap (not a drag), treat it as a click
      if (!isDragging && dragStartRef.current && Date.now() - dragStartRef.current.time < 200) {
        handleClick(event);
      }

      // Reset panning state
      setIsPanning(false);
      setIsDragging(false);
      dragStartRef.current = null;
    },
    [handleClick, isDragging],
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
