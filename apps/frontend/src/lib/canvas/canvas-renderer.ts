import { HOME_AREA_WIDTH, HOME_AREA_HEIGHT } from '../../constants/canvas'; // Adjusted path

// Add mouse position tracking
const mousePositionRef = { x: 0, y: 0 };

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

export const drawHomeArea = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  logoImage: HTMLImageElement | null,
  mouseX: number = 0,
  mouseY: number = 0,
) => {
  // Update mouse position
  mousePositionRef.x = mouseX;
  mousePositionRef.y = mouseY;

  ctx.save();

  // Draw background
  const radius = 8;
  ctx.fillStyle = 'rgba(35, 31, 32, 0.95)';
  ctx.beginPath();
  ctx.roundRect(x, y, HOME_AREA_WIDTH, HOME_AREA_HEIGHT, radius);
  ctx.fill();

  // Draw border
  ctx.strokeStyle = 'rgba(208, 178, 100, 0.3)';
  ctx.lineWidth = 5; // Increased border thickness
  ctx.stroke();

  // Calculate center position
  const centerX = x + HOME_AREA_WIDTH / 2;
  const centerY = y + HOME_AREA_HEIGHT / 2;

  // Draw the four quadrant buttons
  const drawQuadrantButton = (text: string, quadrant: number) => {
    const quadWidth = HOME_AREA_WIDTH / 2;
    const quadHeight = HOME_AREA_HEIGHT / 2;
    const isRightSide = quadrant === 1 || quadrant === 3;
    const isBottomHalf = quadrant === 2 || quadrant === 3;
    const quadX = x + (isRightSide ? quadWidth : 0);
    const quadY = y + (isBottomHalf ? quadHeight : 0);

    // Check if mouse is over this quadrant
    const isHovered =
      mousePositionRef.x >= quadX &&
      mousePositionRef.x <= quadX + quadWidth &&
      mousePositionRef.y >= quadY &&
      mousePositionRef.y <= quadY + quadHeight;

    // Button background with hover effect
    ctx.fillStyle = isHovered
      ? 'rgba(208, 178, 100, 1)' // Brighter gold on hover
      : 'rgba(208, 178, 100, 0.8)'; // Slightly dimmer gold when not hovered

    ctx.beginPath();
    if (quadrant === 0) {
      // Top-left
      ctx.roundRect(quadX, quadY, quadWidth, quadHeight, [radius, 0, 0, 0]);
    } else if (quadrant === 1) {
      // Top-right
      ctx.roundRect(quadX, quadY, quadWidth, quadHeight, [0, radius, 0, 0]);
    } else if (quadrant === 2) {
      // Bottom-left
      ctx.roundRect(quadX, quadY, quadWidth, quadHeight, [0, 0, 0, radius]);
    } else {
      // Bottom-right
      ctx.roundRect(quadX, quadY, quadWidth, quadHeight, [0, 0, radius, 0]);
    }
    ctx.fill();

    // Button border
    ctx.strokeStyle = '#231F20'; // Charcoal border
    ctx.lineWidth = 2; // Slightly thicker border for better visibility
    ctx.stroke();

    // Button text
    ctx.fillStyle = '#231F20'; // Charcoal text to match border
    ctx.font = "700 30px 'Syne', sans-serif"; // Updated to Spectral with weight 700 (bold)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textX = quadX + quadWidth / 2;
    const textY = quadY + quadHeight / 2;

    // Position text further from center and maintain symmetry
    const offsetBase = Math.min(quadWidth, quadHeight) * 0.35; // Use 35% of the smaller quadrant dimension
    const textOffsetX = isRightSide ? offsetBase : -offsetBase;
    const textOffsetY = isBottomHalf ? offsetBase : -offsetBase;
    ctx.fillText(text, textX + textOffsetX, textY + textOffsetY);
  };

  // Draw all quadrant buttons
  drawQuadrantButton('About', 0);
  drawQuadrantButton('Create', 1);
  drawQuadrantButton('Terms', 2);
  drawQuadrantButton('Career', 3);

  // Draw the circular background for logo
  const logoSize = HOME_AREA_HEIGHT;
  ctx.fillStyle = '#231F20';
  ctx.beginPath();
  ctx.arc(centerX, centerY, logoSize / 2, 0, Math.PI * 2);
  ctx.fill();

  // Add subtle glow around the logo
  ctx.shadowColor = 'rgba(208, 178, 100, 0.2)';
  ctx.shadowBlur = 30;
  ctx.strokeStyle = 'rgba(208, 178, 100, 0.3)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Draw the logo if available
  if (logoImage && logoImage.complete) {
    ctx.save();
    // Create a circular clipping path
    ctx.beginPath();
    ctx.arc(centerX, centerY, logoSize / 2 - 3, 0, Math.PI * 2);
    ctx.clip();

    // Calculate dimensions to maintain aspect ratio
    const scale = (logoSize - 6) / Math.max(logoImage.width, logoImage.height);
    const drawWidth = logoImage.width * scale;
    const drawHeight = logoImage.height * scale;

    // Center the logo in the circle
    const logoX = centerX - drawWidth / 2;
    const logoY = centerY - drawHeight / 2;

    // Draw the logo
    ctx.drawImage(logoImage, logoX, logoY, drawWidth, drawHeight);
    ctx.restore();
  }

  ctx.restore();
};
