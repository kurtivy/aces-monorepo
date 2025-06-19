/**
 * Centralized Image Loading Utility
 *
 * Phase 2 Step 1: Standardize CORS and Image Loading Strategy
 *
 * This utility provides:
 * - Consistent CORS handling across all components
 * - Fallback strategy for CORS failures
 * - Tainted canvas detection
 * - Proper timing for crossOrigin setting
 * - Feature detection over user agent detection
 */

import { LuxuryLogger } from './luxury-logger';

interface ImageLoadOptions {
  src: string;
  enableCORS?: boolean;
  timeout?: number;
  retryAttempts?: number;
}

interface ImageLoadResult {
  success: boolean;
  image: HTMLImageElement | null;
  error?: string;
  isTainted?: boolean;
  loadTime?: number;
}

/**
 * Determines if an image source requires CORS handling
 * Uses feature detection instead of user agent detection
 */
function requiresCORS(src: string): boolean {
  // Same-domain images (starting with '/') don't need CORS
  if (src.startsWith('/')) {
    return false;
  }

  // Data URLs don't need CORS
  if (src.startsWith('data:')) {
    return false;
  }

  // Check if it's from the same origin
  try {
    const url = new URL(src, window.location.origin);
    return url.origin !== window.location.origin;
  } catch {
    // If URL parsing fails, assume it needs CORS for safety
    return true;
  }
}

/**
 * Creates a luxury placeholder image for failed loads
 */
function createPlaceholderImage(width: number = 200, height: number = 200): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Luxurious gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, 'rgba(35, 31, 32, 0.8)');
    gradient.addColorStop(1, 'rgba(24, 77, 55, 0.8)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Gold border
    ctx.strokeStyle = 'rgba(208, 178, 100, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, width - 8, height - 8);

    // Elegant error text
    ctx.fillStyle = '#D0B264';
    ctx.font = `${Math.max(12, width * 0.08)}px "Neue World", Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Image Unavailable', width / 2, height / 2);
  }

  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
}

/**
 * Checks if a canvas is tainted (cannot use toDataURL)
 */
function isCanvasTainted(canvas: HTMLCanvasElement): boolean {
  try {
    // Try to get image data - will throw SecurityError if tainted
    canvas.toDataURL();
    return false;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'SecurityError') {
      return true;
    }
    // Other errors might indicate different issues
    LuxuryLogger.log(`Canvas taint check failed with unexpected error: ${error}`, 'warn');
    return true; // Assume tainted for safety
  }
}

/**
 * Loads an image with standardized CORS handling and fallback strategy
 */
export async function loadImageWithFallback(options: ImageLoadOptions): Promise<ImageLoadResult> {
  const { src, enableCORS = true, timeout = 15000, retryAttempts = 2 } = options;
  const startTime = performance.now();

  // Step 1: Determine if CORS is needed
  const needsCORS = enableCORS && requiresCORS(src);

  // Step 2: Try loading with CORS if needed
  if (needsCORS) {
    const corsResult = await attemptImageLoad(src, true, timeout);
    if (corsResult.success) {
      return {
        ...corsResult,
        loadTime: performance.now() - startTime,
      };
    }

    LuxuryLogger.log(
      `CORS load failed for ${src}, attempting without CORS: ${corsResult.error}`,
      'warn',
    );
  }

  // Step 3: Try loading without CORS (fallback)
  for (let attempt = 0; attempt < retryAttempts; attempt++) {
    const result = await attemptImageLoad(src, false, timeout);
    if (result.success) {
      return {
        ...result,
        loadTime: performance.now() - startTime,
      };
    }

    if (attempt < retryAttempts - 1) {
      LuxuryLogger.log(`Load attempt ${attempt + 1} failed for ${src}, retrying...`, 'warn');
      // Brief delay before retry
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // Step 4: All attempts failed - return placeholder
  LuxuryLogger.log(`All load attempts failed for ${src}, using placeholder`, 'error');
  return {
    success: false,
    image: createPlaceholderImage(),
    error: 'All load attempts failed',
    loadTime: performance.now() - startTime,
  };
}

/**
 * Attempts to load an image with specified CORS setting
 */
async function attemptImageLoad(
  src: string,
  useCORS: boolean,
  timeout: number,
): Promise<ImageLoadResult> {
  return new Promise((resolve) => {
    const img = new Image();
    let resolved = false;

    const resolveOnce = (result: ImageLoadResult) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(result);
    };

    // Set up timeout
    const timeoutId = setTimeout(() => {
      resolveOnce({
        success: false,
        image: null,
        error: 'Image load timeout',
      });
    }, timeout);

    const cleanup = () => {
      clearTimeout(timeoutId);
      img.onload = null;
      img.onerror = null;
    };

    // Set crossOrigin BEFORE setting src (Phase 2 requirement)
    if (useCORS) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      // Additional validation for dimensions (Firefox fix from Phase 1)
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      if (width === 0 || height === 0) {
        // Invalid dimensions - treat as error
        resolveOnce({
          success: false,
          image: null,
          error: 'Invalid image dimensions',
        });
        return;
      }

      resolveOnce({
        success: true,
        image: img,
        isTainted: useCORS ? false : undefined, // Only check taint for non-CORS images if needed
      });
    };

    img.onerror = (error) => {
      resolveOnce({
        success: false,
        image: null,
        error: `Image load failed: ${error}`,
      });
    };

    // Set src AFTER crossOrigin (Phase 2 requirement)
    img.src = src;
  });
}

/**
 * Validates if an image can be used for canvas operations without CORS issues
 */
export function validateImageForCanvas(img: HTMLImageElement): boolean {
  // Create a temporary canvas to test
  const testCanvas = document.createElement('canvas');
  testCanvas.width = 1;
  testCanvas.height = 1;
  const ctx = testCanvas.getContext('2d');

  if (!ctx) return false;

  try {
    ctx.drawImage(img, 0, 0, 1, 1);
    return !isCanvasTainted(testCanvas);
  } catch (error) {
    LuxuryLogger.log(`Image validation failed: ${error}`, 'warn');
    return false;
  }
}

/**
 * Enhanced image loader hook for use in React components
 */
export interface EnhancedImageInfo {
  element: HTMLImageElement;
  src: string;
  isPlaceholder: boolean;
  loadTime?: number;
  canUseInCanvas: boolean;
}

/**
 * Batch load multiple images with progress tracking
 */
export async function loadImagesWithProgress(
  sources: string[],
  onProgress?: (loaded: number, total: number) => void,
): Promise<EnhancedImageInfo[]> {
  const results: EnhancedImageInfo[] = [];
  let loaded = 0;

  const loadPromises = sources.map(async (src, index) => {
    const result = await loadImageWithFallback({ src });

    const imageInfo: EnhancedImageInfo = {
      element: result.image || createPlaceholderImage(),
      src,
      isPlaceholder: !result.success,
      loadTime: result.loadTime,
      canUseInCanvas: result.success ? validateImageForCanvas(result.image!) : false,
    };

    results[index] = imageInfo;
    loaded++;

    if (onProgress) {
      onProgress(loaded, sources.length);
    }

    return imageInfo;
  });

  await Promise.all(loadPromises);
  return results;
}
