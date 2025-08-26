import type { ImageInfo } from '../../../types/canvas';
import { getDeviceCapabilities } from '../../utils/browser-utils';

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

// Draw countdown timer in top right corner of featured section
const drawCountdownTimer = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  opacity: number = 1,
) => {
  const targetDate = new Date('2025-09-19T12:00:00-04:00'); // September 19, 2025 at 12PM Eastern Time
  const timeLeft = calculateTimeLeft(targetDate);

  // Don't render if countdown is over
  if (
    timeLeft.days === 0 &&
    timeLeft.hours === 0 &&
    timeLeft.minutes === 0 &&
    timeLeft.seconds === 0
  ) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = opacity;

  // Position along the bottom with padding
  const padding = 16;
  const timerHeight = Math.min(80, height * 0.15); // Slightly taller for better proportions
  const unitWidth = Math.min(60, width * 0.12); // Wider units for better visibility
  const gap = 16; // Much larger gap for better horizontal spacing
  const totalWidth = unitWidth * 4 + gap * 3; // 4 units with gaps
  const timerX = x + (width - totalWidth) / 2; // Center horizontally
  const timerY = y + height - padding - timerHeight; // Position at bottom

  // Ensure timer fits within bounds
  if (timerX < x + padding || timerY < y + padding) {
    ctx.restore();
    return;
  }

  const timeUnits = [
    { value: timeLeft.days, label: 'DAYS' },
    { value: timeLeft.hours, label: 'HRS' },
    { value: timeLeft.minutes, label: 'MIN' },
    { value: timeLeft.seconds, label: 'SEC' },
  ];

  // Draw each time unit
  timeUnits.forEach(({ value, label }, index) => {
    const unitX = timerX + index * (unitWidth + gap);
    const unitY = timerY;

    // Create gradient background for each unit
    const unitGradient = ctx.createLinearGradient(unitX, unitY, unitX, unitY + timerHeight);
    unitGradient.addColorStop(0, 'rgba(40, 40, 40, 0.2)');
    unitGradient.addColorStop(0.5, 'rgba(20, 20, 20, 0.2)');
    unitGradient.addColorStop(1, 'rgba(10, 10, 10, 0.2)');

    ctx.fillStyle = unitGradient;
    ctx.beginPath();
    ctx.roundRect(unitX, unitY, unitWidth, timerHeight, 8);
    ctx.fill();

    // Add subtle inner shadow effect
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(unitX + 1, unitY + 1, unitWidth - 2, timerHeight - 2, 7);
    ctx.stroke();

    // Outer border with gold accent
    ctx.strokeStyle = 'rgba(208, 178, 100, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(unitX, unitY, unitWidth, timerHeight, 8);
    ctx.stroke();

    // Number value with gold gradient
    const numberGradient = ctx.createLinearGradient(
      unitX + unitWidth / 2 - 15,
      unitY + timerHeight * 0.3,
      unitX + unitWidth / 2 + 15,
      unitY + timerHeight * 0.5,
    );
    numberGradient.addColorStop(0, '#FFFFFF');
    numberGradient.addColorStop(0.2, '#D0B264');
    numberGradient.addColorStop(0.8, '#D0B264');
    numberGradient.addColorStop(1, '#FFFFFF');

    ctx.fillStyle = numberGradient;
    ctx.font = `bold ${Math.min(24, timerHeight * 0.4)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      value.toString().padStart(2, '0'),
      unitX + unitWidth / 2,
      unitY + timerHeight * 0.4,
    );

    // Label with improved styling
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = `${Math.min(11, timerHeight * 0.18)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, unitX + unitWidth / 2, unitY + timerHeight * 0.78);
  });

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
    ctx.font = `${Math.min(imageWidth, imageHeight) * 0.1}px 'heading'`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FEATURED ITEM', imageX + imageWidth / 2, imageY + imageHeight / 2);

    ctx.restore();
  }

  // Draw "FEATURED" label in top-left corner
  ctx.save();

  const padding = 16;
  const featuredTextY = y + padding + 20; // Fixed position in top area

  // Gold gradient for text (matching home area text)
  const textGradient = ctx.createLinearGradient(
    x + 16,
    featuredTextY - 10, // Adjust gradient positioning
    x + 16 + width * 0.3, // Scale gradient width appropriately
    featuredTextY + 10, // Scale gradient height to text size
  );
  textGradient.addColorStop(0, '#FFFFFF');
  textGradient.addColorStop(0.15, '#D0B264');
  textGradient.addColorStop(0.95, '#D0B264');
  textGradient.addColorStop(1, '#FFFFFF');

  ctx.fillStyle = textGradient;
  ctx.font = `bold ${Math.min(width, height) * 0.08}px 'heading'`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('FEATURED', x + 16, featuredTextY);
  ctx.restore();

  // Draw countdown timer along the bottom
  drawCountdownTimer(ctx, x, y, width, height, 1.0);

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
  drawCountdownTimer(ctx, drawX, drawY, width, height, opacity * borderAnimationProgress);

  // Draw "FEATURED" label with fade-in in top-left corner
  ctx.save();
  ctx.globalAlpha = opacity * borderAnimationProgress;

  const padding = 16;
  const featuredTextY = drawY + padding + 20; // Fixed position in top area

  // Gold gradient for text (matching home area text)
  const textGradient = ctx.createLinearGradient(
    drawX + 16,
    featuredTextY - 10, // Adjust gradient positioning
    drawX + 16 + width * 0.3, // Scale gradient width appropriately
    featuredTextY + 10, // Scale gradient height to text size
  );
  textGradient.addColorStop(0, '#FFFFFF');
  textGradient.addColorStop(0.1, '#D0B264');
  textGradient.addColorStop(0.9, '#D0B264');
  textGradient.addColorStop(1, '#FFFFFF');

  ctx.fillStyle = textGradient;
  ctx.font = `bold ${Math.min(width, height) * 0.08}px 'heading'`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('FEATURED', drawX + 16, featuredTextY);
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
