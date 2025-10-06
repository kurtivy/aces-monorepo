'use client';

import type React from 'react';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { ImageInfo, ViewState } from '../../types/canvas';
import { drawHomeArea, drawImage, getFeaturedSectionBounds } from '../../lib/canvas/draw';

// Phase 1: Import extracted animation timing hook
import { useCanvasAnimationTiming } from './use-canvas-animation-timing';

import { drawImageWithoutContext } from '../../lib/canvas/draw/draw-image';
import { batchRenderByOpacity, batchRenderAnimated } from '../../lib/utils/canvas-batch-renderer';
import {
  markSpaceOccupied,
  canPlaceImage,
  getImageCandidatesForPosition,
  recordImagePlacement,
  resetGlobalPlacementTracking,
} from '../../lib/canvas/grid-placement';
import { getDisplayDimensions } from '../../lib/canvas/image-type-utils';
// Space animation removed for performance optimization
import { isApproximatelyEqual } from '../../lib/canvas/math-utils';
import { useCoordinatedResize } from '../use-coordinated-resize';
import { detectLowPowerMode } from '../../lib/utils/browser-utils';
import { useDeviceCapabilities } from '../../contexts/device-provider';
import { BrowserOptimizations } from '../../lib/capabilities/browser-optimizations';
import { AdaptiveQualityManager } from '../../lib/capabilities/adaptive-quality-manager';
import {
  addEventListenerSafe,
  removeEventListenerSafe,
} from '../../lib/utils/event-listener-utils';
import { performanceMonitor } from '../../lib/utils/performance-monitor';
import {
  createViewTransform,
  batchTransformElements,
  worldToScreen,
} from '../../lib/utils/coordinate-transforms';
// MOMENTUM RESTORATION: Import TOUCH_SETTINGS for momentum physics
import { TOUCH_SETTINGS } from './use-canvas-interactions';
import { ViewportCuller, createWorldViewportBounds } from '../../lib/utils/viewport-culling';

// Note: useAnimationFrame removed - caused scroll timing issues, kept for background animations only

// Phase 1: Import entrance animation hook and types
import { useCanvasEntranceAnimation } from './use-canvas-entrance-animation';
import type { AnimatedProductElement, AnimatedTokenElement } from './use-canvas-entrance-animation';

// Phase 2: Import background tile processor
import { useBackgroundTileProcessor } from './use-background-tile-processor';

// Phase 2 Step 9: Import comprehensive error boundary utilities
import {
  safeGetCanvasContext,
  safeGetBoundingClientRect,
} from '../../lib/utils/canvas-error-boundary';

// FEATURED SECTION: Import featured section drawing functions
import { drawFeaturedSection, getAuctionIconBounds } from '../../lib/canvas/draw';
import { drawCustomLogoBanner } from '@/lib/canvas/draw/draw-custom-logo-banner';
import { getResponsiveMetrics } from '../../lib/utils/responsive-canvas-utils';

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
  // Issue #2: Add updateViewState for momentum handling
  updateViewState?: (deltaX: number, deltaY: number) => void;
  // FEATURED SECTION: Add featured image ID prop
  featuredImageId?: string;
  // FEATURED SECTION: Add modal handler for featured section clicks
  onFeaturedImageClick?: (imageInfo: ImageInfo) => void;
  // HOVER ENHANCEMENT: Add product image hover ref
  hoveredProductImageRef?: React.MutableRefObject<{
    image: ImageInfo;
    x: number;
    y: number;
    width: number;
    height: number;
    isRepeated?: boolean;
    tileId?: string;
  } | null>;
}

// Removed global browserPerf - now using capability-based system per hook instance

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

