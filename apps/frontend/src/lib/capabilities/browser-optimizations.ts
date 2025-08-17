import type { CanvasConfiguration, BrowserCapabilities } from '../../types/capabilities';

/**
 * Browser-Specific Performance Optimizations
 * Week 4: Tailored optimizations for Safari, Chrome, and Firefox
 *
 * This system applies browser-specific tweaks and optimizations based on
 * detected browser capabilities and known performance characteristics.
 */
export class BrowserOptimizations {
  /**
   * Apply browser-specific optimizations to configuration
   */
  static applyBrowserOptimizations(
    baseConfig: CanvasConfiguration,
    browserCapabilities: BrowserCapabilities,
  ): CanvasConfiguration {
    let optimizedConfig = { ...baseConfig };

    // Apply browser-specific optimizations
    if (browserCapabilities.isSafari) {
      optimizedConfig = this.applySafariOptimizations(optimizedConfig, browserCapabilities);
    } else if (browserCapabilities.isChrome) {
      optimizedConfig = this.applyChromeOptimizations(optimizedConfig, browserCapabilities);
    } else if (browserCapabilities.isFirefox) {
      optimizedConfig = this.applyFirefoxOptimizations(optimizedConfig, browserCapabilities);
    } else if (browserCapabilities.isEdge) {
      optimizedConfig = this.applyEdgeOptimizations(optimizedConfig, browserCapabilities);
    }

    // Apply mobile-specific optimizations if applicable
    if (browserCapabilities.isMobile) {
      optimizedConfig = this.applyMobileOptimizations(optimizedConfig, browserCapabilities);
    }

    return optimizedConfig;
  }

  /**
   * Safari-specific optimizations (Modern 2024+ approach)
   * Focus on known Safari quirks rather than hard performance caps
   */
  private static applySafariOptimizations(
    config: CanvasConfiguration,
    capabilities: BrowserCapabilities,
  ): CanvasConfiguration {
    const optimized = { ...config };

    // Modern Safari approach: Let device capabilities drive performance, not browser name
    // Only apply specific Safari quirk fixes, not blanket performance limitations

    // Safari benefits from disabled image smoothing for better performance on lower-end devices
    if (
      capabilities.safariQuirks?.includes('canvas-performance') ||
      (capabilities.isMobile &&
        capabilities.jsPerformanceScore &&
        capabilities.jsPerformanceScore < 60)
    ) {
      optimized.enableImageSmoothing = false;
      optimized.enableAntialiasing = false;
    }

    // Safari has viewport scaling issues - increase cull buffer
    if (capabilities.safariQuirks?.includes('viewport-scaling')) {
      optimized.cullBufferMultiplier = Math.max(optimized.cullBufferMultiplier, 2.0);
    }

    // Reduce batch size for Safari to prevent memory issues (but only if memory is constrained)
    if (
      capabilities.supportsMemoryAPI &&
      capabilities.jsPerformanceScore &&
      capabilities.jsPerformanceScore < 50
    ) {
      optimized.maxBatchSize = Math.min(optimized.maxBatchSize, 20);
    }

    // Safari mobile optimizations based on DEVICE capability, not Safari version
    if (capabilities.isMobile) {
      // Only reduce image quality on genuinely low-performance mobile devices
      if (capabilities.jsPerformanceScore && capabilities.jsPerformanceScore < 40) {
        optimized.imageQuality = Math.min(optimized.imageQuality, 0.8);
      }

      // Disable hardware compositing only on very old Safari mobile (pre-iOS 14)
      if (capabilities.browserVersion && parseFloat(capabilities.browserVersion) < 14) {
        optimized.enableGPUAcceleration = false;
      }
    }

    return optimized;
  }

