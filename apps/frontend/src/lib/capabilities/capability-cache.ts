import type { DeviceCapabilities, CapabilityCacheData } from '../../types/capabilities';

/**
 * Versioned capability caching system
 * Provides smart cache invalidation with version control and user agent validation
 */
export class CapabilityCache {
  private static readonly CACHE_KEY = 'device_capabilities';
  private static readonly CURRENT_VERSION = '1.0.0';
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get cached capabilities with comprehensive validation
   */
  static getCachedCapabilities(): DeviceCapabilities | null {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return null;

      const cacheData: CapabilityCacheData = JSON.parse(cached);
      const { capabilities, timestamp, version, userAgent } = cacheData;

      // Invalidate cache if:
      // 1. Version changed (algorithm improved)
      // 2. Cache expired
      // 3. User agent changed (different browser/device)
      const isValid =
        version === this.CURRENT_VERSION &&
        Date.now() - timestamp < this.CACHE_DURATION &&
        userAgent === navigator.userAgent;

      if (isValid) {
        return capabilities;
      } else {
        // Clean up invalid cache
        this.clearCache();
        return null;
      }
    } catch (error) {
      console.warn('Failed to read capability cache:', error);
      this.clearCache();
      return null;
    }
  }

  /**
   * Cache capabilities with versioning metadata
   */
  static setCachedCapabilities(capabilities: DeviceCapabilities): void {
    try {
      const cacheData: CapabilityCacheData = {
        capabilities,
        timestamp: Date.now(),
        version: this.CURRENT_VERSION,
        userAgent: navigator.userAgent,
      };

      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache capabilities:', error);
      // Continue without caching - not critical
    }
  }

  /**
   * Clear capability cache
   */
  static clearCache(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY);
    } catch (error) {
      // Silent fail - not critical
    }
  }

  /**
   * Get cache information for debugging
   */
  static getCacheInfo(): { hasCache: boolean; age?: number; version?: string; isValid?: boolean } {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return { hasCache: false };

      const { timestamp, version, userAgent } = JSON.parse(cached) as CapabilityCacheData;
      const age = Date.now() - timestamp;
      const isValid =
        version === this.CURRENT_VERSION &&
        age < this.CACHE_DURATION &&
        userAgent === navigator.userAgent;

      return {
        hasCache: true,
        age,
        version,
        isValid,
      };
    } catch {
      return { hasCache: false };
    }
  }

  /**
   * Force cache invalidation (useful for development/testing)
   */
  static invalidateCache(): void {
    this.clearCache();
  }

  /**
   * Update cache version (will invalidate all existing caches)
   */
  static updateVersion(): void {
    // This would typically be done during deployment
    // For now, just log the version change
  }
}
