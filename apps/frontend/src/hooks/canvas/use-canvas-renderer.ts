'use client';

import type React from 'react';
import { useRef, useEffect, useState, useCallback } from 'react';
import type { ImageInfo, ViewState } from '../../types/canvas';
import { drawCreateTokenSquare, drawHomeArea, drawImage } from '../../lib/canvas/draw';
import {
  markSpaceOccupied,
  canPlaceImage,
  getImageCandidatesForPosition,
  recordImagePlacement,
  resetGlobalPlacementTracking,
  getImageUsageStats,
} from '../../lib/canvas/grid-placement';
import { getDisplayDimensions } from '../../lib/canvas/image-type-utils';
import { useSpaceAnimation } from '../use-space-animation';
import { easeInOutCubic } from '../../lib/canvas/math-utils';

interface UseCanvasRendererProps {
  images: ImageInfo[];
  viewState: ViewState;
  imagesLoaded: boolean;
  canvasVisible: boolean;
  unitSize: number;
  onCreateTokenClick: () => void;
  imagePlacementMap: React.MutableRefObject<
    Map<string, { image: ImageInfo; x: number; y: number; width: number; height: number }>
  >;
}

// Detect problematic browsers for performance optimizations
const isSafari =
  typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isFirefox =
  typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
const needsPerformanceMode = isSafari || isFirefox;

