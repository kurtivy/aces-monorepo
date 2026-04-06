import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { api } from "../../../convex/_generated/api";
import { getTokenBySymbol, isTokenLive } from "../../../convex/tokenData";
import { ERC20_ABI } from "~/lib/contracts/abis";
import { TokenHeader, TokenMetrics } from "~/components/rwa/token-header";
import { AssetDetails } from "~/components/rwa/asset-details";
import { ImageGallery } from "~/components/rwa/image-gallery";
import { SwapBox } from "~/components/rwa/swap-box";
import { TradeHistory } from "~/components/rwa/trade-history";
import { ChartSection } from "~/components/rwa/chart-section";
import { ErrorBoundary } from "~/components/error-boundary";

export const Route = createFileRoute("/rwa/$symbol")({
  component: RwaPage,
});

function RwaPage() {
  const { symbol } = Route.useParams();
  const token = getTokenBySymbol(symbol);

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-deep-charcoal">
        <div className="text-center">
          <h1 className="font-heading text-3xl text-golden-beige mb-2">
            Asset not found
          </h1>
          <p className="text-platinum-grey/75">
            No asset with symbol "{symbol}" exists.
          </p>
        </div>
      </div>
    );
  }

  const isLive = isTokenLive(token);
  const { address } = useAccount();

  // Subscribe to live metrics from Convex (updated every 1 min by on-chain cron)
  const liveMetrics = useQuery(api.tokenMetrics.getBySymbol, {
    symbol: token.symbol,
  });

  // Read connected user's balance of this token (for reward earned calculation)
  const { data: rawBalance } = useReadContract({
    address: token.contractAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!token.contractAddress, refetchInterval: 30_000 },
  });

  // Format balance from bigint to number (18 decimals)
  const userBalance = rawBalance !== undefined
    ? Number(formatUnits(rawBalance as bigint, token.decimals ?? 18))
    : undefined;

  return (
    <div className="min-h-screen bg-deep-charcoal">
      <div className="px-4 py-6 lg:px-8">
        {/* Flex layout: left sidebar is independent of the right grid,
            so its height never stretches chart/trades rows. */}
        <div className="flex flex-col gap-5 xl:flex-row xl:gap-x-6">
          {/* Left Column — sticky sidebar, proportional width (1 part of ~4.2).
              Mobile/tablet order-3: appears after gallery + swap. */}
          <div className="order-4 space-y-5 xl:order-none xl:basis-1/4 xl:shrink-0 xl:sticky xl:top-22 xl:self-start">
            <TokenHeader token={token} isLive={isLive} />
            <TokenMetrics token={token} liveMetrics={liveMetrics ?? undefined} userBalance={userBalance} />

            {/* Asset details — accordion with About, Provenance, and Links sections */}
            <AssetDetails
              description={token.description}
              provenance={token.provenance}
              links={token.links}
            />
          </div>

          {/* Right content — 2-col grid for chart/gallery + trades/swap */}
          <div className="order-1 min-w-0 xl:order-none xl:flex-1 xl:self-start grid grid-cols-1 gap-5 xl:grid-cols-[2fr_1.2fr] xl:gap-x-6">
            {/* Chart — row 1, col 1. Height driven by chart component internals.
                Wrapped in ErrorBoundary so a chart crash doesn't take down the whole page. */}
            <div className="order-1 min-w-0 xl:order-none">
              <ErrorBoundary>
                <ChartSection tokenSymbol={token.symbol} isLive={isLive} tokenAddress={token.contractAddress} geckoPoolAddress={token.geckoPoolAddress} />
              </ErrorBoundary>
            </div>

            {/* Image Gallery — row 1, col 2. First on mobile (order-1). */}
            <div className="order-5 xl:order-none xl:self-start">
              <ImageGallery images={token.images} title={token.title} />
            </div>

            {/* Trade History — row 2, col 1. */}
            <div className="order-3 min-w-0 xl:order-none xl:self-start">
              <TradeHistory tokenSymbol={token.symbol} tokenAddress={token.contractAddress} />
            </div>

            {/* Swap — row 2, col 2. Mobile order-2: right after gallery.
                Wrapped in ErrorBoundary so a swap error doesn't break the rest of the page. */}
            <div className="order-2 xl:order-none xl:self-start">
              <ErrorBoundary>
                <SwapBox
                  tokenSymbol={token.symbol}
                  tokenAddress={token.contractAddress}
                  tokenDecimals={token.decimals ?? 18}
                  dexPool={token.dexPool}
                  isLive={isLive}
                  liveMetrics={liveMetrics ?? undefined}
                />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