export const useCanvasRenderer = ({
  images,
  viewState,
  imagesLoaded,
  canvasVisible,
  unitSize,
  onCreateTokenClick,
  imagePlacementMap,
  canvasRef,
  updateViewState,
  featuredImageId = undefined, // FEATURED SECTION: Default to KAWS watch
  onFeaturedImageClick,
  // HOVER ENHANCEMENT: Add hover ref
  hoveredProductImageRef,
}: UseCanvasRendererProps) => {
  const canvasRefInternal = useRef<HTMLCanvasElement>(null);

  // Week 3: Use enhanced capability system
  const { capabilities, configuration, isReady: capabilitiesReady } = useDeviceCapabilities();

  // Use external canvasRef if provided, otherwise use internal one
  const activeCanvasRef = canvasRef || canvasRefInternal;

  useCoordinatedResize({ canvasRef: activeCanvasRef });

  // FEATURED SECTION: Find featured image by ID
  const featuredImage = useMemo(() => {
    const found = images.find((img) => img.metadata.id === featuredImageId) || null;
    return found;
  }, [images, featuredImageId]);

  // Production Integration: Enhanced capability-based performance system
  const { browserPerf, deviceCapabilities, adaptiveQualityManager } = useMemo(() => {
    // Use new capability system if available, fallback to old system
    let finalConfiguration = configuration;
    let finalCapabilities = capabilities;

    if (capabilitiesReady && capabilities && configuration) {
      // Apply browser-specific optimizations if browser capabilities are available
      // Check if capabilities include browser features (from advanced detection)
      const hasBrowserFeatures = 'browserName' in capabilities;

      if (hasBrowserFeatures) {
        // Cast to any to access browser properties that may be present
        const capabilitiesWithBrowser = capabilities as any;

        const browserCapabilities = {
          // Event handling capabilities
          supportsPassiveEvents: capabilitiesWithBrowser.supportsPassiveEvents || false,
          supportsTouchEvents: capabilities.touchCapable,
          supportsPointerEvents: capabilitiesWithBrowser.supportsPointerEvents || false,
          eventPerformanceScore: capabilitiesWithBrowser.eventPerformanceScore || 75,
          preferredEventStrategy:
            capabilitiesWithBrowser.preferredEventStrategy || ('active' as const),

          // API availability
          supportsIntersectionObserver: capabilities.supportsIntersectionObserver,
          supportsResizeObserver: capabilities.supportsResizeObserver,
          supportsWebWorkers: capabilitiesWithBrowser.supportsWebWorkers || false,
          supportsServiceWorkers: capabilitiesWithBrowser.supportsServiceWorkers || false,
          supportsFileAPI: capabilitiesWithBrowser.supportsFileAPI || false,
          supportsRequestIdleCallback: capabilitiesWithBrowser.supportsRequestIdleCallback || false,
          supportsMemoryAPI: capabilitiesWithBrowser.supportsMemoryAPI || false,

          // Canvas and rendering capabilities
          supportsOffscreenCanvas: capabilities.supportsOffscreenCanvas,
          supportsImageBitmap: capabilitiesWithBrowser.supportsImageBitmap || false,
          supportsWebGLContextRecovery:
            capabilitiesWithBrowser.supportsWebGLContextRecovery || false,
          supportsGPUAcceleration: capabilitiesWithBrowser.supportsGPUAcceleration || true,
          supportsHardwareCompositing: capabilitiesWithBrowser.supportsHardwareCompositing || true,
          canvas2DFeatures: capabilitiesWithBrowser.canvas2DFeatures || [],

          // Performance capabilities
          supportsHighResTimer: capabilitiesWithBrowser.supportsHighResTimer || true,
          jsPerformanceScore: capabilitiesWithBrowser.jsPerformanceScore || 75,

          // Browser identification
          browserName: capabilitiesWithBrowser.browserName || 'Unknown',
          browserVersion: capabilitiesWithBrowser.browserVersion || 'Unknown',
          engineName: capabilitiesWithBrowser.engineName || 'Unknown',
          isMobile: capabilities.touchCapable,
          isSafari: capabilitiesWithBrowser.browserName === 'Safari',
          isChrome: capabilitiesWithBrowser.browserName === 'Chrome',
          isFirefox: capabilitiesWithBrowser.browserName === 'Firefox',
          isEdge: capabilitiesWithBrowser.browserName === 'Edge',

          // Browser-specific quirks
          safariQuirks: capabilitiesWithBrowser.safariQuirks || [],
          mobileQuirks: capabilitiesWithBrowser.mobileQuirks || [],

          // CSS capabilities
          cssFeatures: capabilitiesWithBrowser.cssFeatures || [],
        };

        finalConfiguration = BrowserOptimizations.applyBrowserOptimizations(
          configuration,
          browserCapabilities,
        );
      }

      // Initialize adaptive quality manager for production integration
      const adaptiveManager = new AdaptiveQualityManager(finalConfiguration);

      return {
        browserPerf: {
          // Convert new configuration to old browserPerf interface for compatibility
          frameThrottling: finalConfiguration.targetFrameRate < 45,
          mouseCheckInterval: finalConfiguration.mouseCheckInterval || 32,
          enableImageSmoothing: finalConfiguration.enableImageSmoothing,
          adaptiveRendering: finalConfiguration.mobileOptimized,
          targetFPS: finalConfiguration.targetFrameRate,
          animationDuration: (1000 / finalConfiguration.targetFrameRate) * 30,
          enableComplexDotPattern: finalConfiguration.animationComplexity !== 'low',
          gradientCacheSize: Math.floor(finalConfiguration.canvasMemoryBudgetMB / 10), // 10% of memory budget
          gradientCacheClearInterval: 300000, // 5 minutes
          useLinearEasing: finalConfiguration.mobileOptimized, // Use linear easing on mobile for performance
        },
        deviceCapabilities: {
          // Convert new capabilities to old interface for compatibility
          performanceTier: finalCapabilities?.performanceTier || 'medium',
          touchCapable: finalCapabilities?.touchCapable || false,
          isMobileSafari: (finalCapabilities as any)?.safariMobileOptimizations || false,
          availableMemory: finalCapabilities?.availableMemoryMB || 2048,
          memoryPressure: finalCapabilities?.memoryPressure || 'medium',
          devicePixelRatio:
            finalCapabilities?.devicePixelRatio ||
            (typeof window !== 'undefined' ? window.devicePixelRatio : 1),
          supportsWebGL: finalCapabilities?.supportsWebGL2 || false,
          supportsOffscreenCanvas: finalCapabilities?.supportsOffscreenCanvas || false,
          // GPU properties for adaptive quality manager
          gpuMemoryMB: finalCapabilities?.gpuMemoryMB || 256,
          maxTextureSize: finalCapabilities?.maxTextureSize || 4096,
          supportsWebGL2: finalCapabilities?.supportsWebGL2 || false,
        },
        adaptiveQualityManager: adaptiveManager,
      };
    } else {
      // Enhanced fallback: Use capability detector directly with conservative defaults
      // SSR-safe touch detection
      const isClient = typeof window !== 'undefined';
      const hasTouchSupport = isClient && 'ontouchstart' in window;

      const fallbackConfiguration = {
        targetFrameRate: 45, // Conservative but reasonable default
        enableImageSmoothing: true,
        enableAntialiasing: false, // Conservative for unknown devices
        mobileOptimized: false, // Will be detected properly when capabilities load
        mouseCheckInterval: 32,
        canvasMemoryBudgetMB: 512, // Conservative memory budget
        imageQuality: 0.8,
        animationComplexity: 'medium' as const,
        enableAnimations: true,
        enableViewportCulling: true,
        cullBufferMultiplier: 1.5,
        batchRenderingEnabled: true,
        maxBatchSize: 25,
        touchGestures: hasTouchSupport, // SSR-safe touch detection
        enableGPUAcceleration: true,
        enableOffscreenCanvas: false, // Conservative
        maxTextureSize: 4096,
        detectionMethod: 'fallback' as const,
        generatedAt: Date.now(),
        // Additional required properties
        reducedMotion: false,
        enableMomentumScrolling: hasTouchSupport,
        touchSensitivity: 1.0,
        safariMobileOptimizations: false,
      };

      return {
        browserPerf: {
          frameThrottling: false, // Let adaptive quality manager handle this
          mouseCheckInterval: 32,
          enableImageSmoothing: true,
          adaptiveRendering: hasTouchSupport,
          targetFPS: 45,
          animationDuration: 500,
          enableComplexDotPattern: true,
          gradientCacheSize: 50,
          gradientCacheClearInterval: 300000,
          useLinearEasing: hasTouchSupport,
        },
        deviceCapabilities: {
          performanceTier: 'medium' as const,
          touchCapable: hasTouchSupport,
          isMobileSafari: false,
          availableMemory: 2048,
          memoryPressure: 'medium' as const,
          devicePixelRatio: isClient ? window.devicePixelRatio || 1 : 1,
          supportsWebGL: isClient ? !!window.WebGLRenderingContext : false,
          supportsOffscreenCanvas: isClient ? 'OffscreenCanvas' in window : false,
          gpuMemoryMB: 256, // Conservative fallback
          maxTextureSize: 4096,
          supportsWebGL2: isClient ? !!window.WebGL2RenderingContext : false,
        },
        adaptiveQualityManager: new AdaptiveQualityManager(fallbackConfiguration),
      };
    }
  }, [capabilitiesReady, capabilities, configuration]);

  // Phase 2 Step 2: Remove individual animation frame management
  // const animationFrameRef = useRef<number | null>(null); // Replaced by centralized manager
  const [hoveredTokenIndex, setHoveredTokenIndex] = useState<number | null>(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const logoImageRef = useRef<HTMLImageElement | null>(null);
  const submitAssetImageRef = useRef<HTMLImageElement | null>(null);
  const lastFrameTime = useRef<number>(performance.now());

  // Canvas loading progress tracking
  const [canvasProgress, setCanvasProgress] = useState(0);
  const [canvasReady, setCanvasReady] = useState(false);

  // Phase 1: Animation timing extracted to dedicated hook

  // Issue #1: Safari RAF Throttling Detection State
  const [isThrottled, setIsThrottled] = useState(false);

  // Universal RAF throttling detection for all platforms
  useEffect(() => {
    detectLowPowerMode().then(setIsThrottled);
  }, []);

  // MOMENTUM RESTORATION: Simplified momentum state management
  const momentumState = useRef<{
    velocity: { x: number; y: number };
    lastUpdate: number;
    active: boolean;
  } | null>(null);

  // MOMENTUM RESTORATION: Add momentum handler for canvas RAF integration
  const handleMomentumUpdate = useCallback(
    (momentum: { velocity: { x: number; y: number }; active: boolean }) => {
      if (momentum.active) {
        momentumState.current = {
          velocity: { ...momentum.velocity },
          lastUpdate: performance.now(),
          active: true,
        };
      } else {
        momentumState.current = null;
      }
    },
    [],
  );

  // MOMENTUM RESTORATION: Universal momentum physics (Galaxy S9 approach)
  const updateMomentum = useCallback(
    (currentTime: number) => {
      if (!momentumState.current) return;

      const deltaTime = currentTime - momentumState.current.lastUpdate;

      // Universal timing: 16ms minimum for all platforms (Galaxy S9 approach)
      if (deltaTime >= 16) {
        // Apply momentum physics consistently across all platforms
        const friction = TOUCH_SETTINGS.momentumFriction;
        const normalizedDelta = deltaTime / 16; // Normalize to 16ms for physics consistency
        const frameDecay = Math.pow(friction, normalizedDelta);

        momentumState.current.velocity.x *= frameDecay;
        momentumState.current.velocity.y *= frameDecay;

        // Universal movement application (Galaxy S9 approach)
        updateViewState?.(
          momentumState.current.velocity.x * normalizedDelta,
          momentumState.current.velocity.y * normalizedDelta,
        );

        momentumState.current.lastUpdate = currentTime;

        // Stop when velocity is too small
        if (
          Math.abs(momentumState.current.velocity.x) < TOUCH_SETTINGS.minVelocity &&
          Math.abs(momentumState.current.velocity.y) < TOUCH_SETTINGS.minVelocity
        ) {
          momentumState.current = null;
        }
      }
    },
    [updateViewState],
  );

  const hoverAnimationDuration = browserPerf.animationDuration; // Centralized animation duration

  const [hoveredRepeatedToken, setHoveredRepeatedToken] = useState<{
    worldX: number;
    worldY: number;
    tileId: string;
  } | null>(null);

  // Auction icon hover state
  const [isHoveringAuctionIcon, setIsHoveringAuctionIcon] = useState(false);
  const auctionIconHoverRef = useRef(0); // Hover progress for auction icon

  // Animation durations now handled by entrance animation hook and browserPerf settings

  const frameThrottleRef = useRef(0);
  const targetFPS = browserPerf.targetFPS; // Centralized FPS setting
  const frameInterval = 1000 / targetFPS;

  // Space animation removed for performance optimization

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

  // Phase 1: Initialize extracted animation timing hook
  const animationTiming = useCanvasAnimationTiming({
    hoverAnimationDuration: browserPerf.animationDuration,
    useLinearEasing: browserPerf.useLinearEasing,
  });

  // Extract animation state and actions for backward compatibility
  const {
    currentHoverProgress,
    isHoveringToken,
    isProductAnimationActive,
    updateHoverState,
    updateHoverAnimationProgress,
    startProductAnimation,
    stopProductAnimation,
  } = animationTiming;

  // Phase 1: SAFE - Entrance animation hook called at top level (follows Rules of Hooks)
  const entranceAnimationHook = useCanvasEntranceAnimation({
    productPlacements: stableProductPlacements.current,
    tokenPositions: stableCreateTokenPositions.current,
    // UPDATED: Featured section position now comes from the middle of home area
    featuredSectionPosition: (() => {
      const homeAreaWorldX = -unitSize;
      const homeAreaWorldY = -unitSize;
      const homeAreaWidth = unitSize * 2;
      const homeAreaHeight = unitSize;

      // Get the featured section bounds from the new home area layout
      return getFeaturedSectionBounds(
        homeAreaWorldX,
        homeAreaWorldY,
        homeAreaWidth,
        homeAreaHeight,
      );
    })(),
    shouldAnimate: canvasVisible && canvasReady && imagesLoaded && placementsCalculated,
    unitSize,
    viewState,
    canvasWidth: activeCanvasRef.current?.width,
    canvasHeight: activeCanvasRef.current?.height,
  });

  const entranceAnimationStatusRef = useRef({ isAnimationActive: false, animationProgress: 0 });

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

  // Universal mobile frame management (Galaxy S9 approach)
  const shouldThrottleFrame = useCallback(
    (currentTime: number): boolean => {
      if (!browserPerf.adaptiveRendering) return false;

      const mobile = mobilePerformanceRef.current;
      const frameTime = currentTime - mobile.lastFrameTime;

      // Only throttle genuinely low-performance mobile devices
      const shouldThrottle = deviceCapabilities.performanceTier === 'low';
      if (!shouldThrottle) return false;

      // Simple throttling: limit to 30fps only on low-end devices
      const minFrameTime = 33; // 30fps = 33ms between frames

      if (frameTime < minFrameTime) {
        return true; // Throttle, but don't affect quality
      }

      mobile.lastFrameTime = currentTime;
      return false;
    },
    [browserPerf.adaptiveRendering, deviceCapabilities.performanceTier],
  );

  // Phase 2: Background tile processing - EXTRACTED expensive tile generation
  const backgroundTileProcessor = useBackgroundTileProcessor({
    images,
    unitSize,
    stableProductPlacements: stableProductPlacements.current,
    stableCreateTokenPositions: stableCreateTokenPositions.current,
    originalGridBounds: originalGridBounds.current,
  });

  // Step 5: Grid-based viewport culling for 94% performance improvement
  // Use larger cell size for better scroll performance (trade memory for speed)
  const productCuller = useRef(new ViewportCuller<AnimatedProductElement>(unitSize * 2, 'world'));
  const repeatedProductCuller = useRef(
    new ViewportCuller<RepeatedPlacement>(unitSize * 2, 'world'),
  );
  const tokenCuller = useRef(new ViewportCuller<AnimatedTokenElement>(unitSize * 2, 'world'));
  const repeatedTokenCuller = useRef(
    new ViewportCuller<RepeatedTokenPosition>(unitSize * 2, 'world'),
  );

  // Scroll detection for viewport culler optimization
  const lastViewportUpdate = useRef({ x: 0, y: 0, scale: 1, time: 0 });
  const isScrolling = useRef(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  // Preload the logo images
  useEffect(() => {
    const logoImage = new Image();
    logoImage.src = '/aces-logo.png';
    logoImage.onload = () => {
      logoImageRef.current = logoImage;
    };

    const websiteLogo = new Image();
    websiteLogo.src = '/png/new-aces-header.png';
    websiteLogo.onload = () => {
      websiteLogoRef.current = websiteLogo;
    };
  }, []);

  const websiteLogoRef = useRef<HTMLImageElement | null>(null);

  // Find and store the submit asset image
  useEffect(() => {
    if (images && images.length > 0) {
      const submitAssetImage = images.find((img) => img.metadata.id === 'submit-asset');
      if (submitAssetImage) {
        submitAssetImageRef.current = submitAssetImage.element;
      }
    }
  }, [images]);

  // Space canvas initialization removed for performance optimization

  // Space animation completely removed for performance optimization

  const calculateRequiredTiles = useCallback((currentViewState: ViewState): GridTile[] => {
    if (!originalGridBounds.current) {
      return [];
    }

    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
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
      const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
      const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
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

    // Define the proper 2×3 layout structure for placement calculations
    // Total height = 3 units: Logo(0.6) + Featured(2.1) + Buttons(0.3) = 3.0

    // Buttons area (2×0.3) at the bottom - 10%
    const homeAreaWorldX = -unitSize;
    const homeAreaWorldY = -unitSize * 0.3; // 0.3 units above center
    const homeAreaWidth = unitSize * 2;
    const homeAreaHeight = unitSize * 0.3; // 10% height

    // Logo banner area (2×0.6) at the top - 20%
    const logoAreaWorldX = -unitSize;
    const logoAreaWorldY = -unitSize * 3; // 3 units above center (top)
    const logoAreaWidth = unitSize * 2;
    const logoAreaHeight = unitSize * 0.6; // 20% height

    // Featured section area (2×2.1) in the middle - 70%
    const featuredAreaWorldX = -unitSize;
    const featuredAreaWorldY = -unitSize * 2.4; // Between logo and buttons (3 - 0.6 = 2.4 from center)
    const featuredAreaWidth = unitSize * 2;
    const featuredAreaHeight = unitSize * 2.1; // 70% height

    // FEATURED SECTION: Combined reserved area is now 2×3 (logo 0.6 + featured 2.1 + home 0.3)
    const totalReservedAreaWorldX = -unitSize;
    const totalReservedAreaWorldY = -unitSize * 3; // Top of logo area
    const totalReservedAreaWidth = unitSize * 2;
    const totalReservedAreaHeight = unitSize * 3; // Logo (0.6) + Featured (2.1) + Home (0.3)

    const occupiedSpaces = new Set<string>();

    // Mark all cells in the reserved 2×3 area as occupied
    for (let i = 0; i < 2; i++) {
      // 2 units wide
      for (let j = 0; j < 3; j++) {
        // 3 units tall (logo 0.75 + featured 1.95 + home 0.3)
        const cellX = Math.floor((totalReservedAreaWorldX + i * unitSize) / unitSize);
        const cellY = Math.floor((totalReservedAreaWorldY + j * unitSize) / unitSize);
        occupiedSpaces.add(`${cellX},${cellY}`);
      }
    }

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
    // occupiedSpaces already declared above, reuse it
    occupiedSpaces.clear();
    const productPlacements: Array<{
      image: ImageInfo;
      x: number;
      y: number;
      width: number;
      height: number;
      index: number;
    }> = [];
    const createTokenPositions: Array<{ worldX: number; worldY: number }> = [];

    // FEATURED SECTION: Mark entire reserved area (2×3) as occupied
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 3; j++) {
        const cellX = Math.floor((totalReservedAreaWorldX + i * unitSize) / unitSize);
        const cellY = Math.floor((totalReservedAreaWorldY + j * unitSize) / unitSize);
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
          totalReservedAreaWorldX, // FEATURED SECTION: Use total reserved area
          totalReservedAreaWorldY,
          totalReservedAreaWidth,
          totalReservedAreaHeight,
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
              totalReservedAreaWorldX, // FEATURED SECTION: Use total reserved area
              totalReservedAreaWorldY,
              totalReservedAreaWidth,
              totalReservedAreaHeight,
            )
          ) {
            const placedItem = { image: imageInfo, x, y, width, height };
            imagePlacementMap.current.set(`${gridX},${gridY}`, placedItem);

            if (imageInfo.type === 'submit-asset') {
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
      // Animation state now managed by extracted hook
      // setIsProductAnimationActive(false); // Commented out - not needed
    }
  }, [imagesLoaded, placementsCalculated, canvasVisible]);

  // HOVER ENHANCEMENT: Product image hover detection function
  const handleProductImageHoverDetection = useCallback(
    (clientX: number, clientY: number) => {
      if (!activeCanvasRef.current || !hoveredProductImageRef) return;

      // Convert mouse coordinates to world coordinates
      const canvas = activeCanvasRef.current;
      const rectResult = safeGetBoundingClientRect(canvas);
      if (!rectResult.success || !rectResult.data) return;

      const rect = rectResult.data;
      const worldX = (clientX - rect.left - viewState.x) / viewState.scale;
      const worldY = (clientY - rect.top - viewState.y) / viewState.scale;

      let hoveredImage: {
        image: ImageInfo;
        x: number;
        y: number;
        width: number;
        height: number;
        isRepeated?: boolean;
        tileId?: string;
      } | null = null;

      // Check original placements first
      for (const placedItem of imagePlacementMap.current?.values() || []) {
        if (!placedItem?.image) continue;
        const { image, x, y, width, height } = placedItem;

        // Skip submit-asset images (they already have their own hover system)
        if (image.type === 'submit-asset') continue;

        if (worldX >= x && worldX <= x + width && worldY >= y && worldY <= y + height) {
          hoveredImage = { image, x, y, width, height, isRepeated: false };
          break;
        }
      }

      // Check repeated placements if no original placement found
      if (!hoveredImage && repeatedPlacements.current) {
        for (const tilePlacements of repeatedPlacements.current.values()) {
          for (const placement of tilePlacements) {
            // Skip submit-asset images (they already have their own hover system)
            if (placement.image.type === 'submit-asset') continue;

            if (
              worldX >= placement.x &&
              worldX <= placement.x + placement.width &&
              worldY >= placement.y &&
              worldY <= placement.y + placement.height
            ) {
              hoveredImage = {
                image: placement.image,
                x: placement.x,
                y: placement.y,
                width: placement.width,
                height: placement.height,
                isRepeated: true,
                tileId: placement.tileId,
              };
              break;
            }
          }
          if (hoveredImage) break;
        }
      }

      // Update hover state if changed
      const currentHover = hoveredProductImageRef.current;
      const hasChanged =
        (!currentHover && hoveredImage) ||
        (currentHover && !hoveredImage) ||
        (currentHover &&
          hoveredImage &&
          (currentHover.image.metadata.id !== hoveredImage.image.metadata.id ||
            currentHover.x !== hoveredImage.x ||
            currentHover.y !== hoveredImage.y));

      if (hasChanged) {
        hoveredProductImageRef.current = hoveredImage;
      }
    },
    [activeCanvasRef, hoveredProductImageRef, viewState, imagePlacementMap, repeatedPlacements],
  );

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

      // HOVER ENHANCEMENT: Add product image hover detection
      if (hoveredProductImageRef) {
        handleProductImageHoverDetection(mouseEvent.clientX, mouseEvent.clientY);
      }
    };

    // Removed canvas renderer click handler - all clicks now handled by useCanvasInteractions

    // Phase 2 Step 3 Action 5: Enhanced error handling for canvas mouse events
    const mouseMoveResult = addEventListenerSafe(currentCanvas, 'mousemove', handleMouseMove);
    // Removed click listener - all clicks now handled by useCanvasInteractions

    if (!mouseMoveResult.success) {
      // Canvas will still work, just without hover effects
    } else if (mouseMoveResult.fallbackApplied) {
      // Canvas will still work, just without hover effects
    }

    return () => {
      // Phase 2 Step 3 Action 5: Enhanced cleanup with error reporting
      if (mouseMoveResult.success && currentCanvas) {
        const removeResult = removeEventListenerSafe(currentCanvas, 'mousemove', handleMouseMove);
        if (!removeResult.success) {
          // Canvas will still work, just without hover effects
        }
      }
      // Removed click listener cleanup - all clicks now handled by useCanvasInteractions
    };
  }, [
    hoveredTokenIndex,
    onCreateTokenClick,
    viewState,
    unitSize,
    activeCanvasRef,
    featuredImage,
    onFeaturedImageClick,
    handleProductImageHoverDetection, // HOVER ENHANCEMENT: Added hover detection function dependency
  ]); // FEATURED SECTION: Added dependencies

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

    // Issue #4: Image smoothing now handled centrally in draw function with device detection
    // No need to set imageSmoothingEnabled during initialization

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

    // Define the proper 2×3 layout structure with correct proportions
    // Total height = 3 units: Logo(0.75) + Featured(1.95) + Buttons(0.3) = 3.0

    // Buttons area (2×0.3) at the bottom - 10%
    const homeAreaWorldX = -unitSize;
    const homeAreaWorldY = -unitSize * 0.3; // 0.3 units above center
    const homeAreaWidth = unitSize * 2;
    const homeAreaHeight = unitSize * 0.3; // 10% height

    // Logo banner area (2×0.75) at the top - 25%
    const logoAreaWorldX = -unitSize;
    const logoAreaWorldY = -unitSize * 3; // 3 units above center (top)
    const logoAreaWidth = unitSize * 2;
    const logoAreaHeight = unitSize * 0.75; // 25% height

    // Featured section area (2×1.95) in the middle - 65%
    const featuredAreaWorldX = -unitSize;
    const featuredAreaWorldY = -unitSize * 2.25; // Between logo and buttons
    const featuredAreaWidth = unitSize * 2;
    const featuredAreaHeight = unitSize * 1.95; // 65% height

    const draw = (currentTime: number) => {
      // Step 0: Start performance monitoring for this frame
      performanceMonitor.startFrame();

      // MOMENTUM RESTORATION: Simple momentum physics integrated into main RAF loop
      updateMomentum(currentTime);

      const canvas = activeCanvasRef.current;
      if (!canvas) return;

      // Phase 2 Step 9: Safe canvas context creation with browser variation handling
      const contextResult = safeGetCanvasContext(canvas, '2d');
      if (!contextResult.success) {
        return;
      }
      const ctx = contextResult.data as CanvasRenderingContext2D;
      if (!ctx) return;

      // SAFE: Calculate entrance animation using calculator function (no hook violation)
      const entranceAnimation = entranceAnimationHook.calculateAnimatedElements(currentTime);

      // Update animation status ref for use outside draw function
      entranceAnimationStatusRef.current = {
        isAnimationActive: entranceAnimation.isAnimationActive,
        animationProgress: entranceAnimation.animationProgress,
      };

      // Add UI opacity calculation for fade-in effect
      const uiOpacity = entranceAnimation.isAnimationActive
        ? entranceAnimation.animationProgress
        : 1;

      // Step 4: Pre-calculate transform once per frame instead of per element (91% faster)
      const viewTransform = createViewTransform(viewState);

      // Safari optimization: Detect Safari once for viewport culling
      const isSafari =
        typeof navigator !== 'undefined' &&
        navigator.userAgent.includes('Safari') &&
        !navigator.userAgent.includes('Chrome');

      // Mobile device detection for auction icon
      const isMobileDevice = deviceCapabilities.touchCapable || deviceCapabilities.isMobileSafari;

      // Phase 3.1: Check if we should use dirty region optimization
      const shouldUseDirtyRegions = dirtyRegionManager.current.regions.length > 0;

      // FIXED: Skip frame throttling during entrance animation for smooth 60fps
      const shouldSkipThrottling = entranceAnimation.isAnimationActive;

      // Phase 2 Step 7 Action 3: Mobile frame skip optimization (skip during entrance)
      if (!shouldSkipThrottling && shouldThrottleFrame(currentTime)) {
        return;
      }

      if (!shouldSkipThrottling && browserPerf.frameThrottling) {
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

      // Issue #4 FIX: Use memoized device capabilities instead of expensive call every frame
      let shouldUseImageSmoothing: boolean;

      // Issue #1: RAF throttling takes priority (disable smoothing when throttled)
      if (isThrottled && browserPerf.targetFPS > 30) {
        shouldUseImageSmoothing = false;
      } else {
        // Issue #4: Device-specific image smoothing logic (using memoized capabilities)
        if (deviceCapabilities.isMobileSafari) {
          // Mobile Safari: only enable on high performance tier and not throttled
          shouldUseImageSmoothing = deviceCapabilities.performanceTier === 'high' && !isThrottled;
        } else {
          // Other devices: use browser performance settings
          shouldUseImageSmoothing = browserPerf.enableImageSmoothing && !isThrottled;
        }
      }

      // Apply image smoothing only if it actually changed (prevents shader recompilation)
      if (ctx.imageSmoothingEnabled !== shouldUseImageSmoothing) {
        ctx.imageSmoothingEnabled = shouldUseImageSmoothing;
      }

      const targetGlobalAlpha = 1.0; // Keep at full opacity for smooth animation

      // Only update globalAlpha if it actually changed (with small tolerance for floating point)
      if (!isApproximatelyEqual(ctx.globalAlpha, targetGlobalAlpha)) {
        ctx.globalAlpha = targetGlobalAlpha;
      }

      // Step 4 Option A: Complete coordinate system replacement - no canvas context transforms
      // All drawing functions now use pre-calculated screen coordinates for 91% performance improvement

      // Use STABLE placements - no recalculation!
      const productPlacements = stableProductPlacements.current;
      const createTokenPositions = stableCreateTokenPositions.current;

      // Phase 1: Use extracted animation timing hook for hover animation updates
      updateHoverAnimationProgress(currentTime);

      // Check if any animations are active
      const hasActiveAnimations = entranceAnimation.isAnimationActive || currentHoverProgress > 0;
      const animationProgress = entranceAnimation.animationProgress;

      // Phase 1: Use extracted animation timing hook for product animation lifecycle
      if (
        isProductAnimationActive &&
        !entranceAnimation.isAnimationActive &&
        animationProgress >= 1
      ) {
        stopProductAnimation();
      }

      // Step 0: Track rendered elements for performance monitoring
      let totalElementsRendered = 0;

      // Step 5: Scroll-aware viewport optimization to prevent scroll stuttering
      const frameTime = performance.now();
      const worldViewport = createWorldViewportBounds(viewState, canvas.width, canvas.height);

      // Detect scroll state for performance optimization
      const lastUpdate = lastViewportUpdate.current;
      const deltaX = Math.abs(viewState.x - lastUpdate.x);
      const deltaY = Math.abs(viewState.y - lastUpdate.y);
      const deltaScale = Math.abs(viewState.scale - lastUpdate.scale);
      const timeDelta = frameTime - lastUpdate.time;

      // Consider scrolling if significant movement in short time
      const isCurrentlyScrolling =
        (deltaX > 10 || deltaY > 10 || deltaScale > 0.01) && timeDelta < 100;

      if (isCurrentlyScrolling !== isScrolling.current) {
        isScrolling.current = isCurrentlyScrolling;

        // Clear existing timeout
        if (scrollTimeout.current) {
          clearTimeout(scrollTimeout.current);
        }

        // Set timeout to detect end of scrolling
        if (isCurrentlyScrolling) {
          scrollTimeout.current = setTimeout(() => {
            isScrolling.current = false;
          }, 150); // Stop considering as scrolling after 150ms
        }
      }

      // BUG FIX: Skip viewport culling during entrance animation to prevent black images
      // PERFORMANCE FIX: Optimize grid updates during scroll
      let visibleAnimatedProducts = entranceAnimation.animatedProductPlacements;

      if (!entranceAnimation.isAnimationActive) {
        // Only update grid when not scrolling or when viewport changed significantly
        const shouldUpdateGrid =
          !isScrolling.current ||
          deltaX > unitSize ||
          deltaY > unitSize ||
          deltaScale > 0.1 ||
          timeDelta > 500; // Force update every 500ms

        if (shouldUpdateGrid) {
          // Step 5: Grid-based viewport culling (94% improvement for post-animation)
          productCuller.current.updateElements(entranceAnimation.animatedProductPlacements);
          lastViewportUpdate.current = {
            x: viewState.x,
            y: viewState.y,
            scale: viewState.scale,
            time: frameTime,
          };
        }

        // Always get visible elements (uses cached grid if not updated)
        visibleAnimatedProducts = productCuller.current.getVisibleElements(
          worldViewport,
          unitSize * 3, // Larger buffer during scroll for smoother experience
        );
      }

      // Step 4: Batch transform only visible elements to screen coordinates (combined 95% improvement)
      const transformedProducts = batchTransformElements(visibleAnimatedProducts, viewTransform);

      // Issue #3: Batch render products by opacity to reduce save/restore calls
      const imageRenderBatch = transformedProducts.map((element) => {
        // HOVER ENHANCEMENT: Calculate hover progress for this image
        let hoverProgress = 0;
        const hoveredProductImage = hoveredProductImageRef?.current;
        if (
          hoveredProductImage &&
          hoveredProductImage.image.metadata.id === element.original.image.metadata.id &&
          !hoveredProductImage.isRepeated &&
          Math.abs(hoveredProductImage.x - element.original.x) < 1 &&
          Math.abs(hoveredProductImage.y - element.original.y) < 1
        ) {
          hoverProgress = 1; // Full hover effect for exact match
        }

        return {
          opacity: element.opacity,
          render: () => {
            drawImageWithoutContext(
              ctx,
              element.original.image.element,
              element.screenX,
              element.screenY,
              element.width,
              element.height,
              hoverProgress, // HOVER ENHANCEMENT: Pass hover progress
            );
          },
        };
      });

      // Use optimized batch renderer during entrance animations
      if (entranceAnimation.isAnimationActive) {
        batchRenderAnimated(ctx, imageRenderBatch, entranceAnimation.animationProgress);
      } else {
        batchRenderByOpacity(ctx, imageRenderBatch);
      }
      totalElementsRendered += transformedProducts.length;

      // Draw repeated grid products using grid-based viewport culling
      if (placementsCalculated && originalGridBounds.current) {
        // Convert all repeated placements to array for culling
        const allRepeatedPlacements: RepeatedPlacement[] = [];
        repeatedPlacements.current.forEach((tilePlacements, tileId) => {
          allRepeatedPlacements.push(...tilePlacements);
        });

        // BUG FIX: Skip viewport culling during entrance animation for repeated elements too
        // PERFORMANCE FIX: Optimize repeated elements during scroll
        let visibleRepeatedPlacements = allRepeatedPlacements;

        if (!entranceAnimation.isAnimationActive) {
          // Only update repeated grid when not scrolling or when viewport changed significantly
          const shouldUpdateRepeatedGrid =
            !isScrolling.current ||
            deltaX > unitSize ||
            deltaY > unitSize ||
            deltaScale > 0.1 ||
            timeDelta > 500;

          if (shouldUpdateRepeatedGrid) {
            // Step 5: Grid-based viewport culling for repeated elements (94% improvement)
            repeatedProductCuller.current.updateElements(allRepeatedPlacements);
          }

          // Always get visible elements (uses cached grid if not updated)
          visibleRepeatedPlacements = repeatedProductCuller.current.getVisibleElements(
            worldViewport,
            unitSize * 3, // Larger buffer during scroll
          );
        }

        // Batch transform only visible repeated placements to screen coordinates
        const transformedRepeatedProducts = batchTransformElements(
          visibleRepeatedPlacements,
          viewTransform,
        );

        // Issue #3: Batch render repeated products with single opacity (all fully visible)
        const repeatedImageRenderBatch = transformedRepeatedProducts.map((element) => {
          // HOVER ENHANCEMENT: Calculate hover progress for repeated images
          let hoverProgress = 0;
          const hoveredProductImage = hoveredProductImageRef?.current;
          if (
            hoveredProductImage &&
            hoveredProductImage.image.metadata.id === element.original.image.metadata.id &&
            hoveredProductImage.isRepeated &&
            Math.abs(hoveredProductImage.x - element.original.x) < 1 &&
            Math.abs(hoveredProductImage.y - element.original.y) < 1
          ) {
            hoverProgress = 1; // Full hover effect for exact match
          }

          return {
            opacity: 1, // Always fully visible
            render: () => {
              drawImageWithoutContext(
                ctx,
                element.original.image.element,
                element.screenX,
                element.screenY,
                element.width,
                element.height,
                hoverProgress, // HOVER ENHANCEMENT: Pass hover progress
              );
            },
          };
        });

        batchRenderByOpacity(ctx, repeatedImageRenderBatch);
        totalElementsRendered += transformedRepeatedProducts.length;
      }

      // Phase 2 Step 7 Action 3: Mobile-optimized mouse hit detection using screen coordinates
      let newHoveredIndex: number | null = null;
      if (currentTime - lastMouseCheck.current > mouseCheckInterval) {
        const screenMouseX = mousePositionRef.current.x;
        const screenMouseY = mousePositionRef.current.y;

        // Transform create token positions to screen coordinates for hit detection
        const transformedTokens = batchTransformElements(
          createTokenPositions.map((pos) => ({
            x: pos.worldX,
            y: pos.worldY,
            width: unitSize,
            height: unitSize,
            opacity: 1,
            original: pos,
          })),
          viewTransform,
        );

        // Check original create token positions first (these get hover effects)
        transformedTokens.forEach((tokenElement, index) => {
          if (
            screenMouseX >= tokenElement.screenX &&
            screenMouseX <= tokenElement.screenX + tokenElement.width &&
            screenMouseY >= tokenElement.screenY &&
            screenMouseY <= tokenElement.screenY + tokenElement.height
          ) {
            newHoveredIndex = index;
            canvas.style.cursor = 'pointer';
          }
        });

        // HOVER ENHANCEMENT: Check repeated create token positions (now with hover effects!)
        let newHoveredRepeatedToken: RepeatedTokenPosition | null = null;
        if (newHoveredIndex === null) {
          // Convert repeated tokens to screen coordinates for hit detection
          const allRepeatedTokens: RepeatedTokenPosition[] = [];
          repeatedTokens.current.forEach((tileTokens) => {
            allRepeatedTokens.push(...tileTokens);
          });

          const transformedRepeatedTokens = batchTransformElements(
            allRepeatedTokens.map((token) => ({
              x: token.worldX,
              y: token.worldY,
              width: unitSize,
              height: unitSize,
              opacity: 1,
              worldX: token.worldX, // Add required properties
              worldY: token.worldY,
              tileId: token.tileId,
              original: token,
            })),
            viewTransform,
          );

          // Only check repeated tokens if not hovering over original tokens
          transformedRepeatedTokens.forEach((tokenElement) => {
            if (
              screenMouseX >= tokenElement.screenX &&
              screenMouseX <= tokenElement.screenX + tokenElement.width &&
              screenMouseY >= tokenElement.screenY &&
              screenMouseY <= tokenElement.screenY + tokenElement.height
            ) {
              newHoveredRepeatedToken = tokenElement.original;
              canvas.style.cursor = 'pointer';
            }
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

          setHoveredRepeatedToken(newHoveredRepeatedToken);

          // PERFORMANCE OPTIMIZATION: Reuse existing hover animation system
          // If we're switching from original to repeated token (or vice versa),
          // restart the animation to ensure smooth transition
          if (newHoveredRepeatedToken || hoveredRepeatedToken) {
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
          updateHoverState(newHoveredIndex !== null, currentTime);
        }

        lastMouseCheck.current = currentTime;
      }
      // Phase 1: Hover animation now handled inline
      // (Hover progress calculations simplified and moved inline)

      // Draw original create token squares using screen coordinates
      const transformedAnimatedTokens = batchTransformElements(
        entranceAnimation.animatedTokenPositions.map((token) => ({
          ...token,
          width: unitSize,
          height: unitSize,
        })),
        viewTransform,
      );

      transformedAnimatedTokens.forEach((tokenElement, index: number) => {
        const isCurrentlyHovered = index === hoveredTokenIndex;
        const actualHoverProgress = isCurrentlyHovered ? currentHoverProgress : 0;

        if (tokenElement.opacity > 0) {
          ctx.save();
          ctx.globalAlpha = tokenElement.opacity;

          // Apply scale transform at screen coordinates
          const centerX = tokenElement.screenX + tokenElement.width / 2;
          const centerY = tokenElement.screenY + tokenElement.height / 2;
          ctx.translate(centerX, centerY);
          ctx.scale(tokenElement.original.animatedScale, tokenElement.original.animatedScale);
          ctx.translate(-centerX, -centerY);

          // Draw submit asset image instead of token square
          if (submitAssetImageRef.current) {
            drawImage(
              ctx,
              submitAssetImageRef.current,
              tokenElement.screenX,
              tokenElement.screenY,
              unitSize,
              unitSize,
              1.0, // Full opacity
              actualHoverProgress, // Hover progress for border effects
            );
          }
          ctx.restore();
          totalElementsRendered++;
        }
      });

      // Draw repeated create token squares using screen coordinates
      if (placementsCalculated) {
        // Convert all repeated tokens to screen coordinates
        const allRepeatedTokensForRendering: RepeatedTokenPosition[] = [];
        repeatedTokens.current.forEach((tileTokens) => {
          allRepeatedTokensForRendering.push(...tileTokens);
        });

        // Batch transform repeated tokens to screen coordinates
        const transformedRepeatedTokens = batchTransformElements(
          allRepeatedTokensForRendering.map((token) => ({
            x: token.worldX,
            y: token.worldY,
            width: unitSize,
            height: unitSize,
            opacity: 1,
            worldX: token.worldX,
            worldY: token.worldY,
            tileId: token.tileId,
            original: token,
          })),
          viewTransform,
        );

        // Fast viewport culling for repeated tokens
        const visibleRepeatedTokens = transformedRepeatedTokens.filter(
          (tokenElement) =>
            tokenElement.screenX + tokenElement.width > 0 &&
            tokenElement.screenX < canvas.width &&
            tokenElement.screenY + tokenElement.height > 0 &&
            tokenElement.screenY < canvas.height,
        );

        // Draw repeated tokens using screen coordinates
        visibleRepeatedTokens.forEach((tokenElement) => {
          ctx.save();
          ctx.globalAlpha = 1; // Always fully visible

          // HOVER ENHANCEMENT: Check if this repeated token is currently hovered
          const isCurrentlyHoveredRepeated =
            hoveredRepeatedToken &&
            hoveredRepeatedToken.worldX === tokenElement.original.worldX &&
            hoveredRepeatedToken.worldY === tokenElement.original.worldY;
          const actualHoverProgress = isCurrentlyHoveredRepeated ? currentHoverProgress : 0;

          // Draw submit asset image instead of token square
          if (submitAssetImageRef.current) {
            drawImage(
              ctx,
              submitAssetImageRef.current,
              tokenElement.screenX,
              tokenElement.screenY,
              unitSize,
              unitSize,
              1.0, // Full opacity
              actualHoverProgress, // Hover progress for border effects
            );
          }
          ctx.restore();
          totalElementsRendered++;
        });
      }

      // LOGO BANNER: Draw logo banner area (2×1) at the top
      const logoAreaScreenPos = worldToScreen(logoAreaWorldX, logoAreaWorldY, viewTransform);
      const logoAreaScreenWidth = (logoAreaWidth * viewTransform.scaleX) | 0;
      const logoAreaScreenHeight = (logoAreaHeight * viewTransform.scaleY) | 0;

      // Draw custom logo banner with proper fonts (NO GREEN BORDER)
      drawCustomLogoBanner(
        ctx,
        logoAreaScreenPos.x,
        logoAreaScreenPos.y,
        logoAreaScreenWidth,
        logoAreaScreenHeight,
        unitSize,
        uiOpacity, // Add opacity parameter
        capabilities!, // Add capabilities parameter
      );
      totalElementsRendered++;
      // FEATURED SECTION: Draw featured section using screen coordinates with entrance animation
      const featuredAreaScreenPos = worldToScreen(
        featuredAreaWorldX,
        featuredAreaWorldY,
        viewTransform,
      );
      const featuredAreaScreenWidth = (featuredAreaWidth * viewTransform.scaleX) | 0;
      const featuredAreaScreenHeight = (featuredAreaHeight * viewTransform.scaleY) | 0;

      // Auction icon hover detection - separate check after featuredAreaScreenPos is available
      if (featuredImage) {
        const screenMouseX = mousePositionRef.current.x;
        const screenMouseY = mousePositionRef.current.y;

        const responsiveMetrics = getResponsiveMetrics(unitSize, capabilities!);

        const iconBounds = getAuctionIconBounds(
          featuredAreaScreenPos.x,
          featuredAreaScreenPos.y,
          featuredAreaScreenWidth,
          featuredAreaScreenHeight,
          responsiveMetrics,
        );

        const isHoveringAuction =
          screenMouseX >= iconBounds.x &&
          screenMouseX <= iconBounds.x + iconBounds.width &&
          screenMouseY >= iconBounds.y &&
          screenMouseY <= iconBounds.y + iconBounds.height;

        // Update auction icon hover state
        if (isHoveringAuction !== isHoveringAuctionIcon) {
          setIsHoveringAuctionIcon(isHoveringAuction);
          if (isHoveringAuction) {
            canvas.style.cursor = 'pointer';
          }
        }

        // Update auction icon hover animation progress
        if (isHoveringAuctionIcon) {
          auctionIconHoverRef.current = Math.min(1, auctionIconHoverRef.current + 0.1);
        } else {
          auctionIconHoverRef.current = Math.max(0, auctionIconHoverRef.current - 0.1);
        }
      }

      // DEBUG: Uncomment for coordinate debugging
      // console.log('Featured Section Drawing Debug:', {
      //   worldCoords: { x: featuredAreaWorldX, y: featuredAreaWorldY, w: featuredAreaWidth, h: featuredAreaHeight },
      //   screenCoords: { x: featuredAreaScreenPos.x, y: featuredAreaScreenPos.y, w: featuredAreaScreenWidth, h: featuredAreaScreenHeight },
      //   viewTransform: { scaleX: viewTransform.scaleX, scaleY: viewTransform.scaleY },
      //   canvasSize: { w: canvas.width, h: canvas.height },
      //   featuredImage: !!featuredImage,
      //   featuredImageComplete: featuredImage?.element?.complete,
      // });

      // Replace the entire featured section animation block with:
      drawFeaturedSection(
        ctx,
        featuredAreaScreenPos.x,
        featuredAreaScreenPos.y,
        featuredAreaScreenWidth,
        featuredAreaScreenHeight,
        featuredImage,
        mousePositionRef.current.x,
        mousePositionRef.current.y,
        currentTime,
        auctionIconHoverRef.current,
        uiOpacity, // Add opacity parameter
        unitSize, // Add unitSize parameter
        capabilities!, // Add capabilities parameter
      );
      totalElementsRendered++; // Count featured section as one element

      // Draw home area using screen coordinates
      const homeAreaScreenPos = worldToScreen(homeAreaWorldX, homeAreaWorldY, viewTransform);
      const homeAreaScreenWidth = (homeAreaWidth * viewTransform.scaleX) | 0;
      const homeAreaScreenHeight = (homeAreaHeight * viewTransform.scaleY) | 0;

      drawHomeArea(
        ctx,
        homeAreaScreenPos.x,
        homeAreaScreenPos.y,
        logoImageRef.current,
        mousePositionRef.current.x, // Screen mouse coordinates
        mousePositionRef.current.y, // Screen mouse coordinates
        homeAreaScreenWidth,
        homeAreaScreenHeight,
        null,
        currentTime,
        unitSize,
        uiOpacity, // Add opacity parameter
        ['LAUNCH', 'DROPS'], // Default prompts
        capabilities!, // Add capabilities parameter
      );
      totalElementsRendered++; // Count home area as one element

      // Step 0: End performance monitoring for this frame
      performanceMonitor.endFrame(totalElementsRendered);

      // Production Integration: Adaptive quality management with real-time monitoring
      if (adaptiveQualityManager && capabilitiesReady) {
        // Collect performance metrics for this frame
        const frameTime = currentTime - lastFrameTime.current;
        const frameRate = frameTime > 0 ? 1000 / frameTime : 60;

        // Create performance metrics for adaptive quality manager
        const performanceMetrics = {
          timestamp: currentTime,
          frameRate,
          averageFrameTime: frameTime,
          performanceTier: deviceCapabilities.performanceTier,
          memoryUsage: (() => {
            const memory = (performance as any)?.memory;
            if (memory) {
              const used = memory.usedJSHeapSize || 0;
              const limit = memory.jsHeapSizeLimit || 0;
              const available = Math.max(0, limit - used);
              const usageRatio = limit > 0 ? used / limit : 0;

              return {
                available: Math.round(available / (1024 * 1024)), // Convert to MB
                allocated: Math.round(used / (1024 * 1024)), // Convert to MB
                pressure:
                  usageRatio > 0.8
                    ? ('high' as const)
                    : usageRatio > 0.6
                      ? ('medium' as const)
                      : ('low' as const),
              };
            }

            // Fallback when performance.memory isn't available
            return {
              available: deviceCapabilities.availableMemory || 2048,
              allocated: 0,
              pressure: deviceCapabilities.memoryPressure || ('medium' as const),
            };
          })(),
          gpuMetrics: {
            memory: deviceCapabilities.gpuMemoryMB,
            maxTextureSize: deviceCapabilities.maxTextureSize,
            webgl2Support: deviceCapabilities.supportsWebGL2,
          },
        };

        // Let adaptive quality manager analyze and potentially adjust configuration
        const updatedConfiguration = adaptiveQualityManager.adjustQuality(performanceMetrics);

        // If configuration changed, we could update our browserPerf for next frame
        // This creates a feedback loop for real-time optimization
      }

      lastFrameTime.current = currentTime;

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

      // Step 5: Cleanup scroll timeout
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
        scrollTimeout.current = null;
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
    featuredImage, // FEATURED SECTION: Added featured image dependency
    hoveredProductImageRef, // HOVER ENHANCEMENT: Added hover ref dependency
  ]); // Phase 2 Step 4 Action 3: Most refs are intentionally stable and don't need dependencies

  // Step 6: Enhanced scroll detection and background processor coordination
  const lastViewState = useRef(viewState);
  const scrollVelocity = useRef(0);
  const scrollHistory = useRef<{ time: number; velocity: number }[]>([]);
  const smoothedVelocity = useRef(0);
  const scrollDirectionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const currentTime = performance.now();
    const deltaX = viewState.x - lastViewState.current.x;
    const deltaY = viewState.y - lastViewState.current.y;
    const rawVelocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Track scroll direction for smarter processing decisions
    scrollDirectionRef.current = {
      x: Math.abs(deltaX) > Math.abs(deltaY) ? Math.sign(deltaX) : 0,
      y: Math.abs(deltaY) > Math.abs(deltaX) ? Math.sign(deltaY) : 0,
    };

    // Add to scroll history for smoothing
    scrollHistory.current.push({ time: currentTime, velocity: rawVelocity });

    // Keep only last 5 measurements (about 80ms of history at 60fps)
    if (scrollHistory.current.length > 5) {
      scrollHistory.current.shift();
    }

    // Calculate smoothed velocity using weighted average (recent samples weighted more)
    let weightedSum = 0;
    let totalWeight = 0;
    const maxAge = 100; // 100ms history

    for (let i = 0; i < scrollHistory.current.length; i++) {
      const sample = scrollHistory.current[i];
      const age = currentTime - sample.time;

      if (age <= maxAge) {
        // Weight newer samples more heavily (exponential decay)
        const weight = Math.exp(-age / 30); // 30ms decay constant
        weightedSum += sample.velocity * weight;
        totalWeight += weight;
      }
    }

    // Update smoothed velocity
    smoothedVelocity.current = totalWeight > 0 ? weightedSum / totalWeight : 0;
    scrollVelocity.current = smoothedVelocity.current;

    // Balanced scroll state detection (FIX: prevent infinite canvas breakage)
    const isScrolling = smoothedVelocity.current > 3; // Restored reasonable threshold to avoid over-detection
    const isRapidScrolling = smoothedVelocity.current > 15;
    const isSlowScrolling = smoothedVelocity.current > 1 && smoothedVelocity.current <= 5;

    // Step 6: Update background processor with balanced scroll state
    if (backgroundTileProcessor.updateScrollState) {
      backgroundTileProcessor.updateScrollState(isScrolling, smoothedVelocity.current);
    }

    lastViewState.current = viewState;

    // Clean up old scroll history periodically
    const cleanupOldEntries = () => {
      const cutoffTime = currentTime - maxAge;
      scrollHistory.current = scrollHistory.current.filter((entry) => entry.time > cutoffTime);
    };

    // Cleanup every 10th call to avoid excessive array operations
    if (scrollHistory.current.length % 10 === 0) {
      cleanupOldEntries();
    }
  }, [viewState, backgroundTileProcessor]);

  // Step 6: Enhanced scroll-aware background processing for 80% improvement (10ms → 2ms per frame)
  useEffect(() => {
    if (!placementsCalculated) return;

    let isProcessingActive = true;
    let lastFrameTime = performance.now();
    let adaptiveProcessingTimeout: NodeJS.Timeout | null = null;

    // Performance-aware processing state
    const processingState = {
      consecutiveSlowFrames: 0,
      lastProcessingTime: 0,
      averageProcessingTime: 5, // Start with optimistic 5ms estimate
      isInSlowMode: false,
    };

    const processBackgroundTiles = async () => {
      if (!isProcessingActive) return;

      const currentTime = performance.now();
      const frameTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;

      // Step 6: Balanced scroll and performance detection (FIX: prevents infinite canvas breakage)
      // Use device capabilities from our enhanced capability system
      const isActiveScrolling = scrollVelocity.current > 5; // Restored higher threshold for active scrolling
      const velocity = scrollVelocity.current;

      // Frame budget analysis for adaptive processing (more lenient)
      const frameWasSlow = frameTime > 33; // Increased threshold to 33ms (30fps) to be less aggressive
      if (frameWasSlow) {
        processingState.consecutiveSlowFrames++;
      } else {
        processingState.consecutiveSlowFrames = Math.max(
          0,
          processingState.consecutiveSlowFrames - 1,
        );
      }

      // Enter slow mode only if performance is consistently very poor (more lenient)
      processingState.isInSlowMode = processingState.consecutiveSlowFrames > 6; // Increased threshold

      // Step 6: PRIORITY-BASED processing for infinite canvas functionality
      let shouldProcess = true; // Always process to maintain infinite canvas
      let processingDelay = 16; // Default 60fps baseline

      // Smart detection: Are we at canvas edges or just scrolling through existing content?
      const nearCanvasEdges = activeTiles.current.size < 2; // Very few tiles = at edge
      const approachingEdges = activeTiles.current.size < 6 && !isActiveScrolling; // Approaching edge while not scrolling
      const hasUrgentEdgeTiles = nearCanvasEdges || approachingEdges;

      if (hasUrgentEdgeTiles) {
        // PRIORITY: Infinite canvas edge tiles need immediate processing
        processingDelay = 8; // Fast but not excessive (120fps for edges)
      } else {
        // Non-urgent processing can be scroll-aware
        if (isActiveScrolling) {
          if (velocity > 20 && deviceCapabilities.performanceTier === 'low') {
            processingDelay = 32; // Slower on low-end during fast scroll
          } else if (velocity > 15) {
            processingDelay = 16; // Normal rate during fast scroll
          } else if (velocity > 8) {
            processingDelay = 12; // Slightly faster during medium scroll
          }
          // Slow scroll (5-8): keep default 16ms
        }

        // Performance adjustments only for non-urgent tiles
        if (processingState.isInSlowMode && !hasUrgentEdgeTiles) {
          processingDelay = Math.max(processingDelay, 32);
        } else if (frameWasSlow && !hasUrgentEdgeTiles) {
          processingDelay = Math.max(processingDelay, 20);
        }

        // Device capability adjustments
        if (deviceCapabilities.performanceTier === 'high' && !isActiveScrolling) {
          processingDelay = 8; // Faster processing on high-end when idle
        }
      }

      // Step 6: Execute processing WITHOUT time limits (FIX: prevent tile generation cancellation)
      if (shouldProcess && !backgroundTileProcessor.isProcessingTiles()) {
        const processingStartTime = performance.now();

        try {
          // REMOVED: Time-limited processing that was canceling tile generation
          // Let tile processing complete naturally to ensure infinite canvas works
          const tileData = await backgroundTileProcessor.processNextTile();

          const actualProcessingTime = performance.now() - processingStartTime;

          // Update adaptive processing time (exponential moving average)
          processingState.averageProcessingTime =
            processingState.averageProcessingTime * 0.9 + actualProcessingTime * 0.1;
          processingState.lastProcessingTime = actualProcessingTime;

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
          // Handle processing errors gracefully and adjust future processing
          processingState.averageProcessingTime = Math.min(
            10,
            processingState.averageProcessingTime * 1.2,
          );
        }
      }

      // Step 6: Adaptive scheduling for next processing cycle
      if (isProcessingActive) {
        // Clear existing timeout to prevent accumulation
        if (adaptiveProcessingTimeout) {
          clearTimeout(adaptiveProcessingTimeout);
        }

        adaptiveProcessingTimeout = setTimeout(processBackgroundTiles, processingDelay);
      }
    };

    // Initial processing start
    adaptiveProcessingTimeout = setTimeout(processBackgroundTiles, 16);

    return () => {
      isProcessingActive = false;
      if (adaptiveProcessingTimeout) {
        clearTimeout(adaptiveProcessingTimeout);
        adaptiveProcessingTimeout = null;
      }
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

  // Calculate if products are fully visible (entrance animation complete)
  const productsFullyVisible = useMemo(() => {
    return (
      placementsCalculated &&
      !entranceAnimationStatusRef.current.isAnimationActive &&
      entranceAnimationStatusRef.current.animationProgress >= 1
    );
  }, [
    placementsCalculated,
    // Note: Using ref, so dependencies are minimal - status updates in draw function
  ]);

  return {
    canvasRef: activeCanvasRef,
    canvasProgress,
    canvasReady,
    productsFullyVisible,
    repeatedPlacements: repeatedPlacements.current,
    repeatedTokens: repeatedTokens.current,
    // Issue #2: Return momentum handler for interactions integration
    handleMomentumUpdate,
    // FEATURED SECTION: Return featured image for external use
    featuredImage,
  };
};
