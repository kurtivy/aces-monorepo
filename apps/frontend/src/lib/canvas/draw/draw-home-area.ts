import { UNIT_SIZE } from '../../../constants/canvas';
import { browserUtils } from '../../utils/browser-utils';
import { getDeviceCapabilities } from '../../utils/browser-utils';
import { getCanvasFontStack } from '../../utils/font-loader';

/**
 * Home area drawing component with Aces.Fun style guide integration
 *
 * Uses colors and design principles from zBUGS/frontend/aces_fun_style_guide.md:
 * - deepCharcoal (#231F20) for main backgrounds
 * - goldenBeige (#D0B284) for primary accents and borders
 * - highlightGold (#D7BF75) for text highlights and glows
 * - pureWhite (#FFFFFF) for text and highlights
 * - antiqueBronze (#928357) for gradient stops
 *
 * Layout: Banner at top, featured section centered, CREATE/DROPS buttons below
 */

// Safari-specific performance optimizations
const isSafari =
  typeof navigator !== 'undefined' &&
  navigator.userAgent.includes('Safari') &&
  !navigator.userAgent.includes('Chrome');

// Gradient cache for Safari performance
const homeAreaGradientCache = new Map<string, CanvasGradient>();

// Logo image cache for performance
const logoImageCache = new Map<string, HTMLImageElement>();

// Style guide colors from aces_fun_style_guide.md
const STYLE_COLORS = {
  deepCharcoal: '#231F20',
  goldenBeige: '#D0B284',
  pureWhite: '#FFFFFF',
  deepEmeraldGreen: '#184D37',
  platinumGrey: '#DCDDCC',
  highlightGold: '#D7BF75',
  antiqueBronze: '#928357',
  black: '#000000',
} as const;

// Load ACES website logo
const loadAcesWebsiteLogo = (): HTMLImageElement | null => {
  const cacheKey = 'aces-website-logo';

  if (logoImageCache.has(cacheKey)) {
    return logoImageCache.get(cacheKey)!;
  }

  const logoImg = new Image();
  logoImg.crossOrigin = 'anonymous';
  logoImg.src = '/png/aces-website-logo.webp';

  // Cache the image (even if not loaded yet)
  logoImageCache.set(cacheKey, logoImg);

  return logoImg;
};

// Load ACES circle logo
const loadAcesCircleLogo = (): HTMLImageElement | null => {
  const cacheKey = 'aces-logo';

  if (logoImageCache.has(cacheKey)) {
    return logoImageCache.get(cacheKey)!;
  }

  const logoImg = new Image();
  logoImg.crossOrigin = 'anonymous';
  logoImg.src = '/aces-logo.png';

  // Cache the image (even if not loaded yet)
  logoImageCache.set(cacheKey, logoImg);

  return logoImg;
};

