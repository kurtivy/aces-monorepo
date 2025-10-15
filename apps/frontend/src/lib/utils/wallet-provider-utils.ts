import type { ConnectedWallet } from '@privy-io/react-auth';

/**
 * Utility functions for handling multiple wallet providers
 * Helps manage scenarios where users have multiple wallets installed (MetaMask, Phantom, etc.)
 */

export interface WalletProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isPhantom?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  providers?: WalletProvider[];
}

/**
 * Get provider for a specific wallet address
 * This is the KEY function - it matches Privy's connected wallet to the actual provider
 */
export function getProviderForAddress(
  targetAddress: string,
  privyWallets?: ConnectedWallet[],
): WalletProvider | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // First, check if Privy knows about this wallet
  const privyWallet = privyWallets?.find(
    (w) => w.address.toLowerCase() === targetAddress.toLowerCase(),
  );

  if (privyWallet) {
    console.log('[WalletProvider] Found Privy wallet:', {
      address: privyWallet.address,
      walletClientType: privyWallet.walletClientType,
      connectorType: privyWallet.connectorType,
    });

    // Get the provider based on Privy's wallet client type
    return getProviderForWalletType(privyWallet.walletClientType);
  }

  // Fallback to auto-detection
  console.warn('[WalletProvider] No Privy wallet found for address, using auto-detection');
  return getActiveWalletProvider();
}

/**
 * Get provider for a specific wallet type (as reported by Privy)
 */
export function getProviderForWalletType(walletClientType: string): WalletProvider | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const normalized = walletClientType.toLowerCase();

  console.log('[WalletProvider] Getting provider for wallet type:', walletClientType);

  // Handle Phantom
  if (normalized.includes('phantom')) {
    const phantomEthereum = (window as any)?.phantom?.ethereum as WalletProvider | undefined;
    if (phantomEthereum?.isPhantom) {
      console.log('[WalletProvider] ✅ Found Phantom provider');
      return phantomEthereum;
    }
  }

  // Handle MetaMask
  if (normalized.includes('metamask')) {
    const ethereum = window.ethereum as WalletProvider;

    // Check if there are multiple providers
    if (ethereum?.providers && ethereum.providers.length > 0) {
      const metamaskProvider = ethereum.providers.find(
        (p: WalletProvider) => p.isMetaMask === true && p.isPhantom !== true,
      );
      if (metamaskProvider) {
        console.log('[WalletProvider] ✅ Found MetaMask provider (from providers array)');
        return metamaskProvider;
      }
    }

    // Single provider that is MetaMask
    if (ethereum?.isMetaMask && !ethereum.isPhantom) {
      console.log('[WalletProvider] ✅ Found MetaMask provider (single)');
      return ethereum;
    }
  }

  // Handle Coinbase
  if (normalized.includes('coinbase')) {
    const ethereum = window.ethereum as WalletProvider;

    if (ethereum?.providers && ethereum.providers.length > 0) {
      const coinbaseProvider = ethereum.providers.find(
        (p: WalletProvider) => p.isCoinbaseWallet === true,
      );
      if (coinbaseProvider) {
        console.log('[WalletProvider] ✅ Found Coinbase provider');
        return coinbaseProvider;
      }
    }

    if (ethereum?.isCoinbaseWallet) {
      console.log('[WalletProvider] ✅ Found Coinbase provider (single)');
      return ethereum;
    }
  }

  // Handle Rabby
  if (normalized.includes('rabby')) {
    const ethereum = window.ethereum as WalletProvider;

    if (ethereum?.providers && ethereum.providers.length > 0) {
      const rabbyProvider = ethereum.providers.find(
        (p: WalletProvider) => (p as any).isRabby === true,
      );
      if (rabbyProvider) {
        console.log('[WalletProvider] ✅ Found Rabby provider');
        return rabbyProvider;
      }
    }
  }

  // Handle Privy embedded wallets
  if (normalized.includes('privy')) {
    console.log('[WalletProvider] Using Privy embedded wallet, returning window.ethereum');
    return window.ethereum as WalletProvider;
  }

  // Fallback to window.ethereum
  console.warn('[WalletProvider] ⚠️ Could not find specific provider, using window.ethereum');
  return window.ethereum as WalletProvider;
}

/**
 * Detect which wallet provider the user is actively using
 * ⚠️ DEPRECATED: Use getProviderForAddress() with Privy wallets instead
 * This function is kept for backwards compatibility but may not work correctly
 * when multiple wallets are installed.
 */
export function getActiveWalletProvider(): WalletProvider | null {
  if (typeof window === 'undefined' || !window.ethereum) {
    // Phantom sometimes exposes provider at window.phantom.ethereum
    const phantomEthereum = (window as any)?.phantom?.ethereum as WalletProvider | undefined;
    return phantomEthereum || null;
  }

  const ethereum = window.ethereum as WalletProvider;

  // If there's only one provider, use it
  if (!ethereum.providers || ethereum.providers.length === 0) {
    return ethereum;
  }

  // Multiple providers detected
  console.log('[WalletProvider] Multiple providers detected:', ethereum.providers.length);

  // Check which one is actively being used by checking window.ethereum properties
  // Priority: whichever wallet has set itself as the active provider on window.ethereum

  if (ethereum.isPhantom) {
    const phantomProvider = ethereum.providers.find((p: WalletProvider) => p.isPhantom === true);
    if (phantomProvider) {
      console.log('[WalletProvider] Selected: Phantom (active)');
      return phantomProvider;
    }
  }

  if (ethereum.isMetaMask && !ethereum.isPhantom) {
    const metamaskProvider = ethereum.providers.find(
      (p: WalletProvider) => p.isMetaMask === true && p.isPhantom !== true,
    );
    if (metamaskProvider) {
      console.log('[WalletProvider] Selected: MetaMask (active)');
      return metamaskProvider;
    }
  }

  if (ethereum.isCoinbaseWallet) {
    const coinbaseProvider = ethereum.providers.find(
      (p: WalletProvider) => p.isCoinbaseWallet === true,
    );
    if (coinbaseProvider) {
      console.log('[WalletProvider] Selected: Coinbase Wallet (active)');
      return coinbaseProvider;
    }
  }

  // Fallback: just use window.ethereum as-is
  console.log('[WalletProvider] Using window.ethereum as-is');
  return ethereum;
}

