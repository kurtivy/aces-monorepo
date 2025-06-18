/**
 * Browser Detection and Performance Optimization Utilities
 *
 * Centralizes all browser detection logic to eliminate scattered user-agent checks
 * and provides clear documentation for why each browser needs special handling.
 *
 * Phase 1 Step 7: Standardize Browser Detection and Remove Unnecessary Workarounds
 */

interface BrowserInfo {
  name: 'chrome' | 'firefox' | 'safari' | 'edge' | 'brave' | 'unknown';
  version: string;
  isMobile: boolean;
  needsPerformanceMode: boolean;
  platform: 'desktop' | 'mobile' | 'tablet';
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

  // Determine if browser needs performance mode
  // Safari and Firefox require performance optimizations for smooth canvas animations
  const needsPerformanceMode = browserName === 'safari' || browserName === 'firefox';

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
 * Consolidates all performance settings that were scattered across components
 */
export function getBrowserOptimizations(browser: BrowserInfo): BrowserOptimizations {
  const baseOptimizations: BrowserOptimizations = {
    targetFPS: 60,
    animationDuration: 600,
    mouseCheckInterval: 16,
    enableSpaceAnimation: true,
    enableComplexDotPattern: true,
    enableImageSmoothing: true,
    useLinearEasing: false,
    frameThrottling: false,
  };

  // Safari-specific optimizations
  // Safari struggles with complex canvas animations and requires performance mode
  if (browser.name === 'safari') {
    return {
      ...baseOptimizations,
      targetFPS: 30, // Reduced frame rate for smooth hover animations
      animationDuration: 200, // Faster animations to reduce computation time
      mouseCheckInterval: 50, // Less frequent mouse checks
      enableSpaceAnimation: false, // Disable space animation entirely
      enableComplexDotPattern: false, // Simplified dot patterns only
      useLinearEasing: true, // Linear easing reduces mathematical computation
      frameThrottling: true, // Enable frame throttling
    };
  }

  // Firefox-specific optimizations
  // Firefox has different performance characteristics and needs specific tuning
  if (browser.name === 'firefox') {
    return {
      ...baseOptimizations,
      targetFPS: 60, // Full frame rate (Firefox handles this better than Safari)
      animationDuration: 500, // Medium speed animations
      mouseCheckInterval: 50, // Match Safari interval for consistency
      enableSpaceAnimation: false, // Disable space animation during loading
      enableComplexDotPattern: false, // Simplified dot patterns
      enableImageSmoothing: true, // Keep image smoothing (Firefox handles this well)
      useLinearEasing: false, // Firefox can handle easing functions
      frameThrottling: false, // No frame throttling needed
    };
  }

  // Chrome/Edge/Brave - full performance (baseline)
  return baseOptimizations;
}

/**
 * Singleton browser detection - detect once, use everywhere
 */
let cachedBrowser: BrowserInfo | null = null;
let cachedOptimizations: BrowserOptimizations | null = null;

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
};

/**
 * Debug information for troubleshooting browser-specific issues
 */
export function getBrowserDebugInfo(): string {
  const browser = getBrowser();
  const optimizations = getBrowserPerformanceSettings();

  return `Browser: ${browser.name} ${browser.version} (${browser.platform}${browser.isMobile ? ', mobile' : ''})
Performance Mode: ${browser.needsPerformanceMode ? 'enabled' : 'disabled'}
Target FPS: ${optimizations.targetFPS}
Animation Duration: ${optimizations.animationDuration}ms
Space Animation: ${optimizations.enableSpaceAnimation ? 'enabled' : 'disabled'}`;
}
