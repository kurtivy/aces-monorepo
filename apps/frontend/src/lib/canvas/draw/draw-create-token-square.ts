import { lerp } from '../math-utils';
import { browserUtils } from '../../utils/browser-utils';

// Phase 2 Step 5 Action 3: Optimized gradient cache management with race condition fixes
const gradientCache = new Map<string, CanvasGradient>();

// Phase 2 Step 5 Action 3: Enhanced cache state management to prevent race conditions
let lastCacheClear = 0;
let isClearing = false; // Prevent concurrent clearing operations
let clearTimeoutId: number | null = null; // Track pending clear operations

// Phase 2 Step 5 Action 3: Simplified cache management for all browsers

// Phase 2 Step 5 Action 3: Simplified settings - get once at module load, no dynamic updates needed
const cacheSettings = {
  cacheSize: browserUtils.getGradientCacheSize(),
  clearInterval: browserUtils.getGradientCacheClearInterval(),
};

const needsPerformanceMode = browserUtils.needsPerformanceMode();

// Create a cached gradient with a unique key that includes position
const getCachedGradient = (
  ctx: CanvasRenderingContext2D,
  key: string,
  type: 'linear' | 'radial',
  coordinates: number[],
  colorStops: Array<{ offset: number; color: string }>,
): CanvasGradient => {
  // Phase 2 Step 5 Action 3: Simplified cache management - minimal overhead
  const now = performance.now();

  // Phase 2 Step 5 Action 3: Enhanced cache clearing with race condition prevention
  const shouldClear =
    !isClearing &&
    (now - lastCacheClear > cacheSettings.clearInterval ||
      gradientCache.size > cacheSettings.cacheSize);

  if (shouldClear) {
    isClearing = true;

    // Cancel any pending clear operation
    if (clearTimeoutId !== null) {
      clearTimeout(clearTimeoutId);
    }

    // Phase 2 Step 5 Action 3: Simplified cache clearing for optimal performance across all browsers
    clearTimeoutId = window.setTimeout(() => {
      // Simple, fast cache clearing - gradient creation is fast enough that complex retention isn't worth it
      gradientCache.clear();

      lastCacheClear = now;
      isClearing = false;
      clearTimeoutId = null;
    }, 0);
  }

  if (gradientCache.has(key)) {
    return gradientCache.get(key)!;
  }

  let gradient: CanvasGradient;
  if (type === 'linear') {
    gradient = ctx.createLinearGradient(
      coordinates[0],
      coordinates[1],
      coordinates[2],
      coordinates[3],
    );
  } else {
    gradient = ctx.createRadialGradient(
      coordinates[0],
      coordinates[1],
      coordinates[2],
      coordinates[3],
      coordinates[4],
      coordinates[5],
    );
  }

  colorStops.forEach((stop) => {
    gradient.addColorStop(stop.offset, stop.color);
  });

  gradientCache.set(key, gradient);
  return gradient;
};

