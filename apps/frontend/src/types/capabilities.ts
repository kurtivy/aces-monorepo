// Capability-Based Architecture Type Definitions

export interface DeviceCapabilities {
  // GPU capabilities
  gpuMemoryMB: number;
  maxTextureSize: number;
  supportsWebGL2: boolean;
  gpuVendor: string;
  gpuRenderer: string;

  // Performance capabilities
  frameRateCapability: number;
  performanceTier: 'low' | 'medium' | 'high';

  // Memory and thermal
  memoryPressure: 'low' | 'medium' | 'high';
  thermalState: 'normal' | 'elevated' | 'critical';
  availableMemoryMB: number;

  // Feature support
  supportsOffscreenCanvas: boolean;
  supportsIntersectionObserver: boolean;
  supportsResizeObserver: boolean;
  supportsPassiveEvents: boolean;

  // Device characteristics
  touchCapable: boolean;
  screenSize: { width: number; height: number };
  devicePixelRatio: number;
  orientationCapable: boolean;

  // Detection metadata
  detectionMethod: 'full' | 'navigator_apis' | 'fallback' | 'ios_device_model' | 'safari_desktop';
  detectionTimestamp: number;

  // Optional browser-specific properties (from BrowserFeatureDetector)
  browserName?: string;
  jsPerformanceScore?: number;
  supportsMemoryAPI?: boolean;
  supportsWebGLContextRecovery?: boolean;
  safariMobileOptimizations?: boolean;
}

export interface MemoryCapabilities {
  availableMemoryMB: number;
  memoryPressure: 'low' | 'medium' | 'high';
  detectionMethod:
    | 'performance_memory'
    | 'navigator_apis'
    | 'fallback'
    | 'ios_device_model'
    | 'safari_desktop';
}

export interface GPUCapabilities {
  gpuMemoryMB: number;
  maxTextureSize: number;
  supportsWebGL2: boolean;
  gpuVendor: string;
  gpuRenderer: string;
}

export interface PerformanceMetrics {
  frameRate: number;
  memoryUsage: {
    available: number;
    allocated: number;
    pressure: 'low' | 'medium' | 'high';
  };
  gpuMetrics: {
    memory: number;
    maxTextureSize: number;
    webgl2Support: boolean;
  };
  performanceTier: string;
  timestamp: number;
}

export interface CanvasConfiguration {
  // Memory management
  canvasMemoryBudgetMB: number;
  maxTextureSize: number;

  // Rendering quality
  imageQuality: number;
  enableImageSmoothing: boolean;
  enableAntialiasing: boolean;

  // Performance settings
  targetFrameRate: number;
  enableAnimations: boolean;
  animationComplexity: 'low' | 'medium' | 'high';

  // Culling and optimization
  enableViewportCulling: boolean;
  cullBufferMultiplier: number;
  batchRenderingEnabled: boolean;
  maxBatchSize: number;

  // Mobile optimizations
  mobileOptimized: boolean;
  touchGestures: boolean;
  reducedMotion: boolean;
  enableMomentumScrolling?: boolean;
  touchSensitivity?: number;
  mouseCheckInterval?: number;
  safariMobileOptimizations?: boolean;

  // Feature flags
  enableGPUAcceleration: boolean;
  enableOffscreenCanvas: boolean;

  // Debug info
  detectionMethod: 'full' | 'navigator_apis' | 'fallback' | 'ios_device_model' | 'safari_desktop';
  generatedAt: number;
}

export interface InfiniteCanvasSettings {
  // Grid rendering
  gridTileSize: number;
  preloadRadius: number;
  maxConcurrentTiles: number;

  // Image rendering
  imageLoadingConcurrency: number;
  imageResolution: 'low' | 'medium' | 'high';
  enableProgressiveLoading: boolean;

  // Performance optimizations
  enableLazyLoading: boolean;
  virtualScrolling: boolean;
  debounceScrollMs: number;

  // Memory management
  tileMemoryBudgetMB: number;
  enableTileRecycling: boolean;
  maxTileHistory: number;

  // Interaction settings
  touchSettings: {
    sensitivity: number;
    momentumEnabled: boolean;
    pinchZoomEnabled: boolean;
  };

  baseConfig: CanvasConfiguration;
}

export interface BrowserCapabilities {
  // Event handling capabilities
  supportsPassiveEvents: boolean;
  supportsTouchEvents: boolean;
  supportsPointerEvents: boolean;
  eventPerformanceScore?: number;
  preferredEventStrategy: 'passive' | 'active' | 'throttled';

  // API availability
  supportsIntersectionObserver: boolean;
  supportsResizeObserver: boolean;
  supportsWebWorkers: boolean;
  supportsServiceWorkers: boolean;
  supportsFileAPI: boolean;
  supportsRequestIdleCallback: boolean;
  supportsMemoryAPI: boolean;

  // Canvas and rendering capabilities
  supportsOffscreenCanvas: boolean;
  supportsImageBitmap: boolean;
  supportsWebGLContextRecovery: boolean;
  supportsGPUAcceleration: boolean;
  supportsHardwareCompositing: boolean;
  canvas2DFeatures?: string[];

  // Performance capabilities
  supportsHighResTimer: boolean;
  jsPerformanceScore?: number;

  // Browser identification
  browserName?: string;
  browserVersion?: string;
  engineName?: string;
  isMobile?: boolean;
  isSafari?: boolean;
  isChrome?: boolean;
  isFirefox?: boolean;
  isEdge?: boolean;

  // Browser-specific quirks
  safariQuirks?: string[];
  mobileQuirks?: string[];

  // CSS capabilities
  cssFeatures?: string[];
}

export interface CapabilityCacheData {
  capabilities: DeviceCapabilities;
  timestamp: number;
  version: string;
  userAgent: string;
}

export interface DeviceContextType {
  capabilities: DeviceCapabilities | null;
  configuration: CanvasConfiguration;
  isClient: boolean;
  isReady: boolean;
}

// Feature flag types
export interface CapabilityFeatureFlags {
  enhancedFallback: boolean;
  capabilityCache: boolean;
  gpuMonitoring: boolean;
  capabilityConfig: boolean;
  adaptiveQuality: boolean;
  featureDetection: boolean;
  capabilityDebug: boolean;
  performanceMonitoring: boolean;
}

// Event and error types
export interface CapabilityDetectionError {
  type: 'gpu_estimation_failed' | 'memory_detection_failed' | 'performance_test_failed';
  message: string;
  timestamp: number;
  userAgent: string;
  fallbackUsed: boolean;
}
