import type { CapabilityFeatureFlags } from '../../types/capabilities';

/**
 * Feature flag management for capability-based architecture rollout
 */
export class CapabilityFeatureFlagManager {
  private static getEnvFlag(name: string, defaultValue: boolean = false): boolean {
    if (typeof window === 'undefined') return defaultValue;

    const value = process.env[`NEXT_PUBLIC_${name}`];
    if (value === undefined) return defaultValue;

    return value.toLowerCase() === 'true';
  }

  /**
   * Get all capability feature flags
   */
  static getFlags(): CapabilityFeatureFlags {
    return {
      enhancedFallback: this.getEnvFlag('ENHANCED_FALLBACK'),
      capabilityCache: this.getEnvFlag('CAPABILITY_CACHE'),
      gpuMonitoring: this.getEnvFlag('GPU_MONITORING'),
      capabilityConfig: this.getEnvFlag('CAPABILITY_CONFIG'),
      adaptiveQuality: this.getEnvFlag('ADAPTIVE_QUALITY'),
      featureDetection: this.getEnvFlag('FEATURE_DETECTION'),
      capabilityDebug: this.getEnvFlag('CAPABILITY_DEBUG'),
      performanceMonitoring: this.getEnvFlag('PERFORMANCE_MONITORING'),
    };
  }

  /**
   * Check if a specific feature is enabled
   */
  static isEnabled(feature: keyof CapabilityFeatureFlags): boolean {
    const flags = this.getFlags();
    return flags[feature];
  }

  /**
   * Check if any capability features are enabled (for development mode detection)
   */
  static hasAnyEnabled(): boolean {
    const flags = this.getFlags();
    return Object.values(flags).some((flag) => flag);
  }

  /**
   * Get current rollout phase based on enabled flags
   */
  static getCurrentPhase():
    | 'legacy'
    | 'week1'
    | 'week2'
    | 'week3'
    | 'week4'
    | 'week5'
    | 'production' {
    const flags = this.getFlags();

    if (flags.featureDetection) return 'production';
    if (flags.adaptiveQuality) return 'week4';
    if (flags.capabilityConfig) return 'week3';
    if (flags.gpuMonitoring) return 'week2';
    if (flags.enhancedFallback || flags.capabilityCache) return 'week1';

    return 'legacy';
  }

  /**
   * Development helper to log current feature flag state
   */
  static logCurrentState(): void {
    if (!this.isEnabled('capabilityDebug')) return;

    const flags = this.getFlags();

    console.table(flags);
  }
}

/**
 * Hook-style helper for React components
 */
export function useCapabilityFeatureFlags(): CapabilityFeatureFlags {
  return CapabilityFeatureFlagManager.getFlags();
}
