'use client';

/**
 * Pre-rendered Auction Notification icon for canvas drawing
 * This approach pre-renders the icon and caches it for synchronous drawing
 */

// Icon cache for different sizes and hover states
const iconCache = new Map<string, HTMLCanvasElement>();
let isInitialized = false;

/**
 * Initialize the Auction Notification icon cache with common sizes
 */
export const initializeCalendarIcon = (): void => {
  if (isInitialized) return;

  // Pre-render common sizes
  const sizes = [24, 32, 40, 48];
  const hoverStates = [0, 0.5, 1]; // Normal, mid-hover, full hover

  sizes.forEach((size) => {
    hoverStates.forEach((hoverProgress) => {
      preRenderCalendarIcon(size, hoverProgress);
    });
  });

  isInitialized = true;
};

/**
 * Pre-render an Auction Notification icon to canvas
 */
const preRenderCalendarIcon = (size: number, hoverProgress: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Calculate colors based on hover progress
  const baseOpacity = 0.8 + hoverProgress * 0.2;
  const strokeColor = `rgba(215, 191, 117, ${baseOpacity})`;

  // Draw the Auction Notification icon using SVG-like paths
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = 'none';
  ctx.lineWidth = 1; // Using stroke width from your SVG
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Scale coordinates to the icon size (48x48 viewBox)
  const scale = size / 48;

  // Gavel paths (transformed and scaled)
  const gavelScale = 1.1;
  const gavelOffsetX = 35;
  const gavelOffsetY = 8;

  // Gavel handle
  ctx.beginPath();
  ctx.moveTo(
    (14 - gavelOffsetX) * gavelScale * scale + gavelOffsetX * scale,
    (13 - gavelOffsetY) * gavelScale * scale + gavelOffsetY * scale,
  );
  ctx.lineTo(
    (5.619 - gavelOffsetX) * gavelScale * scale + gavelOffsetX * scale,
    (21.38 - gavelOffsetY) * gavelScale * scale + gavelOffsetY * scale,
  );
  ctx.stroke();

  // Gavel cross lines
  ctx.beginPath();
  ctx.moveTo(
    (16 - gavelOffsetX) * gavelScale * scale + gavelOffsetX * scale,
    (16 - gavelOffsetY) * gavelScale * scale + gavelOffsetY * scale,
  );
  ctx.lineTo(
    (22 - gavelOffsetX) * gavelScale * scale + gavelOffsetX * scale,
    (10 - gavelOffsetY) * gavelScale * scale + gavelOffsetY * scale,
  );
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(
    (21.5 - gavelOffsetX) * gavelScale * scale + gavelOffsetX * scale,
    (10.5 - gavelOffsetY) * gavelScale * scale + gavelOffsetY * scale,
  );
  ctx.lineTo(
    (13.5 - gavelOffsetX) * gavelScale * scale + gavelOffsetX * scale,
    (2.5 - gavelOffsetY) * gavelScale * scale + gavelOffsetY * scale,
  );
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(
    (8 - gavelOffsetX) * gavelScale * scale + gavelOffsetX * scale,
    (8 - gavelOffsetY) * gavelScale * scale + gavelOffsetY * scale,
  );
  ctx.lineTo(
    (14 - gavelOffsetX) * gavelScale * scale + gavelOffsetX * scale,
    (2 - gavelOffsetY) * gavelScale * scale + gavelOffsetY * scale,
  );
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(
    (8.5 - gavelOffsetX) * gavelScale * scale + gavelOffsetX * scale,
    (7.5 - gavelOffsetY) * gavelScale * scale + gavelOffsetY * scale,
  );
  ctx.lineTo(
    (16.5 - gavelOffsetX) * gavelScale * scale + gavelOffsetX * scale,
    (15.5 - gavelOffsetY) * gavelScale * scale + gavelOffsetY * scale,
  );
  ctx.stroke();

  // Base rectangles
  ctx.beginPath();
  ctx.roundRect(6 * scale, 34 * scale, 14 * scale, 4 * scale, 1.5 * scale);
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(8 * scale, 30 * scale, 10 * scale, 4 * scale, 1.5 * scale);
  ctx.stroke();

  // Bell with plus (transformed and scaled)
  const bellScale = 0.6;
  const bellOffsetX = 28;
  const bellOffsetY = 4;

  // Bell bottom curve
  ctx.beginPath();
  ctx.moveTo(
    (10.268 - bellOffsetX) * bellScale * scale + bellOffsetX * scale,
    (21 - bellOffsetY) * bellScale * scale + bellOffsetY * scale,
  );
  ctx.lineTo(
    (13.732 - bellOffsetX) * bellScale * scale + bellOffsetX * scale,
    (21 - bellOffsetY) * bellScale * scale + bellOffsetY * scale,
  );
  ctx.stroke();

  // Plus sign horizontal line
  ctx.beginPath();
  ctx.moveTo(
    (15 - bellOffsetX) * bellScale * scale + bellOffsetX * scale,
    (8 - bellOffsetY) * bellScale * scale + bellOffsetY * scale,
  );
  ctx.lineTo(
    (21 - bellOffsetX) * bellScale * scale + bellOffsetX * scale,
    (8 - bellOffsetY) * bellScale * scale + bellOffsetY * scale,
  );
  ctx.stroke();

  // Plus sign vertical line
  ctx.beginPath();
  ctx.moveTo(
    (18 - bellOffsetX) * bellScale * scale + bellOffsetX * scale,
    (5 - bellOffsetY) * bellScale * scale + bellOffsetY * scale,
  );
  ctx.lineTo(
    (18 - bellOffsetX) * bellScale * scale + bellOffsetX * scale,
    (11 - bellOffsetY) * bellScale * scale + bellOffsetY * scale,
  );
  ctx.stroke();

  // Bell body curve
  ctx.beginPath();
  ctx.moveTo(
    (20.002 - bellOffsetX) * bellScale * scale + bellOffsetX * scale,
    (14.464 - bellOffsetY) * bellScale * scale + bellOffsetY * scale,
  );
  ctx.quadraticCurveTo(
    (20.74 - bellOffsetX) * bellScale * scale + bellOffsetX * scale,
    (15.327 - bellOffsetY) * bellScale * scale + bellOffsetY * scale,
    (20 - bellOffsetX) * bellScale * scale + bellOffsetX * scale,
    (17 - bellOffsetY) * bellScale * scale + bellOffsetY * scale,
  );
  ctx.quadraticCurveTo(
    (4 - bellOffsetX) * bellScale * scale + bellOffsetX * scale,
    (17 - bellOffsetY) * bellScale * scale + bellOffsetY * scale,
    (3.26 - bellOffsetX) * bellScale * scale + bellOffsetX * scale,
    (15.327 - bellOffsetY) * bellScale * scale + bellOffsetY * scale,
  );
  ctx.quadraticCurveTo(
    (4.59 - bellOffsetX) * bellScale * scale + bellOffsetX * scale,
    (13.956 - bellOffsetY) * bellScale * scale + bellOffsetY * scale,
    (6 - bellOffsetX) * bellScale * scale + bellOffsetX * scale,
    (8 - bellOffsetY) * bellScale * scale + bellOffsetY * scale,
  );
  ctx.quadraticCurveTo(
    (8.75 - bellOffsetX) * bellScale * scale + bellOffsetX * scale,
    (2.668 - bellOffsetY) * bellScale * scale + bellOffsetY * scale,
    (20.002 - bellOffsetX) * bellScale * scale + bellOffsetX * scale,
    (14.464 - bellOffsetY) * bellScale * scale + bellOffsetY * scale,
  );
  ctx.stroke();

  return canvas;
};

/**
 * Get a pre-rendered Auction Notification icon canvas
 */
export const getCalendarIcon = (size: number, hoverProgress: number): HTMLCanvasElement => {
  const cacheKey = `auction-notification-${size}-${hoverProgress.toFixed(2)}`;

  // Check cache first
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }

  // Render and cache
  const canvas = preRenderCalendarIcon(size, hoverProgress);
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
export const clearCalendarIconCache = (): void => {
  iconCache.clear();
  isInitialized = false;
};
