/**
 * Site-wide footer for ACES.fun.
 * Columns: Brand + tagline, Product links, Resources (docs, etc.),
 * Community (social links), Contract address.
 * Bottom bar has copyright + Terms/Privacy triggers for the legal modal.
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CONTRACTS } from "~/lib/contracts/addresses";
import { truncateAddress } from "~/lib/utils";
import { SocialIcons } from "~/components/ui/social-icons";
import TermsModal from "~/components/ui/terms-modal";

export function Footer() {
  // Terms modal state — tracks which tab to open (terms or privacy)
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsTab, setTermsTab] = useState<"terms" | "privacy" | "launchpad">("terms");

  const openTerms = () => {
    setTermsTab("terms");
    setTermsOpen(true);
  };
  const openPrivacy = () => {
    setTermsTab("privacy");
    setTermsOpen(true);
  };

  return (
    <>
      <footer className="border-t border-golden-beige/8 bg-deep-charcoal">
        {/* Decorative top gradient line */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-golden-beige/20 to-transparent" />

        <div className="px-6 py-12 lg:px-10 lg:py-16">
          {/* 4-column layout: Brand, Product, Community, Contract */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:gap-12">
            {/* Brand — spans 2 cols on mobile for breathing room */}
            <div className="col-span-2 sm:col-span-1">
              <span className="font-heading text-xl text-golden-beige">
                ACES
              </span>
              <span className="text-xs text-platinum-grey/50">.fun</span>
              <p className="mt-3 text-xs leading-relaxed text-platinum-grey/50">
                Real World Asset Tokenization on Base. Trade luxury goods on-chain
                with verified provenance.
              </p>
              {/* Social icons under brand column */}
              <div className="mt-4">
                <SocialIcons iconSize={16} />
              </div>
            </div>

            {/* Product — internal navigation links */}
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
                  <a
                    href="/#how-it-works"
                    className="text-sm text-platinum-grey/75 hover:text-golden-beige transition-colors"
                  >
                    How it Works
                  </a>
                </li>
                <li>
                  <a
                    href="https://docs.aces.fun"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-platinum-grey/75 hover:text-golden-beige transition-colors"
                  >
                    Docs
                  </a>
                </li>
              </ul>
            </div>

            {/* Community — social platform links */}
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wider text-platinum-grey/70 mb-4">
                Community
              </h4>
              <ul className="space-y-2.5">
                <li>
                  <a
                    href="https://x.com/acesdotfun"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-platinum-grey/75 hover:text-golden-beige transition-colors"
                  >
                    X (Twitter)
                  </a>
                </li>
                <li>
                  <a
                    href="https://t.me/acesdotfun/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-platinum-grey/75 hover:text-golden-beige transition-colors"
                  >
                    Telegram
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.instagram.com/acesdotfun/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-platinum-grey/75 hover:text-golden-beige transition-colors"
                  >
                    Instagram
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.tiktok.com/@acesdotfun"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-platinum-grey/75 hover:text-golden-beige transition-colors"
                  >
                    TikTok
                  </a>
                </li>
              </ul>
            </div>

            {/* Contract — on-chain links (BaseScan + Aerodrome swap) */}
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wider text-platinum-grey/70 mb-4">
                Contract
              </h4>
              {/* $ACES token address → BaseScan */}
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
              {/* Deep-link to Aerodrome with ACES pre-loaded as swap target */}
              <a
                href={`https://aerodrome.finance/swap?from=eth&to=${CONTRACTS.ACES_TOKEN}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-platinum-grey/50 hover:text-golden-beige transition-colors"
              >
                Trade $ACES on Aerodrome ↗
              </a>
              <p className="mt-2 text-xs text-platinum-grey/40">
                Built on Base (Chain 8453)
              </p>
            </div>
          </div>

          {/* Bottom bar — copyright + legal links */}
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-golden-beige/8 pt-8 sm:flex-row">
            <p className="text-xs text-platinum-grey/40">
              &copy; {new Date().getFullYear()} ACES.fun. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={openTerms}
                className="text-xs text-platinum-grey/40 hover:text-platinum-grey/75 transition-colors"
              >
                Terms
              </button>
              <button
                onClick={openPrivacy}
                className="text-xs text-platinum-grey/40 hover:text-platinum-grey/75 transition-colors"
              >
                Privacy
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Legal modal — shared across Terms & Privacy footer links */}
      <TermsModal
        isOpen={termsOpen}
        onClose={() => setTermsOpen(false)}
        initialTab={termsTab}
      />
    </>
  );
}
