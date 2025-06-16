import type { ImageInfo } from '../../types/canvas';

export const getImageType = (
  width: number,
  height: number,
): 'square' | 'landscape' | 'portrait' => {
  // Check for exact dimensions first
  if (width === 1024 && height === 1024) return 'square'; // 1x1
  if (width === 1536 && height === 1024) return 'landscape'; // 2x1
  if (width === 1024 && height === 1536) return 'portrait'; // 1x2

  // Fallback to aspect ratio for other images
  const aspectRatio = width / height;
  if (aspectRatio > 1.2) return 'landscape';
  if (aspectRatio < 0.8) return 'portrait';
  return 'square';
};

// ✅ FIX: Accept unitSize parameter instead of using static UNIT_SIZE
export const getDisplayDimensions = (type: ImageInfo['type'], unitSize: number) => {
  switch (type) {
    case 'landscape':
      return { width: unitSize * 2, height: unitSize };
    case 'portrait':
      return { width: unitSize, height: unitSize * 2 };
    case 'create-token':
      return { width: unitSize, height: unitSize }; // Create token is always 1x1
    default:
      return { width: unitSize, height: unitSize };
  }
};
