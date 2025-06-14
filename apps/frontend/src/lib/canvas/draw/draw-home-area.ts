export const drawHomeArea = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  logoImage: HTMLImageElement | null,
  mouseX: number = 0,
  mouseY: number = 0,
  homeAreaWidth: number,
  homeAreaHeight: number,
) => {
  ctx.save();

  // Draw background
  const radius = 8;
  ctx.fillStyle = 'rgba(35, 31, 32, 0.95)';
  ctx.beginPath();
  ctx.roundRect(x, y, homeAreaWidth, homeAreaHeight, radius);
  ctx.fill();

  // Draw border
  ctx.strokeStyle = 'rgba(208, 178, 100, 0.3)';
  ctx.lineWidth = 5; // Increased border thickness
  ctx.stroke();

  // Calculate center position
  const centerX = x + homeAreaWidth / 2;
  const centerY = y + homeAreaHeight / 2;

  // Draw the four quadrant buttons
  const drawQuadrantButton = (text: string, quadrant: number) => {
    const quadWidth = homeAreaWidth / 2;
    const quadHeight = homeAreaHeight / 2;
    const isRightSide = quadrant === 1 || quadrant === 3;
    const isBottomHalf = quadrant === 2 || quadrant === 3;
    const quadX = x + (isRightSide ? quadWidth : 0);
    const quadY = y + (isBottomHalf ? quadHeight : 0);

    // Check if mouse is over this quadrant
    const isHovered =
      mouseX >= quadX &&
      mouseX <= quadX + quadWidth &&
      mouseY >= quadY &&
      mouseY <= quadY + quadHeight;

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
  const logoSize = homeAreaHeight;
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
