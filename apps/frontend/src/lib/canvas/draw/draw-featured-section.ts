import type { ImageInfo } from '../../../types/canvas';
import type { DeviceCapabilities } from '../../../types/capabilities';
import { getCanvasFontStack } from '../../utils/font-loader';
import { getAuctionIcon, initializeAuctionIcon } from '../utils/lucide-auction-icon';
import { getResponsiveMetrics, type ResponsiveMetrics } from '../../utils/responsive-canvas-utils';

// Responsive PIN configuration
const createPinConfig = (responsiveMetrics: ResponsiveMetrics) => ({
  radius: 3.5 * responsiveMetrics.iconScale,
  insetDesktop: 8 * responsiveMetrics.paddingScale,
  insetMobile: 6 * responsiveMetrics.paddingScale,
  color: '#D8DCE2',
  shadowBlur: 2 * responsiveMetrics.borderScale,
  shadowColor: 'rgba(0,0,0,0.18)',
  highlight: 'rgba(255,255,255,0.8)',
  alpha: 0.85, // <— control pin opacity here
});

// Update drawPin to multiply existing alpha by PIN.alpha
function drawPin(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  pinConfig: ReturnType<typeof createPinConfig>,
) {
  ctx.save();
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = prevAlpha * pinConfig.alpha; // keeps your card's overall opacity intact

  ctx.shadowColor = pinConfig.shadowColor;
  ctx.shadowBlur = pinConfig.shadowBlur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;

  const grad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.1, cx, cy, r);
  grad.addColorStop(0, '#F4F6F9');
  grad.addColorStop(0.6, pinConfig.color);
  grad.addColorStop(1, '#B9C0C8');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // tiny highlight (inherits the same alpha)
  ctx.shadowBlur = 0;
  ctx.fillStyle = pinConfig.highlight;
  ctx.beginPath();
  ctx.arc(cx - r * 0.28, cy - r * 0.28, r * 0.14, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = prevAlpha;
  ctx.restore();
}

// metrics helper
function getTextMetrics(ctx: CanvasRenderingContext2D, text: string, font: string) {
  ctx.save();
  ctx.font = font;
  const m = ctx.measureText(text);
  const ascent =
    (m as unknown as { actualBoundingBoxAscent?: number; emHeightAscent?: number })
      .actualBoundingBoxAscent ??
    Math.max(
      0,
      (m as unknown as { emHeightAscent?: number }).emHeightAscent ?? parseFloat(font) * 0.8,
    );
  const descent =
    (m as unknown as { actualBoundingBoxDescent?: number; emHeightDescent?: number })
      .actualBoundingBoxDescent ??
    Math.max(
      0,
      (m as unknown as { emHeightDescent?: number }).emHeightDescent ?? parseFloat(font) * 0.2,
    );
  ctx.restore();
  return { width: m.width, ascent, descent };
}

// NEW: Auction Notification icon drawing function
const drawLucideAuctionIcon = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  hoverProgress = 0,
  responsiveMetrics?: ResponsiveMetrics, // Add responsive metrics parameter
) => {
  ctx.save();

  // Apply hover scale effect with responsive scaling
  const iconScale = responsiveMetrics?.iconScale || 1;
  const scale = 1 + hoverProgress * 0.05 * iconScale; // 5% scale increase on hover
  const scaledSize = size * scale * iconScale;
  const offsetX = (scaledSize - size) / 2;
  const offsetY = (scaledSize - size) / 2;

  const iconX = x - offsetX;
  const iconY = y - offsetY;

  // Initialize the auction icon cache on first use
  if (typeof window !== 'undefined') {
    initializeAuctionIcon();
  }

  // Get the pre-rendered Auction Notification icon
  try {
    const iconCanvas = getAuctionIcon(scaledSize, hoverProgress);

    // Apply drop shadow for depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;

    // Draw the high-resolution icon scaled down to target size
    ctx.drawImage(iconCanvas, iconX, iconY, scaledSize, scaledSize);
  } catch (error) {
    // Fallback: draw a simple plus sign if icon fails
    const baseOpacity = 0.8 + hoverProgress * 0.2;
    const iconColor = `rgba(215, 191, 117, ${baseOpacity})`;

    ctx.strokeStyle = iconColor;
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';

    const plusSize = scaledSize * 0.6;
    const centerX = iconX + scaledSize / 2;
    const centerY = iconY + scaledSize / 2;

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(centerX - plusSize / 2, centerY);
    ctx.lineTo(centerX + plusSize / 2, centerY);
    ctx.stroke();

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - plusSize / 2);
    ctx.lineTo(centerX, centerY + plusSize / 2);
    ctx.stroke();
  }

  ctx.restore();
};

