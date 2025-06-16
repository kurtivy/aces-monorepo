import { lerp } from '../math-utils';

export const drawCreateTokenSquare = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hoverProgress: number, // Now accepts a progress value (0 to 1)
  unitSize: number,
  logoImage: HTMLImageElement | null,
  spaceCanvas: HTMLCanvasElement | null,
  animationTime = 0, // Add animation time parameter
) => {
  const size = lerp(unitSize, unitSize * 1.05, hoverProgress); // Interpolate size
  const padding = (unitSize - size) / 2;
  const centerX = x + unitSize / 2;
  const centerY = y + unitSize / 2;
  const cornerRadius = 8; // Slightly larger corner radius for a more premium look

  ctx.save();

  // Create clipping region for the background
  ctx.beginPath();
  ctx.roundRect(x + padding, y + padding, size, size, cornerRadius);
  ctx.clip();

  // Draw premium background - dark gradient with subtle texture
  const bgGradient = ctx.createLinearGradient(
    x + padding,
    y + padding,
    x + padding + size,
    y + padding + size,
  );
  bgGradient.addColorStop(0, '#1A1A1A');
  bgGradient.addColorStop(1, '#0A0A0A');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(x + padding, y + padding, size, size);

  // Draw space animation from the separate canvas with reduced opacity for a more subtle effect
  if (spaceCanvas) {
    ctx.globalAlpha = 0.7;
    ctx.drawImage(spaceCanvas, x + padding, y + padding, size, size);
    ctx.globalAlpha = 1.0;
  }

  // Draw animated dot pattern for texture (replacing the static dots)
  ctx.save();
  const dotSpacing = 12;
  const time = animationTime * 0.001; // Convert to seconds

  for (let dotX = x + padding + 6; dotX < x + padding + size - 6; dotX += dotSpacing) {
    for (let dotY = y + padding + 6; dotY < y + padding + size - 6; dotY += dotSpacing) {
      // Skip dots that would be too close to the center logo area (if logo exists)
      if (logoImage) {
        const distanceFromCenter = Math.sqrt(
          Math.pow(dotX - centerX, 2) + Math.pow(dotY - centerY, 2),
        );
        if (distanceFromCenter < unitSize * 0.25) {
          continue; // Skip dots too close to logo
        }
      }

      // Create subtle animation for each dot
      const dotIndex = (dotX / dotSpacing) * 100 + dotY / dotSpacing;
      const animationOffset = Math.sin(time * 2 + dotIndex * 0.1) * 0.3;
      const opacityPulse = 0.15 + Math.sin(time * 1.5 + dotIndex * 0.05) * 0.08;

      ctx.fillStyle = `rgba(255, 255, 255, ${opacityPulse})`;
      ctx.beginPath();
      ctx.arc(dotX + animationOffset, dotY + animationOffset * 0.5, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.restore();

  // Draw inner glow effect
  const innerGlowSize = size - 4;
  const innerGlowPadding = (unitSize - innerGlowSize) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(
    x + innerGlowPadding,
    y + innerGlowPadding,
    innerGlowSize,
    innerGlowSize,
    cornerRadius - 2,
  );
  ctx.clip();

  // Create radial gradient for inner glow
  const glowGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, size / 1.5);
  glowGradient.addColorStop(0, `rgba(208, 178, 100, ${lerp(0.1, 0.25, hoverProgress)})`);
  glowGradient.addColorStop(0.7, 'rgba(208, 178, 100, 0.05)');
  glowGradient.addColorStop(1, 'rgba(208, 178, 100, 0)');

  ctx.fillStyle = glowGradient;
  ctx.fillRect(x + innerGlowPadding, y + innerGlowPadding, innerGlowSize, innerGlowSize);
  ctx.restore();

  // Draw premium multi-layered border
  // Layer 1: Outer glow
  ctx.shadowColor = `rgba(208, 178, 100, ${lerp(0.3, 0.8, hoverProgress)})`;
  ctx.shadowBlur = lerp(5, 20, hoverProgress);
  ctx.strokeStyle = `rgba(208, 178, 100, ${lerp(0.6, 0.9, hoverProgress)})`;
  ctx.lineWidth = lerp(1.5, 2.5, hoverProgress);
  ctx.beginPath();
  ctx.roundRect(x + padding, y + padding, size, size, cornerRadius);
  ctx.stroke();

  // Layer 2: Inner border with gradient
  ctx.shadowBlur = 0;
  const borderGradient = ctx.createLinearGradient(
    x + padding,
    y + padding,
    x + padding + size,
    y + padding + size,
  );
  borderGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  borderGradient.addColorStop(0.5, 'rgba(208, 178, 100, 0.8)');
  borderGradient.addColorStop(1, 'rgba(173, 142, 66, 0.9)');

  ctx.strokeStyle = borderGradient;
  ctx.lineWidth = lerp(1, 1.5, hoverProgress);
  ctx.beginPath();
  ctx.roundRect(x + padding + 1, y + padding + 1, size - 2, size - 2, cornerRadius - 1);
  ctx.stroke();

  // Draw logo in a more central position
  if (logoImage) {
    // Reduced logo size for better spacing
    const logoSize = lerp(unitSize * 0.45, unitSize * 0.55, hoverProgress);
    const logoX = centerX - logoSize / 2;
    // Center the logo vertically
    const logoY = centerY - logoSize / 2;

    // Draw logo glow
    ctx.save();
    ctx.shadowColor = `rgba(255, 255, 255, ${lerp(0.3, 0.7, hoverProgress)})`;
    ctx.shadowBlur = lerp(5, 15, hoverProgress);
    ctx.globalAlpha = lerp(0.85, 1, hoverProgress);
    ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
    ctx.restore();
  }

  // Draw premium text with enhanced styling
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // "CREATE TOKEN" as a more prominent title
  // Position it higher in the box for better spacing
  const createTokenFontSize = lerp(unitSize * 0.09, unitSize * 0.11, hoverProgress); // Scaled font size
  ctx.font = `bold ${createTokenFontSize}px 'Syne'`; // Changed to Syne to match home area

  // Text glow effect (disabled for Safari artifact fix)
  ctx.shadowColor = 'transparent'; // Set shadow color to transparent
  ctx.shadowBlur = 0; // Disable shadow blur
  ctx.shadowOffsetY = 0; // Ensure no vertical offset

  // Gold gradient for text with more contrast
  const textGradient = ctx.createLinearGradient(
    centerX - unitSize * 0.35, // Scale gradient start/end
    y + unitSize * 0.15,
    centerX + unitSize * 0.35, // Scale gradient start/end
    y + unitSize * 0.15,
  );
  textGradient.addColorStop(0, '#FFFFFF');
  textGradient.addColorStop(0.5, '#D0B264');
  textGradient.addColorStop(1, '#FFFFFF');

  ctx.fillStyle = textGradient;

  // Position title higher in the box
  ctx.fillText(
    'CREATE TOKEN',
    centerX,
    lerp(
      y + unitSize * 0.18, // Higher position
      y + unitSize * 0.16, // Even higher on hover
      hoverProgress,
    ),
  );

  // ADJUSTED: "COMING SOON" with more appropriate letter spacing
  const comingSoonFontSize = lerp(unitSize * 0.08, unitSize * 0.09, hoverProgress); // Scaled font size
  ctx.font = `bold ${comingSoonFontSize}px 'Syne'`; // Changed to Syne to match home area

  // White color for "COMING SOON" with slight gold tint
  ctx.fillStyle = `rgba(255, 255, 255, ${lerp(0.8, 1.0, hoverProgress)})`;
  ctx.shadowBlur = 0; // Disable shadow blur
  ctx.shadowColor = 'transparent'; // Set shadow color to transparent
  ctx.shadowOffsetY = 0; // Ensure no vertical offset

  // Position "COMING SOON" lower in the box
  const comingSoonY = lerp(
    y + unitSize * 0.82, // Lower position
    y + unitSize * 0.84, // Even lower on hover
    hoverProgress,
  );

  // Draw "COMING SOON" with adjusted letter spacing
  const comingSoonText = 'COMING SOON';

  // First, calculate the maximum width available for the text
  // Leave a safe margin from the edges (15% of the square size)
  const maxAvailableWidth = size * 0.85;

  // Measure the width of each character
  const charWidths = [];
  let totalNaturalWidth = 0;

  for (let i = 0; i < comingSoonText.length; i++) {
    const char = comingSoonText[i];
    const metrics = ctx.measureText(char);
    charWidths.push(metrics.width);
    totalNaturalWidth += metrics.width;
  }

  // Calculate the maximum possible tracking that will fit within the available width
  // Number of spaces between characters = number of characters - 1
  const numSpaces = comingSoonText.length - 1;
  const maxPossibleTracking =
    numSpaces > 0 ? (maxAvailableWidth - totalNaturalWidth) / numSpaces : 0;

  // Use a tracking value that's wide but guaranteed to fit
  // Start with a base tracking and cap it at the maximum possible
  const baseTracking = lerp(4, 6, hoverProgress); // Base desired tracking
  const safeTracking = Math.min(
    baseTracking,
    maxPossibleTracking > 0 ? maxPossibleTracking * 0.9 : 0,
  ); // 90% of max possible for safety margin

  // Calculate total width with the safe tracking
  const totalSpacingWidth = numSpaces * safeTracking;
  const totalWidth = totalNaturalWidth + totalSpacingWidth;

  // Calculate starting position to center the text
  let currentX = centerX - totalWidth / 2;

  // Draw each character with proper spacing
  for (let i = 0; i < comingSoonText.length; i++) {
    const char = comingSoonText[i];
    ctx.fillText(char, currentX + charWidths[i] / 2, comingSoonY);
    currentX += charWidths[i] + safeTracking;
  }

  ctx.restore();

  // Add subtle shine effect on hover
  if (hoverProgress > 0.1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Create a diagonal shine effect
    const shineWidth = size * 0.7;
    const shineHeight = size * 2;
    const shineX = x + padding + size * lerp(-0.15, 0.25, hoverProgress * hoverProgress);
    const shineY = y + padding - size * 0.5;

    const shineGradient = ctx.createLinearGradient(
      shineX,
      shineY,
      shineX + shineWidth * 0.3,
      shineY + shineHeight,
    );
    shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    shineGradient.addColorStop(0.5, `rgba(255, 255, 255, ${hoverProgress * 0.03})`);
    shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = shineGradient;
    ctx.beginPath();
    ctx.moveTo(shineX, shineY);
    ctx.lineTo(shineX + shineWidth, shineY);
    ctx.lineTo(shineX + shineWidth * 0.7, shineY + shineHeight);
    ctx.lineTo(shineX - shineWidth * 0.3, shineY + shineHeight);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
};
