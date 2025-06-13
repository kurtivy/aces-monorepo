import { useState, useCallback, useRef } from 'react';
import { ImageInfo, ViewState } from '../../types/canvas'; // Adjusted path
import { isHomeArea } from '../../lib/canvas/grid-placement'; // Adjusted path
import { LuxuryLogger } from '../../lib/utils/luxury-logger'; // Adjusted path

interface UseCanvasInteractionsProps {
  viewState: ViewState;
  imagesRef: React.MutableRefObject<ImageInfo[]>; // Added this prop
  setSelectedImage: (image: ImageInfo | null) => void;
  imagePlacementMap: React.MutableRefObject<
    // Preserved this prop
    Map<string, { image: ImageInfo; x: number; y: number; width: number; height: number }>
  >;
  unitSize: number;
}

export const useCanvasInteractions = ({
  viewState,
  setSelectedImage,
  imagePlacementMap, // Destructure the preserved prop
  unitSize,
}: UseCanvasInteractionsProps) => {
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const homeAreaWidth = unitSize * 3;
  const homeAreaHeight = unitSize * 2;
  const homeAreaWorldX = -unitSize;
  const homeAreaWorldY = -unitSize;

  const handleClick = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

      const canvas = event.currentTarget as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();

      const worldX = (clientX - rect.left - viewState.x) / viewState.scale;
      const worldY = (clientY - rect.top - viewState.y) / viewState.scale;

      // Check for click within the Home Area
      if (
        isHomeArea(worldX, worldY, homeAreaWorldX, homeAreaWorldY, homeAreaWidth, homeAreaHeight)
      ) {
        LuxuryLogger.log(`Clicked home area at world: ${worldX}, ${worldY}`, 'info');

        // Logic to check for "CREATE" quadrant click
        const homeAreaX = homeAreaWorldX;
        const homeAreaY = homeAreaWorldY;
        const homeAreaWidthValue = homeAreaWidth;
        const homeAreaHeightValue = homeAreaHeight;

        const quadWidth = homeAreaWidthValue / 2;
        const quadHeight = homeAreaHeightValue / 2;

        const createQuadX = homeAreaX + quadWidth; // Top-right quadrant
        const createQuadY = homeAreaY;

        const aboutQuadX = homeAreaX; // Top-left quadrant
        const aboutQuadY = homeAreaY;

        if (
          worldX >= aboutQuadX &&
          worldX < aboutQuadX + quadWidth &&
          worldY >= aboutQuadY &&
          worldY < aboutQuadY + quadHeight
        ) {
          LuxuryLogger.log('About quadrant clicked! Opening docs.', 'info');
          window.open('https://docs.aces.fun/', '_blank');
          return;
        }

        if (
          worldX >= createQuadX &&
          worldX < createQuadX + quadWidth &&
          worldY >= createQuadY &&
          worldY < createQuadY + quadHeight
        ) {
          LuxuryLogger.log('CREATE quadrant clicked! Navigating to /create-token', 'info');
          window.location.href = '/create-token';
          return;
        }
        return; // Clicked home area but not CREATE quadrant
      }

      let clickedImageInfo: ImageInfo | null = null;

      // Iterate over the placed items to find the one that was clicked
      for (const placedItem of imagePlacementMap.current.values()) {
        const { image, x, y, width, height } = placedItem;

        if (worldX >= x && worldX <= x + width && worldY >= y && worldY <= y + height) {
          clickedImageInfo = image;
          break; // Found the clicked image
        }
      }

      if (clickedImageInfo) {
        if (clickedImageInfo.type === 'create-token') {
          LuxuryLogger.log(`Create Token Square clicked`, 'info');
          window.location.href = '/create-token';
        } else {
          setSelectedImage(clickedImageInfo);
          LuxuryLogger.log(`Product image clicked: ${clickedImageInfo.metadata.title}`, 'info');
        }
      }
    },
    [
      viewState,
      setSelectedImage,
      imagePlacementMap,
      homeAreaWorldX,
      homeAreaWorldY,
      homeAreaWidth,
      homeAreaHeight,
    ],
  );

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    setIsDragging(false);
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: Date.now(),
    };
    setLastMousePos({ x: event.clientX, y: event.clientY });
    setIsPanning(true);
  }, []);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isPanning) return;

      const deltaX = event.clientX - lastMousePos.x;
      const deltaY = event.clientY - lastMousePos.y;

      if (!isDragging && dragStartRef.current) {
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance > 5) {
          setIsDragging(true);
        }
      }

      viewState.targetX += deltaX;
      viewState.targetY += deltaY;

      setLastMousePos({ x: event.clientX, y: event.clientY });
    },
    [isPanning, isDragging, lastMousePos, viewState],
  );

  const handleMouseUp = useCallback(
    (event: React.MouseEvent) => {
      if (!isDragging && dragStartRef.current && Date.now() - dragStartRef.current.time < 200) {
        handleClick(event);
      }
      setIsPanning(false);
      setIsDragging(false);
      dragStartRef.current = null;
    },
    [handleClick, isDragging],
  );

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      setIsDragging(false);
      dragStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      setLastMousePos({ x: touch.clientX, y: touch.clientY });
      setIsPanning(true);
    }
  }, []);

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!isPanning || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const deltaX = touch.clientX - lastMousePos.x;
      const deltaY = touch.clientY - lastMousePos.y;

      if (!isDragging && dragStartRef.current) {
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance > 5) {
          setIsDragging(true);
        }
      }

      viewState.targetX += deltaX;
      viewState.targetY += deltaY;

      setLastMousePos({ x: touch.clientX, y: touch.clientY });
    },
    [isPanning, isDragging, lastMousePos, viewState],
  );

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      if (!isDragging && dragStartRef.current && Date.now() - dragStartRef.current.time < 200) {
        handleClick(event);
      }
      setIsPanning(false);
      setIsDragging(false);
      dragStartRef.current = null;
    },
    [handleClick, isDragging],
  );

  return {
    isPanning,
    isDragging,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
};
