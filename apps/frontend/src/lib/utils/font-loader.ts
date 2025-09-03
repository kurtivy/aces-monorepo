/**
 * Font loading utility for canvas rendering
 * Ensures fonts are loaded before being used in canvas contexts
 */

// Font loading status cache
const fontLoadCache = new Map<string, boolean>();

/**
 * Check if a font is loaded and ready for canvas use
 */
export const isFontLoaded = (fontFamily: string): boolean => {
  if (typeof document === 'undefined') return false;

  // Check cache first
  if (fontLoadCache.has(fontFamily)) {
    return fontLoadCache.get(fontFamily)!;
  }

  // Use the Font Loading API if available
  if ('fonts' in document) {
    const isLoaded = document.fonts.check(`16px "${fontFamily}"`);
    fontLoadCache.set(fontFamily, isLoaded);
    return isLoaded;
  }

  // Fallback: assume font is loaded after a delay
  fontLoadCache.set(fontFamily, true);
  return true;
};

/**
 * Wait for a font to be loaded
 */
export const waitForFont = async (fontFamily: string): Promise<boolean> => {
  if (typeof document === 'undefined') return false;

  try {
    if ('fonts' in document) {
      await document.fonts.load(`16px "${fontFamily}"`);
      fontLoadCache.set(fontFamily, true);
      return true;
    }
  } catch (error) {
    console.warn(`Failed to load font: ${fontFamily}`, error);
  }

  return false;
};

/**
 * Get the appropriate font stack for canvas usage
 * Returns fonts in order of preference with fallbacks
 */
export const getCanvasFontStack = (primaryFont: 'NeueWorld' | 'Proxima Nova'): string => {
  const fontStacks = {
    NeueWorld: `'NeueWorld', 'Arial Black', 'Helvetica', sans-serif`,
    'Proxima Nova': `'Proxima Nova', 'Arial', 'Helvetica', sans-serif`,
  };

  return fontStacks[primaryFont];
};

/**
 * Initialize font loading for canvas
 * Call this once when the app starts
 */
export const initCanvasFonts = async (): Promise<void> => {
  if (typeof document === 'undefined') return;

  const fontsToLoad = ['NeueWorld', 'Proxima Nova'];

  // Wait for all fonts to be ready
  const loadPromises = fontsToLoad.map((font) => waitForFont(font));
  await Promise.allSettled(loadPromises);

  console.log('Canvas fonts initialized');
};
