'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig, http, fallback } from 'wagmi';
import { baseSepolia, base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../lib/auth/auth-context';
import { ModalProvider } from '../../lib/contexts/modal-context';
import GlobalModals from '../ui/custom/global-modals';
import { type ReactNode } from 'react';

// Initialize QueryClient for wagmi with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5, // 5 minutes (shorter for better real-time data)
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

// RELIABLE Base Sepolia RPC endpoints
const BASE_SEPOLIA_RPCS = [
  'https://sepolia.base.org',
  'https://base-sepolia-rpc.publicnode.com',
  'https://base-sepolia.blockpi.network/v1/rpc/public',
  'https://base-sepolia.gateway.tenderly.co',
  'https://1rpc.io/base-sepolia',
];

// RELIABLE Base Mainnet RPC endpoints
const BASE_MAINNET_RPCS = [
  'https://mainnet.base.org',
  'https://base-rpc.publicnode.com',
  'https://base.blockpi.network/v1/rpc/public',
  'https://base.gateway.tenderly.co',
  'https://1rpc.io/base',
];

// Create wagmi config with reliable RPC endpoints
const wagmiConfig = createConfig({
  chains: [baseSepolia, base],
  transports: {
    // Base Sepolia with fallback RPC endpoints
    [baseSepolia.id]: fallback(
      BASE_SEPOLIA_RPCS.map((url) =>
        http(url, {
          timeout: 15000, // 15 second timeout
          retryCount: 2,
          retryDelay: 1000,
        }),
      ),
    ),
    // Base Mainnet with fallback RPC endpoints
    [base.id]: fallback(
      BASE_MAINNET_RPCS.map((url) =>
        http(url, {
          timeout: 15000,
          retryCount: 2,
          retryDelay: 1000,
          // rank: index === 0 ? 1 : 2,
        }),
      ),
    ),
  },
  // Enable batching for better performance
  batch: {
    multicall: {
      batchSize: 1024,
      wait: 16,
    },
  },
  // Disable provider discovery that might interfere
  multiInjectedProviderDiscovery: false,
  // Enable SSR
  ssr: true,
});

export default function AppProviders({ children }: { children: ReactNode }) {
  // Debug Privy configuration
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // Log configuration issues in development/staging
  if (typeof window !== 'undefined') {
    if (!privyAppId) {
      console.error('🚨 PRIVY_APP_ID is missing! Wallet connections will fail.');
    } else {
      console.log('✅ Privy App ID found:', privyAppId.slice(0, 8) + '...');
    }
    console.log('🌐 Current domain:', window.location.hostname);
    console.log('🔧 Current origin:', window.location.origin);
  }

  // Don't render Privy if app ID is missing
  if (!privyAppId) {
    console.error('🛑 Cannot initialize Privy without app ID');
    return (
      <QueryClientProvider client={queryClient}>
        <div className="flex items-center justify-center min-h-screen bg-black text-red-400">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Configuration Error</h2>
            <p>Privy App ID is missing. Please check environment variables.</p>
          </div>
        </div>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider
        appId={privyAppId}
        config={{
          loginMethods: ['wallet', 'email'],
          appearance: {
            theme: 'dark',
            accentColor: '#D0B264',
            logo: '/aces-logo.png',
            loginMessage: 'Connect your wallet to ACES',
            showWalletLoginFirst: false, // Show Privy options first
            walletList: ['metamask', 'coinbase_wallet', 'wallet_connect'],
          },
          embeddedWallets: {
            createOnLogin: 'all-users', // Create embedded wallet for everyone by default
            requireUserPasswordOnCreate: false,
            showWalletUIs: true,
          },
          defaultChain: baseSepolia,
          supportedChains: [baseSepolia, base],
        }}
      >
        <WagmiProvider config={wagmiConfig}>
          <AuthProvider>
            <ModalProvider>
              {children}
              <GlobalModals />
            </ModalProvider>
          </AuthProvider>
        </WagmiProvider>
      </PrivyProvider>
    </QueryClientProvider>
  );
}
