'use client';

import type React from 'react';
import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

import ImageDetailsModal from '../ui/image-details-modal';
import LoadingScreen from '../loading/loading-screen';
import TopLoadingBar from '../loading/top-loading-bar';
import { useImageLoader } from '../../hooks/canvas/use-image-loader';
import { useViewState } from '../../hooks/canvas/use-view-state';
import { useCanvasInteractions } from '../../hooks/canvas/use-canvas-interactions';
import { useCanvasRenderer } from '../../hooks/canvas/use-canvas-renderer';
import HomeButton from '../ui/home-button';
import NavMenu from '../ui/nav-menu';
import type { ImageInfo } from '../../types/canvas';
import { getUnitSize } from '../../constants/canvas';

type LoadingPhase = 'initial' | 'intro' | 'ready';

const InfiniteCanvas = () => {
  const [selectedImage, setSelectedImage] = useState<ImageInfo | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>('initial');
  const [unitSize, setUnitSize] = useState(getUnitSize());
  const [hasSeenIntro, setHasSeenIntro] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);

  const imagePlacementMapRef = useRef(
    new Map<string, { image: ImageInfo; x: number; y: number; width: number; height: number }>(),
  );

  // Handle hydration and check intro status with Firefox fixes
  useEffect(() => {
    // Firefox-specific: longer delay to ensure proper hydration
    const hydrationDelay = navigator.userAgent.includes('Firefox') ? 100 : 50;

    const hydrationTimer = setTimeout(() => {
      setIsHydrated(true);

      // Firefox-specific diagnostic logging
      if (navigator.userAgent.includes('Firefox')) {
        console.log('[Firefox] Hydration completed:', {
          readyState: document.readyState,
          fontsReady: document.fonts ? 'available' : 'not available',
          sessionStorageAvailable: typeof sessionStorage !== 'undefined',
        });
      }

      // Multiple attempts for Firefox sessionStorage issues
      const checkIntroStatus = () => {
        try {
          const seenIntro = sessionStorage.getItem('hasSeenIntro') === 'true';
          setHasSeenIntro(seenIntro);

          if (navigator.userAgent.includes('Firefox')) {
            console.log('[Firefox] Intro status checked:', seenIntro);
          }
        } catch (error) {
          console.warn('SessionStorage not available, trying again:', error);
          // Retry once for Firefox
          setTimeout(() => {
            try {
              const seenIntro = sessionStorage.getItem('hasSeenIntro') === 'true';
              setHasSeenIntro(seenIntro);
            } catch (retryError) {
              console.warn('SessionStorage failed after retry:', retryError);
              setHasSeenIntro(false);
            }
          }, 100);
        }
      };

      checkIntroStatus();
    }, hydrationDelay);

    return () => clearTimeout(hydrationTimer);
  }, []);

  const { images, imagesLoaded } = useImageLoader({
    unitSize,
    enableLazyLoading: true,
  });

  const { viewState, handleWheel, animateViewState, isAnimating, animateToHome, showHomeButton } =
    useViewState({
      imagesLoaded: loadingPhase === 'ready' && imagesLoaded,
      _unitSize: unitSize,
    });

  const { canvasRef } = useCanvasRenderer({
    images,
    viewState,
    imagesLoaded: loadingPhase === 'ready' && imagesLoaded,
    canvasVisible: canvasReady,
    onCreateTokenClick: () => {
      window.location.href = '/create-token';
    },
    imagePlacementMap: imagePlacementMapRef,
    unitSize,
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
    unitSize,
  });

  // Animation loop for view state
  useEffect(() => {
    if (loadingPhase !== 'ready' || !imagesLoaded || !isAnimating) return;

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
  }, [loadingPhase, imagesLoaded, animateViewState, isAnimating]);

  // Handle initial loading completion
  const handleInitialLoadComplete = () => {
    if (hasSeenIntro) {
      setLoadingPhase('ready');
      setCanvasReady(true); // If skipping intro, set canvas ready immediately
    } else {
      setLoadingPhase('intro');
      setIntroComplete(false); // Reset intro completion for new animation
    }
  };

  // Handle intro animation completion with Firefox reliability
  const handleIntroComplete = () => {
    const saveIntroState = () => {
      try {
        sessionStorage.setItem('hasSeenIntro', 'true');
      } catch (error) {
        console.warn('Could not save intro state, retrying:', error);
        // Retry for Firefox
        setTimeout(() => {
          try {
            sessionStorage.setItem('hasSeenIntro', 'true');
          } catch (retryError) {
            console.warn('Failed to save intro state after retry:', retryError);
          }
        }, 50);
      }
    };

    saveIntroState();
    setIntroComplete(true);

    // Firefox-specific: small delay before transitioning phases
    setTimeout(() => {
      setLoadingPhase('ready');

      // Firefox-specific: delay canvas ready state to ensure smooth transition
      setTimeout(() => {
        setCanvasReady(true);
        if (navigator.userAgent.includes('Firefox')) {
          console.log('[Firefox] Canvas ready state set');
        }
      }, 100);
    }, 100);
  };

  // Progress loading phases with Firefox-specific timing
  useEffect(() => {
    if (!isHydrated) return;

    if (loadingPhase === 'intro' && imagesLoaded) {
      if (navigator.userAgent.includes('Firefox')) {
        console.log('[Firefox] Starting intro completion timer');
      }

      // Firefox-specific timing: ensure neon animation completes fully
      // Watch for animation completion instead of hardcoded timeout
      const animationDuration = 3700; // Extended by 0.5s for better timing
      const timer = setTimeout(() => {
        if (navigator.userAgent.includes('Firefox')) {
          console.log('[Firefox] Intro animation timer completed, transitioning to ready');
        }
        handleIntroComplete();
      }, animationDuration);
      return () => clearTimeout(timer);
    }
  }, [loadingPhase, imagesLoaded, isHydrated]);

  // Handle canvas events with Firefox compatibility
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || loadingPhase !== 'ready') return;

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

      // Firefox focus with delay
      setTimeout(() => {
        try {
          canvas.focus();
        } catch (focusError) {
          console.warn('Canvas focus error:', focusError);
        }
      }, 100);
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
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd, canvasRef, loadingPhase]);

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

  // Firefox-specific fallback: ensure canvas becomes ready even if something goes wrong
  useEffect(() => {
    if (loadingPhase === 'ready' && !canvasReady && navigator.userAgent.includes('Firefox')) {
      const fallbackTimer = setTimeout(() => {
        console.warn('[Firefox] Fallback: Forcing canvas ready state');
        setCanvasReady(true);
      }, 2000); // 2 second fallback

      return () => clearTimeout(fallbackTimer);
    }
  }, [loadingPhase, canvasReady]);

  // Add diagnostic for motion wrapper timing
  useEffect(() => {
    if (canvasReady && navigator.userAgent.includes('Firefox')) {
      console.log('[Firefox] Canvas ready, motion wrapper should start animating');

      // Track when motion wrapper should complete
      setTimeout(() => {
        console.log('[Firefox] Motion wrapper animation should be complete');
      }, 400); // Based on 0.4s duration
    }
  }, [canvasReady]);

  // Add diagnostic for canvasReady changes
  useEffect(() => {
    if (navigator.userAgent.includes('Firefox')) {
      console.log(`[Firefox] canvasReady changed to: ${canvasReady}`);
    }
  }, [canvasReady]);

  // Don't render anything until hydrated
  if (!isHydrated) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#D0B264] rounded-full animate-spin border-t-transparent"></div>
      </div>
    );
  }

  return (
    <>
      {/* Navigation Menu - only show when canvas is ready */}
      {canvasReady && <NavMenu />}

      {/* Initial loading screen */}
      {loadingPhase === 'initial' && (
        <TopLoadingBar onLoadingComplete={handleInitialLoadComplete} />
      )}

      {/* Intro animation */}
      {loadingPhase === 'intro' && <LoadingScreen isComplete={introComplete} />}

      {/* Main Canvas */}
      <motion.div
        className="fixed inset-0"
        style={{ zIndex: 40 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: canvasReady ? 1 : 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        onAnimationComplete={() => {
          if (navigator.userAgent.includes('Firefox') && canvasReady) {
            console.log('[Firefox] Canvas motion animation completed - should be visible now');
          }
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full touch-none select-none"
          style={{
            cursor: isPanning ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
          }}
        />
      </motion.div>

      {/* Modals and UI */}
      <ImageDetailsModal imageInfo={selectedImage} onClose={() => setSelectedImage(null)} />
      {canvasReady && showHomeButton && <HomeButton onClick={animateToHome} />}
    </>
  );
};

export default InfiniteCanvas;
