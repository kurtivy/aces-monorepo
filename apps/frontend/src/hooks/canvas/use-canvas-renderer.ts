'use client';

import type React from 'react';

import { useRef, useEffect, useState } from 'react';
import type { ImageInfo, ViewState } from '../../types/canvas';
import { drawCreateTokenSquare, drawHomeArea, drawImage } from '../../lib/canvas/draw';
import {
  markSpaceOccupied,
  canPlaceImage,
  getImageCandidatesForPosition,
} from '../../lib/canvas/grid-placement';
import { getDisplayDimensions } from '../../lib/canvas/image-type-utils';
import { useSpaceAnimation } from '../use-space-animation';
import { easeInOutCubic } from '../../lib/canvas/math-utils';

interface UseCanvasRendererProps {
  images: ImageInfo[];
  viewState: ViewState;
  imagesLoaded: boolean;
  unitSize: number;
  onCreateTokenClick: () => void;
  imagePlacementMap: React.MutableRefObject<
    Map<string, { image: ImageInfo; x: number; y: number; width: number; height: number }>
  >;
}

export const useCanvasRenderer = ({
  images,
  viewState,
  imagesLoaded,
  unitSize,
  onCreateTokenClick,
  imagePlacementMap,
}: UseCanvasRendererProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [hoveredTokenIndex, setHoveredTokenIndex] = useState<number | null>(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const logoImageRef = useRef<HTMLImageElement | null>(null);

  // State for hover animation
  const [currentHoverProgress, setCurrentHoverProgress] = useState(0);
  const hoverAnimationStartTime = useRef(0);
  const [isHoveringToken, setIsHoveringToken] = useState(false);
  const hoverAnimationDuration = 300;

  // Product entrance animation state
  const [productAnimationStartTime, setProductAnimationStartTime] = useState<number | null>(null);
  const [isProductAnimationActive, setIsProductAnimationActive] = useState(false);

  // Create a separate canvas for space animation
  const spaceCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Preload the logo image
  useEffect(() => {
    const logoImage = new Image();
    logoImage.src = '/aces-logo.png';
    logoImage.onload = () => {
      logoImageRef.current = logoImage;
    };
  }, []);

  // Initialize space canvas
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = unitSize;
      canvas.height = unitSize;
      spaceCanvasRef.current = canvas;
    }
  }, [unitSize]);

  // Initialize space animation
  useSpaceAnimation(spaceCanvasRef, {
    starCount: 0,
    nebulaCount: 3,
    canvasWidth: unitSize,
    canvasHeight: unitSize,
  });

  // Start product animation when images are loaded
  useEffect(() => {
    if (imagesLoaded) {
      const timer = setTimeout(() => {
        setProductAnimationStartTime(performance.now());
        setIsProductAnimationActive(true);
      }, 500); // Add a 500ms delay

      return () => clearTimeout(timer);
    }
  }, [imagesLoaded]);

  // Handle mouse movement for hover detection
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mousePositionRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const handleClick = () => {
      if (hoveredTokenIndex !== null) {
        onCreateTokenClick();
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
    };
  }, [hoveredTokenIndex, onCreateTokenClick]);

  useEffect(() => {
    if (!imagesLoaded) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };

    updateCanvasSize();

    const homeAreaWorldX = -unitSize;
    const homeAreaWorldY = -unitSize;
    const homeAreaWidth = unitSize * 2;
    const homeAreaHeight = unitSize;

    const draw = () => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(viewState.x, viewState.y);
      ctx.scale(viewState.scale, viewState.scale);

      const invScale = 1 / viewState.scale;
      const buffer = 500;
      const canvasWidth = canvas.width / (window.devicePixelRatio || 1);
      const canvasHeight = canvas.height / (window.devicePixelRatio || 1);
      const visibleLeft = (-viewState.x - buffer) * invScale;
      const visibleTop = (-viewState.y - buffer) * invScale;
      const visibleRight = (-viewState.x + canvasWidth + buffer) * invScale;
      const visibleBottom = (-viewState.y + canvasHeight + buffer) * invScale;

      const gridStartX = Math.floor(visibleLeft / unitSize) * unitSize;
      const gridStartY = Math.floor(visibleTop / unitSize) * unitSize;
      const gridEndX = Math.ceil(visibleRight / unitSize) * unitSize;
      const gridEndY = Math.ceil(visibleBottom / unitSize) * unitSize;

      imagePlacementMap.current.clear();
      const occupiedSpaces = new Set<string>();
      const createTokenPositions: Array<{ worldX: number; worldY: number }> = [];
      const productPlacements: Array<{
        image: ImageInfo;
        x: number;
        y: number;
        width: number;
        height: number;
        index: number;
      }> = [];

      // Mark home area as occupied
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 1; j++) {
          const cellX = Math.floor((homeAreaWorldX + i * unitSize) / unitSize);
          const cellY = Math.floor((homeAreaWorldY + j * unitSize) / unitSize);
          occupiedSpaces.add(`${cellX},${cellY}`);
        }
      }

      // Place images in a grid pattern
      let productIndex = 0;
      for (let y = gridStartY; y < gridEndY; y += unitSize) {
        for (let x = gridStartX; x < gridEndX; x += unitSize) {
          const gridX = Math.floor(x / unitSize);
          const gridY = Math.floor(y / unitSize);

          if (occupiedSpaces.has(`${gridX},${gridY}`)) {
            continue;
          }

          let placed = false;
          const candidates = getImageCandidatesForPosition(
            gridX,
            gridY,
            images,
            unitSize,
            homeAreaWorldX,
            homeAreaWorldY,
            homeAreaWidth,
            homeAreaHeight,
          );

          for (const imageInfo of candidates) {
            const { width, height } = getDisplayDimensions(imageInfo.type);

            if (
              canPlaceImage(
                x,
                y,
                { ...imageInfo, displayWidth: width, displayHeight: height },
                occupiedSpaces,
                unitSize,
                homeAreaWorldX,
                homeAreaWorldY,
                homeAreaWidth,
                homeAreaHeight,
              )
            ) {
              const placedItem = { image: imageInfo, x, y, width, height };
              imagePlacementMap.current.set(`${gridX},${gridY}`, placedItem);

              if (imageInfo.type === 'create-token') {
                createTokenPositions.push({ worldX: x, worldY: y });
              } else {
                // Store product placements for animated rendering
                productPlacements.push({
                  image: imageInfo,
                  x,
                  y,
                  width,
                  height,
                  index: productIndex++,
                });
              }
              markSpaceOccupied(x, y, width, height, occupiedSpaces, unitSize);
              placed = true;
              break;
            }
          }

          if (!placed) {
            markSpaceOccupied(x, y, unitSize, unitSize, occupiedSpaces, unitSize);
          }
        }
      }

      const STAGGER_DELAY = 60; // 60ms between each item for a distinct effect
      const MAX_ANIMATION_DURATION = 1500; // Slower start for first items
      const MIN_ANIMATION_DURATION = 500; // Faster end for last items

      // Check if the overall animation sequence is complete
      if (isProductAnimationActive && productAnimationStartTime) {
        const lastItemDelay =
          productPlacements.length > 0 ? (productPlacements.length - 1) * STAGGER_DELAY : 0;
        const totalDuration = lastItemDelay + MIN_ANIMATION_DURATION;
        const elapsed = performance.now() - productAnimationStartTime;
        if (elapsed > totalDuration) {
          setIsProductAnimationActive(false);
        }
      }

      // Draw products with animation
      productPlacements.forEach((placement) => {
        let easedProgress = 1;
        if (isProductAnimationActive && productAnimationStartTime) {
          const totalItems = productPlacements.length;
          const durationRange = MAX_ANIMATION_DURATION - MIN_ANIMATION_DURATION;
          const itemDuration =
            totalItems > 1
              ? MAX_ANIMATION_DURATION - (placement.index / (totalItems - 1)) * durationRange
              : MAX_ANIMATION_DURATION;

          // Calculate individual product animation progress with stagger
          const productDelay = placement.index * STAGGER_DELAY;
          const productElapsed = Math.max(
            0,
            performance.now() - (productAnimationStartTime || 0) - productDelay,
          );
          const productProgress = Math.min(1, productElapsed / itemDuration);

          // Apply easing
          easedProgress = easeInOutCubic(productProgress);
        }

        drawImage(
          ctx,
          placement.image.element,
          placement.x,
          placement.y,
          placement.width,
          placement.height,
          easedProgress,
          unitSize,
        );
      });

      // Check for hover on create token squares
      let newHoveredIndex: number | null = null;
      const worldMouseX = (mousePositionRef.current.x - viewState.x) / viewState.scale;
      const worldMouseY = (mousePositionRef.current.y - viewState.y) / viewState.scale;

      createTokenPositions.forEach((pos, index) => {
        if (
          worldMouseX >= pos.worldX &&
          worldMouseX <= pos.worldX + unitSize &&
          worldMouseY >= pos.worldY &&
          worldMouseY <= pos.worldY + unitSize
        ) {
          newHoveredIndex = index;
          canvas.style.cursor = 'pointer';
        }
      });

      if (newHoveredIndex === null && hoveredTokenIndex !== null) {
        canvas.style.cursor = 'grab';
      }

      if (newHoveredIndex !== hoveredTokenIndex) {
        setHoveredTokenIndex(newHoveredIndex);
        setIsHoveringToken(newHoveredIndex !== null);
        hoverAnimationStartTime.current = performance.now();
      }

      // Update hover animation progress
      if (isHoveringToken || currentHoverProgress > 0) {
        const elapsed = performance.now() - hoverAnimationStartTime.current;
        let progress = Math.min(1, elapsed / hoverAnimationDuration);
        if (!isHoveringToken) {
          progress = 1 - progress;
        }
        progress = easeInOutCubic(progress);
        setCurrentHoverProgress(progress);

        if (!isHoveringToken && progress <= 0) {
          setCurrentHoverProgress(0);
        }
      }

      // Draw create token squares with space animation
      createTokenPositions.forEach((pos, index) => {
        const isCurrentlyHovered = index === hoveredTokenIndex;
        const actualHoverProgress = isCurrentlyHovered ? currentHoverProgress : 0;
        drawCreateTokenSquare(
          ctx,
          pos.worldX,
          pos.worldY,
          actualHoverProgress,
          unitSize,
          logoImageRef.current,
          spaceCanvasRef.current,
        );
      });

      // Draw home area with logo
      drawHomeArea(
        ctx,
        homeAreaWorldX,
        homeAreaWorldY,
        logoImageRef.current,
        worldMouseX,
        worldMouseY,
        homeAreaWidth,
        homeAreaHeight,
      );

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    window.addEventListener('resize', updateCanvasSize);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    imagesLoaded,
    images,
    viewState,
    hoveredTokenIndex,
    onCreateTokenClick,
    currentHoverProgress,
    isHoveringToken,
    imagePlacementMap,
    unitSize,
    isProductAnimationActive,
    productAnimationStartTime,
  ]);

  return { canvasRef };
};
