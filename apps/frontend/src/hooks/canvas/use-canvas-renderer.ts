'use client';

import type React from 'react';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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
import {
  browserUtils,
  getBrowserPerformanceSettings,
  getDeviceCapabilities,
} from '../../lib/utils/browser-utils';
import {
  addEventListenerSafe,
  removeEventListenerSafe,
} from '../../lib/utils/event-listener-utils';
// Note: useAnimationFrame removed - caused scroll timing issues, kept for background animations only

// Phase 2 Step 9: Import comprehensive error boundary utilities
import {
  safeGetCanvasContext,
  safeGetBoundingClientRect,
  monitorCanvasPerformance,
  recoverFromCanvasError,
  type CanvasOperationResult,
} from '../../lib/utils/canvas-error-boundary';

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

  // Enhanced browser performance detection including mobile optimizations
  const browserPerf = useMemo(() => {
    const perf = getBrowserPerformanceSettings();
    const capabilities = getDeviceCapabilities();

    // Phase 2 Step 7 Action 3: Mobile-specific animation optimizations
    const isMobileDevice = capabilities.touchCapable || capabilities.isMobileSafari;
    const performanceTier = capabilities.performanceTier;

    return {
      ...perf,
      // Mobile-optimized settings for smoother animation
      frameThrottling: isMobileDevice && performanceTier === 'low',
      mouseCheckInterval: isMobileDevice
        ? performanceTier === 'high'
          ? 32
          : performanceTier === 'medium'
            ? 50
            : 100
        : perf.mouseCheckInterval,
      enableImageSmoothing: !isMobileDevice || performanceTier !== 'low',
      adaptiveRendering: isMobileDevice, // Enable adaptive quality for mobile
    };
  }, []);

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

  // Canvas and animation refs - consolidated declaration
  const animationFrameRef = useRef<number | null>(null);
  const productAnimationStartTime = useRef<number | null>(null);

  // Phase 2 Step 7 Action 3: Mobile animation performance optimization
  const mobilePerformanceRef = useRef({
    lastFrameTime: 0,
    frameSkipCount: 0,
    adaptiveQuality: 1.0, // Start with full quality
    targetFrameTime: 16, // 60fps target
  });

  // Phase 2 Step 7 Action 3: Mobile frame management
  const shouldSkipFrame = useCallback(
    (currentTime: number): boolean => {
      if (!browserPerf.adaptiveRendering) return false;

      const mobile = mobilePerformanceRef.current;
      const frameTime = currentTime - mobile.lastFrameTime;

      // Skip frame if we're falling behind target framerate
      if (frameTime < mobile.targetFrameTime * 0.8) {
        mobile.frameSkipCount++;
        return true;
      }

      // Adapt quality based on performance
      if (mobile.frameSkipCount > 3) {
        mobile.adaptiveQuality = Math.max(0.7, mobile.adaptiveQuality - 0.1);
      } else if (mobile.frameSkipCount === 0 && frameTime < mobile.targetFrameTime) {
        mobile.adaptiveQuality = Math.min(1.0, mobile.adaptiveQuality + 0.05);
      }

      mobile.lastFrameTime = currentTime;
      mobile.frameSkipCount = 0;
      return false;
    },
    [browserPerf.adaptiveRendering],
  );

  // Phase 2 Step 7 Action 3: Optimized mouse check for mobile
  const shouldCheckMouse = useCallback(
    (currentTime: number): boolean => {
      // On mobile, reduce mouse checks during touch interactions to save CPU
      if (browserPerf.adaptiveRendering && mobilePerformanceRef.current.adaptiveQuality < 0.9) {
        return currentTime - lastMouseCheck.current > browserPerf.mouseCheckInterval * 2;
      }
      return currentTime - lastMouseCheck.current > browserPerf.mouseCheckInterval;
    },
    [browserPerf.mouseCheckInterval, browserPerf.adaptiveRendering],
  );

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

  // Phase 2 Step 4 Action 2: Enhanced viewport change detection
  const viewStateRef = useRef(viewState);
  const pendingUpdateRef = useRef<NodeJS.Timeout | null>(null);

  // Phase 2 Step 4 Action 2: Track significant viewport changes to optimize grid updates
  const lastSignificantViewStateRef = useRef({
    x: viewState.x,
    y: viewState.y,
    scale: viewState.scale,
  });

  // Phase 2 Step 4 Action 2: Optimized viewport change detection
  const hasSignificantViewportChange = useCallback((currentViewState: ViewState): boolean => {
    const last = lastSignificantViewStateRef.current;
    const threshold = 50; // pixels - only update grid for moves > 50px
    const scaleThreshold = 0.1; // scale changes > 10%

    const deltaX = Math.abs(currentViewState.x - last.x);
    const deltaY = Math.abs(currentViewState.y - last.y);
    const deltaScale = Math.abs(currentViewState.scale - last.scale);

    return deltaX > threshold || deltaY > threshold || deltaScale > scaleThreshold;
  }, []);

  // Phase 2 Step 4 Action 2: Debounced grid update with proper viewport coordination
  const debouncedGridUpdate = useCallback(
    (newViewState: ViewState) => {
      // Clear any pending update
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
      }

      // Check if this is a significant enough change to warrant grid update
      if (!hasSignificantViewportChange(newViewState)) {
        return; // Skip minor viewport changes
      }

      const now = performance.now();
      const timeSinceLastUpdate = now - lastUpdateRef.current;

      if (timeSinceLastUpdate < updateDebounceDelay) {
        // Debounce rapid changes
        pendingUpdateRef.current = setTimeout(() => {
          updateInfiniteGrid(newViewState);
          lastUpdateRef.current = performance.now();
          lastSignificantViewStateRef.current = {
            x: newViewState.x,
            y: newViewState.y,
            scale: newViewState.scale,
          };
          pendingUpdateRef.current = null;
        }, updateDebounceDelay - timeSinceLastUpdate);
      } else {
        // Update immediately if enough time has passed
        updateInfiniteGrid(newViewState);
        lastUpdateRef.current = now;
        lastSignificantViewStateRef.current = {
          x: newViewState.x,
          y: newViewState.y,
          scale: newViewState.scale,
        };
      }
    },
    [updateInfiniteGrid, hasSignificantViewportChange, updateDebounceDelay],
  );

  // Phase 2 Step 4 Action 2: Update viewStateRef and trigger coordinated grid updates
  useEffect(() => {
    viewStateRef.current = viewState;

    // Only update grid if placements are ready
    if (placementsCalculated && originalGridBounds.current) {
      debouncedGridUpdate(viewState);
    }
  }, [viewState, placementsCalculated, debouncedGridUpdate]);

  // Phase 2 Step 4 Action 2: Cleanup pending updates on unmount
  useEffect(() => {
    return () => {
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }
    };
  }, []);

  // Start product animation when images are loaded AND canvas is visible
  useEffect(() => {
    if (imagesLoaded && placementsCalculated && canvasVisible) {
      // Start animation immediately for faster loading experience
      productAnimationStartTime.current = performance.now();
      setIsProductAnimationActive(true);
    }
  }, [imagesLoaded, placementsCalculated, canvasVisible]);

  // Phase 2 Step 3: Enhanced event listener setup with ref change protection
  useEffect(() => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;

    // Phase 2 Step 3: Store canvas reference for cleanup validation
    const currentCanvas = canvas;

    const handleMouseMove = (event: Event) => {
      // Phase 2 Step 3: Validate canvas is still the same element
      if (activeCanvasRef.current !== currentCanvas) return;

      const mouseEvent = event as MouseEvent;
      // Phase 2 Step 9: Safe getBoundingClientRect with precision handling
      const rectResult = safeGetBoundingClientRect(currentCanvas);
      if (!rectResult.success || !rectResult.data) {
        console.warn('[Phase 2 Step 9] Canvas bounds calculation failed:', rectResult.error);
        return;
      }
      const rect = rectResult.data;
      mousePositionRef.current = {
        x: mouseEvent.clientX - rect.left,
        y: mouseEvent.clientY - rect.top,
      };
    };

    const handleClick = (event: Event) => {
      // Phase 2 Step 3: Validate canvas is still the same element
      if (activeCanvasRef.current !== currentCanvas) return;

      // Check if clicking on original token (with hover effect)
      if (hoveredTokenIndex !== null) {
        onCreateTokenClick();
        return;
      }

      // Check if clicking on repeated token
      const mouseEvent = event as MouseEvent;
      // Phase 2 Step 9: Safe getBoundingClientRect with precision handling
      const rectResult = safeGetBoundingClientRect(currentCanvas);
      if (!rectResult.success || !rectResult.data) {
        console.warn('[Phase 2 Step 9] Canvas bounds calculation failed:', rectResult.error);
        return;
      }
      const rect = rectResult.data;
      const mouseX = mouseEvent.clientX - rect.left;
      const mouseY = mouseEvent.clientY - rect.top;
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

    // Phase 2 Step 3 Action 5: Enhanced error handling for canvas mouse events
    const mouseMoveResult = addEventListenerSafe(currentCanvas, 'mousemove', handleMouseMove);
    const clickResult = addEventListenerSafe(currentCanvas, 'click', handleClick);

    if (!mouseMoveResult.success) {
      console.warn(
        '[Phase 2 Step 3] Canvas mousemove listener setup failed:',
        mouseMoveResult.details,
      );
      // Canvas will still work, just without hover effects
    } else if (mouseMoveResult.fallbackApplied) {
      console.info('[Phase 2 Step 3] Canvas mousemove listener using fallback strategy');
    }

    if (!clickResult.success) {
      console.warn('[Phase 2 Step 3] Canvas click listener setup failed:', clickResult.details);
      // Canvas will still work, just without click interactions
    } else if (clickResult.fallbackApplied) {
      console.info('[Phase 2 Step 3] Canvas click listener using fallback strategy');
    }

    return () => {
      // Phase 2 Step 3 Action 5: Enhanced cleanup with error reporting
      if (mouseMoveResult.success && currentCanvas) {
        const removeResult = removeEventListenerSafe(currentCanvas, 'mousemove', handleMouseMove);
        if (!removeResult.success) {
          console.warn('[Phase 2 Step 3] Canvas mousemove cleanup failed:', removeResult.details);
        }
      }
      if (clickResult.success && currentCanvas) {
        const removeResult = removeEventListenerSafe(currentCanvas, 'click', handleClick);
        if (!removeResult.success) {
          console.warn('[Phase 2 Step 3] Canvas click cleanup failed:', removeResult.details);
        }
      }
    };
  }, [hoveredTokenIndex, onCreateTokenClick, viewState, unitSize, activeCanvasRef]); // Phase 2 Step 3: Added activeCanvasRef dependency

  useEffect(() => {
    if (!imagesLoaded || !placementsCalculated) return;

    const canvas = activeCanvasRef.current;
    if (!canvas) return;

    // Phase 2 Step 9: Safe canvas context creation with browser variation handling
    const contextResult = safeGetCanvasContext(canvas, '2d');
    if (!contextResult.success) {
      console.warn('[Phase 2 Step 9] Canvas context creation failed:', contextResult.error);
      return;
    }
    const ctx = contextResult.data as CanvasRenderingContext2D;
    if (!ctx) return;

    // Update progress: Canvas initializing (80%)
    setCanvasProgress(80);

    // Performance optimization: enable image smoothing for Safari to improve movement quality
    // Disable only during static rendering to maintain performance
    ctx.imageSmoothingEnabled = true;

    // Phase 2 Step 7 Action 1: Canvas sizing now handled by coordinated resize system
    // No need for manual updateCanvasSize here - coordinated resize manages DPR and mobile optimization

    // Update progress: Canvas ready (100%)
    setCanvasProgress(100);
    setCanvasReady(true);

    // Phase 2 Step 9: Lightweight performance monitoring (removed heavy monitoring for performance)
    // Performance monitoring moved to development mode only

    const homeAreaWorldX = -unitSize;
    const homeAreaWorldY = -unitSize;
    const homeAreaWidth = unitSize * 2;
    const homeAreaHeight = unitSize;

    const draw = (currentTime: number) => {
      // Phase 2 Step 7 Action 3: Mobile frame skip optimization
      if (shouldSkipFrame(currentTime)) {
        return;
      }

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

      // Phase 2 Step 7 Action 3: Apply adaptive quality for mobile
      if (browserPerf.adaptiveRendering) {
        const quality = mobilePerformanceRef.current.adaptiveQuality;
        ctx.imageSmoothingEnabled = browserPerf.enableImageSmoothing && quality > 0.8;
        ctx.globalAlpha = Math.max(0.8, quality); // Slightly reduce opacity on low performance
      } else {
        ctx.imageSmoothingEnabled = browserPerf.enableImageSmoothing;
        ctx.globalAlpha = 1.0;
      }

      ctx.save();
      ctx.translate(viewState.x, viewState.y);
      ctx.scale(viewState.scale, viewState.scale);

      // Use STABLE placements - no recalculation!
      const productPlacements = stableProductPlacements.current;
      const createTokenPositions = stableCreateTokenPositions.current;

      const ANIMATION_DURATION = browserPerf.animationDuration; // Centralized animation duration

      // Check if the overall animation sequence is complete
      if (isProductAnimationActive && productAnimationStartTime.current) {
        const elapsed = currentTime - productAnimationStartTime.current;

        if (elapsed > ANIMATION_DURATION + 100) {
          // Add small buffer
          setIsProductAnimationActive(false);
        }
      }

      // Calculate animation progress once
      let animationProgress = 0;
      if (isProductAnimationActive && productAnimationStartTime.current) {
        const elapsed = currentTime - productAnimationStartTime.current;
        const progress = Math.min(1, elapsed / ANIMATION_DURATION);
        animationProgress = easeInOutCubic(progress);
      } else if (productAnimationStartTime.current) {
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

      // Phase 2 Step 7 Action 3: Mobile-optimized mouse hit detection
      let newHoveredIndex: number | null = null;
      if (shouldCheckMouse(currentTime)) {
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

      if (isProductAnimationActive && productAnimationStartTime.current) {
        const elapsed = currentTime - productAnimationStartTime.current;
        const tokenDelay = 100;
        const adjustedElapsed = Math.max(0, elapsed - tokenDelay);
        const progress = Math.min(1, adjustedElapsed / ANIMATION_DURATION);
        const easedProgress = easeInOutCubic(progress);

        tokenOpacity = easedProgress;
        tokenScale = 0.95 + 0.05 * easedProgress;
      } else if (productAnimationStartTime.current) {
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
    activeCanvasRef, // Phase 2 Step 4 Action 3: Added missing canvas ref dependency
  ]); // Phase 2 Step 4 Action 3: Most refs are intentionally stable and don't need dependencies

  return {
    canvasRef: activeCanvasRef,
    canvasProgress,
    canvasReady,
  };
};
