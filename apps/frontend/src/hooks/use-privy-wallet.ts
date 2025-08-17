// hooks/usePrivyWallet.ts
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback } from 'react';

export function usePrivyWallet() {
  const { user, authenticated, exportWallet } = usePrivy();
  const { wallets } = useWallets();

  // Check if user has an embedded wallet (email login)
  const hasEmbeddedWallet = useCallback(() => {
    return wallets.some((wallet) => wallet.walletClientType === 'privy');
  }, [wallets]);

  // Check if user connected via external wallet (MetaMask, etc.)
  const hasExternalWallet = useCallback(() => {
    return wallets.some((wallet) => wallet.walletClientType !== 'privy');
  }, [wallets]);

  // Get the primary wallet
  const getPrimaryWallet = useCallback(() => {
    return wallets[0] || null;
  }, [wallets]);

  // Privy's actual wallet functionality - Export wallet (show private key)
  const handleExportWallet = useCallback(() => {
    if (exportWallet && hasEmbeddedWallet()) {
      try {
        exportWallet();
      } catch (error) {
        console.error('❌ Export wallet failed:', error);
        throw error;
      }
    } else {
      throw new Error('Export wallet not available for this wallet type');
    }
  }, [exportWallet, hasEmbeddedWallet]);

  return {
    // State
    authenticated,
    user,
    wallets,
    primaryWallet: getPrimaryWallet(),

    // Wallet type checks
    hasEmbeddedWallet: hasEmbeddedWallet(),
    hasExternalWallet: hasExternalWallet(),

    // Actions (based on actual Privy capabilities)
    exportWallet: handleExportWallet,
  };
}
