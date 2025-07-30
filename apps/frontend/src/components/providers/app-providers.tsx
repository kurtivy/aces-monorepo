'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig, http } from 'wagmi';
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
      staleTime: 1000 * 60 * 60, // 1 hour
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

// Create wagmi config
const wagmiConfig = createConfig({
  chains: [baseSepolia, base], // Add both testnet and mainnet
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(), // Add Base mainnet transport
  },
});

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
        config={{
          loginMethods: ['wallet', 'email'] as const,
          appearance: {
            theme: 'dark',
            accentColor: '#D0B264',
            logo: '/aces-logo.png',
          },
          embeddedWallets: {
            createOnLogin: 'users-without-wallets',
          },
          defaultChain: baseSepolia,
          supportedChains: [baseSepolia, base], // Add both chains
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
