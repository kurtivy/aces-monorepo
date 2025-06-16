'use client';

import type React from 'react';
import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ImageDetailsModal from '../ui/image-details-modal';
import LoadingScreen from '../loading/loading-screen';
import { useImageLoader } from '../../hooks/canvas/use-image-loader';
import { useViewState } from '../../hooks/canvas/use-view-state';
import { useCanvasInteractions } from '../../hooks/canvas/use-canvas-interactions';
import { useCanvasRenderer } from '../../hooks/canvas/use-canvas-renderer';
import HomeButton from '../ui/home-button';
import NavMenu from '../ui/nav-menu';
import type { ImageInfo } from '../../types/canvas';
import { getUnitSize } from '../../constants/canvas';

const InfiniteCanvas = () => {
  const [selectedImage, setSelectedImage] = useState<ImageInfo | null>(null);
  const [showIntro, setShowIntro] = useState(true); // Always start with intro
  const [introCompleted, setIntroCompleted] = useState(false);
  const [canvasVisible, setCanvasVisible] = useState(false);
  const [unitSize, setUnitSize] = useState(getUnitSize());
  const imagePlacementMapRef = useRef(
    new Map<string, { image: ImageInfo; x: number; y: number; width: number; height: number }>(),
  );

  // Check if user has seen intro this session (but not on page refresh)
  useEffect(() => {
    // Only skip intro if we're navigating within the same session (not on page refresh)
    const seenIntroThisSession = sessionStorage.getItem('hasSeenIntro');
    const isPageRefresh = window.performance.navigation.type === 1; // 1 = reload

    if (seenIntroThisSession === 'true' && !isPageRefresh) {
      setShowIntro(false);
      setIntroCompleted(true);
    } else {
      // Clear any existing session data on page refresh
      sessionStorage.removeItem('hasSeenIntro');
    }
  }, []);

  const { images, imagesLoaded } = useImageLoader({
    unitSize,
    enableLazyLoading: true, // Enable lazy loading for better performance
  });
  const { viewState, handleWheel, animateViewState, isAnimating, animateToHome, showHomeButton } =
    useViewState({
      imagesLoaded,
      _unitSize: unitSize,
    });
  const { canvasRef } = useCanvasRenderer({
    images,
    viewState,
    imagesLoaded,
    canvasVisible,
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
    if (!imagesLoaded || !isAnimating) return;
    let animationFrameId: number;

    const animate = () => {
      animateViewState();
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [imagesLoaded, animateViewState, isAnimating]);

  // Handle intro animation and loading completion
  useEffect(() => {
    if (!showIntro) {
      // Skip intro, wait only for loading
      if (imagesLoaded) {
        setCanvasVisible(true);
      }
    } else {
      // First time - run intro animation in parallel with loading
      const introTimer = setTimeout(() => {
        setIntroCompleted(true);
      }, 2800); // 2.8 seconds for intro animation

      return () => clearTimeout(introTimer);
    }
  }, [showIntro, imagesLoaded]);

  // Show canvas when both intro and loading are complete (for first-time users)
  useEffect(() => {
    if (showIntro && introCompleted && imagesLoaded) {
      sessionStorage.setItem('hasSeenIntro', 'true');
      setCanvasVisible(true);
    }
  }, [showIntro, introCompleted, imagesLoaded]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    // Create wrapper functions to correctly type native events for React handlers
    const wheelListener = (e: WheelEvent) =>
      handleWheel(e as unknown as React.WheelEvent<HTMLCanvasElement>);
    const touchStartListener = (e: TouchEvent) =>
      handleTouchStart(e as unknown as React.TouchEvent);
    const touchMoveListener = (e: TouchEvent) => handleTouchMove(e as unknown as React.TouchEvent);
    const touchEndListener = (e: TouchEvent) => handleTouchEnd(e as unknown as React.TouchEvent);

    // Add event listeners with passive: false for touch events
    canvas.addEventListener('wheel', wheelListener, { passive: false });
    canvas.addEventListener('touchstart', touchStartListener, { passive: false });
    canvas.addEventListener('touchmove', touchMoveListener, { passive: false });
    canvas.addEventListener('touchend', touchEndListener, { passive: false });

    // Ensure canvas can receive focus and events immediately
    canvas.tabIndex = -1;
    canvas.focus();

    return () => {
      canvas.removeEventListener('wheel', wheelListener);
      canvas.removeEventListener('touchstart', touchStartListener);
      canvas.removeEventListener('touchmove', touchMoveListener);
      canvas.removeEventListener('touchend', touchEndListener);
    };
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd, canvasRef]);

  useEffect(() => {
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = 'auto';
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setUnitSize(getUnitSize());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <NavMenu />

      {/* Show intro animation only if user hasn't seen it this session */}
      {showIntro && <LoadingScreen isComplete={introCompleted} />}

      {/* Main Canvas - always rendered but opacity controlled by loading state */}
      <motion.div
        className="fixed inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: !showIntro || canvasVisible ? 1 : 0 }}
        transition={{
          duration: 1.2,
          ease: 'easeInOut',
        }}
        style={{ zIndex: 40 }} // Lower z-index than the intro (50)
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

      <ImageDetailsModal imageInfo={selectedImage} onClose={() => setSelectedImage(null)} />
      {(!showIntro || introCompleted) && showHomeButton && <HomeButton onClick={animateToHome} />}
    </>
  );
};

export default InfiniteCanvas;
