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

  // Phase 2 Step 7 Action 1: Mobile-specific capabilities
  isMobileSafari: boolean;
  screenSize: { width: number; height: number };
  touchCapable: boolean;
  orientationCapable: boolean;
  pixelDensityCategory: 'standard' | 'high' | 'ultra';
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
    // Phase 2 Step 7 Action 1: Mobile defaults
    isMobileSafari: false,
    screenSize: { width: 1024, height: 768 },
    touchCapable: false,
    orientationCapable: false,
    pixelDensityCategory: 'standard',
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
      let rawMemory = Math.round(memInfo.jsHeapSizeLimit / (1024 * 1024));

      // Platform-specific memory adjustments for more accurate estimation
      const isWindows = typeof navigator !== 'undefined' && navigator.platform.includes('Win');
      const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

      // Debug logging for Android detection
      if (typeof console !== 'undefined' && console.log) {
        console.log('Memory Detection Debug:', {
          isWindows,
          isAndroid,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'undefined',
          platform: typeof navigator !== 'undefined' ? navigator.platform : 'undefined',
          rawMemory,
        });
      }

      if (isWindows && rawMemory > 1024) {
        // Windows typically has more system memory than the conservative heap limit suggests
        // Apply a more aggressive multiplier for high-end Windows PCs
        if (rawMemory >= 4096) {
          rawMemory = Math.min(rawMemory * 2.0, 32768); // 2x multiplier for high-end
          console.log('Windows Memory Adjustment Applied:', {
            originalMemory: Math.round(memInfo.jsHeapSizeLimit / (1024 * 1024)),
            adjustedMemory: rawMemory,
          });
        } else if (rawMemory >= 2048) {
          rawMemory = Math.min(rawMemory * 2.2, 16384); // 2.2x multiplier for mid-high end (your PC range)
          console.log('Windows Memory Adjustment Applied:', {
            originalMemory: Math.round(memInfo.jsHeapSizeLimit / (1024 * 1024)),
            adjustedMemory: rawMemory,
          });
        } else if (rawMemory >= 1536) {
          rawMemory = Math.min(rawMemory * 1.5, 8192); // 1.5x multiplier for mid-range
          console.log('Windows Memory Adjustment Applied:', {
            originalMemory: Math.round(memInfo.jsHeapSizeLimit / (1024 * 1024)),
            adjustedMemory: rawMemory,
          });
        }
      } else if (isAndroid && rawMemory > 1024) {
        // Android Chrome also reports conservative heap limits, especially on high-end devices
        // Apply Android-specific memory adjustments
        console.log('Android Memory Adjustment - Before:', { rawMemory, isAndroid });
        if (rawMemory >= 2048) {
          rawMemory = Math.min(rawMemory * 1.8, 16384); // 1.8x multiplier for high-end Android (Galaxy S24 Ultra, etc.)
          console.log('Android Memory Adjustment - Applied 1.8x multiplier:', {
            newMemory: rawMemory,
          });
        } else if (rawMemory >= 1536) {
          rawMemory = Math.min(rawMemory * 1.5, 8192); // 1.5x multiplier for mid-range Android
          console.log('Android Memory Adjustment - Applied 1.5x multiplier:', {
            newMemory: rawMemory,
          });
        }
        console.log('Android Memory Adjustment - After:', { rawMemory });
      } else {
        console.log('No Memory Adjustment Applied:', { isWindows, isAndroid, rawMemory });
      }

      availableMemory = rawMemory;

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

  // Phase 2 Step 7 Action 1: Mobile Safari detection (more specific than general mobile)
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobileSafari =
    /iphone|ipad|ipod/.test(userAgent) && /safari/.test(userAgent) && !/chrome/.test(userAgent);

  // Phase 2 Step 7 Action 1: Screen size detection for mobile optimization
  const screenSize = {
    width: window.screen.width || window.innerWidth,
    height: window.screen.height || window.innerHeight,
  };

  // Phase 2 Step 7 Action 1: Touch and orientation capability detection
  const touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const orientationCapable = 'orientation' in window || 'onorientationchange' in window;

  // Phase 2 Step 7 Action 1: Pixel density categorization for canvas optimization
  let pixelDensityCategory: 'standard' | 'high' | 'ultra' = 'standard';
  if (devicePixelRatio >= 3) {
    pixelDensityCategory = 'ultra'; // iPhone Pro, high-end Android
  } else if (devicePixelRatio >= 2) {
    pixelDensityCategory = 'high'; // Most modern mobile devices
  }

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

  // Phase 2 Step 7 Action 1: Enhanced mobile-aware performance tier calculation
  const isMobileDevice = touchCapable || /mobile|android|iphone|ipad|ipod/.test(userAgent);

  // High performance: Lowered thresholds for modern devices
  // Desktop: >2.5GB RAM, ≥4 cores, WebGL support, not high memory pressure
  // Mobile: >2.2GB RAM, ≥6 cores, WebGL support, not high memory pressure (adjusted for Android Galaxy S24 Ultra, Tab S9+)
  if (
    availableMemory > 2560 && // Lowered from 3072 to 2560 (2.5GB) for modern systems
    hardwareConcurrency >= 4 &&
    supportsWebGL &&
    memoryPressure !== 'high' && // Changed from 'low' to 'not high' - medium is acceptable
    (!isMobileDevice || (availableMemory > 2200 && hardwareConcurrency >= 6)) // Mobile: >2.2GB RAM, ≥6 cores for high-end Android devices (Galaxy S24 Ultra: 2222MB raw)
  ) {
    performanceTier = 'high';
  }
  // Low performance: <1.5GB RAM, ≤1 core, high memory pressure, OR mobile with severe constraints
  else if (
    availableMemory < 1536 ||
    hardwareConcurrency <= 1 ||
    memoryPressure === 'high' ||
    (isMobileDevice && availableMemory < 1536) // Removed ultra pixel density penalty for high-end devices
  ) {
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
    // Phase 2 Step 7 Action 1: Mobile-specific capabilities
    isMobileSafari,
    screenSize,
    touchCapable,
    orientationCapable,
    pixelDensityCategory,
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
// Helper function to apply browser-specific mouse optimizations
function applyBrowserSpecificMouseOptimizations(
  optimizations: BrowserOptimizations,
  browser: BrowserInfo,
): BrowserOptimizations {
  // Firefox desktop optimization: Reduce mouse check frequency slightly
  // Firefox has efficient event handling but benefits from reduced polling
  if (browser.name === 'firefox' && !browser.isMobile) {
    return {
      ...optimizations,
      mouseCheckInterval: Math.max(optimizations.mouseCheckInterval * 1.25, 20), // 25% slower polling
    };
  }

  // Brave desktop optimization: Increase mouse check frequency slightly
  // Brave's privacy processing adds slight input delay, compensate with faster polling
  if (browser.name === 'brave' && !browser.isMobile) {
    return {
      ...optimizations,
      mouseCheckInterval: Math.max(optimizations.mouseCheckInterval * 0.8, 12), // 20% faster polling
    };
  }

  return optimizations;
}

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
  if (deviceCapabilities.performanceTier === 'low') {
    const lowPerfOptimizations = {
      ...baseOptimizations,
      targetFPS: 30, // Only reduce FPS for truly low-end devices
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

    // Apply browser-specific mouse interval optimizations for low performance tier
    return applyBrowserSpecificMouseOptimizations(lowPerfOptimizations, browser);
  }

  if (deviceCapabilities.performanceTier === 'medium') {
    // Phase 2 Step 5 Action 2: Standardized medium performance tier - no browser-specific animation timing
    const mediumOptimizations = {
      ...baseOptimizations,
      targetFPS: 60, // Keep 60fps for medium devices
      // Animation duration stays standardized (400ms from baseOptimizations)
      mouseCheckInterval: browser.isMobile ? 40 : 32, // Optimized for mobile vs desktop
      enableSpaceAnimation: false, // Disabled for stability on medium devices
      enableComplexDotPattern: false, // Disabled for performance on medium devices
      useLinearEasing: true, // Simpler easing for medium devices
      frameThrottling: false, // Don't throttle medium devices
    };

    // ONLY critical browser-specific fixes (not animation timing)
    if (browser.name === 'safari') {
      mediumOptimizations.gradientCacheSize = 100; // Phase 2 Step 5 Action 3: Increased cache for Safari scroll performance
    }

    if (browser.name === 'firefox') {
      mediumOptimizations.gradientCacheSize = 75; // Moderate cache for Firefox
      mediumOptimizations.frameThrottling = false; // CRITICAL: Disable frame throttling for Firefox
    }

    // Apply browser-specific mouse interval optimizations for medium performance tier
    return applyBrowserSpecificMouseOptimizations(mediumOptimizations, browser);
  }

  // Phase 2 Step 5 Action 2: High performance tier with standardized animation timing
  if (deviceCapabilities.performanceTier === 'high') {
    const highPerfOptimizations = {
      ...baseOptimizations,
      targetFPS: 60,
      animationDuration: 350, // Standardized: slightly faster for high-end devices
      mouseCheckInterval: browser.isMobile ? 32 : 16, // Slightly slower for mobile touch to reduce CPU load
      enableSpaceAnimation: !browser.isMobile, // Disable space animation on mobile for better performance
      enableComplexDotPattern: true,
      enableImageSmoothing: true,
      useLinearEasing: false,
      frameThrottling: false,
      gradientCacheSize: browser.isMobile ? 150 : 200, // Slightly smaller cache for mobile
      gradientCacheClearInterval: 60000, // Less frequent clearing
    };

    // Apply browser-specific mouse interval optimizations for high performance tier
    return applyBrowserSpecificMouseOptimizations(highPerfOptimizations, browser);
  }

  // Fallback to base optimizations with browser-specific mouse optimizations
  return applyBrowserSpecificMouseOptimizations(baseOptimizations, browser);
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
 * Phase 2 Step 7 Action 1: Mobile-specific utilities for canvas optimization
 */
export const mobileUtils = {
  // Mobile Safari specific optimizations
  isMobileSafari: () => getDeviceCapabilities().isMobileSafari,

  // Device pixel ratio management
  getStableMobileDPR: () => {
    const capabilities = getDeviceCapabilities();
    if (capabilities.isMobileSafari) {
      // Phase 2 Step 7 Action 1: Safari mobile DPR stabilization
      // Clamp DPR to prevent viewport scaling issues
      return Math.min(capabilities.devicePixelRatio, 3);
    }
    return capabilities.devicePixelRatio;
  },

  // Mobile-optimized canvas dimensions
  getMobileCanvasDimensions: () => {
    const capabilities = getDeviceCapabilities();
    const baseDPR = mobileUtils.getStableMobileDPR();

    // Phase 2 Step 7 Action 1: Mobile memory-aware canvas sizing
    let scaleFactor = 1;
    if (capabilities.performanceTier === 'low') {
      scaleFactor = 0.75; // Reduce canvas size for low-end devices
    } else if (
      capabilities.pixelDensityCategory === 'ultra' &&
      capabilities.availableMemory < 3072
    ) {
      scaleFactor = 0.85; // Moderate reduction for ultra-high DPI with limited memory
    }

    return {
      width: Math.round(window.innerWidth * baseDPR * scaleFactor),
      height: Math.round(window.innerHeight * baseDPR * scaleFactor),
      scaleFactor,
      dpr: baseDPR,
    };
  },

  // Phase 3: Enhanced canvas scaling for larger canvas sizes
  getOptimalCanvasScale: () => {
    const capabilities = getDeviceCapabilities();

    // SSR safety check
    if (typeof window === 'undefined') {
      return {
        scaleFactor: 1.0,
        recommendedTileCache: 50,
        qualityMode: 'standard' as const,
      };
    }

    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const memoryMB = capabilities.availableMemory;

    // Calculate target canvas size increase factor
    let canvasScaleFactor = 1.0;

    // Desktop scaling based on performance tier and memory
    if (!capabilities.touchCapable) {
      if (capabilities.performanceTier === 'high' && memoryMB > 8192) {
        canvasScaleFactor = 1.5; // 50% larger canvas for high-end desktop
      } else if (capabilities.performanceTier === 'medium' && memoryMB > 4096) {
        canvasScaleFactor = 1.25; // 25% larger for medium desktop
      }
    }
    // Mobile scaling (more conservative)
    else if (capabilities.performanceTier === 'high' && memoryMB > 4096) {
      canvasScaleFactor = 1.2; // 20% larger for high-end mobile
    }

    // Viewport-based adjustments
    const largeViewport = viewport.width > 1920 || viewport.height > 1080;
    if (largeViewport && capabilities.performanceTier === 'high') {
      canvasScaleFactor *= 1.2; // Additional scaling for large displays
    }

    return {
      scaleFactor: canvasScaleFactor,
      recommendedTileCache: Math.floor(
        (capabilities.performanceTier === 'high'
          ? 150
          : capabilities.performanceTier === 'medium'
            ? 75
            : 50) * canvasScaleFactor,
      ),
      qualityMode:
        canvasScaleFactor > 1.3 ? 'ultra' : canvasScaleFactor > 1.1 ? 'high' : 'standard',
    };
  },

  // Orientation change handling
  handleMobileOrientationChange: (callback: () => void) => {
    // Early exit for SSR or non-capable devices
    if (typeof window === 'undefined') return () => {};

    const capabilities = getDeviceCapabilities();
    if (!capabilities.orientationCapable) return () => {};

    const handleOrientationChange = () => {
      // Phase 2 Step 7 Action 1: Safari mobile needs delay after orientation change
      const delay = capabilities.isMobileSafari ? 300 : 100;
      setTimeout(callback, delay);
    };

    // Use orientation event if available
    if ('onorientationchange' in window) {
      const w = window as Window & typeof globalThis;
      w.addEventListener('orientationchange', handleOrientationChange);
      return () => w.removeEventListener('orientationchange', handleOrientationChange);
    }

    // Fallback to resize detection
    const w = window as Window & typeof globalThis;
    let lastOrientation = w.innerWidth > w.innerHeight ? 'landscape' : 'portrait';

    const handleResize = () => {
      const currentOrientation = w.innerWidth > w.innerHeight ? 'landscape' : 'portrait';
      if (currentOrientation !== lastOrientation) {
        lastOrientation = currentOrientation;
        handleOrientationChange();
      }
    };

    w.addEventListener('resize', handleResize);
    return () => w.removeEventListener('resize', handleResize);
  },

  // Mobile viewport utilities
  getStableMobileDimensions: () => {
    const capabilities = getDeviceCapabilities();
    if (capabilities.isMobileSafari) {
      // Phase 2 Step 7 Action 1: Safari mobile viewport stabilization
      // Use visual viewport API if available, fallback to screen dimensions
      if (typeof window !== 'undefined' && 'visualViewport' in window && window.visualViewport) {
        const visualViewport = window.visualViewport as VisualViewport;
        return {
          width: visualViewport.width,
          height: visualViewport.height,
        };
      }
      // Fallback: use screen dimensions to avoid dynamic viewport issues
      if (typeof window !== 'undefined') {
        return {
          width: Math.min(window.screen.width, window.innerWidth),
          height: Math.min(window.screen.height, window.innerHeight),
        };
      }
    }
    if (typeof window !== 'undefined') {
      return {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    }
    // SSR fallback
    return {
      width: 1024,
      height: 768,
    };
  },

  // Phase 2 Step 7 Action 4: Critical mobile issue resolution
  handleMobileLoadingStateError: () => {
    const capabilities = getDeviceCapabilities();
    if (!capabilities.touchCapable && !capabilities.isMobileSafari) {
      return; // Desktop - use standard error handling
    }

    // Mobile-specific error recovery
    if (capabilities.isMobileSafari) {
      // Safari mobile specific recovery
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('resize'));
        }
      }, 300); // Safari mobile needs delay
    }

    // General mobile error patterns
    setTimeout(() => {
      if (typeof document !== 'undefined') {
        document.body.style.touchAction = 'pan-x pan-y';
      }
    }, 100);
  },

  // Phase 2 Step 7 Action 4: Mobile loading state validation
  validateMobileLoadingState: (
    loadingState: string,
    imagesLoaded: boolean,
    canvasReady: boolean,
  ) => {
    const capabilities = getDeviceCapabilities();
    if (!capabilities.touchCapable && !capabilities.isMobileSafari) {
      return { valid: true, issues: [] };
    }

    const issues: string[] = [];

    // Mobile-specific validation
    if (loadingState === 'ready' && !imagesLoaded) {
      issues.push('Mobile: Loading state ready but images not loaded');
    }

    if (loadingState === 'ready' && !canvasReady) {
      issues.push('Mobile: Loading state ready but canvas not ready');
    }

    // Safari mobile specific checks
    if (capabilities.isMobileSafari) {
      if (loadingState === 'ready' && capabilities.devicePixelRatio > 3) {
        issues.push('Safari mobile: High DPR may cause viewport instability');
      }

      if (loadingState === 'intro' && capabilities.performanceTier === 'low') {
        issues.push('Safari mobile: Low performance tier may affect intro animations');
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations:
        issues.length > 0
          ? [
              'Consider delaying touch interactions until all systems ready',
              'Apply Safari mobile DPR stabilization if needed',
              'Use performance-appropriate animation settings',
            ]
          : [],
    };
  },

  // Phase 2 Step 7 Action 4: Safe mobile viewport operations
  safeMobileViewportOperation: (operation: () => void) => {
    const capabilities = getDeviceCapabilities();

    try {
      if (capabilities.isMobileSafari) {
        // Safari mobile: Apply with proper timing
        setTimeout(() => {
          try {
            operation();
          } catch (error) {
            mobileUtils.handleMobileLoadingStateError();
          }
        }, 100); // Small delay for Safari mobile stability
      } else if (capabilities.touchCapable) {
        // Other mobile: Direct execution with error handling
        operation();
      } else {
        // Desktop: Direct execution
        operation();
      }
    } catch (error) {
      mobileUtils.handleMobileLoadingStateError();
    }
  },
};

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

  // Phase 2 Step 7 Action 1: Mobile-specific utilities integration
  isMobileSafari: () => mobileUtils.isMobileSafari(),
  getStableMobileDPR: () => mobileUtils.getStableMobileDPR(),
  getMobileCanvasDimensions: () => mobileUtils.getMobileCanvasDimensions(),
  getStableMobileDimensions: () => mobileUtils.getStableMobileDimensions(),
};

