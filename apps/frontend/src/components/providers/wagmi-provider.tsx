'use client';

import { WagmiProvider, createConfig, http, fallback } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

// Multiple RPC endpoints for Base Mainnet reliability
const BASE_MAINNET_RPCS = [
  process.env.QUICKNODE_BASE_URL,
  process.env.BASE_MAINNET_RPC_URL,
  'https://mainnet.base.org',
  'https://base-rpc.publicnode.com',
  'https://base.blockpi.network/v1/rpc/public',
  'https://base.gateway.tenderly.co',
];

// Multiple RPC endpoints for Base Sepolia reliability
const BASE_SEPOLIA_RPCS = [
  'https://sepolia.base.org',
  'https://base-sepolia-rpc.publicnode.com',
  'https://base-sepolia.blockpi.network/v1/rpc/public',
  'https://base-sepolia.gateway.tenderly.co',
];

// Create wagmi config with fallback RPC endpoints
const config = createConfig({
  chains: [base, baseSepolia],
  transports: {
    [base.id]: fallback(
      BASE_MAINNET_RPCS.map((url) =>
        http(url, {
          timeout: 10000,
          retryCount: 2,
          retryDelay: 1000,
        }),
      ),
    ),
    [baseSepolia.id]: fallback(
      BASE_SEPOLIA_RPCS.map((url) =>
        http(url, {
          timeout: 10000,
          retryCount: 2,
          retryDelay: 1000,
        }),
      ),
    ),
  },
  // Additional options for better reliability when no wallet is connected
  multiInjectedProviderDiscovery: false,
  ssr: true,
  // Enable batch requests for better performance
  batch: {
    multicall: true,
  },
});

export default function WagmiConfigProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>{children}</WagmiProvider>
    </QueryClientProvider>
  );
}
