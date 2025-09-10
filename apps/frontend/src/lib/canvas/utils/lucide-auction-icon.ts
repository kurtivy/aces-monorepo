'use client';

/**
 * Pre-rendered Auction Notification icon for canvas drawing
 * This approach uses the SVG directly as an image for reliable rendering
 */

// Icon cache for different sizes and hover states
const iconCache = new Map<string, HTMLCanvasElement>();
let isInitialized = false;

/**
 * Initialize the Auction Notification icon cache with common sizes
 */
export const initializeAuctionIcon = (): void => {
  if (isInitialized) return;

  // Pre-render common sizes (larger for better visibility)
  const sizes = [32, 48, 64, 80];
  const hoverStates = [0, 0.5, 1]; // Normal, mid-hover, full hover

  sizes.forEach((size) => {
    hoverStates.forEach((hoverProgress) => {
      preRenderAuctionIcon(size, hoverProgress);
    });
  });

  isInitialized = true;
};

/**
 * Pre-render an Auction Notification icon to canvas using SVG data URL
 */
const preRenderAuctionIcon = (size: number, hoverProgress: number): HTMLCanvasElement => {
  // Use higher resolution for better quality
  const scaleFactor = 2; // 2x resolution for crisp rendering
  const canvas = document.createElement('canvas');
  canvas.width = size * scaleFactor;
  canvas.height = size * scaleFactor;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Calculate colors based on hover progress (full opacity)
  const baseOpacity = 1.0; // Full opacity
  const strokeColor = `rgba(215, 191, 117, ${baseOpacity})`;

  // Create high-resolution SVG with bell-plus design
  // Use consistent stroke width of 1.5 for better visibility
  const strokeWidth = 1.5; // Clean, crisp stroke width

  const svgString = `
    <svg width="${size * scaleFactor}" height="${size * scaleFactor}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="shape-rendering: geometricPrecision;">
      <!-- Bell-plus notification icon scaled to 65% with hover scaling and moved right -->
      <g transform="scale(${0.65 * (1 + hoverProgress * 0.1)}) translate(8, 0)">
        <path d="M10.268 21a2 2 0 0 0 3.464 0" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M15 8h6" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M18 5v6" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M20.002 14.464a9 9 0 0 0 .738.863A1 1 0 0 1 20 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 8.75-5.332" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    </svg>
  `;

  // Convert SVG to data URL and create image
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, size * scaleFactor, size * scaleFactor);

    // Enable high-quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw at higher resolution for crisp rendering
    ctx.drawImage(img, 0, 0, size * scaleFactor, size * scaleFactor);
    URL.revokeObjectURL(url);
  };
  img.src = url;

  return canvas;
};

/**
 * Get a pre-rendered Auction Notification icon canvas
 */
export const getAuctionIcon = (size: number, hoverProgress: number): HTMLCanvasElement => {
  const cacheKey = `auction-notification-${size}-${hoverProgress.toFixed(2)}`;

  // Check cache first
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }

  // Render and cache
  const canvas = preRenderAuctionIcon(size, hoverProgress);
  iconCache.set(cacheKey, canvas);

  // Limit cache size
  if (iconCache.size > 50) {
    const firstKey = iconCache.keys().next().value;
    if (firstKey) {
      iconCache.delete(firstKey);
    }
  }

  return canvas;
};

/**
 * Clear the icon cache (useful for memory cleanup)
 */
export const clearAuctionIconCache = (): void => {
  iconCache.clear();
  isInitialized = false;
};
