import { createFileRoute, Link } from "@tanstack/react-router";
import { cn } from "~/lib/utils";
import { RWA_TOKENS, isTokenLive, type RwaTokenData } from "../../convex/tokenData";

export const Route = createFileRoute("/drops")({
  component: DropsPage,
});

function DropsPage() {
  return (
    <div className="bg-deep-charcoal">
      {/* Header */}
      <section className="px-6 pt-12 pb-8 lg:px-10">
        <p className="text-xs font-medium uppercase tracking-widest text-deep-emerald mb-2">
          Schedule
        </p>
        <h1 className="font-heading text-4xl text-golden-beige sm:text-5xl">
          Drops
        </h1>
        <p className="mt-3 max-w-lg text-platinum-grey/70">
          Real-world assets live on-chain. Connect your wallet to start
          trading.
        </p>
      </section>

      {/* Grid */}
      <section className="px-6 pb-20 lg:px-10">
        {/* Apply-to-list banner — subtle CTA above the grid encouraging
            asset owners to submit their collectibles for listing */}
        <div className="mb-6 flex items-center justify-between rounded border border-golden-beige/10 bg-card-surface px-5 py-3">
          <p className="text-sm text-platinum-grey/60">
            Own a collectible? List it on ACES.fun.
          </p>
          <Link
            to="/apply"
            className="text-sm font-medium text-golden-beige hover:text-highlight-gold transition-colors"
          >
            Apply to List &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 2xl:grid-cols-4">
          {RWA_TOKENS.map((asset) => (
            <DropCard key={asset.symbol} asset={asset} />
          ))}
        </div>
      </section>
    </div>
  );
}

function DropCard({ asset }: { asset: RwaTokenData }) {
  return (
    <Link
      to="/rwa/$symbol"
      params={{ symbol: asset.symbol }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded",
        "bg-card-surface glow-border-hover card-glow",
        "transition-all duration-300 hover:shadow-deep",
      )}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={asset.image}
          alt={asset.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-deep-charcoal via-transparent to-transparent" />

        {/* Badge */}
        <div className="absolute top-3 right-3">
          {isTokenLive(asset) ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-deep-emerald/90 px-3 py-1 text-xs font-medium text-golden-beige backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-golden-beige animate-pulse" />
              Trade Now
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-deep-charcoal/80 px-3 py-1 text-xs font-medium text-platinum-grey/75 backdrop-blur-sm border border-golden-beige/10">
              Coming Soon
            </span>
          )}
        </div>

        {/* Category */}
        <div className="absolute top-3 left-3">
          <span className="rounded-full bg-deep-charcoal/60 px-3 py-1 text-xs text-platinum-grey/75 backdrop-blur-sm">
            {asset.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono text-golden-beige/70">
            ${asset.symbol}
          </span>
        </div>
        <h3 className="text-base font-medium text-platinum-grey/90 mb-2">
          {asset.title}
        </h3>
        <p className="text-sm text-platinum-grey/75 line-clamp-2 mb-4">
          {asset.description}
        </p>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between border-t border-golden-beige/8 pt-4">
          {asset.value && (
            <div>
              <span className="block text-xs text-platinum-grey/50 uppercase tracking-wider">
                Value
              </span>
              <span className="text-sm font-medium text-golden-beige">
                {asset.value}
              </span>
            </div>
          )}
          {isTokenLive(asset) && (
            <span className="ml-auto text-xs font-medium text-deep-emerald">
              Live now &rarr;
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

