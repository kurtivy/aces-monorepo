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
import { getUnitSize } from '../../constants/canvas';

// Simplified loading state - reduced from 5 states to 3
type LoadingState = 'loading' | 'intro' | 'ready';

const InfiniteCanvas = () => {
  const [selectedImage, setSelectedImage] = useState<ImageInfo | null>(null);

  // SIMPLIFIED: Single loading state instead of 5 separate states
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [unitSize, setUnitSize] = useState(getUnitSize());

  // Keep only essential state that can't be derived
  const [hasSeenIntro, setHasSeenIntro] = useState(false);

  const imagePlacementMapRef = useRef(
    new Map<string, { image: ImageInfo; x: number; y: number; width: number; height: number }>(),
  );

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

  const { images, imagesLoaded, loadingProgress } = useImageLoader({
    unitSize,
    enableLazyLoading: true,
  });

  // STEP 2 FIX: Remove complex boolean chains - single condition
  const { viewState, handleWheel, animateViewState, isAnimating, animateToHome, showHomeButton } =
    useViewState({
      imagesLoaded: imagesLoaded, // ViewState can initialize as soon as images load
      _unitSize: unitSize,
    });

  // STEP 2 FIX: Remove circular dependency - canvas should start working as soon as images load
  const { canvasRef, canvasProgress, canvasReady } = useCanvasRenderer({
    images,
    viewState,
    imagesLoaded: imagesLoaded, // Canvas can start working immediately when images load
    canvasVisible: loadingState !== 'loading', // Visible during intro and ready states
    onCreateTokenClick: () => {
      window.location.href = '/create-token';
    },
    imagePlacementMap: imagePlacementMapRef,
    unitSize,
  });

  // STEP 2 DEBUG: Track loading state transitions
  useEffect(() => {
    console.log('🔄 Loading State Update:', {
      loadingState,
      imagesLoaded,
      canvasProgress,
      canvasReady,
    });
  }, [loadingState, imagesLoaded, canvasProgress, canvasReady]);

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
    unitSize,
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
  }, [loadingState, imagesLoaded, animateViewState, isAnimating]);

  // SIMPLIFIED: Handle loading completion - direct state transitions
  const handleInitialLoadComplete = () => {
    if (hasSeenIntro) {
      setLoadingState('ready');
    } else {
      setLoadingState('intro');
    }
  };

  // SIMPLIFIED: Handle intro completion - direct state transition
  const handleIntroComplete = () => {
    try {
      sessionStorage.setItem('hasSeenIntro', 'true');
    } catch (error) {
      console.warn('Could not save intro state:', error);
    }

    // Direct transition to ready - no nested timeouts or browser-specific delays
    setLoadingState('ready');
  };

  // SIMPLIFIED: Loading progression - single simple condition
  useEffect(() => {
    if (loadingState === 'intro' && imagesLoaded) {
      // Standard intro animation duration - no browser-specific timing
      const timer = setTimeout(() => {
        handleIntroComplete();
      }, 3500); // Standard timing for all browsers
      return () => clearTimeout(timer);
    }
  }, [loadingState, imagesLoaded]);

  // Handle canvas events - simplified condition
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !interactionsEnabled) return;

    // Firefox-compatible event listeners with error handling
    const wheelListener = (e: WheelEvent) => {
      try {
        handleWheel(e as unknown as React.WheelEvent<HTMLCanvasElement>);
      } catch (error) {
        console.warn('Wheel event error:', error);
      }
    };

    const touchStartListener = (e: TouchEvent) => {
      try {
        handleTouchStart(e as unknown as React.TouchEvent);
      } catch (error) {
        console.warn('Touch start event error:', error);
      }
    };

    const touchMoveListener = (e: TouchEvent) => {
      try {
        handleTouchMove(e as unknown as React.TouchEvent);
      } catch (error) {
        console.warn('Touch move event error:', error);
      }
    };

    const touchEndListener = (e: TouchEvent) => {
      try {
        handleTouchEnd(e as unknown as React.TouchEvent);
      } catch (error) {
        console.warn('Touch end event error:', error);
      }
    };

    // Add event listeners with Firefox-compatible options
    try {
      canvas.addEventListener('wheel', wheelListener, { passive: false });
      canvas.addEventListener('touchstart', touchStartListener, { passive: false });
      canvas.addEventListener('touchmove', touchMoveListener, { passive: false });
      canvas.addEventListener('touchend', touchEndListener, { passive: false });

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
        canvas.removeEventListener('touchstart', touchStartListener);
        canvas.removeEventListener('touchmove', touchMoveListener);
        canvas.removeEventListener('touchend', touchEndListener);
      } catch (cleanupError) {
        console.warn('Event cleanup error:', cleanupError);
      }
    };
  }, [
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    canvasRef,
    interactionsEnabled,
  ]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      setUnitSize(getUnitSize());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Disable scroll restoration
  useEffect(() => {
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = 'auto';
    };
  }, []);

  // STEP 3 FIX: Removed all unnecessary timers and browser-specific debugging
  // Clean state transitions without timer dependencies

  return (
    <>
      {/* Navigation Menu - only show when canvas is ready */}
      {loadingState === 'ready' && <NavMenu />}

      {/* Initial loading screen */}
      {loadingState === 'loading' && (
        <TopLoadingBar
          onLoadingComplete={handleInitialLoadComplete}
          loadingProgress={Math.max(loadingProgress * 0.3, canvasProgress)}
          isComplete={canvasReady}
        />
      )}

      {/* Intro animation */}
      {loadingState === 'intro' && <IntroAnimation isComplete={false} />}

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
      {loadingState === 'ready' && showHomeButton && <HomeButton onClick={animateToHome} />}
    </>
  );
};

export default InfiniteCanvas;
