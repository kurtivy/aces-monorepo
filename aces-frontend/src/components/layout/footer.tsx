import { Link } from "@tanstack/react-router";
import { CONTRACTS } from "~/lib/contracts/addresses";
import { truncateAddress } from "~/lib/utils";

export function Footer() {
  return (
    <footer className="border-t border-golden-beige/8 bg-deep-charcoal">
      {/* Decorative top gradient line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-golden-beige/20 to-transparent" />

      <div className="px-6 py-12 lg:px-10 lg:py-16">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <span className="font-heading text-xl text-golden-beige">
              ACES
            </span>
            <span className="text-xs text-platinum-grey/50">.fun</span>
            <p className="mt-3 text-xs leading-relaxed text-platinum-grey/50">
              Real World Asset Tokenization on Base. Trade luxury goods on-chain
              with verified provenance.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-platinum-grey/70 mb-4">
              Product
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link
                  to="/drops"
                  className="text-sm text-platinum-grey/75 hover:text-golden-beige transition-colors"
                >
                  Drops
                </Link>
              </li>
              <li>
                <Link
                  to="/portfolio"
                  className="text-sm text-platinum-grey/75 hover:text-golden-beige transition-colors"
                >
                  Portfolio
                </Link>
              </li>
              <li>
                <Link
                  to="/status"
                  className="text-sm text-platinum-grey/75 hover:text-golden-beige transition-colors"
                >
                  Status
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-platinum-grey/70 mb-4">
              Resources
            </h4>
            <ul className="space-y-2.5">
              <li>
                <a
                  href="#how-it-works"
                  className="text-sm text-platinum-grey/75 hover:text-golden-beige transition-colors"
                >
                  How it Works
                </a>
              </li>
              <li>
                <a
                  href="https://basescan.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-platinum-grey/75 hover:text-golden-beige transition-colors"
                >
                  BaseScan
                </a>
              </li>
              <li>
                <a
                  href="https://aerodrome.finance"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-platinum-grey/75 hover:text-golden-beige transition-colors"
                >
                  Aerodrome
                </a>
              </li>
            </ul>
          </div>

          {/* Contract */}
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-platinum-grey/70 mb-4">
              Contract
            </h4>
            <a
              href={`https://basescan.org/token/${CONTRACTS.ACES_TOKEN}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-sm border border-golden-beige/10 bg-golden-beige/5 px-3 py-1.5 text-xs font-mono text-platinum-grey/70 hover:text-golden-beige transition-colors"
            >
              {truncateAddress(CONTRACTS.ACES_TOKEN, 6)}
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
            <p className="mt-3 text-xs text-platinum-grey/40">
              Built on Base (Chain 8453)
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-golden-beige/8 pt-8 sm:flex-row">
          <p className="text-xs text-platinum-grey/40">
            &copy; {new Date().getFullYear()} ACES.fun. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="#"
              className="text-xs text-platinum-grey/40 hover:text-platinum-grey/75 transition-colors"
            >
              Terms
            </a>
            <a
              href="#"
              className="text-xs text-platinum-grey/40 hover:text-platinum-grey/75 transition-colors"
            >
              Privacy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
