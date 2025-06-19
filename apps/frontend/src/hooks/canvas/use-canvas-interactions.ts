'use client';

import type React from 'react';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ImageInfo, ViewState } from '../../types/canvas';
import { isHomeArea } from '../../lib/canvas/grid-placement';
import { LuxuryLogger, getImageMetadata } from '../../lib/utils/luxury-logger';
import { browserUtils, mobileUtils, getDeviceCapabilities } from '../../lib/utils/browser-utils';
// Phase 2 Step 8 Action 1: Navigation safety coordination
import { useNavigationSafety } from '../use-navigation-safety';

interface UseCanvasInteractionsProps {
  viewState: ViewState;
  imagesRef: React.MutableRefObject<ImageInfo[]>;
  setSelectedImage: (image: ImageInfo | null) => void;
  imagePlacementMap: React.MutableRefObject<
    Map<string, { image: ImageInfo; x: number; y: number; width: number; height: number }>
  >;
  unitSize: number;
  updateViewState: (deltaX: number, deltaY: number) => void;
  // Phase 2 Step 8 Action 1: Navigation safety coordination
  navigationSafety?: {
    loadingState: 'loading' | 'intro' | 'ready';
    imagesLoaded: boolean;
    canvasReady: boolean;
  };
}

// Phase 2 Step 7 Action 2: Touch Physics for Google Maps-like feel
interface TouchPhysics {
  velocity: { x: number; y: number };
  lastPositions: Array<{ x: number; y: number; time: number }>;
  momentumAnimationId: number | null;
  isDecelerating: boolean;
}

interface TouchSettings {
  // Device-capability based sensitivity
  touchSensitivity: number;
  mouseSensitivity: number;

  // Momentum physics configuration
  momentumFriction: number;
  velocityDecayFactor: number;
  minimumVelocityThreshold: number;
  maxVelocityTrackingPoints: number;

  // Gesture detection thresholds
  tapTimeThreshold: number;
  tapDistanceThreshold: number;
  dragDistanceThreshold: number;

  // Performance optimization
  trackingThrottleMs: number;
}

// Phase 2 Step 8 Action 3: Enhanced Canvas Interaction Safety
interface CanvasInteractionSafety {
  // Canvas state validation
  canvasReady: boolean;
  canvasContext: CanvasRenderingContext2D | null;
  canvasBounds: DOMRect | null;
  lastBoundsUpdate: number;

  // Coordinate validation
  validCoordinateRange: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };

  // Interaction rate limiting
  lastInteractionTime: number;
  interactionCount: number;
  rateLimitWindow: number;
  maxInteractionsPerWindow: number;

  // Error recovery
  consecutiveErrors: number;
  maxConsecutiveErrors: number;
  errorRecoveryDelay: number;
  isInErrorRecovery: boolean;
}

// Phase 2 Step 8 Action 4: Focus Management System
interface CanvasFocusManagement {
  // Focus state tracking
  isFocused: boolean;
  canReceiveFocus: boolean;
  lastFocusTime: number;
  focusSource: 'mouse' | 'keyboard' | 'touch' | 'programmatic' | null;

  // Focus restoration
  previousActiveElement: Element | null;
  shouldRestoreFocus: boolean;

  // Keyboard navigation
  keyboardNavigationEnabled: boolean;
  lastKeyboardInteraction: number;

  // Accessibility
  announceInteractions: boolean;
  focusIndicatorVisible: boolean;
}

// Phase 2 Step 8 Action 3: Canvas interaction safety utilities
const createCanvasInteractionSafety = (): CanvasInteractionSafety => ({
  canvasReady: false,
  canvasContext: null,
  canvasBounds: null,
  lastBoundsUpdate: 0,
  validCoordinateRange: {
    minX: -10000,
    maxX: 10000,
    minY: -10000,
    maxY: 10000,
  },
  lastInteractionTime: 0,
  interactionCount: 0,
  rateLimitWindow: 1000, // 1 second
  maxInteractionsPerWindow: 120, // Max 120 interactions per second (optimized for 60fps touch)
  consecutiveErrors: 0,
  maxConsecutiveErrors: 5,
  errorRecoveryDelay: 1000, // 1 second recovery delay
  isInErrorRecovery: false,
});

// Phase 2 Step 8 Action 4: Focus management utilities
const createCanvasFocusManagement = (): CanvasFocusManagement => ({
  isFocused: false,
  canReceiveFocus: true,
  lastFocusTime: 0,
  focusSource: null,
  previousActiveElement: null,
  shouldRestoreFocus: false,
  keyboardNavigationEnabled: true,
  lastKeyboardInteraction: 0,
  announceInteractions: false, // Can be enabled for accessibility
  focusIndicatorVisible: false,
});

