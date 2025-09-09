'use client';

/**
 * Pre-rendered Lucide CalendarPlus icon for canvas drawing
 * This approach pre-renders the icon and caches it for synchronous drawing
 */

// Icon cache for different sizes and hover states
const iconCache = new Map<string, HTMLCanvasElement>();
let isInitialized = false;

/**
 * Initialize the CalendarPlus icon cache with common sizes
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
 * Pre-render a CalendarPlus icon to canvas
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

  // Draw the CalendarPlus icon using SVG-like paths
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = 'none';
  ctx.lineWidth = Math.max(1.5, size * 0.06); // Responsive line width
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Scale coordinates to the icon size
  const scale = size / 24; // Original icon is designed for 24x24

  // Calendar top lines (date tabs)
  ctx.beginPath();
  ctx.moveTo(8 * scale, 2 * scale);
  ctx.lineTo(8 * scale, 6 * scale);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(16 * scale, 2 * scale);
  ctx.lineTo(16 * scale, 6 * scale);
  ctx.stroke();

  // Calendar body rectangle
  ctx.beginPath();
  ctx.roundRect(3 * scale, 4 * scale, 18 * scale, 18 * scale, 2 * scale);
  ctx.stroke();

  // Calendar header line
  ctx.beginPath();
  ctx.moveTo(3 * scale, 10 * scale);
  ctx.lineTo(21 * scale, 10 * scale);
  ctx.stroke();

  // Plus sign in center
  const centerX = 12 * scale;
  const centerY = 16 * scale;
  const plusSize = 4 * scale;

  // Horizontal line of plus
  ctx.beginPath();
  ctx.moveTo(centerX - plusSize / 2, centerY);
  ctx.lineTo(centerX + plusSize / 2, centerY);
  ctx.stroke();

  // Vertical line of plus
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - plusSize / 2);
  ctx.lineTo(centerX, centerY + plusSize / 2);
  ctx.stroke();

  return canvas;
};

/**
 * Get a pre-rendered CalendarPlus icon canvas
 */
export const getCalendarIcon = (size: number, hoverProgress: number): HTMLCanvasElement => {
  const cacheKey = `calendar-${size}-${hoverProgress.toFixed(2)}`;

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
