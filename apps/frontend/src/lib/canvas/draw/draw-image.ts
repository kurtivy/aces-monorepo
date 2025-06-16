export const drawImage = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  animationProgress = 1, // Default to fully animated (no animation)
  unitSize: number, // Ensure unitSize is used
) => {
  ctx.save();

  // Animation logic - only applies when animationProgress < 1
  let animatedY = y;
  let opacity = 1;

  if (animationProgress < 1) {
    // Rise from bottom
    const startOffset = unitSize * 0.3; // Make offset relative to unitSize
    const currentOffset = startOffset * (1 - animationProgress);
    animatedY = y + currentOffset;

    // Simple fade-in
    opacity = animationProgress;
  }

  const scaledWidth = width;
  const scaledHeight = height;
  const scaleOffsetX = (width - scaledWidth) / 2;
  const scaleOffsetY = (height - scaledHeight) / 2;

  // Apply opacity
  ctx.globalAlpha = opacity;

  // Create rounded rectangle clipping path
  const radius = 8;
  ctx.beginPath();
  ctx.roundRect(x + scaleOffsetX, animatedY + scaleOffsetY, scaledWidth, scaledHeight, radius);
  ctx.clip();

  // Calculate scale to cover the entire area
  const scaleX = scaledWidth / img.naturalWidth;
  const scaleY = scaledHeight / img.naturalHeight;
  const imageScale = Math.max(scaleX, scaleY);

  const scaledImageWidth = img.naturalWidth * imageScale;
  const scaledImageHeight = img.naturalHeight * imageScale;

  // Center the image
  const offsetX = x + scaleOffsetX + (scaledWidth - scaledImageWidth) / 2;
  const offsetY = animatedY + scaleOffsetY + (scaledHeight - scaledImageHeight) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, offsetX, offsetY, scaledImageWidth, scaledImageHeight);

  // Add subtle border
  ctx.restore();
  ctx.globalAlpha = opacity;

  // Create gradient for the border
  const borderGradient = ctx.createLinearGradient(x, animatedY, x, animatedY + height);
  borderGradient.addColorStop(0, `rgba(208, 178, 100, ${0.3 * opacity})`);
  borderGradient.addColorStop(1, `rgba(208, 178, 100, ${0.1 * opacity})`);

  ctx.strokeStyle = borderGradient;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x + scaleOffsetX, animatedY + scaleOffsetY, scaledWidth, scaledHeight, radius);
  ctx.stroke();

  // Add subtle inner shadow/glow
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + scaleOffsetX, animatedY + scaleOffsetY, scaledWidth, scaledHeight, radius);
  ctx.clip();
  ctx.shadowColor = `rgba(208, 178, 100, ${0.1 * opacity})`;
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = `rgba(208, 178, 100, ${0.05 * opacity})`;
  ctx.fill();
  ctx.restore();

  // Reset global alpha
  ctx.globalAlpha = 1;
};
