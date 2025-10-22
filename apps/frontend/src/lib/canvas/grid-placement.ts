import { ImageInfo } from '../../types/canvas'; // Adjusted path

// FEATURED SECTION: Updated home area check to include featured section
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

// FEATURED SECTION: New function to check if position is in the combined reserved area (featured + home)
export const isReservedArea = (
  x: number,
  y: number,
  reservedAreaWorldX: number,
  reservedAreaWorldY: number,
  reservedAreaWidth: number,
  reservedAreaHeight: number,
) => {
  return (
    x >= reservedAreaWorldX &&
    x < reservedAreaWorldX + reservedAreaWidth &&
    y >= reservedAreaWorldY &&
    y < reservedAreaWorldY + reservedAreaHeight
  );
};

// FEATURED SECTION: New function to check if position is specifically in featured area
export const isFeaturedArea = (
  x: number,
  y: number,
  featuredAreaWorldX: number,
  featuredAreaWorldY: number,
  featuredAreaWidth: number,
  featuredAreaHeight: number,
) => {
  return (
    x >= featuredAreaWorldX &&
    x < featuredAreaWorldX + featuredAreaWidth &&
    y >= featuredAreaWorldY &&
    y < featuredAreaWorldY + featuredAreaHeight
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

// FEATURED SECTION: Updated canPlaceImage to use the new reserved area parameters
export const canPlaceImage = (
  x: number,
  y: number,
  imgInfo: ImageInfo,
  currentOccupiedSpaces: Set<string>,
  unitSize: number,
  reservedAreaWorldX: number, // FEATURED SECTION: Now refers to total reserved area
  reservedAreaWorldY: number,
  reservedAreaWidth: number,
  reservedAreaHeight: number,
) => {
  // Use Math.ceil for cellsX/Y to ensure all cells the image would occupy are checked
  const cellsX = Math.ceil(imgInfo.displayWidth / unitSize);
  const cellsY = Math.ceil(imgInfo.displayHeight / unitSize);

  for (let i = 0; i < cellsX; i++) {
    for (let j = 0; j < cellsY; j++) {
      // Use Math.floor for cellX/Y to get the top-left grid coordinate
      const cellX = Math.floor((x + i * unitSize) / unitSize);
      const cellY = Math.floor((y + j * unitSize) / unitSize);

      // FEATURED SECTION: Check if this cell is part of the reserved area (featured + home)
      if (
        isReservedArea(
          cellX * unitSize,
          cellY * unitSize,
          reservedAreaWorldX,
          reservedAreaWorldY,
          reservedAreaWidth,
          reservedAreaHeight,
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

// Submit asset alternation tracking (for alternating between image and video)
let submitAssetOccurrenceCount = 0;

// Reset global tracking (useful for testing or when reloading)
export const resetGlobalPlacementTracking = () => {
  globalImageUsageCount = new Map();
  globalPlacementHistory = [];
  submitAssetOccurrenceCount = 0; // Reset submit asset alternation
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

// FEATURED SECTION: Updated getImageCandidatesForPosition to use new reserved area parameters
export const getImageCandidatesForPosition = (
  gridX: number,
  gridY: number,
  imagesRefCurrent: ImageInfo[],
  unitSize: number,
  reservedAreaWorldX: number, // FEATURED SECTION: Now refers to total reserved area
  reservedAreaWorldY: number,
  reservedAreaWidth: number,
  reservedAreaHeight: number,
  // NEW: Optional grid bounds for boundary detection
  gridBounds?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    width: number;
    height: number;
  },
): ImageInfo[] => {
  const candidates: ImageInfo[] = [];

  // NEW: Determine if this position is at a tile boundary
  let isAtTileBoundary = false;
  if (gridBounds) {
    const tileWidth = gridBounds.width;
    const tileHeight = gridBounds.height;
    const worldX = gridX * unitSize;
    const worldY = gridY * unitSize;

    // Check if position is at the edge of any tile when repeated
    const relativeX = (((worldX - gridBounds.startX) % tileWidth) + tileWidth) % tileWidth;
    const relativeY = (((worldY - gridBounds.startY) % tileHeight) + tileHeight) % tileHeight;

    // Position is at boundary if it's within 2 units of tile edge (more aggressive)
    // This prevents 2x1 landscape and 1x2 portrait images from extending beyond boundaries
    const edgeThreshold = unitSize * 2;
    isAtTileBoundary =
      relativeX < edgeThreshold ||
      relativeX > tileWidth - edgeThreshold ||
      relativeY < edgeThreshold ||
      relativeY > tileHeight - edgeThreshold;
  }

  // Option 1: Try to place a "Submit Your Asset" image/video (ALTERNATING)
  // Place a "Submit Your Asset" image every 8th available square position (deterministic but sparse)
  if (
    Math.abs(gridX * 13 + gridY * 17) % 8 === 0 && // Deterministic but sparse
    !isReservedArea(
      // FEATURED SECTION: Use new reserved area check
      gridX * unitSize,
      gridY * unitSize,
      reservedAreaWorldX,
      reservedAreaWorldY,
      reservedAreaWidth,
      reservedAreaHeight,
    ) && // Ensure it's not in reserved area
    !isAdjacentToReservedArea(
      // FEATURED SECTION: Use new adjacent check
      gridX * unitSize,
      gridY * unitSize,
      reservedAreaWorldX,
      reservedAreaWorldY,
      reservedAreaWidth,
      reservedAreaHeight,
      unitSize,
    ) // Ensure it's not adjacent to reserved area
  ) {
    // ALTERNATING: Determine which submit asset to use based on occurrence count
    // Odd occurrences (1st, 3rd, 5th...) → 'submit-asset' (image)
    // Even occurrences (2nd, 4th, 6th...) → 'submit-asset-video' (video)
    const isOddOccurrence = submitAssetOccurrenceCount % 2 === 0; // 0-indexed, so even count = odd occurrence
    const submitAssetId = isOddOccurrence ? 'submit-asset' : 'submit-asset-video';

    // Find the appropriate submit asset (image or video) from images array
    const submitAssetImage = imagesRefCurrent.find(
      (img: ImageInfo) => img.metadata.id === submitAssetId,
    );

    if (submitAssetImage) {
      candidates.push({
        element: submitAssetImage.element,
        type: 'submit-asset',
        displayWidth: unitSize,
        displayHeight: unitSize,
        metadata: submitAssetImage.metadata,
      });

      // Increment the occurrence counter for next placement
      submitAssetOccurrenceCount++;
    }
  }

  // Option 2: Smart distribution of ALL images (KEEP PRODUCTION SAFETY IMPROVEMENTS)
  if (imagesRefCurrent.length > 0) {
    // PRODUCTION FIX: Filter out any images without metadata early
    const validImages = imagesRefCurrent.filter((img) => {
      if (!img || !img.metadata) {
        return false;
      }
      return true;
    });

    // NEW: Filter images based on boundary constraints
    const boundaryFilteredImages = validImages.filter((img) => {
      // At tile boundaries, only allow square images (including submit-asset and interactive squares)
      if (isAtTileBoundary) {
        return (
          img.type === 'square' ||
          img.type === 'submit-asset' ||
          img.metadata?.id === 'click-to-trade' ||
          img.metadata?.id === 'pretty-rare-tv' ||
          img.metadata?.id === 'drvn'
        );
      }
      // In tile interior, allow all image types but prefer non-squares
      return true;
    });

    // Use boundary-filtered images if available, otherwise fall back to all valid images
    const imagesToUse = boundaryFilteredImages.length > 0 ? boundaryFilteredImages : validImages;

    // Initialize usage count for all images if not done yet
    for (const img of imagesToUse) {
      // Additional safety check (should be redundant now)
      if (!img.metadata) {
        // Image with missing metadata detected, skipping
        continue;
      }
      const imageId = img.metadata.id || img.metadata.title || 'unknown';
      if (!globalImageUsageCount.has(imageId)) {
        globalImageUsageCount.set(imageId, 0);
      }
    }

    // Find the least used images
    const sortedImages = [...imagesToUse].sort((a, b) => {
      // Additional null safety checks (KEEP PRODUCTION SAFETY)
      if (!a.metadata || !b.metadata) {
        // Image metadata missing during sort
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
      // Additional null safety check (KEEP PRODUCTION SAFETY)
      if (!img.metadata) {
        // Image metadata missing during placement consideration
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
      const fallbackIndex = Math.abs(gridX * 7 + gridY * 11) % imagesToUse.length;
      const fallbackImage = imagesToUse[fallbackIndex];
      if (fallbackImage && fallbackImage.metadata) {
        candidates.push(fallbackImage);
      }
    }
  }

  // Filter out duplicates and ensure complete images/videos
  return Array.from(new Set(candidates)).filter((img) => {
    if (
      img.type === 'submit-asset' ||
      img.metadata?.id === 'click-to-trade' ||
      img.metadata?.id === 'pretty-rare-tv' ||
      img.metadata?.id === 'drvn'
    )
      return true;
    // Check if it's an image and complete, or a video
    if (img.element instanceof HTMLImageElement) {
      return img.element.complete;
    }
    // Videos are always "ready" once loaded
    return img.element instanceof HTMLVideoElement;
  });
};

// Call this function when an image is successfully placed
export const recordImagePlacement = (gridX: number, gridY: number, imageInfo: ImageInfo) => {
  // Add null safety for metadata access
  if (!imageInfo.metadata) {
    // Attempting to record placement for image without metadata
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

// FEATURED SECTION: Updated helper function to check if a position is adjacent to the reserved area
export const isAdjacentToReservedArea = (
  x: number,
  y: number,
  reservedAreaWorldX: number,
  reservedAreaWorldY: number,
  reservedAreaWidth: number,
  reservedAreaHeight: number,
  unitSize: number,
) => {
  // Convert world coordinates to grid coordinates
  const gridX = Math.floor(x / unitSize);
  const gridY = Math.floor(y / unitSize);

  // Convert reserved area bounds to grid coordinates
  const reservedStartGridX = Math.floor(reservedAreaWorldX / unitSize);
  const reservedEndGridX = Math.floor((reservedAreaWorldX + reservedAreaWidth) / unitSize);
  const reservedStartGridY = Math.floor(reservedAreaWorldY / unitSize);
  const reservedEndGridY = Math.floor((reservedAreaWorldY + reservedAreaHeight) / unitSize);

  // Check if the position is adjacent (within 1 grid cell) of the reserved area
  const isWithinAdjacentBounds =
    gridX >= reservedStartGridX - 1 &&
    gridX <= reservedEndGridX &&
    gridY >= reservedStartGridY - 1 &&
    gridY <= reservedEndGridY;

  return (
    isWithinAdjacentBounds &&
    !isReservedArea(
      x,
      y,
      reservedAreaWorldX,
      reservedAreaWorldY,
      reservedAreaWidth,
      reservedAreaHeight,
    )
  );
};

// FEATURED SECTION: Keep old function for backward compatibility
export const isAdjacentToHomeArea = (
  x: number,
  y: number,
  homeAreaWorldX: number,
  homeAreaWorldY: number,
  homeAreaWidth: number,
  homeAreaHeight: number,
  unitSize: number,
) => {
  // Convert world coordinates to grid coordinates
  const gridX = Math.floor(x / unitSize);
  const gridY = Math.floor(y / unitSize);

  // Convert home area bounds to grid coordinates
  const homeStartGridX = Math.floor(homeAreaWorldX / unitSize);
  const homeEndGridX = Math.floor((homeAreaWorldX + homeAreaWidth) / unitSize);
  const homeStartGridY = Math.floor(homeAreaWorldY / unitSize);
  const homeEndGridY = Math.floor((homeAreaWorldY + homeAreaHeight) / unitSize);

  // Check if the position is adjacent (within 1 grid cell) of the home area
  const isWithinAdjacentBounds =
    gridX >= homeStartGridX - 1 &&
    gridX <= homeEndGridX &&
    gridY >= homeStartGridY - 1 &&
    gridY <= homeEndGridY;

  return (
    isWithinAdjacentBounds &&
    !isHomeArea(x, y, homeAreaWorldX, homeAreaWorldY, homeAreaWidth, homeAreaHeight)
  );
};
