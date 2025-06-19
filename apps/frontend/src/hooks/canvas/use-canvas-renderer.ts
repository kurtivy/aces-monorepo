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
import { useCoordinatedResize } from '../use-coordinated-resize';
import { browserUtils, getBrowserPerformanceSettings } from '../../lib/utils/browser-utils';
// Note: useAnimationFrame removed - caused scroll timing issues, kept for background animations only

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
  canvasRef?: React.RefObject<HTMLCanvasElement | null>; // Match the nullable type
}

const browserPerf = getBrowserPerformanceSettings();

// Define grid tile structure for infinite repetition
interface GridTile {
  tileX: number;
  tileY: number;
  offsetX: number;
  offsetY: number;
}

interface RepeatedPlacement {
  image: ImageInfo;
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  tileId: string;
}

interface RepeatedTokenPosition {
  worldX: number;
  worldY: number;
  tileId: string;
}

export const useCanvasRenderer = ({
  images,
  viewState,
  imagesLoaded,
  canvasVisible,
  unitSize,
  onCreateTokenClick,
  imagePlacementMap,
  canvasRef,
}: UseCanvasRendererProps) => {
  const canvasRefInternal = useRef<HTMLCanvasElement>(null);

  // Use external canvasRef if provided, otherwise use internal one
  const activeCanvasRef = canvasRef || canvasRefInternal;

  useCoordinatedResize({ canvasRef: activeCanvasRef });
  // Phase 2 Step 2: Remove individual animation frame management
  // const animationFrameRef = useRef<number | null>(null); // Replaced by centralized manager
  const [hoveredTokenIndex, setHoveredTokenIndex] = useState<number | null>(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const logoImageRef = useRef<HTMLImageElement | null>(null);

  // Canvas loading progress tracking
  const [canvasProgress, setCanvasProgress] = useState(0);
  const [canvasReady, setCanvasReady] = useState(false);

  /*
   * SAFARI PERFORMANCE OPTIMIZATIONS
   * ================================
   * Safari requires specific performance optimizations for smooth hover animations:
   * 1. Frame throttling (30fps vs 60fps) - Prevents laggy hover animations
   * 2. Faster animation duration (200ms vs 300ms) - Reduces computation time
   * 3. Linear easing (vs easeInOutCubic) - Reduces mathematical computation
   * 4. Space animation disabled (see draw-create-token-square.ts)
   * 5. Shine effects disabled (see draw-create-token-square.ts)
   *
   * These are contained to minimize browser-specific code.
   * TODO Phase 2: Explore feature detection vs user-agent detection
   */

  // State for hover animation
  const [currentHoverProgress, setCurrentHoverProgress] = useState(0);
  const hoverAnimationStartTime = useRef(0);
  const [isHoveringToken, setIsHoveringToken] = useState(false);
  const hoverAnimationDuration = browserPerf.animationDuration; // Centralized animation duration

  // Product entrance animation state
  const [productAnimationStartTime, setProductAnimationStartTime] = useState<number | null>(null);
  const [isProductAnimationActive, setIsProductAnimationActive] = useState(false);

  const frameThrottleRef = useRef(0);
  const targetFPS = browserPerf.targetFPS; // Centralized FPS setting
  const frameInterval = 1000 / targetFPS;

  // Create a separate canvas for space animation
  const spaceCanvasRef = useRef<HTMLCanvasElement | null>(null);

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
  const [placementsCalculated, setPlacementsCalculated] = useState(false);

  const originalGridBounds = useRef<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    width: number;
    height: number;
  } | null>(null);

  const repeatedPlacements = useRef<Map<string, RepeatedPlacement[]>>(new Map());
  const repeatedTokens = useRef<Map<string, RepeatedTokenPosition[]>>(new Map());
  const activeTiles = useRef<Set<string>>(new Set());

  // Performance optimization: mouse check interval
  const lastMouseCheck = useRef(0);
  const mouseCheckInterval = browserPerf.mouseCheckInterval; // Centralized mouse check interval

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

  // Initialize space animation with centralized browser-specific settings
  useSpaceAnimation(spaceCanvasRef, {
    starCount: 0, // Disabled for all browsers during loading
    nebulaCount: browserPerf.enableSpaceAnimation ? 3 : 0, // Centralized space animation control
    canvasWidth: unitSize,
    canvasHeight: unitSize,
  });

  const calculateRequiredTiles = useCallback((currentViewState: ViewState): GridTile[] => {
    if (!originalGridBounds.current) return [];

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const bufferDistance = 2.5; // 2.5 screen widths/heights

    // Calculate visible area with buffer
    const viewportLeft = -currentViewState.x / currentViewState.scale;
    const viewportTop = -currentViewState.y / currentViewState.scale;
    const viewportRight = viewportLeft + screenWidth / currentViewState.scale;
    const viewportBottom = viewportTop + screenHeight / currentViewState.scale;

    // Add buffer zone
    const bufferWidth = (screenWidth / currentViewState.scale) * bufferDistance;
    const bufferHeight = (screenHeight / currentViewState.scale) * bufferDistance;

    const bufferedLeft = viewportLeft - bufferWidth;
    const bufferedTop = viewportTop - bufferHeight;
    const bufferedRight = viewportRight + bufferWidth;
    const bufferedBottom = viewportBottom + bufferHeight;

    const { startX, startY, width, height } = originalGridBounds.current;
    const tiles: GridTile[] = [];

    // Calculate which grid tiles we need
    const tileStartX = Math.floor(bufferedLeft / width);
    const tileStartY = Math.floor(bufferedTop / height);
    const tileEndX = Math.ceil(bufferedRight / width);
    const tileEndY = Math.ceil(bufferedBottom / height);

    for (let tileY = tileStartY; tileY <= tileEndY; tileY++) {
      for (let tileX = tileStartX; tileX <= tileEndX; tileX++) {
        // Skip the original tile (0, 0)
        if (tileX === 0 && tileY === 0) continue;

        tiles.push({
          tileX,
          tileY,
          offsetX: tileX * width,
          offsetY: tileY * height,
        });
      }
    }

    return tiles;
  }, []);

  const generateRepeatedPlacementsForTile = useCallback(
    (
      tile: GridTile,
    ): {
      placements: RepeatedPlacement[];
      tokens: RepeatedTokenPosition[];
    } => {
      const tileId = `${tile.tileX},${tile.tileY}`;
      const placements: RepeatedPlacement[] = [];
      const tokens: RepeatedTokenPosition[] = [];

      // Generate repeated product placements
      stableProductPlacements.current.forEach((original, index) => {
        placements.push({
          ...original,
          x: original.x + tile.offsetX,
          y: original.y + tile.offsetY,
          tileId,
        });
      });

      // Generate repeated token positions
      stableCreateTokenPositions.current.forEach((original) => {
        tokens.push({
          worldX: original.worldX + tile.offsetX,
          worldY: original.worldY + tile.offsetY,
          tileId,
        });
      });

      return { placements, tokens };
    },
    [],
  );

  const updateInfiniteGrid = useCallback(
    (currentViewState: ViewState) => {
      if (!originalGridBounds.current || !placementsCalculated) return;

      const requiredTiles = calculateRequiredTiles(currentViewState);
      const newActiveTiles = new Set<string>();

      // Process required tiles in batches for performance
      const batchSize = 4; // Process 4 tiles at a time
      const tilesToProcess = requiredTiles.filter((tile) => {
        const tileId = `${tile.tileX},${tile.tileY}`;
        newActiveTiles.add(tileId);
        return !repeatedPlacements.current.has(tileId);
      });

      // Process tiles in batches
      for (let i = 0; i < tilesToProcess.length; i += batchSize) {
        const batch = tilesToProcess.slice(i, i + batchSize);

        batch.forEach((tile) => {
          const tileId = `${tile.tileX},${tile.tileY}`;
          const { placements, tokens } = generateRepeatedPlacementsForTile(tile);

          repeatedPlacements.current.set(tileId, placements);
          repeatedTokens.current.set(tileId, tokens);
        });
      }

      // Clean up distant tiles to manage memory
      const tilesToRemove = Array.from(activeTiles.current).filter(
        (tileId) => !newActiveTiles.has(tileId),
      );
      tilesToRemove.forEach((tileId) => {
        repeatedPlacements.current.delete(tileId);
        repeatedTokens.current.delete(tileId);
      });

      activeTiles.current = newActiveTiles;
    },
    [calculateRequiredTiles, generateRepeatedPlacementsForTile],
  );

  const calculatePlacements = useCallback(() => {
    if (!imagesLoaded || placementsCalculated) return;

    setCanvasProgress(40);

    resetGlobalPlacementTracking();

    const homeAreaWorldX = -unitSize;
    const homeAreaWorldY = -unitSize;
    const homeAreaWidth = unitSize * 2;
    const homeAreaHeight = unitSize;

    const totalProducts = images.length;
    const estimatedGridCells = Math.ceil(Math.sqrt(totalProducts * 1.5)); // 1.5x for create tokens and spacing

    const maxGridCells = 16; // Maximum 16x16 grid to prevent freeze
    const actualGridCells = Math.min(Math.max(12, estimatedGridCells), maxGridCells);
    const gridSize = unitSize * actualGridCells;
    const gridStartX = -gridSize;
    const gridStartY = -gridSize;
    const gridEndX = gridSize;
    const gridEndY = gridSize;

    originalGridBounds.current = {
      startX: gridStartX,
      startY: gridStartY,
      endX: gridEndX,
      endY: gridEndY,
      width: gridEndX - gridStartX,
      height: gridEndY - gridStartY,
    };

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

    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 1; j++) {
        const cellX = Math.floor((homeAreaWorldX + i * unitSize) / unitSize);
        const cellY = Math.floor((homeAreaWorldY + j * unitSize) / unitSize);
        occupiedSpaces.add(`${cellX},${cellY}`);
      }
    }

    let productIndex = 0;
    const totalCells = ((gridEndY - gridStartY) / unitSize) * ((gridEndX - gridStartX) / unitSize);
    let processedCells = 0;

    for (let y = gridStartY; y < gridEndY; y += unitSize) {
      for (let x = gridStartX; x < gridEndX; x += unitSize) {
        processedCells++;

        if (processedCells % 200 === 0) {
          const progress = 40 + (processedCells / totalCells) * 30; // 40% to 70%
          setCanvasProgress(Math.min(progress, 69));
        }
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

    stableProductPlacements.current = productPlacements;
    stableCreateTokenPositions.current = createTokenPositions;
    setPlacementsCalculated(true);

    setCanvasProgress(70);

    repeatedPlacements.current.clear();
    repeatedTokens.current.clear();
    activeTiles.current.clear();
  }, [imagesLoaded, images, unitSize]);

  useEffect(() => {
    if (imagesLoaded) {
      setCanvasProgress(30); // Images loaded, ready for placement calculations
    }
  }, [imagesLoaded]);

  // Calculate placements when ready
  useEffect(() => {
    calculatePlacements();
  }, [calculatePlacements]);

  // Reset placements when unitSize changes (responsive)
  useEffect(() => {
    setPlacementsCalculated(false);
    stableProductPlacements.current = [];
    stableCreateTokenPositions.current = [];
    // Clear infinite grid state
    originalGridBounds.current = null;
    repeatedPlacements.current.clear();
    repeatedTokens.current.clear();
    activeTiles.current.clear();
  }, [unitSize]);

  const lastUpdateRef = useRef(0);
  const updateDebounceDelay = 100; // 100ms debounce for smooth animations

  const viewStateRef = useRef(viewState);
  viewStateRef.current = viewState;

  // Update infinite grid when viewport changes (with debouncing)
  useEffect(() => {
    if (!placementsCalculated || !originalGridBounds.current) return;

    const now = performance.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    // Debounce rapid viewport changes during animations
    if (timeSinceLastUpdate < updateDebounceDelay) {
      const timeoutId = setTimeout(() => {
        updateInfiniteGrid(viewStateRef.current);
        lastUpdateRef.current = performance.now();
      }, updateDebounceDelay - timeSinceLastUpdate);

      return () => clearTimeout(timeoutId);
    } else {
      updateInfiniteGrid(viewStateRef.current);
      lastUpdateRef.current = now;
    }
  }, [updateInfiniteGrid, placementsCalculated]);

  // Start product animation when images are loaded AND canvas is visible
  useEffect(() => {
    if (imagesLoaded && placementsCalculated && canvasVisible) {
      // Start animation immediately for faster loading experience
      setProductAnimationStartTime(performance.now());
      setIsProductAnimationActive(true);
    }
  }, [imagesLoaded, placementsCalculated, canvasVisible]);

  // Handle mouse movement for hover detection with throttling
  useEffect(() => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mousePositionRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const handleClick = (event: MouseEvent) => {
      // Check if clicking on original token (with hover effect)
      if (hoveredTokenIndex !== null) {
        onCreateTokenClick();
        return;
      }

      // Check if clicking on repeated token
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const worldMouseX = (mouseX - viewState.x) / viewState.scale;
      const worldMouseY = (mouseY - viewState.y) / viewState.scale;

      let clickedRepeatedToken = false;
      repeatedTokens.current.forEach((tileTokens) => {
        tileTokens.forEach((token) => {
          if (
            worldMouseX >= token.worldX &&
            worldMouseX <= token.worldX + unitSize &&
            worldMouseY >= token.worldY &&
            worldMouseY <= token.worldY + unitSize
          ) {
            clickedRepeatedToken = true;
          }
        });
      });

      if (clickedRepeatedToken) {
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
    if (!imagesLoaded || !placementsCalculated) return;

    const canvas = activeCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Update progress: Canvas initializing (80%)
    setCanvasProgress(80);

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

    updateCanvasSize(); // Initial sizing

    // Update progress: Canvas ready (100%)
    setCanvasProgress(100);
    setCanvasReady(true);

    const homeAreaWorldX = -unitSize;
    const homeAreaWorldY = -unitSize;
    const homeAreaWidth = unitSize * 2;
    const homeAreaHeight = unitSize;

    const draw = (currentTime: number) => {
      if (browserPerf.frameThrottling) {
        if (currentTime - frameThrottleRef.current < frameInterval) {
          // Phase 2 Step 2: Frame throttling handled by centralized manager
          return;
        }
        frameThrottleRef.current = currentTime;
      }

      // Stable canvas clearing for all browsers
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(viewState.x, viewState.y);
      ctx.scale(viewState.scale, viewState.scale);

      // Use STABLE placements - no recalculation!
      const productPlacements = stableProductPlacements.current;
      const createTokenPositions = stableCreateTokenPositions.current;

      const ANIMATION_DURATION = browserPerf.animationDuration; // Centralized animation duration

      // Check if the overall animation sequence is complete
      if (isProductAnimationActive && productAnimationStartTime) {
        const elapsed = currentTime - productAnimationStartTime;

        if (elapsed > ANIMATION_DURATION + 100) {
          // Add small buffer
          setIsProductAnimationActive(false);
        }
      }

      // Calculate animation progress once
      let animationProgress = 0;
      if (isProductAnimationActive && productAnimationStartTime) {
        const elapsed = currentTime - productAnimationStartTime;
        const progress = Math.min(1, elapsed / ANIMATION_DURATION);
        animationProgress = easeInOutCubic(progress);
      } else if (productAnimationStartTime) {
        // Animation has completed, keep images visible
        animationProgress = 1;
      }

      // Draw original products with animation - using STABLE positions
      productPlacements.forEach((placement) => {
        drawImage(
          ctx,
          placement.image.element,
          placement.x,
          placement.y,
          placement.width,
          placement.height,
          animationProgress,
          unitSize,
        );
      });

      // Draw repeated grid products (always fully visible, no animation)
      if (animationProgress > 0) {
        // Only show repeated grids after original animation starts
        repeatedPlacements.current.forEach((tilePlacements) => {
          tilePlacements.forEach((placement) => {
            drawImage(
              ctx,
              placement.image.element,
              placement.x,
              placement.y,
              placement.width,
              placement.height,
              1, // Always fully visible
              unitSize,
            );
          });
        });
      }

      // Performance optimization: throttle mouse hit detection
      let newHoveredIndex: number | null = null;
      if (currentTime - lastMouseCheck.current > mouseCheckInterval) {
        const worldMouseX = (mousePositionRef.current.x - viewState.x) / viewState.scale;
        const worldMouseY = (mousePositionRef.current.y - viewState.y) / viewState.scale;

        // Check original create token positions first (these get hover effects)
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

        // Check repeated create token positions (clickable but no hover effect)
        if (newHoveredIndex === null) {
          let foundRepeatedToken = false;
          repeatedTokens.current.forEach((tileTokens) => {
            tileTokens.forEach((token) => {
              if (
                worldMouseX >= token.worldX &&
                worldMouseX <= token.worldX + unitSize &&
                worldMouseY >= token.worldY &&
                worldMouseY <= token.worldY + unitSize
              ) {
                foundRepeatedToken = true;
                canvas.style.cursor = 'pointer';
              }
            });
          });

          if (!foundRepeatedToken && hoveredTokenIndex !== null) {
            canvas.style.cursor = 'grab';
          }
        }

        if (newHoveredIndex !== hoveredTokenIndex) {
          setHoveredTokenIndex(newHoveredIndex);
          setIsHoveringToken(newHoveredIndex !== null);
          hoverAnimationStartTime.current = currentTime;
        }

        lastMouseCheck.current = currentTime;
      }

      // Update hover animation progress - optimized for Safari
      if (isHoveringToken || currentHoverProgress > 0) {
        const elapsed = currentTime - hoverAnimationStartTime.current;
        let progress = Math.min(1, elapsed / hoverAnimationDuration);
        if (!isHoveringToken) {
          progress = 1 - progress;
        }

        if (browserPerf.useLinearEasing) {
          progress = progress; // Linear interpolation for performance mode
        } else {
          progress = easeInOutCubic(progress);
        }

        setCurrentHoverProgress(progress);

        if (!isHoveringToken && progress <= 0) {
          setCurrentHoverProgress(0);
        }
      }

      // Calculate token animation progress
      let tokenOpacity = 0;
      let tokenScale = 0.95;

      if (isProductAnimationActive && productAnimationStartTime) {
        const elapsed = currentTime - productAnimationStartTime;
        const tokenDelay = 100;
        const adjustedElapsed = Math.max(0, elapsed - tokenDelay);
        const progress = Math.min(1, adjustedElapsed / ANIMATION_DURATION);
        const easedProgress = easeInOutCubic(progress);

        tokenOpacity = easedProgress;
        tokenScale = 0.95 + 0.05 * easedProgress;
      } else if (productAnimationStartTime) {
        tokenOpacity = 1;
        tokenScale = 1;
      }

      // Draw original create token squares with animation
      createTokenPositions.forEach((pos, index) => {
        const isCurrentlyHovered = index === hoveredTokenIndex;
        const actualHoverProgress = isCurrentlyHovered ? currentHoverProgress : 0;

        if (tokenOpacity > 0) {
          ctx.save();
          ctx.globalAlpha = tokenOpacity;

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

      // Draw repeated create token squares (always fully visible, no animation)
      if (tokenOpacity > 0) {
        repeatedTokens.current.forEach((tileTokens) => {
          tileTokens.forEach((token) => {
            ctx.save();
            ctx.globalAlpha = 1; // Always fully visible

            drawCreateTokenSquare(
              ctx,
              token.worldX,
              token.worldY,
              0, // No hover effect for repeated tokens
              unitSize,
              logoImageRef.current,
              spaceCanvasRef.current,
              currentTime,
            );
            ctx.restore();
          });
        });
      }

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
      // Phase 2 Step 2: Animation frame handled by centralized manager
      // animationFrameRef.current = requestAnimationFrame(draw); // Removed
    };

    // Phase 2 Step 2: Safe animation frame management with proper cleanup
    let animationFrameId: number | null = null;
    let isAnimationActive = true;

    const animate = () => {
      if (!isAnimationActive) return; // Early exit if cleanup called

      draw(performance.now());

      if (isAnimationActive) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      // Phase 2 Step 2: Fix cleanup race conditions
      isAnimationActive = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };
  }, [
    imagesLoaded,
    placementsCalculated,
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

  return {
    canvasRef: activeCanvasRef,
    canvasProgress,
    canvasReady,
  };
};
