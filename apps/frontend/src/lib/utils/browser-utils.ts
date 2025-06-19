/**
 * Browser Detection and Performance Optimization Utilities
 *
 * Centralizes all browser detection logic to eliminate scattered user-agent checks
 * and provides clear documentation for why each browser needs special handling.
 *
 * Phase 1 Step 7: Standardize Browser Detection and Remove Unnecessary Workarounds
 * Phase 2 Step 5: Memory-based optimization detection and progressive performance degradation
 */

interface BrowserInfo {
  name: 'chrome' | 'firefox' | 'safari' | 'edge' | 'brave' | 'unknown';
  version: string;
  isMobile: boolean;
  needsPerformanceMode: boolean;
  platform: 'desktop' | 'mobile' | 'tablet';
}

// Phase 2 Step 5 Action 1: New interface for device capability detection
interface DeviceCapabilities {
  // Memory-based detection
  availableMemory: number; // MB
  memoryPressure: 'low' | 'medium' | 'high';

  // Performance-based detection
  hardwareConcurrency: number; // CPU cores
  devicePixelRatio: number;

  // Feature support detection
  supportsWebGL: boolean;
  supportsOffscreenCanvas: boolean;

  // Calculated performance tier
  performanceTier: 'high' | 'medium' | 'low';
}

interface BrowserOptimizations {
  // Canvas performance optimizations
  targetFPS: number;
  animationDuration: number;
  mouseCheckInterval: number;

  // Feature flags
  enableSpaceAnimation: boolean;
  enableComplexDotPattern: boolean;
  enableImageSmoothing: boolean;

  // Animation settings
  useLinearEasing: boolean;
  frameThrottling: boolean;

  // Phase 2 Step 5: Memory management settings
  gradientCacheSize: number;
  gradientCacheClearInterval: number;
}

// Phase 2 Step 5 Action 1: Memory-based device capability detection
function detectDeviceCapabilities(): DeviceCapabilities {
  const defaultCapabilities: DeviceCapabilities = {
    availableMemory: 1024, // 1GB default assumption
    memoryPressure: 'medium',
    hardwareConcurrency: 2,
    devicePixelRatio: 1,
    supportsWebGL: false,
    supportsOffscreenCanvas: false,
    performanceTier: 'medium',
  };

  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return defaultCapabilities;
  }

  // Memory detection using performance.memory API (Chrome/Edge)
  let availableMemory = 1024; // Default 1GB
  let memoryPressure: 'low' | 'medium' | 'high' = 'medium';

  try {
    // @ts-expect-error - performance.memory is Chrome-specific extension not in standard types
    if (typeof performance !== 'undefined' && performance.memory) {
      // @ts-expect-error - performance.memory properties not in standard types
      const memInfo = performance.memory;
      // Available memory estimation based on heap limit
      availableMemory = Math.round(memInfo.jsHeapSizeLimit / (1024 * 1024));

      // Memory pressure calculation
      const usedRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
      if (usedRatio < 0.3) {
        memoryPressure = 'low';
      } else if (usedRatio > 0.7) {
        memoryPressure = 'high';
      }
    }
  } catch (error) {
    // Fallback to default memory estimation
  }

  // Hardware concurrency detection
  const hardwareConcurrency = navigator.hardwareConcurrency || 2;

  // Device pixel ratio
  const devicePixelRatio = window.devicePixelRatio || 1;

  // WebGL support detection
  let supportsWebGL = false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    supportsWebGL = !!gl;
  } catch (error) {
    supportsWebGL = false;
  }

  // OffscreenCanvas support detection
  const supportsOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';

  // Calculate performance tier based on multiple factors
  let performanceTier: 'high' | 'medium' | 'low' = 'medium';

  // High performance: >4GB RAM, >4 cores, WebGL support, low memory pressure
  if (
    availableMemory > 4096 &&
    hardwareConcurrency >= 4 &&
    supportsWebGL &&
    memoryPressure === 'low'
  ) {
    performanceTier = 'high';
  }
  // Low performance: <1.5GB RAM, ≤1 core, or high memory pressure
  // Phase 2 Step 5 Action 1: More conservative low-tier classification
  // Avoid classifying modern dual-core systems as low-performance
  else if (availableMemory < 1536 || hardwareConcurrency <= 1 || memoryPressure === 'high') {
    performanceTier = 'low';
  }

  return {
    availableMemory,
    memoryPressure,
    hardwareConcurrency,
    devicePixelRatio,
    supportsWebGL,
    supportsOffscreenCanvas,
    performanceTier,
  };
}

/**
 * Detects the current browser with consolidated detection logic
 * Replaces scattered patterns across the codebase
 */
