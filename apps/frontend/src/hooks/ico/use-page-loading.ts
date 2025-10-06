'use client';

import { useState, useEffect, useCallback } from 'react';

export interface PageLoadingState {
  // Loading phases
  imagesLoading: boolean;
  imagesProgress: number; // 0-100
  contractLoading: boolean;

  // Overall state
  isReady: boolean;
  loadingProgress: number; // 0-100
  hasError: boolean;
  errorMessage?: string;
}

interface UsePageLoadingProps {
  imagePaths: string[];
  contractReady?: boolean;
  enableIntroAnimation?: boolean;
}

/**
 * Global page loading state manager that coordinates:
 * - Image preloading with progress tracking
 * - Contract data readiness
 * - Overall page readiness with intro animation
 */
export function usePageLoading({
  imagePaths,
  contractReady = true,
  enableIntroAnimation = true,
}: UsePageLoadingProps): PageLoadingState {
  const [imagesLoading, setImagesLoading] = useState(true);
  const [imagesProgress, setImagesProgress] = useState(0);
  const [contractLoading, setContractLoading] = useState(!contractReady);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  // Image preloading system - Fixed to prevent infinite re-renders
  useEffect(() => {
    if (imagePaths.length === 0) {
      setImagesLoading(false);
      setImagesProgress(100);
      return;
    }

    setImagesLoading(true);
    setImagesProgress(0);
    setHasError(false);

    let loadedCount = 0;
    const totalImages = imagePaths.length;

    const updateProgress = () => {
      loadedCount++;
      const progress = Math.round((loadedCount / totalImages) * 100);
      setImagesProgress(progress);

      if (loadedCount === totalImages) {
        setImagesLoading(false);
      }
    };

    const loadImage = (src: string): Promise<void> => {
      return new Promise((resolve) => {
        const img = new Image();
        let isResolved = false;

        const handleComplete = () => {
          if (!isResolved) {
            isResolved = true;
            updateProgress();
            resolve();
          }
        };

        img.onload = handleComplete;
        img.onerror = () => {
          console.warn(`Failed to load image: ${src}`);
          handleComplete(); // Still count as complete to prevent hanging
        };

        // Timeout fallback
        setTimeout(() => {
          if (!isResolved) {
            console.warn(`Image load timeout: ${src}`);
            handleComplete();
          }
        }, 10000);

        img.src = src;
      });
    };

    // Load all images in parallel
    Promise.all(imagePaths.map(loadImage)).catch((error) => {
      console.error('Image loading failed:', error);
      setHasError(true);
      setErrorMessage('Some images failed to load');
      setImagesLoading(false);
    });
  }, [imagePaths]);

  // Contract loading tracking
  useEffect(() => {
    setContractLoading(!contractReady);
  }, [contractReady]);

  // Overall loading progress calculation
  const loadingProgress = useCallback(() => {
    let progress = 0;

    // Images: 0-80%
    progress += imagesProgress * 0.8;

    // Contract: 80-100%
    if (!contractLoading) {
      progress += 20;
    }

    return Math.round(progress);
  }, [imagesProgress, contractLoading]);

  // Overall readiness with failsafe timeout
  useEffect(() => {
    const allReady = !imagesLoading && !contractLoading;

    if (allReady && !isReady) {
      if (enableIntroAnimation) {
        // Small delay before intro animation
        setTimeout(() => {
          setIsReady(true);
        }, 100);
      } else {
        setIsReady(true);
      }
    }
  }, [imagesLoading, contractLoading, isReady, enableIntroAnimation]);

  // Failsafe timeout - force ready after 15 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isReady) {
        setIsReady(true);
      }
    }, 15000);

    return () => clearTimeout(timeout);
  }, [isReady]);

  return {
    imagesLoading,
    imagesProgress,
    contractLoading,
    isReady,
    loadingProgress: loadingProgress(),
    hasError,
    errorMessage,
  };
}
