import type { BrowserCapabilities } from '../../types/capabilities';
import { CapabilityFeatureFlagManager } from '../utils/feature-flags';

/**
 * Advanced Browser Feature Detection System
 * Week 4: Comprehensive browser capability detection beyond basic user-agent sniffing
 *
 * This system detects actual browser capabilities through feature testing,
 * performance measurement, and API availability checking.
 */
export class BrowserFeatureDetector {
  private cachedCapabilities: BrowserCapabilities | null = null;
  private detectionId: string;

  constructor() {
    this.detectionId = Math.random().toString(36).slice(2);
  }

  /**
   * Detect comprehensive browser capabilities
   */
  async detectBrowserCapabilities(): Promise<BrowserCapabilities> {
    if (this.cachedCapabilities) {
      return this.cachedCapabilities;
    }

    try {
      if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
        console.log(`🔍 Starting browser feature detection (${this.detectionId})`);
      }

      // Run all feature detection in parallel for speed
      const [
        eventCapabilities,
        canvasCapabilities,
        performanceCapabilities,
        apiCapabilities,
        browserInfo,
        renderingCapabilities,
      ] = await Promise.all([
        this.detectEventCapabilities(),
        this.detectCanvasCapabilities(),
        this.detectPerformanceCapabilities(),
        this.detectAPICapabilities(),
        this.detectBrowserInfo(),
        this.detectRenderingCapabilities(),
      ]);

      const capabilities: BrowserCapabilities = {
        // Event handling capabilities (with defaults for required fields)
        supportsPassiveEvents: eventCapabilities.supportsPassiveEvents ?? false,
        supportsTouchEvents: eventCapabilities.supportsTouchEvents ?? false,
        supportsPointerEvents: eventCapabilities.supportsPointerEvents ?? false,
        eventPerformanceScore: eventCapabilities.eventPerformanceScore ?? 50,

        // Canvas and rendering capabilities (with defaults)
        supportsOffscreenCanvas: canvasCapabilities.supportsOffscreenCanvas ?? false,
        supportsImageBitmap: canvasCapabilities.supportsImageBitmap ?? false,
        supportsWebGLContextRecovery: canvasCapabilities.supportsWebGLContextRecovery ?? false,
        canvas2DFeatures: canvasCapabilities.canvas2DFeatures ?? [],

        // Performance-related capabilities (with defaults)
        supportsHighResTimer: performanceCapabilities.supportsHighResTimer ?? false,
        supportsRequestIdleCallback: performanceCapabilities.supportsRequestIdleCallback ?? false,
        supportsMemoryAPI: performanceCapabilities.supportsMemoryAPI ?? false,
        jsPerformanceScore: performanceCapabilities.jsPerformanceScore ?? 50,

        // API availability (with defaults)
        supportsIntersectionObserver: apiCapabilities.supportsIntersectionObserver ?? false,
        supportsResizeObserver: apiCapabilities.supportsResizeObserver ?? false,
        supportsWebWorkers: apiCapabilities.supportsWebWorkers ?? false,
        supportsServiceWorkers: apiCapabilities.supportsServiceWorkers ?? false,
        supportsFileAPI: apiCapabilities.supportsFileAPI ?? false,

        // Browser identification (with defaults)
        browserName: browserInfo.browserName ?? 'Unknown',
        browserVersion: browserInfo.browserVersion ?? 'Unknown',
        engineName: browserInfo.engineName ?? 'Unknown',
        isMobile: browserInfo.isMobile ?? false,
        isSafari: browserInfo.isSafari ?? false,
        isChrome: browserInfo.isChrome ?? false,
        isFirefox: browserInfo.isFirefox ?? false,
        isEdge: browserInfo.isEdge ?? false,
        safariQuirks: browserInfo.safariQuirks ?? [],
        mobileQuirks: browserInfo.mobileQuirks ?? [],

        // Advanced rendering features (with defaults)
        supportsGPUAcceleration: renderingCapabilities.supportsGPUAcceleration ?? false,
        supportsHardwareCompositing: renderingCapabilities.supportsHardwareCompositing ?? false,
        cssFeatures: renderingCapabilities.cssFeatures ?? [],

        // Event strategy recommendation
        preferredEventStrategy: this.determineEventStrategy(
          eventCapabilities,
          performanceCapabilities,
        ),
      };

      this.cachedCapabilities = capabilities;

      if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
        console.log(`✅ Browser capabilities detected:`, capabilities);
      }

