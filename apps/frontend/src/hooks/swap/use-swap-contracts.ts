import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { useWallets } from '@privy-io/react-auth';
import { useWalletClient } from 'wagmi';
import { getContractAddresses } from '@/lib/contracts/addresses';
import { ACES_FACTORY_ABI, ERC20_ABI, LAUNCHPAD_TOKEN_ABI } from '@/lib/contracts/abi';
import {
  getProviderForAddress,
  getCurrentChainIdFromProvider,
  getWalletInitDelay,
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
  // Get Privy's connected wallets - THIS IS KEY!
  const { wallets: privyWallets } = useWallets();
  // Get wagmi wallet client for Privy smart wallet support
  const { data: walletClient } = useWalletClient();

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
   * Initialize provider and contracts
   * @returns True if initialization succeeded
   */
  const initializeProvider = useCallback(async (): Promise<boolean> => {
    if (initializingRef.current) {
      // console.log('[useSwapContracts] Initialization already in progress, skipping');
      return false;
    }

    if (!isAuthenticated || !walletAddress) {
      // console.log('[useSwapContracts] Not authenticated or no wallet address');
      return false;
    }

    if (typeof window === 'undefined') {
      // console.log('[useSwapContracts] Not in browser environment');
      return false;
    }

    try {
      initializingRef.current = true;
      setInitializationError(null);

      // Find the Privy wallet that matches our address
      const privyWallet = privyWallets.find(
        (w) => w.address.toLowerCase() === walletAddress.toLowerCase(),
      );

      if (!privyWallet) {
        console.warn('[useSwapContracts] ⚠️ Wallet not found in Privy wallets', {
          targetAddress: walletAddress,
          availableWallets: privyWallets.map((w) => ({
            address: w.address,
            type: w.walletClientType,
          })),
        });
        initializingRef.current = false;
        return false;
      }

      const walletClientType = privyWallet.walletClientType || '';
      const isPrivyWallet = walletClientType.toLowerCase().includes('privy');

      let newProvider: ethers.providers.Web3Provider;
      let chainId: number;

      // Use wagmi for Privy smart wallets
      if (isPrivyWallet) {
        if (!walletClient) {
          initializingRef.current = false;
          return false;
        }

        // Create ethers provider from wagmi wallet client
        const network = {
          chainId: walletClient.chain.id,
          name: walletClient.chain.name,
        };

        newProvider = new ethers.providers.Web3Provider(
          walletClient.transport as unknown as ethers.providers.ExternalProvider,
          network,
        );

        chainId = walletClient.chain.id;
      } else {
        // Use traditional EIP-1193 provider for external wallets
        const ethProvider = getProviderForAddress(walletAddress, privyWallets);

        if (!ethProvider) {
          console.warn('[useSwapContracts] ⚠️ Wallet provider not available yet');
          initializingRef.current = false;
          return false;
        }

        // Get current chain ID from the specific provider
        const detectedChainId = await getCurrentChainIdFromProvider(ethProvider);

        if (!detectedChainId) {
          throw new Error('Failed to get chain ID');
        }

        chainId = detectedChainId;
        newProvider = new ethers.providers.Web3Provider(ethProvider, 'any');
      }

      // Get contract addresses for this chain
      const addresses = getContractAddresses(chainId);

      if (!addresses.FACTORY_PROXY || !addresses.ACES_TOKEN) {
        throw new Error(`Contract addresses not configured for chain ID ${chainId}`);
      }

      // Get signer from provider
      const newSigner = newProvider.getSigner();

      // Verify signer address matches wallet address
      const signerAddress = await newSigner.getAddress();
      // console.log('[useSwapContracts] 🔍 Address verification:', {
      //   signerAddress,
      //   expectedAddress: walletAddress,
      //   match: signerAddress.toLowerCase() === walletAddress.toLowerCase(),
      // });

      if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error(
          `Signer address mismatch! Expected ${walletAddress} but got ${signerAddress}. ` +
            `This may happen if you switched wallets. Please refresh the page.`,
        );
      }

      // console.log('[useSwapContracts] ✅ Provider and signer initialized');

      // Initialize contracts
      const factory = new ethers.Contract(addresses.FACTORY_PROXY, ACES_FACTORY_ABI, newSigner);
      const aces = new ethers.Contract(addresses.ACES_TOKEN, ERC20_ABI, newSigner);

      // Initialize token contract if address provided
      let token: ethers.Contract | null = null;
      if (tokenAddress) {
        token = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, newSigner);
        // console.log('[useSwapContracts] Token contract initialized:', tokenAddress);
      }

      // Update state
      setProvider(newProvider);
      setSigner(newSigner);
      setFactoryContract(factory);
      setAcesContract(aces);
      setTokenContract(token);
      setCurrentChainId(chainId);
      setIsInitialized(true);

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
  }, [isAuthenticated, walletAddress, tokenAddress, privyWallets, walletClient]); // ADD privyWallets and walletClient to deps

  /**
   * Clean up provider and contract state
   */
  const cleanup = useCallback(() => {
    // console.log('[useSwapContracts] 🧹 Cleaning up state...');
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
      // console.log('[useSwapContracts] Token contract updated:', tokenAddress);
    } catch (error) {
      console.error('[useSwapContracts] Failed to create token contract:', error);
      setTokenContract(null);
    }
  }, [signer, tokenAddress]);

  /**
   * Auto-initialize when wallet connects (with retry logic)
   */
  useEffect(() => {
    if (
      isAuthenticated &&
      walletAddress &&
      !provider &&
      !initializingRef.current &&
      privyWallets.length > 0
    ) {
      // console.log('[useSwapContracts] Auto-initializing from auth state...');

      // Find the wallet to determine client type
      const wallet = privyWallets.find(
        (w) => w.address.toLowerCase() === walletAddress.toLowerCase(),
      );
      const walletClientType = wallet?.walletClientType || 'unknown';
      const isPrivyWallet = walletClientType.toLowerCase().includes('privy');

      let retryCount = 0;
      const maxRetries = isPrivyWallet ? 5 : 3; // More retries for Privy embedded wallets
      const delay = getWalletInitDelay(walletClientType);

      const attemptInitialization = async () => {
        const success = await initializeProvider();

        if (!success && retryCount < maxRetries) {
          retryCount++;
          setTimeout(attemptInitialization, delay * (retryCount + 1));
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
  }, [
    isAuthenticated,
    walletAddress,
    provider,
    privyWallets,
    walletClient,
    initializeProvider,
    cleanup,
  ]); // ADD privyWallets and walletClient

  /**
   * Handle chain changes
   */
  /**
   * Handle chain changes
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !walletAddress) {
      return;
    }

    const handleChainChanged = async (...args: unknown[]) => {
      const chainIdHex = args[0] as string;
      // console.log('[useSwapContracts] ⛓️ Chain changed:', chainIdHex);
      const newChainId = Number.parseInt(chainIdHex, 16);

      if (newChainId && newChainId !== currentChainId) {
        // console.log('[useSwapContracts] Switching from chain', currentChainId, 'to', newChainId);
        setCurrentChainId(newChainId);
        cleanup();
        const delay = getWalletInitDelay();
        setTimeout(() => {
          initializeProvider();
        }, delay);
      }
    };

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      // console.log('[useSwapContracts] 👤 Accounts changed:', accounts);
      if (accounts.length === 0) {
        cleanup();
      } else if (walletAddress && accounts[0]?.toLowerCase() !== walletAddress.toLowerCase()) {
        // console.log('[useSwapContracts] Account switched, reinitializing...');
        cleanup();
        const delay = getWalletInitDelay();
        setTimeout(() => {
          initializeProvider();
        }, delay);
      }
    };

    // Get the correct provider for event listeners - use Privy's wallet info
    const ethProvider = getProviderForAddress(walletAddress, privyWallets);

    if (!ethProvider) {
      // console.warn('[useSwapContracts] No provider found for event listeners');
      return;
    }

    // Check if the provider supports event listeners (Privy smart wallets may not)
    if (typeof ethProvider.on !== 'function') {
      return;
    }

    ethProvider.on('chainChanged', handleChainChanged);
    ethProvider.on('accountsChanged', handleAccountsChanged);

    return () => {
      ethProvider?.removeListener?.('chainChanged', handleChainChanged);
      ethProvider?.removeListener?.('accountsChanged', handleAccountsChanged);
    };
  }, [currentChainId, walletAddress, privyWallets, cleanup, initializeProvider]); // ADD privyWallets

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