export function detectBrowser(): BrowserInfo {
  if (typeof navigator === 'undefined') {
    return {
      name: 'unknown',
      version: '0.0.0',
      isMobile: false,
      needsPerformanceMode: false,
      platform: 'desktop',
    };
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(userAgent);
  const isTablet = /ipad|tablet/i.test(userAgent) && !isMobile;

  let browserName: BrowserInfo['name'] = 'unknown';
  let version = '0.0.0';

  // Browser detection (order matters - most specific first)
  if (userAgent.includes('brave')) {
    browserName = 'brave';
  } else if (userAgent.includes('edg/')) {
    browserName = 'edge';
  } else if (userAgent.includes('firefox')) {
    browserName = 'firefox';
    const match = userAgent.match(/firefox\/(\d+\.\d+)/);
    version = match ? match[1] : '0.0.0';
  } else if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
    // Safari detection (excluding Chrome on Android)
    browserName = 'safari';
    const match = userAgent.match(/version\/(\d+\.\d+)/);
    version = match ? match[1] : '0.0.0';
  } else if (userAgent.includes('chrome')) {
    browserName = 'chrome';
    const match = userAgent.match(/chrome\/(\d+\.\d+)/);
    version = match ? match[1] : '0.0.0';
  }

  // Phase 2 Step 5 Action 1: Enhanced performance mode detection using device capabilities
  const deviceCapabilities = detectDeviceCapabilities();

  // Combine browser-specific needs with device capabilities
  const browserNeedsOptimization = browserName === 'safari' || browserName === 'firefox';
  const deviceNeedsOptimization =
    deviceCapabilities.performanceTier === 'low' || deviceCapabilities.memoryPressure === 'high';

  const needsPerformanceMode = browserNeedsOptimization || deviceNeedsOptimization || isMobile;

  return {
    name: browserName,
    version,
    isMobile,
    needsPerformanceMode,
    platform: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
  };
}

/**
 * Gets browser-specific performance optimizations
 * Phase 2 Step 5 Action 1: Progressive performance degradation based on device capabilities
 */
export function getBrowserOptimizations(browser: BrowserInfo): BrowserOptimizations {
  // Phase 2 Step 5 Action 1: Get device capabilities for optimization decisions
  const deviceCapabilities = detectDeviceCapabilities();

  // Phase 2 Step 5 Action 2: Standardized animation durations based on device capabilities only
  const baseOptimizations: BrowserOptimizations = {
    targetFPS: 60,
    animationDuration: 400, // Standardized: medium duration for all browsers
    mouseCheckInterval: 16,
    enableSpaceAnimation: true,
    enableComplexDotPattern: true,
    enableImageSmoothing: true,
    useLinearEasing: false,
    frameThrottling: false,
    gradientCacheSize: 100,
    gradientCacheClearInterval: 30000,
  };

  // Phase 2 Step 5 Action 2: Device-based optimization (no browser-specific animation timing)
  if (deviceCapabilities.performanceTier === 'low' || browser.isMobile) {
    const lowPerfOptimizations = {
      ...baseOptimizations,
      targetFPS: deviceCapabilities.performanceTier === 'low' ? 30 : 45,
      animationDuration: 250, // Faster animations for lower-end devices (standardized)
      mouseCheckInterval: 50, // Less frequent checks
      enableSpaceAnimation: false, // Disable heavy animations
      enableComplexDotPattern: false, // Disable complex patterns
      useLinearEasing: true, // Simpler easing
      frameThrottling: true, // Enable throttling
      gradientCacheSize: 25, // Smaller cache for memory-constrained devices
      gradientCacheClearInterval: 15000, // More frequent clearing
    };

    // Phase 2 Step 5 Action 1: Firefox-specific fix for black screen flashing
    if (browser.name === 'firefox') {
      lowPerfOptimizations.frameThrottling = false; // CRITICAL: Never throttle Firefox frames
      lowPerfOptimizations.targetFPS = 60; // Keep full FPS for Firefox
    }

    return lowPerfOptimizations;
  }

  if (deviceCapabilities.performanceTier === 'medium') {
    // Phase 2 Step 5 Action 2: Standardized medium performance tier - no browser-specific animation timing
    const mediumOptimizations = {
      ...baseOptimizations,
      // Animation duration stays standardized (400ms from baseOptimizations)
      mouseCheckInterval: 50, // Standard for medium devices
      enableSpaceAnimation: false, // Disabled for stability on medium devices
      enableComplexDotPattern: false, // Disabled for performance on medium devices
      useLinearEasing: true, // Simpler easing for medium devices
    };

    // ONLY critical browser-specific fixes (not animation timing)
    if (browser.name === 'safari') {
      mediumOptimizations.gradientCacheSize = 100; // Phase 2 Step 5 Action 3: Increased cache for Safari scroll performance
    }

    if (browser.name === 'firefox') {
      mediumOptimizations.gradientCacheSize = 75; // Moderate cache for Firefox
      mediumOptimizations.frameThrottling = false; // CRITICAL: Disable frame throttling for Firefox
    }

    return mediumOptimizations;
  }

  // Phase 2 Step 5 Action 2: High performance tier with standardized animation timing
  if (deviceCapabilities.performanceTier === 'high') {
    return {
      ...baseOptimizations,
      targetFPS: 60,
      animationDuration: 350, // Standardized: slightly faster for high-end devices
      mouseCheckInterval: 16,
      enableSpaceAnimation: true,
      enableComplexDotPattern: true,
      enableImageSmoothing: true,
      useLinearEasing: false,
      frameThrottling: false,
      gradientCacheSize: 200, // Larger cache for high-end devices
      gradientCacheClearInterval: 60000, // Less frequent clearing
    };
  }

  // Fallback to base optimizations
  return baseOptimizations;
}

