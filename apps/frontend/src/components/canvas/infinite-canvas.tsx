'use client';

import type React from 'react';
import { useRef, useState, useEffect } from 'react';
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

// Simplified loading state - reduced from 5 states to 3
type LoadingState = 'loading' | 'intro' | 'ready';

const InfiniteCanvas = () => {
  const [selectedImage, setSelectedImage] = useState<ImageInfo | null>(null);

  // SIMPLIFIED: Single loading state instead of 5 separate states
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  console.log('🔄 InfiniteCanvas Rendered. Current loadingState:', loadingState); // Moved after declaration

  // Keep only essential state that can't be derived
  const [hasSeenIntro, setHasSeenIntro] = useState(false);

  const imagePlacementMapRef = useRef(
    new Map<string, { image: ImageInfo; x: number; y: number; width: number; height: number }>(),
  );

  // Create canvas ref first so it can be used by both hooks
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Simplified hydration check - no browser-specific delays
  useEffect(() => {
    // Simple hydration check without Firefox-specific complexity
    const checkIntroStatus = () => {
      try {
        const seenIntro = sessionStorage.getItem('hasSeenIntro') === 'true';
        setHasSeenIntro(seenIntro);
      } catch (error) {
        console.warn('SessionStorage not available:', error);
        setHasSeenIntro(false);
      }
    };

    // No hydration delay - just check immediately when component mounts
    checkIntroStatus();
  }, []);

  // STEP 5: Coordinated resize handling - get dynamic unitSize
  const { unitSize } = useCoordinatedResize({ canvasRef });

  // Use stable unitSize for image loading to prevent reloading during resize
  const { images, imagesLoaded, loadingProgress } = useImageLoader({
    unitSize: 200, // Stable value - images will be scaled by canvas renderer
    enableLazyLoading: true,
  });

  // STEP 2 FIX: Remove complex boolean chains - single condition
  const {
    viewState,
    handleWheel,
    animateViewState,
    isAnimating,
    animateToHome,
    showHomeButton,
    updateViewState,
  } = useViewState({
    imagesLoaded: imagesLoaded, // ViewState can initialize as soon as images load
    _unitSize: unitSize, // Use dynamic unitSize from coordinated resize
  });

  // STEP 2 FIX: Remove circular dependency - canvas should start working as soon as images load
  const { canvasProgress, canvasReady } = useCanvasRenderer({
    images,
    viewState,
    imagesLoaded: imagesLoaded, // Canvas can start working immediately when images load
    canvasVisible: loadingState !== 'loading', // Visible during intro and ready states
    onCreateTokenClick: () => {
      window.location.href = '/create-token';
    },
    imagePlacementMap: imagePlacementMapRef,
    unitSize: unitSize, // Use dynamic unitSize from coordinated resize
    canvasRef: canvasRef, // Pass the canvasRef to avoid conflicts
  });

  // STEP 2 DEBUG: Track loading state transitions
  useEffect(() => {
    console.log('🔄 Loading State Update:', {
      loadingState,
      imagesLoaded,
      canvasProgress,
      canvasReady,
      hasSeenIntro, // Add hasSeenIntro to debug
    });
  }, [loadingState, imagesLoaded, canvasProgress, canvasReady, hasSeenIntro]);

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

  // SIMPLIFIED: Single condition for interactions - no complex boolean chain
  const interactionsEnabled = loadingState === 'ready' && imagesLoaded;

  // Animation loop - simplified condition
  useEffect(() => {
    if (loadingState !== 'ready' || !imagesLoaded || !isAnimating) return;

    let animationFrameId: number;

    const animate = () => {
      if (isAnimating) {
        animateViewState();
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingState, imagesLoaded, isAnimating]); // REMOVED animateViewState to break circular dependency

  // SIMPLIFIED: Handle loading completion - direct state transitions
  const handleInitialLoadComplete = () => {
    console.log('✅ handleInitialLoadComplete called. hasSeenIntro:', hasSeenIntro);
    if (hasSeenIntro) {
      setLoadingState('ready');
    } else {
      setLoadingState('intro');
    }
  };

  // SIMPLIFIED: Handle intro completion - direct state transition
  const handleIntroComplete = () => {
    console.log('✅ handleIntroComplete called. Transitioning to ready.');
    try {
      sessionStorage.setItem('hasSeenIntro', 'true');
    } catch (error) {
      console.warn('Could not save intro state:', error);
    }

    // Direct transition to ready - no nested timeouts or browser-specific delays
    setLoadingState('ready');
  };

  // Handle canvas focus and wheel events only - touch events handled by React
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !interactionsEnabled) return;

    // Firefox-compatible wheel event listener
    const wheelListener = (e: WheelEvent) => {
      try {
        handleWheel(e as unknown as React.WheelEvent<HTMLCanvasElement>);
      } catch (error) {
        console.warn('Wheel event error:', error);
      }
    };

    // Add wheel event listener (wheel events don't work well with React handlers)
    try {
      canvas.addEventListener('wheel', wheelListener, { passive: false });
      canvas.tabIndex = -1;

      // STEP 3 FIX: Direct canvas focus without timer delay
      try {
        canvas.focus();
      } catch (focusError) {
        console.warn('Canvas focus error:', focusError);
      }
    } catch (eventError) {
      console.warn('Event listener setup error:', eventError);
    }

    return () => {
      try {
        canvas.removeEventListener('wheel', wheelListener);
      } catch (cleanupError) {
        console.warn('Event cleanup error:', cleanupError);
      }
    };
  }, [handleWheel, canvasRef, interactionsEnabled]);

  // Disable scroll restoration
  useEffect(() => {
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = 'auto';
    };
  }, []);

  // STEP 3 FIX: Removed all unnecessary timers and browser-specific debugging
  // Clean state transitions without timer dependencies

  // Removed: SIMPLIFIED: Loading progression - single simple condition (now handled by IntroAnimation)
  // Removed: STEP 3 FIX: Removed all unnecessary timers and browser-specific debugging

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
          // STEP 3 FIX: Remove browser-specific animation logging
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
      <ImageDetailsModal imageInfo={selectedImage} onClose={() => setSelectedImage(null)} />
      {loadingState === 'ready' && <HomeButton onClick={animateToHome} />}
    </>
  );
};

export default InfiniteCanvas;
