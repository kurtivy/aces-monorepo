import { lerp } from '../math-utils';

// Cache gradients to avoid recreating them every frame (Safari optimization)
const gradientCache = new Map<string, CanvasGradient>();

// Clear cache periodically to prevent memory leaks and state sticking
let lastCacheClear = 0;
const CACHE_CLEAR_INTERVAL = 30000; // Clear every 30 seconds (less aggressive)
const MAX_CACHE_SIZE = 100; // Limit cache size to prevent memory issues

// Detect Safari/Firefox for performance optimizations
const isSafari =
  typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isFirefox =
  typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
const needsPerformanceMode = isSafari || isFirefox;

// Create a cached gradient with a unique key that includes position
const getCachedGradient = (
  ctx: CanvasRenderingContext2D,
  key: string,
  type: 'linear' | 'radial',
  coordinates: number[],
  colorStops: Array<{ offset: number; color: string }>,
): CanvasGradient => {
  // Clear cache periodically to prevent sticking effects
  const now = performance.now();
  if (now - lastCacheClear > CACHE_CLEAR_INTERVAL || gradientCache.size > MAX_CACHE_SIZE) {
    // Use setTimeout to avoid clearing during frame rendering
    setTimeout(() => {
      gradientCache.clear();
    }, 0);
    lastCacheClear = now;
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

  // Create unique identifiers for this token's position
  const tokenId = `${Math.round(x)}_${Math.round(y)}`;
  const hoverState = hoverProgress > 0.01 ? 'hover' : 'normal';

  ctx.save();

  // Create clipping region for the background
  ctx.beginPath();
  ctx.roundRect(x + padding, y + padding, size, size, cornerRadius);
  ctx.clip();

  // Draw premium background - dark gradient with position-specific cache key
  const bgGradientKey = `bg-${tokenId}-${Math.round(size)}`;
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

  // Simplified dot pattern for Safari/Firefox performance
  // For performance mode browsers, only show dots on significant hover and reduce complexity
  const dotThreshold = needsPerformanceMode ? 0.5 : 0.1;
  if (hoverProgress > dotThreshold) {
    ctx.save();
    const dotSpacing = needsPerformanceMode ? 24 : 16; // Fewer dots for performance mode
    const time = animationTime * 0.001;

    // Pre-calculate logo exclusion area
    const logoExclusionRadius = logoImage ? unitSize * 0.25 : 0;

    for (let dotX = x + padding + 8; dotX < x + padding + size - 8; dotX += dotSpacing) {
      for (let dotY = y + padding + 8; dotY < y + padding + size - 8; dotY += dotSpacing) {
        // Skip dots that would be too close to the center logo area (if logo exists)
        if (logoImage) {
          const distanceFromCenter = Math.sqrt(
            Math.pow(dotX - centerX, 2) + Math.pow(dotY - centerY, 2),
          );
          if (distanceFromCenter < logoExclusionRadius) {
            continue; // Skip dots too close to logo
          }
        }

        // Simplified animation for each dot
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

  // Simplified inner glow effect with position and hover-specific cache key
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

  // Create cached radial gradient for inner glow with unique key per token and hover state
  const glowOpacity = lerp(0.1, 0.25, hoverProgress);
  const glowGradientKey = `glow-${tokenId}-${hoverState}-${Math.round(innerGlowSize)}-${glowOpacity.toFixed(2)}`;
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

  // Simplified border - remove shadow blur for Safari/Firefox performance
  // Layer 1: Main border without shadow
  const borderOpacity = lerp(0.6, 0.9, hoverProgress);
  ctx.strokeStyle = `rgba(208, 178, 100, ${borderOpacity})`;
  ctx.lineWidth = lerp(1.5, 2.5, hoverProgress);
  ctx.beginPath();
  ctx.roundRect(x + padding, y + padding, size, size, cornerRadius);
  ctx.stroke();

  // Layer 2: Inner border with position-specific cached gradient
  const borderGradientKey = `border-${tokenId}-${Math.round(size)}`;
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

    // Simplified logo rendering - remove shadow effects for performance mode
    ctx.save();
    ctx.globalAlpha = lerp(0.85, 1, hoverProgress);
    ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
    ctx.restore();
  }

  // Draw premium text with enhanced styling
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // "CREATE TOKEN" as a more prominent title
  // Position it higher in the box for better spacing
  const createTokenFontSize = lerp(unitSize * 0.09, unitSize * 0.11, hoverProgress); // Scaled font size
  ctx.font = `bold ${createTokenFontSize}px 'Syne'`; // Changed to Syne to match home area

  // Simplified text rendering - no shadow effects for performance
  // Gold gradient for text with position-specific cache key
  const textGradientKey = `text-${tokenId}-${unitSize}`;
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

  // Simplified shine effect - disable for performance mode entirely
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

    // Simplified gradient with position-specific cache key
    const shineGradientKey = `shine-${tokenId}-${hoverState}-${shineOpacity.toFixed(3)}`;
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
