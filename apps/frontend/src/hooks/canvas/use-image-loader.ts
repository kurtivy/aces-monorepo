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

    // Clear the loading completion flag at start
    try {
      window.localStorage.removeItem('aces-images-loaded');
    } catch (error) {
      console.warn('Could not clear image loading flag:', error);
    }

    // Load ALL images to ensure complete product showcase
    // We'll optimize performance through other means (like better caching and smaller initial grid)
    const imagesToLoad = SAMPLE_METADATA; // Always load all images
    const totalImages = imagesToLoad.length;

    if (totalImages === 0) {
      LuxuryLogger.log('No image paths provided. Canvas will be empty.', 'warn');
      setImagesLoaded(true);
      setLoadingProgress(100);
      // Still signal completion even with no images
      try {
        window.localStorage.setItem('aces-images-loaded', 'true');
      } catch (error) {
        console.warn('Could not set image loading flag for empty state:', error);
      }
      return;
    }

    const finishLoading = () => {
      setImages(loadedImages);
      // Signal that image metadata loading is complete
      try {
        window.localStorage.setItem('aces-images-loaded', 'true');
        LuxuryLogger.log('Image metadata loading marked as complete', 'info');
      } catch (error) {
        console.warn('Could not set image loading flag:', error);
      }

      // Minimal delay to allow the 100% to register before the fade-out
      setTimeout(() => {
        setImagesLoaded(true);
        LuxuryLogger.log(`Image loading complete. ${loadedCount}/${totalImages} loaded.`, 'info');
      }, 100); // Further reduced delay for faster loading
    };

    // Safety net to prevent getting stuck - more aggressive timeout for better UX
    const loadingTimeout = setTimeout(
      () => {
        LuxuryLogger.log('Loading timeout reached. Forcing completion.', 'warn');
        // Signal completion even on timeout
        try {
          window.localStorage.setItem('aces-images-loaded', 'true');
          LuxuryLogger.log('Image loading timeout - marked as complete anyway', 'warn');
        } catch (error) {
          console.warn('Could not set image loading flag on timeout:', error);
        }
        finishLoading();
      },
      15000, // 15 seconds for all images - faster timeout for better UX
    );

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
      // Enhanced null safety check
      if (!metadata) {
        console.warn(`Metadata is null at index ${index}, skipping image`);
        updateState();
        return;
      }

      if (!metadata.image) {
        LuxuryLogger.log(
          `Image path is missing for metadata with title: "${metadata.title || 'Unknown'}". Using placeholder.`,
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
            title: `${metadata.title || 'Unknown'} (Image path missing)`,
          },
        };
        updateState();
        return;
      }

      const img = new Image();

      // MOBILE FIX: Only set crossOrigin for external URLs, not same-domain images
      // This prevents CORS issues on mobile browsers
      if (metadata.image && !metadata.image.startsWith('/')) {
        img.crossOrigin = 'anonymous';
      }

      img.src = metadata.image;

      const handleLoad = () => {
        try {
          // Firefox sometimes reports 0 dimensions initially - add retry logic
          const getDimensions = () => {
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;

            // Firefox fallback: if dimensions are still 0, wait and retry
            if ((width === 0 || height === 0) && img.complete) {
              setTimeout(() => {
                width = img.naturalWidth || img.width || 200;
                height = img.naturalHeight || img.height || 200;

                if (width === 0 || height === 0) {
                  console.warn('Firefox: Using fallback dimensions for image', img.src);
                  width = 200;
                  height = 200;
                }

                const type = getImageType(width, height);
                const { width: proportionalWidth, height: proportionalHeight } =
                  getDisplayDimensions(type, unitSize);

                // Enhanced null safety check before assignment
                if (metadata) {
                  loadedImages[index] = {
                    element: img,
                    type,
                    displayWidth: proportionalWidth * (unitSize / 200), // Scale based on unitSize
                    displayHeight: proportionalHeight * (unitSize / 200), // Scale based on unitSize
                    metadata,
                  };
                  updateState();
                } else {
                  console.warn('Metadata became null during image load processing');
                  handleError();
                }
              }, 100);
              return;
            }

            // Use fallback dimensions if still problematic
            if (width === 0 || height === 0) {
              width = 200;
              height = 200;
            }

            const type = getImageType(width, height);
            const { width: proportionalWidth, height: proportionalHeight } = getDisplayDimensions(
              type,
              unitSize,
            );

            // Enhanced null safety check before assignment
            if (metadata) {
              loadedImages[index] = {
                element: img,
                type,
                displayWidth: proportionalWidth * (unitSize / 200), // Scale based on unitSize
                displayHeight: proportionalHeight * (unitSize / 200), // Scale based on unitSize
                metadata,
              };
              updateState();
            } else {
              console.warn('Metadata became null during image load processing');
              handleError();
            }
          };

          getDimensions();
        } catch (error) {
          console.warn('Image load processing error:', error);
          handleError(); // Fallback to error handling
        }
      };

      const handleError = () => {
        LuxuryLogger.log(`Failed to load image: ${img.src}. Using placeholder.`, 'error');
        const placeholderElement = createLuxuryPlaceholderImage(unitSize); // Pass unitSize

        // Enhanced null safety for metadata
        const safeMetadata = metadata || {
          title: 'Unknown Item',
          description: 'This asset failed to load',
          ticker: '$UNKNOWN',
        };

        const errorMetadata = {
          ...safeMetadata,
          title: `${safeMetadata.title || 'Unknown'} (Loading Failed)`,
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
  }, [unitSize, enableLazyLoading]);

  return { images, loadingProgress, imagesLoaded };
};