export const useCanvasRenderer = ({
  images,
  viewState,
  imagesLoaded,
  canvasVisible,
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
  const hoverAnimationDuration = isSafari ? 200 : 300; // Faster animation only for Safari

  // Product entrance animation state
  const [productAnimationStartTime, setProductAnimationStartTime] = useState<number | null>(null);
  const [isProductAnimationActive, setIsProductAnimationActive] = useState(false);

  // Performance optimization: frame throttling for Safari only
  const frameThrottleRef = useRef(0);
  const targetFPS = 60; // Test full 60fps for Safari - with optimizations it should handle it
  const frameInterval = 1000 / targetFPS;

  // Create a separate canvas for space animation
  const spaceCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // STABLE PLACEMENT STORAGE - Calculate once, use many times
  const stableProductPlacements = useRef<
    Array<{
      image: ImageInfo;
      x: number;
      y: number;
      width: number;
      height: number;
      index: number;
    }>
  >([]);
  const stableCreateTokenPositions = useRef<Array<{ worldX: number; worldY: number }>>([]);
  const placementsCalculated = useRef(false);

  // Performance optimization: cache expensive calculations
  const lastMouseCheck = useRef(0);
  const mouseCheckInterval = isSafari ? 20 : 18; // Firefox and Chrome both get near-optimal responsiveness

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

  // Initialize space animation with browser-specific complexity
  // Disable space animation for Safari, reduced for Firefox, full for Chrome
  useSpaceAnimation(spaceCanvasRef, {
    starCount: isSafari ? 0 : isFirefox ? 0 : 0, // Disable stars for Safari/Firefox
    nebulaCount: isSafari ? 0 : isFirefox ? 1 : 3, // Reduced nebula for Firefox
    canvasWidth: unitSize,
    canvasHeight: unitSize,
  });

  // CALCULATE PLACEMENTS ONCE - when images load or unitSize changes
  const calculatePlacements = useCallback(() => {
    if (!imagesLoaded || placementsCalculated.current) return;

    // Reset global tracking when recalculating placements
    resetGlobalPlacementTracking();

    const homeAreaWorldX = -unitSize;
    const homeAreaWorldY = -unitSize;
    const homeAreaWidth = unitSize * 2;
    const homeAreaHeight = unitSize;

    // Calculate grid area based on number of images to ensure all can be displayed
    // We have 24 products + create token squares, so we need adequate space
    const totalProducts = images.length;
    const estimatedGridCells = Math.ceil(Math.sqrt(totalProducts * 1.5)); // 1.5x for create tokens and spacing
    const gridSize = unitSize * Math.max(12, estimatedGridCells); // Minimum 12, scales with image count
    const gridStartX = -gridSize;
    const gridStartY = -gridSize;
    const gridEndX = gridSize;
    const gridEndY = gridSize;

    imagePlacementMap.current.clear();
    const occupiedSpaces = new Set<string>();
    const productPlacements: Array<{
      image: ImageInfo;
      x: number;
      y: number;
      width: number;
      height: number;
      index: number;
    }> = [];
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
          const { width, height } = getDisplayDimensions(imageInfo.type, unitSize);

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
              productPlacements.push({
                image: imageInfo,
                x,
                y,
                width,
                height,
                index: productIndex++,
              });
            }

            // Record this placement for adjacency tracking
            recordImagePlacement(gridX, gridY, imageInfo);

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

    // Store stable placements
    stableProductPlacements.current = productPlacements;
    stableCreateTokenPositions.current = createTokenPositions;
    placementsCalculated.current = true;

    // Log image usage statistics for debugging
    const stats = getImageUsageStats();
    console.log('Image Distribution Stats:', {
      totalProducts: productPlacements.length,
      totalCreateTokens: createTokenPositions.length,
      totalPlacements: stats.totalPlacements,
      imageCount: stats.imageStats.length,
      mostUsed: stats.mostUsedImage,
      leastUsed: stats.leastUsedImage,
      distributionBalance:
        stats.imageStats.length > 0
          ? ((stats.leastUsedImage.count / stats.mostUsedImage.count) * 100).toFixed(1) + '%'
          : 'N/A',
      performanceMode: needsPerformanceMode ? 'enabled' : 'disabled',
    });
  }, [imagesLoaded, images, unitSize, imagePlacementMap]);

  // Calculate placements when ready
  useEffect(() => {
    calculatePlacements();
  }, [calculatePlacements]);

  // Reset placements when unitSize changes (responsive)
  useEffect(() => {
    placementsCalculated.current = false;
    stableProductPlacements.current = [];
    stableCreateTokenPositions.current = [];
  }, [unitSize]);

  // Start product animation when images are loaded AND canvas is visible
  useEffect(() => {
    if (imagesLoaded && placementsCalculated.current && canvasVisible) {
      // Start animation immediately for faster loading experience
      setProductAnimationStartTime(performance.now());
      setIsProductAnimationActive(true);
    }
  }, [imagesLoaded, placementsCalculated.current, canvasVisible]);

  // Handle mouse movement for hover detection with throttling
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
    if (!imagesLoaded || !placementsCalculated.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Performance optimization: enable image smoothing for Safari to improve movement quality
    // Disable only during static rendering to maintain performance
    ctx.imageSmoothingEnabled = true;

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

    const draw = (currentTime: number) => {
      // No frame throttling - test if Safari can handle full 60fps with optimizations

      // Stable canvas clearing for all browsers
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(viewState.x, viewState.y);
      ctx.scale(viewState.scale, viewState.scale);

      // Use STABLE placements - no recalculation!
      const productPlacements = stableProductPlacements.current;
      const createTokenPositions = stableCreateTokenPositions.current;

      const ANIMATION_DURATION = isSafari ? 400 : isFirefox ? 500 : 600; // Browser-specific animation speeds

      // Check if the overall animation sequence is complete
      if (isProductAnimationActive && productAnimationStartTime) {
        const elapsed = currentTime - productAnimationStartTime;

        if (elapsed > ANIMATION_DURATION + 100) {
          // Add small buffer
          setIsProductAnimationActive(false);
        }
      }

      // Draw products with animation - using STABLE positions
      productPlacements.forEach((placement) => {
        let easedProgress = 0; // Start invisible

        // Show images during and after animation
        if (isProductAnimationActive && productAnimationStartTime) {
          const elapsed = currentTime - productAnimationStartTime;
          const progress = Math.min(1, elapsed / ANIMATION_DURATION);
          easedProgress = easeInOutCubic(progress);
        } else if (productAnimationStartTime) {
          // Animation has completed, keep images visible
          easedProgress = 1;
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

      // Performance optimization: throttle mouse hit detection
      let newHoveredIndex: number | null = null;
      if (currentTime - lastMouseCheck.current > mouseCheckInterval) {
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
          hoverAnimationStartTime.current = currentTime;
        }

        lastMouseCheck.current = currentTime;
      }

      // Update hover animation progress
      if (isHoveringToken || currentHoverProgress > 0) {
        const elapsed = currentTime - hoverAnimationStartTime.current;
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

      // Draw create token squares with space animation - using STABLE positions
      createTokenPositions.forEach((pos, index) => {
        const isCurrentlyHovered = index === hoveredTokenIndex;
        const actualHoverProgress = isCurrentlyHovered ? currentHoverProgress : 0;

        // Show tokens during and after animation with slight stagger
        let tokenOpacity = 0; // Start invisible
        let tokenScale = 0.95; // Start just slightly smaller for a subtle entrance

        if (isProductAnimationActive && productAnimationStartTime) {
          const elapsed = currentTime - productAnimationStartTime;
          // Add staggered delay for create token squares (100ms delay)
          const tokenDelay = 100;
          const adjustedElapsed = Math.max(0, elapsed - tokenDelay);
          const progress = Math.min(1, adjustedElapsed / ANIMATION_DURATION);
          const easedProgress = easeInOutCubic(progress);

          tokenOpacity = easedProgress;
          tokenScale = 0.95 + 0.05 * easedProgress; // Scale from 0.95 to 1.0 (much more subtle)
        } else if (productAnimationStartTime) {
          // Animation has completed, keep tokens visible at full scale
          tokenOpacity = 1;
          tokenScale = 1;
        }

        // Draw if there's any opacity
        if (tokenOpacity > 0) {
          ctx.save();
          ctx.globalAlpha = tokenOpacity;

          // Apply scaling animation
          const centerX = pos.worldX + unitSize / 2;
          const centerY = pos.worldY + unitSize / 2;
          ctx.translate(centerX, centerY);
          ctx.scale(tokenScale, tokenScale);
          ctx.translate(-centerX, -centerY);

          drawCreateTokenSquare(
            ctx,
            pos.worldX,
            pos.worldY,
            actualHoverProgress,
            unitSize,
            logoImageRef.current,
            spaceCanvasRef.current,
            currentTime,
          );
          ctx.restore();
        }
      });

      // Draw home area with logo
      drawHomeArea(
        ctx,
        homeAreaWorldX,
        homeAreaWorldY,
        logoImageRef.current,
        (mousePositionRef.current.x - viewState.x) / viewState.scale,
        (mousePositionRef.current.y - viewState.y) / viewState.scale,
        homeAreaWidth,
        homeAreaHeight,
        null,
        currentTime,
        unitSize,
      );

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    animationFrameRef.current = requestAnimationFrame(draw);

    window.addEventListener('resize', updateCanvasSize);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    imagesLoaded,
    placementsCalculated.current,
    viewState,
    hoveredTokenIndex,
    onCreateTokenClick,
    currentHoverProgress,
    isHoveringToken,
    unitSize,
    isProductAnimationActive,
    productAnimationStartTime,
    canvasVisible,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  return { canvasRef };
};
