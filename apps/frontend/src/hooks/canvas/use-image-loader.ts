import { useState, useEffect } from 'react';
import { ImageInfo } from '../../types/canvas'; // Adjusted path
import { getImageType, getDisplayDimensions } from '../../lib/canvas/image-type-utils'; // Adjusted path
import { SAMPLE_METADATA } from '../../data/metadata'; // Adjusted path
import { IMAGE_PATHS, UNIT_SIZE } from '../../constants/canvas'; // Adjusted path
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

  useEffect(() => {
    let loadedCount = 0;
    const loadedImages: ImageInfo[] = [];
    const totalImages = IMAGE_PATHS.length;

    if (totalImages === 0) {
      LuxuryLogger.log('No image paths provided. Canvas will be empty.', 'warn');
      setImagesLoaded(true);
      setLoadingProgress(100);
      return;
    }

    const finishLoading = () => {
      setImages(loadedImages);
      // A short delay to allow the 100% to register before the fade-out
      setTimeout(() => {
        setImagesLoaded(true);
        LuxuryLogger.log(`Image loading complete. ${loadedCount}/${totalImages} loaded.`, 'info');
      }, 500);
    };

    // Safety net to prevent getting stuck
    const loadingTimeout = setTimeout(() => {
      LuxuryLogger.log('Loading timeout reached. Forcing completion.', 'warn');
      finishLoading();
    }, 20000); // 20-second timeout

    const updateState = () => {
      loadedCount++;
      const progress = (loadedCount / totalImages) * 100;
      setLoadingProgress(progress);

      if (loadedCount === totalImages) {
        clearTimeout(loadingTimeout); // All images loaded, cancel safety net
        finishLoading();
      }
    };

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
        updateState();
      };

      const handleError = () => {
        LuxuryLogger.log(`Failed to load image: ${path}. Using placeholder.`, 'error');
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
        updateState();
      };

      img.onload = handleLoad;
      img.onerror = handleError;
    });

    return () => {
      clearTimeout(loadingTimeout);
    };
  }, []);

  return { images, loadingProgress, imagesLoaded };
};
