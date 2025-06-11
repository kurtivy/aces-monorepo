import { UNIT_SIZE } from '../../constants/canvas'; // Adjusted path
import { ImageInfo } from '../../types/canvas'; // Adjusted path

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

export const getDisplayDimensions = (type: ImageInfo['type']) => {
  switch (type) {
    case 'landscape':
      return { width: UNIT_SIZE * 2, height: UNIT_SIZE };
    case 'portrait':
      return { width: UNIT_SIZE, height: UNIT_SIZE * 2 };
    case 'create-token':
      return { width: UNIT_SIZE, height: UNIT_SIZE }; // Create token is always 1x1
    default:
      return { width: UNIT_SIZE, height: UNIT_SIZE };
  }
};
