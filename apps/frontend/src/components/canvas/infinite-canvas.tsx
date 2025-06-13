'use client';

import type React from 'react';
import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ImageDetailsModal from '../ui/image-details-modal';
import { ElectricLogoIntro } from './electric-logo-intro';
import { useImageLoader } from '../../hooks/canvas/use-image-loader';
import { useViewState } from '../../hooks/canvas/use-view-state';
import { useCanvasInteractions } from '../../hooks/canvas/use-canvas-interactions';
import { useCanvasRenderer } from '../../hooks/canvas/use-canvas-renderer';
import HomeButton from '../ui/home-button';
import type { ImageInfo } from '../../types/canvas';
import { getUnitSize } from '../../constants/canvas';

const InfiniteCanvas = () => {
  const [selectedImage, setSelectedImage] = useState<ImageInfo | null>(null);
  const [introCompleted, setIntroCompleted] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasVisible, setCanvasVisible] = useState(false);
  const [unitSize, setUnitSize] = useState(getUnitSize());
  const imagePlacementMapRef = useRef(
    new Map<string, { image: ImageInfo; x: number; y: number; width: number; height: number }>(),
  );

  const { images, loadingProgress, imagesLoaded } = useImageLoader();
  const { viewState, handleWheel, animateViewState, isAnimating, animateToHome } = useViewState({
    imagesLoaded,
    unitSize,
  });
  const { canvasRef } = useCanvasRenderer({
    images,
    viewState,
    imagesLoaded,
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const wheelListener = (e: WheelEvent) => {
      handleWheel(e as unknown as React.WheelEvent<HTMLCanvasElement>);
    };
    canvas.addEventListener('wheel', wheelListener, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', wheelListener);
    };
  }, [handleWheel, canvasRef]);

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

  // Prepare the canvas in the background while the intro is still showing
  useEffect(() => {
    if (imagesLoaded) {
      setCanvasReady(true);
    }
  }, [imagesLoaded]);

  return (
    <>
      {/* Electric Logo Intro - shows until its own animation is complete */}
      <AnimatePresence>
        {!introCompleted && (
          <ElectricLogoIntro
            onComplete={() => {
              setIntroCompleted(true);
            }}
            onBeforeExit={() => {
              // Make sure canvas is visible before the intro starts to fade out
              if (imagesLoaded) {
                setCanvasReady(true);
                setCanvasVisible(true);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Loading Progress - shows after intro is done, but only if images are still loading */}
      <AnimatePresence>
        {introCompleted && !imagesLoaded && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-40 bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-t-[#D0B264] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-[#D0B264] text-xl">Loading assets...</p>
              <p className="mt-2 text-white text-lg">{Math.round(loadingProgress)}%</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Canvas - positioned behind the intro animation for seamless transition */}
      <AnimatePresence>
        {canvasReady && (
          <motion.div
            className="fixed inset-0 bg-gradient-to-b from-[#000000] from-0% via-[#000000] via-80% to-[#184D37] to-100%"
            initial={{ opacity: 0 }}
            animate={{ opacity: canvasVisible ? 1 : 0 }}
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
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="w-full h-full touch-none select-none"
              style={{
                cursor: isPanning ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ImageDetailsModal imageInfo={selectedImage} onClose={() => setSelectedImage(null)} />
      <HomeButton onClick={animateToHome} />
    </>
  );
};

export default InfiniteCanvas;