/**
 * Debug information for troubleshooting browser-specific issues
 * Phase 2 Step 5 Action 1-2: Enhanced with device capability information and standardized animation durations
 * Phase 2 Step 7 Action 1: Enhanced with mobile-specific diagnostics
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
Mobile Safari: ${deviceCapabilities.isMobileSafari ? 'yes' : 'no'}
Touch Capable: ${deviceCapabilities.touchCapable ? 'yes' : 'no'}
Screen Size: ${deviceCapabilities.screenSize.width}x${deviceCapabilities.screenSize.height}
Pixel Density: ${deviceCapabilities.pixelDensityCategory} (${deviceCapabilities.devicePixelRatio}x)
Orientation Support: ${deviceCapabilities.orientationCapable ? 'yes' : 'no'}
Target FPS: ${optimizations.targetFPS}
Animation Duration: ${optimizations.animationDuration}ms (standardized across browsers)
Space Animation: ${optimizations.enableSpaceAnimation ? 'enabled' : 'disabled'}
Gradient Cache: ${optimizations.gradientCacheSize} items, ${optimizations.gradientCacheClearInterval}ms interval`;
}

/**
 * Check if the browser supports SVG filters
 * Uses simple feature detection without complex testing
 */
export const supportsSVGFilters = (): boolean => {
  try {
    // Simple feature detection - check if we can create SVG filter elements
    if (typeof document === 'undefined') return false;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');

    // Check if elements were created successfully and have expected properties
    return !!(
      svg &&
      filter &&
      feGaussianBlur &&
      'stdDeviation' in feGaussianBlur &&
      'appendChild' in filter
    );
  } catch (error) {
    return false;
  }
};

