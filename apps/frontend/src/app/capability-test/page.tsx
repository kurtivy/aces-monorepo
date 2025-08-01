'use client';

import { useState, useEffect } from 'react';
import { CapabilityDetector } from '../../lib/capabilities/capability-detector';
import { CapabilityCache } from '../../lib/capabilities/capability-cache';
import { CapabilityFeatureFlagManager } from '../../lib/utils/feature-flags';
import { PerformanceTestingFramework } from '../../lib/testing/performance-testing-framework';
import {
  DeviceSimulator,
  DEVICE_PROFILES,
  TEST_SCENARIOS,
} from '../../lib/testing/device-simulation';
import { CapabilityConfigManager } from '../../lib/capabilities/capability-config';
import { BrowserFeatureDetector } from '../../lib/capabilities/browser-feature-detector';
import { AdaptiveQualityManager } from '../../lib/capabilities/adaptive-quality-manager';
import type {
  DeviceCapabilities,
  CanvasConfiguration,
  InfiniteCanvasSettings,
} from '../../types/capabilities';

export default function CapabilityTestPage() {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{
    hasCache: boolean;
    age?: number;
    version?: string;
    isValid?: boolean;
  } | null>(null);
  const [testResults, setTestResults] = useState<string | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [configResults, setConfigResults] = useState<{
    configuration: CanvasConfiguration | null;
    canvasSettings: InfiniteCanvasSettings | null;
  }>({ configuration: null, canvasSettings: null });
  const [isTestingConfig, setIsTestingConfig] = useState(false);
  const [browserResults, setBrowserResults] = useState<string | null>(null);
  const [isTestingBrowser, setIsTestingBrowser] = useState(false);
  const [adaptiveResults, setAdaptiveResults] = useState<string | null>(null);
  const [isTestingAdaptive, setIsTestingAdaptive] = useState(false);
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulatedDevice, setSimulatedDevice] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<{
    device: string;
    validation: { passed: boolean; issues: string[]; recommendations: string[] };
    actualConfiguration: CanvasConfiguration;
    timestamp: string;
  } | null>(null);

  const runCapabilityDetection = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const detector = new CapabilityDetector();
      const result = await detector.detectCapabilities();
      setCapabilities(result);

      // Update cache info
      setCacheInfo(CapabilityCache.getCacheInfo());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const clearCache = () => {
    CapabilityCache.clearCache();
    setCacheInfo(CapabilityCache.getCacheInfo());
  };

  const runPerformanceTests = async () => {
    setIsRunningTests(true);
    setTestResults(null);

    try {
      const framework = new PerformanceTestingFramework();
      const testSuite = await framework.runCapabilityTests();
      const report = framework.generateReport(testSuite);
      setTestResults(report);
    } catch (err) {
      setTestResults(
        `Performance tests failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    } finally {
      setIsRunningTests(false);
    }
  };

  const testConfigurationManager = async () => {
    setIsTestingConfig(true);
    setConfigResults({ configuration: null, canvasSettings: null });

    try {
      const configManager = new CapabilityConfigManager();

      const [configuration, canvasSettings] = await Promise.all([
        configManager.getCanvasConfiguration(),
        configManager.getInfiniteCanvasSettings(),
      ]);

      setConfigResults({ configuration, canvasSettings });
    } catch (err) {
      console.error('Configuration test failed:', err);
    } finally {
      setIsTestingConfig(false);
    }
  };

  const testBrowserFeatures = async () => {
    setIsTestingBrowser(true);
    setBrowserResults(null);

    try {
      const browserDetector = new BrowserFeatureDetector();
      const browserCapabilities = await browserDetector.detectBrowserCapabilities();

      // Format results for display
      const resultsText = `
# Browser Feature Detection Results

## Browser Information
- **Name**: ${browserCapabilities.browserName || 'Unknown'}
- **Version**: ${browserCapabilities.browserVersion || 'Unknown'}
- **Engine**: ${browserCapabilities.engineName || 'Unknown'}
- **Mobile**: ${browserCapabilities.isMobile ? 'Yes' : 'No'}

## Event Capabilities
- **Passive Events**: ${browserCapabilities.supportsPassiveEvents ? '✅' : '❌'}
- **Touch Events**: ${browserCapabilities.supportsTouchEvents ? '✅' : '❌'}
- **Pointer Events**: ${browserCapabilities.supportsPointerEvents ? '✅' : '❌'}
- **Event Performance Score**: ${browserCapabilities.eventPerformanceScore || 'N/A'}
- **Preferred Strategy**: ${browserCapabilities.preferredEventStrategy}

## API Support
- **Intersection Observer**: ${browserCapabilities.supportsIntersectionObserver ? '✅' : '❌'}
- **Resize Observer**: ${browserCapabilities.supportsResizeObserver ? '✅' : '❌'}
- **Web Workers**: ${browserCapabilities.supportsWebWorkers ? '✅' : '❌'}
- **Service Workers**: ${browserCapabilities.supportsServiceWorkers ? '✅' : '❌'}
- **File API**: ${browserCapabilities.supportsFileAPI ? '✅' : '❌'}

## Canvas & Rendering
- **OffscreenCanvas**: ${browserCapabilities.supportsOffscreenCanvas ? '✅' : '❌'}
- **ImageBitmap**: ${browserCapabilities.supportsImageBitmap ? '✅' : '❌'}
- **WebGL Context Recovery**: ${browserCapabilities.supportsWebGLContextRecovery ? '✅' : '❌'}
- **GPU Acceleration**: ${browserCapabilities.supportsGPUAcceleration ? '✅' : '❌'}
- **Hardware Compositing**: ${browserCapabilities.supportsHardwareCompositing ? '✅' : '❌'}

## Performance Features
- **High Resolution Timer**: ${browserCapabilities.supportsHighResTimer ? '✅' : '❌'}
- **RequestIdleCallback**: ${browserCapabilities.supportsRequestIdleCallback ? '✅' : '❌'}
- **Memory API**: ${browserCapabilities.supportsMemoryAPI ? '✅' : '❌'}
- **JS Performance Score**: ${browserCapabilities.jsPerformanceScore || 'N/A'}

## Browser-Specific Features
${browserCapabilities.canvas2DFeatures ? `- **Canvas 2D Features**: ${browserCapabilities.canvas2DFeatures.join(', ')}` : ''}
${browserCapabilities.cssFeatures ? `- **CSS Features**: ${browserCapabilities.cssFeatures.join(', ')}` : ''}
${browserCapabilities.safariQuirks ? `- **Safari Quirks**: ${browserCapabilities.safariQuirks.join(', ')}` : ''}
${browserCapabilities.mobileQuirks ? `- **Mobile Quirks**: ${browserCapabilities.mobileQuirks.join(', ')}` : ''}
      `;

      setBrowserResults(resultsText);
    } catch (err) {
      setBrowserResults(
        `Browser feature detection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    } finally {
      setIsTestingBrowser(false);
    }
  };

  const testAdaptiveQuality = async () => {
    setIsTestingAdaptive(true);
    setAdaptiveResults(null);

    try {
      const configManager = new CapabilityConfigManager();
      const baseConfig = await configManager.getCanvasConfiguration();
      const adaptiveManager = new AdaptiveQualityManager(baseConfig);

      // Simulate some performance monitoring
      adaptiveManager.startMonitoring({
        touchCapable: true,
        performanceTier: 'medium',
      } as DeviceCapabilities);

      // Wait a bit for monitoring
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const stats = adaptiveManager.getMonitoringStats();
      adaptiveManager.stopMonitoring();

      const resultsText = `
# Adaptive Quality Management Test

## Monitoring Statistics
- **Currently Monitoring**: ${stats.isMonitoring ? 'Yes' : 'No'}
- **Metrics Collected**: ${stats.metricsCollected}
- **Adjustments Made**: ${stats.adjustmentsMade}
- **Current Performance Tier**: ${stats.currentPerformanceTier}
- **Average Frame Rate**: ${stats.avgFrameRate.toFixed(1)} fps
- **Quality Reduction**: ${stats.qualityReduction}%

## Current Configuration
- **Target FPS**: ${adaptiveManager.getCurrentConfiguration().targetFrameRate}
- **Image Quality**: ${(adaptiveManager.getCurrentConfiguration().imageQuality * 100).toFixed(0)}%
- **Memory Budget**: ${adaptiveManager.getCurrentConfiguration().canvasMemoryBudgetMB}MB
- **Image Smoothing**: ${adaptiveManager.getCurrentConfiguration().enableImageSmoothing ? 'Enabled' : 'Disabled'}
- **Antialiasing**: ${adaptiveManager.getCurrentConfiguration().enableAntialiasing ? 'Enabled' : 'Disabled'}

## Last Adjustment
${
  stats.lastAdjustment
    ? `
- **Type**: ${stats.lastAdjustment.type}
- **Reason**: ${stats.lastAdjustment.reason}
- **Severity**: ${stats.lastAdjustment.severity || 'N/A'}
`
    : 'No adjustments made yet'
}

*Note: This is a simulated test. Real adaptive quality monitoring requires continuous canvas rendering.*
      `;

      setAdaptiveResults(resultsText);
    } catch (err) {
      setAdaptiveResults(
        `Adaptive quality test failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    } finally {
      setIsTestingAdaptive(false);
    }
  };

  const simulateDevice = async (profileName: keyof typeof DEVICE_PROFILES) => {
    try {
      // Activate simulation
      DeviceSimulator.simulateDevice(profileName);
      setSimulatedDevice(profileName);
      setSimulationActive(true);

      // Force re-detection with simulated capabilities
      await runCapabilityDetection();

      // Validate the results
      const configManager = new CapabilityConfigManager();
      const actualConfiguration = await configManager.getCanvasConfiguration();
      const validation = DeviceSimulator.validateSimulatedDevice(actualConfiguration, profileName);

      setValidationResults({
        device: DEVICE_PROFILES[profileName].name,
        validation,
        actualConfiguration,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      setError(`Simulation error: ${error}`);
    }
  };

  const deactivateSimulation = async () => {
    DeviceSimulator.deactivateSimulation();
    setSimulationActive(false);
    setSimulatedDevice(null);
    setValidationResults(null);

    // Re-run real detection
    await runCapabilityDetection();
  };

  useEffect(() => {
    // Initialize with current cache info
    setCacheInfo(CapabilityCache.getCacheInfo());
  }, []);

  const featureFlags = CapabilityFeatureFlagManager.getFlags();
  const currentPhase = CapabilityFeatureFlagManager.getCurrentPhase();

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Capability Detection Test</h1>

        {/* Feature Flags Status */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Feature Flags</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              Current Phase: <span className="font-mono text-emerald-400">{currentPhase}</span>
            </div>
            <div>
              Enhanced Fallback:{' '}
              <span className={featureFlags.enhancedFallback ? 'text-green-400' : 'text-red-400'}>
                {featureFlags.enhancedFallback ? 'ON' : 'OFF'}
              </span>
            </div>
            <div>
              Capability Cache:{' '}
              <span className={featureFlags.capabilityCache ? 'text-green-400' : 'text-red-400'}>
                {featureFlags.capabilityCache ? 'ON' : 'OFF'}
              </span>
            </div>
            <div>
              GPU Monitoring:{' '}
              <span className={featureFlags.gpuMonitoring ? 'text-green-400' : 'text-red-400'}>
                {featureFlags.gpuMonitoring ? 'ON' : 'OFF'}
              </span>
            </div>
            <div>
              Capability Debug:{' '}
              <span className={featureFlags.capabilityDebug ? 'text-green-400' : 'text-red-400'}>
                {featureFlags.capabilityDebug ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>
        </div>

        {/* Cache Status */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Cache Status</h2>
          {cacheInfo ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                Has Cache:{' '}
                <span className={cacheInfo.hasCache ? 'text-green-400' : 'text-red-400'}>
                  {cacheInfo.hasCache ? 'YES' : 'NO'}
                </span>
              </div>
              {cacheInfo.age && (
                <div>
                  Age:{' '}
                  <span className="font-mono text-blue-400">
                    {Math.round(cacheInfo.age / 1000)}s
                  </span>
                </div>
              )}
              {cacheInfo.version && (
                <div>
                  Version: <span className="font-mono text-blue-400">{cacheInfo.version}</span>
                </div>
              )}
              {cacheInfo.isValid !== undefined && (
                <div>
                  Valid:{' '}
                  <span className={cacheInfo.isValid ? 'text-green-400' : 'text-red-400'}>
                    {cacheInfo.isValid ? 'YES' : 'NO'}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-400">Loading cache info...</div>
          )}
          <button
            onClick={clearCache}
            className="mt-4 bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm"
          >
            Clear Cache
          </button>
        </div>

        {/* Controls */}
        <div className="mb-6 space-x-4">
          <button
            onClick={runCapabilityDetection}
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-semibold"
          >
            {isLoading ? 'Detecting Capabilities...' : 'Run Capability Detection'}
          </button>

          <button
            onClick={runPerformanceTests}
            disabled={isRunningTests || isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-semibold"
          >
            {isRunningTests ? 'Running Performance Tests...' : 'Run Performance Tests'}
          </button>

          <button
            onClick={testConfigurationManager}
            disabled={isTestingConfig || isLoading}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-semibold"
          >
            {isTestingConfig ? 'Testing Configuration...' : 'Test Configuration Manager'}
          </button>

          <button
            onClick={testBrowserFeatures}
            disabled={isTestingBrowser || isLoading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-semibold"
          >
            {isTestingBrowser ? 'Testing Browser Features...' : 'Test Browser Features'}
          </button>

          <button
            onClick={testAdaptiveQuality}
            disabled={isTestingAdaptive || isLoading}
            className="bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-semibold"
          >
            {isTestingAdaptive ? 'Testing Adaptive Quality...' : 'Test Adaptive Quality'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-800 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-2">Error</h3>
            <pre className="text-sm text-red-200">{error}</pre>
          </div>
        )}

        {/* Performance Test Results */}
        {testResults && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Performance Test Results</h2>
            <pre className="text-xs text-gray-300 overflow-auto max-h-96 whitespace-pre-wrap">
              {testResults}
            </pre>
          </div>
        )}

        {/* Configuration Test Results */}
        {(configResults.configuration || configResults.canvasSettings) && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Configuration Manager Results</h2>

            {configResults.configuration && (
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2 text-purple-400">Canvas Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p>
                      <span className="text-gray-400">Memory Budget:</span>{' '}
                      {configResults.configuration.canvasMemoryBudgetMB}MB
                    </p>
                    <p>
                      <span className="text-gray-400">Target FPS:</span>{' '}
                      {configResults.configuration.targetFrameRate}
                    </p>
                    <p>
                      <span className="text-gray-400">Image Quality:</span>{' '}
                      {(configResults.configuration.imageQuality * 100).toFixed(0)}%
                    </p>
                    <p>
                      <span className="text-gray-400">Max Texture Size:</span>{' '}
                      {configResults.configuration.maxTextureSize}px
                    </p>
                  </div>
                  <div>
                    <p>
                      <span className="text-gray-400">Animations:</span>{' '}
                      {configResults.configuration.enableAnimations ? '✅' : '❌'}
                    </p>
                    <p>
                      <span className="text-gray-400">Image Smoothing:</span>{' '}
                      {configResults.configuration.enableImageSmoothing ? '✅' : '❌'}
                    </p>
                    <p>
                      <span className="text-gray-400">GPU Acceleration:</span>{' '}
                      {configResults.configuration.enableGPUAcceleration ? '✅' : '❌'}
                    </p>
                    <p>
                      <span className="text-gray-400">Mobile Optimized:</span>{' '}
                      {configResults.configuration.mobileOptimized ? '✅' : '❌'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {configResults.canvasSettings && (
              <div>
                <h3 className="text-lg font-medium mb-2 text-purple-400">
                  Infinite Canvas Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p>
                      <span className="text-gray-400">Grid Tile Size:</span>{' '}
                      {configResults.canvasSettings.gridTileSize}px
                    </p>
                    <p>
                      <span className="text-gray-400">Preload Radius:</span>{' '}
                      {configResults.canvasSettings.preloadRadius}
                    </p>
                    <p>
                      <span className="text-gray-400">Max Concurrent Tiles:</span>{' '}
                      {configResults.canvasSettings.maxConcurrentTiles}
                    </p>
                    <p>
                      <span className="text-gray-400">Image Resolution:</span>{' '}
                      {configResults.canvasSettings.imageResolution}
                    </p>
                  </div>
                  <div>
                    <p>
                      <span className="text-gray-400">Tile Memory Budget:</span>{' '}
                      {configResults.canvasSettings.tileMemoryBudgetMB}MB
                    </p>
                    <p>
                      <span className="text-gray-400">Touch Sensitivity:</span>{' '}
                      {configResults.canvasSettings.touchSettings.sensitivity}
                    </p>
                    <p>
                      <span className="text-gray-400">Lazy Loading:</span>{' '}
                      {configResults.canvasSettings.enableLazyLoading ? '✅' : '❌'}
                    </p>
                    <p>
                      <span className="text-gray-400">Virtual Scrolling:</span>{' '}
                      {configResults.canvasSettings.virtualScrolling ? '✅' : '❌'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Browser Feature Detection Results */}
        {browserResults && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Browser Feature Detection Results</h2>
            <pre className="text-xs text-gray-300 overflow-auto max-h-96 whitespace-pre-wrap">
              {browserResults}
            </pre>
          </div>
        )}

        {/* Adaptive Quality Management Results */}
        {adaptiveResults && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Adaptive Quality Management Results</h2>
            <pre className="text-xs text-gray-300 overflow-auto max-h-96 whitespace-pre-wrap">
              {adaptiveResults}
            </pre>
          </div>
        )}

        {/* Device Simulation Controls */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            📱 Device Simulation Testing
            {simulationActive && (
              <span className="ml-2 px-2 py-1 bg-purple-600 text-sm rounded">
                Simulating: {DEVICE_PROFILES[simulatedDevice as keyof typeof DEVICE_PROFILES]?.name}
              </span>
            )}
          </h2>

          <p className="text-gray-300 mb-4">
            Test your capability system with simulated device profiles without needing the actual
            devices:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {Object.entries(DEVICE_PROFILES).map(([key, profile]) => (
              <button
                key={key}
                onClick={() => simulateDevice(key as keyof typeof DEVICE_PROFILES)}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded disabled:opacity-50 text-sm"
              >
                <div className="font-semibold">{profile.name}</div>
                <div className="text-xs opacity-75">{profile.description}</div>
                <div className="text-xs mt-1">
                  Expected: {profile.expectedBehavior.targetFrameRate}fps,{' '}
                  {profile.expectedBehavior.performanceTier}
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => TEST_SCENARIOS.highEndAndroid()}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              🚀 High-End Android
            </button>
            <button
              onClick={() => TEST_SCENARIOS.midRangeAndroid()}
              disabled={isLoading}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              📱 Mid-Range Android
            </button>
            <button
              onClick={() => TEST_SCENARIOS.lowEndAndroid()}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              📉 Low-End Android
            </button>
            {simulationActive && (
              <button
                onClick={deactivateSimulation}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
              >
                ❌ Stop Simulation
              </button>
            )}
          </div>
        </div>

        {/* Validation Results */}
        {validationResults && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">🎯 Simulation Validation Results</h2>
            <div
              className={`p-4 rounded mb-4 ${validationResults.validation.passed ? 'bg-green-900' : 'bg-red-900'}`}
            >
              <div className="font-semibold">
                {validationResults.validation.passed ? '✅ PASSED' : '❌ FAILED'}:{' '}
                {validationResults.device}
              </div>
              {validationResults.validation.issues.length > 0 && (
                <div className="mt-2">
                  <div className="font-semibold text-red-400">Issues:</div>
                  <ul className="list-disc list-inside text-sm">
                    {validationResults.validation.issues.map((issue: string, i: number) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              {validationResults.validation.recommendations.length > 0 && (
                <div className="mt-2">
                  <div className="font-semibold text-yellow-400">Recommendations:</div>
                  <ul className="list-disc list-inside text-sm">
                    {validationResults.validation.recommendations.map((rec: string, i: number) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <pre className="text-xs text-gray-300 overflow-auto max-h-64 whitespace-pre-wrap">
              {JSON.stringify(validationResults, null, 2)}
            </pre>
          </div>
        )}

        {/* Results */}
        {capabilities && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Detection Results</h2>

            {/* Performance Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-700 rounded p-4">
                <h3 className="font-semibold mb-2">Performance Tier</h3>
                <div
                  className={`text-2xl font-bold ${
                    capabilities.performanceTier === 'high'
                      ? 'text-green-400'
                      : capabilities.performanceTier === 'medium'
                        ? 'text-yellow-400'
                        : 'text-red-400'
                  }`}
                >
                  {capabilities.performanceTier.toUpperCase()}
                </div>
              </div>

              <div className="bg-gray-700 rounded p-4">
                <h3 className="font-semibold mb-2">GPU Memory</h3>
                <div className="text-2xl font-bold text-blue-400">{capabilities.gpuMemoryMB}MB</div>
              </div>

              <div className="bg-gray-700 rounded p-4">
                <h3 className="font-semibold mb-2">Frame Rate</h3>
                <div className="text-2xl font-bold text-purple-400">
                  {Math.round(capabilities.frameRateCapability)}fps
                </div>
              </div>
            </div>

            {/* Detailed Results */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Detailed Capabilities</h3>
              <pre className="text-xs text-gray-300 overflow-auto max-h-96">
                {JSON.stringify(capabilities, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-blue-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Testing Instructions</h2>
          <div className="space-y-2 text-sm">
            <p>
              1. <strong>Enable Feature Flags:</strong> Set environment variables in{' '}
              <code>.env.local</code>
            </p>
            <p>
              2. <strong>Test Fallback System:</strong> Run detection multiple times to test caching
            </p>
            <p>
              3. <strong>Test Different Browsers:</strong> Open in Chrome, Firefox, Safari to test
              compatibility
            </p>
            <p>
              4. <strong>Test Cache Invalidation:</strong> Clear cache and run detection again
            </p>
            <p>
              5. <strong>Check Console:</strong> Open browser dev tools to see debug logs (when
              debug flag is enabled)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
