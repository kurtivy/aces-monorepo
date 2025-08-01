import type {
  CanvasConfiguration,
  PerformanceMetrics,
  DeviceCapabilities,
} from '../../types/capabilities';
import { CapabilityFeatureFlagManager } from '../utils/feature-flags';

/**
 * Adaptive Quality Management System
 * Week 4: Real-time quality adjustments based on performance monitoring
 *
 * This system continuously monitors performance and automatically adjusts
 * rendering quality to maintain target frame rates and smooth user experience.
 */
export class AdaptiveQualityManager {
  private currentConfiguration: CanvasConfiguration;
  private baseConfiguration: CanvasConfiguration;
  private performanceHistory: PerformanceMetrics[] = [];
  private adjustmentHistory: QualityAdjustment[] = [];
  private monitoringId: string;
  private isMonitoring = false;
  private monitoringInterval: number | null = null;

  constructor(baseConfiguration: CanvasConfiguration) {
    this.baseConfiguration = { ...baseConfiguration };
    this.currentConfiguration = { ...baseConfiguration };
    this.monitoringId = Math.random().toString(36).slice(2);
  }

  /**
   * Start adaptive quality monitoring
   */
  startMonitoring(deviceCapabilities: DeviceCapabilities): void {
    if (this.isMonitoring) return;

    if (!CapabilityFeatureFlagManager.isEnabled('adaptiveQuality')) {
      if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
        console.log('📊 Adaptive quality disabled by feature flag');
      }
      return;
    }

    this.isMonitoring = true;

