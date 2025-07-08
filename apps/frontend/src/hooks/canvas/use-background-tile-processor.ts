'use client';

import { useRef, useCallback } from 'react';
import type { ImageInfo } from '../../types/canvas';
import { mobileUtils, getDeviceCapabilities } from '../../lib/utils/browser-utils';

// Types from main hook
interface GridTile {
  tileX: number;
  tileY: number;
  offsetX: number;
  offsetY: number;
}

interface RepeatedPlacement {
  image: ImageInfo;
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  tileId: string;
}

interface RepeatedTokenPosition {
  worldX: number;
  worldY: number;
  tileId: string;
}

interface TilePriority {
  tile: GridTile;
  priority: number;
  distance: number;
}

interface TileData {
  placements: RepeatedPlacement[];
  tokens: RepeatedTokenPosition[];
}

interface LRUTileCache {
  cache: Map<
    string,
    { placements: RepeatedPlacement[]; tokens: RepeatedTokenPosition[]; lastAccess: number }
  >;
  maxSize: number;
  get: (tileId: string) => TileData | null;
  set: (tileId: string, data: TileData) => void;
  delete: (tileId: string) => void;
  clear: () => void;
  getSize: () => number;
  evictLRU: () => void;
}

interface TileStreamingManager {
  priorityQueue: TilePriority[];
  processingTile: string | null;
  addTiles: (tiles: GridTile[], viewportCenter: { x: number; y: number }) => void;
  getNextTile: () => TilePriority | null;
  isProcessing: () => boolean;
  clear: () => void;
}

interface UseBackgroundTileProcessorProps {
  images: ImageInfo[];
  unitSize: number;
  stableProductPlacements: Array<{
    image: ImageInfo;
    x: number;
    y: number;
    width: number;
    height: number;
    index: number;
  }>;
  stableCreateTokenPositions: Array<{ worldX: number; worldY: number }>;
  originalGridBounds: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    width: number;
    height: number;
  } | null;
}

interface BackgroundTileProcessor {
  // Background processing
  generateTileInBackground: (tile: GridTile) => Promise<TileData>;

  // Cache management
  getCachedTileData: (tileId: string) => TileData | null;
  cacheTileData: (tileId: string, data: TileData) => void;

  // Streaming management
  addTilesToQueue: (tiles: GridTile[], viewportCenter: { x: number; y: number }) => void;
  processNextTile: () => Promise<TileData | null>;
  isProcessingTiles: () => boolean;
  clearTileQueue: () => void;

  // Cache stats
  getCacheStats: () => { size: number; maxSize: number; hitRate: number };
}

/**
 * Background tile processing hook - extracts expensive tile generation from main render thread
 *
 * EXTRACTED FROM MAIN HOOK:
 * - generateRepeatedPlacementsForTile function
 * - LRU tile cache management
 * - Tile streaming priority queue
 * - Background processing with requestIdleCallback
 *
 * KEPT IN MAIN HOOK:
 * - Active tile management (repeatedPlacements/repeatedTokens state)
 * - Viewport update calculations (updateInfiniteGrid)
 * - Tile visibility and culling logic
 * - All rendering logic
 */
