import type {
  DeviceCapabilities,
  MemoryCapabilities,
  GPUCapabilities,
} from '../../types/capabilities';
import { CapabilityFeatureFlagManager } from '../utils/feature-flags';
import { CapabilityCache } from './capability-cache';
import { BrowserFeatureDetector } from './browser-feature-detector';

// Interface for performance.memory API
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

/**
 * Enhanced capability detection engine with multi-tier fallback system
 * Replaces brittle device detection with actual capability measurement
 */
export class CapabilityDetector {
  private estimationId: string;
  private browserDetector: BrowserFeatureDetector;

  constructor() {
    this.estimationId = Math.random().toString(36).slice(2);
    this.browserDetector = new BrowserFeatureDetector();
  }

  /**
   * Main capability detection with enhanced fallback cascade
   */
  async detectCapabilities(): Promise<DeviceCapabilities> {
    try {
      if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
        console.log(`🔍 Starting capability detection (${this.estimationId})`);
      }

      // Check cache first if caching is enabled
      if (CapabilityFeatureFlagManager.isEnabled('capabilityCache')) {
        const cached = CapabilityCache.getCachedCapabilities();
        if (cached) {
          if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
            console.log(`✅ Using cached capabilities`);
          }
          return cached;
        }
      }

      const [gpu, memory, additionalCapabilities] = await Promise.all([
        this.detectGPUCapabilities(),
        this.detectMemoryCapabilitiesEnhanced(),
        this.detectAdditionalCapabilities(),
      ]);

      // Simple frame rate test
      const frameRateCapability = await this.measureFrameRate();

      const capabilities: DeviceCapabilities = {
        ...gpu,
        ...memory,
        ...additionalCapabilities,
        frameRateCapability,
        thermalState: 'normal',
        performanceTier: this.calculatePerformanceTier({ ...gpu, ...memory, frameRateCapability }),
        detectionMethod: 'full',
        detectionTimestamp: Date.now(),
      };