/**
 * Get CSS filter fallback for neon effects when SVG filters aren't supported
 * Returns appropriate CSS filter string based on device capabilities
 */
export const getNeonFallbackFilter = (): string => {
  const performanceTier = browserUtils.getDevicePerformanceTier();

  // High-end devices get more complex CSS filters
  if (performanceTier === 'high') {
    return 'drop-shadow(0 0 4px #D7BF75) drop-shadow(0 0 8px #D7BF75) drop-shadow(0 0 12px rgba(215, 191, 117, 0.4))';
  }

  // Medium devices get balanced effects
  if (performanceTier === 'medium') {
    return 'drop-shadow(0 0 6px #D7BF75) drop-shadow(0 0 12px rgba(215, 191, 117, 0.3))';
  }

  // Low-end devices get simple effects
  return 'drop-shadow(0 0 8px #D7BF75)';
};

/**
 * Check if browser supports advanced graphics features
 * Combines SVG filter support with device performance tier
 */
export const supportsAdvancedGraphics = (): boolean => {
  const hasSVGFilters = supportsSVGFilters();
  const performanceTier = browserUtils.getDevicePerformanceTier();

  // Advanced graphics require both SVG filter support AND sufficient performance
  return hasSVGFilters && (performanceTier === 'high' || performanceTier === 'medium');
};