  /**
   * Chrome-specific optimizations
   */
  private static applyChromeOptimizations(
    config: CanvasConfiguration,
    capabilities: BrowserCapabilities,
  ): CanvasConfiguration {
    const optimized = { ...config };

    // Chrome has excellent WebGL support
    if (capabilities.supportsWebGLContextRecovery) {
      optimized.enableGPUAcceleration = true;
    }

    // Chrome handles high batch sizes well
    optimized.maxBatchSize = Math.min(optimized.maxBatchSize + 10, 50);

    // Chrome has good memory management
    if (capabilities.supportsMemoryAPI) {
      optimized.canvasMemoryBudgetMB = Math.min(optimized.canvasMemoryBudgetMB * 1.2, 1024);
    }

    // Enable advanced features in Chrome
    if (capabilities.supportsOffscreenCanvas) {
      optimized.enableOffscreenCanvas = true;
    }

    // Chrome mobile optimizations
    if (capabilities.isMobile) {
      // Chrome mobile can handle higher quality than Safari mobile
      optimized.imageQuality = Math.min(optimized.imageQuality * 1.1, 0.95);

      // Chrome mobile has good touch event handling
      if (capabilities.supportsTouchEvents) {
        optimized.touchSensitivity = (optimized.touchSensitivity || 1.0) * 1.1;
      }
    }

    return optimized;
  }

  /**
   * Firefox-specific optimizations
   */
  private static applyFirefoxOptimizations(
    config: CanvasConfiguration,
    capabilities: BrowserCapabilities,
  ): CanvasConfiguration {
    const optimized = { ...config };

    // Firefox prefers conservative memory usage
    optimized.canvasMemoryBudgetMB = Math.min(optimized.canvasMemoryBudgetMB * 0.9, 512);

    // Firefox has different canvas clearing behavior
    optimized.cullBufferMultiplier = Math.max(optimized.cullBufferMultiplier, 1.8);

    // Firefox benefits from reduced batch sizes
    optimized.maxBatchSize = Math.min(optimized.maxBatchSize, 25);

    // Firefox has good support for image smoothing
    if (capabilities.canvas2DFeatures?.includes('imageSmoothing')) {
      optimized.enableImageSmoothing = true;
    }

    // Firefox mobile optimizations (Modern 2024+ approach)
    if (capabilities.isMobile) {
      // Only apply conservative settings if device actually needs them
      if (capabilities.jsPerformanceScore && capabilities.jsPerformanceScore < 40) {
        // Only cap frame rate on genuinely low-performance devices
        optimized.targetFrameRate = Math.min(optimized.targetFrameRate, 30);
      }

      // Disable antialiasing conservatively (Firefox mobile can struggle with this)
      optimized.enableAntialiasing = false;
    }

    return optimized;
  }

  /**
   * Edge-specific optimizations
   */
  private static applyEdgeOptimizations(
    config: CanvasConfiguration,
    capabilities: BrowserCapabilities,
  ): CanvasConfiguration {
    const optimized = { ...config };

    // Edge (Chromium-based) similar to Chrome but more conservative
    optimized.maxBatchSize = Math.min(optimized.maxBatchSize + 5, 35);

    // Edge has good hardware acceleration support
    if (capabilities.supportsHardwareCompositing) {
      optimized.enableGPUAcceleration = true;
    }

    // Edge mobile optimizations
    if (capabilities.isMobile) {
      // Edge mobile similar to Chrome mobile but slightly more conservative
      optimized.imageQuality = Math.min(optimized.imageQuality * 1.05, 0.9);
    }

    return optimized;
  }

