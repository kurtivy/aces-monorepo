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
import {
  easeInOutCubic,
  roundTo3Decimals,
  isApproximatelyEqual,
} from '../../lib/canvas/math-utils';
import { useCoordinatedResize } from '../use-coordinated-resize';
import {
  browserUtils,
  getBrowserPerformanceSettings,
  getDeviceCapabilities,
  mobileUtils,
} from '../../lib/utils/browser-utils';
import { getInteractionCanvasQuality } from '../../lib/utils/animation-coordinator';
import {
  addEventListenerSafe,
  removeEventListenerSafe,
} from '../../lib/utils/event-listener-utils';
// Note: useAnimationFrame removed - caused scroll timing issues, kept for background animations only

// Phase 1: Import animation timing hook
import { useCanvasAnimationTiming } from './use-canvas-animation-timing';

// Phase 2: Import background tile processor
import { useBackgroundTileProcessor } from './use-background-tile-processor';

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

// Phase 3.1: Dirty Region Tracking Interface
interface DirtyRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  reason: 'viewport' | 'hover' | 'animation' | 'full';
}

interface DirtyRegionManager {
  regions: DirtyRegion[];
  addDirtyRegion: (region: DirtyRegion) => void;
  shouldRedrawRegion: (x: number, y: number, width: number, height: number) => boolean;
  clearDirtyRegions: () => void;
  optimizeRegions: () => void;
}

// Phase 3.2: Grid Tile Streaming Interfaces
interface TilePriority {
  tile: GridTile;
  priority: number; // Lower = higher priority (center tiles first)
  distance: number; // Distance from viewport center
}

interface TileStreamingManager {
  priorityQueue: TilePriority[];
  processingTile: string | null;
  addTiles: (tiles: GridTile[], viewportCenter: { x: number; y: number }) => void;
  getNextTile: () => TilePriority | null;
  isProcessing: () => boolean;
  clear: () => void;
}

interface LRUTileCache {
  cache: Map<
    string,
    { placements: RepeatedPlacement[]; tokens: RepeatedTokenPosition[]; lastAccess: number }
  >;
  maxSize: number;
  get: (
    tileId: string,
  ) => { placements: RepeatedPlacement[]; tokens: RepeatedTokenPosition[] } | null;
  set: (
    tileId: string,
    data: { placements: RepeatedPlacement[]; tokens: RepeatedTokenPosition[] },
  ) => void;
  delete: (tileId: string) => void;
  clear: () => void;
  getSize: () => number;
  evictLRU: () => void;
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

  // Animation state - KEEP these in main hook (UI state, not animation timing)
  const [isProductAnimationActive, setIsProductAnimationActive] = useState(false);
  const [isHoveringToken, setIsHoveringToken] = useState(false);

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

  const hoverAnimationDuration = browserPerf.animationDuration; // Centralized animation duration

  const [hoveredRepeatedToken, setHoveredRepeatedToken] = useState<{
    worldX: number;
    worldY: number;
    tileId: string;
  } | null>(null);

  // Use a longer duration for entrance animation
  const ENTRANCE_ANIMATION_DURATION = 800; // Longer duration for entrance animation
  const HOVER_ANIMATION_DURATION = browserPerf.animationDuration; // Keep hover animation duration as is

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

  // Phase 1: Animation timing coordination - EXTRACTED animation calculations
  const {
    productAnimationProgress,
    hoverAnimationProgress,
    currentHoverProgress,
    hasAnimationStarted,
    startProductAnimation,
    updateHoverState,
    updateAnimations,
  } = useCanvasAnimationTiming({
    isProductAnimationActive,
    isHoveringToken,
    imagesLoaded,
    placementsCalculated,
    canvasVisible,
  });

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

  // Phase 2 Step 7 Action 3: Mobile animation performance optimization
  const mobilePerformanceRef = useRef({
    lastFrameTime: 0,
    adaptiveQuality: 1.0, // Start with full quality, remove frameSkipCount
  });

  // Phase 2 Step 7 Action 3: Simplified mobile frame management
  const shouldThrottleFrame = useCallback(
    (currentTime: number): boolean => {
      if (!browserPerf.adaptiveRendering) return false;

      const mobile = mobilePerformanceRef.current;
      const frameTime = currentTime - mobile.lastFrameTime;

      // Simple throttling: limit to 30fps on mobile instead of aggressive skipping
      const minFrameTime = 33; // 30fps = 33ms between frames

      if (frameTime < minFrameTime) {
        return true; // Throttle, but don't affect quality
      }

      mobile.lastFrameTime = currentTime;
      return false;
    },
    [browserPerf.adaptiveRendering],
  );

