'use client';

import Link from 'next/link';

export default function PrivacyPolicy() {
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
          Privacy Policy
        </h1>
        <p className="text-white/40 mb-10">Last updated: April 2026</p>

        {/* 1 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">1. Introduction</h2>
          <p className="text-white/70 leading-relaxed">
            Flyeas respects your privacy and is committed to protecting your personal data. This policy explains how we collect, use, and safeguard your information in compliance with the EU General Data Protection Regulation (GDPR) and the Swiss Federal Act on Data Protection (FADP).
          </p>
        </section>

        {/* 2 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">2. Data We Collect</h2>
          <p className="text-white/70 leading-relaxed">
            We collect your email and name for account creation, and your search queries to provide AI-powered travel recommendations. We do not collect any unnecessary personal data beyond what is required to operate the service.
          </p>
        </section>

        {/* 3 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">3. How We Use Data</h2>
          <p className="text-white/70 leading-relaxed">
            Your data is used to provide travel search results and to improve AI recommendations. We never sell your personal data to third parties.
          </p>
        </section>

        {/* 4 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">4. Data Storage</h2>
          <p className="text-white/70 leading-relaxed">
            Personal data is stored off-chain and encrypted. We use AES-256 encryption at rest and TLS 1.3 for data in transit to ensure your information remains secure.
          </p>
        </section>

        {/* 5 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">5. Your Rights (GDPR)</h2>
          <p className="text-white/70 leading-relaxed mb-3">
            Under GDPR and FADP, you have the following rights regarding your personal data:
          </p>
          <ul className="list-disc list-inside text-white/70 space-y-1 ml-2">
            <li>Right to access your personal data</li>
            <li>Right to deletion of your data</li>
            <li>Right to data portability</li>
            <li>Right to restrict processing</li>
            <li>Right to object to processing</li>
          </ul>
          <p className="text-white/70 leading-relaxed mt-3">
            To exercise any of these rights, visit the{' '}
            <Link href="/settings" className="text-amber-400 hover:underline">
              Settings
            </Link>{' '}
            page or contact us at{' '}
            <a href="mailto:privacy@flyeas.ai" className="text-amber-400 hover:underline">
              privacy@flyeas.ai
            </a>
            .
          </p>
        </section>

        {/* 6 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">6. Cookies</h2>
          <p className="text-white/70 leading-relaxed">
            We use minimal cookies strictly for authentication and session management. We do not use tracking cookies or any third-party advertising cookies.
          </p>
        </section>

        {/* 7 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">7. Third-Party Services</h2>
          <p className="text-white/70 leading-relaxed mb-3">
            We use the following third-party services to operate the platform:
          </p>
          <ul className="list-disc list-inside text-white/70 space-y-1 ml-2">
            <li>
              <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">Supabase</a>{' '}
              &mdash; Authentication and database
            </li>
            <li>
              <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">Resend</a>{' '}
              &mdash; Email delivery
            </li>
            <li>
              <a href="https://rapidapi.com/apiheya/api/sky-scrapper" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">Sky Scrapper API</a>{' '}
              &mdash; Flight data
            </li>
          </ul>
        </section>

        {/* 8 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">8. Data Retention</h2>
          <p className="text-white/70 leading-relaxed">
            Your data is retained for as long as your account is active. Upon account deletion, all personal data will be permanently removed within 30 days.
          </p>
        </section>

        {/* 9 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">9. Children</h2>
          <p className="text-white/70 leading-relaxed">
            Flyeas is not intended for use by individuals under the age of 18. We do not knowingly collect personal data from minors.
          </p>
        </section>

        {/* 10 */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">10. Changes to This Policy</h2>
          <p className="text-white/70 leading-relaxed">
            We may update this Privacy Policy from time to time. Users will be notified of significant changes by email. Continued use of the service after changes constitutes acceptance.
          </p>
        </section>

        {/* 11 */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-2">11. Contact</h2>
          <p className="text-white/70 leading-relaxed">
            For questions about this Privacy Policy, please contact us at{' '}
            <a href="mailto:privacy@flyeas.ai" className="text-amber-400 hover:underline">
              privacy@flyeas.ai
            </a>
            .
          </p>
        </section>
      </div>
    </>
  );
}
