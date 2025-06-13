'use client';

import { useRef, useEffect, useState } from 'react';
import { ImageInfo, ViewState } from '../../types/canvas'; // Adjusted path
import { drawImage, drawHomeArea } from '../../lib/canvas/canvas-renderer'; // Adjusted path
import {
  markSpaceOccupied,
  canPlaceImage,
  getImageCandidatesForPosition,
} from '../../lib/canvas/grid-placement'; // Adjusted path
import { UNIT_SIZE, HOME_AREA_WORLD_X, HOME_AREA_WORLD_Y } from '../../constants/canvas'; // Adjusted path
import { getDisplayDimensions } from '../../lib/canvas/image-type-utils'; // Adjusted path
import { useSpaceAnimation } from '../use-space-animation'; // Adjusted path
import { lerp, easeInOutCubic } from '../../lib/canvas/math-utils'; // Adjusted path

interface UseCanvasRendererProps {
  images: ImageInfo[];
  viewState: ViewState;
  imagesLoaded: boolean; // Added this prop
  onCreateTokenClick: () => void;
  imagePlacementMap: React.MutableRefObject<
    // Preserved this prop
    Map<string, { image: ImageInfo; x: number; y: number; width: number; height: number }>
  >;
}

export const useCanvasRenderer = ({
  images,
  viewState,
  imagesLoaded, // Destructure the new prop
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
      canvas.width = UNIT_SIZE;
      canvas.height = UNIT_SIZE;
      spaceCanvasRef.current = canvas;
    }
  }, []);

  // Initialize space animation
  useSpaceAnimation(spaceCanvasRef, {
    starCount: 0, // Remove white stars as requested
    nebulaCount: 10, // Keep nebula count as is
    canvasWidth: UNIT_SIZE,
    canvasHeight: UNIT_SIZE,
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

    const drawCreateTokenSquare = (
      x: number,
      y: number,
      hoverProgress: number, // Now accepts a progress value (0 to 1)
    ) => {
      const size = lerp(UNIT_SIZE, UNIT_SIZE * 1.05, hoverProgress); // Interpolate size
      const padding = (UNIT_SIZE - size) / 2;

      ctx.save();

      // Create clipping region for the space animation
      ctx.beginPath();
      ctx.roundRect(x + padding, y + padding, size, size, 4);
      ctx.clip();

      // Draw space animation from the separate canvas
      if (spaceCanvasRef.current) {
        ctx.drawImage(spaceCanvasRef.current, x + padding, y + padding, size, size);
      }

      ctx.restore();

      // Draw border
      ctx.strokeStyle = '#D0B264';
      ctx.lineWidth = lerp(2, 3, hoverProgress); // Interpolate line width
      ctx.beginPath();
      ctx.roundRect(x + padding, y + padding, size, size, 4);
      ctx.stroke();

      // Add glow effect when hovered
      const shadowBlur = lerp(0, 15, hoverProgress);
      const shadowOpacity = lerp(0, 0.8, hoverProgress);
      const strokeOpacity = lerp(0, 0.6, hoverProgress);

      ctx.shadowColor = `rgba(208, 178, 100, ${shadowOpacity})`;
      ctx.shadowBlur = shadowBlur;
      ctx.strokeStyle = `rgba(208, 178, 100, ${strokeOpacity})`;
      ctx.lineWidth = lerp(2, 4, hoverProgress); // Interpolate glow stroke width
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset shadow blur

      // Draw logo
      if (logoImageRef.current) {
        const logoSize = lerp(UNIT_SIZE * 0.6, UNIT_SIZE * 0.7, hoverProgress); // Increased logo size, also interpolates
        const logoX = x + UNIT_SIZE / 2 - logoSize / 2;
        const logoY = y + UNIT_SIZE / 2 - logoSize / 2;
        ctx.drawImage(logoImageRef.current, logoX, logoY, logoSize, logoSize);
      }

      // Draw text
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // "CREATE TOKEN" above logo
      const createTokenFontSize = lerp(16, 18, hoverProgress); // Interpolate font size
      ctx.font = `${hoverProgress > 0.5 ? 'bold ' : ''}${createTokenFontSize}px 'Barlow Condensed'`; // Use Barlow Condensed
      ctx.fillText(
        'CREATE TOKEN',
        x + UNIT_SIZE / 2,
        lerp(
          y + UNIT_SIZE / 2 - UNIT_SIZE * 0.35,
          y + UNIT_SIZE / 2 - UNIT_SIZE * 0.4,
          hoverProgress,
        ), // Increased Y offset for more space, also interpolates
      );

      // "COMING SOON" below logo
      const comingSoonFontSize = lerp(12, 14, hoverProgress); // Interpolate font size
      ctx.font = `${hoverProgress > 0.5 ? 'bold ' : ''}${comingSoonFontSize}px 'Barlow Condensed'`; // Use Barlow Condensed, smaller size
      ctx.fillText(
        'COMING SOON',
        x + UNIT_SIZE / 2,
        lerp(
          y + UNIT_SIZE / 2 + UNIT_SIZE * 0.35,
          y + UNIT_SIZE / 2 + UNIT_SIZE * 0.4,
          hoverProgress,
        ), // Increased Y offset for more space, also interpolates
      );
    };

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

      const gridStartX = Math.floor(visibleLeft / UNIT_SIZE) * UNIT_SIZE;
      const gridStartY = Math.floor(visibleTop / UNIT_SIZE) * UNIT_SIZE;
      const gridEndX = Math.ceil(visibleRight / UNIT_SIZE) * UNIT_SIZE;
      const gridEndY = Math.ceil(visibleBottom / UNIT_SIZE) * UNIT_SIZE;

      imagePlacementMap.current.clear();
      const occupiedSpaces = new Set<string>();
      const createTokenPositions: Array<{ worldX: number; worldY: number }> = [];

      // Mark home area as occupied
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
          const cellX = Math.floor((HOME_AREA_WORLD_X + i * UNIT_SIZE) / UNIT_SIZE);
          const cellY = Math.floor((HOME_AREA_WORLD_Y + j * UNIT_SIZE) / UNIT_SIZE);
          occupiedSpaces.add(`${cellX},${cellY}`);
        }
      }

      // Place images in a grid pattern
      for (let y = gridStartY; y < gridEndY; y += UNIT_SIZE) {
        for (let x = gridStartX; x < gridEndX; x += UNIT_SIZE) {
          const gridX = Math.floor(x / UNIT_SIZE);
          const gridY = Math.floor(y / UNIT_SIZE);

          if (occupiedSpaces.has(`${gridX},${gridY}`)) {
            continue;
          }

          let placed = false;
          const candidates = getImageCandidatesForPosition(gridX, gridY, images);

          for (const imageInfo of candidates) {
            const { width, height } = getDisplayDimensions(imageInfo.type);

            if (
              canPlaceImage(
                x,
                y,
                { ...imageInfo, displayWidth: width, displayHeight: height },
                occupiedSpaces,
              )
            ) {
              const placedItem = { image: imageInfo, x, y, width, height };
              imagePlacementMap.current.set(`${gridX},${gridY}`, placedItem);
              if (imageInfo.type === 'create-token') {
                createTokenPositions.push({ worldX: x, worldY: y });
              } else {
                drawImage(ctx, imageInfo.element, x, y, width, height);
              }
              markSpaceOccupied(x, y, width, height, occupiedSpaces);
              placed = true;
              break;
            }
          }

          if (!placed) {
            markSpaceOccupied(x, y, UNIT_SIZE, UNIT_SIZE, occupiedSpaces);
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
          worldMouseX <= pos.worldX + UNIT_SIZE &&
          worldMouseY >= pos.worldY &&
          worldMouseY <= pos.worldY + UNIT_SIZE
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
        const actualHoverProgress = isCurrentlyHovered ? currentHoverProgress : 0; // Only apply progress to the hovered token

        drawCreateTokenSquare(pos.worldX, pos.worldY, actualHoverProgress);
      });

      // Draw home area with logo
      drawHomeArea(
        ctx,
        HOME_AREA_WORLD_X,
        HOME_AREA_WORLD_Y,
        logoImageRef.current,
        worldMouseX,
        worldMouseY,
      );

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    window.addEventListener('resize', updateCanvasSize);
    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    imagesLoaded, // Added this to dependencies
    images,
    viewState,
    hoveredTokenIndex,
    onCreateTokenClick,
    currentHoverProgress,
    isHoveringToken,
    imagePlacementMap,
  ]);

  return { canvasRef };
};
