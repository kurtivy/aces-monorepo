import { UNIT_SIZE } from '../../../constants/canvas';
import { browserUtils } from '../../utils/browser-utils';
import { getDeviceCapabilities } from '../../utils/browser-utils';

// Safari-specific performance optimizations
const isSafari =
  typeof navigator !== 'undefined' &&
  navigator.userAgent.includes('Safari') &&
  !navigator.userAgent.includes('Chrome');

// Gradient cache for Safari performance
const homeAreaGradientCache = new Map<string, CanvasGradient>();

export const drawHomeArea = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  logoImage: HTMLImageElement | null,
  mouseX = 0,
  mouseY = 0,
  homeAreaWidth: number,
  homeAreaHeight: number,
  spaceCanvas: HTMLCanvasElement | null = null, // Add space canvas parameter
  animationTime = 0, // For any additional animations
  unitSize = UNIT_SIZE, // Add unitSize parameter
) => {
  // Smart mobile optimization: detect mobile device
  const capabilities = getDeviceCapabilities();
  const isMobileDevice = capabilities.touchCapable || capabilities.isMobileSafari;

  const radius = 12;

  // Background with gradient - Safari optimization: cache gradients
  ctx.save();

  const gradientKey = `home-bg-${Math.round(homeAreaWidth)}-${Math.round(homeAreaHeight)}`;
  let backgroundGradient = homeAreaGradientCache.get(gradientKey);

  if (!backgroundGradient) {
    backgroundGradient = ctx.createLinearGradient(0, 0, homeAreaWidth, homeAreaHeight);
    backgroundGradient.addColorStop(0, '#1A1A1A');
    backgroundGradient.addColorStop(1, '#0A0A0A');

    // Cache for reuse (limit cache size)
    if (homeAreaGradientCache.size < 20) {
      homeAreaGradientCache.set(gradientKey, backgroundGradient);
    }
  }

  ctx.fillStyle = backgroundGradient;
  ctx.beginPath();
  ctx.roundRect(x, y, homeAreaWidth, homeAreaHeight, radius);
  ctx.fill();

  // Add space background (performance optimized)
  if (spaceCanvas && !browserUtils.needsPerformanceMode()) {
    ctx.globalAlpha = 0.7;
    ctx.drawImage(spaceCanvas, x, y, homeAreaWidth, homeAreaHeight);
    ctx.globalAlpha = 1.0;
  }

  ctx.restore();

  // Calculate center position
  const centerX = x + homeAreaWidth / 2;
  const centerY = y + homeAreaHeight / 2;

  // Smart mobile optimization: disable expensive dot animations on mobile
  const shouldShowDotPattern = !isMobileDevice && browserUtils.shouldUseComplexDotPattern();

  // Draw animated dot pattern for texture (disabled on mobile for performance)
  if (shouldShowDotPattern) {
    ctx.save();
    const dotSpacing = 12;
    const time = animationTime * 0.001; // Convert to seconds

    for (let dotX = x + 6; dotX < x + homeAreaWidth - 6; dotX += dotSpacing) {
      for (let dotY = y + 6; dotY < y + homeAreaHeight - 6; dotY += dotSpacing) {
        // Skip dots that would be too close to the center logo area
        const distanceFromCenter = Math.sqrt(
          Math.pow(dotX - centerX, 2) + Math.pow(dotY - centerY, 2),
        );
        if (distanceFromCenter > homeAreaHeight * 0.35) {
          // Create subtle animation for each dot
          const dotIndex = (dotX / dotSpacing) * 100 + dotY / dotSpacing;
          const animationOffset = Math.sin(time * 2 + dotIndex * 0.1) * 0.3;
          const opacityPulse = 0.2 + Math.sin(time * 1.5 + dotIndex * 0.05) * 0.1;

          ctx.fillStyle = `rgba(255, 255, 255, ${opacityPulse})`;
          ctx.beginPath();
          ctx.arc(dotX + animationOffset, dotY + animationOffset * 0.5, 1.0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // Draw premium multi-layered border (matching create token square)
  ctx.save();

  // Safari optimization: Skip expensive shadow effects on Safari
  if (!isSafari && !isMobileDevice) {
    // Layer 1: Outer glow (desktop only, not Safari)
    ctx.shadowColor = 'rgba(208, 178, 100, 0.6)';
    ctx.shadowBlur = 15;
  }

  ctx.strokeStyle = 'rgba(208, 178, 100, 0.8)';
  ctx.lineWidth = 4; // Thick golden border as requested
  ctx.beginPath();
  ctx.roundRect(x, y, homeAreaWidth, homeAreaHeight, radius);
  ctx.stroke();

  // Layer 2: Inner border with gradient - Safari optimization: cache gradients
  ctx.shadowBlur = 0;

  const borderGradientKey = `home-border-${Math.round(homeAreaWidth)}-${Math.round(homeAreaHeight)}`;
  let borderGradient = homeAreaGradientCache.get(borderGradientKey);

  if (!borderGradient) {
    borderGradient = ctx.createLinearGradient(0, 0, homeAreaWidth, homeAreaHeight);
    borderGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    borderGradient.addColorStop(0.5, 'rgba(208, 178, 100, 0.8)');
    borderGradient.addColorStop(1, 'rgba(173, 142, 66, 0.9)');

    // Cache for reuse (limit cache size)
    if (homeAreaGradientCache.size < 20) {
      homeAreaGradientCache.set(borderGradientKey, borderGradient);
    }
  }

  ctx.strokeStyle = borderGradient;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, homeAreaWidth - 4, homeAreaHeight - 4, radius - 1);
  ctx.stroke();

  ctx.restore();

  // Draw quadrant divider lines
  ctx.save();
  ctx.strokeStyle = 'rgba(208, 178, 100, 0.4)';
  ctx.lineWidth = 1.5;

  // Vertical divider line
  ctx.beginPath();
  ctx.moveTo(centerX, y + 8); // Start slightly below top border
  ctx.lineTo(centerX, y + homeAreaHeight - 8); // End slightly above bottom border
  ctx.stroke();

  // Horizontal divider line
  ctx.beginPath();
  ctx.moveTo(x + 8, centerY); // Start slightly right of left border
  ctx.lineTo(x + homeAreaWidth - 8, centerY); // End slightly left of right border
  ctx.stroke();

  ctx.restore();

  // Draw the four quadrant buttons with premium styling
  const drawQuadrantButton = (text: string, quadrant: number) => {
    const quadWidth = homeAreaWidth / 2;
    const quadHeight = homeAreaHeight / 2;
    const isRightSide = quadrant === 1 || quadrant === 3;
    const isBottomHalf = quadrant === 2 || quadrant === 3;
    const quadX = x + (isRightSide ? quadWidth : 0);
    const quadY = y + (isBottomHalf ? quadHeight : 0);

    // Smart mobile optimization: disable hover effects on mobile (touch doesn't have hover)
    const isHovered =
      !isMobileDevice &&
      mouseX >= quadX &&
      mouseX <= quadX + quadWidth &&
      mouseY >= quadY &&
      mouseY <= quadY + quadHeight;

    // Button text with premium golden styling
    ctx.save();

    // Text glow effect (disabled for Safari artifact fix)
    ctx.shadowColor = 'transparent'; // Set shadow color to transparent
    ctx.shadowBlur = 0; // Disable shadow blur
    ctx.shadowOffsetY = 0; // Ensure no vertical offset

    // Gold gradient for text (matching create token square)
    const textGradient = ctx.createLinearGradient(
      quadX,
      quadY + quadHeight / 2 - homeAreaHeight * 0.1, // Scale gradient start/end
      quadX + quadWidth,
      quadY + quadHeight / 2 + homeAreaHeight * 0.1, // Scale gradient start/end
    );
    textGradient.addColorStop(0, '#FFFFFF');
    textGradient.addColorStop(0.5, '#D0B264');
    textGradient.addColorStop(1, '#FFFFFF');

    ctx.fillStyle = textGradient;
    // Mobile-specific font sizing: smaller unitSize (150) gets smaller font, desktop (200) keeps original size
    const isMobile = unitSize <= 150;
    const baseFontSize = isMobile ? unitSize * 0.12 : unitSize * 0.15; // Original desktop size
    const hoverFontSize = isMobile ? unitSize * 0.13 : unitSize * 0.16; // Original desktop size
    ctx.font = `bold ${isHovered ? hoverFontSize : baseFontSize}px 'heading'`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textX = quadX + quadWidth / 2;
    const textY = quadY + quadHeight / 2;

    // Position text closer to center (reduce offset from 0.25 to 0.1 for much more centered text)
    const offsetBase = Math.min(quadWidth, quadHeight) * 0.1;
    const textOffsetX = isRightSide ? offsetBase : -offsetBase;
    const textOffsetY = isBottomHalf ? offsetBase : -offsetBase;

    ctx.fillText(text, textX + textOffsetX, textY + textOffsetY);
    ctx.restore();
  };

  // Draw all quadrant buttons
  drawQuadrantButton('ABOUT', 0);
  drawQuadrantButton('CREATE', 1);
  drawQuadrantButton('TERMS', 2);
  drawQuadrantButton('CAREER', 3);

  // Draw the circular background for logo with premium styling
  const logoSize = Math.min(homeAreaWidth, homeAreaHeight) * 0.6; // 60% of the smaller dimension

  // Logo background with gradient
  const logoGradient = ctx.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    logoSize / 2,
  );
  logoGradient.addColorStop(0, '#2A2A2A');
  logoGradient.addColorStop(1, '#1A1A1A');

  ctx.fillStyle = logoGradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, logoSize / 2, 0, Math.PI * 2);
  ctx.fill();

  // Add premium glow around the logo
  ctx.save();

  // Safari optimization: Skip expensive logo glow on Safari
  if (!isSafari && !isMobileDevice) {
    ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
    ctx.shadowBlur = 10;
  }

  // Multi-layered logo border
  ctx.strokeStyle = 'rgba(208, 178, 100, 0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centerX, centerY, logoSize / 2, 0, Math.PI * 2);
  ctx.stroke();

  // Inner logo border
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(centerX, centerY, logoSize / 2 - 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  // Draw the logo if available
  if (logoImage && logoImage.complete) {
    ctx.save();
    // Create a circular clipping path
    ctx.beginPath();
    ctx.arc(centerX, centerY, logoSize / 2 - 4, 0, Math.PI * 2);
    ctx.clip();

    // Calculate dimensions to maintain aspect ratio
    const scale = (logoSize - 8) / Math.max(logoImage.width, logoImage.height);
    const drawWidth = logoImage.width * scale;
    const drawHeight = logoImage.height * scale;

    // Center the logo in the circle
    const logoX = centerX - drawWidth / 2;
    const logoY = centerY - drawHeight / 2;

    // Draw the logo with enhanced opacity
    ctx.globalAlpha = 0.9;
    ctx.drawImage(logoImage, logoX, logoY, drawWidth, drawHeight);
    ctx.restore();
  }

  ctx.restore();
};
