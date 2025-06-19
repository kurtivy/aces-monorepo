'use client';

import type React from 'react';
import { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

import ImageDetailsModal from '../ui/image-details-modal';
import IntroAnimation from '../loading/intro-animation';
import TopLoadingBar from '../loading/top-loading-bar';
import { useImageLoader } from '../../hooks/canvas/use-image-loader';
import { useViewState } from '../../hooks/canvas/use-view-state';
import { useCanvasInteractions } from '../../hooks/canvas/use-canvas-interactions';
import { useCanvasRenderer } from '../../hooks/canvas/use-canvas-renderer';
import HomeButton from '../ui/home-button';
import NavMenu from '../ui/nav-menu';
import type { ImageInfo } from '../../types/canvas';
import { useCoordinatedResize } from '../../hooks/use-coordinated-resize';
import { browserUtils } from '../../lib/utils/browser-utils';
import {
  addEventListenerSafe,
  removeEventListenerSafe,
} from '../../lib/utils/event-listener-utils';
import { performEventListenerHealthCheck } from '../../lib/utils/event-listener-utils';
// Note: useAnimationFrame removed - caused scroll timing issues, kept for background animations only

type LoadingState = 'loading' | 'intro' | 'ready';

const InfiniteCanvas = () => {
  const [selectedImage, setSelectedImage] = useState<ImageInfo | null>(null);

  const [loadingState, setLoadingState] = useState<LoadingState>('loading');

  const [hasSeenIntro, setHasSeenIntro] = useState(false);

  const imagePlacementMapRef = useRef(
    new Map<string, { image: ImageInfo; x: number; y: number; width: number; height: number }>(),
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const checkIntroStatus = () => {
      try {
        const seenIntro = sessionStorage.getItem('hasSeenIntro') === 'true';
        setHasSeenIntro(seenIntro);
      } catch (error) {
        setHasSeenIntro(false);
      }
    };

    checkIntroStatus();
  }, []);

  const { unitSize } = useCoordinatedResize({ canvasRef });

  const { images, imagesLoaded, loadingProgress } = useImageLoader({
    unitSize: 200,
    enableLazyLoading: true,
  });

  const {
    viewState,
    handleWheel,
    animateViewState,
    isAnimating,
    animateToHome,
    showHomeButton,
    updateViewState,
  } = useViewState({
    imagesLoaded: imagesLoaded,
    _unitSize: unitSize,
    animationDuration: browserUtils.getAnimationDuration() / 1000, // Convert ms to seconds for useViewState
  });

  const { canvasProgress, canvasReady } = useCanvasRenderer({
    images,
    viewState,
    imagesLoaded: imagesLoaded,
    canvasVisible: loadingState !== 'loading',
    onCreateTokenClick: () => {
      window.location.href = '/create-token';
    },
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
  } = useCanvasInteractions({
    viewState,
    imagesRef,
    setSelectedImage,
    imagePlacementMap: imagePlacementMapRef,
    unitSize: unitSize,
    updateViewState,
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

  const handleInitialLoadComplete = () => {
    if (hasSeenIntro) {
      setLoadingState('ready');
    } else {
      setLoadingState('intro');
    }
  };

  const handleIntroComplete = () => {
    try {
      sessionStorage.setItem('hasSeenIntro', 'true');
    } catch (error) {}

    setLoadingState('ready');
  };

  // Phase 2 Step 3: Enhanced wheel event listener with ref change protection
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !interactionsEnabled) return;

    // Phase 2 Step 3: Store canvas reference for cleanup validation
    const currentCanvas = canvas;

    const wheelListener = (e: Event) => {
      // Phase 2 Step 3: Validate canvas is still the same element
      if (canvasRef.current !== currentCanvas) return;

      try {
        handleWheel(e as unknown as React.WheelEvent<HTMLCanvasElement>);
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
        console.warn('[Phase 2 Step 3] Canvas focus failed:', focusError);
      }

      if (wheelListenerResult.fallbackApplied) {
        console.info('[Phase 2 Step 3] Wheel event listener using fallback strategy');
      }
    } else {
      console.warn(
        '[Phase 2 Step 3] Wheel event listener setup failed:',
        wheelListenerResult.details,
      );
      // Continue - canvas interactions will still work without wheel events
    }

    return () => {
      // Phase 2 Step 3 Action 5: Enhanced cleanup with error handling
      if (wheelListenerResult.success && currentCanvas) {
        const removeResult = removeEventListenerSafe(currentCanvas, 'wheel', wheelListener);
        if (!removeResult.success) {
          console.warn(
            '[Phase 2 Step 3] Wheel event listener cleanup failed:',
            removeResult.details,
          );
        }
      }
    };
  }, [handleWheel, canvasRef, interactionsEnabled]); // Phase 2 Step 3: Proper dependency array

  // Disable scroll restoration
  useEffect(() => {
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = 'auto';
    };
  }, []);

  // Phase 2 Step 3 Action 4: Stable onClose callback to prevent modal event listener race conditions
  const handleModalClose = useCallback(() => {
    setSelectedImage(null);
  }, []);

  // Phase 2 Step 3 Action 5: Demonstrate enhanced error handling on component mount
  useEffect(() => {
    // Run health check to validate enhanced error handling
    const healthCheck = performEventListenerHealthCheck();
    console.info('[Phase 2 Step 3 Action 5] Event Listener Health Check:', {
      passed: healthCheck.passed,
      failed: healthCheck.failed,
      details: healthCheck.details,
    });
  }, []); // Run once on mount

  return (
    <>
      {/* Navigation Menu - only show when canvas is ready */}
      {loadingState === 'ready' && <NavMenu />}

      {/* Initial loading screen */}
      {loadingState === 'loading' && (
        <TopLoadingBar
          onLoadingComplete={handleInitialLoadComplete}
          loadingProgress={Math.max(loadingProgress * 0.3, canvasProgress)}
          isComplete={imagesLoaded}
        />
      )}

      {/* Intro animation */}
      {loadingState === 'intro' && (
        <IntroAnimation onIntroAnimationComplete={handleIntroComplete} />
      )}

      {/* Main Canvas */}
      <motion.div
        className="fixed inset-0"
        style={{ zIndex: 40 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: loadingState === 'ready' ? 1 : 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
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
                ? isDragging
                  ? 'grabbing'
                  : 'grab'
                : 'pointer'
              : 'default',
          }}
        />
      </motion.div>

      {/* Modals and UI */}
      <ImageDetailsModal imageInfo={selectedImage} onClose={handleModalClose} />
      {loadingState === 'ready' && <HomeButton onClick={animateToHome} />}
    </>
  );
};

export default InfiniteCanvas;
