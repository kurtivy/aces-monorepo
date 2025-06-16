import { ImageInfo } from '../../types/canvas'; // Adjusted path

export const isHomeArea = (
  x: number,
  y: number,
  homeAreaWorldX: number,
  homeAreaWorldY: number,
  homeAreaWidth: number,
  homeAreaHeight: number,
) => {
  return (
    x >= homeAreaWorldX &&
    x < homeAreaWorldX + homeAreaWidth &&
    y >= homeAreaWorldY &&
    y < homeAreaWorldY + homeAreaHeight
  );
};

export const isSpaceOccupied = (
  x: number,
  y: number,
  width: number,
  height: number,
  occupiedSpaces: Set<string>,
  unitSize: number,
) => {
  const cellsX = Math.ceil(width / unitSize);
  const cellsY = Math.ceil(height / unitSize);

  for (let i = 0; i < cellsX; i++) {
    for (let j = 0; j < cellsY; j++) {
      const cellX = Math.floor((x + i * unitSize) / unitSize);
      const cellY = Math.floor((y + j * unitSize) / unitSize);
      if (occupiedSpaces.has(`${cellX},${cellY}`)) {
        return true;
      }
    }
  }
  return false;
};

export const markSpaceOccupied = (
  x: number,
  y: number,
  width: number,
  height: number,
  occupiedSpaces: Set<string>,
  unitSize: number,
) => {
  // Use Math.ceil for cellsX/Y to ensure all partially occupied cells are marked
  const cellsX = Math.ceil(width / unitSize);
  const cellsY = Math.ceil(height / unitSize);

  for (let i = 0; i < cellsX; i++) {
    for (let j = 0; j < cellsY; j++) {
      // Use Math.floor for cellX/Y to get the top-left grid coordinate
      const cellX = Math.floor((x + i * unitSize) / unitSize);
      const cellY = Math.floor((y + j * unitSize) / unitSize);
      occupiedSpaces.add(`${cellX},${cellY}`);
    }
  }
};

export const canPlaceImage = (
  x: number,
  y: number,
  imgInfo: ImageInfo,
  currentOccupiedSpaces: Set<string>,
  unitSize: number,
  homeAreaWorldX: number,
  homeAreaWorldY: number,
  homeAreaWidth: number,
  homeAreaHeight: number,
) => {
  // Use Math.ceil for cellsX/Y to ensure all cells the image would occupy are checked
  const cellsX = Math.ceil(imgInfo.displayWidth / unitSize);
  const cellsY = Math.ceil(imgInfo.displayHeight / unitSize);

  for (let i = 0; i < cellsX; i++) {
    for (let j = 0; j < cellsY; j++) {
      // Use Math.floor for cellX/Y to get the top-left grid coordinate
      const cellX = Math.floor((x + i * unitSize) / unitSize);
      const cellY = Math.floor((y + j * unitSize) / unitSize);

      // Check if this cell is part of the home area
      if (
        isHomeArea(
          cellX * unitSize,
          cellY * unitSize,
          homeAreaWorldX,
          homeAreaWorldY,
          homeAreaWidth,
          homeAreaHeight,
        )
      ) {
        return false;
      }
      // Check if this cell is already occupied by another image
      if (currentOccupiedSpaces.has(`${cellX},${cellY}`)) {
        return false;
      }
    }
  }
  return true;
};

// Global placement tracking to ensure all images are used equally
let globalImageUsageCount: Map<string, number> = new Map();
let globalPlacementHistory: Array<{ gridX: number; gridY: number; imageId: string }> = [];

// Reset global tracking (useful for testing or when reloading)
export const resetGlobalPlacementTracking = () => {
  globalImageUsageCount = new Map();
  globalPlacementHistory = [];
};

// Check if a position is adjacent to any existing placement of the same image
const isAdjacentToPreviousPlacement = (
  gridX: number,
  gridY: number,
  imageId: string,
  placementHistory: Array<{ gridX: number; gridY: number; imageId: string }>,
) => {
  const adjacentOffsets = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];

  for (const placement of placementHistory) {
    if (placement.imageId === imageId) {
      for (const [dx, dy] of adjacentOffsets) {
        if (gridX === placement.gridX + dx && gridY === placement.gridY + dy) {
          return true;
        }
      }
    }
  }
  return false;
};