// Helper function to get auction icon bounds for click detection
export const getAuctionIconBounds = (
  featuredX: number,
  featuredY: number,
  featuredWidth: number,
  featuredHeight: number,
  responsiveMetrics?: ResponsiveMetrics,
) => {
  const isMobile = responsiveMetrics?.isMobile || false;
  const iconScale = responsiveMetrics?.iconScale || 1;
  const paddingScale = responsiveMetrics?.paddingScale || 1;

  const iconSize = (isMobile ? 80 : 36) * iconScale; // Larger on mobile (56), smaller on desktop (36)
  const padding = (isMobile ? 12 : 16) * paddingScale;

  const iconX = featuredX + featuredWidth - iconSize - padding;
  const iconY = featuredY + padding;

  return {
    x: iconX,
    y: iconY,
    width: iconSize,
    height: iconSize,
  };
};

// Days left utility function
const calculateDaysLeft = (): { days: number; isExpired: boolean } => {
  // Target date: September 19, 2025, 9:00 AM EST
  const targetDate = new Date('2025-09-19T09:00:00-05:00'); // EST is UTC-5
  const now = new Date();
  const timeDiff = targetDate.getTime() - now.getTime();

  if (timeDiff <= 0) {
    return { days: 0, isExpired: true };
  }

  const days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)); // Use ceil to show full days remaining
  return { days, isExpired: false };
};

