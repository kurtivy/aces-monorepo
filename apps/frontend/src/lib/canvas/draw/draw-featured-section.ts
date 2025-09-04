import type { ImageInfo } from '../../../types/canvas';
import { getDeviceCapabilities } from '../../utils/browser-utils';
import { getCanvasFontStack } from '../../utils/font-loader';

// Countdown timer utility function for canvas rendering
interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const calculateTimeLeft = (targetDate: Date): TimeLeft => {
  const difference = +targetDate - +new Date();
  let timeLeft: TimeLeft = {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  };

  if (difference > 0) {
    timeLeft = {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  }

  return timeLeft;
};

// Overlay utilities for header rails, dashed columns, and right-side countdown
const OVERLAY_COLORS = {
  gold: '#D0B284',
  emerald: '#184D37',
  labelGray: '#DCDDCC',
};

const DASH_PATTERN = [12, 12];

// Draw the top header rails and the FEATURED title centered between them
const drawHeaderRailsAndTitle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  rightRailLeftX: number,
  radius: number,
  opacity: number,
) => {
  ctx.save();
  ctx.globalAlpha = opacity;

  // Clip to the card rounded rect to ensure lines do not bleed
  ctx.beginPath();
  ctx.roundRect(x, y, width, Math.max(radius * 2 + 120, 120), radius);
  ctx.clip();

  // const textSize = Math.min(width, radius * 10) * 0.33; // 3x larger than before (was 0.11)
  // const topY = y + 12;
  // const bottomY = topY + textSize + 4; // moved even closer to FEATURED text
  // const titleCenterY = (topY + bottomY) / 2 + 4; // center between rails with slight downward adjustment

  // Top rail - full width
  // ctx.strokeStyle = OVERLAY_COLORS.gold;
  // ctx.lineWidth = 1;
  // ctx.beginPath();
  // ctx.moveTo(x, topY);
  // ctx.lineTo(x + width, topY);
  // ctx.stroke();

  // Subtle emerald accent just under the top rail
  // ctx.strokeStyle = OVERLAY_COLORS.emerald;
  // ctx.globalAlpha = opacity * 0.6;
  // ctx.lineWidth = 1;
  // ctx.beginPath();
  // ctx.moveTo(x, topY + 3);
  // ctx.lineTo(x + width, topY + 3);
  // ctx.stroke();
  // ctx.globalAlpha = opacity;

  // Bottom rail - from left edge until it hits the dashed left rail
  // const bottomRailEndX = Math.max(x, rightRailLeftX);
  // ctx.strokeStyle = OVERLAY_COLORS.gold;
  // ctx.lineWidth = 1;
  // ctx.beginPath();
  // ctx.moveTo(x, bottomY);
  // ctx.lineTo(bottomRailEndX, bottomY);
  // ctx.stroke();

  // Add green line below the bottom rail
  // ctx.strokeStyle = OVERLAY_COLORS.emerald;
  // ctx.globalAlpha = opacity * 0.8;
  // ctx.lineWidth = 1;
  // ctx.beginPath();
  // ctx.moveTo(x, bottomY + 3);
  // ctx.lineTo(bottomRailEndX, bottomY + 3);
  // ctx.stroke();
  // ctx.globalAlpha = opacity;

  // const titleLeftX = x + 24; // positioned on left side with padding

  // ctx.fillStyle = '#D7BF75';
  // ctx.font = `bold ${textSize}px ${getCanvasFontStack('NeueWorld')}`;
  // ctx.letterSpacing = '8px'; // Increase letter spacing
  // ctx.textAlign = 'left'; // changed from right to left
  // ctx.textBaseline = 'middle';

  // ctx.fillText('FEATURED', titleLeftX, titleCenterY);

  ctx.restore();
};

