import { getCanvasFontStack } from '../../utils/font-loader';
import type { DeviceCapabilities } from '../../../types/capabilities';
import { getResponsiveMetrics } from '../../utils/responsive-canvas-utils';

const STYLE_COLORS = {
  deepCharcoal: '#231F20',
  goldenBeige: '#D0B284',
  pureWhite: '#FFFFFF',
  highlightGold: '#D7BF75',
  antiqueBronze: '#928357',
  black: '#000000',
} as const;

// Measure with sensible fallbacks
function getTextMetrics(ctx: CanvasRenderingContext2D, text: string, font: string) {
  ctx.save();
  ctx.font = font;
  const m = ctx.measureText(text);
  const ascent =
    (m as { actualBoundingBoxAscent?: number; emHeightAscent?: number }).actualBoundingBoxAscent ??
    Math.max(0, (m as { emHeightAscent?: number }).emHeightAscent ?? parseFloat(font) * 0.8);
  const descent =
    (m as { actualBoundingBoxDescent?: number; emHeightDescent?: number })
      .actualBoundingBoxDescent ??
    Math.max(0, (m as { emHeightDescent?: number }).emHeightDescent ?? parseFloat(font) * 0.2);
  ctx.restore();
  return { width: m.width, ascent, descent };
}

// Draw text with manual tracking (letter spacing)
function drawTrackedTextLeft(
  ctx: CanvasRenderingContext2D,
  text: string,
  startX: number,
  y: number,
  track: number,
) {
  let x = startX;
  for (const ch of text) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + track;
  }
}

// Right-align version: final glyph ends at rightX
function drawTrackedTextRight(
  ctx: CanvasRenderingContext2D,
  text: string,
  rightX: number,
  y: number,
  track: number,
) {
  const natural = ctx.measureText(text).width;
  const total = natural + track * (text.length - 1);
  const startX = rightX - total;
  drawTrackedTextLeft(ctx, text, startX, y, track);
}

/**
 * ACES.FUN Logo Banner (centered block, bottom-aligned, bigger, new tagline layout)
 */
export const drawCustomLogoBanner = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  unitSize: number,
  opacity: number = 1, // Add opacity parameter with default
  capabilities: DeviceCapabilities, // Add capabilities parameter
) => {
  const responsiveMetrics = getResponsiveMetrics(unitSize, capabilities);

  ctx.save();

  // Apply opacity for fade-in effect
  ctx.globalAlpha = opacity;

  // Background
  ctx.fillStyle = STYLE_COLORS.black;
  ctx.fillRect(x, y, width, height);

  // Sizing
  const base = Math.min(width, height);

  // Responsive font sizing - make mobile fonts larger to fill more space
  const acesFontSize = Math.floor(
    base * (responsiveMetrics.isMobile ? 0.92 * responsiveMetrics.fontScale : 0.58),
  );

  const funFontSize = Math.floor(
    base * (responsiveMetrics.isMobile ? 0.85 * responsiveMetrics.fontScale : 0.55),
  );

  const tagFontSize = Math.floor(
    base * (responsiveMetrics.isMobile ? 0.16 * responsiveMetrics.fontScale : 0.09),
  );

  const acesFont = `900 ${acesFontSize}px ${getCanvasFontStack('BraahOne')}`;
  const funFont = `${funFontSize}px ${getCanvasFontStack('Spray Letters')}`;
  const tagFont = `700 ${tagFontSize}px ${getCanvasFontStack('Proxima Nova')}`;

  // Measurements
  const aces = getTextMetrics(ctx, 'ACES', acesFont);
  const fun = getTextMetrics(ctx, '.FUN', funFont);

  // ACES ⇄ .FUN spacing with responsive scaling
  const spacing = base * 0.025 * responsiveMetrics.spacingScale;
  const totalWidth = aces.width + spacing + fun.width;
  const centerX = x + width / 2;
  const startX = centerX - totalWidth / 2;

  // --- Vertical centering logic ---
  // Height of the logo line
  const logoHeight = Math.max(aces.ascent + aces.descent, fun.ascent + fun.descent);

  // Gap between logo and tagline
  const taglineOffset = tagFontSize * 1.4;

  // Total block height
  const blockHeight = logoHeight + taglineOffset + tagFontSize;

  // Top of the block, centered vertically
  const blockTop = y + (height - blockHeight) / 2;

  // Baseline for ACES/.FUN
  const bottomY = blockTop + logoHeight;

  // Y positions so bottoms line up
  const acesY = bottomY - aces.descent;
  const funY = bottomY - fun.descent + 10; // keep your tweak

  // Draw ACES
  ctx.fillStyle = STYLE_COLORS.pureWhite;
  ctx.font = acesFont;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('ACES', startX, acesY);

  // Draw .FUN
  const funX = startX + aces.width + spacing;
  ctx.fillStyle = STYLE_COLORS.highlightGold;
  ctx.font = funFont;
  ctx.fillText('.FUN', funX, funY);

  // --- Tagline ---
  const tagline = 'Trade Collectible Hype Markets';
  const taglineY = bottomY + taglineOffset;

  // Align tagline to the right edge of ".FUN" text instead of container edge
  const funRightEdge = funX + fun.width;
  const rightX = responsiveMetrics.isMobile
    ? funRightEdge
    : x + width - Math.max(base * 0.04, 24) * responsiveMetrics.paddingScale;

  const track = responsiveMetrics.isMobile
    ? tagFontSize * 0.14 * responsiveMetrics.spacingScale
    : tagFontSize * 0.18 * responsiveMetrics.spacingScale;

  ctx.fillStyle = STYLE_COLORS.pureWhite;
  ctx.font = tagFont;
  ctx.textBaseline = 'alphabetic';
  drawTrackedTextRight(ctx, tagline, rightX, taglineY, track);

  ctx.restore();
};
