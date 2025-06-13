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
  const cellsX = Math.round(width / unitSize);
  const cellsY = Math.round(height / unitSize);

  for (let i = 0; i < cellsX; i++) {
    for (let j = 0; j < cellsY; j++) {
      const cellX = Math.round((x + i * unitSize) / unitSize);
      const cellY = Math.round((y + j * unitSize) / unitSize);
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
  const cellsX = Math.round(imgInfo.displayWidth / unitSize);
  const cellsY = Math.round(imgInfo.displayHeight / unitSize);

  for (let i = 0; i < cellsX; i++) {
    for (let j = 0; j < cellsY; j++) {
      const cellX = Math.round((x + i * unitSize) / unitSize);
      const cellY = Math.round((y + j * unitSize) / unitSize);

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
  // Place a "Create Token" square every 6th available square position
  if (
    Math.abs(gridX * 13 + gridY * 17) % 6 === 0 && // Deterministic but sparse
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

  // Option 2: Try the primary image based on the deterministic pattern
  const primaryImageIndex = Math.abs(gridX * 7 + gridY * 11) % imagesRefCurrent.length;
  const primaryImage = imagesRefCurrent[primaryImageIndex];
  if (primaryImage) {
    candidates.push(primaryImage);
  }

  // Option 3: Add square images as fallbacks
  const squareImages = imagesRefCurrent.filter((img) => img.type === 'square');
  candidates.push(...squareImages);

  // Filter out duplicates and ensure complete images
  return Array.from(new Set(candidates)).filter(
    (img) => img.type === 'create-token' || img.element.complete,
  );
};
