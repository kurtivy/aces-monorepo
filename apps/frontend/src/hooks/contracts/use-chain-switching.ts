// hooks/useChainSwitching.ts
import { usePrivy } from '@privy-io/react-auth';
import { useChainId, useSwitchChain } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { useState, useCallback } from 'react';

// Define your supported chains
export const SUPPORTED_CHAINS = {
  BASE_MAINNET: base,
  BASE_SEPOLIA: baseSepolia,
} as const;

// Define your preferred chain for different operations
export const CHAIN_CONFIG = {
  // Default chain for general app usage
  DEFAULT: base,
  // Chain for real money operations (MoonPay, etc.)
  FUNDING: base,
  // Chain for development/testing
  DEVELOPMENT: baseSepolia,
} as const;

export function useChainSwitching() {
  const { authenticated } = usePrivy();
  const currentChainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [isPrompting, setIsPrompting] = useState(false);

  // Check if user is on the correct chain
  const isOnChain = useCallback(
    (targetChainId: number) => {
      return currentChainId === targetChainId;
    },
    [currentChainId],
  );

  // Check if user is on a supported chain
  const isOnSupportedChain = useCallback(() => {
    return Object.values(SUPPORTED_CHAINS).some((chain) => chain.id === currentChainId);
  }, [currentChainId]);

  // Get current chain info
  const getCurrentChain = useCallback(() => {
    return Object.values(SUPPORTED_CHAINS).find((chain) => chain.id === currentChainId);
  }, [currentChainId]);

  // Switch to a specific chain
  const switchToChain = useCallback(
    async (targetChain: (typeof SUPPORTED_CHAINS)[keyof typeof SUPPORTED_CHAINS]) => {
      if (!authenticated) {
        throw new Error('User must be authenticated to switch chains');
      }

      if (currentChainId === targetChain.id) {
        return true; // Already on target chain
      }

      try {
        setIsPrompting(true);
        await switchChain({ chainId: targetChain.id });
        return true;
      } catch (error) {
        console.error(`Failed to switch to ${targetChain.name}:`, error);
        throw error;
      } finally {
        setIsPrompting(false);
      }
    },
    [authenticated, currentChainId, switchChain],
  );

  // Switch to default chain
  const switchToDefault = useCallback(() => {
    return switchToChain(CHAIN_CONFIG.DEFAULT);
  }, [switchToChain]);

  // Switch to funding chain (for MoonPay, etc.)
  const switchToFunding = useCallback(() => {
    return switchToChain(CHAIN_CONFIG.FUNDING);
  }, [switchToChain]);

  // Prompt user to switch if not on correct chain
  const ensureCorrectChain = useCallback(
    async (
      targetChain: (typeof SUPPORTED_CHAINS)[keyof typeof SUPPORTED_CHAINS],
      options?: {
        showPrompt?: boolean;
        autoSwitch?: boolean;
      },
    ) => {
      const { showPrompt = true, autoSwitch = false } = options || {};

      if (!authenticated) {
        throw new Error('User must be authenticated');
      }

      if (isOnChain(targetChain.id)) {
        return true; // Already on correct chain
      }

      if (autoSwitch) {
        return await switchToChain(targetChain);
      }

      if (showPrompt) {
        // Return a promise that can be resolved by the UI component
        // This allows the calling component to show a proper modal
        throw new Error(`CHAIN_SWITCH_REQUIRED:${targetChain.name}:${targetChain.id}`);
      }

      return false;
    },
    [authenticated, isOnChain, switchToChain],
  );

  return {
    // State
    currentChainId,
    currentChain: getCurrentChain(),
    isOnSupportedChain: isOnSupportedChain(),
    isSwitching: isSwitching || isPrompting,

    // Chain checks
    isOnChain,
    isOnBaseMainnet: isOnChain(base.id),
    isOnBaseSepolia: isOnChain(baseSepolia.id),

    // Actions
    switchToChain,
    switchToDefault,
    switchToFunding,
    ensureCorrectChain,

    // Constants
    SUPPORTED_CHAINS,
    CHAIN_CONFIG,
  };
}
