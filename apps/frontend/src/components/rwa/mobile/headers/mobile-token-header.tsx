'use client';

import { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface MobileTokenHeaderProps {
  listing: DatabaseListing;
  symbol: string;
  onShare?: () => void;
}

export default function MobileTokenHeader({
  listing,
  symbol,
  onShare,
}: MobileTokenHeaderProps) {
  const [copied, setCopied] = useState(false);

  const tokenAddress = listing.token?.contractAddress ?? '';
  const tokenSymbol = listing.token?.symbol ?? symbol;

  const formatAddress = (address: string) => {
    if (!address) return '';
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyToClipboard = async (value: string) => {
    if (typeof navigator === 'undefined') return;
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const handleShare = async () => {
    if (onShare) {
      onShare();
      return;
    }

    if (typeof navigator === 'undefined') return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: listing.title,
          text: `Check out ${listing.title} on ACES.FUN`,
          url: window.location.href,
        });
        return;
      }

      await copyToClipboard(window.location.href);
    } catch (error) {
      console.error('Failed to share listing:', error);
    }
  };

  return (
    <div className="w-full bg-[#151c16] border-b border-[#D0B284]/20 flex-shrink-0">
      <div className="px-4 py-4 space-y-4">
        <div className="space-y-3">
          <h1 className="flex text-white text-xl font-medium leading-snug font-spray-letters items-center justify-center">
            {listing.title}
          </h1>

          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <h2 className="text-[#D0B284] text-xl font-bold font-mono leading-tight">
              ${tokenSymbol}
            </h2>

            {tokenAddress && (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-black/20 px-2 py-1 border border-[#D0B284]/20 justify-self-center">
                <span className="text-xs text-[#D0B284] font-mono" title={tokenAddress}>
                  {formatAddress(tokenAddress)}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(tokenAddress)}
                  className="flex h-6 w-6 items-center justify-center rounded bg-[#D0B284]/10 hover:bg-[#D0B284]/20 transition-colors border border-[#D0B284]/20"
                  aria-label="Copy contract address"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-[#D0B284]" />
                  ) : (
                    <Copy className="h-3 w-3 text-[#D0B284]" />
                  )}
                </button>
              </div>
            )}

            {!tokenAddress && <span className="justify-self-center" />}

            <button
              type="button"
              onClick={handleShare}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#D0B284]/10 hover:bg-[#D0B284]/20 transition-colors border border-[#D0B284]/20 justify-self-end"
              aria-label="Share listing"
            >
              <Share2 className="h-4 w-4 text-[#D0B284]" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
