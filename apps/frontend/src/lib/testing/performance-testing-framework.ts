import { CapabilityDetector } from '../capabilities/capability-detector';

/**
 * Performance testing framework for capability detection validation
 * Week 2: Automated device testing and performance regression detection
 */
export class PerformanceTestingFramework {
  private results: TestResult[] = [];

  /**
   * Run comprehensive capability detection tests
   */
  async runCapabilityTests(): Promise<TestSuiteResult> {
    const testSuite: TestSuiteResult = {
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      deviceInfo: {
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: (navigator as unknown as { deviceMemory?: number }).deviceMemory,
      },
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
      },
    };

    console.group('🧪 Running Performance Test Suite');

    // Test 1: Basic capability detection
    await this.runTest(testSuite, 'Basic Capability Detection', async () => {
      const detector = new CapabilityDetector();
      const capabilities = await detector.detectCapabilities();

      if (!capabilities) throw new Error('No capabilities detected');
      if (!capabilities.performanceTier) throw new Error('Performance tier not set');
      if (!capabilities.detectionTimestamp) throw new Error('Detection timestamp missing');

      return { capabilities };
    });

    // Test 2: Memory detection tiers
    await this.runTest(testSuite, 'Memory Detection Tiers', async () => {
      const detector = new CapabilityDetector();
      const capabilities = await detector.detectCapabilities();

      if (capabilities.availableMemoryMB < 1024) {
        throw new Error(`Available memory too low: ${capabilities.availableMemoryMB}MB`);
      }

      const validPressure = ['low', 'medium', 'high'].includes(capabilities.memoryPressure);
      if (!validPressure) {
        throw new Error(`Invalid memory pressure: ${capabilities.memoryPressure}`);
      }

      return {
        availableMemory: capabilities.availableMemoryMB,
        memoryPressure: capabilities.memoryPressure,
        detectionMethod: capabilities.detectionMethod,
      };
    });

    // Test 3: GPU detection and memory estimation
    await this.runTest(testSuite, 'GPU Detection & Memory Estimation', async () => {
      const detector = new CapabilityDetector();
      const capabilities = await detector.detectCapabilities();

      if (capabilities.gpuMemoryMB < 50) {
        throw new Error(`GPU memory too low: ${capabilities.gpuMemoryMB}MB`);
      }

      if (capabilities.maxTextureSize < 1024) {
        throw new Error(`Max texture size too small: ${capabilities.maxTextureSize}`);
      }

      return {
        gpuMemory: capabilities.gpuMemoryMB,
        maxTextureSize: capabilities.maxTextureSize,
        supportsWebGL2: capabilities.supportsWebGL2,
        gpuVendor: capabilities.gpuVendor,
        gpuRenderer: capabilities.gpuRenderer,
      };
    });

    // Test 4: Performance tier classification
    await this.runTest(testSuite, 'Performance Tier Classification', async () => {
      const detector = new CapabilityDetector();
      const capabilities = await detector.detectCapabilities();

      const validTiers = ['low', 'medium', 'high'];
      if (!validTiers.includes(capabilities.performanceTier)) {
        throw new Error(`Invalid performance tier: ${capabilities.performanceTier}`);
      }

      // Validate tier makes sense given the specs
      const warnings: string[] = [];

      if (capabilities.performanceTier === 'high' && capabilities.gpuMemoryMB < 200) {
        warnings.push('High tier with low GPU memory');
      }

      if (capabilities.performanceTier === 'low' && capabilities.availableMemoryMB > 4096) {
        warnings.push('Low tier with high available memory');
      }

      return {
        performanceTier: capabilities.performanceTier,
        warnings,
      };
    });

    // Test 5: Frame rate measurement
    await this.runTest(testSuite, 'Frame Rate Measurement', async () => {
      const detector = new CapabilityDetector();
      const capabilities = await detector.detectCapabilities();

      if (capabilities.frameRateCapability < 15) {
        throw new Error(`Frame rate too low: ${capabilities.frameRateCapability}fps`);
      }

      if (capabilities.frameRateCapability > 120) {
        throw new Error(`Frame rate unrealistic: ${capabilities.frameRateCapability}fps`);
      }

      return {
        frameRate: capabilities.frameRateCapability,
      };
    });

    // Test 6: Browser feature detection
    await this.runTest(testSuite, 'Browser Feature Detection', async () => {
      const detector = new CapabilityDetector();
      const capabilities = await detector.detectCapabilities();

      return {
        supportsOffscreenCanvas: capabilities.supportsOffscreenCanvas,
        supportsIntersectionObserver: capabilities.supportsIntersectionObserver,
        supportsResizeObserver: capabilities.supportsResizeObserver,
        supportsPassiveEvents: capabilities.supportsPassiveEvents,
        touchCapable: capabilities.touchCapable,
        orientationCapable: capabilities.orientationCapable,
      };
    });

