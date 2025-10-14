'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X, ExternalLink, CheckCircle, Copy, Check } from 'lucide-react';
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

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative w-full max-w-2xl rounded-2xl border border-[#D0B264]/30 bg-[#0B0F0B] p-0 shadow-2xl overflow-hidden"
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute right-4 top-4 z-10 rounded-lg p-1 text-[#D0B264]/60 transition-colors hover:bg-[#D0B264]/10 hover:text-[#D0B264]"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Header image (optional) */}
              {imageSrc && (
                <div className="relative w-full h-56 sm:h-72 bg-black/20">
                  <Image
                    src={imageSrc}
                    alt={title ? `${title} preview` : 'Item image'}
                    fill
                    className="object-contain"
                    priority
                    unoptimized={imageSrc.includes('storage.googleapis.com')}
                  />
                </div>
              )}

              {/* Success icon */}
              <div className="p-6">
                <div className="mb-4 flex justify-center">
                  <div className="rounded-full bg-green-500/10 p-3">
                    <CheckCircle className="h-12 w-12 text-green-500" />
                  </div>
                </div>

                {/* Title */}
                <h2 className="mb-2 text-center text-2xl sm:text-3xl font-bold text-[#D0B264]">
                  {title ? (
                    <span>Congratulations! You bought a part of {title}'s history</span>
                  ) : (
                    'Transaction Successful!'
                  )}
                </h2>

                {/* Description */}
                <p className="mb-6 text-center text-sm text-[#D0B264]/70">
                  Your swap has been confirmed on the blockchain
                </p>

                {/* Transaction details */}
                <div className="space-y-3 rounded-xl border border-[#D0B264]/20 bg-black/40 p-4">
                  {/* Amount received */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#D0B264]/70">You received</span>
                    <span className="font-mono text-sm font-semibold text-[#D0B264]">
                      {parseFloat(tokenAmount).toFixed(4)} {tokenSymbol}
                    </span>
                  </div>

                  {/* Spent asset */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#D0B264]/70">You spent</span>
                    <span className="font-mono text-sm font-semibold text-[#D0B264]">
                      {parseFloat(acesSpent).toFixed(4)} {spentAssetSymbol}
                    </span>
                  </div>

                  {/* USD value */}
                  {usdValue && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#D0B264]/70">USD Value</span>
                      <span className="font-mono text-sm font-semibold text-[#D0B264]">
                        ${parseFloat(usdValue).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* New balance */}
                  {newBalance && (
                    <div className="flex items-center justify-between border-t border-[#D0B264]/20 pt-3">
                      <span className="text-sm text-[#D0B264]/70">New Balance</span>
                      <span className="font-mono text-sm font-semibold text-[#D0B264]">
                        {parseFloat(newBalance).toFixed(4)} {tokenSymbol}
                      </span>
                    </div>
                  )}
                </div>

                {/* Transaction hash */}
                <div className="mt-4 rounded-xl border border-[#D0B264]/20 bg-black/40 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#D0B264]/70">
                    Transaction Hash
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-[#D0B264]">
                      {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={copyToClipboard}
                        className="rounded p-1 transition-colors hover:bg-[#D0B264]/10"
                        title="Copy transaction hash"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-[#D0B264]/70" />
                        )}
                      </button>
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded p-1 transition-colors hover:bg-[#D0B264]/10"
                        title="View on block explorer"
                      >
                        <ExternalLink className="h-4 w-4 text-[#D0B264]/70" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 rounded-xl border border-[#D0B264]/30 bg-black/60 px-4 py-3 text-sm font-semibold text-[#D0B264] transition-colors hover:bg-black/80"
                  >
                    Close
                  </button>
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-xl border border-[#D0B264]/30 bg-[#D0B264]/10 px-4 py-3 text-center text-sm font-semibold text-[#D0B264] transition-colors hover:bg-[#D0B264]/20"
                  >
                    View Transaction
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
