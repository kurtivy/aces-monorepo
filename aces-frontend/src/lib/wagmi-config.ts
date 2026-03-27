import { http, fallback, createConfig, type Config } from "wagmi";
import { base } from "wagmi/chains";

// Public RPC endpoints — used as a fallback pool so rate limits on one
// endpoint are absorbed by the others. `rank: true` auto-promotes the
// fastest responsive endpoint to the front of the list.
const BASE_MAINNET_RPCS = [
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com",
  // BlockPI removed — its public endpoint rejects CORS preflight from localhost
  "https://base.gateway.tenderly.co",
  "https://1rpc.io/base",
];

export function getWagmiConfig(): Config {
  return createConfig({
    chains: [base],
    transports: {
      [base.id]: fallback(
        BASE_MAINNET_RPCS.map((url) =>
          http(url, {
            batch: { batchSize: 1024, wait: 16 },
            retryCount: 2,
            retryDelay: 1000,
            timeout: 15000,
          }),
        ),
        { rank: true },
      ),
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