export const drawHomeArea = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  logoImage: HTMLImageElement | null, // This param is kept for compatibility but not used
  mouseX = 0,
  mouseY = 0,
  homeAreaWidth: number,
  homeAreaHeight: number,
  spaceCanvas: HTMLCanvasElement | null = null,
  animationTime = 0,
  unitSize = UNIT_SIZE,
  opacity: number = 1, // Add opacity parameter
  quadrantPrompts: readonly string[] = ['LAUNCH', 'DROPS'], // Updated default prompts
) => {
  // Smart mobile optimization: detect mobile device
  const capabilities = getDeviceCapabilities();
  const isMobileDevice = capabilities.touchCapable || capabilities.isMobileSafari;

  const radius = 12;

  // Background with gradient - Safari optimization: cache gradients
  ctx.save();

  // Apply opacity for fade-in effect
  ctx.globalAlpha = opacity;

  const gradientKey = `home-bg-${Math.round(homeAreaWidth)}-${Math.round(homeAreaHeight)}`;
  let backgroundGradient = homeAreaGradientCache.get(gradientKey);

  if (!backgroundGradient) {
    backgroundGradient = ctx.createLinearGradient(0, 0, homeAreaWidth, homeAreaHeight);
    backgroundGradient.addColorStop(0, STYLE_COLORS.deepCharcoal);
    backgroundGradient.addColorStop(1, STYLE_COLORS.black);

    // Cache for reuse (limit cache size)
    if (homeAreaGradientCache.size < 20) {
      homeAreaGradientCache.set(gradientKey, backgroundGradient);
    }
  }

  ctx.fillStyle = backgroundGradient;
  ctx.beginPath();
  ctx.roundRect(x, y, homeAreaWidth, homeAreaHeight, radius);
  ctx.fill();

  // Add deep emerald green overlay at 50% opacity
  ctx.fillStyle = `rgba(0,0,0, 1)`;
  ctx.beginPath();
  ctx.roundRect(x, y, homeAreaWidth, homeAreaHeight, radius);
  ctx.fill();

  // Add space background (performance optimized)
  if (spaceCanvas && !browserUtils.needsPerformanceMode()) {
    ctx.globalAlpha = 0.7;
    ctx.drawImage(spaceCanvas, x, y, homeAreaWidth, homeAreaHeight);
    ctx.globalAlpha = 1.0;
  }

  ctx.restore();

  // Calculate layout dimensions
  const centerX = x + homeAreaWidth / 2;
  const centerY = y + homeAreaHeight / 2;
  // Old layout variables - no longer needed since we now have separate areas
  // const bannerHeight = homeAreaHeight * 0.2; // 20% for banner
  // const featuredHeight = homeAreaHeight * 0.6; // 60% for featured section
  // const buttonHeight = homeAreaHeight * 0.2; // 20% for buttons

  // Smart mobile optimization: disable expensive dot animations on mobile
  const shouldShowDotPattern = !isMobileDevice && browserUtils.shouldUseComplexDotPattern();

  // Draw animated dot pattern for texture (disabled on mobile for performance)
  if (shouldShowDotPattern) {
    ctx.save();
    const dotSpacing = 12;
    const time = animationTime * 0.001; // Convert to seconds

    for (let dotX = x + 6; dotX < x + homeAreaWidth - 6; dotX += dotSpacing) {
      for (let dotY = y + 6; dotY < y + homeAreaHeight - 6; dotY += dotSpacing) {
        // Skip dots that would interfere with content areas
        const distanceFromCenter = Math.sqrt(
          Math.pow(dotX - centerX, 2) + Math.pow(dotY - (y + homeAreaHeight / 2), 2),
        );
        if (distanceFromCenter > homeAreaHeight * 0.25) {
          // Create subtle animation for each dot
          const dotIndex = (dotX / dotSpacing) * 100 + dotY / dotSpacing;
          const animationOffset = Math.sin(time * 2 + dotIndex * 0.1) * 0.3;
          const opacityPulse = 0.2 + Math.sin(time * 1.5 + dotIndex * 0.05) * 0.1;

          ctx.fillStyle = `rgba(255, 255, 255, ${opacityPulse})`;
          ctx.beginPath();
          ctx.arc(dotX + animationOffset, dotY + animationOffset * 0.5, 1.0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // Draw premium multi-layered border (MADE THINNER)
  ctx.save();

  // Safari optimization: Skip expensive shadow effects on Safari
  if (!isSafari && !isMobileDevice) {
    // Layer 1: Outer glow (desktop only, not Safari) - using highlightGold
    ctx.shadowColor = 'rgba(215, 191, 117, 0.6)';
    ctx.shadowBlur = 15;
  }

  ctx.strokeStyle = STYLE_COLORS.goldenBeige;
  ctx.lineWidth = 1; // REDUCED from 4 to 2
  ctx.beginPath();
  ctx.roundRect(x, y, homeAreaWidth, homeAreaHeight, radius);
  ctx.stroke();

  // Layer 2: Inner border with gradient - Safari optimization: cache gradients
  ctx.shadowBlur = 0;

  const borderGradientKey = `home-border-${Math.round(homeAreaWidth)}-${Math.round(homeAreaHeight)}`;
  let borderGradient = homeAreaGradientCache.get(borderGradientKey);

  if (!borderGradient) {
    borderGradient = ctx.createLinearGradient(0, 0, homeAreaWidth, homeAreaHeight);
    borderGradient.addColorStop(0, STYLE_COLORS.pureWhite);
    borderGradient.addColorStop(0.5, STYLE_COLORS.goldenBeige);
    borderGradient.addColorStop(1, STYLE_COLORS.antiqueBronze);

    // Cache for reuse (limit cache size)
    if (homeAreaGradientCache.size < 20) {
      homeAreaGradientCache.set(borderGradientKey, borderGradient);
    }
  }

  ctx.strokeStyle = borderGradient;
  ctx.lineWidth = 1; // REDUCED from 2 to 1
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, homeAreaWidth - 2, homeAreaHeight - 2, radius - 1);
  ctx.stroke();

  ctx.restore();

  // The home area now only draws the two buttons (CREATE | DROPS)
  // Logo banner and featured section are drawn separately
  const buttonWidth = homeAreaWidth / 2;
  const buttonHeight = homeAreaHeight; // Use the full height of the home area

  // Draw circular logo in the center between the two buttons (full height)
  const circleLogo = loadAcesCircleLogo();
  if (circleLogo && circleLogo.complete) {
    ctx.save();

    // Calculate logo size to use full available height with smaller padding
    const padding = 4; // Reduced padding for bigger logo
    const logoSize = buttonHeight - padding * 2;
    const logoRadius = logoSize / 2;

    // Position logo in center
    const logoX = centerX - logoRadius;
    const logoY = y + padding;

    // Create circular clipping path
    ctx.beginPath();
    ctx.arc(centerX, y + padding + logoRadius, logoRadius, 0, Math.PI * 2);
    ctx.clip();

    // Draw the logo image
    ctx.drawImage(circleLogo, logoX, logoY, logoSize, logoSize);

    ctx.restore();

    // Optional: Add a golden border around the circular logo
    ctx.save();
    ctx.strokeStyle = STYLE_COLORS.goldenBeige;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, y + padding + logoRadius, logoRadius + 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Draw the two buttons with premium styling
  const drawButton = (text: string, isLeftButton: boolean) => {
    const btnX = x + (isLeftButton ? 0 : buttonWidth);
    const btnY = y; // Button area starts at y position

    // Smart mobile optimization: disable hover effects on mobile
    const isHovered =
      !isMobileDevice &&
      mouseX >= btnX &&
      mouseX <= btnX + buttonWidth &&
      mouseY >= btnY &&
      mouseY <= btnY + buttonHeight;

    // Button text with premium golden styling
    ctx.save();

    // Text glow effect (disabled for Safari artifact fix)
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Solid golden beige color for text using style guide colors
    ctx.fillStyle = STYLE_COLORS.goldenBeige;
    // Mobile-specific font sizing for half-height buttons
    const isMobile = unitSize <= 150;
    const baseFontSize = isMobile ? unitSize * 0.08 : unitSize * 0.1; // Smaller for half-height area
    const hoverFontSize = isMobile ? unitSize * 0.09 : unitSize * 0.11;
    ctx.font = `bold ${isHovered ? hoverFontSize : baseFontSize}px ${getCanvasFontStack('Proxima Nova')}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '2px'; // Slightly reduced letter spacing

    const textX = btnX + buttonWidth / 2;
    const textY = btnY + buttonHeight / 2;

    ctx.fillText(text, textX, textY);
    ctx.restore();
  };

  // Draw both buttons
  drawButton(quadrantPrompts[0] || 'LAUNCH', true); // Left button
  drawButton(quadrantPrompts[1] || 'DROPS', false); // Right button

  ctx.restore();
};

// Export function to get featured section coordinates for the featured section component
export const getFeaturedSectionBounds = (
  x: number,
  y: number,
  homeAreaWidth: number,
  homeAreaHeight: number,
) => {
  const bannerHeight = homeAreaHeight * 0.25;
  const featuredHeight = homeAreaHeight * 0.5;

  return {
    x: x + 8, // Add padding
    y: y + bannerHeight,
    width: homeAreaWidth - 16, // Subtract padding
    height: featuredHeight,
  };
};
