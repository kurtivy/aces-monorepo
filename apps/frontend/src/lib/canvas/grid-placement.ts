import {
  UNIT_SIZE,
  HOME_AREA_WORLD_X,
  HOME_AREA_WORLD_Y,
  HOME_AREA_WIDTH,
  HOME_AREA_HEIGHT,
} from '../../constants/canvas'; // Adjusted path
import { ImageInfo } from '../../types/canvas'; // Adjusted path

export const isHomeArea = (x: number, y: number) => {
  return (
    x >= HOME_AREA_WORLD_X &&
    x < HOME_AREA_WORLD_X + HOME_AREA_WIDTH &&
    y >= HOME_AREA_WORLD_Y &&
    y < HOME_AREA_WORLD_Y + HOME_AREA_HEIGHT
  );
};

export const isSpaceOccupied = (
  x: number,
  y: number,
  width: number,
  height: number,
  occupiedSpaces: Set<string>,
) => {
  const cellsX = Math.ceil(width / UNIT_SIZE);
  const cellsY = Math.ceil(height / UNIT_SIZE);

  for (let i = 0; i < cellsX; i++) {
    for (let j = 0; j < cellsY; j++) {
      const cellX = Math.floor((x + i * UNIT_SIZE) / UNIT_SIZE);
      const cellY = Math.floor((y + j * UNIT_SIZE) / UNIT_SIZE);
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
) => {
  const cellsX = Math.round(width / UNIT_SIZE);
  const cellsY = Math.round(height / UNIT_SIZE);

  for (let i = 0; i < cellsX; i++) {
    for (let j = 0; j < cellsY; j++) {
      const cellX = Math.round((x + i * UNIT_SIZE) / UNIT_SIZE);
      const cellY = Math.round((y + j * UNIT_SIZE) / UNIT_SIZE);
      occupiedSpaces.add(`${cellX},${cellY}`);
    }
  }
};

export const canPlaceImage = (
  x: number,
  y: number,
  imgInfo: ImageInfo,
  currentOccupiedSpaces: Set<string>,
) => {
  const cellsX = Math.round(imgInfo.displayWidth / UNIT_SIZE);
  const cellsY = Math.round(imgInfo.displayHeight / UNIT_SIZE);

  for (let i = 0; i < cellsX; i++) {
    for (let j = 0; j < cellsY; j++) {
      const cellX = Math.round((x + i * UNIT_SIZE) / UNIT_SIZE);
      const cellY = Math.round((y + j * UNIT_SIZE) / UNIT_SIZE);

      // Check if this cell is part of the home area
      if (isHomeArea(cellX * UNIT_SIZE, cellY * UNIT_SIZE)) {
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
) => {
  const candidates: ImageInfo[] = [];

  // Option 1: Try to place a "Create Token" square
  // Place a "Create Token" square every 6th available square position
  if (
    Math.abs(gridX * 13 + gridY * 17) % 6 === 0 && // Deterministic but sparse
    !isHomeArea(gridX * UNIT_SIZE, gridY * UNIT_SIZE) // Ensure it's not in home area
  ) {
    candidates.push({
      element: new Image(), // Placeholder, not used for rendering
      type: 'create-token',
      displayWidth: UNIT_SIZE,
      displayHeight: UNIT_SIZE,
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