// Draw dashed vertical rails and the stacked right-side countdown
const drawRightRailAndCountdown = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  opacity: number,
) => {
  const targetDate = new Date('2025-09-19T12:00:00-04:00');
  const timeLeft = calculateTimeLeft(targetDate);

  const columnWidth = Math.max(80, Math.floor(width * 0.22));
  const leftRailX = x + width - columnWidth + 20; // moved closer to right rail
  const rightRailX = x + width - 12; // positioned at the outside edge of numbers

  ctx.save();

  // Clip to the card
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.clip();

  // Draw dashed rails
  ctx.strokeStyle = OVERLAY_COLORS.gold;
  ctx.lineWidth = 1;
  ctx.setLineDash(DASH_PATTERN);
  ctx.globalAlpha = opacity * 0.9;

  ctx.beginPath();
  ctx.moveTo(leftRailX, y);
  ctx.lineTo(leftRailX, y + height);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(rightRailX, y);
  ctx.lineTo(rightRailX, y + height);
  ctx.stroke();

  ctx.setLineDash([]);

  // Align countdown to the right side of the right dashed line
  const colRightX = rightRailX - 8; // balanced position from right dashed line

  const numberFontSize = Math.min(Math.floor(columnWidth * 0.45), Math.floor(height * 0.13));
  const labelFontSize = Math.max(14, Math.floor(numberFontSize * 0.38));
  const blockGap = Math.floor(numberFontSize * 0.35);

  const blocks = [
    { value: timeLeft.days, label: 'DAYS' },
    { value: timeLeft.hours, label: 'HOUR' },
    { value: timeLeft.minutes, label: 'MIN' },
    { value: timeLeft.seconds, label: 'SECS' },
  ];

  const blockHeights = numberFontSize + labelFontSize + blockGap;
  const totalHeight = blocks.length * blockHeights - blockGap;
  let currentY = y + height - 20 - totalHeight; // start from bottom with padding

  ctx.textBaseline = 'top';

  for (const { value, label } of blocks) {
    ctx.fillStyle = '#D7BF75';
    ctx.globalAlpha = opacity;
    ctx.font = `bold ${numberFontSize}px ${getCanvasFontStack('NeueWorld')}`;
    ctx.textAlign = 'right';
    ctx.fillText(value.toString().padStart(2, '0'), colRightX, currentY);

    const labelRightX = colRightX;

    ctx.fillStyle = OVERLAY_COLORS.labelGray;
    ctx.font = `${labelFontSize}px ${getCanvasFontStack('Proxima Nova')}`;
    ctx.textAlign = 'right';
    ctx.fillText(label, labelRightX, currentY + numberFontSize + 6);

    currentY += blockHeights;
  }

  ctx.restore();

  return { leftRailX };
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
) => {
  void _animationTime; // Explicitly ignore unused parameter

  // DEBUG: Uncomment for drawing debugging
  // console.log('drawFeaturedSection called:', {
  //   x, y, width, height,
  //   featuredImage: !!featuredImage,
  //   featuredImageId: featuredImage?.metadata?.id,
  //   imageComplete: featuredImage?.element?.complete,
  //   imageNaturalWidth: featuredImage?.element?.naturalWidth,
  //   imageNaturalHeight: featuredImage?.element?.naturalHeight,
  // });

  // Smart mobile optimization: detect mobile device
  const capabilities = getDeviceCapabilities();
  const isMobileDevice = capabilities.touchCapable || capabilities.isMobileSafari;

  const radius = 12;

  ctx.save();

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
    const imagePadding = 12;
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
    const imageScale = Math.max(scaleX, scaleY);

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
    ctx.globalAlpha = 0.9;
    ctx.drawImage(featuredImage.element, offsetX, offsetY, drawWidth, drawHeight);
    ctx.globalAlpha = 1.0;

    ctx.restore();
  } else {
    // Fallback: Draw placeholder content when no image is available
    // console.log('Drawing featured section placeholder - no image available');

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

  // Draw overlay: dashed right rails and stacked countdown, then header rails and title
  const { leftRailX } = drawRightRailAndCountdown(ctx, x, y, width, height, radius, 1.0);
  drawHeaderRailsAndTitle(ctx, x, y, width, leftRailX, radius, 1.0);

  // Draw premium border
  ctx.save();

  // Check if mouse is hovering over the featured section
  const isHovered =
    !isMobileDevice && mouseX >= x && mouseX <= x + width && mouseY >= y && mouseY <= y + height;

  // Enhanced border opacity and glow when hovering
  const borderOpacity = isHovered ? 0.9 : 0.7;
  const borderWidth = isHovered ? 4 : 3;

  // Safari optimization: Skip expensive glow effects on Safari
  if (!isSafari && !isMobileDevice && isHovered) {
    ctx.shadowColor = 'rgba(208, 178, 100, 0.4)';
    ctx.shadowBlur = 8;
  }

  // Outer border - Green (#184D37)
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = `rgba(24, 77, 55, ${borderOpacity})`; // Green (#184D37)

  // Draw outer border with rounded corners
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.stroke();

  // Inner border - Golden
  ctx.shadowBlur = 0; // Remove shadow for inner border
  ctx.lineWidth = Math.max(1, borderWidth - 2); // Slightly thinner inner border
  ctx.strokeStyle = `rgba(215, 191, 117, ${borderOpacity})`; // highlightGold (#D7BF75)

  // Draw inner border with slightly smaller radius
  const innerPadding = 3;
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
) => {
  void _animationTime; // Explicitly ignore unused parameter
  // Smart mobile optimization: detect mobile device
  const capabilities = getDeviceCapabilities();
  const isMobileDevice = capabilities.touchCapable || capabilities.isMobileSafari;

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
    const imageScale = Math.max(scaleX, scaleY);

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

  // Draw countdown timer along the bottom with fade-in
  const overlayOpacity = opacity * borderAnimationProgress;
  const { leftRailX } = drawRightRailAndCountdown(
    ctx,
    drawX,
    drawY,
    width,
    height,
    radius,
    overlayOpacity,
  );

  // Draw "FEATURED" label with fade-in in top-left corner
  ctx.save();
  ctx.globalAlpha = opacity * borderAnimationProgress;

  drawHeaderRailsAndTitle(ctx, drawX, drawY, width, leftRailX, radius, overlayOpacity);
  ctx.restore();

  // Draw animated border with progressive appearance
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

    // Single color border - highlightGold
    ctx.strokeStyle = `rgba(215, 191, 117, ${borderOpacity})`; // highlightGold (#D7BF75)

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

    ctx.restore();
  }
};
