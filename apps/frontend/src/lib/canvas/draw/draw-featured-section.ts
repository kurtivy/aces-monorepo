import type { ImageInfo } from '../../../types/canvas';
import { getDeviceCapabilities } from '../../utils/browser-utils';
import { getCanvasFontStack } from '../../utils/font-loader';

// Logo image cache for performance
const logoImageCache = new Map<string, HTMLImageElement>();

const loadBuyCultureLogo = (): HTMLImageElement | null => {
  const cacheKey = 'buy-culture-logo';

  if (logoImageCache.has(cacheKey)) {
    return logoImageCache.get(cacheKey)!;
  }

  const logoImg = new Image();
  logoImg.crossOrigin = 'anonymous';
  logoImg.src = '/png/buy-culture-trade-hype.png';

  // Cache the image (even if not loaded yet)
  logoImageCache.set(cacheKey, logoImg);

  return logoImg;
};

const drawBuyCultureLogo = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  opacity: number,
) => {
  ctx.save();
  ctx.globalAlpha = opacity;

  const logoImg = loadBuyCultureLogo();

  if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    // Position in bottom right where the button was - smaller size for bottom corner
    const logoWidth = Math.min(width * 0.35, 220); // Match the button width dimensions
    const logoHeight = (logoImg.naturalHeight / logoImg.naturalWidth) * logoWidth;
    const logoX = x + width - logoWidth - 10; // 10px padding from right edge
    const logoY = y + height - logoHeight - 10; // 10px padding from bottom edge

    ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
  }

  ctx.restore();
};

const drawArtGalleryCard = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  opacity: number,
) => {
  ctx.save();
  ctx.globalAlpha = opacity;

  // Card dimensions and positioning (bottom left) - wider card
  const cardWidth = Math.min(width * 0.5, 230); // Wider card (increased from 35% to 45%)
  const cardHeight = Math.min(height * 0.25, 100);
  const cardX = x + 10; // 20px padding from left
  const cardY = y + height - cardHeight - 10; // 20px padding from bottom

  // Draw white card background
  ctx.fillStyle = 'rgba(253, 255, 250, 0.95)';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 4);
  ctx.fill();

  // Add subtle border
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Text styling
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const fontSize = Math.max(9.6, cardWidth * 0.059); // Reduced font size by 20% (was 12 and 0.08)
  const lineHeight = fontSize * 1.75; // Much more spaced out lines
  let currentY = cardY + 12;

  ctx.font = `${fontSize / 0.85}px ${getCanvasFontStack('NeueWorld')}`;
  ctx.fillText('Audemars Piguet x KAWS (b.2015)', cardX + 8, currentY);
  currentY += lineHeight;

  ctx.font = `bold ${fontSize * 1.1}px ${getCanvasFontStack('NeueWorld')}`; // Bigger "Tokenized" text
  ctx.letterSpacing = '1px';
  ctx.fillText('"Tokenized"', cardX + 8, currentY);
  currentY += lineHeight;

  ctx.font = `italic ${fontSize}px ${getCanvasFontStack('NeueWorld')}`; // Bigger "v. Create" text (was 0.8, now 1.0)
  ctx.letterSpacing = '0px';
  ctx.fillText('v. Create derivative token market.', cardX + 8, currentY);
  currentY += lineHeight;

  // Bottom line with mono font (using system mono font)
  ctx.font = `${fontSize * 1.05}px 'Courier New', 'Monaco', 'Menlo', 'Consolas', monospace`;
  ctx.fillText('AP KAWS TOKEN COMING SOON', cardX + 8, currentY);

  ctx.restore();
};

const drawSaleStartsButton = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  opacity: number,
) => {
  ctx.save();
  ctx.globalAlpha = opacity;

  // Calculate text dimensions first to size button properly
  const text = 'SALE STARTS 19/09/25 9AM EST';
  const fontSize = Math.max(14, Math.min(18, height * 0.06)); // Responsive font size
  ctx.font = `${fontSize}px ${getCanvasFontStack('Proxima Nova')}`;
  ctx.letterSpacing = '2px';

  // Measure text width with letter spacing
  const textMetrics = ctx.measureText(text);
  const textWidth = textMetrics.width + (text.length - 1) * 2; // Add letter spacing

  // Size button to fit text with proper padding
  const buttonPadding = 4; // Horizontal padding
  const buttonWidth = Math.max(textWidth + buttonPadding * 2, Math.min(width * 0.6, 350)); // Ensure minimum width
  const buttonHeight = Math.max(fontSize * 1.8, Math.min(height * 0.1, 45)); // Proper height for text
  const buttonX = x + (width - buttonWidth) / 2; // Center horizontally across the top
  const buttonY = y + 15; // Position at top with padding

  // Draw button background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, 6);
  ctx.fill();

  // Draw button border - thinner line
  ctx.strokeStyle = '#D0B284';
  ctx.lineWidth = 1; // Thinner border
  ctx.stroke();

  // Draw button text - single line
  ctx.fillStyle = '#D0B284';
  ctx.font = `${fontSize}px ${getCanvasFontStack('Proxima Nova')}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '2px';

  // Single line: "SALE STARTS 19/09/25 9AM EST"
  ctx.fillText(text, buttonX + buttonWidth / 2, buttonY + buttonHeight / 2);

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

  // Draw new overlay elements
  drawSaleStartsButton(ctx, x, y, width, height, 1.0); // Button now at top
  drawArtGalleryCard(ctx, x, y, width, height, 1.0);
  drawBuyCultureLogo(ctx, x, y, width, height, 1.0); // Logo now at bottom right

  // Draw premium border (keeping existing colors and behavior)
  ctx.save();

  // Check if mouse is hovering over the featured section
  const isHovered =
    !isMobileDevice && mouseX >= x && mouseX <= x + width && mouseY >= y && mouseY <= y + height;

  // Enhanced border opacity and glow when hovering
  const borderOpacity = isHovered ? 0.9 : 0.7;
  const borderWidth = isHovered ? 4 : 3;

  // Safari optimization: Skip expensive glow effects on Safari
  if (!isSafari && !isMobileDevice && isHovered) {
    ctx.shadowColor = 'rgba(24, 77, 55, 0.4)';
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

  // Draw new overlay elements with fade-in
  const overlayOpacity = opacity * borderAnimationProgress;
  drawSaleStartsButton(ctx, drawX, drawY, width, height, overlayOpacity); // Button now at top

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
  drawArtGalleryCard(ctx, drawX, drawY, width, height, overlayOpacity);
  drawBuyCultureLogo(ctx, drawX, drawY, width, height, overlayOpacity); // Logo now at bottom right
};