    // Test 7: Cache functionality
    await this.runTest(testSuite, 'Cache Functionality', async () => {
      const detector = new CapabilityDetector();

      // Clear cache first
      const { CapabilityCache } = await import('../capabilities/capability-cache');
      CapabilityCache.clearCache();

      // First detection (should not be cached)
      const start1 = performance.now();
      await detector.detectCapabilities();
      const duration1 = performance.now() - start1;

      // Second detection (should be cached if enabled)
      const start2 = performance.now();
      await detector.detectCapabilities();
      const duration2 = performance.now() - start2;

      const cacheInfo = CapabilityCache.getCacheInfo();

      return {
        firstDetectionTime: duration1,
        secondDetectionTime: duration2,
        cacheWorking: duration2 < duration1 * 0.5, // Should be much faster if cached
        cacheInfo,
      };
    });

    console.groupEnd();

    return testSuite;
  }

  /**
   * Run performance regression tests
   */
  async runPerformanceRegressionTest(): Promise<PerformanceRegressionResult> {
    const iterations = 5;
    const results: number[] = [];

    console.group('📊 Performance Regression Test');

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const detector = new CapabilityDetector();
      await detector.detectCapabilities();
      const duration = performance.now() - start;
      results.push(duration);

      console.log(`Iteration ${i + 1}: ${duration.toFixed(1)}ms`);
    }

    const avgTime = results.reduce((sum, time) => sum + time, 0) / results.length;
    const maxTime = Math.max(...results);
    const minTime = Math.min(...results);
    const variance =
      results.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / results.length;
    const stdDev = Math.sqrt(variance);

    console.log(`Average: ${avgTime.toFixed(1)}ms`);
    console.log(`Range: ${minTime.toFixed(1)}ms - ${maxTime.toFixed(1)}ms`);
    console.log(`Std Dev: ${stdDev.toFixed(1)}ms`);

    console.groupEnd();

    return {
      iterations,
      avgTime,
      maxTime,
      minTime,
      stdDev,
      acceptable: avgTime < 2000 && stdDev < 500, // Should be under 2s avg, consistent
    };
  }

  /**
   * Run a single test with error handling
   */
  private async runTest(
    testSuite: TestSuiteResult,
    name: string,
    testFn: () => Promise<Record<string, unknown>>,
  ): Promise<void> {
    const test: TestResult = {
      name,
      status: 'running',
      startTime: performance.now(),
      duration: 0,
      data: {},
    };

    try {
      console.log(`🔄 Running: ${name}`);
      const result = await testFn();
      test.status = 'passed';
      test.data = result;
      testSuite.summary.passed++;
      console.log(`✅ Passed: ${name}`);
    } catch (error) {
      test.status = 'failed';
      test.error = error instanceof Error ? error.message : 'Unknown error';
      testSuite.summary.failed++;
      console.error(`❌ Failed: ${name}`, error);
    } finally {
      test.duration = performance.now() - test.startTime;
      testSuite.tests.push(test);
      testSuite.summary.total++;
    }
  }

  /**
   * Generate test report
   */
  generateReport(testSuite: TestSuiteResult): string {
    const { summary, tests, deviceInfo } = testSuite;

    let report = `
# Capability Detection Test Report

**Date**: ${new Date(testSuite.timestamp).toISOString()}
**User Agent**: ${testSuite.userAgent}
**Platform**: ${deviceInfo.platform}
**CPU Cores**: ${deviceInfo.hardwareConcurrency}
**Device Memory**: ${deviceInfo.deviceMemory || 'Unknown'}GB

## Summary
- **Total Tests**: ${summary.total}
- **Passed**: ${summary.passed} ✅
- **Failed**: ${summary.failed} ❌
- **Success Rate**: ${((summary.passed / summary.total) * 100).toFixed(1)}%

## Test Results
`;

    tests.forEach((test) => {
      const status = test.status === 'passed' ? '✅' : '❌';
      report += `
### ${status} ${test.name}
- **Duration**: ${test.duration.toFixed(1)}ms
- **Status**: ${test.status}
${test.error ? `- **Error**: ${test.error}` : ''}
${test.data ? `- **Data**: \`${JSON.stringify(test.data, null, 2)}\`` : ''}
`;
    });

    return report;
  }
}

// Type definitions
interface TestResult {
  name: string;
  status: 'running' | 'passed' | 'failed';
  startTime: number;
  duration: number;
  data: Record<string, unknown>;
  error?: string;
}

interface TestSuiteResult {
  timestamp: number;
  userAgent: string;
  deviceInfo: {
    platform: string;
    hardwareConcurrency: number;
    deviceMemory?: number;
  };
  tests: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

interface PerformanceRegressionResult {
  iterations: number;
  avgTime: number;
  maxTime: number;
  minTime: number;
  stdDev: number;
  acceptable: boolean;
}
