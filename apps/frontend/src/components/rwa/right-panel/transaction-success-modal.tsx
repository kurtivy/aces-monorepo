'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X, ExternalLink, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  tokenAmount,
  acesSpent,
  usdValue,
  newBalance,
  chainId = 8453,
  title,
  imageSrc,
  spentAssetSymbol = 'ACES',
}: TransactionSuccessModalProps) {
  const [copied, setCopied] = useState(false);

  const explorerUrl =
    chainId === 8453
      ? `https://basescan.org/tx/${transactionHash}`
      : `https://sepolia.basescan.org/tx/${transactionHash}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(transactionHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
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
          <div className="fixed inset-0 z-50 flex items-start justify-start p-4">
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative w-full max-w-sm rounded-2xl border border-[#D0B264]/40 bg-gradient-to-br from-[#0B0F0B] to-[#0F1410] p-6 shadow-2xl overflow-hidden"
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute right-4 top-4 z-10 rounded-lg p-1 text-[#D0B264]/50 transition-colors hover:bg-[#D0B264]/10 hover:text-[#D0B264]"
              >
                <X className="h-5 w-5" />
              </button>

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
                <h2 className="text-lg font-bold text-[#D0B264] text-center">Congratualtions!</h2>
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
