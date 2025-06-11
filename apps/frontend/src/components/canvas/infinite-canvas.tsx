'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

const WebsiteLoader = dynamic(() => import('./website-loader'), { ssr: false });
import ImageDetailsModal from '../ui/image-details-modal'; // Adjusted path
import { useImageLoader } from '../../hooks/canvas/use-image-loader'; // Adjusted path
import { useViewState } from '../../hooks/canvas/use-view-state'; // Adjusted path
import { useCanvasInteractions } from '../../hooks/canvas/use-canvas-interactions'; // Adjusted path
import { useCanvasRenderer } from '../../hooks/canvas/use-canvas-renderer'; // Adjusted path
import HomeButton from '../ui/home-button'; // Adjusted path

import { ImageInfo } from '../../types/canvas'; // Adjusted path

const InfiniteCanvas = () => {
  const [selectedImage, setSelectedImage] = useState<ImageInfo | null>(null);
  const imagePlacementMapRef = useRef(
    new Map<string, { image: ImageInfo; x: number; y: number; width: number; height: number }>(),
  );

  const { images, loadingProgress, imagesLoaded } = useImageLoader();
  const {
    viewState,
    handleWheel,
    animateViewState,
    isAnimating,
    animateToHome,
  } = // Destructure animateToHome
    useViewState({});
  const { canvasRef } = useCanvasRenderer({
    images,
    viewState,
    imagePlacementMap: imagePlacementMapRef,
    onCreateTokenClick: () => {
      window.location.href = '/create-token';
    },
  });

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
    setSelectedImage,
    imagePlacementMap: imagePlacementMapRef,
  });

  // Animation loop for view state
  useEffect(() => {
    if (!isAnimating) return;
    let animationFrameId: number;

    const animate = () => {
      animateViewState();
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [animateViewState, isAnimating]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    // The handleWheel function expects a React.WheelEvent, but we are passing a native WheelEvent.
    // The properties used (preventDefault, deltaX, etc.) are available on the native event,
    // so we can cast to `any` to make TypeScript happy.
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

  return (
    <>
      <WebsiteLoader progress={loadingProgress} isComplete={imagesLoaded} />
      <AnimatePresence>
        {imagesLoaded && (
          <motion.div
            className="fixed inset-0 bg-gradient-to-b from-[#000000] from-0% via-[#000000] via-80% to-[#184D37] to-100%"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="fixed inset-0 w-full h-full touch-none select-none"
        style={{
          cursor: isPanning ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
          opacity: imagesLoaded ? 1 : 0,
          transition: 'opacity 1.2s ease-in-out',
        }}
      />
      <ImageDetailsModal imageInfo={selectedImage} onClose={() => setSelectedImage(null)} />
      <HomeButton onClick={animateToHome} /> {/* Render the HomeButton */}
    </>
  );
};

export default InfiniteCanvas;
