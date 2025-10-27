'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ExternalLink, Copy, Check, Share2 } from 'lucide-react';
import type { MouseEvent as ReactMouseEvent } from 'react';

type ShareDataLite = { files?: unknown[]; title?: string; text?: string; url?: string };
type NavigatorShareLite = {
  canShare?: (data?: ShareDataLite) => boolean;
  share?: (data?: ShareDataLite) => Promise<void>;
};
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from '@/components/ui/custom/nav-menu';

interface TransactionSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionHash: string;
  tokenSymbol: string;
  tokenAmount: string;
  acesSpent: string;
  usdValue?: string;
  newBalance?: string;
  chainId?: number;
  title?: string;
  imageSrc?: string;
  spentAssetSymbol?: string;
}

/**
 * Success modal displayed after a successful swap transaction
 * Shows transaction details, USD value, and links to block explorer
 */
export function TransactionSuccessModal({
  isOpen,
  onClose,
  transactionHash,
  tokenSymbol,
  tokenAmount: _tokenAmount,
  acesSpent: _acesSpent,
  usdValue,
  newBalance: _newBalance,
  chainId = 8453,
  title,
  imageSrc,
  spentAssetSymbol: _spentAssetSymbol = 'ACES',
}: TransactionSuccessModalProps) {
  const [copied, setCopied] = useState(false);

  const explorerUrl =
    chainId === 8453
      ? `https://basescan.org/tx/${transactionHash}`
      : `https://sepolia.basescan.org/tx/${transactionHash}`;

  const itemName = title || tokenSymbol;
  const pageUrl = `https://aces.fun/rwa/${tokenSymbol}`;
  const shareText = `I just collected culture: ${itemName} on ACES.fun`;
  const xIntentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pageUrl)}&via=acesdotfun&hashtags=ACES,RWA`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(transactionHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShareOnXClick = async (e: ReactMouseEvent) => {
    // Try using the Web Share API with image attachment when possible (primarily mobile)
    try {
      const extendedText = `${shareText}\nvia @acesdotfun #ACES #RWA`;

      if (imageSrc && typeof navigator !== 'undefined' && 'share' in navigator) {
        // Attempt to fetch the image and share it as a file
        try {
          const response = await fetch(imageSrc, { mode: 'cors' });
          const blob = await response.blob();
          const urlExt = (imageSrc.split('.').pop() || 'png').toLowerCase();
          const inferredType =
            blob.type ||
            (urlExt === 'webp'
              ? 'image/webp'
              : urlExt === 'png'
                ? 'image/png'
                : urlExt === 'jpg' || urlExt === 'jpeg'
                  ? 'image/jpeg'
                  : 'application/octet-stream');
          const filename = `aces-${tokenSymbol}.${urlExt}`;
          let file: unknown;
          if (typeof window !== 'undefined' && 'File' in window) {
            const FileCtor = (
              window as unknown as {
                File: new (bits: unknown[], name: string, options?: { type?: string }) => unknown;
              }
            ).File;
            file = new FileCtor([blob], filename, { type: inferredType });
          }

          // Some browsers require canShare check for files
          const nav = navigator as NavigatorShareLite;
          const canShareFiles = file
            ? typeof nav.canShare === 'function'
              ? nav.canShare({ files: [file as unknown] })
              : true
            : false;

          if (file && canShareFiles) {
            e.preventDefault();
            await nav.share?.({
              files: [file as unknown],
              title: itemName,
              text: extendedText,
              url: pageUrl,
            });
            return; // Success; don't fall back to intent
          }
        } catch {
          // If fetching or sharing fails, fall back to X intent below
        }
      }
    } catch {
      // ignore and fall back
    }
    // Fallback: let the default anchor behavior open the X intent URL
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal - Right panel layout */}
          <div className="fixed inset-0 z-50 flex items-start justify-start p-4" onClick={onClose}>
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative w-full max-w-sm rounded-2xl border border-[#D0B264]/40 bg-gradient-to-br from-[#0B0F0B] to-[#0F1410] p-6 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button removed; click outside to close */}

              {imageSrc && (
                <div className="relative w-full aspect-square mb-5 rounded-xl overflow-hidden border border-[#D0B264]/30 shadow-lg">
                  <Image
                    src={imageSrc}
                    alt={title ? `${title} preview` : 'Item image'}
                    fill
                    className="object-cover"
                    priority
                    unoptimized={imageSrc.includes('storage.googleapis.com')}
                  />
                </div>
              )}

              <div className="mb-3">
                <h2 className="text-lg font-bold text-[#D0B264] text-center">Congratulations!</h2>
                <h2 className="text-lg font-bold text-[#D0B264] text-center">
                  You just collected culture.
                </h2>
              </div>

              <div className="space-y-2 mb-4 pb-4 border-b border-[#D0B264]/15">
                {/* <div className="flex items-center justify-between">
                  <span className="text-xs text-[#D0B264]/60">Received</span>
                  <span className="font-mono text-sm font-semibold text-[#D0B264]">
                    {Number.parseFloat(tokenAmount).toFixed(4)} {tokenSymbol}
                  </span>
                </div> */}
                {/* 
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#D0B264]/60">Spent</span>
                  <span className="font-mono text-sm font-semibold text-[#D0B264]">
                    {Number.parseFloat(acesSpent).toFixed(4)} {spentAssetSymbol}
                  </span>
                </div> */}

                {usdValue && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#D0B264]/60">Value</span>
                    <span className="font-mono text-sm font-semibold text-[#D0B264]">
                      ${Number.parseFloat(usdValue).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <div className="mb-4 rounded-lg border border-[#D0B264]/20 bg-black/30 p-2">
                <div className="text-xs text-[#D0B264]/60">Transaction Hash</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-[#D0B264]/70">
                    {transactionHash.slice(0, 6)}...{transactionHash.slice(-4)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={copyToClipboard}
                      className="rounded p-1 transition-colors hover:bg-[#D0B264]/10"
                      title="Copy transaction hash"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-[#D0B264]/60" />
                      )}
                    </button>
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded p-1 transition-colors hover:bg-[#D0B264]/10"
                      title="View on block explorer"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-[#D0B264]/60" />
                    </a>
                  </div>
                </div>
              </div>

              <a
                href={xIntentUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleShareOnXClick}
                className="mb-2 w-full rounded-lg border border-[#D0B264]/40 px-3 py-2.5 text-center text-base font-semibold text-[#D0B264] transition-colors hover:bg-[#D0B264]/10 hover:border-[#D0B264]/60 flex items-center justify-center gap-2"
              >
                <Share2 className="h-3 w-3" />
                Share on <XIcon size={12} />
              </a>

              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-lg border border-[#D0B264]/40 bg-[#D0B264]/8 px-3 py-2.5 text-center text-xs font-semibold text-[#D0B264] transition-colors hover:bg-[#D0B264]/15 hover:border-[#D0B264]/60 block"
              >
                View Transaction
              </a>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