export const drawCreateTokenSquare = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hoverProgress: number, // Now accepts a progress value (0 to 1)
  unitSize: number,
  logoImage: HTMLImageElement | null,
  spaceCanvas: HTMLCanvasElement | null,
  animationTime = 0, // Add animation time parameter
) => {
  const size = lerp(unitSize, unitSize * 1.05, hoverProgress); // Interpolate size
  const padding = (unitSize - size) / 2;
  const centerX = x + unitSize / 2;
  const centerY = y + unitSize / 2;
  const cornerRadius = 8; // Slightly larger corner radius for a more premium look

  // Phase 2 Step 5 Action 3: Simplified cache key generation - minimal math overhead
  const tokenId = `${Math.round(x)}_${Math.round(y)}`; // Simple position-based keys
  const hoverState = hoverProgress > 0.01 ? 'hover' : 'normal';
  const sizeKey = Math.round(size); // Simple size rounding

  ctx.save();

  // Create clipping region for the background
  ctx.beginPath();
  ctx.roundRect(x + padding, y + padding, size, size, cornerRadius);
  ctx.clip();

  // Phase 2 Step 5 Action 3: Optimized background gradient with better cache key
  const bgGradientKey = `bg-${tokenId}-${sizeKey}`;
  const bgGradient = getCachedGradient(
    ctx,
    bgGradientKey,
    'linear',
    [x + padding, y + padding, x + padding + size, y + padding + size],
    [
      { offset: 0, color: '#1A1A1A' },
      { offset: 1, color: '#0A0A0A' },
    ],
  );
  ctx.fillStyle = bgGradient;
  ctx.fillRect(x + padding, y + padding, size, size);

  // Performance optimization: disable space animation for Safari/Firefox
  if (spaceCanvas && !needsPerformanceMode) {
    ctx.globalAlpha = 0.7;
    ctx.drawImage(spaceCanvas, x + padding, y + padding, size, size);
    ctx.globalAlpha = 1.0;
  }

  const dotThreshold = needsPerformanceMode ? 0.5 : 0.1;
  if (hoverProgress > dotThreshold) {
    ctx.save();
    const dotSpacing = needsPerformanceMode ? 24 : 16;
    const time = animationTime * 0.001;

    // Pre-calculate logo exclusion area
    const logoExclusionRadius = logoImage ? unitSize * 0.25 : 0;

    for (let dotX = x + padding + 8; dotX < x + padding + size - 8; dotX += dotSpacing) {
      for (let dotY = y + padding + 8; dotY < y + padding + size - 8; dotY += dotSpacing) {
        if (logoImage) {
          const distanceFromCenter = Math.sqrt(
            Math.pow(dotX - centerX, 2) + Math.pow(dotY - centerY, 2),
          );
          if (distanceFromCenter < logoExclusionRadius) {
            continue; // Skip dots too close to logo
          }
        }

        const baseOpacity = 0.12 * hoverProgress; // Scale with hover progress

        // For performance mode browsers, use static opacity
        if (needsPerformanceMode) {
          const opacity = baseOpacity * 0.6; // Static opacity for performance mode
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        } else {
          const pulsePhase = (dotX + dotY) * 0.01 + time * 1.5;
          const opacity = baseOpacity + Math.sin(pulsePhase) * 0.04;
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        }

        ctx.beginPath();
        ctx.arc(dotX, dotY, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  ctx.restore();

  const innerGlowSize = size - 4;
  const innerGlowPadding = (unitSize - innerGlowSize) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(
    x + innerGlowPadding,
    y + innerGlowPadding,
    innerGlowSize,
    innerGlowSize,
    cornerRadius - 2,
  );
  ctx.clip();

  // Phase 2 Step 5 Action 3: Simplified glow gradient cache key
  const glowOpacity = lerp(0.1, 0.25, hoverProgress);
  const glowGradientKey = `glow-${tokenId}-${hoverState}-${sizeKey}`;
  const glowGradient = getCachedGradient(
    ctx,
    glowGradientKey,
    'radial',
    [centerX, centerY, 0, centerX, centerY, size / 1.5],
    [
      { offset: 0, color: `rgba(208, 178, 100, ${glowOpacity})` },
      { offset: 0.7, color: 'rgba(208, 178, 100, 0.05)' },
      { offset: 1, color: 'rgba(208, 178, 100, 0)' },
    ],
  );

  ctx.fillStyle = glowGradient;
  ctx.fillRect(x + innerGlowPadding, y + innerGlowPadding, innerGlowSize, innerGlowSize);
  ctx.restore();

  // Layer 1: Main border without shadow
  const borderOpacity = lerp(0.6, 0.9, hoverProgress);
  ctx.strokeStyle = `rgba(208, 178, 100, ${borderOpacity})`;
  ctx.lineWidth = lerp(1.5, 2.5, hoverProgress);
  ctx.beginPath();
  ctx.roundRect(x + padding, y + padding, size, size, cornerRadius);
  ctx.stroke();

  // Phase 2 Step 5 Action 3: Optimized border gradient with better cache key
  const borderGradientKey = `border-${tokenId}-${sizeKey}`;
  const borderGradient = getCachedGradient(
    ctx,
    borderGradientKey,
    'linear',
    [x + padding, y + padding, x + padding + size, y + padding + size],
    [
      { offset: 0, color: 'rgba(255, 255, 255, 0.9)' },
      { offset: 0.5, color: 'rgba(208, 178, 100, 0.8)' },
      { offset: 1, color: 'rgba(173, 142, 66, 0.9)' },
    ],
  );

  ctx.strokeStyle = borderGradient;
  ctx.lineWidth = lerp(1, 1.5, hoverProgress);
  ctx.beginPath();
  ctx.roundRect(x + padding + 1, y + padding + 1, size - 2, size - 2, cornerRadius - 1);
  ctx.stroke();

  // Draw logo with simplified effects for Safari/Firefox
  if (logoImage) {
    // Reduced logo size for better spacing
    const logoSize = lerp(unitSize * 0.45, unitSize * 0.55, hoverProgress);
    const logoX = centerX - logoSize / 2;
    // Center the logo vertically
    const logoY = centerY - logoSize / 2;

    ctx.save();
    ctx.globalAlpha = lerp(0.85, 1, hoverProgress);
    ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
    ctx.restore();
  }

  // Draw premium text with enhanced styling
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const createTokenFontSize = lerp(unitSize * 0.09, unitSize * 0.11, hoverProgress); // Scaled font size
  ctx.font = `bold ${createTokenFontSize}px 'Syne'`; // Changed to Syne to match home area

  // Phase 2 Step 5 Action 3: Simplified text gradient cache key
  const textGradientKey = `text-${tokenId}-${Math.round(unitSize)}`;
  const textGradient = getCachedGradient(
    ctx,
    textGradientKey,
    'linear',
    [
      centerX - unitSize * 0.35,
      y + unitSize * 0.15,
      centerX + unitSize * 0.35,
      y + unitSize * 0.15,
    ],
    [
      { offset: 0, color: '#FFFFFF' },
      { offset: 0.5, color: '#D0B264' },
      { offset: 1, color: '#FFFFFF' },
    ],
  );

  ctx.fillStyle = textGradient;

  // Position title higher in the box
  ctx.fillText(
    'CREATE TOKEN',
    centerX,
    lerp(
      y + unitSize * 0.18, // Higher position
      y + unitSize * 0.16, // Even higher on hover
      hoverProgress,
    ),
  );

  // ADJUSTED: "COMING SOON" with more appropriate letter spacing
  const comingSoonFontSize = lerp(unitSize * 0.08, unitSize * 0.09, hoverProgress); // Scaled font size
  ctx.font = `bold ${comingSoonFontSize}px 'Syne'`; // Changed to Syne to match home area

  // White color for "COMING SOON" with slight gold tint
  ctx.fillStyle = `rgba(255, 255, 255, ${lerp(0.8, 1.0, hoverProgress)})`;

  // Position "COMING SOON" lower in the box
  const comingSoonY = lerp(
    y + unitSize * 0.82, // Lower position
    y + unitSize * 0.84, // Even lower on hover
    hoverProgress,
  );

  // Draw "COMING SOON" with adjusted letter spacing
  const comingSoonText = 'COMING SOON';

  // First, calculate the maximum width available for the text
  // Leave a safe margin from the edges (15% of the square size)
  const maxAvailableWidth = size * 0.85;

  // Measure the width of each character
  const charWidths = [];
  let totalNaturalWidth = 0;

  for (let i = 0; i < comingSoonText.length; i++) {
    const char = comingSoonText[i];
    const metrics = ctx.measureText(char);
    charWidths.push(metrics.width);
    totalNaturalWidth += metrics.width;
  }

  // Calculate the maximum possible tracking that will fit within the available width
  // Number of spaces between characters = number of characters - 1
  const numSpaces = comingSoonText.length - 1;
  const maxPossibleTracking =
    numSpaces > 0 ? (maxAvailableWidth - totalNaturalWidth) / numSpaces : 0;

  // Use a tracking value that's wide but guaranteed to fit
  // Start with a base tracking and cap it at the maximum possible
  const baseTracking = lerp(4, 6, hoverProgress); // Base desired tracking
  const safeTracking = Math.min(
    baseTracking,
    maxPossibleTracking > 0 ? maxPossibleTracking * 0.9 : 0,
  ); // 90% of max possible for safety margin

  // Calculate total width with the safe tracking
  const totalSpacingWidth = numSpaces * safeTracking;
  const totalWidth = totalNaturalWidth + totalSpacingWidth;

  // Calculate starting position to center the text
  let currentX = centerX - totalWidth / 2;

  // Draw each character with proper spacing
  for (let i = 0; i < comingSoonText.length; i++) {
    const char = comingSoonText[i];
    ctx.fillText(char, currentX + charWidths[i] / 2, comingSoonY);
    currentX += charWidths[i] + safeTracking;
  }

  ctx.restore();

  const shineThreshold = needsPerformanceMode ? 1.0 : 0.3; // Disable shine for performance mode
  if (hoverProgress > shineThreshold) {
    ctx.save();
    // Remove globalCompositeOperation for performance

    // Create a simpler diagonal shine effect
    const shineOpacity = (hoverProgress - shineThreshold) * 0.02; // More subtle
    const shineWidth = size * 0.4; // Smaller shine
    const shineHeight = size;
    const shineX = x + padding + size * lerp(-0.1, 0.2, hoverProgress);
    const shineY = y + padding;

    // Phase 2 Step 5 Action 3: Simplified shine gradient cache key
    const shineGradientKey = `shine-${tokenId}-${hoverState}`;
    const shineGradient = getCachedGradient(
      ctx,
      shineGradientKey,
      'linear',
      [shineX, shineY, shineX + shineWidth * 0.5, shineY + shineHeight],
      [
        { offset: 0, color: 'rgba(255, 255, 255, 0)' },
        { offset: 0.5, color: `rgba(255, 255, 255, ${shineOpacity})` },
        { offset: 1, color: 'rgba(255, 255, 255, 0)' },
      ],
    );

    ctx.fillStyle = shineGradient;
    ctx.fillRect(shineX, shineY, shineWidth, shineHeight);

    ctx.restore();
  }
};
