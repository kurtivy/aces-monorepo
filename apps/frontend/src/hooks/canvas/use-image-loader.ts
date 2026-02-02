import { useState, useEffect, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { ImageInfo } from '../../types/canvas'; // Adjusted path
import { getImageType, getDisplayDimensions } from '../../lib/canvas/image-type-utils'; // Adjusted path
import { SAMPLE_METADATA } from '../../data/metadata'; // Adjusted path
import { LuxuryLogger } from '../../lib/utils/luxury-logger'; // Adjusted path

/**
 * DATA FLOW: Convex → canvas
 * ----------------------------------------
 * 1. Convex listForCanvas returns (per item):
 *    { _id, _creationTime, id, title, description, symbol?, ticker?, date?, countdownDate?,
 *      image?, rrp?, tokenPrice?, marketCap?, tokenSupply?, listingId?, showOnCanvas,
 *      isFeatured, isLive, showOnDrops }
 *    Only items with showOnCanvas === true are returned.
 *
 * 2. convexDocToMetadata maps to ImageInfo.metadata (what we use on canvas):
 *    { id, title, description, symbol?, ticker?, date?, countdownDate?, image?, rrp?,
 *      tokenPrice?, marketCap?, tokenSupply?, isFeatured, isLive }
 *    Required for display: title, description; image is optional (placeholder used if missing).
 *
 * 3. Each item becomes ImageInfo: { element, type, displayWidth, displayHeight, metadata }.
 *    finishLoading filters out any entry where !img || !img.metadata (quiet drop).
 */
const DEV_LOG_CANVAS_DATA =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

/** Shape of a Convex canvasItems document (avoids depending on _generated at type-check). */
type CanvasItemDoc = {
  _id?: string;
  _creationTime?: number;
  id: string;
  title: string;
  description: string;
  symbol?: string;
  ticker?: string;
  date?: string;
  countdownDate?: string;
  image?: string;
  rrp?: number;
  tokenPrice?: number;
  marketCap?: number;
  tokenSupply?: number;
  listingId?: string;
  showOnCanvas?: boolean;
  isFeatured: boolean;
  isLive: boolean;
  showOnDrops?: boolean;
};

/** Map Convex canvasItems doc to metadata shape expected by the loader. */
function convexDocToMetadata(doc: CanvasItemDoc): ImageInfo['metadata'] {
  return {
    id: doc.id,
    title: doc.title,
    description: doc.description,
    symbol: doc.symbol,
    ticker: doc.ticker,
    date: doc.date,
    countdownDate: doc.countdownDate,
    image: doc.image,
    rrp: doc.rrp,
    tokenPrice: doc.tokenPrice,
    marketCap: doc.marketCap,
    tokenSupply: doc.tokenSupply,
    isFeatured: doc.isFeatured,
    isLive: doc.isLive,
  };
}
import { loadImageWithFallback } from '../../lib/utils/image-loader-utils'; // Phase 2 Step 1: Standardized CORS handling
import { safeCanvasToDataURL } from '../../lib/utils/canvas-error-boundary'; // Phase 2 Step 9: Safe canvas operations
import { browserUtils, getDeviceCapabilities } from '../../lib/utils/browser-utils'; // Browser-specific optimizations

interface UseImageLoaderProps {
  unitSize: number; // Add unitSize as a prop
  enableLazyLoading?: boolean; // New prop to enable lazy loading
}

// Browser-specific image loading configurations
const getBrowserImageLoadingConfig = () => {
  const capabilities = getDeviceCapabilities();
  const isSafari = browserUtils.isSafari();
  const isFirefox = browserUtils.isFirefox();
  const isBrave = navigator.userAgent.includes('Brave');
  const isChrome = browserUtils.isChrome();
  const isMobile = browserUtils.isMobile();

  // Safari Mobile - Conservative approach due to memory constraints
  if (isSafari && isMobile) {
    return {
      concurrent: capabilities.performanceTier === 'high' ? 3 : 2, // Max 2-3 concurrent loads
      timeout: 20000, // Longer timeout for mobile networks
      retryAttempts: 3, // More retries for network issues
      enableCORS: false, // Avoid CORS complexity on Safari mobile
      preloadDistance: 1, // Only preload adjacent images
    };
  }

  // Firefox Mobile - Consistent performance approach
  if (isFirefox && isMobile) {
    return {
      concurrent: 4, // Firefox handles concurrent loads well
      timeout: 15000,
      retryAttempts: 2,
      enableCORS: true, // Firefox has good CORS handling
      preloadDistance: 2, // Moderate preloading
    };
  }

  // Brave Mobile - Privacy-aware approach
  if (isBrave && isMobile) {
    return {
      concurrent: 3, // Moderate due to privacy processing overhead
      timeout: 18000, // Extra time for privacy checks
      retryAttempts: 3, // More retries due to potential blocking
      enableCORS: true, // Try CORS first, fallback if blocked
      preloadDistance: 1, // Conservative preloading
    };
  }

  // Chrome Mobile - Optimized baseline
  if (isChrome && isMobile) {
    return {
      concurrent: capabilities.performanceTier === 'high' ? 6 : 4, // Aggressive concurrent loading
      timeout: 12000, // Shorter timeout, good network handling
      retryAttempts: 2,
      enableCORS: true, // Standard CORS support
      preloadDistance: 3, // Aggressive preloading
    };
  }

  // Desktop fallback - aggressive loading
  return {
    concurrent: 8,
    timeout: 10000,
    retryAttempts: 2,
    enableCORS: true,
    preloadDistance: 4,
  };
};

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
  // Phase 2 Step 9: Safe canvas toDataURL with browser format support
  const dataUrlResult = safeCanvasToDataURL(canvas);
  if (dataUrlResult.success && dataUrlResult.data) {
    img.src = dataUrlResult.data;
  } else {
    LuxuryLogger.log(
      `[Phase 2 Step 9] Placeholder creation failed: ${dataUrlResult.error?.message}`,
      'warn',
    );
    // Fallback: simple data URL
    img.src =
      'data:image/svg+xml;base64,' +
      btoa(`
      <svg width="${unitSize}" height="${unitSize}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#D0B264"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="${unitSize * 0.08}">Unavailable</text>
      </svg>
    `);
  }
  return img;
};

