import type {
  DeviceCapabilities,
  CanvasConfiguration,
  InfiniteCanvasSettings,
  PerformanceMetrics,
} from '../../types/capabilities';
import { CapabilityDetector } from './capability-detector';
import { CapabilityFeatureFlagManager } from '../utils/feature-flags';

/**
 * Capability Configuration System
 * Week 3: Converts detected capabilities into optimized canvas settings
 *
 * This replaces the basic browser-utils device detection with our enhanced
 * capability-based system featuring GPU monitoring, caching, and fallbacks.
 */
export class CapabilityConfigManager {
  private detector: CapabilityDetector;
  private cachedConfig: CanvasConfiguration | null = null;
  private lastDetectionTime = 0;
  private configCacheDuration = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.detector = new CapabilityDetector();
  }

  /**
   * Get optimized canvas configuration based on detected capabilities
   */
  async getCanvasConfiguration(): Promise<CanvasConfiguration> {
    // Return cached config if still valid and not in debug mode
    if (
      this.cachedConfig &&
      Date.now() - this.lastDetectionTime < this.configCacheDuration &&
      !CapabilityFeatureFlagManager.isEnabled('capabilityDebug')
    ) {
      return this.cachedConfig;
    }

    const capabilities = await this.detector.detectCapabilities();
    const config = this.generateCanvasConfiguration(capabilities);

    this.cachedConfig = config;
    this.lastDetectionTime = Date.now();

    if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
      console.log('🎨 Generated canvas configuration:', config);
    }

    return config;
  }

  /**
   * Generate canvas configuration from provided capabilities (for simulation)
   */
  async generateCanvasConfigurationFromCapabilities(
    capabilities: DeviceCapabilities,
  ): Promise<CanvasConfiguration> {
    const config = this.generateCanvasConfiguration(capabilities);

    if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
      console.log('🎭 Generated configuration from provided capabilities:', config);
    }

    return config;
  }

  /**
   * Generate canvas configuration from device capabilities
   */
  private generateCanvasConfiguration(capabilities: DeviceCapabilities): CanvasConfiguration {
    const { performanceTier, gpuMemoryMB, availableMemoryMB, frameRateCapability } = capabilities;

    // Canvas memory allocation (based on available memory)
    const canvasMemoryBudgetMB = this.calculateCanvasMemoryBudget(availableMemoryMB, gpuMemoryMB);

    // Quality settings based on performance tier
    const qualitySettings = this.getQualitySettings(performanceTier, gpuMemoryMB);

    // Frame rate and animation settings
    const animationSettings = this.getAnimationSettings(performanceTier, frameRateCapability);

    // Mobile-specific optimizations
    const mobileOptimizations = this.getMobileOptimizations(capabilities);

    return {
      // Memory management
      canvasMemoryBudgetMB,
      maxTextureSize: Math.min(capabilities.maxTextureSize, qualitySettings.maxTextureSize),

      // Rendering quality
      imageQuality: qualitySettings.imageQuality,
      enableImageSmoothing: qualitySettings.enableImageSmoothing,
      enableAntialiasing: qualitySettings.enableAntialiasing,

      // Performance settings
      targetFrameRate: animationSettings.targetFrameRate,
      enableAnimations: animationSettings.enableAnimations,
      animationComplexity: animationSettings.complexity,

      // Culling and optimization
      enableViewportCulling: true,
      cullBufferMultiplier: qualitySettings.cullBufferMultiplier,
      batchRenderingEnabled: true,
      maxBatchSize: qualitySettings.maxBatchSize,

      // Mobile optimizations
      ...mobileOptimizations,

      // Feature flags
      enableGPUAcceleration: capabilities.supportsWebGL2,
      enableOffscreenCanvas: capabilities.supportsOffscreenCanvas,

      // Debug info
      detectionMethod: capabilities.detectionMethod,
      generatedAt: Date.now(),
    };
  }

  /**
   * Calculate canvas memory budget based on available memory and GPU memory
   */
  private calculateCanvasMemoryBudget(availableMemoryMB: number, gpuMemoryMB: number): number {
    // Use 15-25% of available memory for canvas, with GPU memory as limiting factor
    const memoryBasedBudget = availableMemoryMB * 0.2; // 20% of system memory
    const gpuBasedBudget = gpuMemoryMB * 0.6; // 60% of GPU memory

    // Take the more conservative limit
    const budget = Math.min(memoryBasedBudget, gpuBasedBudget);

    // Debug logging to identify bottlenecks
    if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
      console.log('💾 Memory Budget Calculation:', {
        availableMemoryMB,
        gpuMemoryMB,
        memoryBasedBudget: memoryBasedBudget.toFixed(1),
        gpuBasedBudget: gpuBasedBudget.toFixed(1),
        finalBudget: budget.toFixed(1),
        bottleneck: memoryBasedBudget < gpuBasedBudget ? 'System Memory' : 'GPU Memory',
      });
    }

    // Ensure reasonable bounds (min 50MB, max 1GB)
    return Math.max(50, Math.min(budget, 1024));
  }

  /**
   * Get quality settings based on performance tier and GPU memory
   */
  private getQualitySettings(tier: string, gpuMemoryMB: number) {
    switch (tier) {
      case 'high':
        return {
          imageQuality: 0.95,
          enableImageSmoothing: true,
          enableAntialiasing: true,
          maxTextureSize: gpuMemoryMB > 512 ? 4096 : 2048,
          cullBufferMultiplier: 1.2,
          maxBatchSize: 50,
        };

      case 'medium':
        return {
          imageQuality: 0.85,
          enableImageSmoothing: true,
          enableAntialiasing: gpuMemoryMB > 200,
          maxTextureSize: 2048,
          cullBufferMultiplier: 1.5,
          maxBatchSize: 30,
        };

      case 'low':
      default:
        return {
          imageQuality: 0.75,
          enableImageSmoothing: false,
          enableAntialiasing: false,
          maxTextureSize: 1024,
          cullBufferMultiplier: 2.0,
          maxBatchSize: 15,
        };
    }
  }

  /**
   * Get animation settings based on performance tier and frame rate capability
   */
  private getAnimationSettings(tier: string, frameRateCapability: number) {
    const baseSettings = {
      high: { targetFrameRate: 60, enableAnimations: true, complexity: 'high' as const },
      medium: { targetFrameRate: 45, enableAnimations: true, complexity: 'medium' as const },
      low: { targetFrameRate: 30, enableAnimations: false, complexity: 'low' as const },
    }[tier] || { targetFrameRate: 30, enableAnimations: false, complexity: 'low' as const };

    // Adjust based on measured frame rate capability
    if (frameRateCapability < 30) {
      return {
        targetFrameRate: 20,
        enableAnimations: false,
        complexity: 'low' as const,
      };
    } else if (frameRateCapability >= 60) {
      return {
        ...baseSettings,
        targetFrameRate: Math.min(baseSettings.targetFrameRate, 60),
      };
    }

    return baseSettings;
  }

  /**
   * Get mobile-specific optimizations
   */
  private getMobileOptimizations(capabilities: DeviceCapabilities) {
    const isMobile = capabilities.touchCapable;

    if (!isMobile) {
      return {
        mobileOptimized: false,
        touchGestures: false,
        reducedMotion: false,
      };
    }

    return {
      mobileOptimized: true,
      touchGestures: true,
      reducedMotion: capabilities.performanceTier === 'low',

      // Mobile-specific settings
      enableMomentumScrolling: true,
      touchSensitivity: capabilities.performanceTier === 'high' ? 1.0 : 0.8,
      mouseCheckInterval: capabilities.performanceTier === 'high' ? 16 : 32, // ms

      // Safari mobile specific
      safariMobileOptimizations: capabilities.supportsIntersectionObserver,
    };
  }

  /**
   * Generate infinite canvas settings specifically optimized for the infinite grid
   */
  async getInfiniteCanvasSettings(): Promise<InfiniteCanvasSettings> {
    const config = await this.getCanvasConfiguration();
    const capabilities = await this.detector.detectCapabilities();

    return {
      // Grid rendering
      gridTileSize: this.calculateOptimalTileSize(capabilities),
      preloadRadius: this.calculatePreloadRadius(capabilities),
      maxConcurrentTiles: this.calculateMaxConcurrentTiles(config.canvasMemoryBudgetMB),

      // Image rendering
      imageLoadingConcurrency: capabilities.performanceTier === 'high' ? 8 : 4,
      imageResolution: this.getOptimalImageResolution(capabilities),
      enableProgressiveLoading: true,

      // Performance optimizations
      enableLazyLoading: true,
      virtualScrolling: true,
      debounceScrollMs: capabilities.touchCapable ? 16 : 8,

      // Memory management
      tileMemoryBudgetMB: config.canvasMemoryBudgetMB * 0.7, // 70% for tiles
      enableTileRecycling: true,
      maxTileHistory: capabilities.performanceTier === 'high' ? 100 : 50,

      // Interaction settings
      touchSettings: {
        sensitivity: config.touchSensitivity || 1.0,
        momentumEnabled: config.enableMomentumScrolling || false,
        pinchZoomEnabled: true,
      },

      baseConfig: config,
    };
  }

  /**
   * Calculate optimal tile size for the infinite grid
   */
  private calculateOptimalTileSize(capabilities: DeviceCapabilities): number {
    const baseSize = 256; // Base tile size

    switch (capabilities.performanceTier) {
      case 'high':
        return capabilities.gpuMemoryMB > 512 ? 512 : 384;
      case 'medium':
        return 320;
      case 'low':
      default:
        return baseSize;
    }
  }

  /**
   * Calculate preload radius based on memory and performance
   */
  private calculatePreloadRadius(capabilities: DeviceCapabilities): number {
    const baseRadius = 1; // tiles

    if (capabilities.availableMemoryMB > 4096) return 3;
    if (capabilities.availableMemoryMB > 2048) return 2;
    return baseRadius;
  }

  /**
   * Calculate max concurrent tiles based on memory budget
   */
  private calculateMaxConcurrentTiles(memoryBudgetMB: number): number {
    // Estimate ~4MB per tile on average (with images and metadata)
    const avgTileSizeMB = 4;
    return Math.floor(memoryBudgetMB / avgTileSizeMB);
  }

  /**
   * Get optimal image resolution based on capabilities
   */
  private getOptimalImageResolution(capabilities: DeviceCapabilities): 'low' | 'medium' | 'high' {
    if (capabilities.performanceTier === 'high' && capabilities.gpuMemoryMB > 300) {
      return 'high';
    } else if (capabilities.performanceTier === 'medium') {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Clear cached configuration (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cachedConfig = null;
    this.lastDetectionTime = 0;
  }

  /**
   * Get the underlying capability detector (for advanced usage)
   */
  getDetector(): CapabilityDetector {
    return this.detector;
  }

  /**
   * Get current performance metrics for monitoring
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const capabilities = await this.detector.detectCapabilities();
    const config = await this.getCanvasConfiguration();

    return {
      frameRate: capabilities.frameRateCapability,
      memoryUsage: {
        available: capabilities.availableMemoryMB,
        allocated: config.canvasMemoryBudgetMB,
        pressure: capabilities.memoryPressure,
      },
      gpuMetrics: {
        memory: capabilities.gpuMemoryMB,
        maxTextureSize: capabilities.maxTextureSize,
        webgl2Support: capabilities.supportsWebGL2,
      },
      performanceTier: capabilities.performanceTier,
      timestamp: Date.now(),
    };
  }
}
