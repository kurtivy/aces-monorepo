import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { getContractAddresses } from '@/lib/contracts/addresses';
import { ACES_FACTORY_ABI, ERC20_ABI, LAUNCHPAD_TOKEN_ABI } from '@/lib/contracts/abi';
import {
  getActiveWalletProvider,
  getCurrentChainId as getChainId,
  getWalletInitDelay,
  getActiveWalletName,
} from '@/lib/utils/wallet-provider-utils';

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
   * Uses centralized wallet provider utilities
   */
  const getCurrentChainId = useCallback(async (): Promise<number | null> => {
    return await getChainId();
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

      const walletName = getActiveWalletName();
      console.log('[useSwapContracts] Starting initialization with wallet:', walletName);

      // Get the correct provider - handle multiple wallet providers
      const ethProvider = getActiveWalletProvider();

      if (!ethProvider) {
        console.warn('[useSwapContracts] ⚠️ Wallet provider not available yet');
        console.log('[useSwapContracts] window.ethereum:', typeof window.ethereum);
        console.log('[useSwapContracts] Wallet address from auth:', walletAddress);
        initializingRef.current = false;
        return false;
      }

      console.log('[useSwapContracts] ✅ Wallet provider found:', walletName);

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
      const newProvider = new ethers.providers.Web3Provider(ethProvider, 'any');
      // Don't specify address - let the wallet provider determine the signer
      // This is important for Phantom and other wallets
      const newSigner = newProvider.getSigner();

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
   * Auto-initialize when wallet connects (with retry logic)
   */
  useEffect(() => {
    if (isAuthenticated && walletAddress && !provider && !initializingRef.current) {
      console.log('[useSwapContracts] Auto-initializing from auth state...');

      let retryCount = 0;
      const maxRetries = 3;
      const delay = getWalletInitDelay();

      const attemptInitialization = async () => {
        const success = await initializeProvider();

        if (!success && retryCount < maxRetries) {
          retryCount++;
          console.log(
            `[useSwapContracts] Initialization attempt ${retryCount} failed, retrying...`,
          );
          setTimeout(attemptInitialization, delay * (retryCount + 1)); // Increase delay with each retry
        } else if (!success) {
          console.error('[useSwapContracts] Failed to initialize after', maxRetries, 'attempts');
        }
      };

      // Start first attempt after initial delay
      const timeoutId = setTimeout(attemptInitialization, delay);

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

    const handleChainChanged = async (chainIdHex: string) => {
      console.log('[useSwapContracts] ⛓️ Chain changed:', chainIdHex);
      const newChainId = Number.parseInt(chainIdHex, 16);

      if (newChainId && newChainId !== currentChainId) {
        console.log('[useSwapContracts] Switching from chain', currentChainId, 'to', newChainId);
        setCurrentChainId(newChainId);
        // Force reinitialization with a delay to let the provider settle
        cleanup();
        const delay = getWalletInitDelay();
        setTimeout(() => {
          initializeProvider();
        }, delay);
      }
    };

    const handleAccountsChanged = (accounts: string[]) => {
      console.log('[useSwapContracts] 👤 Accounts changed:', accounts);
      if (accounts.length === 0) {
        // User disconnected their wallet
        cleanup();
      } else if (walletAddress && accounts[0]?.toLowerCase() !== walletAddress.toLowerCase()) {
        // Account switched - reinitialize
        console.log('[useSwapContracts] Account switched, reinitializing...');
        cleanup();
        const delay = getWalletInitDelay();
        setTimeout(() => {
          initializeProvider();
        }, delay);
      }
    };

    // Get the correct provider for event listeners
    const providerToUse = getActiveWalletProvider();

    if (!providerToUse) {
      console.warn('[useSwapContracts] No active wallet provider found for event listeners');
      return;
    }

    // Listen to events on the correct provider
    providerToUse.on('chainChanged', (...args: unknown[]) => handleChainChanged(args[0] as string));
    providerToUse.on('accountsChanged', (...args: unknown[]) =>
      handleAccountsChanged(args[0] as string[]),
    );

    return () => {
      providerToUse?.removeListener?.('chainChanged', (...args: unknown[]) =>
        handleChainChanged(args[0] as string),
      );
      providerToUse?.removeListener?.('accountsChanged', (...args: unknown[]) =>
        handleAccountsChanged(args[0] as string[]),
      );
    };
  }, [currentChainId, walletAddress, getCurrentChainId, cleanup, initializeProvider]);

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
