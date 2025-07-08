// Safari-specific performance optimizations
const isSafari =
  typeof navigator !== 'undefined' &&
  navigator.userAgent.includes('Safari') &&
  !navigator.userAgent.includes('Chrome');

// Gradient cache for Safari performance
const borderGradientCache = new Map<string, CanvasGradient>();

export const drawImage = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  opacity = 1, // Direct opacity value (pre-calculated)
) => {
  ctx.save();

  // MOBILE SHIMMER FIX: Round all coordinates to integer pixels
  // This prevents subpixel rendering that causes visual instability on mobile
  const roundedX = Math.round(x);
  const roundedY = Math.round(y);
  const roundedWidth = Math.round(width);
  const roundedHeight = Math.round(height);

  const scaledWidth = roundedWidth;
  const scaledHeight = roundedHeight;
  const scaleOffsetX = (roundedWidth - scaledWidth) / 2;
  const scaleOffsetY = (roundedHeight - scaledHeight) / 2;

  // Apply opacity
  ctx.globalAlpha = opacity;

  // Create rounded rectangle clipping path with integer coordinates
  const radius = 8;
  ctx.beginPath();
  ctx.roundRect(
    roundedX + scaleOffsetX,
    roundedY + scaleOffsetY,
    scaledWidth,
    scaledHeight,
    radius,
  );
  ctx.clip();

  // Calculate scale to cover the entire area
  const scaleX = scaledWidth / img.naturalWidth;
  const scaleY = scaledHeight / img.naturalHeight;
  const imageScale = Math.max(scaleX, scaleY);

  const scaledImageWidth = img.naturalWidth * imageScale;
  const scaledImageHeight = img.naturalHeight * imageScale;

  // MOBILE SHIMMER FIX: Round image positioning to integer pixels
  // Center the image with integer coordinates
  const offsetX = Math.round(roundedX + scaleOffsetX + (scaledWidth - scaledImageWidth) / 2);
  const offsetY = Math.round(roundedY + scaleOffsetY + (scaledHeight - scaledImageHeight) / 2);
  const drawWidth = Math.round(scaledImageWidth);
  const drawHeight = Math.round(scaledImageHeight);

  // Safari optimization: Only set image smoothing quality if not already set
  if (!isSafari || ctx.imageSmoothingQuality !== 'high') {
    ctx.imageSmoothingEnabled = true;
    if (!isSafari) {
      ctx.imageSmoothingQuality = 'high'; // Skip expensive quality setting on Safari
    }
  }

  // Draw image with integer pixel coordinates
  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

  // Add subtle border
  ctx.restore();
  ctx.globalAlpha = opacity;

  // Safari optimization: Cache gradients to avoid recreation
  const gradientKey = `border-${Math.round(height)}-${Math.round(opacity * 100)}`;
  let borderGradient = borderGradientCache.get(gradientKey);

  if (!borderGradient) {
    borderGradient = ctx.createLinearGradient(0, 0, 0, roundedHeight);
    borderGradient.addColorStop(0, `rgba(208, 178, 100, ${0.3 * opacity})`);
    borderGradient.addColorStop(1, `rgba(208, 178, 100, ${0.1 * opacity})`);

    // Cache for reuse (limit cache size)
    if (borderGradientCache.size < 50) {
      borderGradientCache.set(gradientKey, borderGradient);
    }
  }

  ctx.strokeStyle = borderGradient;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(
    roundedX + scaleOffsetX,
    roundedY + scaleOffsetY,
    scaledWidth,
    scaledHeight,
    radius,
  );
  ctx.stroke();

  // Safari optimization: Skip expensive shadow effects on Safari
  if (!isSafari) {
    // Add subtle inner shadow/glow (desktop only)
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(
      roundedX + scaleOffsetX,
      roundedY + scaleOffsetY,
      scaledWidth,
      scaledHeight,
      radius,
    );
    ctx.clip();
    ctx.shadowColor = `rgba(208, 178, 100, ${0.1 * opacity})`;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = `rgba(208, 178, 100, ${0.05 * opacity})`;
    ctx.fill();
    ctx.restore();
  } else {
    // Safari fallback: Simple inner border instead of shadow
    ctx.save();
    ctx.strokeStyle = `rgba(208, 178, 100, ${0.1 * opacity})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(
      roundedX + scaleOffsetX + 1,
      roundedY + scaleOffsetY + 1,
      scaledWidth - 2,
      scaledHeight - 2,
      radius - 1,
    );
    ctx.stroke();
    ctx.restore();
  }

  // Reset global alpha
  ctx.globalAlpha = 1;
};
