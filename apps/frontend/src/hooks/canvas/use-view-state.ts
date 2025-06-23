'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type React from 'react';
import { lerp, easeInOutCubic } from '../../lib/canvas/math-utils';
import type { ViewState } from '../../types/canvas';

interface UseViewStateProps {
  imagesLoaded: boolean;
  _unitSize?: number; // optional, ignored
  initialX?: number;
  initialY?: number;
  initialScale?: number;
  panSensitivity?: number;
  animationDuration?: number;
  panInterpolationFactor?: number;
}

// Phase 2 Step 4 Action 4: State Synchronization Safety
// Prevents race conditions and conflicting state updates
interface StateSynchronization {
  batchUpdates: React.MutableRefObject<boolean>;
  pendingUpdates: React.MutableRefObject<(() => void)[]>;
  flushTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
}

const useStateSynchronization = (): StateSynchronization => {
  const batchUpdates = useRef(false);
  const pendingUpdates = useRef<(() => void)[]>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  return {
    batchUpdates,
    pendingUpdates,
    flushTimeoutRef,
  };
};

// Phase 2 Step 4 Action 4: Batch state updates to prevent synchronization conflicts
const batchStateUpdate = (
  sync: StateSynchronization,
  updateFn: () => void,
  priority: 'high' | 'normal' = 'normal',
): void => {
  if (sync.batchUpdates.current) {
    // Add to pending updates
    if (priority === 'high') {
      sync.pendingUpdates.current.unshift(updateFn); // High priority at start
    } else {
      sync.pendingUpdates.current.push(updateFn); // Normal priority at end
    }
    return;
  }

  // Execute immediately if not batching
  updateFn();
};

// Phase 2 Step 4 Action 4: Flush all pending state updates safely
const flushPendingUpdates = (sync: StateSynchronization): void => {
  if (sync.pendingUpdates.current.length === 0) return;

  // Clear any existing flush timeout
  if (sync.flushTimeoutRef.current) {
    clearTimeout(sync.flushTimeoutRef.current);
    sync.flushTimeoutRef.current = null;
  }

  // Execute all pending updates in a single frame
  sync.flushTimeoutRef.current = setTimeout(() => {
    const updates = [...sync.pendingUpdates.current];
    sync.pendingUpdates.current = [];

    updates.forEach((updateFn) => {
      try {
        updateFn();
      } catch (error) {
        console.error('[Phase 2 Step 4] State update error:', error);
      }
    });

    sync.flushTimeoutRef.current = null;
  }, 0);
};

// Phase 2 Step 4 Action 4: Start batch mode for coordinated updates
const startBatchUpdates = (sync: StateSynchronization): void => {
  sync.batchUpdates.current = true;
};

// Phase 2 Step 4 Action 4: End batch mode and flush all pending updates
const endBatchUpdates = (sync: StateSynchronization): void => {
  sync.batchUpdates.current = false;
  flushPendingUpdates(sync);
};

// Phase 2 Step 4 Action 1: Lightweight Animation Coordination
// Eliminates stale closure race conditions without degrading scrolling performance
interface AnimationCoordination {
  isActive: React.MutableRefObject<boolean>;
  activeCount: React.MutableRefObject<number>;
  lastSource: React.MutableRefObject<string | null>;
}

const useAnimationCoordination = (): AnimationCoordination => {
  const isActive = useRef(false);
  const activeCount = useRef(0);
  const lastSource = useRef<string | null>(null);

  return {
    isActive,
    activeCount,
    lastSource,
  };
};

// Phase 2 Step 4 Action 1: Lightweight animation start/end functions
const startLightweightAnimation = (
  coordination: AnimationCoordination,
  setIsAnimating: (value: boolean) => void,
  source: string,
): void => {
  coordination.activeCount.current++;
  coordination.lastSource.current = source;

  if (!coordination.isActive.current) {
    coordination.isActive.current = true;
    setIsAnimating(true);
    // Only log for non-wheel events to avoid scrolling overhead
    if (source !== 'wheel') {
      console.debug(`[Phase 2 Step 4] Animation started: ${source}`);
    }
  }
};

