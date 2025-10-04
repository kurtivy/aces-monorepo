// Placeholder utilities for consistent fallback images
import { createPlaceholderDataUrl } from './image-error-handler';

/**
 * Get a placeholder image URL for different contexts
 */
export function getPlaceholderUrl(context: {
  width?: number;
  height?: number;
  text?: string;
  useStaticFile?: boolean;
}): string {
  const {
    width = 400,
    height = 300,
    text = 'Image Not Available',
    useStaticFile = false,
  } = context;

  // Use static SVG file for simple cases
  if (useStaticFile) {
    return `/placeholder.svg?height=${height}&width=${width}&text=${encodeURIComponent(text)}`;
  }

  // Use data URL for more reliable loading
  return createPlaceholderDataUrl(width, height, text);
}

/**
 * Predefined placeholder configurations for common use cases
 */
export const PLACEHOLDER_CONFIGS = {
  avatar: {
    width: 64,
    height: 64,
    text: 'Avatar',
  },
  thumbnail: {
    width: 100,
    height: 100,
    text: 'Thumbnail',
  },
  gallery: {
    width: 400,
    height: 300,
    text: 'Image',
  },
  hero: {
    width: 500,
    height: 300,
    text: 'Product Image',
  },
  listing: {
    width: 200,
    height: 150,
    text: 'Listing',
  },
} as const;

/**
 * Get a placeholder URL for a specific use case
 */
export function getPlaceholderForContext(
  contextKey: keyof typeof PLACEHOLDER_CONFIGS,
  customText?: string,
): string {
  const config = PLACEHOLDER_CONFIGS[contextKey];
  return getPlaceholderUrl({
    ...config,
    text: customText || config.text,
  });
}

/**
 * Enhanced image src selector with placeholder fallback
 */
export function getImageSrcWithFallback(
  primarySrc: string | null | undefined,
  contextKey: keyof typeof PLACEHOLDER_CONFIGS,
  customText?: string,
): string {
  if (primarySrc && typeof primarySrc === 'string' && primarySrc.trim()) {
    return primarySrc.trim();
  }

  return getPlaceholderForContext(contextKey, customText);
}
