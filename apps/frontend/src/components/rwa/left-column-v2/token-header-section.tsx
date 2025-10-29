'use client';

import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

interface TokenHeaderSectionProps {
  tokenSymbol: string;
  tokenAddress?: string;
  tokenImage?: string;
  marketCap?: number;
  marketCapLoading?: boolean;
}

const formatMarketCap = (value: number): string => {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
};

const shortenAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 5)}...${address.slice(-3)}`;
};

export function TokenHeaderSection({
  tokenSymbol,
  tokenAddress,
  tokenImage,
  marketCap,
  marketCapLoading = false,
}: TokenHeaderSectionProps) {
  const [copied, setCopied] = useState(false);
  const [isLgUp, setIsLgUp] = useState(false);
  const topRowRef = useRef<HTMLDivElement>(null);
  const topRowStyles = isLgUp
    ? {
        height: 'var(--tradingview-header-height, 58px)',
      }
    : undefined;
  const bottomRowStyles = isLgUp
    ? {
        backgroundColor: '#0f0f0f',
        height: 'var(--tradingview-header-height, 38px)',
      }
    : undefined;

  const handleCopyAddress = async () => {
    if (!tokenAddress) return;
    try {
      await navigator.clipboard.writeText(tokenAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const topRowEl = topRowRef.current;
    if (!topRowEl) {
      return;
    }

    const mediaQuery = window.matchMedia('(min-width: 1024px)');

    const updateVars = () => {
      const matches = mediaQuery.matches;
      setIsLgUp((prev) => (prev === matches ? prev : matches));

      if (!matches) {
        document.documentElement.style.removeProperty('--token-header-top-row-height');
        return;
      }

      const height = topRowEl.getBoundingClientRect().height;
      if (height > 0) {
        document.documentElement.style.setProperty('--token-header-top-row-height', `${height}px`);
      }
    };

    updateVars();

    const resizeObserver =
      typeof window !== 'undefined' && window.ResizeObserver
        ? new window.ResizeObserver(() => {
            updateVars();
          })
        : null;

    resizeObserver?.observe(topRowEl);
    mediaQuery.addEventListener('change', updateVars);

    return () => {
      resizeObserver?.disconnect();
      mediaQuery.removeEventListener('change', updateVars);
      document.documentElement.style.removeProperty('--token-header-top-row-height');
    };
  }, []);

  return (
    <motion.div
      className="flex flex-col bg-[#151c16] w-full"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div
        ref={topRowRef}
        className="flex items-center justify-between border-b border-[#D0B284]/20 px-6 py-2.5 lg:py-1"
        style={topRowStyles}
      >
        <div className="flex items-center gap-2.5 pb-1">
          {tokenImage ? (
            <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-[#D0B284]/30">
              <Image src={tokenImage} alt={tokenSymbol} fill className="object-cover" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-[#D0B284]/10 border border-[#D0B284]/30 flex items-center justify-center">
              <span className="text-[#D0B284] text-sm font-bold">{tokenSymbol.charAt(0)}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <h2
              className={`${
                tokenSymbol.length > 7
                  ? 'text-sm'
                  : tokenSymbol.length > 4
                    ? 'text-base'
                    : 'text-lg'
              } font-semibold text-[#D0B284] font-proxima-nova`}
            >
              ${tokenSymbol}
            </h2>
            {tokenAddress && (
              <div
                className={`inline-flex items-center px-2 py-1 rounded-lg border shadow-sm w-fit space-x-2 ${
                  isLgUp ? 'border-[#D0B284]/30 bg-[#D0B284]/10' : 'border-[#D0B284]/30 bg-black'
                }`}
              >
                <span
                  className={`text-xs font-mono ${isLgUp ? 'text-[#D0B284]' : 'text-[#D0B284]/70'}`}
                >
                  {shortenAddress(tokenAddress)}
                </span>
                <button
                  onClick={handleCopyAddress}
                  className={`transition-colors ${
                    isLgUp
                      ? 'text-[#D0B284]/80 hover:text-[#D0B284]'
                      : 'text-[#D0B284]/60 hover:text-[#D0B284]'
                  }`}
                  title="Copy address"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>
        </div>
        <span />
      </div>

      <div
        className="flex items-center justify-between transition-colors px-6 lg:h-[54px] bg-black"
        style={bottomRowStyles}
      >
        <div className="text-base font-proxima-nova font-bold uppercase tracking-wide text-[#D0B284]">
          MARKET CAP
        </div>
        <div className="text-xl font-semibold text-white font-proxima-nova">
          {marketCapLoading ||
          marketCap === undefined ||
          marketCap === null ||
          !Number.isFinite(marketCap) ? (
            <span className="text-white font-proxima-nova">N/A</span>
          ) : (
            formatMarketCap(marketCap)
          )}
        </div>
      </div>
    </motion.div>
  );
}
