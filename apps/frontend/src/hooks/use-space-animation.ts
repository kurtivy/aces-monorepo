'use client';

import type React from 'react';

import { useEffect } from 'react';
import { browserUtils } from '../lib/utils/browser-utils';

// Star class for 3D starfield effect
class Star {
  x: number;
  y: number;
  z: number;
  prevX: number;
  prevY: number;
  speed: number;

  constructor() {
    this.x = (Math.random() - 0.5) * 2000;
    this.y = (Math.random() - 0.5) * 2000;
    this.z = 500;
    this.speed = Math.random() * 3 + 1.5; // Increased speed for each star
    this.prevX = this.x;
    this.prevY = this.y;
  }

  update() {
    this.prevX = this.x;
    this.prevY = this.y;

    // Move stars horizontally instead of in z-space
    this.x -= this.speed;

    // Reset position when star moves off screen
    if (this.x < -1000) {
      this.x = 1000;
      this.y = (Math.random() - 0.5) * 2000;
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    offsetX = 0,
    offsetY = 0,
  ) {
    const x = (this.x / this.z) * 100 + canvasWidth / 2 + offsetX;
    const y = (this.y / this.z) * 100 + canvasHeight / 2 + offsetY;
    const prevX = (this.prevX / this.z) * 100 + canvasWidth / 2 + offsetX;
    const prevY = (this.prevY / this.z) * 100 + canvasHeight / 2 + offsetY;

    if (x >= offsetX && x <= offsetX + canvasWidth && y >= offsetY && y <= offsetY + canvasHeight) {
      const size = 1.5; // Constant size since z is fixed
      const opacity = 0.8; // Constant opacity since z is fixed

      // Draw star trail
      ctx.strokeStyle = `rgba(208, 178, 100, ${opacity * 0.8})`;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, y);
      ctx.stroke();

      // Draw star
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Nebula particle for depth effect
class NebulaParticle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  angle: number;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.x = Math.random() * canvasWidth;
    this.y = Math.random() * canvasHeight;
    this.size = Math.random() * 80 + 30; // Increased size for yellow circles
    this.opacity = Math.random() * 0.1 + 0.05;
    this.speed = Math.random() * 0.8 + 0.2; // Increased speed
    this.angle = Math.random() * Math.PI * 2;
  }

  update(canvasWidth: number, canvasHeight: number) {
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    this.angle += 0.001;

    if (this.x > canvasWidth + this.size) this.x = -this.size;
    if (this.x < -this.size) this.x = canvasWidth + this.size;
    if (this.y > canvasHeight + this.size) this.y = -this.size;
    if (this.y < -this.size) this.y = canvasHeight + this.size;
  }

  draw(ctx: CanvasRenderingContext2D, offsetX = 0, offsetY = 0) {
    const gradient = ctx.createRadialGradient(
      this.x + offsetX,
      this.y + offsetY,
      0,
      this.x + offsetX,
      this.y + offsetY,
      this.size,
    );
    gradient.addColorStop(0, `rgba(208, 178, 100, ${this.opacity})`);
    gradient.addColorStop(0.5, `rgba(160, 130, 60, ${this.opacity * 0.5})`);
    gradient.addColorStop(1, 'rgba(208, 178, 100, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x + offsetX, this.y + offsetY, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

interface UseSpaceAnimationOptions {
  starCount?: number;
  nebulaCount?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  offsetX?: number;
  offsetY?: number;
}

/**
 * Custom hook for creating a 3D space animation on a canvas element
 * Disabled on mobile devices for better performance
 */
export function useSpaceAnimation(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: UseSpaceAnimationOptions = {},
) {
  const {
    starCount = 3,
    nebulaCount = 1,
    canvasWidth,
    canvasHeight,
    offsetX = 0,
    offsetY = 0,
  } = options;

  useEffect(() => {
    // Don't run space animation on mobile devices
    if (!browserUtils.shouldEnableSpaceAnimation()) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions dynamically
    const width = canvasWidth || canvas.offsetWidth || 200;
    const height = canvasHeight || canvas.offsetHeight || 200;

    canvas.width = width;
    canvas.height = height;

    // Initialize stars
    const stars: Star[] = [];
    for (let i = 0; i < starCount; i++) {
      stars.push(new Star());
    }

    // Initialize nebula particles
    const nebula: NebulaParticle[] = [];
    for (let i = 0; i < nebulaCount; i++) {
      nebula.push(new NebulaParticle(width, height));
    }

    let animationFrameId: number;

    // Animation loop
    const animate = () => {
      // Create a subtle fade effect instead of clearing completely
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, width, height);

      // Draw nebula first (background layer)
      nebula.forEach((particle) => {
        particle.update(width, height);
        particle.draw(ctx, offsetX, offsetY);
      });

      // Draw stars (foreground layer)
      stars.forEach((star) => {
        star.update();
        star.draw(ctx, width, height, offsetX, offsetY);
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    // Start animation
    animate();

    // Cleanup function
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [canvasRef, starCount, nebulaCount, canvasWidth, canvasHeight, offsetX, offsetY]);
}