  /**
   * Mobile-specific optimizations across all browsers
   */
  private static applyMobileOptimizations(
    config: CanvasConfiguration,
    capabilities: BrowserCapabilities,
  ): CanvasConfiguration {
    const optimized = { ...config };

    // Universal mobile optimizations
    optimized.mobileOptimized = true;
    optimized.touchGestures = true;

    // Reduce memory usage on mobile
    optimized.canvasMemoryBudgetMB = Math.min(optimized.canvasMemoryBudgetMB, 256);

    // Modern mobile approach: Let device capabilities and adaptive quality manager determine frame rate
    // Only apply conservative limits if device performance is genuinely low
    if (capabilities.jsPerformanceScore && capabilities.jsPerformanceScore < 50) {
      optimized.targetFrameRate = Math.min(optimized.targetFrameRate, 45);
    }
    // High-performance mobile devices (iPhone 15 Pro, Galaxy S24 Ultra, etc.) should get full 60fps

    // Enable momentum scrolling for mobile
    optimized.enableMomentumScrolling = true;

    // Adjust touch sensitivity based on device
    if (capabilities.supportsTouchEvents) {
      optimized.touchSensitivity =
        capabilities.eventPerformanceScore && capabilities.eventPerformanceScore > 70
          ? 1.2 // High-performance touch devices
          : 0.8; // Lower-performance touch devices
    }

    // Mobile-specific quirk handling
    if (capabilities.mobileQuirks) {
      if (capabilities.mobileQuirks.includes('android-viewport')) {
        optimized.cullBufferMultiplier = Math.max(optimized.cullBufferMultiplier, 2.5);
      }

      if (capabilities.mobileQuirks.includes('ios-viewport')) {
        optimized.safariMobileOptimizations = true;
      }
    }

    return optimized;
  }

  /**
   * Get browser-specific performance recommendations
   */
  static getBrowserRecommendations(browserCapabilities: BrowserCapabilities): string[] {
    const recommendations: string[] = [];

    if (browserCapabilities.isSafari) {
      recommendations.push(
        'Safari: Consider reducing animation complexity for better performance',
        'Safari: Image smoothing disabled for optimal rendering speed',
        'Safari: Conservative memory usage recommended',
      );
    }

    if (browserCapabilities.isChrome) {
      recommendations.push(
        'Chrome: GPU acceleration enabled for optimal performance',
        'Chrome: High batch sizes supported for efficient rendering',
        'Chrome: OffscreenCanvas available for background processing',
      );
    }

    if (browserCapabilities.isFirefox) {
      recommendations.push(
        'Firefox: Conservative memory settings applied',
        'Firefox: Reduced batch sizes for stability',
        'Firefox: Image smoothing enabled for quality',
      );
    }

    if (browserCapabilities.isMobile) {
      recommendations.push(
        'Mobile: Reduced memory budget for stability',
        'Mobile: Touch gestures and momentum scrolling enabled',
        'Mobile: Frame rate capped for battery efficiency',
      );
    }

    // Performance warnings
    if (
      browserCapabilities.eventPerformanceScore &&
      browserCapabilities.eventPerformanceScore < 50
    ) {
      recommendations.push('Warning: Low event handling performance detected');
    }

    if (browserCapabilities.jsPerformanceScore && browserCapabilities.jsPerformanceScore < 40) {
      recommendations.push('Warning: Low JavaScript execution performance detected');
    }

    if (!browserCapabilities.supportsGPUAcceleration) {
      recommendations.push('Warning: GPU acceleration not available');
    }

    return recommendations;
  }

  /**
   * Check if a browser needs special compatibility handling
   */
  static needsCompatibilityMode(browserCapabilities: BrowserCapabilities): boolean {
    // Old browser versions that need compatibility mode
    if (browserCapabilities.browserName && browserCapabilities.browserVersion) {
      const version = parseFloat(browserCapabilities.browserVersion);

      if (browserCapabilities.isSafari && version < 12) return true;
      if (browserCapabilities.isChrome && version < 70) return true;
      if (browserCapabilities.isFirefox && version < 65) return true;
    }

    // Browsers without key features
    if (!browserCapabilities.supportsPassiveEvents) return true;
    if (!browserCapabilities.supportsIntersectionObserver) return true;
    if (!browserCapabilities.supportsHighResTimer) return true;

    return false;
  }

  /**
   * Get compatibility mode configuration
   */
  static getCompatibilityConfiguration(): Partial<CanvasConfiguration> {
    return {
      targetFrameRate: 30,
      imageQuality: 0.7,
      enableImageSmoothing: false,
      enableAntialiasing: false,
      enableAnimations: false,
      animationComplexity: 'low',
      maxBatchSize: 10,
      canvasMemoryBudgetMB: 100,
      enableGPUAcceleration: false,
      enableOffscreenCanvas: false,
    };
  }
}
