interface PerformanceMetrics {
  frameTime: number;
  fps: number;
  drawCalls: number;
  elementCount: number;
}

class CanvasPerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private frameStart: number = 0;
  private frameCount: number = 0;
  private lastReport: number = 0;

  startFrame(): void {
    this.frameStart = performance.now();
  }

  endFrame(elementCount: number = 0): void {
    const frameTime = performance.now() - this.frameStart;
    const fps = 1000 / frameTime;

    this.metrics.push({
      frameTime,
      fps,
      drawCalls: this.frameCount,
      elementCount,
    });

    // Report every 60 frames (1 second at 60fps)
    if (this.frameCount % 60 === 0) {
      this.reportMetrics();
    }

    this.frameCount++;
  }

  private reportMetrics(): void {}

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  reset(): void {
    this.metrics = [];
    this.frameCount = 0;
  }
}

export const performanceMonitor = new CanvasPerformanceMonitor();
