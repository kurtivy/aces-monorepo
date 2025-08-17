import { DeviceCapabilities, CanvasConfiguration } from '../../types/capabilities';

export interface DeviceProfile {
  name: string;
  description: string;
  capabilities: DeviceCapabilities;
  expectedBehavior: {
    targetFrameRate: number;
    performanceTier: 'low' | 'medium' | 'high';
    memoryBudget: number;
    shouldUseImageSmoothing: boolean;
  };
}

/**
 * Predefined device profiles for testing
 */
export const DEVICE_PROFILES: Record<string, DeviceProfile> = {
  // High-end devices that should get full performance
  galaxyS24Ultra: {
    name: 'Samsung Galaxy S24 Ultra',
    description: 'Flagship Android device with Snapdragon 8 Gen 3',
    capabilities: {
      gpuMemoryMB: 1024,
      maxTextureSize: 16384,
      supportsWebGL2: true,
      gpuVendor: 'Qualcomm',
      gpuRenderer: 'Adreno 750',
      frameRateCapability: 120,
      performanceTier: 'high',
      memoryPressure: 'low',
      thermalState: 'normal',
      availableMemoryMB: 8192, // 8GB RAM
      supportsOffscreenCanvas: true,
      supportsIntersectionObserver: true,
      supportsResizeObserver: true,
      supportsPassiveEvents: true,
      touchCapable: true,
      screenSize: { width: 1440, height: 3120 },
      devicePixelRatio: 3.0,
      orientationCapable: true,
      detectionMethod: 'full',
      detectionTimestamp: Date.now(),
      // Browser capabilities for S24 Ultra Chrome
      browserName: 'Chrome',
      jsPerformanceScore: 95,
      supportsMemoryAPI: true,
      supportsWebGLContextRecovery: true,
      safariMobileOptimizations: false,
    },
    expectedBehavior: {
      targetFrameRate: 60, // Should get full 60fps
      performanceTier: 'high',
      memoryBudget: 1024, // High memory budget
      shouldUseImageSmoothing: true,
    },
  },

  // Mid-range device that caused issues before
  redmiNote12: {
    name: 'Redmi Note 12',
    description: 'Mid-range device with Snapdragon 4 Gen 1',
    capabilities: {
      gpuMemoryMB: 256,
      maxTextureSize: 8192,
      supportsWebGL2: true,
      gpuVendor: 'Qualcomm',
      gpuRenderer: 'Adreno 619',
      frameRateCapability: 90,
      performanceTier: 'medium',
      memoryPressure: 'medium',
      thermalState: 'normal',
      availableMemoryMB: 4096, // 4GB RAM
      supportsOffscreenCanvas: true,
      supportsIntersectionObserver: true,
      supportsResizeObserver: true,
      supportsPassiveEvents: true,
      touchCapable: true,
      screenSize: { width: 1080, height: 2400 },
      devicePixelRatio: 2.0,
      orientationCapable: true,
      detectionMethod: 'full',
      detectionTimestamp: Date.now(),
      // Browser capabilities for mid-range Android Chrome
      browserName: 'Chrome',
      jsPerformanceScore: 65,
      supportsMemoryAPI: true,
      supportsWebGLContextRecovery: true,
      safariMobileOptimizations: false,
    },
    expectedBehavior: {
      targetFrameRate: 45, // Should get good but not max performance
      performanceTier: 'medium',
      memoryBudget: 512,
      shouldUseImageSmoothing: true,
    },
  },

  // Low-end device for testing conservative settings
  lowEndAndroid: {
    name: 'Low-end Android Device',
    description: 'Budget device with limited capabilities',
    capabilities: {
      gpuMemoryMB: 128,
      maxTextureSize: 4096,
      supportsWebGL2: false,
      gpuVendor: 'Unknown',
      gpuRenderer: 'Unknown',
      frameRateCapability: 60,
      performanceTier: 'low',
      memoryPressure: 'high',
      thermalState: 'elevated',
      availableMemoryMB: 1024, // 1GB RAM
      supportsOffscreenCanvas: false,
      supportsIntersectionObserver: true,
      supportsResizeObserver: false,
      supportsPassiveEvents: false,
      touchCapable: true,
      screenSize: { width: 720, height: 1560 },
      devicePixelRatio: 1.5,
      orientationCapable: true,
      detectionMethod: 'navigator_apis',
      detectionTimestamp: Date.now(),
      // Browser capabilities for low-end device
      browserName: 'Chrome',
      jsPerformanceScore: 25,
      supportsMemoryAPI: false,
      supportsWebGLContextRecovery: false,
      safariMobileOptimizations: false,
    },
    expectedBehavior: {
      targetFrameRate: 30, // Should get conservative settings
      performanceTier: 'low',
      memoryBudget: 256,
      shouldUseImageSmoothing: false,
    },
  },

  // iPhone 15 Pro for high-end iOS testing
  iphone15Pro: {
    name: 'iPhone 15 Pro',
    description: 'High-end iOS device with A17 Pro chip',
    capabilities: {
      gpuMemoryMB: 2048,
      maxTextureSize: 16384,
      supportsWebGL2: true,
      gpuVendor: 'Apple',
      gpuRenderer: 'Apple A17 Pro GPU',
      frameRateCapability: 120,
      performanceTier: 'high',
      memoryPressure: 'low',
      thermalState: 'normal',
      availableMemoryMB: 6144, // 6GB RAM
      supportsOffscreenCanvas: true,
      supportsIntersectionObserver: true,
      supportsResizeObserver: true,
      supportsPassiveEvents: true,
      touchCapable: true,
      screenSize: { width: 1179, height: 2556 },
      devicePixelRatio: 3.0,
      orientationCapable: true,
      detectionMethod: 'full',
      detectionTimestamp: Date.now(),
      // Safari capabilities
      browserName: 'Safari',
      jsPerformanceScore: 100,
      supportsMemoryAPI: false, // Safari doesn't expose performance.memory
      supportsWebGLContextRecovery: true,
      safariMobileOptimizations: true,
    },
    expectedBehavior: {
      targetFrameRate: 60, // Should override Safari's 30fps limit
      performanceTier: 'high',
      memoryBudget: 1024,
      shouldUseImageSmoothing: true,
    },
  },
};

