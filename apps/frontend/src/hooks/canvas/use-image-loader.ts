import { useState, useEffect } from 'react';
import { ImageInfo } from '../../types/canvas'; // Adjusted path
import { getImageType, getDisplayDimensions } from '../../lib/canvas/image-type-utils'; // Adjusted path
import { SAMPLE_METADATA } from '../../data/metadata'; // Adjusted path
import { LuxuryLogger } from '../../lib/utils/luxury-logger'; // Adjusted path

interface UseImageLoaderProps {
  unitSize: number; // Add unitSize as a prop
  enableLazyLoading?: boolean; // New prop to enable lazy loading
}

// Helper function to create a luxurious placeholder image
const createLuxuryPlaceholderImage = (unitSize: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = unitSize;
  canvas.height = unitSize;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Luxurious gradient background
    const gradient = ctx.createLinearGradient(0, 0, unitSize, unitSize);
    gradient.addColorStop(0, 'rgba(35, 31, 32, 0.8)');
    gradient.addColorStop(1, 'rgba(24, 77, 55, 0.8)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, unitSize, unitSize);

    // Gold border
    ctx.strokeStyle = 'rgba(208, 178, 100, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, unitSize - 8, unitSize - 8);

    // Elegant error text - font size relative to unitSize
    ctx.fillStyle = '#D0B264';
    ctx.font = `${unitSize * 0.08}px "Neue World", Inter, sans-serif`; // Scaled font size
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Image Unavailable', unitSize / 2, unitSize / 2);
  }

  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
};

export const useImageLoader = ({ unitSize, enableLazyLoading = false }: UseImageLoaderProps) => {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  useEffect(() => {
    let loadedCount = 0;
    const loadedImages: ImageInfo[] = [];

    // If lazy loading is enabled, load only the first 6-8 most important images initially
    const imagesToLoad = enableLazyLoading
      ? SAMPLE_METADATA.slice(0, 6) // Load first 6 images for quick start
      : SAMPLE_METADATA;

    const totalImages = imagesToLoad.length;

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

        // If lazy loading, start loading remaining images in the background
        if (enableLazyLoading && SAMPLE_METADATA.length > imagesToLoad.length) {
          loadRemainingImages(loadedImages, imagesToLoad.length);
        }
      }, 500);
    };

    // Safety net to prevent getting stuck - shorter timeout for initial load
    const loadingTimeout = setTimeout(
      () => {
        LuxuryLogger.log('Loading timeout reached. Forcing completion.', 'warn');
        finishLoading();
      },
      enableLazyLoading ? 10000 : 20000,
    ); // 10s for lazy loading, 20s for full loading

    const updateState = () => {
      loadedCount++;
      const progress = (loadedCount / totalImages) * 100;
      setLoadingProgress(progress);

      if (loadedCount === totalImages) {
        clearTimeout(loadingTimeout); // All images loaded, cancel safety net
        finishLoading();
      }
    };

    imagesToLoad.forEach((metadata, index) => {
      if (!metadata.image) {
        LuxuryLogger.log(
          `Image path is missing for metadata with title: "${metadata.title}". Using placeholder.`,
          'warn',
        );
        const placeholderElement = createLuxuryPlaceholderImage(unitSize); // Pass unitSize
        loadedImages[index] = {
          element: placeholderElement,
          type: 'square',
          displayWidth: unitSize, // Use unitSize directly for placeholder
          displayHeight: unitSize, // Use unitSize directly for placeholder
          metadata: {
            ...metadata,
            title: `${metadata.title} (Image path missing)`,
          },
        };
        updateState();
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = metadata.image;

      const handleLoad = () => {
        const type = getImageType(img.naturalWidth, img.naturalHeight);
        const { width: proportionalWidth, height: proportionalHeight } = getDisplayDimensions(
          type,
          unitSize,
        );

        loadedImages[index] = {
          element: img,
          type,
          displayWidth: proportionalWidth * (unitSize / 200), // Scale based on unitSize
          displayHeight: proportionalHeight * (unitSize / 200), // Scale based on unitSize
          metadata,
        };
        updateState();
      };

      const handleError = () => {
        LuxuryLogger.log(`Failed to load image: ${img.src}. Using placeholder.`, 'error');
        const placeholderElement = createLuxuryPlaceholderImage(unitSize); // Pass unitSize
        const errorMetadata = {
          ...metadata,
          title: `${metadata.title} (Loading Failed)`,
          description: 'This asset failed to load',
          image: placeholderElement.src,
        };

        loadedImages[index] = {
          element: placeholderElement,
          type: 'square',
          displayWidth: unitSize, // Use unitSize directly for placeholder
          displayHeight: unitSize, // Use unitSize directly for placeholder
          metadata: errorMetadata,
        };
        updateState();
      };

      img.onload = handleLoad;
      img.onerror = handleError;
    });

    return () => {
      clearTimeout(loadingTimeout);
    };
  }, [unitSize, enableLazyLoading]); // Add enableLazyLoading to dependencies

  // Function to load remaining images in the background
  const loadRemainingImages = (currentImages: ImageInfo[], startIndex: number) => {
    const remainingMetadata = SAMPLE_METADATA.slice(startIndex);

    remainingMetadata.forEach((metadata, index) => {
      const actualIndex = startIndex + index;

      if (!metadata.image) {
        const placeholderElement = createLuxuryPlaceholderImage(unitSize);
        const newImage: ImageInfo = {
          element: placeholderElement,
          type: 'square',
          displayWidth: unitSize,
          displayHeight: unitSize,
          metadata: {
            ...metadata,
            title: `${metadata.title} (Image path missing)`,
          },
        };

        setImages((prev) => {
          const updated = [...prev];
          updated[actualIndex] = newImage;
          return updated;
        });
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = metadata.image;

      img.onload = () => {
        const type = getImageType(img.naturalWidth, img.naturalHeight);
        const { width: proportionalWidth, height: proportionalHeight } = getDisplayDimensions(
          type,
          unitSize,
        );

        const newImage: ImageInfo = {
          element: img,
          type,
          displayWidth: proportionalWidth * (unitSize / 200),
          displayHeight: proportionalHeight * (unitSize / 200),
          metadata,
        };

        setImages((prev) => {
          const updated = [...prev];
          updated[actualIndex] = newImage;
          return updated;
        });
      };

      img.onerror = () => {
        const placeholderElement = createLuxuryPlaceholderImage(unitSize);
        const newImage: ImageInfo = {
          element: placeholderElement,
          type: 'square',
          displayWidth: unitSize,
          displayHeight: unitSize,
          metadata: {
            ...metadata,
            title: `${metadata.title} (Loading Failed)`,
            description: 'This asset failed to load',
            image: placeholderElement.src,
          },
        };

        setImages((prev) => {
          const updated = [...prev];
          updated[actualIndex] = newImage;
          return updated;
        });
      };
    });
  };

  return { images, loadingProgress, imagesLoaded };
};