const drawDaysLeft = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  opacity: number,
  responsiveMetrics: ResponsiveMetrics,
) => {
  ctx.save();
  ctx.globalAlpha = opacity;

  const { days, isExpired } = calculateDaysLeft();
  const isMobile = responsiveMetrics.isMobile;

  // No card background - just text floating on the image

  if (isExpired) {
    // Show "LIVE NOW" when expired
    ctx.fillStyle = '#D0B284';
    const fontSize = (isMobile ? 32 : 48) * responsiveMetrics.fontScale;
    ctx.font = `bold ${fontSize}px ${getCanvasFontStack('NeueWorld')}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    const textX = x + width - (isMobile ? 15 : 20) * responsiveMetrics.paddingScale;
    const textY = y + height - (isMobile ? 15 : 20) * responsiveMetrics.paddingScale;
    ctx.fillText('LIVE NOW', textX, textY);
    ctx.restore();
    return;
  }

  // Format days with leading zero if less than 10
  const daysText = String(days).padStart(2, '0');
  // const daysText = '08';

  // Calculate font sizes with responsive scaling
  const baseNumberSize = responsiveMetrics.isMobile ? 140 : 100; // Bigger number on mobile, desktop uses 100
  const numberFontSize = baseNumberSize * responsiveMetrics.fontScale; // Responsive size for number
  const baseDaysSize = responsiveMetrics.isMobile ? 63 : 42; // 1.5x larger on mobile (42 * 1.5 = 63)
  const daysFontSize = baseDaysSize * responsiveMetrics.fontScale; // Responsive size for "DAYS"

  // Measure text dimensions for positioning
  ctx.font = `bold ${numberFontSize}px ${getCanvasFontStack('NeueWorld')}`;
  const numberMetrics = ctx.measureText(daysText);

  ctx.font = `${daysFontSize}px ${getCanvasFontStack('Spray Letters')}`;
  const daysMetrics = ctx.measureText('DAYS');

  // Use the same dimensions as the art card for positioning area with responsive scaling
  const baseCardWidth = isMobile ? Math.min(width * 0.55, 220) : Math.min(width * 0.45, 210); // Match art card width (updated to 220)
  const baseCardHeight = isMobile ? Math.min(height * 0.32, 120) : Math.min(height * 0.22, 85); // Match art card height

  const cardWidth = baseCardWidth * responsiveMetrics.baseScale;
  const cardHeight = baseCardHeight * responsiveMetrics.baseScale;
  // Position relative to right side for countdown positioning (not the actual art card position)
  const cardX = x + width - cardWidth - (isMobile ? 8 : 10) * responsiveMetrics.paddingScale; // Right-aligned for countdown reference
  const cardY = y + height - cardHeight - (isMobile ? 8 : 10) * responsiveMetrics.paddingScale;

  // Calculate total width for side-by-side layout with responsive spacing
  const spacing = 20 * responsiveMetrics.spacingScale; // Spacing between number and "DAYS"
  const totalWidth = numberMetrics.width + spacing + daysMetrics.width;

  // Position countdown closer to the white card with responsive positioning
  const horizontalGap = 4 * responsiveMetrics.paddingScale; // Gap between countdown and white card
  // Different horizontal positioning for mobile vs desktop - moved further right
  const horizontalOffset = responsiveMetrics.isMobile ? 210 : 190; // Moved mobile from 150 to 180 (more to the right)
  const startX =
    cardX - totalWidth - horizontalGap + horizontalOffset * responsiveMetrics.baseScale; // Position to the left of white card

  // Position number to align with card height using the calculated numberFontSize
  const baseY = cardY + numberFontSize; // Align number baseline with card height

  // ============================================
  // CALL 1: Draw the large number (e.g., "11")
  // ============================================
  ctx.fillStyle = '#D7BF75'; // Golden color
  ctx.font = `bold ${numberFontSize}px ${getCanvasFontStack('NeueWorld')}`;
  ctx.letterSpacing = `${4 * responsiveMetrics.spacingScale}px`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(daysText, startX, baseY);

  // ============================================
  // CALL 2-4: Draw "DAYS" text with layered effect
  // ============================================

  const daysX = startX + numberMetrics.width + spacing;
  const sprayLettersFont = `${daysFontSize}px var(--font-spray-letters), cursive, 'Arial Black', sans-serif`;
  ctx.font = sprayLettersFont;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top'; // Top alignment for precise positioning

  // Align "DAYS" text with the top of the white card
  const numberTop = cardY; // Align with top of white card
  const daysOffsetStep = daysFontSize * 0.3; // 40% of DAYS font height for layering

  // Draw first "DAYS" - 100% opacity, aligned with top of number
  ctx.fillStyle = '#D7BF75'; // 100% opacity
  ctx.letterSpacing = `${3 * responsiveMetrics.spacingScale}px`;
  ctx.font = `${28 * responsiveMetrics.fontScale}px ${getCanvasFontStack('Spray Letters')}`;
  ctx.fillText('DAYS', daysX, numberTop);

  // Draw second "DAYS" - 65% opacity, offset down
  ctx.fillStyle = 'rgba(208, 178, 132, 0.55)'; // 65% opacity
  ctx.fillText('DAYS', daysX, numberTop + daysOffsetStep);

  // Draw third "DAYS" - 30% opacity, offset further down
  ctx.fillStyle = 'rgba(208, 178, 132, 0.25)'; // 30% opacity
  ctx.fillText('DAYS', daysX, numberTop + daysOffsetStep * 2);

  ctx.restore();
};

export const drawArtGalleryCard = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  opacity: number,
  responsiveMetrics: ResponsiveMetrics,
) => {
  ctx.save();
  ctx.globalAlpha = opacity;

  const isMobile = responsiveMetrics.isMobile;
  const pinConfig = createPinConfig(responsiveMetrics);

  // Card size with responsive scaling - make mobile card larger
  const baseCardWidth = isMobile ? Math.min(width * 0.65, 250) : Math.min(width * 0.45, 210); // Wider on mobile
  const baseCardHeight = isMobile ? Math.min(height * 0.32, 120) : Math.min(height * 0.22, 85); // Taller on mobile

  const cardWidth = baseCardWidth * responsiveMetrics.baseScale;
  const cardHeight = baseCardHeight * responsiveMetrics.baseScale;
  const cardX = x + (isMobile ? 8 : 10) * responsiveMetrics.paddingScale;
  const cardY = y + height - cardHeight - (isMobile ? 8 : 10) * responsiveMetrics.paddingScale;

  // Soft drop shadow (kept subtle)
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.filter = 'blur(5px)';
  ctx.beginPath();
  ctx.roundRect(cardX + 1, cardY + 2, cardWidth, cardHeight, 5);
  ctx.fill();
  ctx.restore();

  // Card face
  ctx.fillStyle = 'rgba(253, 255, 250, 0.97)';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 4);
  ctx.fill();

  // Border
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.10)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // --- Pins (subtle + inset from edges) ---
  const r = pinConfig.radius;
  const inset = isMobile ? pinConfig.insetMobile : pinConfig.insetDesktop;
  drawPin(ctx, cardX + inset, cardY + inset, r, pinConfig); // TL
  drawPin(ctx, cardX + cardWidth - inset, cardY + inset, r, pinConfig); // TR
  drawPin(ctx, cardX + inset, cardY + cardHeight - inset, r, pinConfig); // BL
  drawPin(ctx, cardX + cardWidth - inset, cardY + cardHeight - inset, r, pinConfig); // BR

  // --- Text (left-aligned + spacing) ---
  const baseFontSize = responsiveMetrics.isMobile
    ? Math.max(10, cardWidth * 0.15 * responsiveMetrics.fontScale) // Larger font for bigger mobile card
    : Math.max(8, cardWidth * 0.052);

  // Apply responsive scaling to all font calculations
  const line1Font = `${(baseFontSize / 0.85) * responsiveMetrics.fontScale}px ${getCanvasFontStack('NeueWorld')}`;
  const line2Font = `bold ${baseFontSize * 1.1 * responsiveMetrics.fontScale}px ${getCanvasFontStack('NeueWorld')}`;
  const line3Font = `italic ${baseFontSize * responsiveMetrics.fontScale}px ${getCanvasFontStack('NeueWorld')}`;
  const line4Font = `${baseFontSize * 1.05 * responsiveMetrics.fontScale}px 'Courier New', 'Monaco', 'Menlo', 'Consolas', monospace`;

  const line1Text = 'Audemars Piguet x KAWS (b.2015)';
  const line2Text = '"Tokenized"';
  const line3Text = isMobile ? 'v. Create token market.' : 'v. Create derivative token market.';
  const line4Text = isMobile ? 'AP KAWS TOKEN SOON' : 'AP KAWS TOKEN COMING SOON';

  // metrics
  const m1 = getTextMetrics(ctx, line1Text, line1Font);
  const m2 = getTextMetrics(ctx, line2Text, line2Font);
  const m3 = getTextMetrics(ctx, line3Text, line3Font);
  const m4 = getTextMetrics(ctx, line4Text, line4Font);

  // Line spacing multipliers - increased mobile spacing for better readability
  const ls = isMobile ? 2 : 2.2; // increased mobile overall spacing from 1.45 to 1.8
  const ls12 = ls * 0.8; // tighter between line 1 → 2

  const lh1 = (m1.ascent + m1.descent) * ls12;
  const lh2 = (m2.ascent + m2.descent) * ls;
  const lh3 = (m3.ascent + m3.descent) * ls;
  const lh4 = (m4.ascent + m4.descent) * ls;

  const totalTextHeight = lh1 + lh2 + lh3 + lh4;

  // Layout: left-rag + vertical centering with responsive scaling
  const textPadX = Math.max(8, cardWidth * 0.06) * responsiveMetrics.paddingScale; // left padding
  const textX = cardX + textPadX;

  // Move the text block UP slightly (negative = up, positive = down) with responsive scaling
  const textBiasY =
    -(isMobile ? Math.max(2, cardHeight * 0.02) : Math.max(3, cardHeight * 0.02)) *
    responsiveMetrics.paddingScale;
  const startY = cardY + (cardHeight - totalTextHeight) / 2 + textBiasY;

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Draw lines, advancing by the PREVIOUS line's height each time
  let yCursor = startY + m1.ascent;

  ctx.font = line1Font;
  ctx.fillText(line1Text, textX, yCursor);

  yCursor += lh1;
  ctx.font = line2Font;
  ctx.fillText(line2Text, textX, yCursor);

  yCursor += lh2;
  ctx.font = line3Font;
  ctx.fillText(line3Text, textX, yCursor);

  yCursor += lh3;
  ctx.font = line4Font;
  ctx.fillText(line4Text, textX, yCursor);

  ctx.restore();
};

// Safari-specific performance optimizations
const isSafari =
  typeof navigator !== 'undefined' &&
  navigator.userAgent.includes('Safari') &&
  !navigator.userAgent.includes('Chrome');

// Gradient cache for performance
const featuredGradientCache = new Map<string, CanvasGradient>();

export const drawFeaturedSection = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  featuredImage: ImageInfo | null,
  mouseX = 0,
  mouseY = 0,
  _animationTime = 0,
  calendarIconHoverProgress = 0,
  opacity: number = 1, // Add opacity parameter with default
  unitSize: number, // Add unitSize parameter
  capabilities: DeviceCapabilities, // Add capabilities parameter
) => {
  void _animationTime; // Explicitly ignore unused parameter

  const responsiveMetrics = getResponsiveMetrics(unitSize, capabilities);
  // Smart mobile optimization: detect mobile device
  const isMobileDevice = responsiveMetrics.isMobile;

  const radius = 12;

  ctx.save();

  // Apply opacity for fade-in effect
  ctx.globalAlpha = opacity;

  // Background with subtle gradient
  const gradientKey = `featured-bg-${Math.round(width)}-${Math.round(height)}`;
  let backgroundGradient = featuredGradientCache.get(gradientKey);

  if (!backgroundGradient) {
    backgroundGradient = ctx.createLinearGradient(0, 0, width, height);
    backgroundGradient.addColorStop(0, '#1A1A1A');
    backgroundGradient.addColorStop(1, '#0F0F0F');

    // Cache for reuse (limit cache size)
    if (featuredGradientCache.size < 20) {
      featuredGradientCache.set(gradientKey, backgroundGradient);
    }
  }

  ctx.fillStyle = backgroundGradient;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();

  // Draw featured image if available
  if (featuredImage && featuredImage.element && featuredImage.element.complete) {
    ctx.save();

    // Create rounded rectangle clipping path with padding
    const imagePadding = 4;
    const imageX = x + imagePadding;
    const imageY = y + imagePadding;
    const imageWidth = width - imagePadding * 2;
    const imageHeight = height - imagePadding * 2;

    ctx.beginPath();
    ctx.roundRect(imageX, imageY, imageWidth, imageHeight, radius - 4);
    ctx.clip();

    // Calculate scale to cover the entire area while maintaining aspect ratio
    const scaleX = imageWidth / featuredImage.element.naturalWidth;
    const scaleY = imageHeight / featuredImage.element.naturalHeight;
    const baseScale = Math.max(scaleX, scaleY);
    const zoomFactor = 1.15; // 15% additional zoom to reduce black space
    const imageScale = baseScale * zoomFactor;

    const scaledImageWidth = featuredImage.element.naturalWidth * imageScale;
    const scaledImageHeight = featuredImage.element.naturalHeight * imageScale;

    // Center the image
    const offsetX = Math.round(imageX + (imageWidth - scaledImageWidth) / 2);
    const offsetY = Math.round(imageY + (imageHeight - scaledImageHeight) / 2);
    const drawWidth = Math.round(scaledImageWidth);
    const drawHeight = Math.round(scaledImageHeight);

    // Set image smoothing quality (skip on Safari for performance)
    if (!isSafari && ctx.imageSmoothingQuality !== 'high') {
      ctx.imageSmoothingQuality = 'high';
    }

    // Draw the featured image
    ctx.drawImage(featuredImage.element, offsetX, offsetY, drawWidth, drawHeight);

    ctx.restore();
  } else {
    // Fallback: Draw placeholder content when no image is available
    ctx.save();
    const imagePadding = 12;
    const imageX = x + imagePadding;
    const imageY = y + imagePadding;
    const imageWidth = width - imagePadding * 2;
    const imageHeight = height - imagePadding * 2;

    // Draw a placeholder pattern
    ctx.fillStyle = '#2A2A2A';
    ctx.beginPath();
    ctx.roundRect(imageX, imageY, imageWidth, imageHeight, radius - 4);
    ctx.fill();

    // Add some visual content
    ctx.fillStyle = '#666666';
    ctx.font = `${Math.min(imageWidth, imageHeight) * 0.1}px ${getCanvasFontStack('NeueWorld')}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FEATURED ITEM', imageX + imageWidth / 2, imageY + imageHeight / 2);

    ctx.restore();
  }

  // Draw new overlay elements with responsive scaling
  drawArtGalleryCard(ctx, x, y, width, height, opacity, responsiveMetrics);
  drawDaysLeft(ctx, x, y, width, height, opacity, responsiveMetrics);

  // Draw auction icon in top-right corner (using Auction Notification)
  const iconBounds = getAuctionIconBounds(x, y, width, height, responsiveMetrics);
  drawLucideAuctionIcon(
    ctx,
    iconBounds.x,
    iconBounds.y,
    Math.max(iconBounds.width, iconBounds.height),
    calendarIconHoverProgress,
    responsiveMetrics,
  );

  // Draw premium border (keeping existing colors and behavior)
  ctx.save();

  // Check if mouse is hovering over the featured section
  const isHovered =
    !isMobileDevice && mouseX >= x && mouseX <= x + width && mouseY >= y && mouseY <= y + height;

  // Enhanced border opacity and glow when hovering
  const borderOpacity = isHovered ? 0.9 : 0.7;
  const borderWidth = isHovered ? 2 : 1;

  // Safari optimization: Skip expensive glow effects on Safari
  if (!isSafari && !isMobileDevice && isHovered) {
    ctx.shadowColor = 'rgba(215, 191, 117, 0.4)';
    ctx.shadowBlur = 8;
  }

  // Outer border - Green (#184D37)
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = `rgba(215, 191, 117, ${borderOpacity})`; // Green (#184D37)

  // Draw outer border with rounded corners
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.stroke();

  // Inner border - Golden
  // ctx.shadowBlur = 0; // Remove shadow for inner border
  // ctx.lineWidth = Math.max(1, borderWidth - 2); // Slightly thinner inner border
  // ctx.strokeStyle = `rgba(215, 191, 117, ${borderOpacity})`; // highlightGold (#D7BF75)

  // Draw inner border with slightly smaller radius
  const innerPadding = 1;
  const innerRadius = Math.max(2, radius - 2);
  ctx.beginPath();
  ctx.roundRect(
    x + innerPadding,
    y + innerPadding,
    width - innerPadding * 2,
    height - innerPadding * 2,
    innerRadius,
  );
  ctx.stroke();

  ctx.restore();
};

