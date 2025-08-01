'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type {
  DeviceCapabilities,
  CanvasConfiguration,
  InfiniteCanvasSettings,
  DeviceContextType,
} from '../types/capabilities';
import { CapabilityConfigManager } from '../lib/capabilities/capability-config';
import { DeviceSimulator } from '../lib/testing/device-simulation';
import { CapabilityFeatureFlagManager } from '../lib/utils/feature-flags';

/**
 * Device Capabilities React Context
 * Week 3: Provides capability detection and configuration throughout the app
 *
 * This replaces individual capability detection calls with a centralized,
 * cached, and optimized approach using our enhanced capability system.
 */

// Create the context
const DeviceContext = createContext<DeviceContextType | null>(null);

// Default context value for SSR safety
const defaultContextValue: DeviceContextType = {
  capabilities: null,
  configuration: {
    canvasMemoryBudgetMB: 100,
    maxTextureSize: 2048,
    imageQuality: 0.75,
    enableImageSmoothing: false,
    enableAntialiasing: false,
    targetFrameRate: 30,
    enableAnimations: false,
    animationComplexity: 'low',
    enableViewportCulling: true,
    cullBufferMultiplier: 2.0,
    batchRenderingEnabled: true,
    maxBatchSize: 15,
    mobileOptimized: true,
    touchGestures: true,
    reducedMotion: true,
    enableGPUAcceleration: false,
    enableOffscreenCanvas: false,
    detectionMethod: 'fallback',
    generatedAt: Date.now(),
  },
  isClient: false,
  isReady: false,
};

interface DeviceProviderProps {
  children: React.ReactNode;
  fallbackConfiguration?: Partial<CanvasConfiguration>;
}

export function DeviceProvider({ children, fallbackConfiguration }: DeviceProviderProps) {
  const [contextValue, setContextValue] = useState<DeviceContextType>(defaultContextValue);
  const [configManager] = useState(() => new CapabilityConfigManager());
  const [initializationError, setInitializationError] = useState<string | null>(null);

  // Initialize capabilities on mount (client-side only)
  useEffect(() => {
    let mounted = true;

    const initializeCapabilities = async () => {
      try {
        if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
          console.log('🚀 Initializing DeviceProvider capabilities...');
        }

        // Update to show we're on client side but not ready yet
        if (mounted) {
          setContextValue((prev) => ({
            ...prev,
            isClient: true,
            isReady: false,
          }));
        }

        // Check for device simulation first, otherwise use real detection
        const simulatedCapabilities = DeviceSimulator.getSimulatedCapabilities();
        let capabilities: DeviceCapabilities;
        let configuration: CanvasConfiguration;

        if (simulatedCapabilities) {
          // Use simulated capabilities instead of real detection
          console.log('🎭 Using simulated device capabilities');
          capabilities = simulatedCapabilities;
          // CRITICAL: Generate configuration FROM the simulated capabilities, not from real detection
          configuration =
            await configManager.generateCanvasConfigurationFromCapabilities(simulatedCapabilities);
        } else {
          // Run real capability detection
          const [detectedCapabilities, detectedConfiguration] = await Promise.all([
            configManager.getDetector().detectCapabilities(),
            configManager.getCanvasConfiguration(),
          ]);
          capabilities = detectedCapabilities;
          configuration = detectedConfiguration;
        }

        // Apply any custom fallback configuration
        const finalConfiguration = fallbackConfiguration
          ? { ...configuration, ...fallbackConfiguration }
          : configuration;

        if (mounted) {
          setContextValue({
            capabilities,
            configuration: finalConfiguration,
            isClient: true,
            isReady: true,
          });

          if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
            console.log('✅ DeviceProvider capabilities initialized:', {
              capabilities,
              configuration: finalConfiguration,
            });
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ DeviceProvider initialization failed:', error);

        if (mounted) {
          setInitializationError(errorMessage);

          // Set fallback state with error indication
          setContextValue({
            capabilities: null,
            configuration: fallbackConfiguration
              ? { ...defaultContextValue.configuration, ...fallbackConfiguration }
              : defaultContextValue.configuration,
            isClient: true,
            isReady: true, // Consider ready with fallback
          });
        }
      }
    };

    // Only initialize on client side
    if (typeof window !== 'undefined') {
      initializeCapabilities();
    }

    return () => {
      mounted = false;
    };
  }, [configManager, fallbackConfiguration]);

  return (
    <DeviceContext.Provider value={contextValue}>
      {children}
      {initializationError && CapabilityFeatureFlagManager.isEnabled('capabilityDebug') && (
        <div
          style={{
            position: 'fixed',
            top: 10,
            right: 10,
            background: 'rgba(255, 0, 0, 0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            zIndex: 9999,
            maxWidth: '300px',
          }}
        >
          Capability Detection Error: {initializationError}
        </div>
      )}
    </DeviceContext.Provider>
  );
}

// Hook to use device capabilities
export function useDeviceCapabilities(): DeviceContextType {
  const context = useContext(DeviceContext);

  if (!context) {
    // Fallback for usage outside provider
    console.warn('useDeviceCapabilities used outside DeviceProvider, returning default values');
    return defaultContextValue;
  }

  return context;
}

// Hook to get infinite canvas settings specifically
export function useInfiniteCanvasSettings(): InfiniteCanvasSettings | null {
  const { isReady } = useDeviceCapabilities();
  const [settings, setSettings] = useState<InfiniteCanvasSettings | null>(null);
  const [configManager] = useState(() => new CapabilityConfigManager());

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      if (!isReady) return;

      try {
        const canvasSettings = await configManager.getInfiniteCanvasSettings();

        if (mounted) {
          setSettings(canvasSettings);

          if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
            console.log('🎨 Infinite canvas settings loaded:', canvasSettings);
          }
        }
      } catch (error) {
        console.error('Failed to load infinite canvas settings:', error);
        if (mounted) {
          setSettings(null);
        }
      }
    };

    loadSettings();

    return () => {
      mounted = false;
    };
  }, [isReady, configManager]);

  return settings;
}

// Hook to refresh capabilities (useful for testing or dynamic conditions)
export function useRefreshCapabilities() {
  const [configManager] = useState(() => new CapabilityConfigManager());

  const refreshCapabilities = useCallback(async (): Promise<DeviceCapabilities | null> => {
    try {
      // Clear caches to force fresh detection
      configManager.clearCache();
      configManager.getDetector().getConservativeFallback(); // This will trigger fresh detection

      const capabilities = await configManager.getDetector().detectCapabilities();

      if (CapabilityFeatureFlagManager.isEnabled('capabilityDebug')) {
        console.log('🔄 Capabilities refreshed:', capabilities);
      }

      return capabilities;
    } catch (error) {
      console.error('Failed to refresh capabilities:', error);
      return null;
    }
  }, [configManager]);

  return refreshCapabilities;
}

// Hook for performance monitoring
export function usePerformanceMetrics() {
  const { isReady } = useDeviceCapabilities();
  const [configManager] = useState(() => new CapabilityConfigManager());

  const getMetrics = useCallback(async () => {
    if (!isReady) return null;

    try {
      return await configManager.getPerformanceMetrics();
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      return null;
    }
  }, [isReady, configManager]);

  return getMetrics;
}

// Export context for advanced usage
export { DeviceContext };
