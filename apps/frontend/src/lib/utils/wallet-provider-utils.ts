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
  providers?: WalletProvider[];
}

/**
 * Detect which wallet provider the user is actively using
 * Handles the case where multiple wallets are installed
 */
export function getActiveWalletProvider(): WalletProvider | null {
  if (typeof window === 'undefined' || !window.ethereum) {
    // Phantom sometimes exposes provider at window.phantom.ethereum
    // even when window.ethereum isn't available yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const phantomEthereum = (window as any)?.phantom?.ethereum as WalletProvider | undefined;
    return phantomEthereum || null;
  }

  const ethereum = window.ethereum as WalletProvider;

  // Prefer Phantom's explicit provider if available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phantomEthereum = (window as any)?.phantom?.ethereum as WalletProvider | undefined;
  if (phantomEthereum?.isPhantom) {
    return phantomEthereum;
  }

  // If there's only one provider, use it
  if (!ethereum.providers || ethereum.providers.length === 0) {
    return ethereum;
  }

  // Multiple providers detected - prioritize based on common usage patterns
  console.log('[WalletProvider] Multiple providers detected:', ethereum.providers.length);

  // Priority order:
  // 1. Phantom (if actively selected)
  // 2. MetaMask (if actively selected and not Phantom masquerading)
  // 3. Coinbase Wallet
  // 4. First available provider

  const phantomProvider = ethereum.providers.find((p: WalletProvider) => p.isPhantom === true);

  const metamaskProvider = ethereum.providers.find(
    (p: WalletProvider) => p.isMetaMask === true && p.isPhantom !== true,
  );

  const coinbaseProvider = ethereum.providers.find(
    (p: WalletProvider) => p.isCoinbaseWallet === true,
  );

  // Check which one is actively being used by checking window.ethereum properties
  if (ethereum.isPhantom && phantomProvider) {
    console.log('[WalletProvider] Selected: Phantom');
    return phantomProvider;
  }

  if (ethereum.isMetaMask && !ethereum.isPhantom && metamaskProvider) {
    console.log('[WalletProvider] Selected: MetaMask');
    return metamaskProvider;
  }

  if (ethereum.isCoinbaseWallet && coinbaseProvider) {
    console.log('[WalletProvider] Selected: Coinbase Wallet');
    return coinbaseProvider;
  }

  // Fallback to first provider
  const fallback =
    phantomProvider ||
    metamaskProvider ||
    coinbaseProvider ||
    phantomEthereum ||
    ethereum.providers[0];
  console.log('[WalletProvider] Fallback to first available provider');
  return fallback;
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

    const chainIdHex = (await provider.request({ method: 'eth_chainId' })) as string;
    return Number.parseInt(chainIdHex, 16);
  } catch (error) {
    console.error('[WalletProvider] Failed to get chain ID:', error);
    return null;
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

    const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
    return accounts;
  } catch (error) {
    console.error('[WalletProvider] Failed to get accounts:', error);
    return [];
  }
}

/**
 * Check if a specific wallet type is installed
 */
export function isWalletInstalled(walletType: 'phantom' | 'metamask' | 'coinbase'): boolean {
  if (typeof window === 'undefined' || !window.ethereum) {
    return false;
  }

  const ethereum = window.ethereum as WalletProvider;

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

  return 'Unknown Wallet';
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

  // Default for unknown wallets
  return 500;
}
