// Image error handling utilities for RWA components
import { SyntheticEvent } from 'react';

export interface ImageErrorEvent extends SyntheticEvent<HTMLImageElement, Event> {
  currentTarget: HTMLImageElement;
}

/**
 * Creates a data URL for a placeholder image with text
 */
export function createPlaceholderDataUrl(
  width: number = 400,
  height: number = 300,
  text: string = 'Image Error',
  bgColor: string = '#151c16',
  textColor: string = '#D0B284'
): string {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${bgColor}"/>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" 
            fill="${textColor}" font-family="Arial, sans-serif" font-size="16">
        ${text}
      </text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Enhanced image error handler with retry logic and proper fallbacks
 */
export function createImageErrorHandler(options: {
  fallbackText?: string;
  width?: number;
  height?: number;
  onError?: (src: string, error: Event) => void;
  maxRetries?: number;
}) {
  const {
    fallbackText = 'Image Error',
    width = 400,
    height = 300,
    onError,
    maxRetries = 1
  } = options;

  return (e: ImageErrorEvent) => {
    const img = e.currentTarget;
    const originalSrc = img.src;
    
    // Get retry count from data attribute
    const retryCount = parseInt(img.dataset.retryCount || '0', 10);
    
    console.error(`Image failed to load (attempt ${retryCount + 1}):`, originalSrc);
    
    // Call custom error handler if provided
    if (onError) {
      onError(originalSrc, e.nativeEvent);
    }
    
    // Try retry if we haven't exceeded max retries and it's a network error
    if (retryCount < maxRetries && !originalSrc.startsWith('data:')) {
      console.log(`Retrying image load for: ${originalSrc}`);
      img.dataset.retryCount = String(retryCount + 1);
      
      // Add a small delay before retry
      setTimeout(() => {
        img.src = originalSrc;
      }, 1000 * (retryCount + 1)); // Exponential backoff
      
      return;
    }
    
    // Use data URL placeholder as final fallback
    const placeholderUrl = createPlaceholderDataUrl(width, height, fallbackText);
    img.src = placeholderUrl;
    
    // Clear retry count
    delete img.dataset.retryCount;
  };
}

/**
 * Pre-loads an image and returns a promise
 */
export function preloadImage(src: string, timeout: number = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    const timer = setTimeout(() => {
      reject(new Error(`Image load timeout: ${src}`));
    }, timeout);
    
    img.onload = () => {
      clearTimeout(timer);
      resolve(src);
    };
    
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`Image load failed: ${src}`));
    };
    
    img.src = src;
  });
}

/**
 * Smart image src selector that validates URLs and provides fallbacks
 */
export function getValidImageSrc(
  primarySrc: string | null | undefined,
  fallbackSrc?: string,
  placeholderOptions?: {
    width?: number;
    height?: number;
    text?: string;
  }
): string {
  // Try primary source first
  if (primarySrc && typeof primarySrc === 'string' && primarySrc.trim()) {
    return primarySrc.trim();
  }
  
  // Try fallback source
  if (fallbackSrc && typeof fallbackSrc === 'string' && fallbackSrc.trim()) {
    return fallbackSrc.trim();
  }
  
  // Generate placeholder data URL
  const { width = 400, height = 300, text = 'No Image' } = placeholderOptions || {};
  return createPlaceholderDataUrl(width, height, text);
}