export const useImageLoader = ({ unitSize, enableLazyLoading = false }: UseImageLoaderProps) => {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const convexItems = useQuery(api.canvasItems.listForCanvas);
  const imagesToLoad = useMemo((): ImageInfo['metadata'][] | undefined => {
    // Convex useQuery returns undefined while loading. Do NOT use SAMPLE_METADATA here:
    // on refresh we'd load sample tiles then overwrite when Convex resolves, causing a race
    // where new uploads can disappear. Wait for Convex to resolve first.
    if (convexItems === undefined) {
      return undefined; // Still loading – effect will skip until we have a defined list
    }
    if (convexItems != null && convexItems.length > 0) {
      const mapped = convexItems.map((doc: CanvasItemDoc) => convexDocToMetadata(doc));
      if (DEV_LOG_CANVAS_DATA) {
        console.log('[canvas] Convex listForCanvas data:', {
          count: convexItems.length,
          raw: convexItems,
          mapped: mapped.map((m) => ({
            id: m.id,
            title: m.title,
            image: m.image ? 'set' : 'missing',
          })),
        });
      }
      return mapped;
    }
    if (DEV_LOG_CANVAS_DATA) {
      console.log('[canvas] Convex returned empty or null, using SAMPLE_METADATA:', {
        convexItemsNull: convexItems === null,
        length: convexItems?.length ?? 0,
      });
    }
    return SAMPLE_METADATA;
  }, [convexItems]);

  useEffect(() => {
    // Wait for Convex to resolve before loading. Prevents refresh race where we'd load
    // SAMPLE_METADATA then Convex data, and new uploads could be dropped or overwritten.
    if (imagesToLoad === undefined) {
      return;
    }

    let loadedCount = 0;
    const loadedImages: ImageInfo[] = [];

    // Get browser-specific loading configuration
    const loadingConfig = getBrowserImageLoadingConfig();

    // Clear the loading completion flag at start
    try {
      window.localStorage.removeItem('aces-images-loaded');
    } catch (error) {
      // Could not clear image loading flag - continue anyway
    }

    // Load ALL images: from Convex when available, else static SAMPLE_METADATA
    const totalImages = imagesToLoad.length;

    if (totalImages === 0) {
      LuxuryLogger.log('No image paths provided. Canvas will be empty.', 'warn');
      setImagesLoaded(true);
      setLoadingProgress(100);
      // Still signal completion even with no images
      try {
        window.localStorage.setItem('aces-images-loaded', 'true');
      } catch (error) {
        // Could not set image loading flag for empty state - continue anyway
      }
      return;
    }

    const finishLoading = () => {
      // Fill any indices that never got handleLoad/handleError (e.g. image load hung or global timeout fired).
      // This ensures Convex items are never dropped when one image is slow or the proxy times out.
      for (let i = 0; i < totalImages; i++) {
        if (loadedImages[i] == null && imagesToLoad[i]) {
          const meta = imagesToLoad[i];
          LuxuryLogger.log(
            `[canvas] Item "${meta.title ?? meta.id ?? 'Unknown'}" (id: ${meta.id}) did not finish loading; showing placeholder.`,
            'warn',
          );
          loadedImages[i] = {
            element: createLuxuryPlaceholderImage(unitSize),
            type: 'square',
            displayWidth: unitSize,
            displayHeight: unitSize,
            metadata: {
              ...meta,
              title: `${meta.title ?? 'Unknown'} (Loading timeout)`,
            },
          };
        }
      }

      // PRODUCTION FIX: Ensure all images have metadata before setting state
      const validImages = loadedImages.filter((img) => {
        if (!img || !img.metadata) {
          // Image missing metadata, filtering out (quiet failure)
          return false;
        }
        return true;
      });
      if (DEV_LOG_CANVAS_DATA && validImages.length !== loadedImages.length) {
        console.warn('[canvas] Some items dropped (missing element or metadata):', {
          total: loadedImages.length,
          valid: validImages.length,
          dropped: loadedImages.length - validImages.length,
        });
      }

      // Only set images if we have valid metadata for all
      if (validImages.length > 0) {
        setImages(validImages);
        // Signal that image metadata loading is complete
        try {
          window.localStorage.setItem('aces-images-loaded', 'true');
          LuxuryLogger.log(
            `Image metadata loading marked as complete. ${validImages.length}/${totalImages} valid images.`,
            'info',
          );
        } catch (error) {
          // Could not set image loading flag - continue anyway
        }

        // Minimal delay to allow the 100% to register before the fade-out
        setTimeout(() => {
          setImagesLoaded(true);
          LuxuryLogger.log(
            `Image loading complete. ${validImages.length}/${totalImages} loaded.`,
            'info',
          );
        }, 200); // Increased delay for production stability
      } else {
        // No valid images loaded, retrying
        setTimeout(() => {
          finishLoading(); // Retry
        }, 500);
      }
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
          // Could not set image loading flag on timeout - continue anyway
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

    imagesToLoad.forEach((metadata: ImageInfo['metadata'], index: number) => {
      // Enhanced null safety check
      if (!metadata) {
        // Metadata is null, skipping image
        updateState();
        return;
      }

      if (!metadata.image) {
        LuxuryLogger.log(
          `Image path is missing for "${metadata.title || 'Unknown'}" (id: ${metadata.id ?? 'unknown'}). Using placeholder. Fix in Convex or set listing imageGallery when syncing.`,
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

      // Check if this is a video file (submit-asset-video)
      const isVideo = metadata.image.endsWith('.mp4') || metadata.image.endsWith('.webm');

      if (isVideo) {
        // Handle video loading
        const video = document.createElement('video');
        video.src = metadata.image;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;

        video.addEventListener('loadeddata', () => {
          try {
            // Start playing the video
            video.play().catch((error) => {
              LuxuryLogger.log(`Video autoplay failed: ${error}`, 'warn');
            });

            const width = video.videoWidth || unitSize;
            const height = video.videoHeight || unitSize;

            const type = getImageType(width, height);
            const { width: proportionalWidth, height: proportionalHeight } = getDisplayDimensions(
              type,
              unitSize,
            );

            loadedImages[index] = {
              element: video as any, // Cast video to HTMLImageElement for typing
              type: 'submit-asset',
              displayWidth: proportionalWidth * (unitSize / 200),
              displayHeight: proportionalHeight * (unitSize / 200),
              metadata,
              isVideo: true, // Flag to indicate this is a video
            };
            updateState();
          } catch (error) {
            LuxuryLogger.log(`Video processing error: ${error}`, 'error');
            handleError();
          }
        });

        video.addEventListener('error', (e) => {
          LuxuryLogger.log(`Failed to load video: ${metadata.image}`, 'error');
          handleError();
        });

        // Timeout for video loading
        setTimeout(() => {
          if (!loadedImages[index]) {
            LuxuryLogger.log(`Video loading timeout: ${metadata.image}`, 'warn');
            handleError();
          }
        }, loadingConfig.timeout);

        return;
      }

      // Phase 2 Step 1: Use browser-specific loading configuration
      const loadImage = async () => {
        const result = await loadImageWithFallback({
          src: metadata.image!,
          enableCORS: loadingConfig.enableCORS,
          timeout: loadingConfig.timeout,
          retryAttempts: loadingConfig.retryAttempts,
        });

        if (result.success && result.image) {
          handleLoad(result.image);
        } else {
          handleError();
        }
      };

      const handleLoad = (img: HTMLImageElement) => {
        try {
          // If per-image timeout already set a placeholder, still overwrite with real image but don't double-count
          const wasAlreadySet = loadedImages[index] != null;

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
                  // Using fallback dimensions for image
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
                  if (!wasAlreadySet) updateState();
                } else {
                  // Metadata became null during image load processing
                  if (!wasAlreadySet) handleError();
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
              if (!wasAlreadySet) updateState();
            } else {
              // Metadata became null during image load processing
              if (!wasAlreadySet) handleError();
            }
          };

          getDimensions();
        } catch (error) {
          // Image load processing error
          if (loadedImages[index] == null) handleError(); // Fallback to error handling
        }
      };

      const handleError = () => {
        // Avoid double-setting if timeout and loadImage() both fire
        if (loadedImages[index] != null) return;
        LuxuryLogger.log(`Failed to load image: ${metadata.image}. Using placeholder.`, 'error');
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

      // Per-image timeout: if this image never completes (e.g. proxy hang), show placeholder
      // so the Convex item still appears instead of being dropped at global timeout
      const perImageTimeout = setTimeout(() => {
        if (loadedImages[index] == null) {
          LuxuryLogger.log(
            `[canvas] Per-image timeout for "${metadata.title ?? metadata.id}" (${metadata.image}).`,
            'warn',
          );
          handleError();
        }
      }, loadingConfig.timeout + 2000);

      // Phase 2 Step 1: Initiate standardized image loading
      loadImage().finally(() => clearTimeout(perImageTimeout));
    });

    return () => {
      clearTimeout(loadingTimeout);
    };
  }, [unitSize, enableLazyLoading, imagesToLoad]);

  return { images, loadingProgress, imagesLoaded };
};