/**
 * Device simulation manager for testing
 */
export class DeviceSimulator {
  private static simulatedCapabilities: DeviceCapabilities | null = null;
  private static originalDetector: unknown = null;

  /**
   * Activate device simulation
   */
  static simulateDevice(profileName: keyof typeof DEVICE_PROFILES): DeviceCapabilities {
    const profile = DEVICE_PROFILES[profileName];
    if (!profile) {
      throw new Error(`Device profile "${profileName}" not found`);
    }

    this.simulatedCapabilities = profile.capabilities;

    return profile.capabilities;
  }

  /**
   * Get simulated capabilities (used by DeviceProvider)
   */
  static getSimulatedCapabilities(): DeviceCapabilities | null {
    return this.simulatedCapabilities;
  }

  /**
   * Check if simulation is active
   */
  static isSimulationActive(): boolean {
    return this.simulatedCapabilities !== null;
  }

  /**
   * Deactivate simulation
   */
  static deactivateSimulation(): void {
    this.simulatedCapabilities = null;
  }

  /**
   * Get available device profiles
   */
  static getAvailableProfiles(): DeviceProfile[] {
    return Object.values(DEVICE_PROFILES);
  }

  /**
   * Validate that current configuration matches expected behavior for simulated device
   */
  static validateSimulatedDevice(
    actualConfiguration: CanvasConfiguration,
    profileName: keyof typeof DEVICE_PROFILES,
  ): {
    passed: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const profile = DEVICE_PROFILES[profileName];
    if (!profile) {
      return { passed: false, issues: ['Invalid profile'], recommendations: [] };
    }

    const expected = profile.expectedBehavior;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Validate frame rate
    if (actualConfiguration.targetFrameRate < expected.targetFrameRate * 0.9) {
      issues.push(
        `Frame rate too low: expected ~${expected.targetFrameRate}fps, got ${actualConfiguration.targetFrameRate}fps`,
      );
      recommendations.push('Device should support higher frame rate - check browser optimizations');
    }

    // Validate memory budget
    if (actualConfiguration.canvasMemoryBudgetMB < expected.memoryBudget * 0.8) {
      issues.push(
        `Memory budget too low: expected ~${expected.memoryBudget}MB, got ${actualConfiguration.canvasMemoryBudgetMB}MB`,
      );
      recommendations.push('High-end device should get larger memory budget');
    }

    // Validate image smoothing
    if (actualConfiguration.enableImageSmoothing !== expected.shouldUseImageSmoothing) {
      issues.push(
        `Image smoothing mismatch: expected ${expected.shouldUseImageSmoothing}, got ${actualConfiguration.enableImageSmoothing}`,
      );
      if (expected.shouldUseImageSmoothing) {
        recommendations.push('High-performance device should enable image smoothing');
      }
    }

    return {
      passed: issues.length === 0,
      issues,
      recommendations,
    };
  }
}

/**
 * Easy testing utilities
 */
export const TEST_SCENARIOS = {
  highEndAndroid: () => DeviceSimulator.simulateDevice('galaxyS24Ultra'),
  midRangeAndroid: () => DeviceSimulator.simulateDevice('redmiNote12'),
  lowEndAndroid: () => DeviceSimulator.simulateDevice('lowEndAndroid'),
  highEndIOS: () => DeviceSimulator.simulateDevice('iphone15Pro'),
} as const;
