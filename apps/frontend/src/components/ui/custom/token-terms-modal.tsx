'use client';

import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface TokenTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TokenTermsModal({ isOpen, onClose }: TokenTermsModalProps) {
  if (typeof window === 'undefined') {
    return null; // Don't render on server
  }

  if (isOpen) {
    // console.log('🔥 TokenTermsModal: Modal should be visible now!');
  }

  // Use simplified approach without animations until we get it working
  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/90"
        style={{
          zIndex: 9999,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{
          zIndex: 9999,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
        }}
      >
        <div
          className="max-w-4xl w-full max-h-[90vh] bg-[#231F20] rounded-lg shadow-2xl border border-[#D0B284]/40 overflow-hidden"
          style={{
            backgroundColor: '#231F20',
            border: '1px solid rgba(208, 178, 132, 0.4)',
            pointerEvents: 'auto',
            maxHeight: '90vh',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#D0B284]/20">
            <h1 className="text-3xl font-serif font-bold text-white">Terms of Use</h1>
            <button
              onClick={onClose}
              className="text-[#D0B284] hover:text-white transition-colors duration-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
            <div className="space-y-6 pt-4 text-[#DCDDCC] text-sm leading-relaxed">
              <div className="text-[#D0B284] font-semibold text-lg">
                Effective Date: August 13, 2025
              </div>

              <p>
                These Terms of Use apply to the website www.aceofbase.fun and all domain variations
                owned and operated by Aces Global Technology LLC (&quot;The Company&quot;), a
                limited liability company governed under the laws of St. Vincent and the Grenadines.
                These terms govern the engagement and use of the website and any related services by
                users (&quot;Users&quot;).
              </p>

              <div>
                <div className="text-[#D0B284] font-semibold mb-3 text-lg border-b border-[#D0B284]/20 pb-2">
                  1. The Platform
                </div>
                <p className="mb-2">
                  1.1 The Company is committed to providing transparency, lawful usage, and
                  responsible engagement through its platform. The platform is an ecommerce site
                  designed to sell ACES-branded products and services. It tightly integrates with
                  web3 technology and digital assets to provide users with enhanced engagement,
                  access features, and community-driven incentives. All commerce, participation, and
                  interactions are conducted under these Terms.
                </p>
                <p>
                  1.2 All company and website data may be hosted or maintained with third-party
                  services, located globally.
                </p>
              </div>

              <div>
                <div className="text-[#D0B284] font-semibold mb-3 text-lg border-b border-[#D0B284]/20 pb-2">
                  2. Digital Asset Engagement
                </div>
                <p className="mb-2">
                  2.1 This website interacts with Digital Assets created by third-party communities,
                  such as ACES. These Digital Assets are intended solely for utility purposes —
                  including engagement, entertainment, rewards, and access to services that the
                  Company may or may not provide directly.
                </p>
                <p className="mb-2">
                  2.2 The Company supports only utility tokens that are reasonably identified as
                  such based on public disclosures, regulatory guidance, and prevailing industry
                  norms.
                </p>
                <p>
                  2.3 ACES and The Company do not issue, offer, sell, or promote the creation of any
                  digital assets. They support the community use of existing digital utility tokens
                  only.
                </p>
              </div>

              <div>
                <div className="text-[#D0B284] font-semibold mb-3 text-lg border-b border-[#D0B284]/20 pb-2">
                  3. Jurisdictional Limitations
                </div>
                <p>
                  3.1 Prohibited Jurisdictions: No citizens or residents of the United States or
                  individuals located in jurisdictions where such participation is restricted may
                  use parts of this website that integrate with digital assets.
                </p>
              </div>

              <div>
                <div className="text-[#D0B284] font-semibold mb-3 text-lg border-b border-[#D0B284]/20 pb-2">
                  4. Digital Asset Disclaimers
                </div>
                <p className="mb-2">4.1 Digital Assets are NOT:</p>
                <ul className="list-none ml-6 space-y-2 mb-4">
                  <li className="flex items-start">
                    <span className="text-[#D0B284] mr-3 mt-1">•</span>
                    <span>Currency or legal tender</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#D0B284] mr-3 mt-1">•</span>
                    <span>Securities or investment instruments</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#D0B284] mr-3 mt-1">•</span>
                    <span>Derivatives or contracts</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#D0B284] mr-3 mt-1">•</span>
                    <span>Debt, equity, or profit-sharing mechanisms</span>
                  </li>
                </ul>
                <p className="mb-2">
                  4.2 Digital assets involve risk. Volatility, lack of liquidity, and evolving
                  regulatory treatment may impact token utility and market access.
                </p>
                <p className="mb-2">
                  4.3 The Company does not warrant, guarantee, or assume liability for any losses
                  arising from engagement with supported digital assets.
                </p>
                <p className="mb-2">
                  4.4 By engaging with digital assets on this platform, you represent and warrant
                  that you:
                </p>
                <ul className="list-none ml-6 space-y-2 mb-4">
                  <li className="flex items-start">
                    <span className="text-[#D0B284] mr-3 mt-1">•</span>
                    <span>Are legally authorized to do so in your jurisdiction</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#D0B284] mr-3 mt-1">•</span>
                    <span>Possess sufficient technical knowledge and risk tolerance</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#D0B284] mr-3 mt-1">•</span>
                    <span>Will not use digital assets for speculative or illegal purposes</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#D0B284] mr-3 mt-1">•</span>
                    <span>Will comply with all tax and reporting requirements</span>
                  </li>
                </ul>
                <p className="mb-2">
                  4.5 The Company may restrict or terminate user access for violations of these
                  terms.
                </p>
                <p>
                  4.6 Users must secure their wallets and access credentials. The Company is not
                  responsible for lost access or mismanagement of assets.
                </p>
              </div>

              <div>
                <div className="text-[#D0B284] font-semibold mb-3 text-lg border-b border-[#D0B284]/20 pb-2">
                  5. Risk Disclosures & Acknowledgments
                </div>
                <p className="mb-2">
                  5.1 The use of digital assets is inherently risky. Transacting may result in
                  significant financial loss and may not be suitable for all users.
                </p>
                <p className="mb-2">
                  5.2 Digital asset markets may be unregulated, illiquid, and exposed to systemic
                  risks. Past performance is not indicative of future results.
                </p>
                <p>
                  5.3 No legal, financial, tax, or investment advice is provided. Users are advised
                  to consult professionals for guidance specific to their jurisdiction.
                </p>
              </div>

              <div>
                <div className="text-[#D0B284] font-semibold mb-3 text-lg border-b border-[#D0B284]/20 pb-2">
                  6. Third Party Interactions
                </div>
                <p className="mb-2">
                  6.1 Certain functionalities may integrate or interact with third-party platforms,
                  services, or vendors. Use of these services is subject to their independent terms.
                </p>
                <p>
                  6.2 The Company makes no representations regarding third-party content,
                  reliability, or data handling. Any use is at the user&apos;s sole risk.
                </p>
              </div>

              <div>
                <div className="text-[#D0B284] font-semibold mb-3 text-lg border-b border-[#D0B284]/20 pb-2">
                  7. Dispute Resolution
                </div>
                <p className="mb-2">
                  7.1 Any disputes arising from these Terms shall be governed by the laws of St.
                  Vincent and the Grenadines.
                </p>
                <p className="mb-2">
                  7.2 Users agree to binding arbitration as the exclusive method of dispute
                  resolution.
                </p>
                <p>7.3 Class actions and jury trials are expressly waived.</p>
              </div>

              <div>
                <div className="text-[#D0B284] font-semibold mb-3 text-lg border-b border-[#D0B284]/20 pb-2">
                  8. General Disclaimers & Waiver of Rights
                </div>
                <p className="mb-2">
                  8.1 ACES and Aces Global Technology LLC have no affiliation—legal, financial,
                  operational, or otherwise—with any name, individual, entity, brand, trademark, or
                  reference mentioned on the ACES website or any affiliated platforms. Any such
                  references are purely illustrative or community-based and should not be construed
                  as endorsements or official relationships.
                </p>
                <p className="mb-2">
                  8.2 Any mention or use of names, individuals, organizations, brands, trademarks,
                  images, or any other identifiers within this site, its services, or content are
                  strictly for illustrative, informational, entertainment, or community reference
                  purposes only. Such usage does not constitute or imply endorsement, affiliation,
                  sponsorship, approval, ownership, or representation of any kind by or with the
                  named parties.
                </p>
                <p className="mb-2">
                  8.3 The use of any names, figures, or references—public or private—within this
                  platform does not imply any relationship, connection, or responsibility by those
                  parties. Any such use is non-representative and non-indicative of endorsement,
                  participation, or validation.
                </p>
                <p className="mb-2">
                  8.4 Users expressly agree that all services, tokens, communications, products, or
                  digital experiences provided through this site are offered strictly &quot;as
                  is&quot; without warranties or guarantees of any kind, whether expressed or
                  implied.
                </p>
                <p className="mb-2">
                  8.5 By accessing or using this website, you irrevocably waive and relinquish any
                  and all rights, claims, demands, causes of action, entitlements, remedies, or
                  liabilities against the Company or its affiliates, whether legal, equitable,
                  statutory, contractual, or otherwise, to the fullest extent permitted by
                  applicable law.
                </p>
                <p className="mb-2">
                  8.6 You further acknowledge and agree that your use of this site constitutes a
                  full and unconditional release of the Company and its affiliates from any and all
                  current or future claims arising from any aspect of your interaction with this
                  platform, including but not limited to content, services, third-party
                  integrations, or digital asset-related functionalities.
                </p>
                <p>
                  8.7 For the avoidance of doubt: any token (including but not limited to community
                  meme tokens such as FreedomCoin) mentioned or supported through the site is
                  provided for entertainment purposes only. There is no expectation of profit, and
                  such tokens do not represent an investment or ownership in any entity, including
                  but not limited to the Company. These tokens are not affiliated with any corporate
                  structure or legal entity, and their issuance or community activity is entirely
                  decentralized and volunteer-driven. Users engaging with such tokens acknowledge
                  the potential for total loss and agree that nothing on this platform constitutes
                  financial or investment advice.
                </p>
              </div>

              <div>
                <div className="text-[#D0B284] font-semibold mb-3 text-lg border-b border-[#D0B284]/20 pb-2">
                  9. Contact
                </div>
                <p>For questions or legal notices, contact:</p>
                <p>Email: cevans@greshaminternational.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
