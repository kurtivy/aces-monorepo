import { createFileRoute, Link } from "@tanstack/react-router";
import { cn, formatTokenAmount, truncateAddress } from "~/lib/utils";
import { useWallet } from "~/hooks/use-privy-wallet";
import { WalletModal } from "~/components/wallet-modal";
import { useTokenBalances } from "~/hooks/use-token-balances";
import { useRwaBalances } from "~/hooks/use-rwa-balances";

export const Route = createFileRoute("/portfolio")({
  component: PortfolioPage,
});

const BASE_TOKENS = [
  { key: "ETH" as const, label: "ETH", decimals: 6 },
  { key: "ACES" as const, label: "ACES", decimals: 0 },
];

function PortfolioPage() {
  const { address, isConnected } = useWallet();
  const { balances } = useTokenBalances();
  const { holdings, isLoading: rwaLoading, curatedCount } = useRwaBalances();

  if (!isConnected) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-deep-charcoal">
        <div className="text-center">
          <h1 className="font-heading text-3xl text-golden-beige mb-3">
            Portfolio
          </h1>
          <p className="text-platinum-grey/60 mb-6">
            Connect your wallet to view your holdings
          </p>
          <WalletModal>
            <button
              className="rounded border border-golden-beige/30 px-8 py-3.5 text-sm font-medium text-golden-beige transition-all hover:border-golden-beige/60 hover:shadow-gold-glow"
            >
              Connect Wallet
            </button>
          </WalletModal>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-deep-charcoal">
      <div className="px-6 py-12 lg:px-10">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-medium uppercase tracking-widest text-deep-emerald mb-2">
            Portfolio
          </p>
          <h1 className="font-heading text-4xl text-golden-beige">
            Your holdings
          </h1>
          {address && (
            <p className="mt-2 font-mono text-sm text-platinum-grey/70">
              {truncateAddress(address, 6)}
            </p>
          )}
        </div>

        {/* Base token balances */}
        <div className="mb-10">
          <h2 className="text-xs font-medium uppercase tracking-wider text-platinum-grey/70 mb-4">
            Wallet
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {BASE_TOKENS.map((token) => (
              <div
                key={token.key}
                className="rounded bg-card-surface glow-border-active card-glow px-5 py-4"
              >
                <span className="block text-[10px] uppercase tracking-wider text-platinum-grey/70 mb-1.5">
                  {token.label}
                </span>
                <span className="text-lg font-medium text-platinum-grey/90 sm:text-xl">
                  {formatTokenAmount(balances[token.key], token.decimals)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* RWA Token Holdings */}
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wider text-platinum-grey/70 mb-4">
            RWA Tokens
          </h2>

          {curatedCount === 0 ? (
            <div className="rounded border border-golden-beige/15 bg-card-surface p-8 text-center">
              <p className="text-sm text-platinum-grey/70">
                No ACES RWA tokens have contract addresses configured yet.
              </p>
            </div>
          ) : rwaLoading ? (
            <div className="rounded border border-golden-beige/15 bg-card-surface p-8 text-center">
              <p className="text-sm text-platinum-grey/60">
                Loading RWA balances...
              </p>
            </div>
          ) : holdings.length > 0 ? (
            <div className="space-y-3">
              {holdings.map(({ token, balance }) => (
                <Link
                  key={token.contractAddress}
                  to="/rwa/$symbol"
                  params={{ symbol: token.symbol }}
                  className={cn(
                    "flex items-center gap-4 rounded bg-card-surface glow-border-hover card-glow p-4",
                    "transition-all hover:border-golden-beige/20 hover:bg-golden-beige/5",
                  )}
                >
                  <img
                    src={token.images[0]}
                    alt={token.title}
                    className="h-14 w-14 rounded-sm object-cover border border-golden-beige/20 sm:h-16 sm:w-16"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-platinum-grey/90 truncate">
                        {token.title}
                      </span>
                      <span className="text-xs font-mono text-golden-beige/70">
                        ${token.symbol}
                      </span>
                    </div>
                    <span className="text-xs text-platinum-grey/70">
                      {token.category}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-sm font-medium text-platinum-grey/90">
                      {formatTokenAmount(balance)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded border border-golden-beige/15 bg-card-surface p-8 text-center">
              <p className="text-sm text-platinum-grey/70">
                You don't hold any ACES RWA tokens yet.
              </p>
              <Link
                to="/drops"
                className="mt-3 inline-block text-sm text-golden-beige/60 hover:text-golden-beige transition-colors"
              >
                Browse drops
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