    if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
      console.log(`📊 Starting adaptive quality monitoring (${this.monitoringId})`);
    }

    // Monitor performance based on device capabilities
    const monitoringInterval = this.getMonitoringInterval(deviceCapabilities);

    this.monitoringInterval = window.setInterval(() => {
      this.collectPerformanceMetrics();
      this.analyzeAndAdjust();
    }, monitoringInterval);
  }

  /**
   * Stop adaptive quality monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
      console.log(`📊 Stopped adaptive quality monitoring (${this.monitoringId})`);
    }
  }

  /**
   * Get current optimized configuration
   */
  getCurrentConfiguration(): CanvasConfiguration {
    return { ...this.currentConfiguration };
  }

  /**
   * Force quality adjustment based on external metrics
   */
  adjustQuality(metrics: PerformanceMetrics): CanvasConfiguration {
    this.performanceHistory.push(metrics);

    // Step 1: Check for browser override opportunities (Modern Safari approach)
    this.checkBrowserOverrideOpportunities();

    // Step 2: Standard adaptive quality analysis
    this.analyzeAndAdjust();

    return this.getCurrentConfiguration();
  }

  /**
   * Check if device performance exceeds browser-specific limitations
   * and override conservative browser settings (e.g., Safari frame rate caps)
   */
  private checkBrowserOverrideOpportunities(): void {
    // Skip if we don't have enough performance history
    if (this.performanceHistory.length < 5) return;

    const recentMetrics = this.performanceHistory.slice(-5);
    const avgFrameRate =
      recentMetrics.reduce((sum, m) => sum + m.frameRate, 0) / recentMetrics.length;
    const frameRateStable = this.calculateVariance(recentMetrics.map((m) => m.frameRate)) < 5; // Low variance = stable
    const memoryPressureLow = recentMetrics.every((m) => m.memoryUsage.pressure !== 'high');

    // Device is performing well and stable
    const devicePerformingWell =
      avgFrameRate >= this.currentConfiguration.targetFrameRate * 0.9 &&
      frameRateStable &&
      memoryPressureLow;

    if (devicePerformingWell) {
      // Override conservative browser limitations
      this.applyBrowserOverrides(avgFrameRate);
    }

    if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
      console.log('🔍 Browser override check:', {
        avgFrameRate,
        frameRateStable,
        memoryPressureLow,
        devicePerformingWell,
        currentTargetFPS: this.currentConfiguration.targetFrameRate,
      });
    }
  }

  /**
   * Apply performance overrides when device exceeds browser expectations
   */
  private applyBrowserOverrides(currentFrameRate: number): void {
    let overrideApplied = false;

    // Modern Safari override: If Safari is hitting 45fps consistently, try 60fps
    if (this.currentConfiguration.targetFrameRate <= 45 && currentFrameRate >= 42) {
      this.currentConfiguration.targetFrameRate = Math.min(
        60,
        this.baseConfiguration.targetFrameRate,
      );
      overrideApplied = true;
    }

    // Mobile override: If mobile Safari is hitting 30fps consistently, try 45fps
    if (this.currentConfiguration.targetFrameRate <= 30 && currentFrameRate >= 28) {
      this.currentConfiguration.targetFrameRate = Math.min(
        45,
        this.baseConfiguration.targetFrameRate,
      );
      overrideApplied = true;
    }

    // Quality override: If performance is good, restore quality settings
    if (currentFrameRate >= this.currentConfiguration.targetFrameRate * 0.95) {
      // Restore image smoothing if it was disabled for performance
      if (
        !this.currentConfiguration.enableImageSmoothing &&
        this.baseConfiguration.enableImageSmoothing
      ) {
        this.currentConfiguration.enableImageSmoothing = true;
        overrideApplied = true;
      }

      // Restore antialiasing if it was disabled for performance
      if (
        !this.currentConfiguration.enableAntialiasing &&
        this.baseConfiguration.enableAntialiasing
      ) {
        this.currentConfiguration.enableAntialiasing = true;
        overrideApplied = true;
      }

      // Increase image quality if it was reduced
      if (this.currentConfiguration.imageQuality < this.baseConfiguration.imageQuality) {
        this.currentConfiguration.imageQuality = Math.min(
          this.currentConfiguration.imageQuality + 0.1,
          this.baseConfiguration.imageQuality,
        );
        overrideApplied = true;
      }
    }

    if (overrideApplied && CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
      console.log('🚀 Browser override applied - device exceeds expectations:', {
        newTargetFPS: this.currentConfiguration.targetFrameRate,
        imageSmoothing: this.currentConfiguration.enableImageSmoothing,
        antialiasing: this.currentConfiguration.enableAntialiasing,
        imageQuality: this.currentConfiguration.imageQuality,
      });
    }
  }

  /**
   * Reset to base configuration
   */
  resetToBaseConfiguration(): void {
    this.currentConfiguration = { ...this.baseConfiguration };
    this.performanceHistory = [];
    this.adjustmentHistory = [];

    if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
      console.log('🔄 Reset adaptive quality to base configuration');
    }
  }

  /**
   * Get monitoring interval based on device capabilities
   */
  private getMonitoringInterval(capabilities: DeviceCapabilities): number {
    // Mobile devices: less frequent monitoring to save battery
    if (capabilities.touchCapable) {
      return capabilities.performanceTier === 'high' ? 2000 : 3000; // 2-3 seconds
    }

    // Desktop: more frequent monitoring for responsive adjustments
    return capabilities.performanceTier === 'high' ? 1000 : 1500; // 1-1.5 seconds
  }

  /**
   * Collect current performance metrics
   */
  private collectPerformanceMetrics(): void {
    try {
      const metrics: PerformanceMetrics = {
        frameRate: this.measureCurrentFrameRate(),
        memoryUsage: this.measureMemoryUsage(),
        gpuMetrics: this.measureGPUMetrics(),
        performanceTier: this.assessCurrentPerformanceTier(),
        timestamp: Date.now(),
      };

      this.performanceHistory.push(metrics);

      // Keep only last 10 measurements
      if (this.performanceHistory.length > 10) {
        this.performanceHistory.shift();
      }

      if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
        console.log('📊 Performance metrics collected:', metrics);
      }
    } catch (error) {
      console.warn('Failed to collect performance metrics:', error);
    }
  }

  /**
   * Measure current frame rate
   */
  private measureCurrentFrameRate(): number {
    // Return last known frame rate from history or target frame rate
    // Real frame rate measurement would be more complex and require continuous monitoring
    const recentMetric = this.performanceHistory[this.performanceHistory.length - 1];
    return recentMetric?.frameRate || this.currentConfiguration.targetFrameRate;
  }

  /**
   * Measure memory usage
   */
  private measureMemoryUsage(): PerformanceMetrics['memoryUsage'] {
    try {
      // @ts-expect-error - performance.memory is Chrome-specific
      if (performance.memory) {
        // @ts-expect-error - performance.memory properties
        const memory = performance.memory;
        return {
          available: this.currentConfiguration.canvasMemoryBudgetMB,
          allocated: Math.round(memory.usedJSHeapSize / (1024 * 1024)),
          pressure: this.calculateMemoryPressure(memory),
        };
      }
    } catch (error) {
      // Silent fail for browsers without memory API
    }

    // Fallback metrics
    return {
      available: this.currentConfiguration.canvasMemoryBudgetMB,
      allocated: this.currentConfiguration.canvasMemoryBudgetMB * 0.7, // Assume 70% usage
      pressure: 'medium',
    };
  }

  /**
   * Calculate memory pressure from memory info
   */
  private calculateMemoryPressure(memory: {
    usedJSHeapSize: number;
    jsHeapSizeLimit: number;
  }): 'low' | 'medium' | 'high' {
    const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

    if (usageRatio > 0.85) return 'high';
    if (usageRatio > 0.65) return 'medium';
    return 'low';
  }

  /**
   * Measure GPU metrics
   */
  private measureGPUMetrics(): PerformanceMetrics['gpuMetrics'] {
    // Simplified GPU metrics - in a real implementation, this would be more sophisticated
    return {
      memory: this.currentConfiguration.canvasMemoryBudgetMB * 0.6, // Estimate
      maxTextureSize: this.currentConfiguration.maxTextureSize,
      webgl2Support: this.currentConfiguration.enableGPUAcceleration,
    };
  }

  /**
   * Assess current performance tier based on metrics
   */
  private assessCurrentPerformanceTier(): string {
    const recent = this.performanceHistory.slice(-3); // Last 3 measurements

    if (recent.length === 0) return 'medium';

    const avgFrameRate = recent.reduce((sum, m) => sum + m.frameRate, 0) / recent.length;
    const avgMemoryPressure =
      recent.filter((m) => m.memoryUsage.pressure === 'high').length / recent.length;

    if (avgFrameRate >= 55 && avgMemoryPressure < 0.3) return 'high';
    if (avgFrameRate >= 35 && avgMemoryPressure < 0.7) return 'medium';
    return 'low';
  }

  /**
   * Analyze performance and adjust quality accordingly
   */
  private analyzeAndAdjust(): void {
    if (this.performanceHistory.length < 3) return; // Need at least 3 measurements

    const analysis = this.analyzePerformanceTrend();
    const adjustment = this.determineQualityAdjustment(analysis);

    if (adjustment.shouldAdjust) {
      this.applyQualityAdjustment(adjustment);
    }
  }

  /**
   * Analyze performance trend from recent metrics
   */
  private analyzePerformanceTrend(): PerformanceAnalysis {
    const recent = this.performanceHistory.slice(-5); // Last 5 measurements
    const target = this.currentConfiguration.targetFrameRate;

    const avgFrameRate = recent.reduce((sum, m) => sum + m.frameRate, 0) / recent.length;
    const frameRateVariance = this.calculateVariance(recent.map((m) => m.frameRate));
    const memoryPressureHigh = recent.filter((m) => m.memoryUsage.pressure === 'high').length;

    return {
      avgFrameRate,
      frameRateVariance,
      isUnderperforming: avgFrameRate < target * 0.8, // 80% of target
      isOverperforming: avgFrameRate > target * 1.1 && frameRateVariance < 5, // 110% of target with low variance
      highMemoryPressure: memoryPressureHigh >= 2, // 2 or more high pressure readings
      trend: this.calculateFrameRateTrend(recent),
    };
  }

  /**
   * Calculate variance of an array of numbers
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

    return Math.sqrt(variance);
  }

  /**
   * Calculate frame rate trend (positive = improving, negative = degrading)
   */
  private calculateFrameRateTrend(metrics: PerformanceMetrics[]): number {
    if (metrics.length < 2) return 0;

    const first = metrics[0].frameRate;
    const last = metrics[metrics.length - 1].frameRate;

    return last - first;
  }

  /**
   * Determine what quality adjustment to make
   */
  private determineQualityAdjustment(analysis: PerformanceAnalysis): QualityAdjustment {
    const shouldAdjust =
      analysis.isUnderperforming || analysis.isOverperforming || analysis.highMemoryPressure;

    if (!shouldAdjust) {
      return { shouldAdjust: false, type: 'none', reason: 'Performance stable' };
    }

    // Prioritize performance issues
    if (analysis.isUnderperforming || analysis.highMemoryPressure) {
      return {
        shouldAdjust: true,
        type: 'decrease',
        reason: analysis.isUnderperforming ? 'Low frame rate' : 'High memory pressure',
        severity:
          analysis.avgFrameRate < this.currentConfiguration.targetFrameRate * 0.6
            ? 'high'
            : 'medium',
      };
    }

    // Consider quality improvements only if stable for a while
    if (analysis.isOverperforming && this.adjustmentHistory.length > 0) {
      const lastAdjustment = this.adjustmentHistory[this.adjustmentHistory.length - 1];
      const timeSinceLastAdjustment = Date.now() - (lastAdjustment.timestamp || 0);

      // Wait at least 30 seconds before improving quality
      if (timeSinceLastAdjustment > 30000) {
        return {
          shouldAdjust: true,
          type: 'increase',
          reason: 'Performance headroom available',
          severity: 'low',
        };
      }
    }

    return { shouldAdjust: false, type: 'none', reason: 'No adjustment needed' };
  }

  /**
   * Apply quality adjustment to configuration
   */
  private applyQualityAdjustment(adjustment: QualityAdjustment): void {
    const oldConfig = { ...this.currentConfiguration };

    if (adjustment.type === 'decrease') {
      this.decreaseQuality(adjustment.severity || 'medium');
    } else if (adjustment.type === 'increase') {
      this.increaseQuality();
    }

    // Record the adjustment
    this.adjustmentHistory.push({
      ...adjustment,
      timestamp: Date.now(),
      oldConfiguration: oldConfig,
      newConfiguration: { ...this.currentConfiguration },
    });

    // Keep only last 20 adjustments
    if (this.adjustmentHistory.length > 20) {
      this.adjustmentHistory.shift();
    }

    if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
      console.log(`📊 Quality adjusted: ${adjustment.type} (${adjustment.reason})`, {
        oldConfig: oldConfig,
        newConfig: this.currentConfiguration,
      });
    }
  }

  /**
   * Decrease rendering quality
   */
  private decreaseQuality(severity: 'low' | 'medium' | 'high'): void {
    switch (severity) {
      case 'high':
        // Aggressive quality reduction
        this.currentConfiguration.imageQuality = Math.max(
          0.5,
          this.currentConfiguration.imageQuality - 0.2,
        );
        this.currentConfiguration.targetFrameRate = Math.max(
          20,
          this.currentConfiguration.targetFrameRate - 10,
        );
        this.currentConfiguration.enableImageSmoothing = false;
        this.currentConfiguration.enableAntialiasing = false;
        this.currentConfiguration.maxBatchSize = Math.max(
          5,
          this.currentConfiguration.maxBatchSize - 10,
        );
        break;

      case 'medium':
        // Moderate quality reduction
        this.currentConfiguration.imageQuality = Math.max(
          0.6,
          this.currentConfiguration.imageQuality - 0.1,
        );
        this.currentConfiguration.targetFrameRate = Math.max(
          25,
          this.currentConfiguration.targetFrameRate - 5,
        );
        this.currentConfiguration.maxBatchSize = Math.max(
          8,
          this.currentConfiguration.maxBatchSize - 5,
        );
        break;

      case 'low':
        // Minor quality reduction
        this.currentConfiguration.imageQuality = Math.max(
          0.7,
          this.currentConfiguration.imageQuality - 0.05,
        );
        this.currentConfiguration.cullBufferMultiplier = Math.min(
          3.0,
          this.currentConfiguration.cullBufferMultiplier + 0.2,
        );
        break;
    }

    // Always reduce animation complexity if under severe pressure
    if (severity === 'high' && this.currentConfiguration.animationComplexity !== 'low') {
      this.currentConfiguration.animationComplexity = 'low';
      this.currentConfiguration.enableAnimations = false;
    }
  }

  /**
   * Increase rendering quality
   */
  private increaseQuality(): void {
    // Conservative quality improvements
    this.currentConfiguration.imageQuality = Math.min(
      this.baseConfiguration.imageQuality,
      this.currentConfiguration.imageQuality + 0.05,
    );

    this.currentConfiguration.targetFrameRate = Math.min(
      this.baseConfiguration.targetFrameRate,
      this.currentConfiguration.targetFrameRate + 2,
    );

    this.currentConfiguration.maxBatchSize = Math.min(
      this.baseConfiguration.maxBatchSize,
      this.currentConfiguration.maxBatchSize + 2,
    );

    this.currentConfiguration.cullBufferMultiplier = Math.max(
      this.baseConfiguration.cullBufferMultiplier,
      this.currentConfiguration.cullBufferMultiplier - 0.1,
    );

    // Re-enable features if performance allows
    if (this.currentConfiguration.imageQuality >= 0.8) {
      this.currentConfiguration.enableImageSmoothing = this.baseConfiguration.enableImageSmoothing;
    }

    if (this.currentConfiguration.imageQuality >= 0.9) {
      this.currentConfiguration.enableAntialiasing = this.baseConfiguration.enableAntialiasing;
    }
  }

  /**
   * Get performance monitoring statistics
   */
  getMonitoringStats(): AdaptiveQualityStats {
    const recentMetrics = this.performanceHistory.slice(-10);

    return {
      isMonitoring: this.isMonitoring,
      metricsCollected: this.performanceHistory.length,
      adjustmentsMade: this.adjustmentHistory.length,
      currentPerformanceTier:
        recentMetrics.length > 0
          ? recentMetrics[recentMetrics.length - 1].performanceTier
          : 'unknown',
      avgFrameRate:
        recentMetrics.length > 0
          ? recentMetrics.reduce((sum, m) => sum + m.frameRate, 0) / recentMetrics.length
          : 0,
      qualityReduction: this.calculateQualityReduction(),
      lastAdjustment: this.adjustmentHistory[this.adjustmentHistory.length - 1] || null,
    };
  }

  /**
   * Calculate how much quality has been reduced from base
   */
  private calculateQualityReduction(): number {
    const baseQuality = this.baseConfiguration.imageQuality;
    const currentQuality = this.currentConfiguration.imageQuality;

    return Math.round(((baseQuality - currentQuality) / baseQuality) * 100);
  }
}

// Type definitions
interface PerformanceAnalysis {
  avgFrameRate: number;
  frameRateVariance: number;
  isUnderperforming: boolean;
  isOverperforming: boolean;
  highMemoryPressure: boolean;
  trend: number;
}

interface QualityAdjustment {
  shouldAdjust: boolean;
  type: 'increase' | 'decrease' | 'none';
  reason: string;
  severity?: 'low' | 'medium' | 'high';
  timestamp?: number;
  oldConfiguration?: CanvasConfiguration;
  newConfiguration?: CanvasConfiguration;
}

interface AdaptiveQualityStats {
  isMonitoring: boolean;
  metricsCollected: number;
  adjustmentsMade: number;
  currentPerformanceTier: string;
  avgFrameRate: number;
  qualityReduction: number;
  lastAdjustment: QualityAdjustment | null;
}
