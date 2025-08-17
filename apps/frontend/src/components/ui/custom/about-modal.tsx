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
            <div className="max-w-4xl w-full max-h-[90vh] bg-[#231F20] rounded-lg shadow-lg border border-[#D0B264]/40 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-[#D0B264]/20">
                <h1 className="text-3xl font-neue-world font-bold text-[#D0B264]">About ACES</h1>
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
                    <h2 className="text-2xl font-neue-world font-semibold text-[#D0B264] mb-4">
                      Our Vision
                    </h2>
                    <p>
                      Web3 promised to revolutionize e-commerce by replacing fragmented marketplaces
                      with decentralized networks, enabling seamless cross-platform shopping and new
                      ownership models while allowing businesses to compete on value rather than
                      size. While there has been promising progress in this B2B space for buyers and
                      sellers, the challenge of attracting retail users has made it difficult for
                      Web3 e-commerce platforms like SHOPX, OpenBazaar, and others to achieve
                      critical mass. The Aces.fun team has spent nearly a decade innovating in this
                      space, deploying various technical solutions and learning valuable lessons
                      while pushing this vision forward.
                    </p>
                  </section>

                  <section>
                    <h2 className="text-2xl font-neue-world font-semibold text-[#D0B264] mb-4">
                      The Tokenization Revolution
                    </h2>
                    <p>
                      Today, with the likes of Trump coin and Pump.fun, we understand that
                      tokenization is beginning to intersect with many different industries. TradFi
                      is tokenizing a wide range of RWAs, including insurances, corporate bonds,
                      credit, commodities, real estate, and more. The stock market is even pushing
                      toward a 24-hour trading period, just like Web3.
                    </p>
                    <p className="mt-4">
                      The inevitable shift to tokenizing physical products starts with Aces.fun. The
                      end goal is to create a universal inventory system that is global and
                      permissionless. Every product will be accompanied by what is essentially an
                      immutable certificate of authenticity that lists the individual product&apos;s
                      information and sales history.
                    </p>
                  </section>

                  <section>
                    <h2 className="text-2xl font-neue-world font-semibold text-[#D0B264] mb-4">
                      Our Ecosystem
                    </h2>
                    <p>
                      To begin our journey, we have identified an ecosystem that combines
                      tokenization with e-commerce in a way that aligns incentives between three
                      parties: Sellers, Buyers, and Retail.
                    </p>
                    <p className="mt-4">
                      Aces.fun is an e-commerce marketplace that merges both direct RWA listings and
                      derivative markets, allowing all parties to participate. It is the only
                      project that monetizes RWAs through trading fees.
                    </p>
                  </section>

                  <section>
                    <h2 className="text-2xl font-neue-world font-semibold text-[#D0B264] mb-4">
                      Benefits for All Participants
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-neue-world font-medium text-[#D0B264]/80 mb-2">
                          For Sellers
                        </h3>
                        <p>
                          Sellers leverage Web3 technology to tokenize luxury assets, reduce
                          intermediaries, gain unprecedented transparency, tap into new marketing
                          channels, and earn additional revenue through token trading.
                        </p>
                      </div>
                      <div>
                        <h3 className="text-xl font-neue-world font-medium text-[#D0B264]/80 mb-2">
                          For Buyers
                        </h3>
                        <p>
                          Buyers gain access to exclusive tokenized luxury assets with verified
                          authenticity, join a built-in community, and can purchase using
                          cryptocurrency.
                        </p>
                      </div>
                      <div>
                        <h3 className="text-xl font-neue-world font-medium text-[#D0B264]/80 mb-2">
                          For Retail Traders
                        </h3>
                        <p>
                          Retail traders can now participate in premium collectibles and hype assets
                          as RWAs (real world assets) through derivative markets, eliminating the
                          high capital barriers of direct ownership.
                        </p>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h2 className="text-2xl font-neue-world font-semibold text-[#D0B264] mb-4">
                      The Future of Trading
                    </h2>
                    <p>
                      Building on the current economic and cultural shift toward tokenization,
                      Aces.fun recognizes that traditional platforms are treating their users as
                      mere statistics rather than embracing the transformative potential of Web3 and
                      the &ldquo;game&rdquo; it offers. While established marketplaces remain stuck
                      in outdated models, we&apos;re creating a dynamic ecosystem where sellers,
                      buyers, and retail traders can thrive together in the new token economy.
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
