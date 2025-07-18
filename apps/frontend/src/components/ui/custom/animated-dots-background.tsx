'use client';

import React, { useEffect, useRef } from 'react';
import { getDeviceCapabilities } from '../../../lib/utils/browser-utils';

interface AnimatedDotsBackgroundProps {
  className?: string;
  opacity?: number;
  dotSpacing?: number;
  dotSize?: number;
  animationSpeed?: number;
  waveType?: 'radial' | 'horizontal' | 'vertical' | 'diagonal';
  minOpacity?: number;
}

const AnimatedDotsBackground: React.FC<AnimatedDotsBackgroundProps> = ({
  className = '',
  opacity = 0.12,
  dotSpacing = 24,
  dotSize = 1,
  animationSpeed = 1.0,
  waveType = 'radial',
  minOpacity = 0.05,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const capabilities = getDeviceCapabilities();
    const isMobileDevice = capabilities.touchCapable || capabilities.isMobileSafari;
    const needsPerformanceMode = capabilities.performanceTier === 'low' || isMobileDevice;

    // Set canvas size to match container
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime;
      }

      const time = (currentTime - startTimeRef.current) * 0.001;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Draw dots with wave animation
      for (let dotX = 8; dotX < width - 8; dotX += dotSpacing) {
        for (let dotY = 8; dotY < height - 8; dotY += dotSpacing) {
          const baseOpacity = opacity;

          // For performance mode browsers, use static opacity
          if (needsPerformanceMode) {
            const staticOpacity = baseOpacity * 0.6;
            ctx.fillStyle = `rgba(255, 255, 255, ${staticOpacity})`;
          } else {
            let waveIntensity = 0;

            // Different wave patterns based on waveType with smoother calculations
            switch (waveType) {
              case 'horizontal':
                // Smoother horizontal wave with optimized frequency and easing
                waveIntensity =
                  Math.sin(dotX * 0.006 - time * animationSpeed * Math.PI) * 0.5 + 0.5;
                break;
              case 'vertical':
                // Smoother vertical wave with optimized frequency
                waveIntensity =
                  Math.sin(dotY * 0.006 - time * animationSpeed * Math.PI) * 0.5 + 0.5;
                break;
              case 'diagonal':
                // Smoother diagonal wave with optimized frequency
                waveIntensity =
                  Math.sin((dotX + dotY) * 0.004 - time * animationSpeed * Math.PI) * 0.5 + 0.5;
                break;
              case 'radial':
              default:
                // Enhanced radial wave effect with smoother calculations
                const waveDistance = Math.sqrt(dotX * dotX + dotY * dotY);
                const wavePhase = waveDistance * 0.003 - time * animationSpeed * Math.PI;
                waveIntensity = Math.sin(wavePhase) * 0.5 + 0.5;
                break;
            }

            // Enhanced secondary wave with better easing
            const smoothTime = time * 0.4;
            const secondaryWave =
              Math.sin(waveIntensity * Math.PI * 1.2 + smoothTime) * 0.15 + 0.85;

            // Enhanced easing function for even smoother transitions
            const easedIntensity =
              waveIntensity *
              waveIntensity *
              waveIntensity *
              (10 - 15 * waveIntensity + 6 * waveIntensity * waveIntensity); // Smootherstep

            // Combine waves with enhanced blending
            const combinedIntensity = easedIntensity * secondaryWave;
            const opacityRange = baseOpacity - minOpacity;
            const animatedOpacity = minOpacity + opacityRange * combinedIntensity;

            ctx.fillStyle = `rgba(255, 255, 255, ${animatedOpacity})`;
          }

          ctx.beginPath();
          ctx.arc(dotX, dotY, dotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [opacity, dotSpacing, dotSize, animationSpeed]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{
        width: '100%',
        height: '100%',
      }}
    />
  );
};

export default AnimatedDotsBackground;