/**
 * Check if the browser supports backdrop-filter (backdrop-blur)
 * Uses simple CSS property detection without complex testing
 */
export const supportsBackdropFilter = (): boolean => {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;

    // Create a test element to check CSS property support
    const testElement = document.createElement('div');
    const testStyles = [
      'backdrop-filter',
      '-webkit-backdrop-filter', // Safari/older browsers
      '-moz-backdrop-filter', // Firefox (future)
    ];

    // Check if any backdrop-filter variant is supported
    for (const property of testStyles) {
      if (property in testElement.style) {
        return true;
      }
    }

    return false;
  } catch (error) {
    return false;
  }
};

/**
 * Get backdrop-blur fallback styles based on device capabilities
 * Returns appropriate CSS properties for browsers without backdrop-filter support
 */
export const getBackdropBlurFallback = (blurIntensity: 'sm' | 'xl' = 'sm'): string => {
  const performanceTier = browserUtils.getDevicePerformanceTier();

  // Base fallback using box-shadow and background for blur effect simulation
  const baseBackground = 'rgba(0, 0, 0, 0.85)'; // Slightly more opaque for visual weight

  if (blurIntensity === 'xl') {
    // Strong blur fallback for modals
    if (performanceTier === 'high') {
      return `background: ${baseBackground}; box-shadow: inset 0 0 60px 20px rgba(0, 0, 0, 0.3);`;
    } else if (performanceTier === 'medium') {
      return `background: ${baseBackground}; box-shadow: inset 0 0 40px 15px rgba(0, 0, 0, 0.25);`;
    } else {
      return `background: rgba(0, 0, 0, 0.9);`; // Simple solid background for low-end
    }
  } else {
    // Light blur fallback for loading bar
    if (performanceTier === 'high' || performanceTier === 'medium') {
      return `background: rgba(0, 0, 0, 0.4); box-shadow: inset 0 0 20px 5px rgba(0, 0, 0, 0.2);`;
    } else {
      return `background: rgba(0, 0, 0, 0.6);`; // Simple semi-transparent background
    }
  }
};

