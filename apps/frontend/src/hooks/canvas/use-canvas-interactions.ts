'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ViewState, ImageInfo } from '../../types/canvas';
import { isHomeArea, isFeaturedArea } from '../../lib/canvas/grid-placement'; // FEATURED SECTION: Added isFeaturedArea import
import { getAuctionIconBounds } from '../../lib/canvas/draw/draw-featured-section'; // Auction icon import
import { mobileUtils } from '../../lib/utils/browser-utils';
import { getResponsiveMetrics } from '../../lib/utils/responsive-canvas-utils';
import { useDeviceCapabilities } from '../../contexts/device-provider';

export interface AuctionIconClickPayload {
  symbol?: string;
  title?: string;
}

const normalizeSymbolForRoute = (value?: string) =>
  value ? value.trim().replace(/^\$/u, '') : '';

const getFeaturedSymbol = (image?: ImageInfo | null) => {
  if (!image) return '';
  const metadata = image.metadata;
  const rawSymbol = metadata?.symbol ?? metadata?.ticker;
  return normalizeSymbolForRoute(rawSymbol);
};

interface UseCanvasInteractionsProps {
  viewState: ViewState;
  setSelectedImage: (image: ImageInfo | null) => void;
  imagePlacementMap: React.MutableRefObject<
    Map<string, { image: ImageInfo; x: number; y: number; width: number; height: number }>
  >;
  unitSize: number;
  updateViewState: (deltaX: number, deltaY: number) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
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
  onAboutClick?: () => void;
  onTermsClick?: () => void;
  onMomentumUpdate?: (momentum: { velocity: { x: number; y: number }; active: boolean }) => void;
  // FEATURED SECTION: Add featured image props
  featuredImage?: ImageInfo | null;
  onFeaturedImageClick?: (imageInfo: ImageInfo) => void;
  // Auction icon click handler
  onAuctionIconClick?: (details: AuctionIconClickPayload) => void;
  // HOVER ENHANCEMENT: Add hover state callbacks for regular product images
  onProductImageHover?: (
    imageInfo: ImageInfo | null,
    placement?: { x: number; y: number; width: number; height: number },
  ) => void;
}

// MOMENTUM RESTORATION: Export enhanced momentum settings for canvas renderer
export const TOUCH_SETTINGS = {
  touchSensitivity: mobileUtils.isMobileSafari() ? 1.2 : 1.0,
  mouseSensitivity: 1.0,
  // GALAXY S9 MOMENTUM: Use Galaxy S9 settings for iOS since they work perfectly
  velocityMultiplier:
    typeof window !== 'undefined' && mobileUtils.isMobileSafari()
      ? 1.5 // Match Galaxy S9 Android settings exactly
      : typeof window !== 'undefined' && window.navigator.maxTouchPoints > 0
        ? 1.5 // Keep Galaxy S9 unchanged - working perfectly
        : 1.2, // Keep desktop unchanged - working well

  // GALAXY S9 MOMENTUM: Use Galaxy S9 settings for iOS since they work perfectly
  momentumFriction:
    typeof window !== 'undefined' && mobileUtils.isMobileSafari()
      ? 0.96 // Match Galaxy S9 Android settings exactly
      : typeof window !== 'undefined' && window.navigator.maxTouchPoints > 0
        ? 0.96 // Keep Galaxy S9 unchanged - working perfectly
        : 0.88, // Keep desktop unchanged - working well

  // ADJUSTED: Lower minVelocity for new time-based calculation
  minVelocity:
    typeof window !== 'undefined' && mobileUtils.isMobileSafari()
      ? 1.0 // Lowered for iOS time-based velocity calculation
      : typeof window !== 'undefined' && window.navigator.maxTouchPoints > 0
        ? 1.0 // Lowered for Android time-based velocity calculation
        : 2.0, // Lowered for desktop time-based velocity calculation

  tapThreshold: 10,
  tapTimeLimit: 180,
  dragThreshold: 1.5,

  // iOS-specific momentum timing (critical for proper iOS momentum)
  moveThreshold: 200, // ms - max time between last touchmove and touchend for momentum (was too strict at 100ms)
  velocityScale: 8.0, // iOS velocity scaling factor (pixels/ms to momentum units) - increased for proper momentum
} as const;