// Phase 2 Step 8 Action 3: Validate canvas state before interactions
const validateCanvasState = (
  canvas: HTMLCanvasElement | null,
  safety: CanvasInteractionSafety,
): { valid: boolean; reason?: string } => {
  if (!canvas) {
    return { valid: false, reason: 'Canvas element not available' };
  }

  if (!safety.canvasReady) {
    return { valid: false, reason: 'Canvas not fully initialized' };
  }

  // Check if canvas is still attached to DOM
  if (!canvas.isConnected) {
    return { valid: false, reason: 'Canvas not attached to DOM' };
  }

  // Validate canvas dimensions
  if (canvas.width <= 0 || canvas.height <= 0) {
    return { valid: false, reason: 'Invalid canvas dimensions' };
  }

  // Check for context availability
  if (!safety.canvasContext) {
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return { valid: false, reason: 'Canvas context not available' };
      }
      safety.canvasContext = ctx;
    } catch (error) {
      return { valid: false, reason: 'Canvas context error' };
    }
  }

  return { valid: true };
};

// Phase 2 Step 8 Action 3: Validate and normalize coordinates
const validateCoordinates = (
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  viewState: ViewState,
  safety: CanvasInteractionSafety,
): { valid: boolean; worldX?: number; worldY?: number; reason?: string } => {
  // Check for valid input coordinates
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return { valid: false, reason: 'Invalid client coordinates' };
  }

  // Update canvas bounds if needed (cache for 500ms - mobile optimization)
  const now = performance.now();
  if (!safety.canvasBounds || now - safety.lastBoundsUpdate > 500) {
    try {
      safety.canvasBounds = canvas.getBoundingClientRect();
      safety.lastBoundsUpdate = now;
    } catch (error) {
      return { valid: false, reason: 'Canvas bounds calculation failed' };
    }
  }

  const rect = safety.canvasBounds;
  if (!rect) {
    return { valid: false, reason: 'Canvas bounds not available' };
  }

  // Validate client coordinates are within canvas bounds (with tolerance)
  const tolerance = 10; // 10px tolerance for edge cases
  if (
    clientX < rect.left - tolerance ||
    clientX > rect.right + tolerance ||
    clientY < rect.top - tolerance ||
    clientY > rect.bottom + tolerance
  ) {
    return { valid: false, reason: 'Coordinates outside canvas bounds' };
  }

  // Calculate world coordinates
  const worldX = (clientX - rect.left - viewState.x) / viewState.scale;
  const worldY = (clientY - rect.top - viewState.y) / viewState.scale;

  // Validate world coordinates are within reasonable range
  if (
    !Number.isFinite(worldX) ||
    !Number.isFinite(worldY) ||
    worldX < safety.validCoordinateRange.minX ||
    worldX > safety.validCoordinateRange.maxX ||
    worldY < safety.validCoordinateRange.minY ||
    worldY > safety.validCoordinateRange.maxY
  ) {
    return { valid: false, reason: 'World coordinates out of valid range' };
  }

  return { valid: true, worldX, worldY };
};

// Phase 2 Step 8 Action 3: Rate limiting for interactions
const checkInteractionRateLimit = (
  safety: CanvasInteractionSafety,
): { allowed: boolean; reason?: string } => {
  const now = performance.now();

  // Reset counter if outside window
  if (now - safety.lastInteractionTime > safety.rateLimitWindow) {
    safety.interactionCount = 0;
  }

  // Check if in error recovery mode
  if (safety.isInErrorRecovery) {
    if (now - safety.lastInteractionTime < safety.errorRecoveryDelay) {
      return { allowed: false, reason: 'In error recovery mode' };
    } else {
      safety.isInErrorRecovery = false;
      safety.consecutiveErrors = 0;
    }
  }

  // Check rate limit
  if (safety.interactionCount >= safety.maxInteractionsPerWindow) {
    return { allowed: false, reason: 'Interaction rate limit exceeded' };
  }

  // Update counters
  safety.interactionCount++;
  safety.lastInteractionTime = now;

  return { allowed: true };
};

// Phase 2 Step 8 Action 3: Error recovery handling
const handleInteractionError = (safety: CanvasInteractionSafety, error: Error): void => {
  safety.consecutiveErrors++;

  if (safety.consecutiveErrors >= safety.maxConsecutiveErrors) {
    safety.isInErrorRecovery = true;
    safety.lastInteractionTime = performance.now();
    console.warn(
      `[Phase 2 Step 8 Action 3] Canvas interaction error recovery activated after ${safety.consecutiveErrors} consecutive errors:`,
      error.message,
    );
  } else {
    console.debug(
      `[Phase 2 Step 8 Action 3] Canvas interaction error (${safety.consecutiveErrors}/${safety.maxConsecutiveErrors}):`,
      error.message,
    );
  }
};

