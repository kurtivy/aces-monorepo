'use client';

import { useState } from 'react';
import NavMenu from '@/components/ui/nav-menu';
import BackButton from '@/components/ui/back-button';

export default function TermsPage() {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>('terms');

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <NavMenu />
      <BackButton />

      <div className="max-w-3xl w-full bg-[#231F20] rounded-lg shadow-lg p-8 space-y-6 border border-[#D0B264]/40">
        {/* Enhanced Tab Navigation as Title Area */}
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-3xl font-syne font-bold text-white mb-6">Legal Information</h1>
          <div className="flex justify-center">
            <div className="bg-[#1a1718] rounded-full p-1 border border-[#D0B264]/30 w-full max-w-sm sm:max-w-2xl">
              <div className="flex space-x-1">
                <button
                  onClick={() => setActiveTab('terms')}
                  className={`flex-1 px-3 py-2 sm:px-8 sm:py-3 rounded-full text-sm sm:text-lg font-syne font-semibold transition-all duration-300 ${
                    activeTab === 'terms'
                      ? 'bg-[#D0B264] text-black shadow-lg'
                      : 'text-gray-400 hover:text-[#D0B264] hover:bg-[#D0B264]/10'
                  }`}
                >
                  Terms of Service
                </button>
                <button
                  onClick={() => setActiveTab('privacy')}
                  className={`flex-1 px-3 py-2 sm:px-8 sm:py-3 rounded-full text-sm sm:text-lg font-syne font-semibold transition-all duration-300 ${
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

        {/* Content Sections */}
        <div className="space-y-6 pt-4">
          {activeTab === 'terms' ? (
            <div className="text-gray-300 space-y-6">
              <div className="space-y-8">
                <div className="text-center mb-4">
                  <h2 className="text-2xl font-syne font-bold text-[#D0B264] mb-2">
                    Waiver of Liability and User Terms
                  </h2>
                  <p className="text-[#D0B264] text-lg">Effective Date: February 13th, 2025</p>
                </div>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    1. Acceptance of Terms
                  </h2>
                  <p>
                    By accessing or using Aces.fun (&ldquo;the Website&rdquo;), you agree to be
                    bound by these Waiver of Liability and User Terms (&ldquo;Terms&rdquo;). If you
                    do not agree with any part of these Terms, you must not use the Website.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    2. Assumption of Risk
                  </h2>
                  <p>
                    By using the Website, you acknowledge that all activities, content, and
                    interactions within the Website are undertaken at your own risk. We do not
                    guarantee the accuracy, completeness, or reliability of any content provided.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    3. Waiver of Liability
                  </h2>
                  <p>
                    To the fullest extent permitted by law, Aces.fun, its owners, affiliates,
                    officers, employees, agents, and partners shall not be liable for any direct,
                    indirect, incidental, consequential, or punitive damages arising from:
                  </p>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Your use or inability to use the Website.</li>
                    <li>Errors, inaccuracies, or omissions in the content.</li>
                    <li>
                      Unauthorized access to or use of our servers and personal data stored therein.
                    </li>
                    <li>
                      Any viruses, malware, or other harmful components transmitted through the
                      Website.
                    </li>
                    <li>
                      Any third-party content, services, or products linked through the Website.
                    </li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    4. Indemnification
                  </h2>
                  <p>
                    You agree to indemnify, defend, and hold harmless Aces.fun and its affiliates
                    from any claims, damages, liabilities, costs, and expenses (including legal
                    fees) arising out of your use of the Website, your violation of these Terms, or
                    any infringement of third-party rights.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    5. No Warranties
                  </h2>
                  <p>
                    The Website and its content are provided &ldquo;as is&rdquo; and &ldquo;as
                    available&rdquo; without warranties of any kind, either express or implied. We
                    disclaim all warranties, including but not limited to merchantability, fitness
                    for a particular purpose, and non-infringement.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    6. User Responsibilities
                  </h2>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>
                      You must use the Website in compliance with all applicable laws and
                      regulations.
                    </li>
                    <li>You may not engage in fraudulent, deceptive, or harmful activities.</li>
                    <li>
                      You are responsible for ensuring that your account credentials are kept
                      secure.
                    </li>
                    <li>You are not from the United States, UK, or Germany.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    7. Third-Party Links
                  </h2>
                  <p>
                    The Website may contain links to third-party websites. We do not endorse or
                    assume responsibility for any third-party content, products, or services.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    8. Changes to These Terms
                  </h2>
                  <p>
                    We reserve the right to modify these Terms at any time. Continued use of the
                    Website after changes constitute acceptance of the revised Terms.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    9. Governing Law and Jurisdiction
                  </h2>
                  <p>
                    These Terms shall be governed by and construed in accordance with the laws of
                    Saint Vincent. Any disputes arising under these Terms shall be subject to the
                    exclusive jurisdiction of the courts in Saint Vincent.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    10. Contact Information
                  </h2>
                  <p>
                    For any questions or concerns regarding these Terms, please contact us at:&nbsp;
                    <a href="mailto:river@aces.fun" className="text-[#D0B264] hover:underline">
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
                  <h2 className="text-2xl font-syne font-bold text-[#D0B264] mb-2">
                    Privacy Policy
                  </h2>
                  <p className="text-[#D0B264] text-lg">Effective Date: February 13th, 2025</p>
                </div>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    1. Introduction
                  </h2>
                  <p>
                    Welcome to Aces Global Technology (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or
                    &ldquo;us&rdquo;). We are committed to protecting your privacy and ensuring that
                    your personal data is handled securely and in compliance with applicable laws,
                    including but not limited to the General Data Protection Regulation (EU & UK
                    GDPR), the California Consumer Privacy Act (CCPA), and other relevant
                    international data protection regulations.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    2. Information We Collect
                  </h2>
                  <p>We collect and process the following types of personal data:</p>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>
                      Personal Identification Information: Name, email address, phone number, etc.
                    </li>
                    <li>Account Information: Username, password, and preferences.</li>
                    <li>Transaction Data: Details of purchases and payments.</li>
                    <li>Technical Data: IP address, browser type, and usage data.</li>
                    <li>
                      Cookies and Tracking Technologies: To enhance user experience and for
                      analytics.
                    </li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    3. How We Use Your Data
                  </h2>
                  <p>We process your data for the following purposes:</p>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>To provide and manage our services.</li>
                    <li>To process transactions securely.</li>
                    <li>To improve and personalize user experience.</li>
                    <li>To comply with legal obligations.</li>
                    <li>To communicate with you regarding updates, offers, or customer support.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    4. Legal Basis for Processing Data
                  </h2>
                  <p>We process personal data under the following legal bases:</p>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Consent: When you provide explicit consent for specific uses.</li>
                    <li>Contractual Necessity: To fulfill contractual obligations.</li>
                    <li>Legal Obligation: Compliance with legal and regulatory requirements.</li>
                    <li>
                      Legitimate Interests: For purposes that do not override your privacy rights.
                    </li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    5. Data Retention
                  </h2>
                  <p>
                    We retain your personal data only for as long as necessary to fulfill the
                    purposes outlined in this policy, comply with legal obligations, and resolve
                    disputes.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    6. International Data Transfers
                  </h2>
                  <p>
                    If we transfer personal data internationally, we ensure appropriate safeguards
                    are in place, such as Standard Contractual Clauses (SCCs) approved by relevant
                    regulatory bodies.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    7. Your Rights
                  </h2>
                  <p>Depending on your location, you may have the following rights:</p>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Access: Request a copy of the personal data we hold about you.</li>
                    <li>Correction: Request corrections to inaccurate or incomplete data.</li>
                    <li>Deletion: Request deletion of your data under certain conditions.</li>
                    <li>Objection: Object to processing based on legitimate interests.</li>
                    <li>
                      Data Portability: Request transfer of your data to another service provider.
                    </li>
                    <li>
                      Withdraw Consent: Where processing is based on consent, withdraw it at any
                      time.
                    </li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    8. Security Measures
                  </h2>
                  <p>
                    We implement appropriate technical and organizational measures to safeguard your
                    personal data against unauthorized access, alteration, disclosure, or
                    destruction.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    9. Cookies and Tracking Technologies
                  </h2>
                  <p>
                    We use cookies and similar technologies to enhance user experience. You can
                    manage your cookie preferences through your browser settings.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    10. Third-Party Services
                  </h2>
                  <p>
                    We may share data with third-party service providers for operational purposes
                    (e.g., payment processors, analytics providers), ensuring they comply with
                    applicable data protection laws.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    11. Children&apos;s Privacy
                  </h2>
                  <p>
                    Our services are not intended for users under the age of 18. We do not knowingly
                    collect personal data from minors.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    12. Changes to This Policy
                  </h2>
                  <p>
                    We may update this Privacy Policy periodically. Any changes will be posted on
                    this page with an updated effective date.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-syne font-semibold text-[#D0B264] mb-3">
                    13. Contact Us
                  </h2>
                  <p>
                    If you have any questions or concerns about this Privacy Policy, please contact
                    us at:&nbsp;
                    <a href="mailto:river@aces.fun" className="text-[#D0B264] hover:underline">
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
  );
}
