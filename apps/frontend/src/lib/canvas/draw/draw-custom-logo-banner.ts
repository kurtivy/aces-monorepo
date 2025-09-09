import { getCanvasFontStack } from '../../utils/font-loader';

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
    (m as any).actualBoundingBoxAscent ?? Math.max(0, m.emHeightAscent ?? parseFloat(font) * 0.8);
  const descent =
    (m as any).actualBoundingBoxDescent ?? Math.max(0, m.emHeightDescent ?? parseFloat(font) * 0.2);
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
) => {
  ctx.save();

  // Background
  ctx.fillStyle = STYLE_COLORS.black;
  ctx.fillRect(x, y, width, height);

  // Sizing
  const base = Math.min(width, height);
  const isMobile = unitSize <= 150;

  const acesFontSize = Math.floor(base * (isMobile ? 0.48 : 0.58));
  const funFontSize = Math.floor(base * (isMobile ? 0.43 : 0.55));
  const tagFontSize = Math.floor(base * (isMobile ? 0.07 : 0.09));

  const acesFont = `900 ${acesFontSize}px ${getCanvasFontStack('BraahOne')}`;
  const funFont = `${funFontSize}px ${getCanvasFontStack('Spray Letters')}`;
  const tagFont = `700 ${tagFontSize}px ${getCanvasFontStack('Proxima Nova')}`;

  // Measurements
  const aces = getTextMetrics(ctx, 'ACES', acesFont);
  const fun = getTextMetrics(ctx, '.FUN', funFont);

  // ACES ⇄ .FUN spacing
  const spacing = base * 0.025;
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
  const tagline = 'TRADE TOKENIZED COLLECTIBLES';
  const taglineY = bottomY + taglineOffset;

  // Right padding for tagline alignment
  const rightPadding = Math.max(base * 0.04, 24);
  const rightX = x + width - rightPadding;

  const track = isMobile ? tagFontSize * 0.14 : tagFontSize * 0.18;

  ctx.fillStyle = STYLE_COLORS.pureWhite;
  ctx.font = tagFont;
  ctx.textBaseline = 'alphabetic';
  drawTrackedTextRight(ctx, tagline, rightX, taglineY, track);

  ctx.restore();
};
