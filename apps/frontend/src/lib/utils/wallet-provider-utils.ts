import type { ConnectedWallet } from '@privy-io/react-auth';

/**
 * Utility functions for handling multiple wallet providers
 * Helps manage scenarios where users have multiple wallets installed (MetaMask, Phantom, etc.)
 */

export interface WalletProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isPhantom?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  providers?: WalletProvider[];
}

type ProviderWithMetadata = WalletProvider & {
  id?: string;
  info?: {
    rdns?: string;
    name?: string;
  };
  selectedAddress?: string;
  accounts?: string[];
};

const META_MASK_IDENTIFIERS = ['metamask', 'io.metamask'];
const PHANTOM_IDENTIFIERS = ['phantom', 'app.phantom'];
const COINBASE_IDENTIFIERS = ['coinbase', 'wallet.coinbase'];
const RABBY_IDENTIFIERS = ['rabby'];

function collectInjectedProviders(): WalletProvider[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const collected = new Set<WalletProvider>();
  const seen = new Set<WalletProvider>();

  const queue: WalletProvider[] = [];

  const enqueueIfValid = (candidate: unknown) => {
    if (!candidate || typeof candidate !== 'object') {
      return;
    }

    const provider = candidate as WalletProvider;
    if (typeof provider.request !== 'function' || seen.has(provider)) {
      return;
    }

    seen.add(provider);
    queue.push(provider);
  };

  enqueueIfValid(window.ethereum as WalletProvider | undefined);
  enqueueIfValid((window as any)?.phantom?.ethereum);

  for (const entry of queue) {
    collected.add(entry);

    const withProviders = entry as WalletProvider & { providers?: WalletProvider[] };
    if (Array.isArray(withProviders.providers)) {
      withProviders.providers.forEach((p) => enqueueIfValid(p));
    }

    const detected = (entry as any)?.detected;
    if (Array.isArray(detected)) {
      detected.forEach((p: WalletProvider) => enqueueIfValid(p));
    }

    const providerMap = (entry as any)?.providerMap;
    if (providerMap && typeof providerMap.values === 'function') {
      for (const value of providerMap.values()) {
        enqueueIfValid(value?.provider ?? value);
      }
    }
  }

  return Array.from(collected);
}

function isMetaMaskProvider(provider: ProviderWithMetadata): boolean {
  if (provider.isMetaMask === true && provider.isPhantom !== true) {
    return true;
  }

  const id = provider.id?.toLowerCase();
  const rdns = provider.info?.rdns?.toLowerCase();
  const name = provider.info?.name?.toLowerCase();

  return META_MASK_IDENTIFIERS.some(
    (needle) => id?.includes(needle) || rdns?.includes(needle) || name?.includes(needle),
  );
}

function isPhantomProvider(provider: ProviderWithMetadata): boolean {
  if (provider.isPhantom === true) {
    return true;
  }

  const id = provider.id?.toLowerCase();
  const rdns = provider.info?.rdns?.toLowerCase();
  const name = provider.info?.name?.toLowerCase();

  return PHANTOM_IDENTIFIERS.some(
    (needle) => id?.includes(needle) || rdns?.includes(needle) || name?.includes(needle),
  );
}

function isCoinbaseProvider(provider: ProviderWithMetadata): boolean {
  if (provider.isCoinbaseWallet === true) {
    return true;
  }

  const id = provider.id?.toLowerCase();
  const rdns = provider.info?.rdns?.toLowerCase();
  const name = provider.info?.name?.toLowerCase();

  return COINBASE_IDENTIFIERS.some(
    (needle) => id?.includes(needle) || rdns?.includes(needle) || name?.includes(needle),
  );
}

function isRabbyProvider(provider: ProviderWithMetadata): boolean {
  if ((provider as any).isRabby === true) {
    return true;
  }

  const id = provider.id?.toLowerCase();
  const rdns = provider.info?.rdns?.toLowerCase();
  const name = provider.info?.name?.toLowerCase();

  return RABBY_IDENTIFIERS.some(
    (needle) => id?.includes(needle) || rdns?.includes(needle) || name?.includes(needle),
  );
}

function providerHasSelectedAddress(provider: ProviderWithMetadata, targetAddress?: string): boolean {
  if (!targetAddress) {
    return false;
  }

  const normalized = targetAddress.toLowerCase();

  const selected = provider.selectedAddress;
  if (typeof selected === 'string' && selected.toLowerCase() === normalized) {
    return true;
  }

  const accounts = provider.accounts;
  if (Array.isArray(accounts)) {
    return accounts.some(
      (account) => typeof account === 'string' && account.toLowerCase() === normalized,
    );
  }

  return false;
}