      if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
        console.log(`✅ Capability detection complete`, capabilities);
      }

      // Cache the results if caching is enabled
      if (CapabilityFeatureFlagManager.isEnabled('capabilityCache')) {
        CapabilityCache.setCachedCapabilities(capabilities);
      }

      return capabilities;
    } catch (error) {
      console.warn('Capability detection failed, using conservative fallback:', error);
      return this.getConservativeFallback();
    }
  }

  /**
   * ENHANCED: Multi-tier memory capability detection with navigator API fallbacks
   */
  private async detectMemoryCapabilitiesEnhanced(): Promise<MemoryCapabilities> {
    if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
      console.log('🧠 Starting enhanced memory detection...');
    }

    try {
      // Tier 1: performance.memory API (Chrome-specific but most accurate)
      const memory = (performance as unknown as { memory?: PerformanceMemory }).memory;
      if (memory && memory.usedJSHeapSize && memory.totalJSHeapSize) {
        if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
          console.log('📊 Using performance.memory API (Tier 1)');
        }
        return this.analyzePerformanceMemory(memory);
      }

      // Tier 2: Navigator APIs as fallbacks (wider browser support)
      const deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
      const hardwareConcurrency = navigator.hardwareConcurrency;

      if (deviceMemory && hardwareConcurrency) {
        if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
          console.log('📱 Using navigator.deviceMemory API (Tier 2)', {
            deviceMemory,
            hardwareConcurrency,
          });
        }
        return this.estimateFromNavigatorAPIs(deviceMemory, hardwareConcurrency);
      }

      // Tier 3: Conservative fallback (iOS/Safari will use this)
      if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
        console.log('🍎 Using conservative fallback (Tier 3) - likely iOS/Safari');
      }
      return this.getConservativeMemoryFallback();
    } catch (error) {
      console.warn('All memory detection methods failed:', error);
      if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
        console.log('💥 Memory detection error, using fallback');
      }
      return this.getConservativeMemoryFallback();
    }
  }

  /**
   * Analyze performance.memory API for accurate memory information
   */
  private analyzePerformanceMemory(memory: PerformanceMemory): MemoryCapabilities {
    const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
    const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);

    // Calculate memory pressure based on usage ratios
    const usageRatio = usedMB / limitMB;
    let memoryPressure: 'low' | 'medium' | 'high' = 'medium';

    if (usageRatio < 0.6) {
      memoryPressure = 'low';
    } else if (usageRatio > 0.8) {
      memoryPressure = 'high';
    }

    // Estimate available memory (conservative approach for mobile compatibility)
    const availableMemoryMB = Math.max(limitMB * 0.7, 1024); // At least 1GB

    return {
      availableMemoryMB,
      memoryPressure,
      detectionMethod: 'performance_memory',
    };
  }

  /**
   * Estimate capabilities from Navigator APIs (broader browser support)
   */
  private estimateFromNavigatorAPIs(deviceMemoryGB: number, cores: number): MemoryCapabilities {
    // Convert GB to MB and estimate available memory
    const totalMemoryMB = deviceMemoryGB * 1024;

    // Estimate memory pressure based on cores and total memory
    let memoryPressure: 'low' | 'medium' | 'high' = 'medium';

    const memoryPerCore = totalMemoryMB / cores;
    if (memoryPerCore > 2048) {
      // >2GB per core
      memoryPressure = 'low';
    } else if (memoryPerCore < 1024) {
      // <1GB per core
      memoryPressure = 'high';
    }

    return {
      availableMemoryMB: Math.floor(totalMemoryMB * 0.7), // 70% available assumption
      memoryPressure,
      detectionMethod: 'navigator_apis',
    };
  }

  /**
   * Enhanced fallback with iOS/Safari device-specific detection
   */
  private getConservativeMemoryFallback(): MemoryCapabilities {
    // Enhanced iOS/Safari detection for high-end devices
    if (typeof navigator !== 'undefined') {
      const userAgent = navigator.userAgent.toLowerCase();
      const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome');
      const isIOS = /iphone|ipad|ipod/.test(userAgent);

      if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
        console.log('🍎 iOS/Safari Detection Check:', {
          userAgent: navigator.userAgent,
          userAgentLower: userAgent,
          isSafari,
          isIOS,
          willUseEnhancedDetection: isSafari || isIOS,
        });
      }

      if (isSafari || isIOS) {
        const iosMemory = this.estimateIOSDeviceMemorySimplified(userAgent);

        if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
          console.log('✅ Using simplified iOS memory detection:', iosMemory);
        }

        return iosMemory;
      }
    }

    return {
      availableMemoryMB: 2048, // Conservative 2GB assumption for unknown devices
      memoryPressure: 'medium',
      detectionMethod: 'fallback',
    };
  }

  /**
   * Simple iOS device memory estimation - focus on Low Power Mode detection
   * The real issue was Low Power Mode affecting performance tier, not memory detection complexity
   */
  private estimateIOSDeviceMemorySimplified(userAgent: string): MemoryCapabilities {
    // Simple Low Power Mode detection - this was likely the real culprit!
    const isLowPowerMode = this.detectLowPowerMode();

    if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
      console.log('📱 iOS Detection - Low Power Mode:', isLowPowerMode);
    }

    // iPad - assume modern and capable
    if (userAgent.includes('ipad')) {
      return {
        availableMemoryMB: 4200, // Modern iPads have plenty of memory
        memoryPressure: isLowPowerMode ? 'medium' : 'low',
        detectionMethod: 'ios_device_model',
      };
    }

    // iPhone - be generous for any modern iPhone (iPhone XS and newer should be high-tier)
    // Low Power Mode affects performance tier calculation, not memory availability
    if (userAgent.includes('iphone')) {
      return {
        availableMemoryMB: 4200, // Assume modern iPhone has good memory (6GB range)
        memoryPressure: isLowPowerMode ? 'medium' : 'low', // Low Power Mode affects this
        detectionMethod: 'ios_device_model',
      };
    }

    // Safari on Mac
    return {
      availableMemoryMB: 4200, // Assume decent Mac
      memoryPressure: 'low',
      detectionMethod: 'safari_desktop',
    };
  }

  /**
   * Detect iOS Low Power Mode - the likely culprit for iPhone Pro 13 Max showing as medium tier
   */
  private detectLowPowerMode(): boolean {
    if (typeof navigator === 'undefined' || !navigator.userAgent.includes('iPhone')) {
      return false;
    }

    // Method 1: Check if reduced motion is preferred (often enabled in Low Power Mode)
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    // Method 2: Check if device has limited hardware concurrency reporting
    const limitedConcurrency = navigator.hardwareConcurrency <= 2;

    // Method 3: Basic performance test - Low Power Mode throttles JavaScript
    const startTime = performance.now();
    let iterations = 0;
    const endTime = startTime + 5; // 5ms test
    while (performance.now() < endTime) {
      iterations++;
    }
    const iterationsPerMs = iterations / 5;
    const lowPerformance = iterationsPerMs < 10000; // Threshold for throttled performance

    const isLowPowerMode = prefersReducedMotion || (limitedConcurrency && lowPerformance);

    if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
      console.log('🔋 Low Power Mode Detection:', {
        prefersReducedMotion,
        limitedConcurrency,
        iterationsPerMs,
        lowPerformance,
        result: isLowPowerMode,
      });
    }

    return isLowPowerMode;
  }

  /**
   * GPU capability detection with enhanced error handling
   */
  private async detectGPUCapabilities(): Promise<GPUCapabilities> {
    try {
      const canvas = document.createElement('canvas');

      // Try WebGL2 first, then fallback to WebGL1
      let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
      let supportsWebGL2 = false;

      try {
        gl = canvas.getContext('webgl2', {
          failIfMajorPerformanceCaveat: false,
        }) as WebGL2RenderingContext | null;
        if (gl) {
          supportsWebGL2 = true;
          if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
            console.log('✅ WebGL2 context created successfully');
          }
        }
      } catch (webgl2Error) {
        if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
          console.log('⚠️ WebGL2 context creation failed:', webgl2Error);
        }
      }

      // Fallback to WebGL1 if WebGL2 failed
      if (!gl) {
        try {
          gl = (canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) ||
            canvas.getContext('experimental-webgl', {
              failIfMajorPerformanceCaveat: false,
            })) as WebGLRenderingContext | null;
          if (gl && CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
            console.log('✅ WebGL1 context created successfully');
          }
        } catch (webglError) {
          if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
            console.log('⚠️ WebGL1 context creation failed:', webglError);
          }
        }
      }

      // If no WebGL context available
      if (!gl) {
        if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
          console.log('❌ No WebGL context available, using fallback');
        }
        return this.getGPUFallback();
      }

      // Get GPU information safely
      let vendor = 'Unknown';
      let renderer = 'Unknown';

      try {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          vendor = (gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) as string) || 'Unknown';
          renderer = (gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string) || 'Unknown';
        }
      } catch (debugError) {
        if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
          console.log('⚠️ GPU debug info not available:', debugError);
        }
      }

      // Get max texture size safely
      let maxTextureSize = 2048; // Safe default
      try {
        maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
      } catch (textureError) {
        if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
          console.log('⚠️ Could not get max texture size:', textureError);
        }
      }

      // Estimate GPU memory with enhanced error handling
      let gpuMemoryMB = 150; // Conservative default

      if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
        console.log('🎮 Starting GPU memory estimation...', {
          vendor,
          renderer,
          maxTextureSize,
          webgl2Support: supportsWebGL2,
        });
      }

      try {
        gpuMemoryMB = await this.estimateGPUMemory(gl);

        if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
          console.log('✅ GPU memory estimation completed:', {
            estimatedMemoryMB: gpuMemoryMB,
            vendor,
            renderer,
          });
        }
      } catch (memoryError) {
        if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
          console.log('⚠️ GPU memory estimation failed, using fallback:', {
            error: memoryError,
            fallbackMemoryMB: gpuMemoryMB,
            vendor,
            renderer,
          });
        }
        // Track GPU memory estimation failure
        this.trackCapabilityMetric('gpu_memory_estimation_failed', {
          error: memoryError instanceof Error ? memoryError.message : 'Unknown error',
          vendor,
          renderer,
          maxTextureSize,
        });
      }

      return {
        maxTextureSize,
        gpuMemoryMB,
        supportsWebGL2,
        gpuVendor: vendor,
        gpuRenderer: renderer,
      };
    } catch (error) {
      console.warn('GPU detection completely failed:', error);

      // Track complete GPU detection failure
      this.trackCapabilityMetric('gpu_detection_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userAgent: navigator.userAgent.slice(0, 100),
      });

      return this.getGPUFallback();
    }
  }

  /**
   * GPU memory estimation with timeout and monitoring
   */
  private async estimateGPUMemory(gl: WebGLRenderingContext): Promise<number> {
    if (CapabilityFeatureFlagManager.isEnabled('gpuMonitoring')) {
      return this.estimateGPUMemoryWithMonitoring(gl);
    }

    // Basic GPU memory estimation without monitoring
    return this.estimateGPUMemoryCore(gl);
  }

  /**
   * Enhanced GPU memory estimation with monitoring and timeouts
   */
  private async estimateGPUMemoryWithMonitoring(gl: WebGLRenderingContext): Promise<number> {
    const startTime = performance.now();

    try {
      if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
        console.log(`🔍 Starting GPU memory estimation (${this.estimationId})`);
      }

      const result = await Promise.race([
        this.estimateGPUMemoryCore(gl),
        new Promise<number>((_, reject) =>
          setTimeout(() => reject(new Error('GPU estimation timeout')), 3000),
        ),
      ]);

      const duration = performance.now() - startTime;

      // Track successful estimation
      this.trackCapabilityMetric('gpu_estimation_success', {
        estimationId: this.estimationId,
        duration,
        estimatedMemory: result,
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      });

      if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
        console.log(`✅ GPU memory estimated: ${result}MB (${duration.toFixed(1)}ms)`);
      }

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      // Track failed estimation
      this.trackCapabilityMetric('gpu_estimation_failed', {
        estimationId: this.estimationId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        userAgent: navigator.userAgent.slice(0, 100),
      });

      console.warn(
        `⚠️ GPU memory estimation failed (${duration.toFixed(1)}ms):`,
        error instanceof Error ? error.message : error,
      );

      // Return conservative fallback
      return 150; // Slightly higher than minimum for better UX
    }
  }

  /**
   * Core GPU memory estimation logic
   */
  private async estimateGPUMemoryCore(gl: WebGLRenderingContext): Promise<number> {
    const testSizes = [1024, 2048, 4096, 8192]; // Test larger sizes for modern devices
    let maxSuccessfulSize = 512;
    const textures: WebGLTexture[] = [];

    try {
      for (const size of testSizes) {
        const texture = gl.createTexture();
        if (!texture) break;

        textures.push(texture);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Try to allocate texture memory
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        const error = gl.getError();
        if (error === gl.NO_ERROR) {
          maxSuccessfulSize = size;
        } else {
          if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
            console.log(`GPU texture allocation failed at ${size}x${size}, error: ${error}`);
          }
          break;
        }

        // Add small delay to prevent overwhelming GPU (especially important on mobile)
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Clean up textures
      textures.forEach((texture) => gl.deleteTexture(texture));

      // Estimate memory based on max successful texture size
      // Formula: (width * height * 4 bytes * safety_factor) / MB
      const estimatedMemory = (maxSuccessfulSize * maxSuccessfulSize * 4 * 2) / (1024 * 1024);

      // Cap at reasonable limits for mobile devices
      const finalMemory = Math.min(Math.max(estimatedMemory, 100), 1000);

      if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
        console.log('🧮 GPU Memory Estimation Details:', {
          maxSuccessfulTextureSize: `${maxSuccessfulSize}x${maxSuccessfulSize}`,
          rawEstimatedMemory: `${estimatedMemory.toFixed(1)}MB`,
          finalMemoryWithCaps: `${finalMemory.toFixed(1)}MB`,
          texturesTestedCount: testSizes.length,
          texturesTested: testSizes,
        });
      }

      return finalMemory;
    } catch (error) {
      // Clean up any created textures
      textures.forEach((texture) => {
        try {
          gl.deleteTexture(texture);
        } catch {}
      });
      throw error;
    }
  }

  /**
   * GPU capability fallback when WebGL is not available
   */
  private getGPUFallback(): GPUCapabilities {
    return {
      gpuMemoryMB: 100,
      maxTextureSize: 2048,
      supportsWebGL2: false,
      gpuVendor: 'Unknown',
      gpuRenderer: 'Software Fallback',
    };
  }

  /**
   * Simple frame rate measurement
   */
  private async measureFrameRate(): Promise<number> {
    return new Promise((resolve) => {
      let frameCount = 0;
      const startTime = performance.now();

      const testFrame = () => {
        frameCount++;
        if (frameCount < 30) {
          // Shorter test for faster detection
          requestAnimationFrame(testFrame);
        } else {
          const avgFPS = 30000 / (performance.now() - startTime);
          resolve(Math.min(avgFPS, 120));
        }
      };

      requestAnimationFrame(testFrame);
    });
  }

  /**
   * Additional capability detection with enhanced browser features
   */
  private async detectAdditionalCapabilities() {
    const basicCapabilities = {
      supportsOffscreenCanvas: typeof OffscreenCanvas !== 'undefined',
      supportsIntersectionObserver: 'IntersectionObserver' in window,
      supportsResizeObserver: 'ResizeObserver' in window,
      supportsPassiveEvents: this.detectPassiveEventSupport(),
      touchCapable: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      screenSize: {
        width: window.screen?.width || window.innerWidth,
        height: window.screen?.height || window.innerHeight,
      },
      devicePixelRatio: window.devicePixelRatio || 1,
      orientationCapable: 'orientation' in window || 'onorientationchange' in window,
    };

    // Week 4: Add advanced browser feature detection if enabled
    if (CapabilityFeatureFlagManager.isEnabled('featureDetection')) {
      try {
        const browserCapabilities = await this.browserDetector.detectBrowserCapabilities();

        return {
          ...basicCapabilities,
          // Merge advanced browser capabilities
          ...browserCapabilities,
        };
      } catch (error) {
        console.warn('Advanced browser feature detection failed, using basic detection:', error);
        return basicCapabilities;
      }
    }

    return basicCapabilities;
  }

  /**
   * Detect passive event support
   */
  private detectPassiveEventSupport(): boolean {
    let passiveSupported = false;
    try {
      const options = Object.defineProperty({}, 'passive', {
        get() {
          passiveSupported = true;
          return false;
        },
      });
      window.addEventListener('test', function () {}, options);
      window.removeEventListener('test', function () {}, options);
    } catch {
      // Passive events not supported
    }
    return passiveSupported;
  }

  /**
   * SIMPLIFIED: Calculate performance tier with more generous thresholds for modern devices
   */
  private calculatePerformanceTier(capabilities: {
    gpuMemoryMB: number;
    availableMemoryMB: number;
    frameRateCapability: number;
    memoryPressure: string;
    maxTextureSize: number;
  }): 'low' | 'medium' | 'high' {
    const { gpuMemoryMB, availableMemoryMB, frameRateCapability, memoryPressure, maxTextureSize } =
      capabilities;

    // High tier: Modern devices with good resources
    // Key insight: Low Power Mode primarily affects frameRateCapability
    if (
      gpuMemoryMB > 200 &&
      availableMemoryMB > 2000 && // Reasonable threshold for modern phones
      frameRateCapability > 40 && // Slightly lower to tolerate Low Power Mode
      memoryPressure !== 'high' &&
      maxTextureSize >= 2048
    ) {
      return 'high';
    }

    // Low tier: Truly limited devices
    if (
      gpuMemoryMB < 150 ||
      availableMemoryMB < 1500 ||
      frameRateCapability < 25 ||
      memoryPressure === 'high'
    ) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Conservative fallback capabilities when detection fails
   */
  getConservativeFallback(): DeviceCapabilities {
    // Use basic capabilities for fallback (no advanced browser detection)
    const basicCapabilities = {
      supportsOffscreenCanvas: typeof OffscreenCanvas !== 'undefined',
      supportsIntersectionObserver: 'IntersectionObserver' in window,
      supportsResizeObserver: 'ResizeObserver' in window,
      supportsPassiveEvents: this.detectPassiveEventSupport(),
      touchCapable: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      screenSize: {
        width: window.screen?.width || window.innerWidth,
        height: window.screen?.height || window.innerHeight,
      },
      devicePixelRatio: window.devicePixelRatio || 1,
      orientationCapable: 'orientation' in window || 'onorientationchange' in window,
    };

    return {
      gpuMemoryMB: 100,
      maxTextureSize: 2048,
      supportsWebGL2: false,
      gpuVendor: 'Unknown',
      gpuRenderer: 'Fallback',
      frameRateCapability: 30,
      performanceTier: 'low',
      memoryPressure: 'medium',
      thermalState: 'normal',
      availableMemoryMB: 2048,
      ...basicCapabilities,
      detectionMethod: 'fallback',
      detectionTimestamp: Date.now(),
    };
  }

  /**
   * Track capability metrics for monitoring (optional analytics integration)
   */
  private trackCapabilityMetric(event: string, data: Record<string, unknown>): void {
    // Send to analytics (optional - only if analytics are enabled)
    if (
      typeof window !== 'undefined' &&
      (
        window as unknown as {
          analytics?: { track: (event: string, data: Record<string, unknown>) => void };
        }
      ).analytics
    ) {
      try {
        const analytics = (
          window as unknown as {
            analytics: { track: (event: string, data: Record<string, unknown>) => void };
          }
        ).analytics;
        analytics.track(event, {
          ...data,
          timestamp: Date.now(),
          url: window.location.pathname,
        });
      } catch (error) {
        // Silent fail - analytics shouldn't break capability detection
      }
    }
  }
}
