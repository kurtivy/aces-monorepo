'use client';

import { useRef, useEffect, useState } from 'react';
import { ImageInfo, ViewState } from '../../types/canvas'; // Adjusted path
import { drawImage, drawHomeArea } from '../../lib/canvas/canvas-renderer'; // Adjusted path
import {
  markSpaceOccupied,
  canPlaceImage,
  getImageCandidatesForPosition,
} from '../../lib/canvas/grid-placement'; // Adjusted path
import { UNIT_SIZE, HOME_AREA_WORLD_X, HOME_AREA_WORLD_Y } from '../../constants/canvas'; // Adjusted path
import { getDisplayDimensions } from '../../lib/canvas/image-type-utils'; // Adjusted path
import { useSpaceAnimation } from '../use-space-animation'; // Adjusted path
import { lerp, easeInOutCubic } from '../../lib/canvas/math-utils'; // Adjusted path

interface UseCanvasRendererProps {
  images: ImageInfo[];
  viewState: ViewState;
  imagesLoaded: boolean; // Added this prop
  onCreateTokenClick: () => void;
  imagePlacementMap: React.MutableRefObject<
    // Preserved this prop
    Map<string, { image: ImageInfo; x: number; y: number; width: number; height: number }>
  >;
}

export const useCanvasRenderer = ({
  images,
  viewState,
  imagesLoaded, // Destructure the new prop
  onCreateTokenClick,
  imagePlacementMap, // Destructure the preserved prop
}: UseCanvasRendererProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [hoveredTokenIndex, setHoveredTokenIndex] = useState<number | null>(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const logoImageRef = useRef<HTMLImageElement | null>(null);

  // State for hover animation
  const [currentHoverProgress, setCurrentHoverProgress] = useState(0);
  const hoverAnimationStartTime = useRef(0);
  const [isHoveringToken, setIsHoveringToken] = useState(false);
  const hoverAnimationDuration = 300; // 0.3 seconds for faster hover animation

  // Create a separate canvas for space animation
  const spaceCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Preload the logo image
  useEffect(() => {
    const logoImage = new Image();
    logoImage.src = '/aces-logo.png'; // Assuming user fixed this path
    logoImage.onload = () => {
      logoImageRef.current = logoImage;
    };
  }, []);

  // Initialize space canvas
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = UNIT_SIZE;
      canvas.height = UNIT_SIZE;
      spaceCanvasRef.current = canvas;
    }
  }, []);

  // Initialize space animation
  useSpaceAnimation(spaceCanvasRef, {
    starCount: 0, // Remove white stars as requested
    nebulaCount: 10, // Keep nebula count as is
    canvasWidth: UNIT_SIZE,
    canvasHeight: UNIT_SIZE,
  });

  // Handle mouse movement for hover detection
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mousePositionRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const handleClick = () => {
      if (hoveredTokenIndex !== null) {
        onCreateTokenClick();
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
    };
  }, [hoveredTokenIndex, onCreateTokenClick]);

  useEffect(() => {
    if (!imagesLoaded) return; // Added this condition

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };

    updateCanvasSize();

    const drawCreateTokenSquare = (
      x: number,
      y: number,
      hoverProgress: number, // Now accepts a progress value (0 to 1)
    ) => {
      const size = lerp(UNIT_SIZE, UNIT_SIZE * 1.05, hoverProgress); // Interpolate size
      const padding = (UNIT_SIZE - size) / 2;
      const centerX = x + UNIT_SIZE / 2;
      const centerY = y + UNIT_SIZE / 2;
      const cornerRadius = 8; // Slightly larger corner radius for a more premium look

      ctx.save();

      // Create clipping region for the background
      ctx.beginPath();
      ctx.roundRect(x + padding, y + padding, size, size, cornerRadius);
      ctx.clip();

      // Draw premium background - dark gradient with subtle texture
      const bgGradient = ctx.createLinearGradient(
        x + padding,
        y + padding,
        x + padding + size,
        y + padding + size,
      );
      bgGradient.addColorStop(0, '#1A1A1A');
      bgGradient.addColorStop(1, '#0A0A0A');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(x + padding, y + padding, size, size);

      // Draw space animation from the separate canvas with reduced opacity for a more subtle effect
      if (spaceCanvasRef.current) {
        ctx.globalAlpha = 0.7;
        ctx.drawImage(spaceCanvasRef.current, x + padding, y + padding, size, size);
        ctx.globalAlpha = 1.0;
      }

      // Draw subtle dot pattern for texture
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      const dotSpacing = 10;
      for (let dotX = x + padding; dotX < x + padding + size; dotX += dotSpacing) {
        for (let dotY = y + padding; dotY < y + padding + size; dotY += dotSpacing) {
          ctx.beginPath();
          ctx.arc(dotX, dotY, 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      // Draw inner glow effect
      const innerGlowSize = size - 4;
      const innerGlowPadding = (UNIT_SIZE - innerGlowSize) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(
        x + innerGlowPadding,
        y + innerGlowPadding,
        innerGlowSize,
        innerGlowSize,
        cornerRadius - 2,
      );
      ctx.clip();

      // Create radial gradient for inner glow
      const glowGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        size / 1.5,
      );
      glowGradient.addColorStop(0, `rgba(208, 178, 100, ${lerp(0.1, 0.25, hoverProgress)})`);
      glowGradient.addColorStop(0.7, 'rgba(208, 178, 100, 0.05)');
      glowGradient.addColorStop(1, 'rgba(208, 178, 100, 0)');

      ctx.fillStyle = glowGradient;
      ctx.fillRect(x + innerGlowPadding, y + innerGlowPadding, innerGlowSize, innerGlowSize);
      ctx.restore();

      // Draw premium multi-layered border
      // Layer 1: Outer glow
      ctx.shadowColor = `rgba(208, 178, 100, ${lerp(0.3, 0.8, hoverProgress)})`;
      ctx.shadowBlur = lerp(5, 20, hoverProgress);
      ctx.strokeStyle = `rgba(208, 178, 100, ${lerp(0.6, 0.9, hoverProgress)})`;
      ctx.lineWidth = lerp(1.5, 2.5, hoverProgress);
      ctx.beginPath();
      ctx.roundRect(x + padding, y + padding, size, size, cornerRadius);
      ctx.stroke();

      // Layer 2: Inner border with gradient
      ctx.shadowBlur = 0;
      const borderGradient = ctx.createLinearGradient(
        x + padding,
        y + padding,
        x + padding + size,
        y + padding + size,
      );
      borderGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      borderGradient.addColorStop(0.5, 'rgba(208, 178, 100, 0.8)');
      borderGradient.addColorStop(1, 'rgba(173, 142, 66, 0.9)');

      ctx.strokeStyle = borderGradient;
      ctx.lineWidth = lerp(1, 1.5, hoverProgress);
      ctx.beginPath();
      ctx.roundRect(x + padding + 1, y + padding + 1, size - 2, size - 2, cornerRadius - 1);
      ctx.stroke();

      // Draw logo in a more central position
      if (logoImageRef.current) {
        // Reduced logo size for better spacing
        const logoSize = lerp(UNIT_SIZE * 0.45, UNIT_SIZE * 0.55, hoverProgress);
        const logoX = centerX - logoSize / 2;
        // Center the logo vertically
        const logoY = centerY - logoSize / 2;

        // Draw logo glow
        ctx.save();
        ctx.shadowColor = `rgba(255, 255, 255, ${lerp(0.3, 0.7, hoverProgress)})`;
        ctx.shadowBlur = lerp(5, 15, hoverProgress);
        ctx.globalAlpha = lerp(0.85, 1, hoverProgress);
        ctx.drawImage(logoImageRef.current, logoX, logoY, logoSize, logoSize);
        ctx.restore();
      }

      // Draw premium text with enhanced styling
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // "CREATE TOKEN" as a more prominent title
      // Position it higher in the box for better spacing
      const createTokenFontSize = lerp(18, 22, hoverProgress); // Larger font size
      ctx.font = `bold ${createTokenFontSize}px 'Barlow Condensed'`; // Always bold for title prominence

      // Text glow effect
      ctx.shadowColor = `rgba(208, 178, 100, ${lerp(0.5, 0.9, hoverProgress)})`;
      ctx.shadowBlur = lerp(3, 10, hoverProgress); // Enhanced glow

      // Gold gradient for text with more contrast
      const textGradient = ctx.createLinearGradient(
        centerX - 70,
        y + UNIT_SIZE * 0.15,
        centerX + 70,
        y + UNIT_SIZE * 0.15,
      );
      textGradient.addColorStop(0, '#FFFFFF');
      textGradient.addColorStop(0.5, '#D0B264');
      textGradient.addColorStop(1, '#FFFFFF');

      ctx.fillStyle = textGradient;

      // Position title higher in the box
      ctx.fillText(
        'CREATE TOKEN',
        centerX,
        lerp(
          y + UNIT_SIZE * 0.18, // Higher position
          y + UNIT_SIZE * 0.16, // Even higher on hover
          hoverProgress,
        ),
      );

      // ADJUSTED: "COMING SOON" with more appropriate letter spacing
      const comingSoonFontSize = lerp(16, 18, hoverProgress); // Larger font size
      ctx.font = `bold ${comingSoonFontSize}px 'Barlow Condensed'`;

      // White color for "COMING SOON" with slight gold tint
      ctx.fillStyle = `rgba(255, 255, 255, ${lerp(0.8, 1.0, hoverProgress)})`;
      ctx.shadowBlur = lerp(2, 5, hoverProgress);
      ctx.shadowColor = 'rgba(208, 178, 100, 0.5)';

      // Position "COMING SOON" lower in the box
      const comingSoonY = lerp(
        y + UNIT_SIZE * 0.82, // Lower position
        y + UNIT_SIZE * 0.84, // Even lower on hover
        hoverProgress,
      );

      // Draw "COMING SOON" with adjusted letter spacing
      const comingSoonText = 'COMING SOON';

      // First, calculate the maximum width available for the text
      // Leave a safe margin from the edges (15% of the square size)
      const maxAvailableWidth = size * 0.85;

      // Measure the width of each character
      const charWidths = [];
      let totalNaturalWidth = 0;

      for (let i = 0; i < comingSoonText.length; i++) {
        const char = comingSoonText[i];
        const metrics = ctx.measureText(char);
        charWidths.push(metrics.width);
        totalNaturalWidth += metrics.width;
      }

      // Calculate the maximum possible tracking that will fit within the available width
      // Number of spaces between characters = number of characters - 1
      const numSpaces = comingSoonText.length - 1;
      const maxPossibleTracking = (maxAvailableWidth - totalNaturalWidth) / numSpaces;

      // Use a tracking value that's wide but guaranteed to fit
      // Start with a base tracking and cap it at the maximum possible
      const baseTracking = lerp(4, 6, hoverProgress); // Base desired tracking
      const safeTracking = Math.min(baseTracking, maxPossibleTracking * 0.9); // 90% of max possible for safety margin

      // Calculate total width with the safe tracking
      const totalSpacingWidth = numSpaces * safeTracking;
      const totalWidth = totalNaturalWidth + totalSpacingWidth;

      // Calculate starting position to center the text
      let currentX = centerX - totalWidth / 2;

      // Draw each character with proper spacing
      for (let i = 0; i < comingSoonText.length; i++) {
        const char = comingSoonText[i];
        ctx.fillText(char, currentX + charWidths[i] / 2, comingSoonY);
        currentX += charWidths[i] + safeTracking;
      }

      ctx.restore();

      // Add subtle shine effect on hover
      if (hoverProgress > 0.1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Create a diagonal shine effect
        const shineWidth = size * 0.7;
        const shineHeight = size * 2;
        const shineX = x + padding + size * lerp(-0.15, 0.25, hoverProgress * hoverProgress);
        const shineY = y + padding - size * 0.5;

        const shineGradient = ctx.createLinearGradient(
          shineX,
          shineY,
          shineX + shineWidth * 0.3,
          shineY + shineHeight,
        );
        shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        shineGradient.addColorStop(0.5, `rgba(255, 255, 255, ${hoverProgress * 0.03})`);
        shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = shineGradient;
        ctx.beginPath();
        ctx.moveTo(shineX, shineY);
        ctx.lineTo(shineX + shineWidth, shineY);
        ctx.lineTo(shineX + shineWidth * 0.7, shineY + shineHeight);
        ctx.lineTo(shineX - shineWidth * 0.3, shineY + shineHeight);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }
    };

    const draw = () => {
      ctx.fillStyle = '#231F20';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(viewState.x, viewState.y);
      ctx.scale(viewState.scale, viewState.scale);

      const invScale = 1 / viewState.scale;
      const buffer = 500;
      const canvasWidth = canvas.width / (window.devicePixelRatio || 1);
      const canvasHeight = canvas.height / (window.devicePixelRatio || 1);
      const visibleLeft = (-viewState.x - buffer) * invScale;
      const visibleTop = (-viewState.y - buffer) * invScale;
      const visibleRight = (-viewState.x + canvasWidth + buffer) * invScale;
      const visibleBottom = (-viewState.y + canvasHeight + buffer) * invScale;

      const gridStartX = Math.floor(visibleLeft / UNIT_SIZE) * UNIT_SIZE;
      const gridStartY = Math.floor(visibleTop / UNIT_SIZE) * UNIT_SIZE;
      const gridEndX = Math.ceil(visibleRight / UNIT_SIZE) * UNIT_SIZE;
      const gridEndY = Math.ceil(visibleBottom / UNIT_SIZE) * UNIT_SIZE;

      imagePlacementMap.current.clear();
      const occupiedSpaces = new Set<string>();
      const createTokenPositions: Array<{ worldX: number; worldY: number }> = [];

      // Mark home area as occupied
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
          const cellX = Math.floor((HOME_AREA_WORLD_X + i * UNIT_SIZE) / UNIT_SIZE);
          const cellY = Math.floor((HOME_AREA_WORLD_Y + j * UNIT_SIZE) / UNIT_SIZE);
          occupiedSpaces.add(`${cellX},${cellY}`);
        }
      }

      // Place images in a grid pattern
      for (let y = gridStartY; y < gridEndY; y += UNIT_SIZE) {
        for (let x = gridStartX; x < gridEndX; x += UNIT_SIZE) {
          const gridX = Math.floor(x / UNIT_SIZE);
          const gridY = Math.floor(y / UNIT_SIZE);

          if (occupiedSpaces.has(`${gridX},${gridY}`)) {
            continue;
          }

          let placed = false;
          const candidates = getImageCandidatesForPosition(gridX, gridY, images);

          for (const imageInfo of candidates) {
            const { width, height } = getDisplayDimensions(imageInfo.type);

            if (
              canPlaceImage(
                x,
                y,
                { ...imageInfo, displayWidth: width, displayHeight: height },
                occupiedSpaces,
              )
            ) {
              const placedItem = { image: imageInfo, x, y, width, height };
              imagePlacementMap.current.set(`${gridX},${gridY}`, placedItem);
              if (imageInfo.type === 'create-token') {
                createTokenPositions.push({ worldX: x, worldY: y });
              } else {
                drawImage(ctx, imageInfo.element, x, y, width, height);
              }
              markSpaceOccupied(x, y, width, height, occupiedSpaces);
              placed = true;
              break;
            }
          }

          if (!placed) {
            markSpaceOccupied(x, y, UNIT_SIZE, UNIT_SIZE, occupiedSpaces);
          }
        }
      }

      // Check for hover on create token squares
      let newHoveredIndex: number | null = null;
      const worldMouseX = (mousePositionRef.current.x - viewState.x) / viewState.scale;
      const worldMouseY = (mousePositionRef.current.y - viewState.y) / viewState.scale;

      createTokenPositions.forEach((pos, index) => {
        if (
          worldMouseX >= pos.worldX &&
          worldMouseX <= pos.worldX + UNIT_SIZE &&
          worldMouseY >= pos.worldY &&
          worldMouseY <= pos.worldY + UNIT_SIZE
        ) {
          newHoveredIndex = index;
          canvas.style.cursor = 'pointer';
        }
      });

      if (newHoveredIndex === null && hoveredTokenIndex !== null) {
        canvas.style.cursor = 'grab';
      }

      if (newHoveredIndex !== hoveredTokenIndex) {
        setHoveredTokenIndex(newHoveredIndex);
        setIsHoveringToken(newHoveredIndex !== null);
        hoverAnimationStartTime.current = performance.now();
      }

      // Update hover animation progress
      if (isHoveringToken || currentHoverProgress > 0) {
        const elapsed = performance.now() - hoverAnimationStartTime.current;
        let progress = Math.min(1, elapsed / hoverAnimationDuration);
        if (!isHoveringToken) {
          progress = 1 - progress; // Reverse for unhover
        }
        // Apply easing for smoother transition
        progress = easeInOutCubic(progress);
        setCurrentHoverProgress(progress);

        // If unhover animation is complete, stop animating
        if (!isHoveringToken && progress <= 0) {
          setCurrentHoverProgress(0);
        }
      }

      // Draw non-hovered create token squares first
      createTokenPositions.forEach((pos, index) => {
        const isCurrentlyHovered = index === hoveredTokenIndex;
        if (!isCurrentlyHovered) {
          drawCreateTokenSquare(pos.worldX, pos.worldY, 0); // Non-hovered state
        }
      });

      // Draw home area with logo
      drawHomeArea(
        ctx,
        HOME_AREA_WORLD_X,
        HOME_AREA_WORLD_Y,
        logoImageRef.current,
        worldMouseX,
        worldMouseY,
      );

      // Draw hovered create token squares AFTER the home area (so they appear on top)
      createTokenPositions.forEach((pos, index) => {
        const isCurrentlyHovered = index === hoveredTokenIndex;
        if (isCurrentlyHovered) {
          drawCreateTokenSquare(pos.worldX, pos.worldY, currentHoverProgress); // Hovered state
        }
      });

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    window.addEventListener('resize', updateCanvasSize);
    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    imagesLoaded, // Added this to dependencies
    images,
    viewState,
    hoveredTokenIndex,
    onCreateTokenClick,
    currentHoverProgress,
    isHoveringToken,
    imagePlacementMap,
  ]);

  return { canvasRef };
};
