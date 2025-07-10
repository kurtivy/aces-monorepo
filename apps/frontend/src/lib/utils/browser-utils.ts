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
    availableMemory: 2048, // More realistic mobile default
    memoryPressure: 'medium',
    hardwareConcurrency: 4,
    devicePixelRatio: 2, // More typical for modern mobile devices
    supportsWebGL: true, // Most modern mobile devices support WebGL
    supportsOffscreenCanvas: false,
    performanceTier: 'medium',
    // Phase 2 Step 7 Action 1: Mobile defaults
    isMobileSafari: false,
    screenSize: { width: 375, height: 812 }, // iPhone X/XS screen size as default
    touchCapable: true, // More realistic mobile default
    orientationCapable: true,
    pixelDensityCategory: 'high',
  };

  // Add a global flag to track hydration state
  if (typeof window !== 'undefined') {
    (window as Window & { __ACES_HYDRATION_SAFE__?: boolean }).__ACES_HYDRATION_SAFE__ = true;
  }

  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return defaultCapabilities;
  }

  // Get userAgent early for platform detection
  const userAgent = navigator.userAgent.toLowerCase();

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
      }
      // FIX: Apply similar memory adjustments for iOS devices like iPhone XS
      else if (/iphone|ipad|ipod/.test(userAgent) && rawMemory > 1024) {
        // iOS devices also underreport memory, especially iPhone XS/Pro models
        console.log('iOS Memory Adjustment - Before:', { rawMemory, userAgent });
        if (rawMemory >= 1536) {
          rawMemory = Math.min(rawMemory * 1.6, 8192); // 1.6x multiplier for iPhone XS+ level devices
          console.log('iOS Memory Adjustment - Applied 1.6x multiplier:', {
            newMemory: rawMemory,
          });
        } else if (rawMemory >= 1024) {
          rawMemory = Math.min(rawMemory * 1.3, 4096); // 1.3x multiplier for older iOS devices
          console.log('iOS Memory Adjustment - Applied 1.3x multiplier:', {
            newMemory: rawMemory,
          });
        }
        console.log('iOS Memory Adjustment - After:', { rawMemory });
      }
      // FIX: Handle M1 Mac Safari memory detection failure
      else if (!isWindows && !isAndroid && rawMemory <= 1024) {
        // Likely Safari on Mac without performance.memory API access
        console.log('Mac Safari Memory Fallback - Detected Safari without memory API');
        // Use navigator.hardwareConcurrency to estimate Mac tier
        const cores = navigator.hardwareConcurrency || 4;
        if (cores >= 8) {
          rawMemory = 8192; // M1 Pro/Max level (8-16GB typical)
          console.log('Mac Safari Memory Fallback - Applied M1 Pro/Max estimate:', {
            newMemory: rawMemory,
            cores,
          });
        } else if (cores >= 4) {
          rawMemory = 4096; // M1 base level (8GB typical)
          console.log('Mac Safari Memory Fallback - Applied M1 base estimate:', {
            newMemory: rawMemory,
            cores,
          });
        } else {
          rawMemory = 2048; // Older Intel Mac
          console.log('Mac Safari Memory Fallback - Applied Intel Mac estimate:', {
            newMemory: rawMemory,
            cores,
          });
        }
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

  // FIX: More reasonable high performance thresholds for modern devices
  // Desktop: >2GB RAM, ≥4 cores, WebGL support, not high memory pressure
  // Mobile: >1.8GB RAM, ≥4 cores, WebGL support (iPhone XS easily qualifies)
  if (
    availableMemory > 2048 && // Lowered from 2560 to 2048 (2GB) for modern systems
    hardwareConcurrency >= 4 &&
    supportsWebGL &&
    memoryPressure !== 'high' &&
    (!isMobileDevice || (availableMemory > 1800 && hardwareConcurrency >= 4)) // Mobile: >1.8GB RAM, ≥4 cores (iPhone XS: ~2.5GB after adjustment, 6 cores)
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
 * HOLISTIC APPROACH: Canvas-first performance optimization
 */
export function getBrowserOptimizations(): BrowserOptimizations {
  // HOLISTIC APPROACH: Canvas-first performance optimization
  // Priority #1: Buttery smooth canvas traversal across ALL browsers and devices
  const deviceCapabilities = detectDeviceCapabilities();

  // CANVAS-FOCUSED BASE SETTINGS: Optimized for smooth traversal, not visual effects
  const canvasFocusedOptimizations: BrowserOptimizations = {
    targetFPS: 60, // Always target 60fps for smooth canvas
    animationDuration: 350, // Fast animations to minimize interference
    mouseCheckInterval: 20, // STANDARDIZED across all browsers - no more browser favoritism

    // CANVAS SMOOTHNESS PRIORITY: Disable all non-essential effects
    enableComplexDotPattern: false, // DISABLED - GPU overhead
    enableImageSmoothing: true, // Keep for quality, optimized separately

    // SIMPLE ANIMATIONS: Prioritize performance over visual complexity
    useLinearEasing: true, // Simpler math = smoother performance
    frameThrottling: false, // NEVER throttle - smoothness is priority

    // MEMORY MANAGEMENT: Conservative settings for stability
    gradientCacheSize: 100, // Balanced across all devices
    gradientCacheClearInterval: 45000, // Standard interval
  };

  // DEVICE-SPECIFIC ADJUSTMENTS: Only where absolutely necessary for stability
  if (deviceCapabilities.performanceTier === 'low') {
    return {
      ...canvasFocusedOptimizations,
      targetFPS: 45, // Slightly reduced for truly low-end devices
      mouseCheckInterval: 30, // Slightly slower for memory-constrained devices
      gradientCacheSize: 50, // Smaller cache
      gradientCacheClearInterval: 30000, // More frequent clearing
    };
  }

  // CRITICAL: High and medium devices get IDENTICAL settings
  // No more "high tier gets more effects" - focus on smoothness
  if (
    deviceCapabilities.performanceTier === 'medium' ||
    deviceCapabilities.performanceTier === 'high'
  ) {
    return {
      ...canvasFocusedOptimizations,
      // Enhanced settings for canvas smoothness (not visual effects)
      mouseCheckInterval: 16, // Slightly faster for better responsiveness
      animationDuration: 300, // Slightly faster animations
      gradientCacheSize: 150, // Slightly larger cache for smooth scrolling
    };
  }

  return canvasFocusedOptimizations;
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
    cachedOptimizations = getBrowserOptimizations();
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
 * Issue #1: Safari RAF Throttling Detection
 * Detects if the browser is throttling requestAnimationFrame to 30fps (low power mode)
 * This is crucial for iOS devices in low power mode or background tabs
 */
export const detectLowPowerMode = (): Promise<boolean> => {
  if (typeof window === 'undefined') return Promise.resolve(false);

  return new Promise((resolve) => {
    const startTime = performance.now();
    let frameCount = 0;

    const measureRAF = () => {
      frameCount++;
      if (frameCount < 10) {
        requestAnimationFrame(measureRAF);
      } else {
        const elapsed = performance.now() - startTime;
        const avgFrameTime = elapsed / frameCount;
        // If average frame time > 25ms, likely throttled to 30fps
        const isThrottled = avgFrameTime > 25;

        // Debug logging for performance monitoring
        if (typeof console !== 'undefined' && console.log) {
          console.log('🎯 RAF Throttling Detection:', {
            avgFrameTime: avgFrameTime.toFixed(2) + 'ms',
            estimatedFPS: (1000 / avgFrameTime).toFixed(1),
            isThrottled,
            frameCount,
            totalTime: elapsed.toFixed(2) + 'ms',
          });
        }

        resolve(isThrottled);
      }
    };
    requestAnimationFrame(measureRAF);
  });
};

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
  // Space animation completely removed for performance
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
Space Animation: disabled (removed for performance)
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
