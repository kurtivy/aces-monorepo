import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, type SetActiveWalletForWagmiType } from "@privy-io/wagmi";
import { base } from "wagmi/chains";
import { type ReactNode, useState } from "react";
import { getWagmiConfig } from "~/lib/wagmi-config";

// ── Convex client — initialized once (optional, only if URL is set) ──
const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

// ── Privy App ID — required for wallet connection ──
const privyAppId = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;

/**
 * Prioritize external wallets (MetaMask, Rabby, Phantom, etc.) over
 * Privy's embedded wallet. This gives users who already have a wallet
 * the most natural experience. Email-only users get an embedded wallet.
 *
 * Ported from apps/frontend reference implementation.
 */
const selectActiveWalletForWagmi: SetActiveWalletForWagmiType = ({ wallets }) => {
  if (!wallets?.length) return undefined;

  // Prefer external wallets (injected browser wallets)
  const externalWallet = wallets.find(
    (wallet) =>
      wallet.type === "ethereum" &&
      wallet.walletClientType !== "privy" &&
      wallet.walletClientType !== "privy-v2",
  );
  if (externalWallet) return externalWallet;

  // Fallback to Privy embedded wallet (email login users)
  const privyWallet = wallets.find(
    (wallet) =>
      wallet.type === "ethereum" &&
      (wallet.walletClientType === "privy" || wallet.walletClientType === "privy-v2"),
  );
  if (privyWallet) return privyWallet;

  // Final fallback: any ethereum wallet, or just the first one
  return wallets.find((wallet) => wallet.type === "ethereum") || wallets[0];
};

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 24 * 60 * 60 * 1000, // 24 hours
          },
        },
      }),
  );

  const [wagmiConfig] = useState(() => getWagmiConfig());

  // ── Missing Privy App ID — show error screen ──
  if (!privyAppId) {
    console.error("VITE_PRIVY_APP_ID is missing — wallet connections will not work.");
    return (
      <QueryClientProvider client={queryClient}>
        <div className="flex min-h-screen items-center justify-center bg-deep-charcoal text-red-400">
          <div className="text-center">
            <h2 className="mb-4 font-heading text-2xl">Configuration Error</h2>
            <p className="text-sm text-platinum-grey/60">
              Privy App ID is missing. Add VITE_PRIVY_APP_ID to .env.local
            </p>
          </div>
        </div>
      </QueryClientProvider>
    );
  }

  // ── Provider nesting order ──
  // ConvexProvider (optional) → QueryClientProvider → PrivyProvider → WagmiProvider (from @privy-io/wagmi)
  //
  // PrivyProvider must wrap the Privy WagmiProvider so Privy wallets bridge into wagmi.
  // QueryClientProvider is outside both (wagmi + Privy both use TanStack Query).
  // ConvexProvider is independent and can wrap everything.
  let content = (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ["wallet", "email"],
        appearance: {
          theme: "dark",
          accentColor: "#D0B264",
          logo: "/aces-logo.png",
          loginMessage: "Connect your wallet to ACES",
          showWalletLoginFirst: true,
          walletList: [
            "detected_ethereum_wallets",
            "metamask",
            "rabby_wallet",
            "wallet_connect",
          ],
        },
        embeddedWallets: {
          createOnLogin: "all-users",
          showWalletUIs: true,
        },
        defaultChain: base,
        supportedChains: [base],
        legal: {
          termsAndConditionsUrl: "https://aces.fun/terms",
          privacyPolicyUrl: "https://aces.fun/privacy",
        },
      }}
    >
      <WagmiProvider
        config={wagmiConfig}
        setActiveWalletForWagmi={selectActiveWalletForWagmi}
      >
        {children}
      </WagmiProvider>
    </PrivyProvider>
  );

  // Wrap in React Query
  content = (
    <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>
  );

  // Wrap in Convex (only if URL is configured)
  if (convex) {
    content = <ConvexProvider client={convex}>{content}</ConvexProvider>;
  }

  return content;
}
