import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/token-launch")({
  component: TokenLaunchPage,
});

function TokenLaunchPage() {
  return (
    <div className="min-h-screen bg-deep-charcoal p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="font-heading text-4xl text-golden-beige mb-2">
          Token Launch Center
        </h1>
        <p className="text-platinum-grey/60 mb-8">
          Admin dashboard for managing RWA token launches
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-golden-beige/20 rounded-xl p-6 bg-deep-charcoal/50">
            <h2 className="text-golden-beige font-heading text-lg mb-2">
              Create Token
            </h2>
            <p className="text-platinum-grey/40 text-sm">
              Deploy a new ERC20 token on Base
            </p>
          </div>
          <div className="border border-golden-beige/20 rounded-xl p-6 bg-deep-charcoal/50">
            <h2 className="text-golden-beige font-heading text-lg mb-2">
              Create Listing
            </h2>
            <p className="text-platinum-grey/40 text-sm">
              Create a new RWA listing
            </p>
          </div>
          <div className="border border-golden-beige/20 rounded-xl p-6 bg-deep-charcoal/50">
            <h2 className="text-golden-beige font-heading text-lg mb-2">
              Launch Pool
            </h2>
            <p className="text-platinum-grey/40 text-sm">
              Launch an Aerodrome CL pool
            </p>
          </div>
          <div className="border border-golden-beige/20 rounded-xl p-6 bg-deep-charcoal/50">
            <h2 className="text-golden-beige font-heading text-lg mb-2">
              Manage Listings
            </h2>
            <p className="text-platinum-grey/40 text-sm">
              Edit and manage existing listings
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
