/**
 * Site-wide footer for ACES.fun.
 * Two-section flex layout: Brand + tagline on the left, Contract links on the right.
 * Social links are handled by the SocialIcons component in the Brand section.
 * Bottom bar has copyright + Terms/Privacy triggers for the legal modal.
 */

import { useState } from "react";
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
          {/* Two-section flex layout: Brand on the left, Contract on the right.
              Stacks vertically on mobile, side-by-side on sm+. */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-8">
            {/* Brand section — logo, tagline, social icons */}
            <div>
              {/* Brand logo — Braah One + Spray Letters, matching header */}
              <span className="font-braah text-xl text-white tracking-wide">
                ACES.
              </span>
              <span className="font-spray text-xl text-highlight-gold">
                FUN
              </span>
              <p className="mt-3 text-xs leading-relaxed text-platinum-grey/50">
                Real World Asset Tokenization on Base. Trade luxury goods on-chain
                with verified provenance.
              </p>
              {/* Social icons — bumped to 24px for better tap targets */}
              <div className="mt-4">
                <SocialIcons iconSize={24} />
              </div>
            </div>

            {/* Contract section — on-chain links (BaseScan + Aerodrome swap) */}
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
