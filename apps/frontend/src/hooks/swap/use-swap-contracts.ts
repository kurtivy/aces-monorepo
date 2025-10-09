import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { getContractAddresses } from '@/lib/contracts/addresses';
import { ACES_FACTORY_ABI, ERC20_ABI, LAUNCHPAD_TOKEN_ABI } from '@/lib/contracts/abi';

/**
 * Hook for managing Web3 provider, signer, and contract instances
 * Handles wallet connection detection, provider initialization, and contract setup
 * Automatically reinitializes when chain changes or wallet connects/disconnects
 */
export function useSwapContracts(
  walletAddress: string | null,
  isAuthenticated: boolean,
  tokenAddress?: string,
) {
  // State
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [factoryContract, setFactoryContract] = useState<ethers.Contract | null>(null);
  const [acesContract, setAcesContract] = useState<ethers.Contract | null>(null);
  const [tokenContract, setTokenContract] = useState<ethers.Contract | null>(null);
  const [currentChainId, setCurrentChainId] = useState<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  // Track if we're currently initializing to prevent race conditions
  const initializingRef = useRef(false);

  /**
   * Get the current chain ID from the wallet
   * @returns Chain ID or null if unavailable
   */
  const getCurrentChainId = useCallback(async (): Promise<number | null> => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return null;
    }

    try {
      const chainIdHex = (await window.ethereum.request({ method: 'eth_chainId' })) as string;
      return Number.parseInt(chainIdHex, 16);
    } catch (error) {
      console.error('[useSwapContracts] Failed to get chain ID:', error);
      return null;
    }
  }, []);

  /**
   * Initialize provider and contracts
   * @returns True if initialization succeeded
   */
  const initializeProvider = useCallback(async (): Promise<boolean> => {
    if (initializingRef.current) {
      console.log('[useSwapContracts] Initialization already in progress, skipping');
      return false;
    }

    if (!isAuthenticated || !walletAddress) {
      console.log('[useSwapContracts] Not authenticated or no wallet address');
      return false;
    }

    if (typeof window === 'undefined') {
      console.log('[useSwapContracts] Not in browser environment');
      return false;
    }

    try {
      initializingRef.current = true;
      setInitializationError(null);

      console.log('[useSwapContracts] Starting initialization...');

      // Wait for Privy to inject the provider
      let ethProvider = window.ethereum || (window as any).ethereum;

      if (!ethProvider) {
        console.log('[useSwapContracts] Provider not available, will retry...');
        initializingRef.current = false;
        return false;
      }

      // Get current chain ID
      const chainId = await getCurrentChainId();
      console.log('[useSwapContracts] Current chain ID:', chainId);

      if (!chainId) {
        throw new Error('Failed to get chain ID');
      }

      // Get contract addresses for this chain
      const addresses = getContractAddresses(chainId);
      console.log('[useSwapContracts] Contract addresses:', addresses);

      if (!addresses.FACTORY_PROXY || !addresses.ACES_TOKEN) {
        throw new Error(`Contract addresses not configured for chain ID ${chainId}`);
      }

      // Initialize provider and signer
      const newProvider = new ethers.providers.Web3Provider(ethProvider);
      const newSigner = newProvider.getSigner(walletAddress);

      // Verify signer address matches wallet address (prevents stale state)
      const signerAddress = await newSigner.getAddress();
      if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error('Signer address mismatch - wallet may have changed');
      }

      console.log('[useSwapContracts] Provider and signer initialized');

      // Initialize contracts
      const factory = new ethers.Contract(addresses.FACTORY_PROXY, ACES_FACTORY_ABI, newSigner);
      const aces = new ethers.Contract(addresses.ACES_TOKEN, ERC20_ABI, newSigner);

      // Initialize token contract if address provided
      let token: ethers.Contract | null = null;
      if (tokenAddress) {
        token = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, newSigner);
        console.log('[useSwapContracts] Token contract initialized:', tokenAddress);
      }

      // Update state
      setProvider(newProvider);
      setSigner(newSigner);
      setFactoryContract(factory);
      setAcesContract(aces);
      setTokenContract(token);
      setCurrentChainId(chainId);
      setIsInitialized(true);

      console.log('[useSwapContracts] ✅ Initialization complete', {
        chainId,
        factoryProxy: addresses.FACTORY_PROXY,
        acesToken: addresses.ACES_TOKEN,
        tokenAddress,
      });

      return true;
    } catch (error) {
      console.error('[useSwapContracts] ❌ Initialization failed:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to initialize wallet connection';
      setInitializationError(errorMessage);
      return false;
    } finally {
      initializingRef.current = false;
    }
  }, [isAuthenticated, walletAddress, tokenAddress, getCurrentChainId]);

  /**
   * Clean up provider and contract state
   */
  const cleanup = useCallback(() => {
    console.log('[useSwapContracts] 🧹 Cleaning up state...');
    setProvider(null);
    setSigner(null);
    setFactoryContract(null);
    setAcesContract(null);
    setTokenContract(null);
    setIsInitialized(false);
    setInitializationError(null);
  }, []);

  /**
   * Update token contract when token address changes
   */
  useEffect(() => {
    if (!signer || !tokenAddress) {
      setTokenContract(null);
      return;
    }

    try {
      const token = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, signer);
      setTokenContract(token);
      console.log('[useSwapContracts] Token contract updated:', tokenAddress);
    } catch (error) {
      console.error('[useSwapContracts] Failed to create token contract:', error);
      setTokenContract(null);
    }
  }, [signer, tokenAddress]);

  /**
   * Auto-initialize when wallet connects
   */
  useEffect(() => {
    if (isAuthenticated && walletAddress && !provider && !initializingRef.current) {
      console.log('[useSwapContracts] Auto-initializing from auth state...');

      // Add small delay to ensure Privy provider is ready
      const timeoutId = setTimeout(() => {
        initializeProvider();
      }, 500);

      return () => clearTimeout(timeoutId);
    } else if (!isAuthenticated || !walletAddress) {
      // Clean up when disconnected
      if (provider) {
        cleanup();
      }
    }
  }, [isAuthenticated, walletAddress, provider, initializeProvider, cleanup]);

  /**
   * Handle chain changes
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return;
    }

    const handleChainChanged = async () => {
      console.log('[useSwapContracts] ⛓️ Chain changed, reinitializing...');
      const newChainId = await getCurrentChainId();

      if (newChainId && newChainId !== currentChainId) {
        setCurrentChainId(newChainId);
        // Force reinitialization
        cleanup();
        setTimeout(() => {
          initializeProvider();
        }, 100);
      }
    };

    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [currentChainId, getCurrentChainId, cleanup, initializeProvider]);

  /**
   * Update chain ID on mount
   */
  useEffect(() => {
    getCurrentChainId().then((chainId) => {
      if (chainId && chainId !== currentChainId) {
        setCurrentChainId(chainId);
      }
    });
  }, [getCurrentChainId, currentChainId]);

  return {
    // Contracts
    provider,
    signer,
    factoryContract,
    acesContract,
    tokenContract,

    // State
    currentChainId,
    isInitialized,
    initializationError,

    // Actions
    initializeProvider,
    cleanup,
  };
}