// iOS-compatible touch physics tracking with time-based velocity
interface TouchPhysics {
  velocity: { x: number; y: number };
  lastPos: { x: number; y: number; time: number } | null;
  isDragging: boolean;
  // iOS-specific timing for momentum detection
  lastMoveTime: number;
  startPos: { x: number; y: number; time: number } | null;
}

const createTouchPhysics = (): TouchPhysics => ({
  velocity: { x: 0, y: 0 },
  lastPos: null,
  isDragging: false,
  lastMoveTime: 0,
  startPos: null,
});

export const useCanvasInteractions = ({
  viewState,
  setSelectedImage,
  imagePlacementMap,
  unitSize,
  updateViewState,
  canvasRef,
  repeatedPlacements,
  repeatedTokens,
  onAboutClick,
  onTermsClick,
  onMomentumUpdate,
  featuredImage, // FEATURED SECTION: Add featured image
  onFeaturedImageClick, // FEATURED SECTION: Add featured image click handler
  onAuctionIconClick, // Auction icon click handler
  onProductImageHover, // HOVER ENHANCEMENT: Add product image hover callback
}: UseCanvasInteractionsProps) => {
  const router = useRouter();
  const { capabilities } = useDeviceCapabilities();
  const [isPanning, setIsPanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // HOVER ENHANCEMENT: Add state for hovered product images
  const [hoveredProductImage, setHoveredProductImage] = useState<{
    image: ImageInfo;
    x: number;
    y: number;
    width: number;
    height: number;
    isRepeated?: boolean;
    tileId?: string;
  } | null>(null);

  const touchPhysicsRef = useRef<TouchPhysics>(createTouchPhysics());
  const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const boundsRef = useRef<DOMRect | null>(null);

  const navigateToRwa = useCallback(
    (symbol: string) => {
      if (!symbol) return;
      try {
        router.push(`/rwa/${symbol}`);
      } catch (error) {
        window.location.href = `/rwa/${symbol}`;
      }
    },
    [router],
  );

  // FEATURED SECTION: Updated area coordinates
  const homeAreaWidth = unitSize * 2;
  const homeAreaHeight = unitSize;
  const homeAreaWorldX = -unitSize;
  const homeAreaWorldY = -unitSize;

  // FEATURED SECTION: New featured area coordinates - MUST match canvas renderer coordinates
  const featuredAreaWidth = unitSize * 2;
  const featuredAreaHeight = unitSize * 1.95; // Match canvas renderer: 65% height
  const featuredAreaWorldX = -unitSize;
  const featuredAreaWorldY = -unitSize * 2.25; // Match canvas renderer coordinates exactly

  // Smart mobile optimization: detect mobile device (same detection as in canvas renderer)
  const isMobileDevice = typeof window !== 'undefined' && window.navigator.maxTouchPoints > 0;

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
    [viewState, canvasRef],
  );

  // MOMENTUM RESTORATION: Clean production-ready momentum start
  const startMomentum = useCallback(() => {
    const physics = touchPhysicsRef.current;

    if (
      Math.abs(physics.velocity.x) < TOUCH_SETTINGS.minVelocity &&
      Math.abs(physics.velocity.y) < TOUCH_SETTINGS.minVelocity
    ) {
      return;
    }

    // Google Maps style momentum for all platforms
    onMomentumUpdate?.({
      velocity: {
        x: physics.velocity.x,
        y: physics.velocity.y,
      },
      active: true,
    });
  }, [onMomentumUpdate]);

  // MOMENTUM RESTORATION: Add momentum stop function
  const stopMomentum = useCallback(() => {
    onMomentumUpdate?.({
      velocity: { x: 0, y: 0 },
      active: false,
    });
  }, [onMomentumUpdate]);

  // HOVER ENHANCEMENT: Product image hover detection
  const handleProductImageHover = useCallback(
    (clientX: number, clientY: number) => {
      const coords = getWorldCoordinates(clientX, clientY);
      if (!coords) {
        // Clear hover if coordinates are invalid
        if (hoveredProductImage) {
          setHoveredProductImage(null);
          onProductImageHover?.(null);
        }
        return;
      }

      const { worldX, worldY } = coords;
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
      if (!hoveredImage && repeatedPlacements) {
        for (const tilePlacements of repeatedPlacements.values()) {
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
      const currentHover = hoveredProductImage;
      const hasChanged =
        (!currentHover && hoveredImage) ||
        (currentHover && !hoveredImage) ||
        (currentHover &&
          hoveredImage &&
          (currentHover.image.metadata.id !== hoveredImage.image.metadata.id ||
            currentHover.x !== hoveredImage.x ||
            currentHover.y !== hoveredImage.y));

      if (hasChanged) {
        setHoveredProductImage(hoveredImage);
        onProductImageHover?.(
          hoveredImage?.image || null,
          hoveredImage
            ? {
                x: hoveredImage.x,
                y: hoveredImage.y,
                width: hoveredImage.width,
                height: hoveredImage.height,
              }
            : undefined,
        );
      }
    },
    [
      getWorldCoordinates,
      imagePlacementMap,
      repeatedPlacements,
      hoveredProductImage,
      onProductImageHover,
    ],
  );

  // Simplified click handling - minimal validation for speed
  const handleClick = useCallback(
    (clientX: number, clientY: number) => {
      const coords = getWorldCoordinates(clientX, clientY);
      if (!coords) return;

      const { worldX, worldY } = coords;

      // AUCTION ICON: Check auction icon click first (highest priority)
      if (featuredImage) {
        // Convert world coordinates to screen coordinates for auction icon bounds check
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const screenX = worldX * viewState.scale + viewState.x + rect.left;
          const screenY = worldY * viewState.scale + viewState.y + rect.top;

          // Get auction icon bounds in screen coordinates
          const screenFeaturedX = featuredAreaWorldX * viewState.scale + viewState.x;
          const screenFeaturedY = featuredAreaWorldY * viewState.scale + viewState.y;
          const screenFeaturedWidth = featuredAreaWidth * viewState.scale;
          const screenFeaturedHeight = featuredAreaHeight * viewState.scale;

          const responsiveMetrics = capabilities
            ? getResponsiveMetrics(unitSize, capabilities)
            : ({ isMobile: isMobileDevice, iconScale: 1, paddingScale: 1 } as any);

          const iconBounds = getAuctionIconBounds(
            screenFeaturedX,
            screenFeaturedY,
            screenFeaturedWidth,
            screenFeaturedHeight,
            responsiveMetrics,
          );

          if (
            screenX >= iconBounds.x &&
            screenX <= iconBounds.x + iconBounds.width &&
            screenY >= iconBounds.y &&
            screenY <= iconBounds.y + iconBounds.height
          ) {
            const symbolForRoute = getFeaturedSymbol(featuredImage);
            if (symbolForRoute) {
              if (onAuctionIconClick) {
                onAuctionIconClick({ symbol: symbolForRoute, title: featuredImage.metadata.title });
              } else {
                navigateToRwa(symbolForRoute);
              }
            } else if (onAuctionIconClick) {
              onAuctionIconClick({ title: featuredImage.metadata.title });
            } else {
              onFeaturedImageClick?.(featuredImage);
            }
            return;
          }
        }
      }

      // FEATURED SECTION: Check featured area (second priority)
      if (
        featuredImage &&
        isFeaturedArea(
          worldX,
          worldY,
          featuredAreaWorldX,
          featuredAreaWorldY,
          featuredAreaWidth,
          featuredAreaHeight,
        )
      ) {
        // Navigate to RWA page if symbol exists, otherwise fall back to modal
        const symbolForRoute = getFeaturedSymbol(featuredImage);
        if (symbolForRoute) {
          navigateToRwa(symbolForRoute);
        } else {
          onFeaturedImageClick?.(featuredImage);
        }
        return;
      }

      // Check home area
      if (
        isHomeArea(worldX, worldY, homeAreaWorldX, homeAreaWorldY, homeAreaWidth, homeAreaHeight)
      ) {
        const quadWidth = homeAreaWidth / 2;
        const quadHeight = homeAreaHeight / 2;

        // Quadrant coordinates based on draw-home-area.ts layout:
        // Quadrant 0 (top-left): ABOUT
        const aboutQuadX = homeAreaWorldX;
        const aboutQuadY = homeAreaWorldY;

        // Quadrant 1 (top-right): CREATE
        const createQuadX = homeAreaWorldX + quadWidth;
        const createQuadY = homeAreaWorldY;

        // Quadrant 2 (bottom-left): DOCS
        const docsQuadX = homeAreaWorldX;
        const docsQuadY = homeAreaWorldY + quadHeight;

        // Quadrant 3 (bottom-right): GRAILS
        const grailsQuadX = homeAreaWorldX + quadWidth;
        const grailsQuadY = homeAreaWorldY + quadHeight;

        // Home area button handling (simplified to 2 buttons)
        const buttonWidth = homeAreaWidth / 2;

        // CREATE button (left half)
        if (worldX >= homeAreaWorldX && worldX < homeAreaWorldX + buttonWidth) {
          window.location.href = '/launch';
          return;
        }

        // DROPS button (right half)
        if (worldX >= homeAreaWorldX + buttonWidth && worldX < homeAreaWorldX + homeAreaWidth) {
          window.location.href = '/drops';
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
              window.location.href = '/launch';
              return;
            }
          }
        }
      }

      if (clickedImage) {
        if (clickedImage.type === 'submit-asset') {
          window.location.href = '/launch';
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
      featuredAreaWorldX, // FEATURED SECTION: Add featured area coordinates
      featuredAreaWorldY,
      featuredAreaWidth,
      featuredAreaHeight,
      featuredImage, // FEATURED SECTION: Add featured image
      onFeaturedImageClick, // FEATURED SECTION: Add featured image click handler
      onAuctionIconClick, // Auction icon click handler
      navigateToRwa,
      imagePlacementMap,
      repeatedPlacements,
      repeatedTokens,
      unitSize,
      setSelectedImage,
      router,
      onAboutClick,
      onTermsClick,
      viewState, // Add viewState for coordinate conversion
      canvasRef, // Add canvasRef for screen coordinate calculation
      isMobileDevice, // Add mobile device detection
    ],
  );

  // Mouse handlers - simplified for speed
  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) return;

      boundsRef.current = null; // Reset bounds cache

      const currentTime = performance.now();
      stopMomentum();

      const physics = touchPhysicsRef.current;
      physics.lastPos = { x: event.clientX, y: event.clientY, time: currentTime };
      physics.startPos = { x: event.clientX, y: event.clientY, time: currentTime };
      physics.isDragging = false;
      physics.lastMoveTime = currentTime;

      dragStartRef.current = { x: event.clientX, y: event.clientY, time: Date.now() };
      setIsPanning(true);

      event.preventDefault();
    },
    [stopMomentum],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isPanning) return;

      const currentTime = performance.now();
      const physics = touchPhysicsRef.current;
      if (!physics.lastPos || !physics.startPos) return;

      const deltaX = (event.clientX - physics.lastPos.x) * TOUCH_SETTINGS.mouseSensitivity;
      const deltaY = (event.clientY - physics.lastPos.y) * TOUCH_SETTINGS.mouseSensitivity;

      // Immediate movement - no validation overhead
      updateViewState(deltaX, deltaY);

      // Google Maps style: Recent movement velocity (same as touch)
      const recentTimeElapsed = currentTime - physics.lastPos.time;
      if (recentTimeElapsed > 0) {
        const recentDistanceX = event.clientX - physics.lastPos.x;
        const recentDistanceY = event.clientY - physics.lastPos.y;

        const velocityX = (recentDistanceX / recentTimeElapsed) * TOUCH_SETTINGS.velocityScale;
        const velocityY = (recentDistanceY / recentTimeElapsed) * TOUCH_SETTINGS.velocityScale;

        physics.velocity.x = velocityX * TOUCH_SETTINGS.velocityMultiplier;
        physics.velocity.y = velocityY * TOUCH_SETTINGS.velocityMultiplier;
      }

      physics.lastPos = { x: event.clientX, y: event.clientY, time: currentTime };
      physics.lastMoveTime = currentTime;

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

      const currentTime = performance.now();
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
        // Same timing check as touch for consistent behavior
        const timeSinceLastMove = currentTime - physics.lastMoveTime;

        if (timeSinceLastMove < TOUCH_SETTINGS.moveThreshold) {
          startMomentum();
        }
      }

      // Reset state
      setIsPanning(false);
      setIsDragging(false);
      physics.isDragging = false;
      physics.lastPos = null;
      physics.startPos = null;
      physics.lastMoveTime = 0;
      dragStartRef.current = null;

      event.preventDefault();
    },
    [handleClick, startMomentum],
  );

  // Touch handlers - optimized for maximum responsiveness
  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (event.touches.length !== 1) return;

      boundsRef.current = null; // Reset bounds cache

      const touch = event.touches[0];
      const currentTime = performance.now();
      stopMomentum();

      const physics = touchPhysicsRef.current;
      physics.lastPos = { x: touch.clientX, y: touch.clientY, time: currentTime };
      physics.startPos = { x: touch.clientX, y: touch.clientY, time: currentTime };
      physics.isDragging = false;
      physics.lastMoveTime = currentTime;

      dragStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      setIsPanning(true);

      // Only prevent default for non-clickable areas to maintain native behavior
      const coords = getWorldCoordinates(touch.clientX, touch.clientY);
      if (coords) {
        const { worldX, worldY } = coords;

        // FEATURED SECTION: Check if touching featured area
        const isTouchingFeatured =
          featuredImage &&
          isFeaturedArea(
            worldX,
            worldY,
            featuredAreaWorldX,
            featuredAreaWorldY,
            featuredAreaWidth,
            featuredAreaHeight,
          );

        const isTouchingHome = isHomeArea(
          worldX,
          worldY,
          homeAreaWorldX,
          homeAreaWorldY,
          homeAreaWidth,
          homeAreaHeight,
        );

        const isClickable = isTouchingFeatured || isTouchingHome;
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
      featuredAreaWorldX, // FEATURED SECTION: Add featured area coordinates
      featuredAreaWorldY,
      featuredAreaWidth,
      featuredAreaHeight,
      featuredImage, // FEATURED SECTION: Add featured image
    ],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!isPanning || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const currentTime = performance.now();
      const physics = touchPhysicsRef.current;
      if (!physics.lastPos || !physics.startPos) return;

      // Ultra-responsive movement calculation
      const deltaX = (touch.clientX - physics.lastPos.x) * TOUCH_SETTINGS.touchSensitivity;
      const deltaY = (touch.clientY - physics.lastPos.y) * TOUCH_SETTINGS.touchSensitivity;

      // Immediate movement application
      updateViewState(deltaX, deltaY);

      // Google Maps style: Recent movement velocity (more responsive than total velocity)
      const recentTimeElapsed = currentTime - physics.lastPos.time;
      if (recentTimeElapsed > 0) {
        const recentDistanceX = touch.clientX - physics.lastPos.x;
        const recentDistanceY = touch.clientY - physics.lastPos.y;

        // Calculate velocity as pixels per millisecond, then scale for momentum
        const velocityX = (recentDistanceX / recentTimeElapsed) * TOUCH_SETTINGS.velocityScale;
        const velocityY = (recentDistanceY / recentTimeElapsed) * TOUCH_SETTINGS.velocityScale;

        physics.velocity.x = velocityX * TOUCH_SETTINGS.velocityMultiplier;
        physics.velocity.y = velocityY * TOUCH_SETTINGS.velocityMultiplier;
      }

      physics.lastPos = { x: touch.clientX, y: touch.clientY, time: currentTime };
      physics.lastMoveTime = currentTime;

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
      const currentTime = performance.now();
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
          // Google Maps timing check - only trigger momentum if touch ended soon after last move
          const timeSinceLastMove = currentTime - physics.lastMoveTime;

          if (timeSinceLastMove < TOUCH_SETTINGS.moveThreshold) {
            // Timing validation passed - start momentum (like Google Maps)
            startMomentum();
          }
          // If too much time passed since last move, no momentum (finger paused)
        }
      }

      // Reset state
      setIsPanning(false);
      setIsDragging(false);
      physics.isDragging = false;
      physics.lastPos = null;
      physics.startPos = null;
      physics.lastMoveTime = 0;
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
    touchPhysicsRef.current.startPos = null;
    touchPhysicsRef.current.lastMoveTime = 0;
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
    stopMomentum, // Expose for external momentum cancellation
    // HOVER ENHANCEMENT: Expose hover detection function and state
    handleProductImageHover,
    hoveredProductImage,
  };
};
