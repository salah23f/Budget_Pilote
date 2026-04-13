'use client';

import Link from 'next/link';

export default function TermsOfService() {
  return (
    <>
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-white/50 hover:text-white transition mb-8"
      >
        <span className="text-lg">&larr;</span> Back to Home
      </Link>

      <div className="glass rounded-2xl p-8 md:p-12">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
          Terms of Service
        </h1>
        <p className="text-white/40 mb-10">Last updated: April 2026</p>

        {/* 1 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">1. Acceptance of Terms</h2>
          <p className="text-white/70 leading-relaxed">
            By accessing or using Flyeas, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the platform.
          </p>
        </section>

        {/* 2 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">2. Service Description</h2>
          <p className="text-white/70 leading-relaxed">
            Flyeas is an AI-assisted travel search platform that helps users find flights and hotels. The AI operates strictly as a user-mandated assistant and is advisory only&mdash;all final decisions rest with the user.
          </p>
        </section>

        {/* 3 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">3. User Accounts</h2>
          <p className="text-white/70 leading-relaxed">
            You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use.
          </p>
        </section>

        {/* 4 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">4. AI Advisory Disclaimer</h2>
          <p className="text-white/70 leading-relaxed">
            The AI provides recommendations only and does not make purchases on your behalf without explicit confirmation. You are responsible for reviewing and confirming all bookings. Flyeas is not liable for any outcomes based on AI recommendations.
          </p>
        </section>

        {/* 5 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">5. Payments</h2>
          <p className="text-white/70 leading-relaxed">
            All payments are processed through PCI-DSS compliant third-party providers. Flyeas does not hold funds, pool money, or act as a custodian of user funds at any time.
          </p>
        </section>

        {/* 6 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">6. Data Protection</h2>
          <p className="text-white/70 leading-relaxed">
            We handle your data in accordance with our{' '}
            <Link href="/legal/privacy" className="text-amber-400 hover:underline">
              Privacy Policy
            </Link>
            . Flyeas is compliant with the EU General Data Protection Regulation (GDPR) and the Swiss Federal Act on Data Protection (FADP).
          </p>
        </section>

        {/* 7 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">7. Limitation of Liability</h2>
          <p className="text-white/70 leading-relaxed">
            Flyeas provides the platform &ldquo;as is&rdquo; without warranties of any kind. We are not liable for flight price changes, airline cancellations, schedule modifications, or any third-party service disruptions.
          </p>
        </section>

        {/* 8 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">8. Intellectual Property</h2>
          <p className="text-white/70 leading-relaxed">
            All content, trademarks, and technology on the Flyeas platform are owned by or licensed to Flyeas. You may not reproduce, distribute, or create derivative works without prior written consent.
          </p>
        </section>

        {/* 9 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">9. Termination</h2>
          <p className="text-white/70 leading-relaxed">
            You may delete your account at any time through the Settings page. Upon deletion, your personal data will be removed in accordance with our Privacy Policy.
          </p>
        </section>

        {/* 10 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">10. Regulatory Status</h2>
          <p className="text-white/70 leading-relaxed">
            Flyeas is an AI-assisted travel search and comparison platform. Flyeas does not operate as a licensed travel agency, bank, broker-dealer, or financial institution. Flyeas does not sell tickets directly — it connects users with airline and hotel booking systems. Any commissions received are for referral services only. Users are responsible for verifying booking terms directly with the service provider.
          </p>
        </section>

        {/* 11 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">11. Governing Law</h2>
          <p className="text-white/70 leading-relaxed">
            These terms are governed by and construed in accordance with the laws of Switzerland. Any disputes shall be subject to the exclusive jurisdiction of the Swiss courts.
          </p>
        </section>

        {/* 11 */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-2">11. Contact</h2>
          <p className="text-white/70 leading-relaxed">
            For questions about these Terms of Service, please contact us at{' '}
            <a href="mailto:legal@flyeas.ai" className="text-amber-400 hover:underline">
              legal@flyeas.ai
            </a>
            .
          </p>
        </section>
      </div>
    </>
  );
}