export const getImageCandidatesForPosition = (
  gridX: number,
  gridY: number,
  imagesRefCurrent: ImageInfo[],
  unitSize: number,
  homeAreaWorldX: number,
  homeAreaWorldY: number,
  homeAreaWidth: number,
  homeAreaHeight: number,
) => {
  const candidates: ImageInfo[] = [];

  // Option 1: Try to place a "Create Token" square
  // Place a "Create Token" square every 8th available square position (less frequent than before)
  if (
    Math.abs(gridX * 13 + gridY * 17) % 8 === 0 && // Deterministic but sparse
    !isHomeArea(
      gridX * unitSize,
      gridY * unitSize,
      homeAreaWorldX,
      homeAreaWorldY,
      homeAreaWidth,
      homeAreaHeight,
    ) // Ensure it's not in home area
  ) {
    candidates.push({
      element: new Image(), // Placeholder, not used for rendering
      type: 'create-token',
      displayWidth: unitSize,
      displayHeight: unitSize,
      metadata: {
        title: 'Create Token',
        description: 'Create your own unique digital token.',
        ticker: '$CREATE',
      },
    });
  }

  // Option 2: Smart distribution of ALL images
  if (imagesRefCurrent.length > 0) {
    // Initialize usage count for all images if not done yet
    for (const img of imagesRefCurrent) {
      // Add null safety for metadata access
      if (!img.metadata) {
        console.warn('Image with missing metadata detected, skipping:', img);
        continue;
      }
      const imageId = img.metadata.id || img.metadata.title || 'unknown';
      if (!globalImageUsageCount.has(imageId)) {
        globalImageUsageCount.set(imageId, 0);
      }
    }

    // Find the least used images
    const sortedImages = [...imagesRefCurrent]
      .filter((img) => img.metadata) // Filter out images without metadata
      .sort((a, b) => {
        // Additional null safety checks
        if (!a.metadata || !b.metadata) {
          console.warn('Image metadata missing during sort');
          return 0;
        }

        const aId = a.metadata.id || a.metadata.title || 'unknown';
        const bId = b.metadata.id || b.metadata.title || 'unknown';
        const aCount = globalImageUsageCount.get(aId) || 0;
        const bCount = globalImageUsageCount.get(bId) || 0;

        // If usage counts are equal, use deterministic pattern for consistency
        if (aCount === bCount) {
          return Math.abs(gridX * 7 + gridY * 11) % 2 === 0 ? -1 : 1;
        }

        return aCount - bCount; // Sort by usage count (ascending)
      });

    // Try to place the least used images first, avoiding adjacency
    for (const img of sortedImages) {
      // Additional null safety check
      if (!img.metadata) {
        console.warn('Image metadata missing during placement consideration');
        continue;
      }

      const imageId = img.metadata.id || img.metadata.title || 'unknown';

      // Check if this image is adjacent to any previous placement of the same image
      if (!isAdjacentToPreviousPlacement(gridX, gridY, imageId, globalPlacementHistory)) {
        candidates.push(img);
      }
    }

    // If no candidates due to adjacency constraints, fall back to deterministic selection
    if (candidates.length === 0) {
      const fallbackIndex = Math.abs(gridX * 7 + gridY * 11) % imagesRefCurrent.length;
      const fallbackImage = imagesRefCurrent[fallbackIndex];
      if (fallbackImage && fallbackImage.metadata) {
        candidates.push(fallbackImage);
      }
    }
  }

  // Filter out duplicates and ensure complete images
  return Array.from(new Set(candidates)).filter(
    (img) => img.type === 'create-token' || img.element.complete,
  );
};

// Call this function when an image is successfully placed
export const recordImagePlacement = (gridX: number, gridY: number, imageInfo: ImageInfo) => {
  // Add null safety for metadata access
  if (!imageInfo.metadata) {
    console.warn('Attempting to record placement for image without metadata');
    return;
  }

  const imageId = imageInfo.metadata.id || imageInfo.metadata.title || 'unknown';

  // Update usage count
  const currentCount = globalImageUsageCount.get(imageId) || 0;
  globalImageUsageCount.set(imageId, currentCount + 1);

  // Record placement in history
  globalPlacementHistory.push({ gridX, gridY, imageId });

  // Keep history reasonable size (last 1000 placements)
  if (globalPlacementHistory.length > 1000) {
    globalPlacementHistory = globalPlacementHistory.slice(-1000);
  }
};

// Get usage statistics for debugging
export const getImageUsageStats = () => {
  const stats = Array.from(globalImageUsageCount.entries()).map(([imageId, count]) => ({
    imageId,
    count,
  }));

  return {
    totalPlacements: globalPlacementHistory.length,
    imageStats: stats.sort((a, b) => b.count - a.count), // Sort by usage count descending
    mostUsedImage: stats.reduce((max, current) => (current.count > max.count ? current : max), {
      imageId: 'none',
      count: 0,
    }),
    leastUsedImage: stats.reduce((min, current) => (current.count < min.count ? current : min), {
      imageId: 'none',
      count: Infinity,
    }),
  };
};