/**
 * Animated version of drawFeaturedSection for entrance animation
 * Supports progressive border animation and staged image reveal
 */
export const drawAnimatedFeaturedSection = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  featuredImage: ImageInfo | null,
  mouseX = 0,
  mouseY = 0,
  _animationTime = 0,
  // Animation-specific properties
  opacity = 1,
  scale = 1,
  borderAnimationProgress = 1,
  imageAnimationProgress = 1,
  // Entrance animation position override (for sliding from top)
  animatedX?: number,
  animatedY?: number,
  calendarIconHoverProgress = 0,
  unitSize: number = 200, // Add unitSize parameter with default
  capabilities?: DeviceCapabilities, // Add capabilities parameter (optional)
) => {
  void _animationTime; // Explicitly ignore unused parameter
  const responsiveMetrics = capabilities
    ? getResponsiveMetrics(unitSize, capabilities)
    : {
        isMobile: unitSize <= 150,
        fontScale: 1,
        paddingScale: 1,
        iconScale: 1,
        borderScale: 1,
        spacingScale: 1,
        unitSize,
        baseScale: 1,
      };
  // Smart mobile optimization: detect mobile device
  const isMobileDevice = responsiveMetrics.isMobile;

  const radius = 12;

  // Use animated position if provided, otherwise use original position
  const drawX = animatedX !== undefined ? animatedX : x;
  const drawY = animatedY !== undefined ? animatedY : y;

  // Apply scale transformation only to background and image, not borders
  ctx.save();

  // Apply scale transformation from center
  const centerX = drawX + width / 2;
  const centerY = drawY + height / 2;
  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);
  ctx.translate(-centerX, -centerY);

  // Apply overall opacity
  ctx.globalAlpha = opacity;

  // Background with gradient (always visible once opacity > 0)
  const gradientKey = `featured-bg-${Math.round(width)}-${Math.round(height)}`;
  let backgroundGradient = featuredGradientCache.get(gradientKey);

  if (!backgroundGradient) {
    backgroundGradient = ctx.createLinearGradient(0, 0, width, height);
    backgroundGradient.addColorStop(0, '#1A1A1A');
    backgroundGradient.addColorStop(1, '#0F0F0F');

    // Cache for reuse (limit cache size)
    if (featuredGradientCache.size < 20) {
      featuredGradientCache.set(gradientKey, backgroundGradient);
    }
  }

  ctx.fillStyle = backgroundGradient;
  ctx.beginPath();
  ctx.roundRect(drawX, drawY, width, height, radius);
  ctx.fill();

  // Draw featured image with image animation progress
  if (
    featuredImage &&
    featuredImage.element &&
    featuredImage.element.complete &&
    imageAnimationProgress > 0
  ) {
    ctx.save();

    // Apply image-specific opacity
    ctx.globalAlpha = opacity * imageAnimationProgress;

    // Create rounded rectangle clipping path with padding
    const imagePadding = 12;
    const imageX = drawX + imagePadding;
    const imageY = drawY + imagePadding;
    const imageWidth = width - imagePadding * 2;
    const imageHeight = height - imagePadding * 2;

    ctx.beginPath();
    ctx.roundRect(imageX, imageY, imageWidth, imageHeight, radius - 4);
    ctx.clip();

    // Calculate scale to cover the entire area while maintaining aspect ratio
    const scaleX = imageWidth / featuredImage.element.naturalWidth;
    const scaleY = imageHeight / featuredImage.element.naturalHeight;
    const baseScale = Math.max(scaleX, scaleY);
    const zoomFactor = 1.15; // 15% additional zoom to reduce black space
    const imageScale = baseScale * zoomFactor;

    const scaledImageWidth = featuredImage.element.naturalWidth * imageScale;
    const scaledImageHeight = featuredImage.element.naturalHeight * imageScale;

    // Center the image
    const offsetX = Math.round(imageX + (imageWidth - scaledImageWidth) / 2);
    const offsetY = Math.round(imageY + (imageHeight - scaledImageHeight) / 2);
    const drawWidth = Math.round(scaledImageWidth);
    const drawHeight = Math.round(scaledImageHeight);

    // Set image smoothing quality (skip on Safari for performance)
    if (!isSafari && ctx.imageSmoothingQuality !== 'high') {
      ctx.imageSmoothingQuality = 'high';
    }

    // Draw the featured image
    ctx.drawImage(featuredImage.element, offsetX, offsetY, drawWidth, drawHeight);

    ctx.restore();
  }

  // Restore context to remove scale transformation for borders and labels
  ctx.restore();

  // Draw new overlay elements with fade-in
  const overlayOpacity = opacity * borderAnimationProgress;

  // Draw animated border with progressive appearance (keeping existing colors)
  if (borderAnimationProgress > 0) {
    ctx.save();

    // Check if mouse is hovering over the featured section
    const isHovered =
      !isMobileDevice &&
      mouseX >= drawX &&
      mouseX <= drawX + width &&
      mouseY >= drawY &&
      mouseY <= drawY + height;

    // Enhanced border opacity and glow when hovering
    const borderOpacity = (isHovered ? 0.9 : 0.7) * opacity * borderAnimationProgress;
    const borderWidth = isHovered ? 4 : 3;

    // Safari optimization: Skip expensive glow effects on Safari
    if (!isSafari && !isMobileDevice && isHovered) {
      ctx.shadowColor = 'rgba(24, 77, 55, 0.4)';
      ctx.shadowBlur = 8;
    }

    ctx.lineWidth = borderWidth;

    // Outer border - Green (#184D37)
    ctx.strokeStyle = `rgba(24, 77, 55, ${borderOpacity})`; // Green (#184D37)

    // Helper function to draw animated lines
    const drawAnimatedLine = (startX: number, startY: number, endX: number, endY: number) => {
      const totalLength = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
      const animatedLength = totalLength * borderAnimationProgress;

      if (animatedLength <= 0) return;

      const deltaX = (endX - startX) / totalLength;
      const deltaY = (endY - startY) / totalLength;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(startX + deltaX * animatedLength, startY + deltaY * animatedLength);
      ctx.stroke();
    };

    // Draw borders with animation (clockwise from top)
    // Top border
    drawAnimatedLine(drawX + radius, drawY, drawX + width - radius, drawY);

    // Right border (only if top border is complete enough)
    if (borderAnimationProgress > 0.25) {
      const rightProgress = Math.max(0, (borderAnimationProgress - 0.25) / 0.25);
      const rightStartY = drawY + radius;
      const rightEndY = Math.min(
        drawY + height - radius,
        rightStartY + (height - radius * 2) * rightProgress,
      );
      drawAnimatedLine(drawX + width, rightStartY, drawX + width, rightEndY);
    }

    // Bottom border (only if right border is complete enough)
    if (borderAnimationProgress > 0.5) {
      const bottomProgress = Math.max(0, (borderAnimationProgress - 0.5) / 0.25);
      const bottomStartX = drawX + width - radius;
      const bottomEndX = Math.max(
        drawX + radius,
        bottomStartX - (width - radius * 2) * bottomProgress,
      );
      drawAnimatedLine(bottomStartX, drawY + height, bottomEndX, drawY + height);
    }

    // Left border (only if bottom border is complete enough)
    if (borderAnimationProgress > 0.75) {
      const leftProgress = Math.max(0, (borderAnimationProgress - 0.75) / 0.25);
      const leftStartY = drawY + height - radius;
      const leftEndY = Math.max(drawY + radius, leftStartY - (height - radius * 2) * leftProgress);
      drawAnimatedLine(drawX, leftStartY, drawX, leftEndY);
    }

    // Draw corner animations (simplified for performance)
    const drawAnimatedCorner = (
      centerX: number,
      centerY: number,
      startAngle: number,
      endAngle: number,
      phaseProgress: number,
    ) => {
      if (phaseProgress <= 0) return;

      const animatedAngle = startAngle + (endAngle - startAngle) * phaseProgress;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, animatedAngle);
      ctx.stroke();
    };

    // Animate corners in sequence
    if (borderAnimationProgress > 0.1) {
      drawAnimatedCorner(
        drawX + radius,
        drawY + radius,
        Math.PI,
        Math.PI * 1.5,
        Math.min(1, (borderAnimationProgress - 0.1) / 0.15),
      );
    }
    if (borderAnimationProgress > 0.35) {
      drawAnimatedCorner(
        drawX + width - radius,
        drawY + radius,
        Math.PI * 1.5,
        0,
        Math.min(1, (borderAnimationProgress - 0.35) / 0.15),
      );
    }
    if (borderAnimationProgress > 0.6) {
      drawAnimatedCorner(
        drawX + width - radius,
        drawY + height - radius,
        0,
        Math.PI * 0.5,
        Math.min(1, (borderAnimationProgress - 0.6) / 0.15),
      );
    }
    if (borderAnimationProgress > 0.85) {
      drawAnimatedCorner(
        drawX + radius,
        drawY + height - radius,
        Math.PI * 0.5,
        Math.PI,
        Math.min(1, (borderAnimationProgress - 0.85) / 0.15),
      );
    }

    // Draw inner border - Golden
    ctx.shadowBlur = 0; // Remove shadow for inner border
    ctx.lineWidth = Math.max(1, borderWidth - 2); // Slightly thinner inner border
    ctx.strokeStyle = `rgba(215, 191, 117, ${borderOpacity})`; // highlightGold (#D7BF75)

    // Draw inner border with slightly smaller radius
    const innerPadding = 3;
    const innerRadius = Math.max(2, radius - 2);
    ctx.beginPath();
    ctx.roundRect(
      drawX + innerPadding,
      drawY + innerPadding,
      width - innerPadding * 2,
      height - innerPadding * 2,
      innerRadius,
    );
    ctx.stroke();

    ctx.restore();
  }

  // Draw the new overlay elements last to ensure they appear on top
  drawArtGalleryCard(ctx, drawX, drawY, width, height, overlayOpacity, responsiveMetrics);
  drawDaysLeft(ctx, drawX, drawY, width, height, overlayOpacity, responsiveMetrics);

  // Draw auction icon with animation opacity (using Auction Notification)
  const iconBounds = getAuctionIconBounds(drawX, drawY, width, height, responsiveMetrics);
  ctx.save();
  ctx.globalAlpha = overlayOpacity; // Apply same opacity as other overlay elements
  drawLucideAuctionIcon(
    ctx,
    iconBounds.x,
    iconBounds.y,
    Math.max(iconBounds.width, iconBounds.height),
    calendarIconHoverProgress,
    responsiveMetrics,
  );
  ctx.restore();
};