// Phase 2 Step 7 Action 2: Device-capability based touch settings
const getTouchSettings = (): TouchSettings => {
  const capabilities = getDeviceCapabilities();
  const isMobile = mobileUtils.isMobileSafari() || capabilities.touchCapable;
  const performanceTier = capabilities.performanceTier;

  // Base settings optimized for device type
  const baseSettings: TouchSettings = {
    // True 1:1 finger tracking - no sensitivity scaling needed
    touchSensitivity: 1.0, // Perfect 1:1 tracking
    mouseSensitivity: 1.0, // No scaling - let browser handle precision

    // Momentum physics - natural Google Maps-like feel
    momentumFriction: 0.95, // 5% deceleration per frame
    velocityDecayFactor: 0.92, // Velocity tracking smoothing
    minimumVelocityThreshold: 0.1, // px/ms minimum for momentum
    maxVelocityTrackingPoints: 3, // Reduced for smoother momentum (less noise)

    // Gesture detection - finger-friendly thresholds
    tapTimeThreshold: 200, // ms
    tapDistanceThreshold: isMobile ? 12 : 8, // px (larger for touch)
    dragDistanceThreshold: isMobile ? 8 : 5, // px

    // NO throttling for live tracking - only throttle momentum calculation
    trackingThrottleMs: 0, // No throttling for responsive 1:1 tracking
  };

  return baseSettings;
};

