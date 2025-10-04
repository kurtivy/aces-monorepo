'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/80 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="max-w-4xl w-full max-h-[90vh] bg-black rounded-lg shadow-lg border border-[#D0B264]/40 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-[#D0B264]/20">
                <h1 className="text-3xl font-neue-world font-bold text-[#D0B264]">How It Works</h1>
                <button
                  onClick={onClose}
                  className="text-[#D0B264] hover:text-white transition-colors duration-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="text-gray-300 space-y-6 leading-relaxed">
                  <section>
                    <p className="text-lg leading-relaxed">
                      ACES.fun is the first IPO—Initial Product Offering—market for the world&apos;s
                      trillion-dollar collectibles industry. We take rare, high-value assets—luxury
                      watches, fine art, iconic cars, cultural grails—and bring them on-chain as
                      live, tradable markets.
                    </p>
                  </section>

                  <section>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <span className="text-[#D0B264] font-bold text-xl">1.</span>
                        <p>Sellers unlock liquidity and earn yield from their assets</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-[#D0B264] font-bold text-xl">2.</span>
                        <p>Retail speculates on culture in real-time</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-[#D0B264] font-bold text-xl">3.</span>
                        <p>Collectors bid directly on authenticated, one-of-a-kind pieces</p>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h2 className="text-2xl font-neue-world font-semibold text-[#D0B264] mb-4">
                      About ACES.fun
                    </h2>
                    <p className="text-lg leading-relaxed">
                      It&apos;s Wall Street meets Sotheby&apos;s meets meme-coin mania—blending
                      prestige and speculation into a single market. Powered by smart contracts,
                      transparency, and our native currency $ACES, we&apos;re building a new asset
                      class where culture itself is collateral.
                    </p>
                  </section>

                  <section>
                    <p className="text-lg leading-relaxed">
                      The secret weapon? The <strong>ACES Ratio</strong>—a real-time hype index,
                      like the P/E ratio for grails. While auction houses see what sold, we see
                      what&apos;s surging. By separating market value from hype value, the{' '}
                      <strong>ACES Ratio</strong> converts hype into signal—so you&apos;re not
                      chasing trends, you&apos;re front-running them.
                    </p>
                  </section>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
