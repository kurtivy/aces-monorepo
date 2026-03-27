import { http, fallback, createConfig, type Config } from "wagmi";
import { base } from "wagmi/chains";

// QuickNode RPC URL — set via VITE_QUICKNODE_BASE_URL env var.
// Falls back to public RPCs if not configured (dev only).
const QUICKNODE_URL = import.meta.env.VITE_QUICKNODE_BASE_URL as
  | string
  | undefined;

// Public RPC endpoints — used as fallback when QuickNode is unavailable.
// `rank: true` auto-promotes the fastest responsive endpoint.
// Dev only — public endpoints have aggressive rate limits and no SLA.
const PUBLIC_RPCS = [
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com",
  // BlockPI removed — its public endpoint rejects CORS preflight from localhost
  "https://base.gateway.tenderly.co",
  "https://1rpc.io/base",
];

export function getWagmiConfig(): Config {
  // Build transport list: QuickNode first (if configured), then public fallbacks
  const rpcTransports = [
    // QuickNode primary RPC — preferred for reliability and speed
    ...(QUICKNODE_URL
      ? [
          http(QUICKNODE_URL, {
            batch: { batchSize: 1024, wait: 16 },
            retryCount: 2,
            retryDelay: 1000,
            timeout: 15000,
          }),
        ]
      : []),
    // Public RPCs as fallback pool
    ...PUBLIC_RPCS.map((url) =>
      http(url, {
        batch: { batchSize: 1024, wait: 16 },
        retryCount: 2,
        retryDelay: 1000,
        timeout: 15000,
      }),
    ),
  ];

  return createConfig({
    chains: [base],
    transports: {
      [base.id]: fallback(rpcTransports, { rank: true }),
    },
    // No SSR — app is a pure client-side SPA, no hydration mismatch handling needed
    ssr: false,
    multiInjectedProviderDiscovery: true,
  });
}

export const PRIVY_CONFIG = {
  loginMethods: ["wallet", "email"] as const,
  appearance: {
    theme: "dark" as const,
    accentColor: "#D0B264",
    logo: "/aces-logo.png",
    showWalletLoginFirst: true,
    walletList: [
      "detected_ethereum_wallets",
      "metamask",
      "rabby_wallet",
      "wallet_connect",
    ] as const,
  },
  embeddedWallets: {
    createOnLogin: "all-users" as const,
  },
};