  // Phase 2: Background tile processing - EXTRACTED expensive tile generation
  const backgroundTileProcessor = useBackgroundTileProcessor({
    images,
    unitSize,
    stableProductPlacements: stableProductPlacements.current,
    stableCreateTokenPositions: stableCreateTokenPositions.current,
    originalGridBounds: originalGridBounds.current,
  });

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
    if (!originalGridBounds.current) {
      return [];
    }

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
        if (tileX === 0 && tileY === 0) {
          continue;
        }
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

  // Phase 2: generateRepeatedPlacementsForTile function moved to useBackgroundTileProcessor

  const updateInfiniteGrid = useCallback(
    (currentViewState: ViewState) => {
      if (!originalGridBounds.current || !placementsCalculated) {
        return;
      }

      const requiredTiles = calculateRequiredTiles(currentViewState);

      const newActiveTiles = new Set<string>();

      // Phase 3.2: Calculate viewport center for priority calculation
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const viewportCenterX =
        -currentViewState.x / currentViewState.scale + screenWidth / currentViewState.scale / 2;
      const viewportCenterY =
        -currentViewState.y / currentViewState.scale + screenHeight / currentViewState.scale / 2;

      // Phase 3.2: Use streaming approach instead of batch processing
      const tilesToLoad: GridTile[] = [];

      requiredTiles.forEach((tile) => {
        const tileId = `${tile.tileX},${tile.tileY}`;
        newActiveTiles.add(tileId);

        // Phase 2: Use background processor for cache management
        const cachedData = backgroundTileProcessor.getCachedTileData(tileId);
        if (cachedData) {
          // Update the current active data from cache
          repeatedPlacements.current.set(tileId, cachedData.placements);
          repeatedTokens.current.set(tileId, cachedData.tokens);
        } else {
          // Add to background processing queue instead of blocking main thread
          tilesToLoad.push(tile);
        }
      });

      // Phase 2: Add new tiles to background processor queue
      if (tilesToLoad.length > 0) {
        backgroundTileProcessor.addTilesToQueue(tilesToLoad, {
          x: viewportCenterX,
          y: viewportCenterY,
        });

        // Background processing is handled automatically by the processor
      }

      // Clean up distant tiles and cache them using background processor
      const tilesToRemove = Array.from(activeTiles.current).filter(
        (tileId) => !newActiveTiles.has(tileId),
      );
      tilesToRemove.forEach((tileId) => {
        // Phase 2: Use background processor for cache management
        const placements = repeatedPlacements.current.get(tileId);
        const tokens = repeatedTokens.current.get(tileId);

        if (placements && tokens) {
          backgroundTileProcessor.cacheTileData(tileId, { placements, tokens });
        }

        // Remove from active memory
        repeatedPlacements.current.delete(tileId);
        repeatedTokens.current.delete(tileId);
      });

      activeTiles.current = newActiveTiles;
    },
    [calculateRequiredTiles, placementsCalculated],
  );