/**
 * Get complete backdrop-filter CSS with fallbacks
 * Returns CSS properties with progressive enhancement
 */
export const getBackdropFilterCSS = (
  blurIntensity: 'sm' | 'xl' = 'sm',
): {
  backdropFilter?: string;
  WebkitBackdropFilter?: string;
  background?: string;
  boxShadow?: string;
} => {
  const hasBackdropSupport = supportsBackdropFilter();

  if (hasBackdropSupport) {
    // Use native backdrop-filter with vendor prefixes
    const blurValue = blurIntensity === 'xl' ? 'blur(24px)' : 'blur(4px)';
    return {
      backdropFilter: blurValue,
      WebkitBackdropFilter: blurValue, // Safari support
    };
  } else {
    // Parse fallback CSS into individual properties
    const fallbackCSS = getBackdropBlurFallback(blurIntensity);
    const cssProps: { background?: string; boxShadow?: string } = {};

    // Extract background and box-shadow from fallback string
    const backgroundMatch = fallbackCSS.match(/background:\s*([^;]+);?/);
    const boxShadowMatch = fallbackCSS.match(/box-shadow:\s*([^;]+);?/);

    if (backgroundMatch) cssProps.background = backgroundMatch[1].trim();
    if (boxShadowMatch) cssProps.boxShadow = boxShadowMatch[1].trim();

    return cssProps;
  }
};

// Phase 2 Step 8 Action 2: Cross-Browser Scroll Restoration Safety
export const supportsScrollRestoration = (): boolean => {
  if (typeof window === 'undefined' || typeof history === 'undefined') {
    return false;
  }

  try {
    // Feature detection: Check if scrollRestoration property exists and is writable
    return 'scrollRestoration' in history && typeof history.scrollRestoration === 'string';
  } catch (error) {
    // Some browsers throw errors when accessing scrollRestoration
    return false;
  }
};

export const setScrollRestoration = (mode: 'auto' | 'manual'): boolean => {
  if (!supportsScrollRestoration()) {
    return false;
  }

  try {
    history.scrollRestoration = mode;
    return true;
  } catch (error) {
    return false;
  }
};

export const getScrollRestoration = (): 'auto' | 'manual' | null => {
  if (!supportsScrollRestoration()) {
    return null;
  }

  try {
    return history.scrollRestoration as 'auto' | 'manual';
  } catch (error) {
    return null;
  }
};