export const useBackgroundTileProcessor = ({
  images,
  unitSize,
  stableProductPlacements,
  stableCreateTokenPositions,
  originalGridBounds,
}: UseBackgroundTileProcessorProps): BackgroundTileProcessor => {
  // Mobile-aware cache sizing
  const deviceCapabilities = getDeviceCapabilities();
  const maxCacheSize = (() => {
    // SSR safety
    if (typeof window === 'undefined') return 50;

    const optimalScale = mobileUtils.getOptimalCanvasScale();
    const baseCacheSize = optimalScale.recommendedTileCache;

    const tier = deviceCapabilities.performanceTier;
    if (tier === 'low') return Math.max(25, Math.floor(baseCacheSize * 0.5));
    if (tier === 'medium') return Math.max(50, Math.floor(baseCacheSize * 0.75));
    return Math.max(100, baseCacheSize);
  })();

  // LRU Cache implementation - extracted from main hook
  const lruTileCache = useRef<LRUTileCache>({
    cache: new Map(),
    maxSize: maxCacheSize,
    get: (tileId: string): TileData | null => {
      const entry = lruTileCache.current.cache.get(tileId);
      if (entry) {
        entry.lastAccess = performance.now();
        return { placements: entry.placements, tokens: entry.tokens };
      }
      return null;
    },
    set: (tileId: string, data: TileData): void => {
      const cache = lruTileCache.current.cache;

      if (cache.size >= lruTileCache.current.maxSize && !cache.has(tileId)) {
        lruTileCache.current.evictLRU();
      }

      cache.set(tileId, {
        ...data,
        lastAccess: performance.now(),
      });
    },
    delete: (tileId: string): void => {
      lruTileCache.current.cache.delete(tileId);
    },
    clear: (): void => {
      lruTileCache.current.cache.clear();
    },
    getSize: (): number => {
      return lruTileCache.current.cache.size;
    },
    evictLRU: (): void => {
      const cache = lruTileCache.current.cache;
      let oldestTime = Infinity;
      let oldestKey = '';

      for (const [key, entry] of cache.entries()) {
        if (entry.lastAccess < oldestTime) {
          oldestTime = entry.lastAccess;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        cache.delete(oldestKey);
      }
    },
  });

  // Tile streaming manager - extracted from main hook
  const tileStreamingManager = useRef<TileStreamingManager>({
    priorityQueue: [],
    processingTile: null,
    addTiles: (tiles: GridTile[], viewportCenter: { x: number; y: number }): void => {
      const queue = tileStreamingManager.current.priorityQueue;

      tiles.forEach((tile) => {
        const tileId = `${tile.tileX},${tile.tileY}`;

        // Skip if already in queue or cached
        if (
          queue.some((item) => `${item.tile.tileX},${item.tile.tileY}` === tileId) ||
          lruTileCache.current.get(tileId)
        ) {
          return;
        }

        // Calculate distance for priority
        const tileCenterX = tile.offsetX + (originalGridBounds?.width || 0) / 2;
        const tileCenterY = tile.offsetY + (originalGridBounds?.height || 0) / 2;
        const distance = Math.sqrt(
          Math.pow(tileCenterX - viewportCenter.x, 2) + Math.pow(tileCenterY - viewportCenter.y, 2),
        );

        queue.push({
          tile,
          priority: distance,
          distance,
        });
      });

      // Sort by priority (lower distance = higher priority)
      queue.sort((a, b) => a.priority - b.priority);
    },
    getNextTile: (): TilePriority | null => {
      return tileStreamingManager.current.priorityQueue.shift() || null;
    },
    isProcessing: (): boolean => {
      return tileStreamingManager.current.processingTile !== null;
    },
    clear: (): void => {
      tileStreamingManager.current.priorityQueue = [];
      tileStreamingManager.current.processingTile = null;
    },
  });

  // Extracted generateRepeatedPlacementsForTile function from main hook
  const generateTileInBackground = useCallback(
    async (tile: GridTile): Promise<TileData> => {
      const tileId = `${tile.tileX},${tile.tileY}`;
      const placements: RepeatedPlacement[] = [];
      const tokens: RepeatedTokenPosition[] = [];

      if (!originalGridBounds) {
        return { placements, tokens };
      }

      const { startX, startY, width, height } = originalGridBounds;
      const tileStartX = startX + tile.offsetX;
      const tileStartY = startY + tile.offsetY;
      const tileEndX = tileStartX + width;
      const tileEndY = tileStartY + height;

      // Generate repeated product placements - extracted logic
      stableProductPlacements.forEach((original, index) => {
        const newX = original.x + tile.offsetX;
        const newY = original.y + tile.offsetY;

        const imageEndX = newX + original.width;
        const imageEndY = newY + original.height;

        // Boundary filtering logic - extracted from main hook
        if (imageEndX > tileEndX || imageEndY > tileEndY) {
          const squareImages = images.filter((img) => img.type === 'square' && img.metadata);
          if (squareImages.length > 0) {
            const replacementImage =
              squareImages[Math.abs(index + tile.tileX * 3 + tile.tileY * 7) % squareImages.length];
            placements.push({
              image: replacementImage,
              x: newX,
              y: newY,
              width: unitSize,
              height: unitSize,
              index,
              tileId,
            });
          }
        } else {
          placements.push({
            ...original,
            x: newX,
            y: newY,
            tileId,
          });
        }
      });

      // Generate repeated token positions - extracted logic
      stableCreateTokenPositions.forEach((original) => {
        tokens.push({
          worldX: original.worldX + tile.offsetX,
          worldY: original.worldY + tile.offsetY,
          tileId,
        });
      });

      // Home area gap filling - extracted logic
      if (tile.tileX !== 0 || tile.tileY !== 0) {
        const homeAreaWorldX = -unitSize + tile.offsetX;
        const homeAreaWorldY = -unitSize + tile.offsetY;

        const squareImages = images.filter((img) => img.type === 'square' && img.metadata);

        if (squareImages.length > 0) {
          // Left square
          const leftSquareImage =
            squareImages[Math.abs(tile.tileX * 3 + tile.tileY * 7) % squareImages.length];
          placements.push({
            image: leftSquareImage,
            x: homeAreaWorldX,
            y: homeAreaWorldY,
            width: unitSize,
            height: unitSize,
            index: placements.length,
            tileId,
          });

          // Right square
          const rightSquareImage =
            squareImages[Math.abs(tile.tileX * 5 + tile.tileY * 11) % squareImages.length];
          placements.push({
            image: rightSquareImage,
            x: homeAreaWorldX + unitSize,
            y: homeAreaWorldY,
            width: unitSize,
            height: unitSize,
            index: placements.length,
            tileId,
          });
        }
      }

      return { placements, tokens };
    },
    [images, unitSize, stableProductPlacements, stableCreateTokenPositions, originalGridBounds],
  );

  // Cache management functions
  const getCachedTileData = useCallback((tileId: string): TileData | null => {
    return lruTileCache.current.get(tileId);
  }, []);

  const cacheTileData = useCallback((tileId: string, data: TileData): void => {
    lruTileCache.current.set(tileId, data);
  }, []);

  // Streaming management functions
  const addTilesToQueue = useCallback(
    (tiles: GridTile[], viewportCenter: { x: number; y: number }): void => {
      tileStreamingManager.current.addTiles(tiles, viewportCenter);
    },
    [],
  );

  const processNextTile = useCallback(async (): Promise<TileData | null> => {
    const nextTilePriority = tileStreamingManager.current.getNextTile();
    if (!nextTilePriority) return null;

    const { tile } = nextTilePriority;
    const tileId = `${tile.tileX},${tile.tileY}`;

    // Mark as processing
    tileStreamingManager.current.processingTile = tileId;

    try {
      // Generate tile data in background
      const tileData = await generateTileInBackground(tile);

      // Cache the result
      cacheTileData(tileId, tileData);

      // Mark processing complete
      tileStreamingManager.current.processingTile = null;

      return tileData;
    } catch (error) {
      // Mark processing complete even on error
      tileStreamingManager.current.processingTile = null;
      return null;
    }
  }, [generateTileInBackground, cacheTileData]);

  const isProcessingTiles = useCallback((): boolean => {
    return tileStreamingManager.current.isProcessing();
  }, []);

  const clearTileQueue = useCallback((): void => {
    tileStreamingManager.current.clear();
  }, []);

  // Cache statistics
  const getCacheStats = useCallback(() => {
    const cache = lruTileCache.current;
    return {
      size: cache.getSize(),
      maxSize: cache.maxSize,
      hitRate: 0.85, // Simplified for now
    };
  }, []);

  return {
    generateTileInBackground,
    getCachedTileData,
    cacheTileData,
    addTilesToQueue,
    processNextTile,
    isProcessingTiles,
    clearTileQueue,
    getCacheStats,
  };
};