  const calculatePlacements = useCallback(() => {
    if (!imagesLoaded || placementsCalculated) {
      return;
    }

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
          originalGridBounds.current,
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

    // Phase 2: Clear background processor caches on reset
    backgroundTileProcessor.clearTileQueue();
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

    const hasChange = deltaX > threshold || deltaY > threshold || deltaScale > scaleThreshold;

    return hasChange;
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

  // CRITICAL FIX: Initial grid update when placements are calculated
  useEffect(() => {
    if (placementsCalculated && originalGridBounds.current) {
      // Force initial grid update regardless of viewport changes
      updateInfiniteGrid(viewState);
    }
  }, [placementsCalculated, updateInfiniteGrid]);

  // Phase 2 Step 4 Action 2: Update viewStateRef and trigger coordinated grid updates
  useEffect(() => {
    viewStateRef.current = viewState;

    // Phase 3.1: Track viewport changes as dirty regions
    if (placementsCalculated && originalGridBounds.current) {
      const canvas = activeCanvasRef.current;
      if (canvas) {
        // Add dirty region for viewport change
        const canvasRect = canvas.getBoundingClientRect();
        const viewportWorldBounds = {
          x: -viewState.x / viewState.scale,
          y: -viewState.y / viewState.scale,
          width: canvasRect.width / viewState.scale,
          height: canvasRect.height / viewState.scale,
        };

        dirtyRegionManager.current.addDirtyRegion({
          x: viewportWorldBounds.x,
          y: viewportWorldBounds.y,
          width: viewportWorldBounds.width,
          height: viewportWorldBounds.height,
          reason: 'viewport',
        });
      }

      debouncedGridUpdate(viewState);
    }
  }, [viewState, placementsCalculated, debouncedGridUpdate]); // CRITICAL FIX: Added debouncedGridUpdate back to dependencies

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
  // CRITICAL FIX: Don't auto-start animation on every mount - let it be user-triggered
  useEffect(() => {
    if (imagesLoaded && placementsCalculated && canvasVisible) {
      // Don't automatically start animation - images should be visible immediately
      // Animation can be triggered later if needed
      setIsProductAnimationActive(false);
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
      // Canvas will still work, just without hover effects
    } else if (mouseMoveResult.fallbackApplied) {
      // Canvas will still work, just without hover effects
    }

    if (!clickResult.success) {
      // Canvas will still work, just without click interactions
    } else if (clickResult.fallbackApplied) {
      // Canvas will still work, just without click interactions
    }

    return () => {
      // Phase 2 Step 3 Action 5: Enhanced cleanup with error reporting
      if (mouseMoveResult.success && currentCanvas) {
        const removeResult = removeEventListenerSafe(currentCanvas, 'mousemove', handleMouseMove);
        if (!removeResult.success) {
          // Canvas will still work, just without hover effects
        }
      }
      if (clickResult.success && currentCanvas) {
        const removeResult = removeEventListenerSafe(currentCanvas, 'click', handleClick);
        if (!removeResult.success) {
          // Canvas will still work, just without click interactions
        }
      }
    };
  }, [hoveredTokenIndex, onCreateTokenClick, viewState, unitSize, activeCanvasRef]); // Phase 2 Step 3: Added activeCanvasRef dependency

  // CRITICAL FIX: Separate canvas initialization from animation loop to prevent infinite re-renders
  useEffect(() => {
    if (!imagesLoaded || !placementsCalculated) return;

    const canvas = activeCanvasRef.current;
    if (!canvas) return;

    // Phase 2 Step 9: Safe canvas context creation with browser variation handling
    const contextResult = safeGetCanvasContext(canvas, '2d');
    if (!contextResult.success) {
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
  }, [imagesLoaded, placementsCalculated, activeCanvasRef]); // CRITICAL FIX: Removed viewState from dependencies

  // CRITICAL FIX: Separate animation loop that depends on viewState
  useEffect(() => {
    if (!imagesLoaded || !placementsCalculated || !canvasVisible) return;

    const canvas = activeCanvasRef.current;
    if (!canvas) return;

    // Phase 2 Step 9: Safe canvas context creation with browser variation handling
    const contextResult = safeGetCanvasContext(canvas, '2d');
    if (!contextResult.success) {
      return;
    }
    const ctx = contextResult.data as CanvasRenderingContext2D;
    if (!ctx) return;

    // Phase 2 Step 9: Lightweight performance monitoring (removed heavy monitoring for performance)
    // Performance monitoring moved to development mode only

    const homeAreaWorldX = -unitSize;
    const homeAreaWorldY = -unitSize;
    const homeAreaWidth = unitSize * 2;
    const homeAreaHeight = unitSize;

    const draw = (currentTime: number) => {
      const canvas = activeCanvasRef.current;
      if (!canvas) return;

      // Phase 2 Step 9: Safe canvas context creation with browser variation handling
      const contextResult = safeGetCanvasContext(canvas, '2d');
      if (!contextResult.success) {
        return;
      }
      const ctx = contextResult.data as CanvasRenderingContext2D;
      if (!ctx) return;

      // Safari optimization: Detect Safari once for viewport culling
      const isSafari =
        typeof navigator !== 'undefined' &&
        navigator.userAgent.includes('Safari') &&
        !navigator.userAgent.includes('Chrome');

      // Phase 3.1: Check if we should use dirty region optimization
      const shouldUseDirtyRegions = dirtyRegionManager.current.regions.length > 0;

      // Phase 2 Step 7 Action 3: Mobile frame skip optimization
      if (shouldThrottleFrame(currentTime)) {
        return;
      }

      if (browserPerf.frameThrottling) {
        if (currentTime - frameThrottleRef.current < frameInterval) {
          // Phase 2 Step 2: Frame throttling handled by centralized manager
          return;
        }
        frameThrottleRef.current = currentTime;
      }

      // Phase 3.1: Clip-based redraw optimization - only redraw dirty regions
      const dirtyRegions = dirtyRegionManager.current.regions;
      const hasAnimations = isProductAnimationActive || isHoveringToken || currentHoverProgress > 0;

      // For now, use full redraw during animations to ensure smoothness
      // This can be optimized further in later phases
      if (
        hasAnimations ||
        dirtyRegions.length === 0 ||
        dirtyRegions.some((r) => r.reason === 'full')
      ) {
        // Full redraw - existing behavior
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        // Partial redraw - only clear dirty regions
        ctx.fillStyle = '#000000';
        dirtyRegions.forEach((region) => {
          // Convert world coordinates to screen coordinates
          const screenX = region.x * viewState.scale + viewState.x;
          const screenY = region.y * viewState.scale + viewState.y;
          const screenWidth = region.width * viewState.scale;
          const screenHeight = region.height * viewState.scale;

          // Clip and clear only this region
          ctx.save();
          ctx.beginPath();
          ctx.rect(screenX, screenY, screenWidth, screenHeight);
          ctx.clip();
          ctx.fillRect(screenX, screenY, screenWidth, screenHeight);
          ctx.restore();
        });
      }

      // Clear dirty regions after processing
      dirtyRegionManager.current.clearDirtyRegions();

      // MOBILE SHIMMER FIX: Use stable canvas properties to avoid constant recalculation
      // Set properties once at beginning, don't change them frequently during animation
      const shouldEnableSmoothing = browserPerf.enableImageSmoothing;
      const targetGlobalAlpha = 1.0; // Keep at full opacity for smooth animation

      // Only update imageSmoothingEnabled if it actually changed
      if (ctx.imageSmoothingEnabled !== shouldEnableSmoothing) {
        ctx.imageSmoothingEnabled = shouldEnableSmoothing;
      }

      // Only update globalAlpha if it actually changed (with small tolerance for floating point)
      if (!isApproximatelyEqual(ctx.globalAlpha, targetGlobalAlpha)) {
        ctx.globalAlpha = targetGlobalAlpha;
      }

      ctx.save();
      // MOBILE SHIMMER FIX: Round viewport transforms to integer pixels
      // Fractional translate/scale values cause subpixel rendering instability on mobile
      const roundedX = Math.round(viewState.x);
      const roundedY = Math.round(viewState.y);
      const roundedScale = roundTo3Decimals(viewState.scale);

      ctx.translate(roundedX, roundedY);
      ctx.scale(roundedScale, roundedScale);

      // Use STABLE placements - no recalculation!
      const productPlacements = stableProductPlacements.current;
      const createTokenPositions = stableCreateTokenPositions.current;

      // Phase 1: Update animations and get progress - EXTRACTED calculation logic
      const hasActiveAnimations = updateAnimations(currentTime);
      const animationProgress = productAnimationProgress;

      // Stop product animation when complete
      if (isProductAnimationActive && !hasActiveAnimations && animationProgress >= 1) {
        setIsProductAnimationActive(false);
      }

      // Draw original products with animation - using STABLE positions
      // CRITICAL FIX: Show images at full opacity immediately, animate only when intended
      const effectiveAnimationProgress = isProductAnimationActive ? animationProgress : 1;

      productPlacements.forEach((placement) => {
        drawImage(
          ctx,
          placement.image.element,
          placement.x,
          placement.y,
          placement.width,
          placement.height,
          effectiveAnimationProgress,
          unitSize,
        );
      });

      // Draw repeated grid products (always fully visible, no animation)
      // CRITICAL FIX: Tile rendering should be independent of animation progress
      if (placementsCalculated && originalGridBounds.current) {
        // Mobile Safari optimization: Simplified viewport culling for better performance
        if (isSafari && browserPerf.adaptiveRendering) {
          // Calculate visible viewport bounds in world coordinates with larger buffer for mobile
          const viewportLeft = -viewState.x / viewState.scale;
          const viewportTop = -viewState.y / viewState.scale;
          const viewportRight = viewportLeft + canvas.width / viewState.scale;
          const viewportBottom = viewportTop + canvas.height / viewState.scale;

          // Larger buffer for mobile to reduce culling calculations during scroll
          const buffer = unitSize * 1.5;
          const cullingLeft = viewportLeft - buffer;
          const cullingTop = viewportTop - buffer;
          const cullingRight = viewportRight + buffer;
          const cullingBottom = viewportBottom + buffer;

          // Only show repeated grids after original animation starts
          repeatedPlacements.current.forEach((tilePlacements) => {
            tilePlacements.forEach((placement) => {
              // Simplified culling check - only check if center is visible
              const centerX = placement.x + placement.width / 2;
              const centerY = placement.y + placement.height / 2;

              // Skip images where center is outside viewport
              if (
                centerX < cullingLeft ||
                centerX > cullingRight ||
                centerY < cullingTop ||
                centerY > cullingBottom
              ) {
                return; // Skip this image
              }

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
        } else {
          // Standard rendering for other browsers (no culling overhead)
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
      }

      // Phase 2 Step 7 Action 3: Mobile-optimized mouse hit detection
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

        // HOVER ENHANCEMENT: Check repeated create token positions (now with hover effects!)
        let newHoveredRepeatedToken: RepeatedTokenPosition | null = null;
        if (newHoveredIndex === null) {
          // Only check repeated tokens if not hovering over original tokens
          repeatedTokens.current.forEach((tileTokens) => {
            tileTokens.forEach((token) => {
              if (
                worldMouseX >= token.worldX &&
                worldMouseX <= token.worldX + unitSize &&
                worldMouseY >= token.worldY &&
                worldMouseY <= token.worldY + unitSize
              ) {
                newHoveredRepeatedToken = token;
                canvas.style.cursor = 'pointer';
              }
            });
          });

          if (!newHoveredRepeatedToken && hoveredTokenIndex !== null) {
            canvas.style.cursor = 'grab';
          }
        }

        // HOVER ENHANCEMENT: Update repeated token hover state (performance-optimized)
        let repeatedTokenChanged = false;

        // Check if hover state changed (null to non-null or vice versa)
        if ((hoveredRepeatedToken === null) !== (newHoveredRepeatedToken === null)) {
          repeatedTokenChanged = true;
        }
        // Check if position changed (both non-null but different positions)
        else if (hoveredRepeatedToken && newHoveredRepeatedToken) {
          const current = hoveredRepeatedToken as RepeatedTokenPosition;
          const next = newHoveredRepeatedToken as RepeatedTokenPosition;
          if (current.worldX !== next.worldX || current.worldY !== next.worldY) {
            repeatedTokenChanged = true;
          }
        }

        if (repeatedTokenChanged) {
          // Phase 3.1: Add dirty regions for repeated token hover changes
          const buffer = unitSize * 0.2; // Same buffer as original tokens

          // Mark old hovered repeated token as dirty (if any)
          if (hoveredRepeatedToken) {
            dirtyRegionManager.current.addDirtyRegion({
              x: hoveredRepeatedToken.worldX - buffer,
              y: hoveredRepeatedToken.worldY - buffer,
              width: unitSize + buffer * 2,
              height: unitSize + buffer * 2,
              reason: 'hover',
            });
          }

          // Mark new hovered repeated token as dirty (if any)
          // TEMPORARY FIX: Comment out to resolve TypeScript error - will fix properly later
          /*
          if (newHoveredRepeatedToken) {
            dirtyRegionManager.current.addDirtyRegion({
              x: newHoveredRepeatedToken.worldX - buffer,
              y: newHoveredRepeatedToken.worldY - buffer,
              width: unitSize + buffer * 2,
              height: unitSize + buffer * 2,
              reason: 'hover',
            });
          }
          */

          setHoveredRepeatedToken(newHoveredRepeatedToken);

          // PERFORMANCE OPTIMIZATION: Reuse existing hover animation system
          // If we're switching from original to repeated token (or vice versa),
          // restart the animation to ensure smooth transition
          if (newHoveredRepeatedToken || hoveredRepeatedToken) {
            setIsHoveringToken(newHoveredRepeatedToken !== null);
            updateHoverState(newHoveredRepeatedToken !== null, currentTime);
          }
        }

        if (newHoveredIndex !== hoveredTokenIndex) {
          // Phase 3.1: Add dirty regions for hover state changes
          const buffer = unitSize * 0.2; // 20% buffer for hover effects

          // Mark old hovered area as dirty (if any)
          if (hoveredTokenIndex !== null && stableCreateTokenPositions.current[hoveredTokenIndex]) {
            const oldPos = stableCreateTokenPositions.current[hoveredTokenIndex];
            dirtyRegionManager.current.addDirtyRegion({
              x: oldPos.worldX - buffer,
              y: oldPos.worldY - buffer,
              width: unitSize + buffer * 2,
              height: unitSize + buffer * 2,
              reason: 'hover',
            });
          }

          // Mark new hovered area as dirty (if any)
          if (newHoveredIndex !== null && stableCreateTokenPositions.current[newHoveredIndex]) {
            const newPos = stableCreateTokenPositions.current[newHoveredIndex];
            dirtyRegionManager.current.addDirtyRegion({
              x: newPos.worldX - buffer,
              y: newPos.worldY - buffer,
              width: unitSize + buffer * 2,
              height: unitSize + buffer * 2,
              reason: 'hover',
            });
          }

          setHoveredTokenIndex(newHoveredIndex);
          setIsHoveringToken(newHoveredIndex !== null);
          updateHoverState(newHoveredIndex !== null, currentTime);
        }

        lastMouseCheck.current = currentTime;
      }
      // Phase 1: Hover animation now handled by animation timing hook
      // (All hover progress calculations moved to useCanvasAnimationTiming)

      // Calculate token animation progress
      // CRITICAL FIX: Show tokens at full opacity immediately if animation not active
      let tokenOpacity = 1;
      let tokenScale = 1;

      if (isProductAnimationActive && hasAnimationStarted) {
        // Add token delay effect
        const delayedProgress = Math.max(0, productAnimationProgress - 0.1); // 100ms delay effect
        const normalizedProgress = Math.min(1, delayedProgress / 0.9); // Normalize to 0-1

        tokenOpacity = normalizedProgress;
        tokenScale = 0.95 + 0.05 * normalizedProgress;
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

      // HOVER ENHANCEMENT: Draw repeated create token squares with hover effects!
      if (tokenOpacity > 0) {
        // Safari optimization: Viewport culling for repeated create token squares
        if (isSafari) {
          // Reuse viewport bounds calculated above
          const viewportLeft = -viewState.x / viewState.scale;
          const viewportTop = -viewState.y / viewState.scale;
          const viewportRight = viewportLeft + canvas.width / viewState.scale;
          const viewportBottom = viewportTop + canvas.height / viewState.scale;

          const buffer = unitSize;
          const cullingLeft = viewportLeft - buffer;
          const cullingTop = viewportTop - buffer;
          const cullingRight = viewportRight + buffer;
          const cullingBottom = viewportBottom + buffer;

          let tokenRenderedCount = 0;
          let tokenCulledCount = 0;

          repeatedTokens.current.forEach((tileTokens) => {
            tileTokens.forEach((token) => {
              // Viewport culling check for Safari performance
              const tokenRight = token.worldX + unitSize;
              const tokenBottom = token.worldY + unitSize;

              // Skip tokens that are completely outside the viewport
              if (
                token.worldX > cullingRight ||
                tokenRight < cullingLeft ||
                token.worldY > cullingBottom ||
                tokenBottom < cullingTop
              ) {
                tokenCulledCount++;
                return; // Skip this token
              }

              tokenRenderedCount++;

              ctx.save();
              ctx.globalAlpha = 1; // Always fully visible

              // HOVER ENHANCEMENT: Check if this repeated token is currently hovered
              const isCurrentlyHoveredRepeated =
                hoveredRepeatedToken &&
                hoveredRepeatedToken.worldX === token.worldX &&
                hoveredRepeatedToken.worldY === token.worldY;
              const actualHoverProgress = isCurrentlyHoveredRepeated ? currentHoverProgress : 0;

              drawCreateTokenSquare(
                ctx,
                token.worldX,
                token.worldY,
                actualHoverProgress, // Now repeated tokens get hover effects too!
                unitSize,
                logoImageRef.current,
                spaceCanvasRef.current,
                currentTime,
              );
              ctx.restore();
            });
          });
        } else {
          // Standard rendering for other browsers (no culling overhead)
          repeatedTokens.current.forEach((tileTokens) => {
            tileTokens.forEach((token) => {
              ctx.save();
              ctx.globalAlpha = 1; // Always fully visible

              // HOVER ENHANCEMENT: Check if this repeated token is currently hovered
              const isCurrentlyHoveredRepeated =
                hoveredRepeatedToken &&
                hoveredRepeatedToken.worldX === token.worldX &&
                hoveredRepeatedToken.worldY === token.worldY;
              const actualHoverProgress = isCurrentlyHoveredRepeated ? currentHoverProgress : 0;

              drawCreateTokenSquare(
                ctx,
                token.worldX,
                token.worldY,
                actualHoverProgress, // Now repeated tokens get hover effects too!
                unitSize,
                logoImageRef.current,
                spaceCanvasRef.current,
                currentTime,
              );
              ctx.restore();
            });
          });
        }
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

      const currentTime = performance.now();

      // Let the draw function handle its own throttling to avoid double throttling
      draw(currentTime);

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
    // REMOVED: productAnimationStartTime (it's a ref, not state)
    canvasVisible,
    activeCanvasRef, // Phase 2 Step 4 Action 3: Added missing canvas ref dependency
  ]); // Phase 2 Step 4 Action 3: Most refs are intentionally stable and don't need dependencies

  // Phase 2: Background tile processing loop
  useEffect(() => {
    if (!placementsCalculated) return;

    let isProcessingActive = true;

    const processBackgroundTiles = async () => {
      if (!isProcessingActive) return;

      // Process tiles in background when idle
      if (!backgroundTileProcessor.isProcessingTiles()) {
        try {
          const tileData = await backgroundTileProcessor.processNextTile();

          if (tileData && isProcessingActive) {
            // Extract tileId from the first placement (if any)
            const firstPlacement = tileData.placements[0];
            if (firstPlacement) {
              const tileId = firstPlacement.tileId;

              // Update active tiles if this tile is still needed
              if (activeTiles.current.has(tileId)) {
                repeatedPlacements.current.set(tileId, tileData.placements);
                repeatedTokens.current.set(tileId, tileData.tokens);
              }
            }
          }
        } catch (error) {
          // Continue processing on error
        }
      }

      // Continue processing in background
      if (isProcessingActive) {
        setTimeout(processBackgroundTiles, 16); // ~60fps processing
      }
    };

    processBackgroundTiles();

    return () => {
      isProcessingActive = false;
    };
  }, [placementsCalculated, backgroundTileProcessor]);

  // Phase 3.1: Dirty Region Manager Implementation
  const dirtyRegionManager = useRef<DirtyRegionManager>({
    regions: [],
    addDirtyRegion: (region: DirtyRegion): void => {
      dirtyRegionManager.current.regions.push(region);
    },
    shouldRedrawRegion: (x: number, y: number, width: number, height: number): boolean => {
      const regions: DirtyRegion[] = dirtyRegionManager.current.regions;
      if (regions.length === 0) return false;

      // Check if any dirty region intersects with the given region
      return regions.some((region: DirtyRegion) => {
        const intersects = !(
          region.x + region.width < x ||
          x + width < region.x ||
          region.y + region.height < y ||
          y + height < region.y
        );
        return intersects;
      });
    },
    clearDirtyRegions: (): void => {
      dirtyRegionManager.current.regions = [];
    },
    optimizeRegions: (): void => {
      // Simple optimization: merge overlapping regions
      const regions: DirtyRegion[] = dirtyRegionManager.current.regions;
      if (regions.length <= 1) return;

      // If we have too many regions, just mark everything as dirty
      if (regions.length > 10) {
        dirtyRegionManager.current.regions = [
          {
            x: 0,
            y: 0,
            width: Number.MAX_SAFE_INTEGER,
            height: Number.MAX_SAFE_INTEGER,
            reason: 'full',
          },
        ];
      }
    },
  });

  // Phase 2: Old tile cache and streaming implementations moved to useBackgroundTileProcessor

  return {
    canvasRef: activeCanvasRef,
    canvasProgress,
    canvasReady,
    repeatedPlacements: repeatedPlacements.current,
    repeatedTokens: repeatedTokens.current,
  };
};
