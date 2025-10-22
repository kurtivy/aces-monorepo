'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { TermsModalTab } from '@/lib/contexts/modal-context';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TermsModalTab;
}

export default function TermsModal({ isOpen, onClose, initialTab = 'terms' }: TermsModalProps) {
  const [activeTab, setActiveTab] = useState<TermsModalTab>('terms');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

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
            <div className="max-w-3xl w-full max-h-[90vh] bg-black rounded-lg shadow-lg border border-[#D0B264]/40 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-[#D0B264]/20">
                <h1 className="text-3xl font-neue-world font-bold text-white">Legal Information</h1>
                <button
                  onClick={onClose}
                  className="text-[#D0B264] hover:text-white transition-colors duration-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="p-6 border-b border-[#D0B264]/20">
                <div className="flex justify-center">
                  <div className="bg-[#1a1718] rounded-full p-1 border border-[#D0B264]/30 w-full max-w-sm sm:max-w-2xl">
                    <div className="flex space-x-1">
                      <button
                        onClick={() => setActiveTab('terms')}
                        className={`flex-1 px-3 py-2 sm:px-8 sm:py-3 rounded-full text-sm sm:text-lg font-neue-world font-semibold transition-all duration-300 ${
                          activeTab === 'terms'
                            ? 'bg-[#D0B264] text-black shadow-lg'
                            : 'text-gray-400 hover:text-[#D0B264] hover:bg-[#D0B264]/10'
                        }`}
                      >
                        Terms of Service
                      </button>
                      <button
                        onClick={() => setActiveTab('privacy')}
                        className={`flex-1 px-3 py-2 sm:px-8 sm:py-3 rounded-full text-sm sm:text-lg font-neue-world font-semibold transition-all duration-300 ${
                          activeTab === 'privacy'
                            ? 'bg-[#D0B264] text-black shadow-lg'
                            : 'text-gray-400 hover:text-[#D0B264] hover:bg-[#D0B264]/10'
                        }`}
                      >
                        Privacy Policy
                      </button>
                      <button
                        onClick={() => setActiveTab('launchpad')}
                        className={`flex-1 px-3 py-2 sm:px-8 sm:py-3 rounded-full text-sm sm:text-lg font-neue-world font-semibold transition-all duration-300 ${
                          activeTab === 'launchpad'
                            ? 'bg-[#D0B264] text-black shadow-lg'
                            : 'text-gray-400 hover:text-[#D0B264] hover:bg-[#D0B264]/10'
                        }`}
                      >
                        Launchpad Agreement
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                <div className="space-y-6 pt-4">
                  {activeTab === 'terms' ? (
                    <div className="text-gray-300 space-y-6">
                      <div className="space-y-8">
                        <div className="text-center mb-4">
                          <h2 className="text-2xl font-neue-world font-bold text-[#D0B264] mb-2">
                            Terms of Use
                          </h2>
                          <p className="text-[#D0B264] text-lg">Effective Date: June 13, 2025</p>
                        </div>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            1. Agreement to Terms
                          </h2>
                          <p className="mb-3">
                            By accessing and/or using the Platform and any of the Services, you
                            agree to be bound by these Terms and our Privacy Policy, which
                            collectively represent the complete agreement between you and ACES
                            Global Technology LLC (&ldquo;the Company&rdquo;) in respect of our
                            Platform and Services and supersede any prior agreements between us,
                            whether written or oral.
                          </p>
                          <p className="font-semibold text-[#D0B264] mb-3">
                            IMPORTANT NOTICE: THESE TERMS CONTAIN A BINDING INDIVIDUAL ARBITRATION
                            AGREEMENT AND CLASS ACTION WAIVER IN SECTION 18 (DISPUTE RESOLUTION).
                            THIS AFFECTS YOUR RIGHTS WITH RESPECT TO ANY &ldquo;DISPUTE&rdquo;
                            BETWEEN YOU AND THE COMPANY AND MAY REQUIRE YOU TO RESOLVE DISPUTES IN
                            BINDING, INDIVIDUAL ARBITRATION, AND NOT IN COURT. PLEASE READ THESE
                            TERMS CAREFULLY.
                          </p>
                          <p className="font-semibold">
                            IF YOU DO NOT AGREE TO THESE TERMS, YOU ARE NOT PERMITTED TO ACCESS OR
                            USE OUR PLATFORM OR ANY OF THE SERVICES.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            2. The Platform
                          </h2>
                          <div className="space-y-2">
                            <p>
                              <span className="font-semibold">2.1</span> ACES Global Technology LLC
                              operates the website www.aces.fun and all related domains
                              (collectively, the &ldquo;Platform&rdquo;). The Platform is an
                              ecommerce and digital engagement site offering ACES-branded products,
                              services, and experiences.
                            </p>
                            <p>
                              <span className="font-semibold">2.2</span> The Platform integrates
                              web3 technologies and digital assets to enhance user engagement,
                              access, and community incentives.
                            </p>
                            <p>
                              <span className="font-semibold">2.3</span> All company and website
                              data may be hosted, processed, or maintained by third-party providers
                              located in various jurisdictions worldwide.
                            </p>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            3. Access and Use of the Platform
                          </h2>
                          <div className="space-y-4">
                            <div>
                              <p className="font-semibold mb-2">A. Platform Capabilities</p>
                              <p className="mb-2">
                                The Platform utilizes various technologies (including, without
                                limitation, blockchain and decentralized technologies) to enable you
                                and other users (&ldquo;User(s)&rdquo;) to:
                              </p>
                              <ol className="list-decimal pl-6 space-y-1">
                                <li>
                                  create, link, connect, access and/or utilize a self-custodial
                                  digital wallet (whether provided by the Company or by a
                                  third-party provider) to or with the Platform (a &ldquo;Digital
                                  Wallet&rdquo;);
                                </li>
                                <li>
                                  store locally in your own Digital Wallet(s) tokens,
                                  cryptocurrencies, and other crypto- or blockchain-based digital
                                  assets (collectively, &ldquo;Digital Assets&rdquo;);
                                </li>
                                <li>
                                  view and track aggregated information and data relating to Digital
                                  Assets;
                                </li>
                                <li>
                                  view information relating to your activity and transactions on the
                                  Platform (&ldquo;Progress Tracking&rdquo;);
                                </li>
                                <li>
                                  access or use decentralized applications or protocols, including,
                                  without limitation, swapping functionalities, launchpad,
                                  cross-blockchain bridges, Layer-2 rollups (&ldquo;L2
                                  Rollups&rdquo;) and Digital Wallets (collectively,
                                  &ldquo;Dapp(s)&rdquo;). For avoidance of doubt, such Dapp(s) may
                                  be operated or managed by third parties instead of us;
                                </li>
                                <li>
                                  participate in activities, services and transactions involving
                                  Digital Assets through such Dapp(s); and
                                </li>
                                <li>
                                  use other features and functionalities that may be added to the
                                  Platform from time to time.
                                </li>
                              </ol>
                              <p className="mt-2">
                                For the avoidance of doubt, ACES is a software platform and does not
                                operate as an exchange, alternative trading system, broker, dealer,
                                market maker, custodian, or clearinghouse. The Platform does not
                                provide order-matching, trade execution, clearing, settlement,
                                custody, or listing services for Digital Assets. Any transactions
                                you conduct occur directly via third-party Dapp(s) or protocols
                                using your own self-custodied Digital Wallet.
                              </p>
                              <p className="mt-2">
                                More details on Services provided through the Platform can be found
                                in Section 4 below.
                              </p>
                            </div>

                            <div>
                              <p className="font-semibold mb-2">B. Accounts and Credentials</p>
                              <p className="mb-2">
                                To access and use the Platform and some Services, you may need to
                                (i) create/link/connect a Digital Wallet; or (ii) create an account
                                using your email and log in (each a &ldquo;User Account&rdquo;).
                                Some areas may require additional access credentials or conditions.
                              </p>
                              <ul className="list-disc pl-6 space-y-2">
                                <li>
                                  When you register with your email and/or social profile, your use
                                  of that email/social account is at your own risk and subject to
                                  the provider&apos;s terms.
                                </li>
                                <li>
                                  The Company may monitor and/or record your communications on the
                                  Platform. You have no expectation of privacy in such
                                  communications. The Company may disclose communications to: (a)
                                  satisfy any law, regulation, legal process or government request;
                                  (b) enforce these Terms or other policies; (c) protect legal
                                  rights and remedies; (d) protect health or safety; or (e) report a
                                  crime or offensive behavior.
                                </li>
                                <li>
                                  You are solely responsible for all activities conducted through
                                  your User Account, whether authorized by you or not. The Company
                                  may suspend or block your Account if fraud, illegality, or
                                  violations are discovered or reported.
                                </li>
                                <li>
                                  You are solely responsible for keeping your credentials and
                                  devices secure. Due to the nature of the Platform, the Company may
                                  be unable to remedy unauthorized access or security issues and
                                  will not be liable for the same.
                                </li>
                                <li>
                                  The Company will not be liable for losses or damages arising from
                                  your failure to meet the foregoing obligations, except in the case
                                  of Company fraud.
                                </li>
                                <li>
                                  The Company will not be liable for any loss arising from sharing
                                  or losing your private key/related information, or from
                                  unauthorized account access.
                                </li>
                              </ul>
                            </div>

                            <div>
                              <p className="font-semibold mb-2">C. Grant of License</p>
                              <p className="mb-2">
                                Subject to your compliance with these Terms and the Restrictions in
                                Section 6, the Company grants you a limited, revocable,
                                non-sublicensable, non-exclusive license to:
                              </p>
                              <ul className="list-disc pl-6 space-y-1">
                                <li>
                                  access and use applicable Services on one or more computers or
                                  mobile devices under your control;
                                </li>
                                <li>
                                  use the Platform for personal, non-commercial purposes only; and
                                </li>
                                <li>
                                  not transfer your rights or obligations to use the Platform.
                                </li>
                                <li>
                                  Some Services (including Dapps) are provided by third-party
                                  suppliers, partners, or licensors (&ldquo;Third Party
                                  Providers&rdquo;) and may have additional requirements or terms
                                  (see Section 19).
                                </li>
                              </ul>
                            </div>

                            <div>
                              <p className="font-semibold mb-2">D. Open Source Components</p>
                              <p>
                                The Platform may contain open-source components (&ldquo;OSS
                                Components&rdquo;) governed by their respective open-source
                                licenses. Your use of OSS Components is subject to those licenses.
                              </p>
                            </div>

                            <div>
                              <p className="font-semibold mb-2">
                                E. Acknowledgements and Disclaimers
                              </p>
                              <ul className="list-disc pl-6 space-y-2">
                                <li>
                                  <span className="font-semibold">Features and Services.</span> Some
                                  Services may require an account or Digital Wallet and/or
                                  payment/subscription. Terms for each Service are provided on the
                                  Platform and in these Terms. Your use is at your own risk and
                                  subject to the applicable terms.
                                </li>
                                <li>
                                  <span className="font-semibold">Use of Digital Wallets.</span> You
                                  may be required to create or connect a Digital Wallet. We are not
                                  responsible or liable for your Digital Wallet or funds held
                                  therein. You are solely responsible for securing private keys and
                                  credentials.
                                </li>
                                <li>
                                  <span className="font-semibold">
                                    Digital Assets Risk Disclaimer.
                                  </span>{' '}
                                  You acknowledge inherent risks, including smart- contract/security
                                  breaches, asset volatility and liquidation, counterparty risks,
                                  communications failures, software/hardware/Internet failures,
                                  malicious software, or unauthorized access that may result in loss
                                  of Digital Assets or access. You assume these risks and we are not
                                  liable for resulting losses.
                                </li>
                                <li>
                                  <span className="font-semibold">No Reliance on Information.</span>{' '}
                                  Information on the Platform/Services is general and not financial,
                                  investment, tax, or legal advice. No representation is made as to
                                  fairness, accuracy, timeliness, or completeness. We are not a
                                  financial institution, centralized exchange/trading platform,
                                  broker, or fund manager.
                                </li>
                                <li>
                                  <span className="font-semibold">No Fiduciary Relationship.</span>{' '}
                                  These Terms do not create fiduciary duties. Our duties are only
                                  those expressly set out in these Terms (including the Privacy
                                  Policy).
                                </li>
                                <li>
                                  <span className="font-semibold">Compliance Checks.</span> We may
                                  conduct KYC/AML or other checks and request additional
                                  information. Failure to satisfy checks may result in suspension or
                                  termination.
                                </li>
                                <li>
                                  <span className="font-semibold">
                                    Legal and Regulatory Compliance.
                                  </span>{' '}
                                  You are responsible for complying with all applicable laws related
                                  to your use of the Platform/Services, including those of the CFTC,
                                  SEC, MAS (e.g., the Securities and Futures Act and the Payment
                                  Services Act), and any foreign laws applicable to you. Do not use
                                  the Platform if doing so would be illegal in your jurisdiction.
                                </li>
                                <li>
                                  <span className="font-semibold">Security.</span> You are
                                  responsible for configuring and using the Platform/Services
                                  securely (including installing updates and safeguarding
                                  credentials).
                                </li>
                              </ul>
                            </div>

                            <div>
                              <p className="font-semibold mb-2">User Warranties</p>
                              <p className="mb-2">
                                By using the Platform/Services/Content, you represent, warrant and
                                covenant that:
                              </p>
                              <ol className="list-decimal pl-6 space-y-1">
                                <li>
                                  You will not provide false, inaccurate, incomplete or misleading
                                  information or defraud any party;
                                </li>
                                <li>
                                  You will not use the Platform/Services to transmit or exchange
                                  Digital Assets that are proceeds of criminal or fraudulent
                                  activity;
                                </li>
                                <li>
                                  Any Digital Assets used are owned by you or you are authorized to
                                  use them;
                                </li>
                                <li>
                                  You access and use the Platform for your own benefit and not on
                                  behalf of a third-party beneficiary;
                                </li>
                                <li>
                                  There is a risk of losing Digital Assets and we are not
                                  responsible for such loss;
                                </li>
                                <li>
                                  You will not utilize or deposit funds or assets which originate
                                  from illegal or illicit activity;
                                </li>
                                <li>
                                  You will not utilize or deposit funds or assets using payment
                                  methods that do not belong to you;
                                </li>
                                <li>
                                  You accept and acknowledge that the value of Digital Assets can
                                  change dramatically and you bear the sole risk of such
                                  fluctuations;
                                </li>
                                <li>
                                  We are not a financial institution, centralized exchange/trading
                                  platform, broker or fund manager;
                                </li>
                                <li>
                                  We may conduct background/verification checks and request
                                  additional information; failure to satisfy may result in
                                  suspension/termination or restriction via the Platform;
                                </li>
                                <li>
                                  You will not authorize anyone else to access the Platform/Services
                                  through your Digital Wallet or User Account;
                                </li>
                                <li>
                                  You will not disrupt, interfere with, or adversely affect the
                                  Platform/Services, exploit vulnerabilities, or abuse design;
                                </li>
                                <li>
                                  You are sophisticated in blockchain technologies and related
                                  mechanisms (including smart contracts, AMMs,
                                  derivatives/margin/perpetuals, P2P trading and settlement pools,
                                  liquidity pool bonding curves, slippage, liquidity attribution,
                                  and associated risks), and you have not relied on Company
                                  statements or representations; and
                                </li>
                                <li>
                                  You accept all risks associated with accessing or using the
                                  Platform/Services, including those set out in these Terms.
                                </li>
                              </ol>
                            </div>

                            <div>
                              <p className="font-semibold mb-2">F. Changes</p>
                              <p>
                                We may change, add to, modify, remove, suspend, or discontinue any
                                aspect of the Platform/Services at any time without prior notice or
                                liability, and may impose limits or restrict access. You acknowledge
                                that modifications/suspensions/discontinuations may occur without
                                compensation, reimbursement, or damages.
                              </p>
                            </div>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            4. Digital Asset Engagement
                          </h2>
                          <div className="space-y-2">
                            <p>
                              <span className="font-semibold">4.1</span> The Platform may interact
                              with digital assets created by third-party communities for utility and
                              entertainment purposes.
                            </p>
                            <p>
                              <span className="font-semibold">4.2</span> The Company supports only
                              utility tokens reasonably identified as such based on public
                              disclosures, regulatory guidance, and accepted industry norms.
                            </p>
                            <p>
                              <span className="font-semibold">4.3</span> The Company does not issue,
                              sell, or promote the creation of digital assets. Any interactions are
                              limited to community-driven, utility-based use cases.
                            </p>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            5. Jurisdictional Limitations
                          </h2>
                          <p>
                            <span className="font-semibold">5.1</span> Citizens or residents of the
                            United States, or individuals located in jurisdictions where digital
                            asset usage is restricted, are prohibited from using Platform features
                            that involve digital assets or blockchain integrations.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            6. Restrictions on Use of Platform and Features
                          </h2>
                          <div className="space-y-4">
                            <div>
                              <p className="font-semibold mb-2">A. Restrictions</p>
                              <p className="mb-2">
                                The Company may suspend or revoke your license if you violate or
                                assist others in violating the following. You agree you will not, in
                                whole or in part or under any circumstances:
                              </p>
                              <ul className="list-disc pl-6 space-y-1 text-sm">
                                <li>
                                  <span className="font-semibold">
                                    Unauthorized Derivative Works:
                                  </span>{' '}
                                  Copy, reproduce, translate, reverse engineer, derive source code
                                  from, modify, disassemble, decompile, or create derivative works
                                  based on or related to the Platform/Services/Content.
                                </li>
                                <li>
                                  <span className="font-semibold">Prohibited Commercial Uses:</span>{' '}
                                  Use the Platform/Content for commercial purposes not expressly
                                  authorized.
                                </li>
                                <li>
                                  <span className="font-semibold">Cheating:</span>{' '}
                                  Create/use/offer/promote/distribute exploits, bots, hacks, or
                                  unauthorized code that modifies, automates, or confers unfair
                                  advantage.
                                </li>
                                <li>
                                  <span className="font-semibold">Data Mining:</span> Use
                                  unauthorized processes or software to intercept, collect, read, or
                                  &ldquo;mine&rdquo; Platform/Service/Content data.
                                </li>
                                <li>
                                  <span className="font-semibold">Unauthorized Connections:</span>{' '}
                                  Create or maintain connections to unauthorized servers/tools.
                                </li>
                                <li>
                                  <span className="font-semibold">Transfers:</span> Sell,
                                  sublicense, rent, lease, grant security interests in, or otherwise
                                  transfer copies, components, or rights except as expressly
                                  authorized.
                                </li>
                                <li>
                                  <span className="font-semibold">Disruption / Harassment:</span>{' '}
                                  Disrupt servers/systems or other Users&apos; experience; engage in
                                  harassment, griefing, abusive conduct; or transmit spam/pyramid
                                  schemes/unsolicited promotions.
                                </li>
                                <li>
                                  <span className="font-semibold">Violation of Laws:</span> Use the
                                  Platform/Services/Content to violate AML/CFT/sanctions/export
                                  laws.
                                </li>
                                <li>
                                  <span className="font-semibold">
                                    Illegal, Unfair or Manipulative Trading Practices:
                                  </span>{' '}
                                  Engage in or facilitate front-running, wash trading,
                                  pump-and-dump, or other fraudulent/deceptive/manipulative trading.
                                </li>
                                <li>
                                  <span className="font-semibold">VPN:</span> Disguise your location
                                  through IP proxying, VPN, or other methods.
                                </li>
                                <li>
                                  <span className="font-semibold">Encouragement:</span> Encourage or
                                  enable any other individual to do any of the foregoing.
                                </li>
                              </ul>
                            </div>

                            <div>
                              <p className="font-semibold mb-2">B. Export Laws</p>
                              <p>
                                You agree to comply with all applicable U.S. and non-U.S. export
                                control and trade sanctions laws (&ldquo;Export Laws&rdquo;).
                              </p>
                            </div>

                            <div>
                              <p className="font-semibold mb-2">
                                C. Additional Geography-Based Restrictions
                              </p>
                              <p className="mb-2">
                                You may not use the Platform/Services/Content if:
                              </p>
                              <ul className="list-disc pl-6 space-y-1">
                                <li>
                                  you are a citizen, located in, or ordinarily resident in any
                                  Prohibited Jurisdiction (listed in Section 6(D));
                                </li>
                                <li>
                                  you are in, under the control of, or a national/resident of Cuba,
                                  Iran, North Korea, Sudan, or Syria, or any other U.S.-embargoed
                                  country, or subject to UN/HM Treasury sanctions, or listed on
                                  OFAC&apos;s SDN list or the U.S. Commerce Department&apos;s Denied
                                  Persons/Unverified/Entity Lists; or
                                </li>
                                <li>
                                  you intend to supply the Platform/Services/Content to any of the
                                  foregoing jurisdictions/persons.
                                </li>
                              </ul>
                            </div>

                            <div>
                              <p className="font-semibold mb-2">
                                D. &ldquo;Prohibited Jurisdictions&rdquo;
                              </p>
                              <p>
                                Malaysia; Iran; North Korea; Russia; certain regions of Ukraine
                                (Crimea, Sevastopol, and the areas of Donetsk, Kherson, Luhansk, and
                                Zaporizhzhia not controlled by the Ukrainian government); Cuba;
                                Yemen; Sudan; South Sudan; Libya; Lebanon; Syria.
                              </p>
                            </div>

                            <div>
                              <p className="font-semibold mb-2">H. Location Confirmation</p>
                              <p>
                                By accessing the Platform/Services/Content, you confirm you are not
                                in a Restricted Jurisdiction or a jurisdiction where use is illegal.
                              </p>
                            </div>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            7. Payments, Gas Fees, and Taxes
                          </h2>
                          <div className="space-y-3">
                            <div>
                              <p className="font-semibold mb-1">A. Fees</p>
                              <p className="mb-2">You may be charged:</p>
                              <ul className="list-disc pl-6 space-y-1">
                                <li>
                                  a Platform Fee on transactions made on or via the Platform. Fees
                                  may change; continued use after changes constitutes acceptance;
                                  and
                                </li>
                                <li>
                                  Third-Party Fees (e.g., gas/transaction fees, Dapp fees). Gas fees
                                  are paid to blockchain networks/validators and not to us; they
                                  fluctuate and may change without notice.
                                </li>
                              </ul>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">D. Payment Process; No Refunds</p>
                              <p>
                                Payments/transactions are processed by blockchain or other gateways.
                                We cannot reverse transactions. You are responsible for confirming
                                completion. We do not provide refunds for fees, payments, or
                                Platform Transactions.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">F. Taxes</p>
                              <p>
                                You are solely responsible for all taxes (other than our net income
                                taxes) related to your use of the Platform. You will pay or
                                reimburse us for any such taxes and will not deduct them from
                                amounts owed, including gas fees.
                              </p>
                            </div>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            8. Ownership of Intellectual Property
                          </h2>
                          <div className="space-y-3">
                            <div>
                              <p className="font-semibold mb-1">A. ACES Assets</p>
                              <p>
                                The Platform, Services, and Content—including trademarks, media,
                                applications, software, code, metadata, designs, text, images,
                                graphics, databases, documentation, and all protectable elements and
                                derivatives (collectively, the &ldquo;ACES Assets&rdquo;)—are owned
                                by the Company and/or its licensors. No IP license is granted except
                                as expressly provided.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">D. Feedback</p>
                              <p>
                                If you submit comments, bug reports, ideas, or other feedback
                                (&ldquo;Feedback&rdquo;), you grant the Company a perpetual,
                                irrevocable, nonexclusive, worldwide, royalty-free license to use
                                and disclose the Feedback for any purpose without additional
                                compensation.
                              </p>
                            </div>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            9. Data Protection and Privacy
                          </h2>
                          <p>
                            In the course of your access and/or use of the Platform or any Service,
                            we may collect, use, disclose and/or process certain data (including
                            personal data) belonging to you. We will collect, use, disclose and/or
                            process your personal data in accordance with applicable data protection
                            and privacy laws, and as set out in our Privacy Policy.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            10. Risk Disclosures & Acknowledgments
                          </h2>
                          <div className="space-y-2">
                            <p>
                              <span className="font-semibold">10.1</span> Participation in digital
                              asset activities carries significant risk, including potential total
                              loss.
                            </p>
                            <p>
                              <span className="font-semibold">10.2</span> Digital asset markets may
                              lack regulation, liquidity, and stability. Historical data does not
                              predict future performance.
                            </p>
                            <p>
                              <span className="font-semibold">10.3</span> The Company provides no
                              financial, tax, investment, or legal advice. Users should consult
                              qualified professionals regarding their jurisdictional obligations.
                            </p>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            11. Limited Warranty and Disclaimer
                          </h2>
                          <div className="space-y-3">
                            <p className="font-semibold">
                              AS IS / UNDER DEVELOPMENT. TO THE FULLEST EXTENT ALLOWED BY APPLICABLE
                              LAW, THE PLATFORM AND ANY SERVICE AND ANY CONTENT (INCLUDING ANY
                              GENERATED RESULTS) MADE AVAILABLE THEREON ARE PROVIDED ON AN &ldquo;AS
                              IS&rdquo;, &ldquo;UNDER DEVELOPMENT&rdquo;, &ldquo;WITH ALL
                              FAULTS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; BASIS, WITHOUT WARRANTY
                              OF ANY KIND, EXPRESS OR IMPLIED.
                            </p>
                            <p className="font-semibold">
                              YOU ASSUME FULL RESPONSIBILITY FOR YOUR USE. TO THE FULLEST EXTENT
                              PERMITTED BY LAW, NEITHER THE COMPANY NOR ITS
                              DIRECTORS/OFFICERS/EMPLOYEES/SUPPLIERS/PARTNERS/LICENSORS WILL BE
                              LIABLE TO YOU FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
                              CONSEQUENTIAL, PUNITIVE, EXEMPLARY OR OTHER DAMAGES, BASED ON ANY
                              THEORY, RESULTING FROM OR RELATING TO THE PLATFORM/SERVICES/CONTENT.
                            </p>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            12. Digital Assets Related Disclaimers
                          </h2>
                          <ul className="list-disc pl-6 space-y-2">
                            <li>
                              <span className="font-semibold">Regulatory Uncertainty.</span> The
                              Company/Platform/Services could be impacted by regulatory inquiries or
                              actions.
                            </li>
                            <li>
                              <span className="font-semibold">Volatility and Costs.</span> Digital
                              Assets are highly volatile. Transaction costs are variable and may
                              increase.
                            </li>
                            <li>
                              <span className="font-semibold">Software Provider Only.</span> The
                              Company is a developer/provider of software—not a broker, fund
                              manager, financial institution, dealer/arranger, exchange, or clearing
                              service.
                            </li>
                            <li>
                              <span className="font-semibold">No Advice.</span> Information is not
                              legal, tax, investment, financial or professional advice.
                            </li>
                          </ul>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            13. Limitations of Liability
                          </h2>
                          <p>
                            To the fullest extent allowed by applicable law, the Company, its
                            parent, subsidiaries, Third- Party Providers and affiliates shall not be
                            liable for any loss or damage arising out of your use of, or inability
                            to access or use, the Platform or Services. The Company&apos;s aggregate
                            liability shall never exceed the total Platform Fees paid by you to the
                            Company during the six (6) months prior to your claim, or USD $100,
                            whichever is lower.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            14. Indemnity
                          </h2>
                          <p>
                            You agree to defend, indemnify, and hold harmless the Company, its
                            parent, subsidiaries, licensors and affiliates from any third-party
                            claims, liabilities, losses, injuries, damages, costs or expenses
                            arising out of or related to (a) your violation of these Terms, or (b)
                            your misuse of the Platform or Services.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            16. Amendments and Variations
                          </h2>
                          <p>
                            The Company may create updated versions of these Terms as business and
                            laws evolve. If you do not agree to New Terms, you must immediately
                            cease using the Platform and all Services. Your continued use after
                            publication of New Terms constitutes acceptance.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            18. Dispute Resolution (Binding Arbitration; Class Action Waiver)
                          </h2>
                          <p className="font-semibold text-[#D0B264] mb-3">
                            PLEASE READ THIS SECTION CAREFULLY. IT MAY SIGNIFICANTLY AFFECT YOUR
                            RIGHTS, INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN COURT OR TO PURSUE
                            CLAIMS IN A CLASS OR REPRESENTATIVE CAPACITY.
                          </p>
                          <div className="space-y-3">
                            <div>
                              <p className="font-semibold mb-1">A. Applicability</p>
                              <p>
                                To the fullest extent allowed by applicable law, you and the Company
                                agree to submit all Disputes between us to binding, individual
                                arbitration. There is no judge or jury in arbitration, and court
                                review of an award is limited.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">
                                C. Binding Arbitration (Seat; Rules; Language)
                              </p>
                              <p>
                                Any Dispute arising out of or in connection with these Terms shall
                                be finally and exclusively resolved by arbitration in St. Vincent
                                and the Grenadines, under the arbitration rules applicable there.
                                The arbitration shall be conducted in English.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">
                                D. Class and Collective Action Waiver
                              </p>
                              <p>
                                Arbitration is on an individual basis only. No Dispute may be
                                arbitrated or adjudicated on a class, collective, representative, or
                                private attorney general basis.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">E. Governing Law</p>
                              <p>
                                All Disputes are governed by and construed under the laws of St.
                                Vincent and the Grenadines, without regard to conflict-of-law
                                principles.
                              </p>
                            </div>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            20. General Disclaimers & Waiver of Rights
                          </h2>
                          <ul className="list-disc pl-6 space-y-2">
                            <li>
                              The Company has no legal, financial, or operational affiliation with
                              any external names, brands, or entities referenced on the Platform.
                            </li>
                            <li>
                              Mentions of names/brands/entities are for illustrative/community
                              purposes only and do not imply endorsement, affiliation, or
                              sponsorship.
                            </li>
                            <li>
                              All services, content, and digital interactions are provided &ldquo;as
                              is&rdquo; without warranties or guarantees of any kind.
                            </li>
                            <li>
                              By using the Platform, users irrevocably waive all legal or equitable
                              claims against the Company and its affiliates.
                            </li>
                          </ul>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            22. Contact Information
                          </h2>
                          <p>
                            For legal inquiries or notices, please contact:&nbsp;
                            <a
                              href="mailto:legal@aces.fun"
                              className="text-[#D0B264] hover:underline"
                            >
                              legal@aces.fun
                            </a>
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            23. General
                          </h2>
                          <div className="space-y-3">
                            <div>
                              <p className="font-semibold mb-1">
                                A. Export Control and Sanctions Compliance
                              </p>
                              <p>
                                You understand and agree that the Platform may not be used,
                                accessed, downloaded, or otherwise exported, re-exported, or
                                transferred in contravention of applicable export control, economic
                                sanctions, and import laws and regulations.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">
                                C. Third-Party Brands & References
                              </p>
                              <p>
                                References to third-party companies, brands, logos, trademarks,
                                products, services, personalities, events, artworks, or
                                organizations on the Platform are for descriptive, informational,
                                editorial, or comparative purposes only. Such references do not
                                imply or constitute endorsement, sponsorship, affiliation,
                                partnership, joint venture, agency, or any other relationship.
                              </p>
                            </div>
                          </div>
                        </section>
                      </div>
                    </div>
                  ) : activeTab === 'privacy' ? (
                    <div className="text-gray-300 space-y-6">
                      <div className="space-y-8">
                        <div className="text-center mb-4">
                          <h2 className="text-2xl font-neue-world font-bold text-[#D0B264] mb-2">
                            Privacy Policy
                          </h2>
                          <p className="text-[#D0B264] text-lg">Last updated: October 21, 2025</p>
                        </div>

                        <section>
                          <p className="mb-3">
                            Welcome to the ACES Platform (accessible at https://www.aces.fun) (the
                            &ldquo;Website&rdquo;), provided and operated by ACES Global Technology
                            LLC (the &ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo; or
                            &ldquo;us&rdquo;).
                          </p>
                          <p className="mb-3">
                            We take your privacy rights and the protection of personal data very
                            seriously, and strive to collect, use, disclose, and process personal
                            data in a manner that complies with applicable data protection and
                            privacy laws.
                          </p>
                          <p className="mb-3">
                            This Privacy Policy sets out what personal data we collect, how we use
                            and share your personal data, and your choices concerning our
                            information practices. This Privacy Policy is incorporated into and
                            forms part of our Terms of Use, Launchpad Agreement, and Conditions of
                            Sale.
                          </p>
                          <p className="mb-3">
                            Before accessing and using the Platform, Website, or any of the content
                            made available thereon (the &ldquo;Content&rdquo;), or submitting any
                            personal data to us via the Website, please read this Privacy Policy
                            carefully.
                          </p>
                          <p className="mb-3">
                            By accessing and/or using the Platform, Website, or Content, you agree
                            to our collection, use, disclosure, and processing of your personal data
                            as set out in this Privacy Policy.
                          </p>
                          <p className="font-semibold">
                            If you do not agree to this Privacy Policy, please do not access or use
                            the Website or any of our Content.
                          </p>
                          <p className="mt-3">
                            The Company reserves the right to modify this Privacy Policy at any time
                            and encourages you to review it each time you access the Website.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            Definitions and Interpretation
                          </h2>
                          <ol className="list-decimal pl-6 space-y-2">
                            <li>
                              &ldquo;Personal data&rdquo; (or &ldquo;personal information&rdquo;) in
                              this Privacy Policy means any information that can identify an
                              individual, directly or indirectly.
                            </li>
                            <li>
                              Capitalized terms in this Privacy Policy shall have the meaning given
                              to them in the Terms of Use, unless the context requires otherwise.
                            </li>
                          </ol>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            Updates to This Privacy Policy
                          </h2>
                          <p>
                            <span className="font-semibold">3.</span> We may revise this Privacy
                            Policy from time to time without prior notice. By continuing to access
                            and/or use the Website or any Content made available therein, you
                            acknowledge and accept such changes.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            What Personal Data We May Collect
                          </h2>
                          <p className="mb-3">
                            <span className="font-semibold">4.</span> To access and/or use the
                            Website, Platform, and Content, we may collect the following categories
                            of personal information:
                          </p>
                          <ul className="list-disc pl-6 space-y-2">
                            <li>
                              <span className="font-semibold">Identification Information:</span>{' '}
                              Name, email address, and contact information for communication,
                              account setup, or verification purposes.
                            </li>
                            <li>
                              <span className="font-semibold">Wallet Information:</span> Public
                              wallet addresses you connect to the Platform.
                            </li>
                            <li>
                              <span className="font-semibold">Transaction Information:</span>{' '}
                              Details about Platform activities such as listings, purchases, and
                              escrow transactions.
                            </li>
                            <li>
                              <span className="font-semibold">
                                KYC/AML Information (if required):
                              </span>{' '}
                              Identity documents, proof of address, or other verification data where
                              required by law or to verify sellers and high-value transactions.
                            </li>
                            <li>
                              <span className="font-semibold">Communication Information:</span>{' '}
                              Information you provide when contacting us, including emails, support
                              requests, or feedback.
                            </li>
                            <li>
                              <span className="font-semibold">Social Media Information:</span>{' '}
                              Information obtained through your interactions with our social media
                              platforms, or analytics data about engagement.
                            </li>
                            <li>
                              <span className="font-semibold">Internet Activity Information:</span>{' '}
                              When you visit or interact with the Website, we may automatically
                              collect:
                              <ul className="list-disc pl-6 mt-1 space-y-1">
                                <li>
                                  Device data such as IP address, browser, operating system, and
                                  device type;
                                </li>
                                <li>
                                  Usage data such as pages visited, session duration, and actions
                                  taken;
                                </li>
                                <li>
                                  Email engagement data (if subscribed), such as open/click
                                  tracking.
                                </li>
                              </ul>
                            </li>
                          </ul>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            When We May Collect, Use and/or Disclose Your Personal Data
                          </h2>
                          <div className="space-y-3">
                            <div>
                              <p className="mb-2">
                                <span className="font-semibold">5.</span> We generally do not
                                collect personal data unless:
                              </p>
                              <ul className="list-disc pl-6 space-y-1">
                                <li>you provide it voluntarily;</li>
                                <li>
                                  collection and use are necessary to fulfil contractual or legal
                                  obligations; or
                                </li>
                                <li>
                                  collection and use are permitted or required by applicable law.
                                </li>
                              </ul>
                            </div>
                            <div>
                              <p className="mb-2">
                                <span className="font-semibold">6.</span> We may collect and use
                                your personal data for any or all of the following purposes:
                              </p>
                              <ul className="list-disc pl-6 space-y-1">
                                <li>
                                  To provide, operate, and maintain the Platform and services;
                                </li>
                                <li>
                                  To perform KYC/AML checks on Sellers or Buyers where required;
                                </li>
                                <li>
                                  To verify wallet addresses and process transactions through our
                                  integrated escrow partner;
                                </li>
                                <li>
                                  To facilitate communication between Buyers and Sellers in
                                  connection with purchases and deliveries;
                                </li>
                                <li>To process payments and confirm escrow releases;</li>
                                <li>
                                  To provide customer support, respond to inquiries, and manage your
                                  relationship with us;
                                </li>
                                <li>
                                  To send service notices, updates, or promotional content where
                                  permitted by law;
                                </li>
                                <li>
                                  To comply with legal obligations, law enforcement, and regulatory
                                  requests; and
                                </li>
                                <li>
                                  For other business purposes related to or in connection with the
                                  above.
                                </li>
                              </ul>
                            </div>
                            <p>
                              <span className="font-semibold">7.</span> These purposes may continue
                              to apply even after your account is closed or our relationship ends,
                              for a reasonable period to satisfy legal or contractual requirements.
                            </p>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            Disclosure of Personal Data
                          </h2>
                          <div className="space-y-3">
                            <div>
                              <p className="mb-2">
                                <span className="font-semibold">8.</span> We may disclose your
                                personal data to third parties in the following circumstances:
                              </p>
                              <ul className="list-disc pl-6 space-y-1">
                                <li>
                                  <span className="font-semibold">
                                    Escrow and Payment Providers:
                                  </span>{' '}
                                  To facilitate payments, hold funds in escrow, and confirm releases
                                  or refunds.
                                </li>
                                <li>
                                  <span className="font-semibold">Service Providers:</span> To
                                  operate the Platform, including hosting, cloud services,
                                  analytics, communications, and customer support.
                                </li>
                                <li>
                                  <span className="font-semibold">KYC/Verification Partners:</span>{' '}
                                  To perform identity verification and sanctions screening where
                                  required.
                                </li>
                                <li>
                                  <span className="font-semibold">Professional Advisors:</span> For
                                  legal, tax, compliance, or audit purposes.
                                </li>
                                <li>
                                  <span className="font-semibold">Legal Requirements:</span> When
                                  disclosure is required by law, regulation, or court order.
                                </li>
                                <li>
                                  <span className="font-semibold">Business Transactions:</span> In
                                  the event of a merger, acquisition, financing, or sale of assets.
                                </li>
                              </ul>
                            </div>
                            <p>
                              <span className="font-semibold">9.</span> Your personal data may also
                              become publicly visible if you post content, comments, or listings on
                              the Platform or social media channels linked to ACES.
                            </p>
                            <p>
                              <span className="font-semibold">10.</span> ACES is not responsible for
                              the collection, use, or disclosure of your personal data by
                              third-party services, wallets, or blockchains you use to interact with
                              the Platform.
                            </p>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            Use of Cookies and Other Technologies
                          </h2>
                          <div className="space-y-3">
                            <p className="mb-2">
                              <span className="font-semibold">11.</span> We may use cookies and
                              analytics technologies to enhance user experience and improve our
                              services. These may include:
                            </p>
                            <ul className="list-disc pl-6 space-y-1">
                              <li>
                                <span className="font-semibold">Cookies:</span> Small text files
                                stored on your device to improve navigation and remember
                                preferences.
                              </li>
                              <li>
                                <span className="font-semibold">Local Storage:</span> Technologies
                                allowing larger or persistent storage on your device.
                              </li>
                              <li>
                                <span className="font-semibold">Web Beacons / Pixels:</span> Used in
                                emails or pages to measure engagement.
                              </li>
                              <li>
                                <span className="font-semibold">Analytics Tools:</span> Such as
                                Google Analytics, to understand visitor behavior and improve our
                                Platform.
                              </li>
                            </ul>
                            <p className="mt-2">
                              For more information or to opt out of Google Analytics, visit&nbsp;
                              <a
                                href="https://tools.google.com/dlpage/gaoptout"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#D0B264] hover:underline"
                              >
                                https://tools.google.com/dlpage/gaoptout
                              </a>
                              .
                            </p>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            Withdrawing Consent
                          </h2>
                          <div className="space-y-2">
                            <p>
                              <span className="font-semibold">12.</span> You may withdraw consent
                              for the collection, use, or disclosure of your personal data by
                              contacting us at&nbsp;
                              <a
                                href="mailto:legal@aces.fun"
                                className="text-[#D0B264] hover:underline"
                              >
                                legal@aces.fun
                              </a>
                              .
                            </p>
                            <p>
                              <span className="font-semibold">13.</span> Withdrawal requests will be
                              processed within a reasonable period (typically 14 business days),
                              though this may limit your ability to use the Platform.
                            </p>
                            <p>
                              <span className="font-semibold">14.</span> Withdrawal does not affect
                              our right to continue processing data where permitted or required by
                              law.
                            </p>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            Access, Correction, and Deletion of Personal Data
                          </h2>
                          <div className="space-y-2">
                            <p>
                              <span className="font-semibold">15.</span> You may request access to,
                              correction of, or deletion of your personal data by contacting us
                              at&nbsp;
                              <a
                                href="mailto:legal@aces.fun"
                                className="text-[#D0B264] hover:underline"
                              >
                                legal@aces.fun
                              </a>
                              .
                            </p>
                            <p>
                              <span className="font-semibold">16.</span> We may charge a reasonable
                              administrative fee for access or deletion requests, and may require
                              identity verification.
                            </p>
                            <p>
                              <span className="font-semibold">17.</span> We will respond within 30
                              business days or notify you of the time required.
                            </p>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            Safeguarding Your Personal Data
                          </h2>
                          <div className="space-y-2">
                            <p>
                              <span className="font-semibold">18.</span> We implement appropriate
                              administrative, technical, and physical safeguards to protect your
                              personal data from unauthorized access, use, disclosure, or
                              destruction. These measures include encryption, access controls,
                              monitoring, and periodic security reviews.
                            </p>
                            <p>
                              <span className="font-semibold">19.</span> However, no system or
                              method of transmission over the Internet is fully secure. You use the
                              Platform at your own risk and are responsible for maintaining the
                              security of your wallet and devices.
                            </p>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            Accuracy and Retention of Personal Data
                          </h2>
                          <div className="space-y-2">
                            <p>
                              <span className="font-semibold">20.</span> We generally rely on the
                              accuracy of personal data you provide. Please notify us of any updates
                              to ensure our records remain accurate.
                            </p>
                            <p>
                              <span className="font-semibold">21.</span> We retain personal data
                              only as long as necessary to fulfil the purposes described or to meet
                              legal and regulatory requirements.
                            </p>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            International Transfers of Personal Data
                          </h2>
                          <div className="space-y-2">
                            <p>
                              <span className="font-semibold">22.</span> Your personal data may be
                              transferred or processed outside of your home country, including by
                              third-party service providers located in other jurisdictions.
                            </p>
                            <p>
                              <span className="font-semibold">23.</span> We take reasonable steps to
                              ensure that data transferred internationally receives adequate
                              protection in accordance with applicable laws.
                            </p>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            Children&apos;s Privacy
                          </h2>
                          <p>
                            <span className="font-semibold">24.</span> The Platform is not intended
                            for individuals under 18 years of age. We do not knowingly collect
                            personal data from minors. If you believe a minor has provided data,
                            please contact us for deletion.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            Contact Information
                          </h2>
                          <p>
                            <span className="font-semibold">25.</span> If you have any questions,
                            feedback, or requests regarding this Privacy Policy or our data
                            protection practices, please contact us at:
                          </p>
                          <p className="mt-2">
                            Email:&nbsp;
                            <a
                              href="mailto:legal@aces.fun"
                              className="text-[#D0B264] hover:underline"
                            >
                              legal@aces.fun
                            </a>
                          </p>
                        </section>

                        <section className="border-t border-[#D0B264]/30 pt-6 mt-6">
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            Governing Law
                          </h2>
                          <p>
                            This Privacy Policy and any related disputes are governed by the laws of
                            St. Vincent and the Grenadines.
                          </p>
                        </section>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-300 space-y-6">
                      <div className="space-y-8">
                        <div className="text-center mb-4">
                          <h2 className="text-2xl font-neue-world font-bold text-[#D0B264] mb-2">
                            ACES Launchpad Agreement
                          </h2>
                        </div>

                        <section>
                          <p className="mb-4">
                            This ACES Launchpad Agreement (the &ldquo;Agreement&rdquo;) is entered
                            into as of the date you acknowledge and accept this Agreement (the
                            &ldquo;Effective Date&rdquo;), by and between ACES Global Technology LLC
                            (&ldquo;ACES&rdquo; or the &ldquo;Service Provider&rdquo;) and you, as
                            an individual or on behalf of the entity you represent
                            (&ldquo;Client&rdquo;). ACES and Client are each a &ldquo;Party&rdquo;
                            and together the &ldquo;Parties.&rdquo;
                          </p>
                          <p className="font-semibold text-[#D0B264]">
                            Important: ACES is a software launchpad for third-party collectibles
                            (e.g., digital collectibles/NFTs and similar items). ACES is not an
                            exchange, broker, dealer, custodian, clearinghouse, marketplace
                            operator, or fractional ownership platform. Collectibles are created,
                            owned, offered, and sold by third parties. The Client (contract
                            creator/seller) is solely responsible for its collectibles, smart
                            contracts, launches, and all obligations to buyers. ACES does not hold
                            collectibles in a vault and does not take possession or custody of
                            Client or User assets.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            1. Scope of Services
                          </h2>
                          <div className="space-y-3">
                            <div>
                              <p className="font-semibold mb-1">1.1 The Launchpad.</p>
                              <p>
                                The ACES Launchpad (the &ldquo;Launchpad&rdquo;) is a
                                permissionless, decentralized software platform that provides tools
                                (including smart contracts and related software) enabling projects
                                (&ldquo;Projects&rdquo;) to create, deploy, and distribute digital
                                collectibles and related access/utility items
                                (&ldquo;Collectibles&rdquo;). Community members and other users of
                                the Launchpad (&ldquo;Users&rdquo;) may interact with Projects&apos;
                                smart contracts to receive or purchase Collectibles directly from
                                Client or its smart contracts.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">1.2 Services.</p>
                              <p className="mb-2">
                                Subject to this Agreement, ACES enables Client to:
                              </p>
                              <ul className="list-disc pl-6 space-y-1">
                                <li>
                                  (a) configure, mint, and launch Collectibles via smart contracts
                                  under parameters set by Client (e.g., supply, pricing, access
                                  logic);
                                </li>
                                <li>
                                  (b) enable Users to receive, claim, or purchase Collectibles
                                  (including airdrops or direct transfers) per Client&apos;s
                                  parameters; and
                                </li>
                                <li>
                                  (c) display informational Project pages or UI components that
                                  facilitate User interaction with Client&apos;s smart contracts.
                                </li>
                              </ul>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">1.3 No Outcomes; No Exchange.</p>
                              <p>
                                The Launchpad is permissionless and non-custodial. ACES does not:
                                match orders, execute trades, clear/settle transactions, list assets
                                for trading, or provide custody. ACES provides software only and
                                makes no promise of sales, volume, value, popularity, or success for
                                any Project or Collectible.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">1.4 Removal/Access Controls.</p>
                              <p>
                                ACES may, in its sole discretion, limit, suspend, or remove any
                                Project or page from the Launchpad (e.g., for suspected policy or
                                legal violations). Smart contracts and on-chain Collectibles remain
                                on the blockchain and are not controlled by ACES.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">1.5 No Custody / No Vault.</p>
                              <p>
                                ACES does not hold or store any Collectibles or related assets in a
                                vault or otherwise, does not take possession, custody, or control of
                                Client or User assets, and does not act as bailee, trustee,
                                custodian, or escrow agent.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">1.6 No Fractional Ownership.</p>
                              <p>
                                ACES does not offer, support, or facilitate fractionalized ownership
                                interests in any Collectibles, assets, projects, revenues, or
                                entities. Client shall not use the Launchpad to issue, market, or
                                sell fractional interests or pooled investment products.
                              </p>
                            </div>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            2. Service Use & Restrictions
                          </h2>
                          <div className="space-y-3">
                            <div>
                              <p className="font-semibold mb-1">2.1 Compliance.</p>
                              <p>
                                Client will access and use the Launchpad only as permitted by this
                                Agreement and all applicable laws and regulations.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">2.2 Policies & Docs.</p>
                              <p>
                                Client agrees to comply with: (i) ACES Platform Terms of Use and
                                Privacy Policy (as posted on aces.fun), and (ii) any technical
                                documentation ACES makes available for the Launchpad.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">2.3 Prohibited Uses.</p>
                              <p className="mb-2">
                                Client shall not (and shall not permit others to):
                              </p>
                              <ul className="list-disc pl-6 space-y-1">
                                <li>
                                  (a) use the Launchpad for unlawful, harmful, infringing,
                                  deceptive, or abusive purposes;
                                </li>
                                <li>
                                  (b) misrepresent the Project, impersonate others, or launch
                                  copycat/scam Projects;
                                </li>
                                <li>
                                  (c) reverse engineer, decompile, or create derivative works of the
                                  Launchpad except to the extent such restriction is prohibited by
                                  law;
                                </li>
                                <li>
                                  (d) sub-license, resell, rent, or provide service bureau/hosted
                                  service access to the Launchpad;
                                </li>
                                <li>
                                  (e) bypass or tamper with rate limits, security, or integrity
                                  controls;
                                </li>
                                <li>(f) introduce malicious code or exploit vulnerabilities;</li>
                                <li>(g) violate sanctions/export laws (see Section 21.A);</li>
                                <li>
                                  (h) issue or sell fractionalized or pooled interests via the
                                  Launchpad.
                                </li>
                              </ul>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">
                                2.4 No Custody; No Funds Handling.
                              </p>
                              <p>
                                ACES is not a custodian and does not hold Client or User funds,
                                collectibles, or keys. All transactions occur directly between
                                Client&apos;s smart contracts and Users&apos; self-custodial
                                wallets.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">
                                2.5 Authentication & KYC (Best Efforts; No Guarantee).
                              </p>
                              <p>
                                ACES may, at its discretion, perform limited authenticity checks on
                                Project claims and/or conduct KYC on Clients/sellers to reduce fraud
                                and abuse; however, ACES does not guarantee authenticity,
                                legitimacy, title, provenance, or performance of any Collectible or
                                Project and bears no liability for errors, omissions, or
                                misrepresentations by Client or third parties.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">2.6 Changes & Downtime.</p>
                              <p>
                                ACES may change, suspend, or discontinue any Launchpad feature at
                                any time. The Launchpad may experience maintenance, delays,
                                interruptions, or incidents. ACES shall have no liability for such
                                events.
                              </p>
                            </div>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            3. Fees
                          </h2>
                          <div>
                            <p className="font-semibold mb-1">3.1 Service Fees.</p>
                            <p>
                              ACES may charge service/platform fees as stated on the Launchpad or
                              documentation (the &ldquo;Service Fee&rdquo;). By initiating a launch,
                              Client agrees to pay all Service Fees. Network gas/transaction fees
                              are separate and paid to third-party networks/validators.
                            </p>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            4. Representations & Warranties
                          </h2>
                          <div className="space-y-3">
                            <div>
                              <p className="font-semibold mb-1">4.1 Mutual.</p>
                              <p>
                                Each Party represents and warrants that it has the right, power, and
                                authority to enter into this Agreement and that its performance will
                                comply with applicable laws.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">4.2 ACES.</p>
                              <p>
                                ACES will provide the Launchpad using commercially reasonable
                                efforts and will take reasonable measures designed to protect the
                                security and integrity of its software. Except as expressly stated,
                                ACES disclaims all warranties (express, implied, statutory),
                                including merchantability, fitness for a particular purpose,
                                non-infringement, and error-free/continuous operation.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">4.3 Client.</p>
                              <p className="mb-2">
                                Client represents, warrants, and covenants that:
                              </p>
                              <ul className="list-disc pl-6 space-y-1">
                                <li>
                                  (a) Client is solely responsible for the creation, parameters,
                                  legality, marketing, offer, sale, distribution, authenticity,
                                  title, and support of the Collectibles and related content/smart
                                  contracts;
                                </li>
                                <li>
                                  (b) Client has obtained all necessary authorizations, licenses,
                                  and legal opinions (including any securities/consumer law
                                  analyses) for its Collectibles and launch;
                                </li>
                                <li>
                                  (c) all Project information (websites, whitepapers, metadata,
                                  pages, and in-UI content) is true, accurate, and not misleading;
                                </li>
                                <li>
                                  (d) Collectibles and Project content do not infringe any
                                  third-party rights (including IP, privacy, publicity);
                                </li>
                                <li>
                                  (e) the Collectibles are not designed as or represented to be
                                  securities, investment contracts, fractional interests, shared
                                  revenue rights, profit-sharing instruments, or regulated products,
                                  unless Client has satisfied all applicable legal requirements;
                                </li>
                                <li>
                                  (f) Client will comply with AML/CFT/sanctions compliance and will
                                  provide KYC/AML documentation to ACES upon request within seven
                                  (7) days;
                                </li>
                                <li>(g) Client funds derive from legitimate sources;</li>
                                <li>
                                  (h) Client will accurately disclose tax implications to Users
                                  where required and is solely responsible for its and its
                                  Users&apos; tax determinations and obligations as applicable by
                                  law;
                                </li>
                                <li>
                                  (i) All obligations to Users (including refunds, redemptions,
                                  support, disclosures, consumer rights) are solely Client&apos;s
                                  responsibility; ACES is not a party to Client-User transactions.
                                </li>
                              </ul>
                            </div>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            5. Disclaimers; Risk; Limitation of Liability
                          </h2>
                          <div className="space-y-3">
                            <div>
                              <p className="font-semibold mb-1">
                                5.1 Software Only; Third-Party Ownership.
                              </p>
                              <p>
                                The Launchpad is software. Collectibles are owned and controlled by
                                third parties (Client and/or buyers). ACES does not endorse or
                                guarantee any Project or Collectible and does not hold collectibles
                                in a vault or otherwise.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">5.2 Authentication / KYC.</p>
                              <p>
                                Any authentication review or KYC undertaken by ACES is a limited,
                                best-efforts measure and does not constitute a warranty,
                                certification, or guarantee of authenticity, title, performance,
                                compliance, or future value. Client remains fully responsible for
                                accuracy and lawfulness.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">5.3 Digital/Network Risks.</p>
                              <p>
                                Client acknowledges blockchain/Internet risks, including smart-
                                contract exploits, bots/snipers, network congestion, forks, software
                                bugs, malicious code, market volatility, delayed distributions,
                                UI/API failures, and third-party outages. Client uses the Launchpad
                                at its own risk.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">
                                5.4 No Exchange/Brokerage/Fractionalization.
                              </p>
                              <p>
                                ACES is not an exchange, ATS, broker, dealer, advisor, market maker,
                                custodian, or clearinghouse and does not execute, match, clear, or
                                settle trades, or list assets for trading. ACES does not facilitate
                                fractional ownership or pooled investment interests.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">5.5 No Indirect Damages.</p>
                              <p>
                                IN NO EVENT WILL ACES BE LIABLE TO CLIENT OR ANY THIRD PARTY FOR
                                INDIRECT, SPECIAL, INCIDENTAL, CONSEQUENTIAL, EXEMPLARY, PUNITIVE,
                                OR LOST-PROFIT DAMAGES, BUSINESS INTERRUPTION, OR LOSS OF DATA,
                                ARISING OUT OF OR RELATING TO THE LAUNCHPAD OR THIS AGREEMENT, EVEN
                                IF ADVISED OF THE POSSIBILITY.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">5.6 Cap.</p>
                              <p>
                                ACES&apos; TOTAL AGGREGATE LIABILITY ARISING FROM OR RELATED TO THIS
                                AGREEMENT SHALL NOT EXCEED THE SERVICE FEES ACTUALLY PAID BY CLIENT
                                TO ACES FOR THE LAUNCH GIVING RISE TO THE CLAIM.
                              </p>
                            </div>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            6. Intellectual Property
                          </h2>
                          <div className="space-y-3">
                            <div>
                              <p className="font-semibold mb-1">6.1 ACES IP.</p>
                              <p>
                                ACES and its licensors own all rights, title, and interest in and to
                                the Launchpad and ACES marks, software, and content (&ldquo;ACES
                                IP&rdquo;). No rights are granted except as expressly provided.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">6.2 Client IP & License.</p>
                              <p>
                                Client owns all rights in its Project materials and Collectibles
                                (&ldquo;Client IP&rdquo;). Client grants ACES a worldwide,
                                royalty-free, transferable, sublicensable, irrevocable license to
                                use, reproduce, display, perform, adapt, and modify Client IP solely
                                to operate, promote, support, and improve the Launchpad and the
                                Client&apos;s launch.
                              </p>
                            </div>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            7. Confidentiality
                          </h2>
                          <div className="space-y-3">
                            <div>
                              <p className="font-semibold mb-1">7.1 Definition.</p>
                              <p>
                                &ldquo;Confidential Information&rdquo; means non-public information
                                disclosed by a Party that is identified as confidential or should
                                reasonably be understood as confidential.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">7.2 Protection.</p>
                              <p>
                                The receiving Party will use the same degree of care it uses for its
                                own confidential information (and at least reasonable care) and only
                                use/disclose it as necessary to perform under this Agreement or as
                                required by law (with notice where legally permitted).
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">7.3 Survival.</p>
                              <p>
                                Confidentiality obligations survive termination indefinitely for
                                trade secrets and for five (5) years for all other Confidential
                                Information.
                              </p>
                            </div>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            8. Term & Termination
                          </h2>
                          <div className="space-y-3">
                            <div>
                              <p className="font-semibold mb-1">8.1 Term.</p>
                              <p>
                                This Agreement starts on the Effective Date and continues until
                                terminated as set out herein.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">8.2 Breach.</p>
                              <p>
                                Either Party may terminate for material breach not cured within
                                fourteen (14) days of written notice.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">8.3 Convenience.</p>
                              <p>
                                ACES may terminate for convenience on fourteen (14) days&apos;
                                written notice.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">8.4 Non-Compliance/Abuse.</p>
                              <p>
                                ACES may limit, suspend, or terminate access if, acting in good
                                faith, it determines Client&apos;s use is non-compliant or presents
                                risk. ACES will notify Client where feasible and may provide a
                                reasonable opportunity to remediate.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">8.5 Effect.</p>
                              <p>
                                Upon termination, Client must remove any ACES integrations and cease
                                use of the Launchpad. On-chain Collectibles remain on the blockchain
                                and are unaffected by termination.
                              </p>
                            </div>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            9. Indemnity
                          </h2>
                          <div className="space-y-3">
                            <div>
                              <p className="font-semibold mb-1">9.1 By Client.</p>
                              <p className="mb-2">
                                Client will defend, indemnify, and hold harmless ACES and its
                                affiliates, officers, directors, employees, and agents from all
                                claims, losses, liabilities, damages, costs, and expenses (including
                                reasonable attorneys&apos; fees) arising from or relating to:
                              </p>
                              <ul className="list-disc pl-6 space-y-1">
                                <li>
                                  (i) Client&apos;s Project, Collectibles, marketing, authenticity,
                                  title, or smart contracts;
                                </li>
                                <li>(ii) Client&apos;s breach of this Agreement;</li>
                                <li>(iii) disputes between Client and Users;</li>
                                <li>
                                  (iv) claims of IP/right of publicity/privacy infringement related
                                  to Client IP or Collectibles;
                                </li>
                                <li>
                                  (v) alleged securities/consumer law or other regulatory violations
                                  by Client;
                                </li>
                                <li>
                                  (vi) any attempt to use the Launchpad for fractionalized interests
                                  or pooled investment products.
                                </li>
                              </ul>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">9.2 By ACES (IP Only).</p>
                              <p>
                                ACES will defend and indemnify Client from third-party claims
                                alleging that the unmodified Launchpad software (as provided by
                                ACES) infringes such third party&apos;s IP rights, provided Client
                                (a) promptly notifies ACES; (b) gives ACES sole control of
                                defense/settlement; and (c) cooperates. ACES may, at its option,
                                procure continued use, modify/replace the software, or terminate
                                access and refund applicable Service Fees for the impacted launch.
                                This Section does not apply to claims arising from Client content,
                                configurations, combinations with non-ACES materials, or
                                non-compliant use. This Section states ACES&apos; entire liability
                                for IP infringement.
                              </p>
                            </div>
                          </div>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            10. No Third-Party Beneficiaries
                          </h2>
                          <p>
                            Except as expressly stated in Section 9, there are no third-party
                            beneficiaries.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            11. Updates & Changes
                          </h2>
                          <p>
                            Client acknowledges ACES may update or modify the Launchpad and/or this
                            Agreement from time to time. Material changes will be posted on aces.fun
                            or the Launchpad UI and are effective upon posting. Client&apos;s
                            continued use after posting constitutes acceptance.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            12. Assignment
                          </h2>
                          <p>
                            Client may not assign this Agreement without ACES&apos; prior written
                            consent. ACES may assign this Agreement (including to an affiliate or in
                            connection with a corporate transaction). Any prohibited assignment is
                            void.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            13. Variations
                          </h2>
                          <p>
                            Any variation to this Agreement must be in writing and signed (including
                            e-signature) by both Parties, unless otherwise permitted under Section
                            11.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            14. Relationship; No Endorsement; Third-Party Brands
                          </h2>
                          <p>
                            The Parties are independent contractors. Nothing herein creates a
                            partnership, joint venture, agency, or employment relationship.
                            References to third-party companies, brands, or logos are descriptive
                            only and do not constitute endorsement, affiliation, or partnership by
                            ACES.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            15. Representations to Users
                          </h2>
                          <p>
                            Client agrees that all representations, terms of sale, benefits,
                            utilities, redemptions, or roadmaps described to Users are solely
                            Client&apos;s and not ACES&apos; promises. Client must provide clear,
                            complete, and non-misleading disclosures to Users.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            16. Taxes
                          </h2>
                          <p>
                            Client is solely responsible for all taxes arising from its Project and
                            Collectibles and for any required invoicing, reporting, withholding, or
                            remittance.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            17. Force Majeure
                          </h2>
                          <p>
                            Neither Party is liable for delay or failure due to events beyond its
                            reasonable control (e.g., acts of God, war, embargo, sanctions changes,
                            labor issues, utility/Internet outages, protocol/network failures). If
                            such event lasts 90 days, the non-affected Party may terminate on 30
                            days&apos; notice.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            18. Severability
                          </h2>
                          <p>
                            If any provision is unlawful or unenforceable, it will be limited or
                            severed to the minimum extent necessary, and the remainder will remain
                            in effect.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            19. Waiver
                          </h2>
                          <p>
                            A failure or delay to enforce any right is not a waiver. A waiver in one
                            instance is not a waiver in future instances.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            20. Entire Agreement
                          </h2>
                          <p>
                            This Agreement constitutes the entire agreement between the Parties
                            regarding the Launchpad and supersedes prior or contemporaneous
                            agreements on the subject.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-neue-world font-semibold text-[#D0B264] mb-3">
                            21. General
                          </h2>
                          <div className="space-y-3">
                            <div>
                              <p className="font-semibold mb-1">
                                A. Export Control & Sanctions Compliance
                              </p>
                              <p>
                                Client will comply with export control and sanctions laws applicable
                                to its use of the Launchpad. Client represents it is not subject to
                                sanctions, not located in a comprehensively sanctioned jurisdiction,
                                and will not use the Launchpad for prohibited end-uses.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">B. Notices</p>
                              <p>
                                Notices to ACES:&nbsp;
                                <a
                                  href="mailto:legal@aces.fun"
                                  className="text-[#D0B264] hover:underline"
                                >
                                  legal@aces.fun
                                </a>
                                . Notices to Client: the email or address Client provides to ACES.
                                Notices are deemed given when sent by email with confirmation of
                                sending, or upon delivery by recognized courier.
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold mb-1">
                                C. Governing Law; Dispute Resolution
                              </p>
                              <p>
                                This Agreement is governed by the laws of St. Vincent and the
                                Grenadines, without regard to conflict-of-law principles. Any
                                dispute arising out of or in connection with this Agreement shall be
                                finally and exclusively resolved by arbitration in St. Vincent and
                                the Grenadines, under the arbitration rules applicable there at the
                                time of the arbitration. The tribunal shall consist of one (1)
                                arbitrator, the language shall be English, and the award shall be
                                final and binding. Either Party may seek interim injunctive relief
                                in a court of competent jurisdiction in St. Vincent and the
                                Grenadines to preserve the status quo pending arbitration.
                              </p>
                            </div>
                          </div>
                        </section>

                        <section className="border-t border-[#D0B264]/30 pt-6 mt-6">
                          <p className="font-semibold text-[#D0B264]">
                            ACCEPTANCE: By launching or attempting to launch a Project on the ACES
                            Launchpad, you acknowledge that you have read, understood, and agree to
                            be bound by this Agreement.
                          </p>
                        </section>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
