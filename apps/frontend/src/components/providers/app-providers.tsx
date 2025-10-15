'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, type SetActiveWalletForWagmiType } from '@privy-io/wagmi';
import { createConfig, http, fallback } from 'wagmi';
import { baseSepolia, base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../lib/auth/auth-context';
import { ModalProvider } from '../../lib/contexts/modal-context';
import GlobalModals from '../ui/custom/global-modals';
import NetworkBanner from '../ui/custom/network-banner';
import { type ReactNode, useEffect } from 'react';
import { initCanvasFonts } from '../../lib/utils/font-loader';
import { PriceProvider } from '../../contexts/price-context';
import { BondingDataProvider } from '../../contexts/bonding-data-context';
import { MarketCapProvider } from '../../contexts/market-cap-context';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
      staleTime: 1000 * 60 * 5,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

const BASE_SEPOLIA_RPCS = [
  'https://sepolia.base.org',
  'https://base-sepolia-rpc.publicnode.com',
  'https://base-sepolia.blockpi.network/v1/rpc/public',
  'https://base-sepolia.gateway.tenderly.co',
  'https://1rpc.io/base-sepolia',
];

const BASE_MAINNET_RPCS = [
  process.env.QUICKNODE_BASE_URL,
  process.env.BASE_MAINNET_RPC_URL,
  'https://mainnet.base.org',
  'https://base-rpc.publicnode.com',
  'https://base.blockpi.network/v1/rpc/public',
  'https://base.gateway.tenderly.co',
  'https://1rpc.io/base',
].filter((url): url is string => typeof url === 'string' && url.length > 0);

export const wagmiConfig = createConfig({
  chains: [baseSepolia, base],
  transports: {
    [baseSepolia.id]: fallback(
      BASE_SEPOLIA_RPCS.map((url, index) =>
        http(url, {
          timeout: 15000,
          retryCount: 2,
          retryDelay: 1000,
          key: `baseSepolia-${index}`,
        }),
      ),
    ),
    [base.id]: fallback(
      BASE_MAINNET_RPCS.map((url, index) =>
        http(url, {
          timeout: 15000,
          retryCount: 2,
          retryDelay: 1000,
          key: `baseMainnet-${index}`,
        }),
      ),
    ),
  },
  batch: {
    multicall: {
      batchSize: 1024,
      wait: 16,
    },
  },
  ssr: true,
});

const selectActiveWalletForWagmi: SetActiveWalletForWagmiType = ({ wallets }) => {
  if (!wallets.length) {
    return undefined;
  }

  return (
    wallets.find(
      (wallet) =>
        wallet.type === 'ethereum' &&
        wallet.walletClientType !== 'privy' &&
        wallet.walletClientType !== 'privy-v2',
    ) ||
    wallets.find((wallet) => wallet.type === 'ethereum') ||
    wallets[0]
  );
};

export default function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    initCanvasFonts().catch((error) => {
      console.warn('Canvas fonts initialization failed:', error);
    });
  }, []);

  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (typeof window !== 'undefined') {
    if (!privyAppId) {
      console.error('PRIVY_APP_ID is missing! Wallet connections will fail.');
    }

    if (window.location.hostname === 'localhost') {
      console.warn(
        'LOCALHOST DETECTED: Make sure to add "http://localhost:3000" to your Privy App\'s allowed origins in the dashboard!',
      );
    }
  }

  if (!privyAppId) {
    console.error('Cannot initialize Privy without app ID');
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
      <PriceProvider>
        <BondingDataProvider>
          <MarketCapProvider>
            <PrivyProvider
              appId={privyAppId}
              config={{
                loginMethods: ['wallet', 'email'],
                appearance: {
                  theme: 'dark',
                  accentColor: '#D0B264',
                  logo: '/aces-logo.png',
                  loginMessage: 'Connect your wallet to ACES',
                  showWalletLoginFirst: true,
                  walletList: ['coinbase_wallet', 'metamask', 'wallet_connect', 'phantom'],
                },
                embeddedWallets: {
                  createOnLogin: 'all-users',
                  requireUserPasswordOnCreate: false,
                  showWalletUIs: true,
                },
                defaultChain: base,
                supportedChains: [base, baseSepolia],
                externalWallets: {
                  coinbaseWallet: {
                    connectionOptions: 'smartWalletOnly',
                  },
                  // Remove the phantom config - it's not a valid option here
                },
                legal: {
                  termsAndConditionsUrl: 'https://aces.fun/terms',
                  privacyPolicyUrl: 'https://aces.fun/privacy',
                },
              }}
            >
              <WagmiProvider
                config={wagmiConfig}
                setActiveWalletForWagmi={selectActiveWalletForWagmi}
              >
                <AuthProvider>
                  <ModalProvider>
                    <NetworkBanner />
                    {children}
                    <GlobalModals />
                  </ModalProvider>
                </AuthProvider>
              </WagmiProvider>
            </PrivyProvider>
          </MarketCapProvider>
        </BondingDataProvider>
      </PriceProvider>
    </QueryClientProvider>
  );
}