// Phase 2 Step 8 Action 4: Safe focus management with error handling
const manageFocus = (
  canvas: HTMLCanvasElement | null,
  focusManagement: CanvasFocusManagement,
  action: 'focus' | 'blur' | 'restore',
  source: 'mouse' | 'keyboard' | 'touch' | 'programmatic' = 'programmatic',
): { success: boolean; reason?: string } => {
  if (!canvas) {
    return { success: false, reason: 'Canvas element not available' };
  }

  try {
    switch (action) {
      case 'focus':
        if (!focusManagement.canReceiveFocus) {
          return { success: false, reason: 'Canvas cannot receive focus' };
        }

        // Store previous focus for restoration
        if (document.activeElement && document.activeElement !== canvas) {
          focusManagement.previousActiveElement = document.activeElement;
          focusManagement.shouldRestoreFocus = true;
        }

        // Set focus with proper tabIndex
        if (canvas.tabIndex === undefined || canvas.tabIndex < 0) {
          canvas.tabIndex = -1; // Focusable but not in tab order
        }

        canvas.focus({ preventScroll: true }); // Prevent unwanted scrolling

        // Update focus state
        focusManagement.isFocused = true;
        focusManagement.lastFocusTime = performance.now();
        focusManagement.focusSource = source;

        // Show focus indicator for keyboard navigation
        if (source === 'keyboard') {
          focusManagement.focusIndicatorVisible = true;
          canvas.style.outline = '2px solid #007AFF'; // iOS-style focus ring
          canvas.style.outlineOffset = '2px';
        }

        break;

      case 'blur':
        canvas.blur();

        // Update focus state
        focusManagement.isFocused = false;
        focusManagement.focusSource = null;
        focusManagement.focusIndicatorVisible = false;

        // Remove focus indicator
        canvas.style.outline = '';
        canvas.style.outlineOffset = '';

        break;

      case 'restore':
        if (focusManagement.shouldRestoreFocus && focusManagement.previousActiveElement) {
          try {
            (focusManagement.previousActiveElement as HTMLElement).focus();
            focusManagement.shouldRestoreFocus = false;
            focusManagement.previousActiveElement = null;
          } catch (restoreError) {
            // Focus restoration failed, but not critical
            console.debug('[Phase 2 Step 8 Action 4] Focus restoration failed:', restoreError);
          }
        }
        break;
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      reason: `Focus management error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

// Phase 2 Step 8 Action 4: Keyboard navigation handler
const handleKeyboardNavigation = (
  event: KeyboardEvent,
  focusManagement: CanvasFocusManagement,
  callbacks: {
    onNavigateHome?: () => void;
    onNavigateCreateToken?: () => void;
    onToggleModal?: () => void;
    onZoomIn?: () => void;
    onZoomOut?: () => void;
  },
): boolean => {
  if (!focusManagement.keyboardNavigationEnabled) {
    return false;
  }

  focusManagement.lastKeyboardInteraction = performance.now();

  // Handle keyboard shortcuts
  switch (event.key) {
    case 'Home':
      event.preventDefault();
      callbacks.onNavigateHome?.();
      return true;

    case 'Enter':
    case ' ': // Spacebar
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        callbacks.onNavigateCreateToken?.();
        return true;
      }
      break;

    case 'Escape':
      event.preventDefault();
      callbacks.onToggleModal?.();
      return true;

    case '+':
    case '=':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        callbacks.onZoomIn?.();
        return true;
      }
      break;

    case '-':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        callbacks.onZoomOut?.();
        return true;
      }
      break;

    case 'Tab':
      // Allow tab navigation but track it
      focusManagement.focusSource = 'keyboard';
      focusManagement.focusIndicatorVisible = true;
      return false; // Don't prevent default, allow normal tab behavior

    default:
      return false;
  }

  return false;
};

export const useCanvasInteractions = ({
  viewState,
  setSelectedImage,
  imagePlacementMap,
  unitSize,
  updateViewState,
  navigationSafety,
}: UseCanvasInteractionsProps) => {
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    time: number;
    isClickableArea: boolean;
  } | null>(null);

  // Phase 2 Step 7 Action 2: Touch physics state
  const touchPhysicsRef = useRef<TouchPhysics>({
    velocity: { x: 0, y: 0 },
    lastPositions: [],
    momentumAnimationId: null,
    isDecelerating: false,
  });

  const touchSettingsRef = useRef<TouchSettings>(getTouchSettings());

  // Phase 2 Step 8 Action 3: Canvas interaction safety system
  const canvasInteractionSafetyRef = useRef<CanvasInteractionSafety>(
    createCanvasInteractionSafety(),
  );

  // Phase 2 Step 8 Action 4: Canvas focus management system
  const canvasFocusManagementRef = useRef<CanvasFocusManagement>(createCanvasFocusManagement());

  // Phase 2 Step 8 Action 1: Navigation safety coordination
  const { withNavigationSafety, isNavigationSafe } = useNavigationSafety(
    navigationSafety || {
      loadingState: 'ready',
      imagesLoaded: true,
      canvasReady: true,
    },
  );

  // Phase 2 Step 8 Action 3: Update canvas safety state when navigation safety changes
  useEffect(() => {
    const safety = canvasInteractionSafetyRef.current;
    const canvasReady = navigationSafety?.canvasReady ?? true;

    if (safety.canvasReady !== canvasReady) {
      safety.canvasReady = canvasReady;

      // Reset error state when canvas becomes ready
      if (canvasReady) {
        safety.consecutiveErrors = 0;
        safety.isInErrorRecovery = false;
      }
    }
  }, [navigationSafety?.canvasReady]);

  // Phase 2 Step 8 Action 4: Update focus management state when navigation safety changes
  useEffect(() => {
    const focusManagement = canvasFocusManagementRef.current;
    const loadingState = navigationSafety?.loadingState ?? 'ready';
    const canvasReady = navigationSafety?.canvasReady ?? true;

    // Disable focus during loading phases
    const canReceiveFocus = loadingState === 'ready' && canvasReady;

    if (focusManagement.canReceiveFocus !== canReceiveFocus) {
      focusManagement.canReceiveFocus = canReceiveFocus;

      // If focus is disabled and currently focused, blur the canvas
      if (!canReceiveFocus && focusManagement.isFocused) {
        // Will be handled by the canvas focus effect
        console.debug('[Phase 2 Step 8 Action 4] Canvas focus disabled due to loading state');
      }
    }
  }, [navigationSafety?.loadingState, navigationSafety?.canvasReady]);

  const homeAreaWidth = unitSize * 2;
  const homeAreaHeight = unitSize;
  const homeAreaWorldX = -unitSize;
  const homeAreaWorldY = -unitSize;

  // Phase 2 Step 7 Action 2: Momentum physics implementation
  const startMomentumAnimation = useCallback(() => {
    const physics = touchPhysicsRef.current;
    const settings = touchSettingsRef.current;

    if (physics.isDecelerating || physics.momentumAnimationId) return;

    // Calculate initial velocity from recent positions (simpler, more responsive)
    if (physics.lastPositions.length < 2) return;

    const positions = physics.lastPositions;
    const latest = positions[positions.length - 1];
    const previous = positions[positions.length - 2];

    const timeDelta = latest.time - previous.time;
    if (timeDelta <= 0) return;

    const velocityX = (latest.x - previous.x) / timeDelta;
    const velocityY = (latest.y - previous.y) / timeDelta;

    // Only start momentum if velocity exceeds threshold
    const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    if (speed < settings.minimumVelocityThreshold) return;

    physics.velocity = { x: velocityX, y: velocityY };
    physics.isDecelerating = true;

    const animateMomentum = () => {
      const currentSpeed = Math.sqrt(
        physics.velocity.x * physics.velocity.x + physics.velocity.y * physics.velocity.y,
      );

      if (currentSpeed < settings.minimumVelocityThreshold) {
        physics.isDecelerating = false;
        physics.momentumAnimationId = null;
        physics.velocity = { x: 0, y: 0 };
        return;
      }

      // Apply momentum movement with device-optimized sensitivity
      const sensitivity = touchSettingsRef.current.touchSensitivity;
      updateViewState(physics.velocity.x * sensitivity, physics.velocity.y * sensitivity);

      // Apply friction
      physics.velocity.x *= settings.momentumFriction;
      physics.velocity.y *= settings.momentumFriction;

      physics.momentumAnimationId = requestAnimationFrame(animateMomentum);
    };

    physics.momentumAnimationId = requestAnimationFrame(animateMomentum);
  }, [updateViewState]);

  // Phase 2 Step 7 Action 2: Stop momentum on new interaction
  const stopMomentum = useCallback(() => {
    const physics = touchPhysicsRef.current;

    if (physics.momentumAnimationId) {
      cancelAnimationFrame(physics.momentumAnimationId);
      physics.momentumAnimationId = null;
    }

    physics.isDecelerating = false;
    physics.velocity = { x: 0, y: 0 };
    physics.lastPositions = [];
  }, []);

  // Phase 2 Step 7 Action 2: Lightweight position tracking for momentum
  const trackPosition = useCallback((x: number, y: number) => {
    const physics = touchPhysicsRef.current;
    const settings = touchSettingsRef.current;

    // Always track for momentum - no throttling for responsiveness
    physics.lastPositions.push({ x, y, time: performance.now() });

    // Keep only recent positions for smooth momentum calculation
    if (physics.lastPositions.length > settings.maxVelocityTrackingPoints) {
      physics.lastPositions.shift();
    }
  }, []);

  // Phase 2 Step 7 Action 2: Enhanced gesture detection
  const isQuickTap = useCallback(
    (startTime: number, startX: number, startY: number, endX: number, endY: number): boolean => {
      const settings = touchSettingsRef.current;
      const timeDelta = Date.now() - startTime;
      const distance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);

      return timeDelta < settings.tapTimeThreshold && distance < settings.tapDistanceThreshold;
    },
    [],
  );

  // Cleanup momentum animation on unmount
  useEffect(() => {
    return () => {
      stopMomentum();
    };
  }, [stopMomentum]);

  const handleClick = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      // Phase 2 Step 8 Action 3: Comprehensive canvas interaction safety
      const safety = canvasInteractionSafetyRef.current;

      try {
        // Rate limiting check
        const rateLimitCheck = checkInteractionRateLimit(safety);
        if (!rateLimitCheck.allowed) {
          console.debug(`[Phase 2 Step 8 Action 3] Click blocked: ${rateLimitCheck.reason}`);
          return;
        }

        // CRITICAL: Early exit if anything isn't ready (Firefox-specific safeguard)
        if (!viewState || !imagePlacementMap.current || !setSelectedImage) {
          throw new Error('Dependencies not ready for click handling');
        }

        // Canvas validation
        const canvas = event.currentTarget as HTMLCanvasElement;
        const canvasValidation = validateCanvasState(canvas, safety);
        if (!canvasValidation.valid) {
          throw new Error(`Canvas state invalid: ${canvasValidation.reason}`);
        }

        // Extract coordinates with validation
        let clientX: number;
        let clientY: number;

        if ('touches' in event) {
          // For touch events, use changedTouches if touches is empty (on touchend)
          const touch = event.touches[0] || event.changedTouches?.[0];
          if (!touch) {
            throw new Error('No touch data available');
          }
          clientX = touch.clientX;
          clientY = touch.clientY;
        } else {
          // Mouse event
          clientX = event.clientX;
          clientY = event.clientY;
        }

        // Coordinate validation and world coordinate calculation
        const coordinateValidation = validateCoordinates(
          clientX,
          clientY,
          canvas,
          viewState,
          safety,
        );
        if (!coordinateValidation.valid) {
          throw new Error(`Coordinate validation failed: ${coordinateValidation.reason}`);
        }

        const { worldX, worldY } = coordinateValidation;
        if (worldX === undefined || worldY === undefined) {
          throw new Error('World coordinates calculation failed');
        }

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
            // Phase 2 Step 8 Action 1: External links always allowed (forceAllow: true)
            withNavigationSafety(
              () => window.open('https://docs.aces.fun/', '_blank'),
              'docs-external-link',
              true,
            )();
            return;
          }

          if (
            worldX >= createQuadX &&
            worldX < createQuadX + quadWidth &&
            worldY >= createQuadY &&
            worldY < createQuadY + quadHeight
          ) {
            LuxuryLogger.log('CREATE quadrant clicked! Navigating to /create-token', 'info');
            // Phase 2 Step 8 Action 1: Protected navigation - blocks during loading
            withNavigationSafety(
              () => (window.location.href = '/create-token'),
              'create-token-home-area',
            )();
            return;
          }
          return;
        }

        let clickedImageInfo: ImageInfo | null = null;

        // Phase 2 Step 8 Action 3: Enhanced placement map validation
        if (!imagePlacementMap.current || imagePlacementMap.current.size === 0) {
          throw new Error('Image placement map not ready');
        }

        // Iterate over the placed items to find the one that was clicked
        for (const placedItem of imagePlacementMap.current.values()) {
          // Phase 2 Step 8 Action 3: Enhanced placement item validation
          if (!placedItem?.image) {
            continue; // Skip invalid items
          }

          const { image, x, y, width, height } = placedItem;

          // Validate placement coordinates
          if (
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            !Number.isFinite(width) ||
            !Number.isFinite(height)
          ) {
            continue; // Skip items with invalid coordinates
          }

          if (worldX >= x && worldX <= x + width && worldY >= y && worldY <= y + height) {
            clickedImageInfo = image;
            break;
          }
        }

        if (clickedImageInfo) {
          if (clickedImageInfo.type === 'create-token') {
            LuxuryLogger.log(`Create Token Square clicked`, 'info');
            // Phase 2 Step 8 Action 1: Protected navigation - blocks during loading
            withNavigationSafety(
              () => (window.location.href = '/create-token'),
              'create-token-image-click',
            )();
          } else {
            setSelectedImage(clickedImageInfo);
            const safeMetadata = getImageMetadata(clickedImageInfo);
            LuxuryLogger.log(`Product image clicked: ${safeMetadata.title}`, 'info');
          }
        }

        // Reset error count on successful interaction
        safety.consecutiveErrors = 0;
      } catch (error) {
        // Phase 2 Step 8 Action 3: Enhanced error handling with recovery
        const errorInstance = error instanceof Error ? error : new Error(String(error));
        handleInteractionError(safety, errorInstance);

        console.debug(
          '[Phase 2 Step 8 Action 3] Canvas click interaction failed:',
          errorInstance.message,
        );

        // Try fallback behavior for critical interactions
        if (errorInstance.message.includes('Dependencies not ready')) {
          // Still try to handle basic modal opening if possible
          console.debug('[Phase 2 Step 8 Action 3] Attempting fallback interaction handling');
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
      withNavigationSafety, // Phase 2 Step 8 Action 1: Navigation safety dependency
      canvasInteractionSafetyRef, // Phase 2 Step 8 Action 3: Canvas interaction safety dependency
    ],
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      // Phase 2 Step 8 Action 3: Rate limiting check for mouse interactions
      const safety = canvasInteractionSafetyRef.current;
      const rateLimitCheck = checkInteractionRateLimit(safety);
      if (!rateLimitCheck.allowed) {
        console.debug(`[Phase 2 Step 8 Action 3] Mouse down blocked: ${rateLimitCheck.reason}`);
        return;
      }

      // Only handle left mouse button for panning
      if (event.button !== 0) return;

      // Phase 2 Step 8 Action 4: Smart focus management for mouse interactions
      // Only focus canvas if it's not already focused to avoid disrupting momentum physics
      const canvas = event.currentTarget as HTMLCanvasElement;
      const focusManagement = canvasFocusManagementRef.current;

      // GOOGLE MAPS TOUCH FIX: Only focus if canvas isn't already focused to preserve momentum physics
      if (!focusManagement.isFocused || focusManagement.focusSource !== 'mouse') {
        const focusResult = manageFocus(canvas, focusManagement, 'focus', 'mouse');
        if (!focusResult.success) {
          console.debug(`[Phase 2 Step 8 Action 4] Canvas focus failed: ${focusResult.reason}`);
        }
      }

      // Phase 2 Step 7 Action 2: Stop any ongoing momentum
      stopMomentum();

      event.preventDefault();
      setIsDragging(false);
      dragStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        time: Date.now(),
        isClickableArea: false,
      };
      setLastMousePos({ x: event.clientX, y: event.clientY });
      setIsPanning(true);

      // Phase 2 Step 7 Action 2: Start position tracking for momentum
      trackPosition(event.clientX, event.clientY);
    },
    [stopMomentum, trackPosition, canvasInteractionSafetyRef, canvasFocusManagementRef],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isPanning) return;

      event.preventDefault();

      // Phase 2 Step 7 Action 2: Enhanced position tracking
      trackPosition(event.clientX, event.clientY);

      const deltaX = event.clientX - lastMousePos.x;
      const deltaY = event.clientY - lastMousePos.y;

      if (!isDragging && dragStartRef.current) {
        const settings = touchSettingsRef.current;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance > settings.dragDistanceThreshold) {
          setIsDragging(true);
        }
      }

      // Phase 2 Step 7 Action 2: Apply movement with device-optimized sensitivity
      const sensitivity = touchSettingsRef.current.mouseSensitivity;
      updateViewState(deltaX * sensitivity, deltaY * sensitivity);

      setLastMousePos({ x: event.clientX, y: event.clientY });
    },
    [isPanning, isDragging, updateViewState, trackPosition],
  );

  const handleMouseUp = useCallback(
    (event: React.MouseEvent) => {
      // Only handle left mouse button
      if (event.button !== 0) return;

      event.preventDefault();

      // Phase 2 Step 7 Action 2: Enhanced tap detection
      if (!isDragging && dragStartRef.current) {
        const isQuickClick = isQuickTap(
          dragStartRef.current.time,
          dragStartRef.current.x,
          dragStartRef.current.y,
          event.clientX,
          event.clientY,
        );

        if (isQuickClick) {
          handleClick(event);
        } else if (isPanning) {
          // Phase 2 Step 7 Action 2: Start momentum animation for mouse drag
          startMomentumAnimation();
        }
      }

      // Reset panning state
      setIsPanning(false);
      setIsDragging(false);
      dragStartRef.current = null;
    },
    [handleClick, isDragging, isPanning, isQuickTap, startMomentumAnimation],
  );

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      // Phase 2 Step 8 Action 3: Rate limiting check for touch interactions
      const safety = canvasInteractionSafetyRef.current;
      const rateLimitCheck = checkInteractionRateLimit(safety);
      if (!rateLimitCheck.allowed) {
        console.debug(`[Phase 2 Step 8 Action 3] Touch start blocked: ${rateLimitCheck.reason}`);
        return;
      }

      // Phase 2 Step 8 Action 4: Smart focus management for touch interactions
      // Only focus canvas if it's not already focused to avoid disrupting momentum physics
      const canvas = event.currentTarget as HTMLCanvasElement;
      const focusManagement = canvasFocusManagementRef.current;

      // GOOGLE MAPS TOUCH FIX: Only focus if canvas isn't already focused to preserve momentum physics
      if (!focusManagement.isFocused || focusManagement.focusSource !== 'touch') {
        const focusResult = manageFocus(canvas, focusManagement, 'focus', 'touch');
        if (!focusResult.success) {
          console.debug(`[Phase 2 Step 8 Action 4] Canvas focus failed: ${focusResult.reason}`);
        }
      }

      // Phase 2 Step 7 Action 2: Stop any ongoing momentum immediately
      stopMomentum();

      // Only handle single finger touch for panning (no zoom support)
      if (event.touches.length === 1) {
        const touch = event.touches[0];

        // SAFARI MOBILE FIX: Store touch information for reliable gesture detection
        // Check if this touch is on a clickable element for better gesture handling
        const canvas = event.currentTarget as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const worldX = (touch.clientX - rect.left - viewState.x) / viewState.scale;
        const worldY = (touch.clientY - rect.top - viewState.y) / viewState.scale;

        // Check if touching a create token square or home area
        const isClickableArea =
          // Home area check
          isHomeArea(
            worldX,
            worldY,
            homeAreaWorldX,
            homeAreaWorldY,
            homeAreaWidth,
            homeAreaHeight,
          ) ||
          // Create token square check (from imagePlacementMap)
          Array.from(imagePlacementMap.current?.values() || []).some((placedItem) => {
            if (!placedItem?.image) return false;
            const { image, x, y, width, height } = placedItem;
            return (
              image.type === 'create-token' &&
              worldX >= x &&
              worldX <= x + width &&
              worldY >= y &&
              worldY <= y + height
            );
          });

        setIsDragging(false);
        dragStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          time: Date.now(),
          isClickableArea,
        };
        setLastMousePos({ x: touch.clientX, y: touch.clientY });
        setIsPanning(true);

        // Phase 2 Step 7 Action 2: Start position tracking for momentum
        trackPosition(touch.clientX, touch.clientY);

        // SAFARI MOBILE FIX: For clickable areas, don't preventDefault to allow Safari to handle properly
        // For non-clickable areas, we can be more aggressive with preventDefault
        if (!isClickableArea) {
          event.preventDefault();
        }
      } else {
        // Multiple touches - prevent default to disable zoom/pinch
        event.preventDefault();
        setIsPanning(false);
        setIsDragging(false);
        dragStartRef.current = null;
      }
    },
    [
      stopMomentum,
      trackPosition,
      viewState,
      imagePlacementMap,
      homeAreaWorldX,
      homeAreaWorldY,
      homeAreaWidth,
      homeAreaHeight,
      canvasInteractionSafetyRef,
      canvasFocusManagementRef,
    ],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      // Only handle single finger touch for panning
      if (!isPanning || event.touches.length !== 1) {
        // Multiple touches - stop momentum and prevent zoom
        if (event.touches.length > 1) {
          stopMomentum();
          event.preventDefault();
        }
        return;
      }

      const touch = event.touches[0];

      // PERFORMANCE FIX: Skip safety checks for touchmove - only validate on start/end
      // This eliminates 5-10ms latency per touch move for smooth Google Maps tracking

      // Phase 2 Step 7 Action 2: Track position for momentum calculation
      trackPosition(touch.clientX, touch.clientY);

      const deltaX = touch.clientX - lastMousePos.x;
      const deltaY = touch.clientY - lastMousePos.y;

      if (!isDragging && dragStartRef.current) {
        const settings = touchSettingsRef.current;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance > settings.dragDistanceThreshold) {
          setIsDragging(true);
          // BRAVE MOBILE FIX: Only preventDefault when we're sure we're dragging
          event.preventDefault();
        }
      } else if (isDragging) {
        // Already dragging, prevent default
        event.preventDefault();
      }

      // Phase 2 Step 7 Action 2: Apply movement with mobile-optimized sensitivity (1:1 finger tracking)
      const sensitivity = touchSettingsRef.current.touchSensitivity;
      updateViewState(deltaX * sensitivity, deltaY * sensitivity);

      setLastMousePos({ x: touch.clientX, y: touch.clientY });
    },
    [isPanning, isDragging, updateViewState, trackPosition, stopMomentum],
  );

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      // SAFARI MOBILE FIX: Smart preventDefault based on interaction type
      // Only preventDefault if we were actually dragging, allow taps to be handled by browser
      if (isDragging) {
        event.preventDefault();
      }

      // Phase 2 Step 7 Action 2: Enhanced touch gesture detection
      if (!isDragging && dragStartRef.current) {
        // Use the last touch position from changedTouches (finger that was lifted)
        const lastTouch = event.changedTouches[0];
        if (lastTouch) {
          // SAFARI MOBILE FIX: More reliable tap detection with clickable area awareness
          const timeDelta = Date.now() - dragStartRef.current.time;
          const distance = Math.sqrt(
            (lastTouch.clientX - dragStartRef.current.x) ** 2 +
              (lastTouch.clientY - dragStartRef.current.y) ** 2,
          );

          // More generous thresholds for clickable areas to ensure Safari navigation works
          const isClickableArea = dragStartRef.current.isClickableArea;
          const timeThreshold = isClickableArea ? 300 : 200; // More time for clickable areas
          const distanceThreshold = isClickableArea ? 15 : 12; // More movement tolerance for clickable areas

          const isTap = timeDelta < timeThreshold && distance < distanceThreshold;

          if (isTap) {
            // SAFARI MOBILE FIX: For clickable areas, don't preventDefault to allow Safari navigation
            if (!isClickableArea) {
              event.preventDefault();
            }
            handleClick(event);
          }
        }
      } else if (isDragging && isPanning) {
        // Phase 2 Step 7 Action 2: Start momentum animation for touch gestures
        startMomentumAnimation();
      }

      // Reset panning state
      setIsPanning(false);
      setIsDragging(false);
      dragStartRef.current = null;
    },
    [handleClick, isDragging, isPanning, startMomentumAnimation],
  );

  // Phase 2 Step 8 Action 4: Keyboard event handler for canvas navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const focusManagement = canvasFocusManagementRef.current;

      // Only handle keyboard events when canvas is focused and navigation is enabled
      if (!focusManagement.isFocused || !focusManagement.keyboardNavigationEnabled) {
        return;
      }

      const handled = handleKeyboardNavigation(event.nativeEvent, focusManagement, {
        onNavigateHome: () => {
          // Navigate to home area - this would typically call animateToHome
          console.debug('[Phase 2 Step 8 Action 4] Keyboard navigation: Home');
        },
        onNavigateCreateToken: () => {
          // Navigate to create token
          withNavigationSafety(
            () => (window.location.href = '/create-token'),
            'keyboard-create-token',
          )();
        },
        onToggleModal: () => {
          // Close modal if open
          if (setSelectedImage) {
            setSelectedImage(null);
          }
        },
        // Note: Zoom functionality would require integration with view state
      });

      if (handled) {
        console.debug('[Phase 2 Step 8 Action 4] Keyboard interaction handled:', event.key);
      }
    },
    [canvasFocusManagementRef, withNavigationSafety, setSelectedImage],
  );

  // Phase 2 Step 8 Action 4: Focus event handler
  const handleFocus = useCallback(
    (event: React.FocusEvent) => {
      const canvas = event.currentTarget as HTMLCanvasElement;
      const focusManagement = canvasFocusManagementRef.current;

      if (focusManagement.canReceiveFocus) {
        const focusResult = manageFocus(canvas, focusManagement, 'focus', 'keyboard');
        if (focusResult.success) {
          console.debug('[Phase 2 Step 8 Action 4] Canvas focused via keyboard/tab navigation');
        }
      }
    },
    [canvasFocusManagementRef],
  );

  // Phase 2 Step 8 Action 4: Blur event handler
  const handleBlur = useCallback(
    (event: React.FocusEvent) => {
      const canvas = event.currentTarget as HTMLCanvasElement;
      const focusManagement = canvasFocusManagementRef.current;

      const focusResult = manageFocus(canvas, focusManagement, 'blur');
      if (focusResult.success) {
        console.debug('[Phase 2 Step 8 Action 4] Canvas blurred');
      }
    },
    [canvasFocusManagementRef],
  );

  // Phase 2 Step 8 Action 4: Cleanup focus state on unmount
  useEffect(() => {
    return () => {
      const focusManagement = canvasFocusManagementRef.current;

      // Restore focus if needed
      if (focusManagement.shouldRestoreFocus && focusManagement.previousActiveElement) {
        try {
          (focusManagement.previousActiveElement as HTMLElement).focus();
        } catch (error) {
          console.debug('[Phase 2 Step 8 Action 4] Focus restoration on unmount failed:', error);
        }
      }
    };
  }, [canvasFocusManagementRef]);

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
    // Phase 2 Step 8 Action 4: Focus and keyboard event handlers
    handleKeyDown,
    handleFocus,
    handleBlur,
    // Phase 2 Step 8 Action 4: Focus management state (for external access)
    focusManagement: canvasFocusManagementRef.current,
  };
};