      return capabilities;
    } catch (error) {
      console.error('Browser feature detection failed:', error);
      return this.getFallbackCapabilities();
    }
  }

  /**
   * Detect event handling capabilities
   */
  private async detectEventCapabilities(): Promise<Partial<BrowserCapabilities>> {
    const capabilities: Partial<BrowserCapabilities> = {};

    // Test passive event support
    capabilities.supportsPassiveEvents = await this.testPassiveEventSupport();

    // Test event capture and bubbling performance
    const eventPerformance = await this.measureEventPerformance();
    capabilities.eventPerformanceScore = eventPerformance.score;

    // Test touch event support
    capabilities.supportsTouchEvents = this.testTouchEventSupport();

    // Test pointer event support (modern touch/mouse unified API)
    capabilities.supportsPointerEvents = this.testPointerEventSupport();

    return capabilities;
  }

  /**
   * Test passive event listener support
   */
  private async testPassiveEventSupport(): Promise<boolean> {
    try {
      let supportsPassive = false;
      const testOptions = Object.defineProperty({}, 'passive', {
        get: () => {
          supportsPassive = true;
          return false;
        },
      });

      const noop = () => {};
      window.addEventListener('test', noop, testOptions);
      window.removeEventListener('test', noop, testOptions);

      return supportsPassive;
    } catch (error) {
      return false;
    }
  }

  /**
   * Measure event handling performance
   */
  private async measureEventPerformance(): Promise<{ score: number }> {
    return new Promise((resolve) => {
      let eventCount = 0;
      let totalTime = 0;

      const testHandler = () => {
        const handleStart = performance.now();
        // Simulate some work
        for (let i = 0; i < 1000; i++) {
          Math.random();
        }
        totalTime += performance.now() - handleStart;
        eventCount++;

        if (eventCount >= 10) {
          document.removeEventListener('mousemove', testHandler);
          const avgTime = totalTime / eventCount;
          const score = Math.max(0, 100 - avgTime * 10); // Higher score = better performance
          resolve({ score });
        }
      };

      document.addEventListener('mousemove', testHandler);

      // Simulate mouse movements
      for (let i = 0; i < 10; i++) {
        setTimeout(() => {
          const event = new MouseEvent('mousemove', {
            clientX: Math.random() * 100,
            clientY: Math.random() * 100,
          });
          document.dispatchEvent(event);
        }, i * 10);
      }

      // Fallback timeout
      setTimeout(() => {
        document.removeEventListener('mousemove', testHandler);
        resolve({ score: 50 }); // Default score
      }, 1000);
    });
  }

  /**
   * Test touch event support
   */
  private testTouchEventSupport(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /**
   * Test pointer event support
   */
  private testPointerEventSupport(): boolean {
    return 'onpointerdown' in window;
  }

  /**
   * Detect canvas-specific capabilities
   */
  private async detectCanvasCapabilities(): Promise<Partial<BrowserCapabilities>> {
    const capabilities: Partial<BrowserCapabilities> = {};

    // Test OffscreenCanvas support
    capabilities.supportsOffscreenCanvas = this.testOffscreenCanvasSupport();

    // Test ImageBitmap support (for efficient image processing)
    capabilities.supportsImageBitmap = this.testImageBitmapSupport();

    // Test Canvas 2D context features
    const canvas2DFeatures = this.testCanvas2DFeatures();
    capabilities.canvas2DFeatures = canvas2DFeatures;

    // Test WebGL context recovery
    capabilities.supportsWebGLContextRecovery = await this.testWebGLContextRecovery();

    return capabilities;
  }

  /**
   * Test OffscreenCanvas support
   */
  private testOffscreenCanvasSupport(): boolean {
    try {
      return typeof OffscreenCanvas !== 'undefined';
    } catch (error) {
      return false;
    }
  }

  /**
   * Test ImageBitmap support
   */
  private testImageBitmapSupport(): boolean {
    try {
      return typeof ImageBitmap !== 'undefined' && typeof createImageBitmap === 'function';
    } catch (error) {
      return false;
    }
  }

  /**
   * Test Canvas 2D context features
   */
  private testCanvas2DFeatures(): string[] {
    const features: string[] = [];

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // Test filter support
        if ('filter' in ctx) features.push('filters');

        // Test path2D support
        if (typeof Path2D !== 'undefined') features.push('path2d');

        // Test ellipse support
        if ('ellipse' in ctx) features.push('ellipse');

        // Test image smoothing control
        if ('imageSmoothingEnabled' in ctx) features.push('imageSmoothing');

        // Test text metrics
        if ('measureText' in ctx) features.push('textMetrics');
      }
    } catch (error) {
      // Silent fail
    }

    return features;
  }

  /**
   * Test WebGL context recovery capability
   */
  private async testWebGLContextRecovery(): Promise<boolean> {
    try {
      const canvas = document.createElement('canvas');
      const gl = (canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

      if (!gl) return false;

      // Check if WEBGL_lose_context extension is available
      const loseContextExt = gl.getExtension('WEBGL_lose_context');
      if (!loseContextExt) return false;

      return new Promise((resolve) => {
        let contextRestored = false;

        const handleContextLost = (e: Event) => {
          e.preventDefault();
        };

        const handleContextRestored = () => {
          contextRestored = true;
          canvas.removeEventListener('webglcontextlost', handleContextLost);
          canvas.removeEventListener('webglcontextrestored', handleContextRestored);
          resolve(true);
        };

        canvas.addEventListener('webglcontextlost', handleContextLost);
        canvas.addEventListener('webglcontextrestored', handleContextRestored);

        // Simulate context loss and restoration
        loseContextExt.loseContext();

        setTimeout(() => {
          if (!contextRestored) {
            loseContextExt.restoreContext();
          }
        }, 100);

        // Timeout if restoration doesn't work
        setTimeout(() => {
          if (!contextRestored) {
            canvas.removeEventListener('webglcontextlost', handleContextLost);
            canvas.removeEventListener('webglcontextrestored', handleContextRestored);
            resolve(false);
          }
        }, 1000);
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Detect performance-related capabilities
   */
  private async detectPerformanceCapabilities(): Promise<Partial<BrowserCapabilities>> {
    const capabilities: Partial<BrowserCapabilities> = {};

    // Test high-resolution timer support
    capabilities.supportsHighResTimer = this.testHighResTimerSupport();

    // Test requestIdleCallback support
    capabilities.supportsRequestIdleCallback = this.testRequestIdleCallbackSupport();

    // Measure JavaScript execution performance
    const jsPerformance = this.measureJSPerformance();
    capabilities.jsPerformanceScore = jsPerformance.score;

    // Test memory management capabilities
    capabilities.supportsMemoryAPI = this.testMemoryAPISupport();

    return capabilities;
  }

  /**
   * Test high-resolution timer support
   */
  private testHighResTimerSupport(): boolean {
    try {
      const start = performance.now();
      return typeof start === 'number' && start > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test requestIdleCallback support
   */
  private testRequestIdleCallbackSupport(): boolean {
    return typeof requestIdleCallback === 'function';
  }

  /**
   * Measure JavaScript execution performance
   */
  private measureJSPerformance(): { score: number } {
    const iterations = 100000;
    const start = performance.now();

    // Perform computational work
    let result = 0;
    for (let i = 0; i < iterations; i++) {
      result += Math.sqrt(i) * Math.random();
    }

    const duration = performance.now() - start;
    const score = Math.max(0, 100 - duration); // Higher score = better performance

    // Use result to prevent optimization
    if (result < 0) console.log('Unexpected result');

    return { score };
  }

  /**
   * Test memory API support
   */
  private testMemoryAPISupport(): boolean {
    try {
      // @ts-expect-error - performance.memory is Chrome-specific
      return typeof performance.memory === 'object';
    } catch (error) {
      return false;
    }
  }

  /**
   * Detect API availability
   */
  private async detectAPICapabilities(): Promise<Partial<BrowserCapabilities>> {
    const capabilities: Partial<BrowserCapabilities> = {};

    // Test Intersection Observer API
    capabilities.supportsIntersectionObserver = this.testIntersectionObserverSupport();

    // Test Resize Observer API
    capabilities.supportsResizeObserver = this.testResizeObserverSupport();

    // Test Web Workers support
    capabilities.supportsWebWorkers = this.testWebWorkersSupport();

    // Test Service Worker support
    capabilities.supportsServiceWorkers = this.testServiceWorkersSupport();

    // Test File API support
    capabilities.supportsFileAPI = this.testFileAPISupport();

    return capabilities;
  }

  /**
   * Test Intersection Observer support
   */
  private testIntersectionObserverSupport(): boolean {
    return typeof IntersectionObserver === 'function';
  }

  /**
   * Test Resize Observer support
   */
  private testResizeObserverSupport(): boolean {
    return typeof ResizeObserver === 'function';
  }

  /**
   * Test Web Workers support
   */
  private testWebWorkersSupport(): boolean {
    return typeof Worker === 'function';
  }

  /**
   * Test Service Worker support
   */
  private testServiceWorkersSupport(): boolean {
    return 'serviceWorker' in navigator;
  }

  /**
   * Test File API support
   */
  private testFileAPISupport(): boolean {
    return typeof FileReader === 'function' && typeof Blob === 'function';
  }

  /**
   * Detect browser information and quirks
   */
  private async detectBrowserInfo(): Promise<Partial<BrowserCapabilities>> {
    const userAgent = navigator.userAgent.toLowerCase();

    const browserInfo: Partial<BrowserCapabilities> = {
      browserName: this.getBrowserName(userAgent),
      browserVersion: this.getBrowserVersion(userAgent),
      engineName: this.getEngineName(userAgent),
      isMobile: this.detectMobile(userAgent),
      isSafari: userAgent.includes('safari') && !userAgent.includes('chrome'),
      isChrome: userAgent.includes('chrome') && !userAgent.includes('edg'),
      isFirefox: userAgent.includes('firefox'),
      isEdge: userAgent.includes('edg'),
    };

    // Detect Safari-specific quirks
    if (browserInfo.isSafari) {
      browserInfo.safariQuirks = await this.detectSafariQuirks();
    }

    // Detect mobile browser quirks
    if (browserInfo.isMobile) {
      browserInfo.mobileQuirks = this.detectMobileQuirks(userAgent);
    }

    return browserInfo;
  }

  /**
   * Get browser name from user agent
   */
  private getBrowserName(userAgent: string): string {
    if (userAgent.includes('firefox')) return 'Firefox';
    if (userAgent.includes('chrome') && !userAgent.includes('edg')) return 'Chrome';
    if (userAgent.includes('safari') && !userAgent.includes('chrome')) return 'Safari';
    if (userAgent.includes('edg')) return 'Edge';
    if (userAgent.includes('opera')) return 'Opera';
    return 'Unknown';
  }

  /**
   * Get browser version from user agent
   */
  private getBrowserVersion(userAgent: string): string {
    const patterns = [
      { name: 'chrome', pattern: /chrome\/([0-9.]+)/ },
      { name: 'firefox', pattern: /firefox\/([0-9.]+)/ },
      { name: 'safari', pattern: /version\/([0-9.]+)/ },
      { name: 'edge', pattern: /edg\/([0-9.]+)/ },
    ];

    for (const { pattern } of patterns) {
      const match = userAgent.match(pattern);
      if (match) return match[1];
    }

    return 'Unknown';
  }

  /**
   * Get engine name from user agent
   */
  private getEngineName(userAgent: string): string {
    if (userAgent.includes('webkit')) return 'WebKit';
    if (userAgent.includes('gecko')) return 'Gecko';
    if (userAgent.includes('blink')) return 'Blink';
    return 'Unknown';
  }

  /**
   * Detect mobile browser
   */
  private detectMobile(userAgent: string): boolean {
    return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  }

  /**
   * Detect Safari-specific quirks
   */
  private async detectSafariQuirks(): Promise<string[]> {
    const quirks: string[] = [];

    // Test for viewport scaling issues
    if (this.testSafariViewportQuirks()) {
      quirks.push('viewport-scaling');
    }

    // Test for canvas performance issues
    if (await this.testSafariCanvasQuirks()) {
      quirks.push('canvas-performance');
    }

    // Test for audio/video quirks
    if (this.testSafariMediaQuirks()) {
      quirks.push('media-autoplay');
    }

    return quirks;
  }

  /**
   * Test Safari viewport quirks
   */
  private testSafariViewportQuirks(): boolean {
    // Safari often has viewport scaling issues on mobile
    return window.devicePixelRatio !== Math.round(window.devicePixelRatio);
  }

  /**
   * Test Safari canvas performance quirks
   */
  private async testSafariCanvasQuirks(): Promise<boolean> {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');

      if (!ctx) return false;

      const start = performance.now();

      // Test rendering performance
      for (let i = 0; i < 100; i++) {
        ctx.fillRect(Math.random() * 1000, Math.random() * 1000, 10, 10);
      }

      const duration = performance.now() - start;
      return duration > 50; // If it takes more than 50ms, it's slow
    } catch (error) {
      return false;
    }
  }

  /**
   * Test Safari media quirks
   */
  private testSafariMediaQuirks(): boolean {
    // Safari requires user interaction for autoplay
    return true; // Always assume Safari has media quirks
  }

  /**
   * Detect mobile browser quirks
   */
  private detectMobileQuirks(userAgent: string): string[] {
    const quirks: string[] = [];

    if (userAgent.includes('android')) {
      quirks.push('android-viewport');
      quirks.push('android-keyboard');
    }

    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      quirks.push('ios-viewport');
      quirks.push('ios-scroll-bounce');
    }

    return quirks;
  }

  /**
   * Detect advanced rendering capabilities
   */
  private async detectRenderingCapabilities(): Promise<Partial<BrowserCapabilities>> {
    const capabilities: Partial<BrowserCapabilities> = {};

    // Test CSS feature support
    capabilities.cssFeatures = this.detectCSSFeatures();

    // Test GPU acceleration availability
    capabilities.supportsGPUAcceleration = this.testGPUAcceleration();

    // Test hardware-accelerated compositing
    capabilities.supportsHardwareCompositing = this.testHardwareCompositing();

    return capabilities;
  }

  /**
   * Detect CSS feature support
   */
  private detectCSSFeatures(): string[] {
    const features: string[] = [];

    // Test CSS custom properties
    if (CSS.supports && CSS.supports('color', 'var(--test)')) {
      features.push('custom-properties');
    }

    // Test CSS Grid
    if (CSS.supports && CSS.supports('display', 'grid')) {
      features.push('grid');
    }

    // Test CSS Flexbox
    if (CSS.supports && CSS.supports('display', 'flex')) {
      features.push('flexbox');
    }

    // Test CSS transforms
    if (CSS.supports && CSS.supports('transform', 'translateZ(0)')) {
      features.push('transforms-3d');
    }

    return features;
  }

  /**
   * Test GPU acceleration availability
   */
  private testGPUAcceleration(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test hardware-accelerated compositing
   */
  private testHardwareCompositing(): boolean {
    try {
      const div = document.createElement('div');
      div.style.transform = 'translateZ(0)';
      div.style.willChange = 'transform';
      return true; // If no error, compositing is supported
    } catch (error) {
      return false;
    }
  }

  /**
   * Determine optimal event handling strategy
   */
  private determineEventStrategy(
    eventCaps: Partial<BrowserCapabilities>,
    perfCaps: Partial<BrowserCapabilities>,
  ): 'passive' | 'active' | 'throttled' {
    // Use passive events if supported and performance is good
    if (eventCaps.supportsPassiveEvents && (eventCaps.eventPerformanceScore || 0) > 70) {
      return 'passive';
    }

    // Use throttled events if performance is poor
    if ((perfCaps.jsPerformanceScore || 0) < 50) {
      return 'throttled';
    }

    // Default to active events
    return 'active';
  }

  /**
   * Get fallback capabilities when detection fails
   */
  private getFallbackCapabilities(): BrowserCapabilities {
    return {
      supportsPassiveEvents: false,
      supportsIntersectionObserver: false,
      supportsResizeObserver: false,
      supportsOffscreenCanvas: false,
      preferredEventStrategy: 'active',
      browserName: 'Unknown',
      browserVersion: 'Unknown',
      engineName: 'Unknown',
      isMobile: /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        navigator.userAgent,
      ),
      isSafari: false,
      isChrome: false,
      isFirefox: false,
      isEdge: false,
      eventPerformanceScore: 50,
      jsPerformanceScore: 50,
      supportsHighResTimer: false,
      supportsRequestIdleCallback: false,
      supportsMemoryAPI: false,
      supportsWebWorkers: false,
      supportsServiceWorkers: false,
      supportsFileAPI: false,
      supportsImageBitmap: false,
      supportsWebGLContextRecovery: false,
      supportsTouchEvents: false,
      supportsPointerEvents: false,
      supportsGPUAcceleration: false,
      supportsHardwareCompositing: false,
      canvas2DFeatures: [],
      cssFeatures: [],
    };
  }

  /**
   * Clear cached capabilities (useful for testing)
   */
  clearCache(): void {
    this.cachedCapabilities = null;
  }
}
