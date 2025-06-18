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
  }, [loadingState, imagesLoaded, isAnimating]);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !interactionsEnabled) return;

    const wheelListener = (e: WheelEvent) => {
      try {
        handleWheel(e as unknown as React.WheelEvent<HTMLCanvasElement>);
      } catch (error) {}
    };

    try {
      canvas.addEventListener('wheel', wheelListener, { passive: false });
      canvas.tabIndex = -1;

      try {
        canvas.focus();
      } catch (focusError) {
        // Canvas focus error - continue silently
      }
    } catch (eventError) {
      // Event listener setup error - continue silently
    }

    return () => {
      try {
        canvas.removeEventListener('wheel', wheelListener);
      } catch (cleanupError) {
        // Event cleanup error - continue silently
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
      <ImageDetailsModal imageInfo={selectedImage} onClose={() => setSelectedImage(null)} />
      {loadingState === 'ready' && <HomeButton onClick={animateToHome} />}
    </>
  );
};

export default InfiniteCanvas;
