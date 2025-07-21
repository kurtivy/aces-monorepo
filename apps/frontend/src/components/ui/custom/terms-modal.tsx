'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TermsModal({ isOpen, onClose }: TermsModalProps) {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>('terms');

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
            <div className="max-w-3xl w-full max-h-[90vh] bg-[#231F20] rounded-lg shadow-lg border border-[#D0B264]/40 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-[#D0B264]/20">
                <h1 className="text-3xl font-heading font-bold text-white">Legal Information</h1>
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
                        className={`flex-1 px-3 py-2 sm:px-8 sm:py-3 rounded-full text-sm sm:text-lg font-heading font-semibold transition-all duration-300 ${
                          activeTab === 'terms'
                            ? 'bg-[#D0B264] text-black shadow-lg'
                            : 'text-gray-400 hover:text-[#D0B264] hover:bg-[#D0B264]/10'
                        }`}
                      >
                        Terms of Service
                      </button>
                      <button
                        onClick={() => setActiveTab('privacy')}
                        className={`flex-1 px-3 py-2 sm:px-8 sm:py-3 rounded-full text-sm sm:text-lg font-heading font-semibold transition-all duration-300 ${
                          activeTab === 'privacy'
                            ? 'bg-[#D0B264] text-black shadow-lg'
                            : 'text-gray-400 hover:text-[#D0B264] hover:bg-[#D0B264]/10'
                        }`}
                      >
                        Privacy Policy
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
                          <h2 className="text-2xl font-heading font-bold text-[#D0B264] mb-2">
                            Waiver of Liability and User Terms
                          </h2>
                          <p className="text-[#D0B264] text-lg">
                            Effective Date: February 13th, 2025
                          </p>
                        </div>

                        <section>
                          <h2 className="text-xl font-heading font-semibold text-[#D0B264] mb-3">
                            1. Acceptance of Terms
                          </h2>
                          <p>
                            By accessing or using Aces.fun (&ldquo;the Website&rdquo;), you agree to
                            be bound by these Waiver of Liability and User Terms
                            (&ldquo;Terms&rdquo;). If you do not agree with any part of these Terms,
                            you must not use the Website.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-heading font-semibold text-[#D0B264] mb-3">
                            2. Assumption of Risk
                          </h2>
                          <p>
                            By using the Website, you acknowledge that all activities, content, and
                            interactions within the Website are undertaken at your own risk. We do
                            not guarantee the accuracy, completeness, or reliability of any content
                            provided.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-heading font-semibold text-[#D0B264] mb-3">
                            3. Waiver of Liability
                          </h2>
                          <p>
                            To the fullest extent permitted by law, Aces.fun, its owners,
                            affiliates, officers, employees, agents, and partners shall not be
                            liable for any direct, indirect, incidental, consequential, or punitive
                            damages arising from:
                          </p>
                          <ul className="list-disc pl-6 mt-2 space-y-1">
                            <li>Your use or inability to use the Website.</li>
                            <li>Errors, inaccuracies, or omissions in the content.</li>
                            <li>
                              Unauthorized access to or use of our servers and personal data stored
                              therein.
                            </li>
                            <li>
                              Any viruses, malware, or other harmful components transmitted through
                              the Website.
                            </li>
                            <li>
                              Any third-party content, services, or products linked through the
                              Website.
                            </li>
                          </ul>
                        </section>

                        <section>
                          <h2 className="text-xl font-heading font-semibold text-[#D0B264] mb-3">
                            4. Indemnification
                          </h2>
                          <p>
                            You agree to indemnify, defend, and hold harmless Aces.fun and its
                            affiliates from any claims, damages, liabilities, costs, and expenses
                            (including legal fees) arising out of your use of the Website, your
                            violation of these Terms, or any infringement of third-party rights.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-heading font-semibold text-[#D0B264] mb-3">
                            5. No Warranties
                          </h2>
                          <p>
                            The Website and its content are provided &ldquo;as is&rdquo; and
                            &ldquo;as available&rdquo; without warranties of any kind, either
                            express or implied. We disclaim all warranties, including but not
                            limited to merchantability, fitness for a particular purpose, and
                            non-infringement.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-heading font-semibold text-[#D0B264] mb-3">
                            6. User Responsibilities
                          </h2>
                          <ul className="list-disc pl-6 mt-2 space-y-1">
                            <li>
                              You must use the Website in compliance with all applicable laws and
                              regulations.
                            </li>
                            <li>
                              You may not engage in fraudulent, deceptive, or harmful activities.
                            </li>
                            <li>
                              You are responsible for ensuring that your account credentials are
                              kept secure.
                            </li>
                            <li>You are not from the United States, UK, or Germany.</li>
                          </ul>
                        </section>

                        <section>
                          <h2 className="text-xl font-heading font-semibold text-[#D0B264] mb-3">
                            7. Third-Party Links
                          </h2>
                          <p>
                            The Website may contain links to third-party websites. We do not endorse
                            or assume responsibility for any third-party content, products, or
                            services.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-heading font-semibold text-[#D0B264] mb-3">
                            8. Changes to These Terms
                          </h2>
                          <p>
                            We reserve the right to modify these Terms at any time. Continued use of
                            the Website after changes constitute acceptance of the revised Terms.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-heading font-semibold text-[#D0B264] mb-3">
                            9. Governing Law and Jurisdiction
                          </h2>
                          <p>
                            These Terms shall be governed by and construed in accordance with the
                            laws of Saint Vincent. Any disputes arising under these Terms shall be
                            subject to the exclusive jurisdiction of the courts in Saint Vincent.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-heading font-semibold text-[#D0B264] mb-3">
                            10. Contact Information
                          </h2>
                          <p>
                            For any questions or concerns regarding these Terms, please contact us
                            at:&nbsp;
                            <a
                              href="mailto:river@aces.fun"
                              className="text-[#D0B264] hover:underline"
                            >
                              river@aces.fun
                            </a>
                          </p>
                        </section>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-300 space-y-6">
                      <div className="space-y-8">
                        <div className="text-center mb-4">
                          <h2 className="text-2xl font-heading font-bold text-[#D0B264] mb-2">
                            Privacy Policy
                          </h2>
                          <p className="text-[#D0B264] text-lg">
                            Effective Date: February 13th, 2025
                          </p>
                        </div>

                        <section>
                          <h2 className="text-xl font-heading font-semibold text-[#D0B264] mb-3">
                            1. Information We Collect
                          </h2>
                          <p>
                            We collect information you provide directly to us, such as when you
                            create an account, make a purchase, or contact us for support. This may
                            include your name, email address, wallet address, and transaction
                            history.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-heading font-semibold text-[#D0B264] mb-3">
                            2. How We Use Your Information
                          </h2>
                          <p>
                            We use the information we collect to provide, maintain, and improve our
                            services, process transactions, communicate with you, and ensure
                            compliance with applicable laws and regulations.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-heading font-semibold text-[#D0B264] mb-3">
                            3. Information Sharing
                          </h2>
                          <p>
                            We do not sell, trade, or otherwise transfer your personal information
                            to third parties without your consent, except as required by law or as
                            necessary to provide our services.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-heading font-semibold text-[#D0B264] mb-3">
                            4. Data Security
                          </h2>
                          <p>
                            We implement appropriate security measures to protect your personal
                            information against unauthorized access, alteration, disclosure, or
                            destruction.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-heading font-semibold text-[#D0B264] mb-3">
                            5. Your Rights
                          </h2>
                          <p>
                            You have the right to access, correct, or delete your personal
                            information. You may also withdraw your consent for data processing at
                            any time.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-heading font-semibold text-[#D0B264] mb-3">
                            6. Cookies and Tracking
                          </h2>
                          <p>
                            We use cookies and similar technologies to enhance your experience and
                            analyze website usage. You can control cookie settings through your
                            browser.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-heading font-semibold text-[#D0B264] mb-3">
                            7. Third-Party Services
                          </h2>
                          <p>
                            We may share data with third-party service providers for operational
                            purposes (e.g., payment processors, analytics providers), ensuring they
                            comply with applicable data protection laws.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-heading font-semibold text-[#D0B264] mb-3">
                            8. Children&apos;s Privacy
                          </h2>
                          <p>
                            Our services are not intended for users under the age of 18. We do not
                            knowingly collect personal data from minors.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-heading font-semibold text-[#D0B264] mb-3">
                            9. Changes to This Policy
                          </h2>
                          <p>
                            We may update this Privacy Policy periodically. Any changes will be
                            posted on this page with an updated effective date.
                          </p>
                        </section>

                        <section>
                          <h2 className="text-xl font-heading font-semibold text-[#D0B264] mb-3">
                            10. Contact Us
                          </h2>
                          <p>
                            If you have any questions or concerns about this Privacy Policy, please
                            contact us at:&nbsp;
                            <a
                              href="mailto:river@aces.fun"
                              className="text-[#D0B264] hover:underline"
                            >
                              river@aces.fun
                            </a>
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
