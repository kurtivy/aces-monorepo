'use client';

import type React from 'react';
import { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

import ImageDetailsModal from '../ui/custom/image-details-modal';
import IntroAnimation from '../loading/intro-animation';
import { useImageLoader } from '../../hooks/canvas/use-image-loader';
import { useViewState } from '../../hooks/canvas/use-view-state';
import { useCanvasInteractions } from '../../hooks/canvas/use-canvas-interactions';
import { useCanvasRenderer } from '../../hooks/canvas/use-canvas-renderer';
import HomeButton from '../ui/custom/home-button';
import NavMenu from '../ui/custom/nav-menu';
import type { ImageInfo } from '../../types/canvas';
import { useCoordinatedResize } from '../../hooks/use-coordinated-resize';
import {
  browserUtils,
  getDeviceCapabilities,
  mobileUtils,
  setScrollRestoration,
  getScrollRestoration,
} from '../../lib/utils/browser-utils';
import {
  addEventListenerSafe,
  removeEventListenerSafe,
} from '../../lib/utils/event-listener-utils';
import { performEventListenerHealthCheck } from '../../lib/utils/event-listener-utils';
// Phase 2 Step 8 Action 1: Navigation safety coordination
import { useNavigationSafety } from '../../hooks/use-navigation-safety';
// Note: useAnimationFrame removed - caused scroll timing issues, kept for background animations only

type LoadingState = 'loading' | 'ready';

const InfiniteCanvas = () => {
  const [selectedImage, setSelectedImage] = useState<ImageInfo | null>(null);

  const [loadingState, setLoadingState] = useState<LoadingState>('loading');

  // Restore session memory for intro animation
  const [hasSeenIntro, setHasSeenIntro] = useState(false);

  const imagePlacementMapRef = useRef(
    new Map<string, { image: ImageInfo; x: number; y: number; width: number; height: number }>(),
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { unitSize } = useCoordinatedResize({ canvasRef });

  const { images, imagesLoaded } = useImageLoader({
    unitSize: 200,
    enableLazyLoading: true,
  });

  const { viewState, handleWheel, animateViewState, isAnimating, animateToHome, updateViewState } =
    useViewState({
      imagesLoaded: imagesLoaded,
      _unitSize: unitSize,
      animationDuration: browserUtils.getAnimationDuration() / 1000, // Convert ms to seconds for useViewState
    });

  // Phase 2 Step 8 Action 1: Navigation safety for canvas renderer callback
  const { withNavigationSafety } = useNavigationSafety({
    loadingState,
    imagesLoaded,
    canvasReady: false, // Initial state, will be updated by useCanvasRenderer
  });

  const { canvasReady, repeatedPlacements, repeatedTokens } = useCanvasRenderer({
    images,
    viewState,
    imagesLoaded: imagesLoaded,
    canvasVisible: loadingState !== 'loading' || hasSeenIntro,
    onCreateTokenClick: withNavigationSafety(() => (window.location.href = '/mint-token')),
    imagePlacementMap: imagePlacementMapRef,
    unitSize: unitSize,
    canvasRef: canvasRef,
  });

  const imagesRef = useRef(images);
  imagesRef.current = images;

  const {
    isPanning,
    isDragging,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    stopMomentum,
  } = useCanvasInteractions({
    viewState,
    setSelectedImage,
    imagePlacementMap: imagePlacementMapRef,
    unitSize,
    updateViewState,
    canvasRef,
    repeatedPlacements,
    repeatedTokens,
  });

  const interactionsEnabled = loadingState === 'ready' && imagesLoaded;

  // Phase 2 Step 2: Safe view state animation with proper cleanup
  useEffect(() => {
    if (loadingState !== 'ready' || !imagesLoaded || !isAnimating) return;

    let animationFrameId: number | null = null;
    let isAnimationActive = true;

    const animate = () => {
      if (!isAnimationActive || !isAnimating) return; // Double check animation state

      animateViewState();

      if (isAnimationActive && isAnimating) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      // Phase 2 Step 2: Fix cleanup race conditions for view state
      isAnimationActive = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };
  }, [loadingState, imagesLoaded, isAnimating, animateViewState]); // Phase 2 Step 4 Action 3: Added missing animateViewState dependency

  // Phase 2 Step 7 Action 4: Mobile loading state monitoring and validation
  useEffect(() => {
    const capabilities = getDeviceCapabilities();
    if (!capabilities.touchCapable && !capabilities.isMobileSafari) {
      return; // Desktop - no mobile validation needed
    }

    const validation = mobileUtils.validateMobileLoadingState(
      loadingState,
      imagesLoaded,
      canvasReady,
    );

    if (!validation.valid) {
      // Continue - canvas interactions will still work without wheel events
    }
  }, [loadingState, imagesLoaded, canvasReady]);

  // Smart loading completion handler with session memory
  const handleLoadingComplete = () => {
    // Mark as seen for this session
    try {
      // Only set session storage if we're actually completing the loading
      if (loadingState === 'loading') {
        sessionStorage.setItem('hasSeenIntro', 'true');
        setHasSeenIntro(true); // Update local state to match storage
        setLoadingState('ready');
      }
    } catch (error) {
      // sessionStorage not available, continue anyway
      setHasSeenIntro(true); // Still update local state
      setLoadingState('ready');
    }
  };

  // Phase 2 Step 3: Enhanced wheel event listener with ref change protection
  // CRITICAL FIX: Store handleWheel in a ref to prevent infinite re-renders
  const handleWheelRef = useRef(handleWheel);
  // Update the ref whenever handleWheel changes, but don't create dependency loop
  handleWheelRef.current = handleWheel;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !interactionsEnabled) return;

    // Phase 2 Step 3: Store canvas reference for cleanup validation
    const currentCanvas = canvas;

    const wheelListener = (e: Event) => {
      // Phase 2 Step 3: Validate canvas is still the same element
      if (canvasRef.current !== currentCanvas) return;

      try {
        handleWheelRef.current(e as unknown as React.WheelEvent<HTMLCanvasElement>);
      } catch (error) {
        // Wheel handler error - continue silently
      }
    };

    // Phase 2 Step 3 Action 5: Enhanced error handling for wheel event listener
    const wheelListenerResult = addEventListenerSafe(currentCanvas, 'wheel', wheelListener);

    if (wheelListenerResult.success) {
      currentCanvas.tabIndex = -1;

      try {
        currentCanvas.focus();
      } catch (focusError) {
        // Wheel handler error - continue silently
      }

      if (wheelListenerResult.fallbackApplied) {
        // Continue - canvas interactions will still work without wheel events
      }
    } else {
      // Continue - canvas interactions will still work without wheel events
    }

    return () => {
      // Phase 2 Step 3 Action 5: Enhanced cleanup with error handling
      if (wheelListenerResult.success && currentCanvas) {
        const removeResult = removeEventListenerSafe(currentCanvas, 'wheel', wheelListener);
        if (!removeResult.success) {
          // Continue - canvas interactions will still work without wheel events
        }
      }
    };
  }, [canvasRef, interactionsEnabled]);

  // Phase 2 Step 8 Action 2: Cross-browser scroll restoration safety
  useEffect(() => {
    // Store original setting for restoration
    const originalSetting = getScrollRestoration();

    // Set to manual with feature detection
    const wasSet = setScrollRestoration('manual');

    if (wasSet) {
      // Continue - canvas interactions will still work without scroll restoration
    }

    return () => {
      // Restore original setting or fallback to auto
      if (wasSet) {
        const restored = setScrollRestoration(originalSetting || 'auto');
        if (restored) {
          // Continue - canvas interactions will still work without scroll restoration
        }
      }
    };
  }, []);

  // Phase 2 Step 3: Enhanced wheel event listener with ref change protection
  // CRITICAL FIX: Store handleWheel in a ref to prevent infinite re-renders
  const handleWheelRef2 = useRef(handleWheel);
  // Update the ref whenever handleWheel changes, but don't create dependency loop
  handleWheelRef2.current = handleWheel;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !interactionsEnabled) return;

    // Phase 2 Step 3: Store canvas reference for cleanup validation
    const currentCanvas = canvas;

    const wheelListener2 = (e: Event) => {
      // Phase 2 Step 3: Validate canvas is still the same element
      if (canvasRef.current !== currentCanvas) return;

      try {
        handleWheelRef2.current(e as unknown as React.WheelEvent<HTMLCanvasElement>);
      } catch (error) {
        // Wheel handler error - continue silently
      }
    };

    // Phase 2 Step 3 Action 5: Enhanced error handling for wheel event listener
    const wheelListenerResult2 = addEventListenerSafe(currentCanvas, 'wheel', wheelListener2);

    if (wheelListenerResult2.success) {
      currentCanvas.tabIndex = -1;

      try {
        currentCanvas.focus();
      } catch (focusError) {
        // Wheel handler error - continue silently
      }

      if (wheelListenerResult2.fallbackApplied) {
        // Continue - canvas interactions will still work without wheel events
      }
    } else {
      // Continue - canvas interactions will still work without wheel events
    }

    return () => {
      // Phase 2 Step 3 Action 5: Enhanced cleanup with error handling
      if (wheelListenerResult2.success && currentCanvas) {
        const removeResult = removeEventListenerSafe(currentCanvas, 'wheel', wheelListener2);
        if (!removeResult.success) {
          // Continue - canvas interactions will still work without wheel events
        }
      }
    };
  }, [canvasRef, interactionsEnabled]); // CRITICAL FIX: Removed handleWheel from dependency array

  // Phase 2 Step 3 Action 4: Stable onClose callback to prevent modal event listener race conditions
  const handleModalClose = useCallback(() => {
    setSelectedImage(null);
  }, []);

  // Stop momentum before animating to home to prevent skewing
  const handleHomeClick = useCallback(() => {
    stopMomentum(); // Cancel any ongoing touch momentum
    animateToHome(); // Then animate to home position
  }, [stopMomentum, animateToHome]);

  // Phase 2 Step 3 Action 5: Demonstrate enhanced error handling on component mount
  useEffect(() => {
    // Run health check to validate enhanced error handling
    performEventListenerHealthCheck();
  }, []); // Run once on mount

  // Check if user has seen intro animation in this session
  useEffect(() => {
    const checkIntroStatus = () => {
      try {
        const sessionValue = sessionStorage.getItem('hasSeenIntro');
        const seenIntro = sessionValue === 'true';

        setHasSeenIntro(seenIntro);
        // If they've seen the intro, we should also set loading state to ready
        if (seenIntro) {
          setLoadingState('ready');
        }
      } catch (error) {
        setHasSeenIntro(false);
      }
    };

    checkIntroStatus();
  }, []);

  return (
    <>
      {/* Navigation Menu - only show when canvas is fully loaded */}
      {loadingState === 'ready' && canvasReady && <NavMenu />}

      {/* Loading screen with new aces.fun intro animation */}
      {loadingState === 'loading' && !hasSeenIntro && (
        <IntroAnimation
          onIntroAnimationComplete={handleLoadingComplete}
          isComplete={imagesLoaded && canvasReady}
          skipLetterAnimation={hasSeenIntro}
        />
      )}

      {/* Main Canvas */}
      <motion.div
        className="fixed inset-0"
        style={{ zIndex: 40 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: loadingState === 'ready' || hasSeenIntro ? 1 : 0 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: loadingState === 'ready' ? 0.2 : 0 }}
        onAnimationComplete={() => {
          // Animation completion is now handled cleanly without debugging timers
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={interactionsEnabled ? handleMouseDown : undefined}
          onMouseMove={interactionsEnabled ? handleMouseMove : undefined}
          onMouseUp={interactionsEnabled ? handleMouseUp : undefined}
          onMouseLeave={interactionsEnabled ? handleMouseLeave : undefined}
          onTouchStart={interactionsEnabled ? handleTouchStart : undefined}
          onTouchMove={interactionsEnabled ? handleTouchMove : undefined}
          onTouchEnd={interactionsEnabled ? handleTouchEnd : undefined}
          className="w-full h-full touch-none select-none"
          style={{
            cursor: interactionsEnabled
              ? isPanning
                ? 'grabbing'
                : isDragging
                  ? 'grabbing'
                  : 'pointer'
              : 'default',
          }}
        />
      </motion.div>

      {/* Modals and UI */}
      <ImageDetailsModal imageInfo={selectedImage} onClose={handleModalClose} />
      {loadingState === 'ready' && canvasReady && !selectedImage && (
        <HomeButton onClick={handleHomeClick} />
      )}
    </>
  );
};

export default InfiniteCanvas;