const endLightweightAnimation = (
  coordination: AnimationCoordination,
  setIsAnimating: (value: boolean) => void,
  source: string,
): void => {
  coordination.activeCount.current = Math.max(0, coordination.activeCount.current - 1);

  if (coordination.activeCount.current === 0 && coordination.isActive.current) {
    coordination.isActive.current = false;
    setIsAnimating(false);
    coordination.lastSource.current = null;
    // Only log for non-wheel events to avoid scrolling overhead
    if (source !== 'wheel') {
      console.debug(`[Phase 2 Step 4] Animation ended: ${source}`);
    }
  }
};

export const useViewState = ({
  imagesLoaded,
  _unitSize, // ignored
  initialX = 0,
  initialY = 0,
  initialScale = 1,
  animationDuration = 0.15,
  panInterpolationFactor = 0.3,
}: UseViewStateProps) => {
  void _unitSize; // explicitly ignore _unitSize to satisfy linter
  const [viewState, setViewState] = useState<ViewState>({
    x: initialX,
    y: initialY,
    scale: initialScale,
    targetX: initialX,
    targetY: initialY,
    targetScale: initialScale,
  });
  const [showHomeButton, setShowHomeButton] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Phase 2 Step 4 Action 1: Replace heavyweight manager with lightweight coordination
  const animationCoordination = useAnimationCoordination();

  // Phase 2 Step 4 Action 4: State synchronization for coordinated updates
  const stateSynchronization = useStateSynchronization();

  const viewStateRef = useRef(viewState);

  viewStateRef.current = viewState;

  const animationStartTime = useRef(0);
  const velocityX = useRef(0);
  const velocityY = useRef(0);
  const friction = 0.9;
  const homeAnimationDuration = useRef(0.8);
  const centeredOnce = useRef(false);

  const canvasWidth = useRef(0);
  const canvasHeight = useRef(0);

  canvasWidth.current = typeof window !== 'undefined' ? window.innerWidth : 1024;
  canvasHeight.current = typeof window !== 'undefined' ? window.innerHeight : 768;

  useEffect(() => {
    if (!imagesLoaded || centeredOnce.current) return;

    const currentUnitSize = canvasWidth.current < 768 ? 150 : 200;
    const currentHomeAreaWidth = currentUnitSize * 2;
    const currentHomeAreaHeight = currentUnitSize;
    const currentHomeAreaWorldX = -currentUnitSize;
    const currentHomeAreaWorldY = -currentUnitSize;

    const screenCenterX = canvasWidth.current / 2;
    const screenCenterY = canvasHeight.current / 2;

    const newX = screenCenterX - (currentHomeAreaWorldX + currentHomeAreaWidth / 2) * initialScale;
    const newY = screenCenterY - (currentHomeAreaWorldY + currentHomeAreaHeight / 2) * initialScale;

    setViewState((prev) => ({
      ...prev,
      x: newX,
      y: newY,
      targetX: newX,
      targetY: newY,
    }));

    centeredOnce.current = true;
  }, [imagesLoaded, initialScale]);

  const showHomeButtonDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const initialScaleRef = useRef(initialScale);
  initialScaleRef.current = initialScale;

  // CRITICAL FIX: Use ref pattern to prevent infinite re-renders
  const updateHomeButtonVisibility = useCallback(() => {
    // Clear existing timeout
    if (showHomeButtonDebounceRef.current) {
      clearTimeout(showHomeButtonDebounceRef.current);
    }

    showHomeButtonDebounceRef.current = setTimeout(() => {
      const currentUnitSize = canvasWidth.current < 768 ? 150 : 200;
      const currentHomeAreaWidth = currentUnitSize * 2;
      const currentHomeAreaHeight = currentUnitSize;
      const currentHomeAreaWorldX = -currentUnitSize;
      const currentHomeAreaWorldY = -currentUnitSize;

      const vsRef = viewStateRef.current;
      const homeAreaCenterX =
        (currentHomeAreaWorldX + currentHomeAreaWidth / 2) * vsRef.scale + vsRef.x;
      const homeAreaCenterY =
        (currentHomeAreaWorldY + currentHomeAreaHeight / 2) * vsRef.scale + vsRef.y;

      const screenCenterX = canvasWidth.current / 2;
      const screenCenterY = canvasHeight.current / 2;

      const panThresholdX = canvasWidth.current / 4;
      const panThresholdY = canvasHeight.current / 4;
      const scaleThreshold = 0.1;

      const isPannedFar =
        Math.abs(homeAreaCenterX - screenCenterX) > panThresholdX ||
        Math.abs(homeAreaCenterY - screenCenterY) > panThresholdY;

      const isZoomedEnough =
        Math.abs(vsRef.scale - initialScaleRef.current) / initialScaleRef.current > scaleThreshold;

      setShowHomeButton(isPannedFar || isZoomedEnough);
    }, 100);
  }, []); // CRITICAL FIX: Remove initialScale dependency to prevent infinite re-renders

  // Store the function in a ref to access latest version
  const updateHomeButtonVisibilityRef = useRef(updateHomeButtonVisibility);
  useEffect(() => {
    updateHomeButtonVisibilityRef.current = updateHomeButtonVisibility;
  }, [updateHomeButtonVisibility]);

  const prevTargetRef = useRef({
    x: viewState.targetX,
    y: viewState.targetY,
    scale: viewState.targetScale,
  });

  useEffect(() => {
    const prev = prevTargetRef.current;
    const current = { x: viewState.targetX, y: viewState.targetY, scale: viewState.targetScale };

    if (prev.x !== current.x || prev.y !== current.y || prev.scale !== current.scale) {
      updateHomeButtonVisibilityRef.current(); // CRITICAL FIX: Use ref to prevent dependency loop
      prevTargetRef.current = current;
    }

    return () => {
      if (showHomeButtonDebounceRef.current) {
        clearTimeout(showHomeButtonDebounceRef.current);
      }
    };
  }, [viewState.targetX, viewState.targetY, viewState.targetScale]); // CRITICAL FIX: Removed updateHomeButtonVisibility

  const animateToHome = useCallback(() => {
    const currentUnitSize = canvasWidth.current < 768 ? 150 : 200;
    const currentHomeAreaWidth = currentUnitSize * 2;
    const currentHomeAreaHeight = currentUnitSize;
    const currentHomeAreaWorldX = -currentUnitSize;
    const currentHomeAreaWorldY = -currentUnitSize;

    const screenCenterX = canvasWidth.current / 2;
    const screenCenterY = canvasHeight.current / 2;

    const targetX =
      screenCenterX - (currentHomeAreaWorldX + currentHomeAreaWidth / 2) * initialScale;
    const targetY =
      screenCenterY - (currentHomeAreaWorldY + currentHomeAreaHeight / 2) * initialScale;

    velocityX.current = 0;
    velocityY.current = 0;

    setViewState((prev) => ({
      ...prev,
      targetX: targetX,
      targetY: targetY,
      targetScale: initialScale,
    }));

    animationStartTime.current = performance.now();
    setIsAnimating(true);
  }, [initialScale]);

  const animateViewState = useCallback(() => {
    const elapsed = performance.now() - animationStartTime.current;
    const progress = Math.min(1, elapsed / (homeAnimationDuration.current * 1000));
    const easedProgress = easeInOutCubic(progress);

    setViewState((prev) => {
      const newX = lerp(prev.x, prev.targetX, easedProgress);
      const newY = lerp(prev.y, prev.targetY, easedProgress);
      const newScale = lerp(prev.scale, prev.targetScale, easedProgress);

      if (progress === 1) {
        setIsAnimating(false);
        return {
          x: prev.targetX,
          y: prev.targetY,
          scale: prev.targetScale,
          targetX: prev.targetX,
          targetY: prev.targetY,
          targetScale: prev.targetScale,
        };
      }

      return {
        x: newX,
        y: newY,
        scale: newScale,
        targetX: prev.targetX,
        targetY: prev.targetY,
        targetScale: prev.targetScale,
      };
    });
  }, []);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLCanvasElement>) => {
      event.preventDefault();

      let deltaX = event.deltaX;
      let deltaY = event.deltaY;

      const isTrackpad = event.deltaMode === 0 && Math.abs(event.deltaY) < 100;
      const sensitivity = isTrackpad ? 1.0 : 2.0;
      deltaX *= sensitivity;
      deltaY *= sensitivity;

      setViewState((prev) => {
        const zoomFactor = 1 / Math.max(0.1, prev.scale);
        const adjustedDeltaX = deltaX * zoomFactor;
        const adjustedDeltaY = deltaY * zoomFactor;

        // Phase 2 Step 4 Action 1: For wheel events, update position immediately for smooth scrolling
        const newX = prev.x - adjustedDeltaX;
        const newY = prev.y - adjustedDeltaY;
        const newTargetX = prev.targetX - adjustedDeltaX;
        const newTargetY = prev.targetY - adjustedDeltaY;

        return {
          ...prev,
          x: newX,
          y: newY,
          targetX: newTargetX,
          targetY: newTargetY,
        };
      });

      // Phase 2 Step 4 Action 1: Wheel events don't need animation coordination (immediate updates)
      // No startLightweightAnimation call needed for wheel events
    },
    [], // No dependencies needed for wheel events
  );

  const updateViewState = useCallback(
    (deltaX: number, deltaY: number) => {
      const sensitivity = 0.05; // Reverted to original value to maintain proper navigation feel
      const adjustedDeltaX = deltaX * sensitivity;
      const adjustedDeltaY = deltaY * sensitivity;

      setViewState((prev) => {
        // Phase 2 Step 4 Action 1: For touch events, update position immediately like wheel events
        const newX = prev.x + adjustedDeltaX;
        const newY = prev.y + adjustedDeltaY;
        const newTargetX = prev.targetX + adjustedDeltaX;
        const newTargetY = prev.targetY + adjustedDeltaY;

        return {
          ...prev,
          x: newX,
          y: newY,
          targetX: newTargetX,
          targetY: newTargetY,
        };
      });

      // Phase 2 Step 4 Action 1: Touch events don't need animation coordination (immediate updates)
      // No startLightweightAnimation call needed for touch events
    },
    [], // No dependencies needed for touch events
  );

  // Phase 2 Step 4 Action 1 & 4: Cleanup coordination and state synchronization on unmount
  useEffect(() => {
    return () => {
      // Phase 2 Step 4 Action 4: Clean up state synchronization
      if (stateSynchronization.flushTimeoutRef.current) {
        clearTimeout(stateSynchronization.flushTimeoutRef.current);
        stateSynchronization.flushTimeoutRef.current = null;
      }
      stateSynchronization.batchUpdates.current = false;
      stateSynchronization.pendingUpdates.current = [];

      // Phase 2 Step 4 Action 1: Clean up animation coordination
      if (animationCoordination.isActive.current) {
        animationCoordination.isActive.current = false;
        animationCoordination.activeCount.current = 0;
        animationCoordination.lastSource.current = null;
        setIsAnimating(false);
      }
    };
  }, [animationCoordination, stateSynchronization]);

  return {
    viewState,
    handleWheel,
    animateViewState,
    isAnimating,
    animateToHome,
    showHomeButton,
    updateViewState,
    targetX: viewState.targetX,
    targetY: viewState.targetY,
    targetScale: viewState.targetScale,
  };
};
