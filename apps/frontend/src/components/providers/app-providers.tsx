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
  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
        config={{
          loginMethods: ['wallet', 'email'],
          appearance: {
            theme: 'dark',
            accentColor: '#D0B264',
            logo: '/aces-logo.png',
          },
          embeddedWallets: {
            createOnLogin: 'users-without-wallets',
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