/**
 * Singleton browser detection - detect once, use everywhere
 */
let cachedBrowser: BrowserInfo | null = null;
let cachedOptimizations: BrowserOptimizations | null = null;
let cachedDeviceCapabilities: DeviceCapabilities | null = null;

export function getBrowser(): BrowserInfo {
  if (!cachedBrowser) {
    cachedBrowser = detectBrowser();
  }
  return cachedBrowser;
}

export function getBrowserPerformanceSettings(): BrowserOptimizations {
  if (!cachedOptimizations) {
    const browser = getBrowser();
    cachedOptimizations = getBrowserOptimizations(browser);
  }
  return cachedOptimizations;
}

// Phase 2 Step 5 Action 1: New function to get device capabilities
export function getDeviceCapabilities(): DeviceCapabilities {
  if (!cachedDeviceCapabilities) {
    cachedDeviceCapabilities = detectDeviceCapabilities();
  }
  return cachedDeviceCapabilities;
}

/**
 * Utility functions for common browser checks
 * Replaces scattered inline checks throughout the codebase
 */
export const browserUtils = {
  isSafari: () => getBrowser().name === 'safari',
  isFirefox: () => getBrowser().name === 'firefox',
  isChrome: () => getBrowser().name === 'chrome',
  isMobile: () => getBrowser().isMobile,
  needsPerformanceMode: () => getBrowser().needsPerformanceMode,

  // Canvas-specific utilities
  getTargetFPS: () => getBrowserPerformanceSettings().targetFPS,
  getAnimationDuration: () => getBrowserPerformanceSettings().animationDuration,
  getMouseCheckInterval: () => getBrowserPerformanceSettings().mouseCheckInterval,
  shouldEnableSpaceAnimation: () => getBrowserPerformanceSettings().enableSpaceAnimation,
  shouldUseComplexDotPattern: () => getBrowserPerformanceSettings().enableComplexDotPattern,

  // Phase 2 Step 5 Action 1: New device capability utilities
  getDevicePerformanceTier: () => getDeviceCapabilities().performanceTier,
  getAvailableMemory: () => getDeviceCapabilities().availableMemory,
  getMemoryPressure: () => getDeviceCapabilities().memoryPressure,
  getGradientCacheSize: () => getBrowserPerformanceSettings().gradientCacheSize,
  getGradientCacheClearInterval: () => getBrowserPerformanceSettings().gradientCacheClearInterval,
};

/**
 * Debug information for troubleshooting browser-specific issues
 * Phase 2 Step 5 Action 1-2: Enhanced with device capability information and standardized animation durations
 */
export function getBrowserDebugInfo(): string {
  const browser = getBrowser();
  const optimizations = getBrowserPerformanceSettings();
  const deviceCapabilities = getDeviceCapabilities();

  return `Browser: ${browser.name} ${browser.version} (${browser.platform}${browser.isMobile ? ', mobile' : ''})
Performance Mode: ${browser.needsPerformanceMode ? 'enabled' : 'disabled'}
Device Tier: ${deviceCapabilities.performanceTier}
Available Memory: ${deviceCapabilities.availableMemory}MB
Memory Pressure: ${deviceCapabilities.memoryPressure}
Hardware Cores: ${deviceCapabilities.hardwareConcurrency}
WebGL Support: ${deviceCapabilities.supportsWebGL ? 'yes' : 'no'}
Target FPS: ${optimizations.targetFPS}
Animation Duration: ${optimizations.animationDuration}ms (standardized across browsers)
Space Animation: ${optimizations.enableSpaceAnimation ? 'enabled' : 'disabled'}
Gradient Cache: ${optimizations.gradientCacheSize} items, ${optimizations.gradientCacheClearInterval}ms interval`;
}
