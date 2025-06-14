export const drawImage = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  ctx.save();

  // Create rounded rectangle clipping path
  const radius = 8;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.clip();

  // Calculate scale to cover the entire area
  const scaleX = width / img.naturalWidth;
  const scaleY = height / img.naturalHeight;
  const scale = Math.max(scaleX, scaleY);

  const scaledWidth = img.naturalWidth * scale;
  const scaledHeight = img.naturalHeight * scale;

  // Center the image
  const offsetX = x + (width - scaledWidth) / 2;
  const offsetY = y + (height - scaledHeight) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

  // Add subtle border
  ctx.restore();

  // Create gradient for the border
  const borderGradient = ctx.createLinearGradient(x, y, x, y + height);
  borderGradient.addColorStop(0, 'rgba(208, 178, 100, 0.3)'); // Brand gold with higher opacity at top
  borderGradient.addColorStop(1, 'rgba(208, 178, 100, 0.1)'); // Brand gold with lower opacity at bottom

  ctx.strokeStyle = borderGradient;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.stroke();

  // Add subtle inner shadow/glow
  ctx.save();
  ctx.clip();
  ctx.shadowColor = 'rgba(208, 178, 100, 0.1)'; // Brand gold with very low opacity
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = 'rgba(208, 178, 100, 0.05)';
  ctx.fill();
  ctx.restore();
};