/**
 * Get current chain ID from a specific provider
 */
export async function getCurrentChainIdFromProvider(
  provider: WalletProvider,
): Promise<number | null> {
  try {
    const chainIdHex = (await provider.request({ method: 'eth_chainId' })) as string;
    return Number.parseInt(chainIdHex, 16);
  } catch (error) {
    console.error('[WalletProvider] Failed to get chain ID:', error);
    return null;
  }
}

/**
 * Get current chain ID from the active wallet provider
 */
export async function getCurrentChainId(): Promise<number | null> {
  try {
    const provider = getActiveWalletProvider();
    if (!provider) {
      return null;
    }

    return getCurrentChainIdFromProvider(provider);
  } catch (error) {
    console.error('[WalletProvider] Failed to get chain ID:', error);
    return null;
  }
}

/**
 * Request accounts from a specific provider
 */
export async function getAccountsFromProvider(provider: WalletProvider): Promise<string[]> {
  try {
    const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
    return accounts;
  } catch (error) {
    console.error('[WalletProvider] Failed to get accounts:', error);
    return [];
  }
}

/**
 * Request accounts from the active wallet provider
 */
export async function getAccounts(): Promise<string[]> {
  try {
    const provider = getActiveWalletProvider();
    if (!provider) {
      return [];
    }

    return getAccountsFromProvider(provider);
  } catch (error) {
    console.error('[WalletProvider] Failed to get accounts:', error);
    return [];
  }
}

/**
 * Check if a specific wallet type is installed
 */
export function isWalletInstalled(
  walletType: 'phantom' | 'metamask' | 'coinbase' | 'rabby',
): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const ethereum = window.ethereum as WalletProvider;

  // Check Phantom at window.phantom.ethereum
  if (walletType === 'phantom') {
    const phantomEthereum = (window as any)?.phantom?.ethereum;
    if (phantomEthereum?.isPhantom) return true;
  }

  if (!ethereum) return false;

  // Check providers array first
  if (ethereum.providers && ethereum.providers.length > 0) {
    switch (walletType) {
      case 'phantom':
        return ethereum.providers.some((p: WalletProvider) => p.isPhantom === true);
      case 'metamask':
        return ethereum.providers.some(
          (p: WalletProvider) => p.isMetaMask === true && p.isPhantom !== true,
        );
      case 'coinbase':
        return ethereum.providers.some((p: WalletProvider) => p.isCoinbaseWallet === true);
      case 'rabby':
        return ethereum.providers.some((p: WalletProvider) => (p as any).isRabby === true);
      default:
        return false;
    }
  }

  // Check single provider
  switch (walletType) {
    case 'phantom':
      return ethereum.isPhantom === true;
    case 'metamask':
      return ethereum.isMetaMask === true && ethereum.isPhantom !== true;
    case 'coinbase':
      return ethereum.isCoinbaseWallet === true;
    case 'rabby':
      return (ethereum as any).isRabby === true;
    default:
      return false;
  }
}

/**
 * Get the name of the currently active wallet
 */
export function getActiveWalletName(): string {
  if (typeof window === 'undefined' || !window.ethereum) {
    return 'Unknown';
  }

  const ethereum = window.ethereum as WalletProvider;

  if (ethereum.isPhantom) return 'Phantom';
  if (ethereum.isMetaMask && !ethereum.isPhantom) return 'MetaMask';
  if (ethereum.isCoinbaseWallet) return 'Coinbase Wallet';
  if ((ethereum as any).isRabby) return 'Rabby';

  return 'Unknown Wallet';
}

/**
 * Get wallet name from Privy's wallet client type
 */
export function getWalletNameFromType(walletClientType: string): string {
  const normalized = walletClientType.toLowerCase();

  if (normalized.includes('phantom')) return 'Phantom';
  if (normalized.includes('metamask')) return 'MetaMask';
  if (normalized.includes('coinbase')) return 'Coinbase Wallet';
  if (normalized.includes('rabby')) return 'Rabby';
  if (normalized.includes('privy')) return 'Privy Embedded Wallet';

  return walletClientType;
}

/**
 * Get recommended initialization delay based on wallet type
 * Different wallets need different initialization times
 */
export function getWalletInitDelay(): number {
  if (typeof window === 'undefined' || !window.ethereum) {
    return 500; // Default delay
  }

  const ethereum = window.ethereum as WalletProvider;

  // Phantom needs more time to initialize
  if (ethereum.isPhantom) {
    return 800;
  }

  // MetaMask is usually faster
  if (ethereum.isMetaMask && !ethereum.isPhantom) {
    return 500;
  }

  // Coinbase Wallet
  if (ethereum.isCoinbaseWallet) {
    return 600;
  }

  // Rabby
  if ((ethereum as any).isRabby) {
    return 500;
  }

  // Default for unknown wallets
  return 500;
}
