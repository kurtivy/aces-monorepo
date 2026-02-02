import { ethers } from 'ethers';
import { SupportedChainId, getNetworkConfig } from '../config/network.config';

/**
 * Provider Manager - Singleton Pattern
 *
 * Manages shared RPC provider instances to prevent redundant provider creation.
 * This reduces resource overhead and potential rate-limiting issues by centralizing
 * RPC provider access across the application.
 *
 * Benefits:
 * - Single provider instance per chain (reuses connections)
 * - Prevents rate limit issues from multiple provider instances
 * - Centralized provider configuration
 */
class ProviderManager {
  private static instance: ProviderManager;
  private providers: Map<SupportedChainId, ethers.JsonRpcProvider> = new Map();

  private constructor() {
    // Private constructor to enforce singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ProviderManager {
    if (!ProviderManager.instance) {
      ProviderManager.instance = new ProviderManager();
    }
    return ProviderManager.instance;
  }

  /**
   * Initialize providers for all supported chains
   * Only initializes chains that have RPC URLs configured
   */
  initializeProviders(): void {
    // Base Mainnet (8453) and Base Sepolia (84532)
    const chains: SupportedChainId[] = [8453, 84532];

    for (const chainId of chains) {
      try {
        this.getProvider(chainId);
      } catch (error) {
        console.warn(
          `⚠️ Failed to initialize provider for chain ${chainId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Continue with other chains
      }
    }
  }

  /**
   * Get provider for a specific chain
   * Creates provider if it doesn't exist
   */
  getProvider(chainId: SupportedChainId): ethers.JsonRpcProvider {
    if (this.providers.has(chainId)) {
      return this.providers.get(chainId)!;
    }

    // Get network config
    const config = getNetworkConfig(chainId);

    if (!config.rpcUrl) {
      throw new Error(`No RPC URL configured for chain ${chainId}`);
    }

    // Create provider with proper network configuration
    const network = new ethers.Network(chainId === 8453 ? 'base' : 'base-sepolia', chainId);
    const provider = new ethers.JsonRpcProvider(config.rpcUrl, network, {
      staticNetwork: true, // Skip network detection
    });

    this.providers.set(chainId, provider);
    console.log(
      `✅ Provider initialized for chain ${chainId}: ${config.rpcUrl.substring(0, 40)}...`,
    );

    return provider;
  }

  /**
   * Check if provider exists for a chain
   */
  hasProvider(chainId: SupportedChainId): boolean {
    return this.providers.has(chainId);
  }

  /**
   * Get all available chain IDs
   */
  getAvailableChains(): SupportedChainId[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Clear all providers (useful for testing)
   */
  clear(): void {
    this.providers.clear();
  }
}

// Export singleton instance
export const providerManager = ProviderManager.getInstance();

/**
 * Convenience function to get provider
 * This replaces the old createProvider() function for shared provider access
 */
export const getProvider = (chainId: SupportedChainId = 8453): ethers.JsonRpcProvider => {
  return providerManager.getProvider(chainId);
};
