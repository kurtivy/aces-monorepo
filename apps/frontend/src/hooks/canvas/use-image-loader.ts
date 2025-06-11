import { useState, useEffect, useRef } from 'react';
import { ImageInfo } from '../../types/canvas'; // Adjusted path
import { getImageType, getDisplayDimensions } from '../../lib/canvas/image-type-utils'; // Adjusted path
import { SAMPLE_METADATA } from '../../data/metadata'; // Adjusted path
import { IMAGE_PATHS, LOADING_DURATION, UNIT_SIZE } from '../../constants/canvas'; // Adjusted path
import { LuxuryLogger } from '../../lib/utils/luxury-logger'; // Adjusted path

// Helper function to create a luxurious placeholder image
const createLuxuryPlaceholderImage = () => {
  const canvas = document.createElement('canvas');
  canvas.width = UNIT_SIZE;
  canvas.height = UNIT_SIZE;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Luxurious gradient background
    const gradient = ctx.createLinearGradient(0, 0, UNIT_SIZE, UNIT_SIZE);
    gradient.addColorStop(0, 'rgba(35, 31, 32, 0.8)');
    gradient.addColorStop(1, 'rgba(24, 77, 55, 0.8)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, UNIT_SIZE, UNIT_SIZE);

    // Gold border
    ctx.strokeStyle = 'rgba(208, 178, 100, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, UNIT_SIZE - 8, UNIT_SIZE - 8);

    // Elegant error text
    ctx.fillStyle = '#D0B264';
    ctx.font = '12px "Neue World", Inter, sans-serif'; // Assuming Neue World is available
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Image Unavailable', UNIT_SIZE / 2, UNIT_SIZE / 2);
  }

  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
};

export const useImageLoader = () => {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const loadingStartTimeRef = useRef<number | null>(null);
  const actualImagesLoadedRef = useRef(0);

  useEffect(() => {
    loadingStartTimeRef.current = Date.now();

    const updateProgress = () => {
      if (!loadingStartTimeRef.current) return;

      const elapsed = Date.now() - loadingStartTimeRef.current;
      const baseProgress = Math.min((elapsed / LOADING_DURATION) * 100, 100);

      const totalProgress = baseProgress;
      setLoadingProgress(totalProgress);

      if (totalProgress < 100) {
        requestAnimationFrame(updateProgress);
      } else {
        if (actualImagesLoadedRef.current === IMAGE_PATHS.length) {
          setTimeout(() => {
            setImagesLoaded(true);
            LuxuryLogger.log('All images and loading animation complete.', 'info');
          }, 500);
        }
      }
    };

    requestAnimationFrame(updateProgress);
  }, []);

  useEffect(() => {
    let loadedCount = 0;
    const loadedImages: ImageInfo[] = [];
    const totalImages = IMAGE_PATHS.length;

    if (totalImages === 0) {
      LuxuryLogger.log('No image paths provided. Canvas will be empty.', 'warn');
      setImagesLoaded(true); // Mark as loaded if no images to load
      return;
    }

    IMAGE_PATHS.forEach((path, index) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = path;

      const handleLoad = () => {
        const type = getImageType(img.naturalWidth, img.naturalHeight);
        const { width, height } = getDisplayDimensions(type);

        const metadata = SAMPLE_METADATA[index] || {
          id: `asset-${index}`,
          title: `Asset ${index + 1}`,
          description: 'Asset details coming soon',
          date: new Date().toISOString().split('T')[0],
          ticker: `$ASSET${index + 1}`,
          image: path,
        };

        loadedImages[index] = {
          element: img,
          type,
          displayWidth: width,
          displayHeight: height,
          metadata,
        };

        loadedCount++;
        actualImagesLoadedRef.current = loadedCount;

        if (loadedCount === totalImages) {
          setImages(loadedImages);
          if (loadingProgress >= 100) {
            setTimeout(() => {
              setImagesLoaded(true);
              LuxuryLogger.log('All images loaded successfully.', 'info');
            }, 500);
          }
        }
      };

      const handleError = () => {
        LuxuryLogger.log(`Failed to load image: ${path}. Using placeholder.`, 'error');
        loadedCount++;
        actualImagesLoadedRef.current = loadedCount;

        const placeholderElement = createLuxuryPlaceholderImage();

        loadedImages[index] = {
          element: placeholderElement,
          type: 'square',
          displayWidth: UNIT_SIZE,
          displayHeight: UNIT_SIZE,
          metadata: {
            id: `error-${index}`,
            title: `Asset ${index + 1} (Loading Failed)`,
            description: 'This asset failed to load',
            date: new Date().toISOString().split('T')[0],
            ticker: `$ERROR${index + 1}`,
            image: placeholderElement.src,
          },
        };

        if (loadedCount === totalImages) {
          setImages(loadedImages);
          if (loadingProgress >= 100) {
            setTimeout(() => {
              setImagesLoaded(true);
              LuxuryLogger.log('All images processed (some with placeholders).', 'info');
            }, 500);
          }
        }
      };

      img.onload = handleLoad;
      img.onerror = handleError;
    });
  }, [loadingProgress]);

  return { images, loadingProgress, imagesLoaded };
};
