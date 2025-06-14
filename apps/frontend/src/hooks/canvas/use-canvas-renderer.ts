'use client';

import { useRef, useEffect, useState } from 'react';
import { ImageInfo, ViewState } from '../../types/canvas'; // Adjusted path
import { drawCreateTokenSquare, drawHomeArea, drawImage } from '../../lib/canvas/draw';
import {
  markSpaceOccupied,
  canPlaceImage,
  getImageCandidatesForPosition,
} from '../../lib/canvas/grid-placement'; // Adjusted path
import { getDisplayDimensions } from '../../lib/canvas/image-type-utils'; // Adjusted path
import { useSpaceAnimation } from '../use-space-animation'; // Adjusted path
import { lerp, easeInOutCubic } from '../../lib/canvas/math-utils'; // Adjusted path

interface UseCanvasRendererProps {
  images: ImageInfo[];
  viewState: ViewState;
  imagesLoaded: boolean; // Added this prop
  unitSize: number;
  onCreateTokenClick: () => void;
  imagePlacementMap: React.MutableRefObject<
    Map<string, { image: ImageInfo; x: number; y: number; width: number; height: number }>
  >;
}

export const useCanvasRenderer = ({
  images,
  viewState,
  imagesLoaded, // Destructure the new prop
  unitSize,
  onCreateTokenClick,
  imagePlacementMap, // Destructure the preserved prop
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
  const hoverAnimationDuration = 300; // 0.3 seconds for faster hover animation

  // Create a separate canvas for space animation
  const spaceCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Preload the logo image
  useEffect(() => {
    const logoImage = new Image();
    logoImage.src = '/aces-logo.png'; // Assuming user fixed this path
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
    starCount: 0, // Remove white stars as requested
    nebulaCount: 3, // Keep nebula count as is
    canvasWidth: unitSize,
    canvasHeight: unitSize,
  });

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
    if (!imagesLoaded) return; // Added this condition

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
      ctx.fillStyle = '#231F20';
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

      // Mark home area as occupied
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 1; j++) {
          const cellX = Math.floor((homeAreaWorldX + i * unitSize) / unitSize);
          const cellY = Math.floor((homeAreaWorldY + j * unitSize) / unitSize);
          occupiedSpaces.add(`${cellX},${cellY}`);
        }
      }

      // Place images in a grid pattern
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
                drawImage(ctx, imageInfo.element, x, y, width, height);
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
          progress = 1 - progress; // Reverse for unhover
        }
        // Apply easing for smoother transition
        progress = easeInOutCubic(progress);
        setCurrentHoverProgress(progress);

        // If unhover animation is complete, stop animating
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
  ]);

  return { canvasRef };
};