function selectInjectedProvider(
  predicate: (provider: ProviderWithMetadata) => boolean,
  targetAddress?: string,
): WalletProvider | null {
  const providers = collectInjectedProviders().filter((provider) =>
    predicate(provider as ProviderWithMetadata),
  );

  if (providers.length === 0) {
    return null;
  }

  if (targetAddress) {
    const matchByAddress = providers.find((provider) =>
      providerHasSelectedAddress(provider as ProviderWithMetadata, targetAddress),
    );
    if (matchByAddress) {
      return matchByAddress;
    }
  }

  return providers[0];
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
    // Get the provider based on Privy's wallet client type
    // For Privy embedded wallets, pass the wallet object itself
    const provider = getProviderForWalletType(
      privyWallet.walletClientType,
      privyWallet,
      targetAddress,
    );
    if (provider) {
      return provider;
    }
  }

  // Try to match an injected provider by selected address
  const addressMatch = collectInjectedProviders().find((provider) =>
    providerHasSelectedAddress(provider as ProviderWithMetadata, targetAddress),
  );
  if (addressMatch) {
    return addressMatch;
  }

  // Fallback to auto-detection
  return getActiveWalletProvider();
}

/**
 * Get provider for a specific wallet type (as reported by Privy)
 */
export function getProviderForWalletType(
  walletClientType: string,
  privyWallet?: ConnectedWallet,
  targetAddress?: string,
): WalletProvider | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const normalized = walletClientType.toLowerCase();

  // Try to get the provider directly from the Privy wallet object (works for embedded and some externals)
  if (privyWallet) {
    try {
      const direct =
        (privyWallet as any).getEthereumProvider?.() ??
        (privyWallet as any).provider ??
        (privyWallet as any).ethereumProvider;
      if (direct && typeof (direct as WalletProvider).request === 'function') {
        return direct as WalletProvider;
      }
    } catch (error) {
      console.error('[WalletProvider] Failed to get provider from Privy wallet:', error);
    }
  }

  if (normalized.includes('privy')) {
    // Embedded wallets should have been handled above
    return null;
  }

  if (normalized.includes('phantom')) {
    const phantomEthereum = (window as any)?.phantom?.ethereum as WalletProvider | undefined;
    if (phantomEthereum?.isPhantom) {
      return phantomEthereum;
    }

    const phantomProvider = selectInjectedProvider(isPhantomProvider, targetAddress);
    if (phantomProvider) {
      return phantomProvider;
    }

    console.warn('[WalletProvider] ⚠️ Phantom wallet not found');
    return null;
  }

  if (normalized.includes('metamask')) {
    const metamaskProvider = selectInjectedProvider(isMetaMaskProvider, targetAddress);
    if (metamaskProvider) {
      return metamaskProvider;
    }

    console.warn('[WalletProvider] ⚠️ MetaMask provider not detected');
    return null;
  }

  if (normalized.includes('coinbase')) {
    const coinbaseProvider = selectInjectedProvider(isCoinbaseProvider, targetAddress);
    if (coinbaseProvider) {
      return coinbaseProvider;
    }

    console.warn('[WalletProvider] ⚠️ Coinbase Wallet provider not detected');
    return null;
  }

  if (normalized.includes('rabby')) {
    const rabbyProvider = selectInjectedProvider(isRabbyProvider, targetAddress);
    if (rabbyProvider) {
      return rabbyProvider;
    }

    console.warn('[WalletProvider] ⚠️ Rabby provider not detected');
    return null;
  }

  if (targetAddress) {
    const byAddress = collectInjectedProviders().find((provider) =>
      providerHasSelectedAddress(provider as ProviderWithMetadata, targetAddress),
    );
    if (byAddress) {
      return byAddress;
    }
  }

  return getActiveWalletProvider();
}

/**
 * Detect which wallet provider the user is actively using
 * ⚠️ DEPRECATED: Use getProviderForAddress() with Privy wallets instead
 * This function is kept for backwards compatibility but may not work correctly
 * when multiple wallets are installed.
 */
export function getActiveWalletProvider(): WalletProvider | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const ethereum = window.ethereum as WalletProvider | undefined;
  if (ethereum && typeof ethereum.request === 'function') {
    return ethereum;
  }

  const providers = collectInjectedProviders();
  return providers[0] ?? null;
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
export function getWalletInitDelay(walletClientType?: string): number {
  // Privy embedded wallets need extra time to initialize
  if (walletClientType) {
    const normalized = walletClientType.toLowerCase();
    if (normalized.includes('privy')) {
      return 1500; // Privy embedded wallets need more time
    }
  }

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
