'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AssetAboutDetailsV2 } from './asset-about-details';
import { PlaceBidsInterfaceV2 } from './place-bids-interface';
import { Button } from '@/components/ui/button';
import { DatabaseListing } from '@/types/rwa/section.types';

interface DetailsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  listing: DatabaseListing;
  isLive: boolean;
  isOwner: boolean;
}

export function DetailsOverlay({ isOpen, onClose, listing, isLive, isOwner }: DetailsOverlayProps) {
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  const handleCloseTerms = () => setIsTermsOpen(false);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          className="absolute inset-0 bg-[#151c16] z-50 flex flex-col"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {/* Scrollable Content */}
          <div className="flex-1">
            <div className="">
              <div className="flex flex-col lg:flex-row lg:items-stretch">
                <div className="w-full lg:w-2/5 lg:flex lg:flex-col">
                  {/* Place Bids */}
                  <PlaceBidsInterfaceV2
                    listingId={listing.id}
                    itemTitle={listing.title}
                    itemImage={listing.imageGallery?.[0] || ''}
                    tokenAddress={listing.token?.contractAddress || listing.symbol}
                    retailPrice={
                      listing.token?.currentPriceACES
                        ? parseFloat(listing.token.currentPriceACES)
                        : 47000
                    }
                    startingBidPrice={
                      listing.startingBidPrice ? parseFloat(listing.startingBidPrice) : undefined
                    }
                    isLive={isLive}
                    isOwner={isOwner}
                    onBidPlaced={(bid) => console.log('Bid placed:', bid)}
                    onOpenTerms={() => setIsTermsOpen(true)}
                  />
                </div>
                <div className="w-full lg:w-3/5 lg:self-stretch lg:border-l lg:border-[#D0B284]/15">
                  {/* Asset Details */}
                  <AssetAboutDetailsV2
                    title={listing.title}
                    description={listing.description}
                    onClose={onClose}
                    listing={listing}
                  />
                </div>
              </div>
            </div>
          </div>

          {isTermsOpen ? (
            <div
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
              onClick={handleCloseTerms}
            >
              <div
                className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-black/10 bg-black/40 p-6 shadow-[0_10px_25px_rgba(0,0,0,0.2)] text-white"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="terms-heading"
              >
                <span className="absolute top-2 left-2 h-2 w-2 rounded-full bg-[#D0B284]/80" />
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#D0B284]/80" />
                <span className="absolute bottom-2 left-2 h-2 w-2 rounded-full bg-[#D0B284]/80" />
                <span className="absolute bottom-2 right-2 h-2 w-2 rounded-full bg-[#D0B284]/80" />

                <h3
                  id="terms-heading"
                  className="text-xl font-neue-world uppercase tracking-[0.35em] text-[#D0B284]"
                >
                  Conditions of Sale
                </h3>

                <div className="mt-4 space-y-4 text-sm font-proxima-nova leading-relaxed text-[#DCDDCC] max-h-[60vh] overflow-y-auto pr-2">
                  <div className="space-y-3">
                    <p className="font-semibold text-[#D0B284]">ACES GLOBAL TECHNOLOGY LLC</p>
                    <p className="font-semibold">
                      PLEASE READ THESE TERMS AND CONDITIONS CAREFULLY BEFORE USING THE PLATFORM OR
                      PURCHASING ANY PRODUCT OR SERVICE.
                    </p>
                    <p>
                      These Terms and Conditions, along with our Privacy Policy and any applicable
                      documentation, set out the terms on which we provide access to the ACES
                      Platform. By accessing the Platform or placing an order, you agree to these
                      Terms and Conditions, which are legally binding.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-[#D0B284] uppercase tracking-wider">
                      A. BINDING TERMS
                    </h4>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>
                        These Terms and Conditions set out the terms on which ACES Global Technology
                        LLC, registered in St. Vincent and the Grenadines (&ldquo;ACES&rdquo;,
                        &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), operates the ACES
                        Platform (the &ldquo;Platform&rdquo;) — a technology platform that allows
                        third-party sellers to list and sell collectibles, luxury items, and digital
                        assets directly to buyers.
                      </li>
                      <li>
                        ACES is not the seller, broker, agent, custodian, or holder of any
                        collectible or product listed on the Platform. Each item is sold directly by
                        the independent seller (&ldquo;Seller&rdquo;) to the buyer
                        (&ldquo;Buyer&rdquo;). ACES does not take possession, custody, or control of
                        any product or funds.
                      </li>
                      <li>
                        By using the Platform or purchasing any item, you acknowledge that you have
                        read and agree to these Terms and Conditions.
                      </li>
                    </ol>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-[#D0B284] uppercase tracking-wider">
                      B. ROLE OF ACES
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <p className="font-semibold mb-1">1. Platform Provider Only.</p>
                        <p>
                          ACES provides an online platform through which independent sellers may
                          list, display, and offer collectibles, digital goods, or other items for
                          sale. ACES facilitates communication, listings, and payment processing but
                          is not a party to any transaction between a Buyer and Seller.
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold mb-1">2. No Custody or Vault.</p>
                        <p>
                          ACES does not hold, store, or warehouse any products or collectibles,
                          whether physically or digitally. ACES does not operate a vault, escrow, or
                          custodial service. All transfers, deliveries, and settlements occur
                          directly between Buyer and Seller through integrated third-party services.
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold mb-1">
                          3. No Guarantee of Authenticity or Quality.
                        </p>
                        <p>
                          While ACES may, at its discretion, perform limited verification or KYC
                          checks on Sellers to reduce fraud, we do not guarantee the authenticity,
                          condition, legality, provenance, or description accuracy of any product or
                          collectible. Buyers purchase at their own risk.
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold mb-1">4. Final Sale.</p>
                        <p>
                          All transactions on the Platform are final and non-refundable. No returns,
                          cancellations, or chargebacks are permitted after purchase unless required
                          by applicable law.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-[#D0B284] uppercase tracking-wider">
                      C. ORDERING AND PAYMENT
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <p className="font-semibold mb-1">1. Account Registration</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>
                            You must create an account and provide accurate information to use the
                            Platform.
                          </li>
                          <li>You must be at least 18 years old to buy or sell on ACES.</li>
                          <li>
                            You are responsible for maintaining the confidentiality of your account
                            credentials.
                          </li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold mb-1">2. Payment Methods</p>
                        <p className="mb-2">ACES only accepts the following payment methods:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Bank Transfers (Wire Transfers)</li>
                          <li>
                            Cryptocurrency Payments: USDC, USDT, BTC, or ETH (where legally
                            permitted)
                          </li>
                        </ul>
                        <p className="mt-2">
                          Payment is due in full at the time of purchase. Blockchain network fees
                          are non-refundable, and exchange rates are determined at the time of
                          transaction confirmation.
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold mb-1">3. Order Confirmation</p>
                        <p>
                          Orders are subject to confirmation by the Seller. Product availability is
                          determined solely by the Seller.
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold mb-1">4. Payment Escrow and Fund Handling</p>
                        <div className="space-y-2">
                          <p>
                            <span className="font-semibold">(a) Third-Party Escrow Provider.</span>{' '}
                            All payments on the ACES Platform are processed through a licensed
                            third-party payment provider that offers escrow services. ACES itself
                            does not custody or control Buyer or Seller funds at any point.
                          </p>
                          <p>
                            <span className="font-semibold">(b) Release of Funds.</span> Once both
                            Buyer and Seller have confirmed delivery and authenticity of the item,
                            the funds will be released to the Seller, minus any applicable ACES
                            platform fees and payment processing charges.
                          </p>
                          <p>
                            <span className="font-semibold">(c) Disputes and Non-Delivery.</span> If
                            a Buyer disputes authenticity, claims non-delivery, or otherwise raises
                            a good faith concern prior to release, the funds will remain in escrow
                            pending resolution.
                          </p>
                          <p>
                            <span className="font-semibold">(d) Legal Compliance.</span> ACES and
                            its payment partners will comply with all applicable financial,
                            regulatory, and legal requirements, including lawful requests from
                            courts, regulators, or enforcement authorities.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-[#D0B284] uppercase tracking-wider">
                      D. CHARGES, TAXES, AND FEES
                    </h4>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>
                        <span className="font-semibold">Purchase Price.</span> The total Purchase
                        Price includes the item price, any applicable taxes, and platform fees.
                      </li>
                      <li>
                        <span className="font-semibold">Taxes.</span> Each Buyer and Seller is
                        responsible for compliance with all applicable tax laws, including the
                        reporting and remittance of any VAT, GST, or sales tax.
                      </li>
                      <li>
                        <span className="font-semibold">Platform Fees.</span> ACES may charge
                        platform or listing fees as displayed on the Platform or at checkout.
                      </li>
                    </ol>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-[#D0B284] uppercase tracking-wider">
                      E. WARRANTIES, LIABILITY, AND RISK
                    </h4>
                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold mb-1">1. No Warranties by ACES.</p>
                        <p>
                          ACES provides the Platform on an &ldquo;as is&rdquo; and &ldquo;as
                          available&rdquo; basis.
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold mb-1">2. Buyer and Seller Responsibility.</p>
                        <p>
                          Buyers and Sellers are solely responsible for conducting their own due
                          diligence, including verifying product authenticity, legality, and
                          condition before completing a transaction.
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold mb-1">3. Limitation of Liability.</p>
                        <p>
                          In no event shall ACES&apos; total aggregate liability exceed the lesser
                          of (i) USD $100 or (ii) the total platform fees paid by the user during
                          the prior twelve (12) months.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-[#D0B284] uppercase tracking-wider">
                      F. SHIPPING, DELIVERY, AND RISK
                    </h4>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>
                        <span className="font-semibold">Direct Seller Fulfillment.</span> All
                        shipping and delivery are handled directly by the Seller. ACES does not
                        ship, track, insure, or guarantee delivery.
                      </li>
                      <li>
                        <span className="font-semibold">Risk of Loss.</span> Title and risk of loss
                        pass directly from Seller to Buyer at the time of shipment or transfer as
                        agreed between them.
                      </li>
                      <li>
                        <span className="font-semibold">Customs and Import.</span> Buyers are
                        responsible for all import duties, customs fees, and compliance with local
                        import regulations.
                      </li>
                    </ol>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-[#D0B284] uppercase tracking-wider">
                      G. RETURNS AND REFUNDS
                    </h4>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>
                        <span className="font-semibold">All Sales Are Final.</span> All transactions
                        on ACES are final, non-cancellable, and non-refundable once confirmed.
                      </li>
                      <li>
                        <span className="font-semibold">Chargebacks.</span> Any unauthorized
                        chargeback or reversal will be deemed a breach of these Terms.
                      </li>
                    </ol>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-[#D0B284] uppercase tracking-wider">
                      H. DISPUTE RESOLUTION
                    </h4>
                    <div className="space-y-2">
                      <p>
                        <span className="font-semibold">Governing Law and Arbitration.</span> These
                        Terms are governed by the laws of St. Vincent and the Grenadines. Any
                        dispute arising out of or related to these Terms shall be resolved by
                        binding arbitration in St. Vincent and the Grenadines, conducted in English
                        by a single arbitrator.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-[#D0B284] uppercase tracking-wider">
                      I. GENERAL TERMS
                    </h4>
                    <div className="space-y-2">
                      <p>
                        <span className="font-semibold">Modifications.</span> ACES may modify these
                        Terms at any time. Updates will be posted on https://www.aces.fun, and
                        continued use of the Platform after updates constitutes acceptance.
                      </p>
                      <p>
                        <span className="font-semibold">No Agency.</span> Nothing in these Terms
                        creates an agency, partnership, or employment relationship between you and
                        ACES.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-[#D0B284]/30 pt-3 mt-4">
                    <p className="font-semibold text-[#D0B284]">CONTACT INFORMATION</p>
                    <p>ACES Global Technology LLC</p>
                    <p>
                      Website:{' '}
                      <a
                        href="https://www.aces.fun"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#D0B284] hover:underline"
                      >
                        https://www.aces.fun
                      </a>
                    </p>
                    <p>
                      Email:{' '}
                      <a href="mailto:support@aces.fun" className="text-[#D0B284] hover:underline">
                        support@aces.fun
                      </a>{' '}
                      (general inquiries)
                    </p>
                    <p>
                      Legal:{' '}
                      <a href="mailto:legal@aces.fun" className="text-[#D0B284] hover:underline">
                        legal@aces.fun
                      </a>{' '}
                      (dispute or legal notices)
                    </p>
                    <p className="text-xs opacity-80 mt-2">Last Updated: October 21, 2025</p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button
                    variant="outline"
                    className="border-[#D0B284]/40 text-[#D0B284] hover:bg-[#D0B284]/10"
                    onClick={handleCloseTerms}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
