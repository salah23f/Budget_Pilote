import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="py-6">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="text-3xl font-bold text-white mb-6">About Flyeas</h1>

        <div className="space-y-8 text-sm text-white/60 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Our mission</h2>
            <p>
              Flyeas is the world's first AI travel agent that doesn't just search — it <span className="text-white font-medium">watches, predicts, and acts</span>.
              We built a statistical engine that monitors flight prices around the clock, learns the patterns of every route,
              and automatically books when the price is right. Your money stays in your hands (Stripe hold or USDC escrow)
              until the moment we find your deal.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">How we're different</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { icon: '🧠', title: 'Statistical intelligence', desc: 'Z-scores, percentile ranks, trend analysis, time-to-departure pressure — real math, not marketing.' },
                { icon: '💰', title: 'Non-custodial payments', desc: 'Your budget sits on your card (Stripe hold) or in a smart contract (USDC). We never touch your money.' },
                { icon: '⚡', title: 'Auto-buy with confidence', desc: 'The agent only captures funds when the prediction confidence exceeds 60%. No blind alerts.' },
                { icon: '🔗', title: 'Transparent reasoning', desc: 'Every recommendation explains itself. You see the z-score, the trend, the probability. No black box.' },
              ].map((item) => (
                <div key={item.title} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-lg mb-1">{item.icon}</p>
                  <p className="text-sm font-semibold text-white mb-1">{item.title}</p>
                  <p className="text-xs text-white/50">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">The numbers</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {[
                { n: '230+', label: 'Airports' },
                { n: '400+', label: 'Airlines' },
                { n: '24/7', label: 'Monitoring' },
                { n: '$0', label: 'Until you fly' },
              ].map((s) => (
                <div key={s.label} className="py-4">
                  <p className="text-2xl font-bold text-white">{s.n}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/30 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Built with</h2>
            <div className="flex flex-wrap gap-2">
              {['Next.js', 'Stripe', 'Kiwi.com', 'Base (L2)', 'Solidity', 'Vercel', 'TypeScript', 'Tailwind'].map((t) => (
                <span key={t} className="px-3 py-1 rounded-lg text-xs text-white/50" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {t}
                </span>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Contact</h2>
            <p>
              Questions, partnerships, or investor inquiries:{' '}
              <a href="mailto:hello@flyeas.app" className="text-amber-300 underline">hello@flyeas.app</a>
            </p>
          </section>

          <div className="pt-4 border-t border-white/5 flex gap-4">
            <Link href="/pricing" className="text-amber-300 text-sm hover:underline">Pricing</Link>
            <Link href="/legal/terms" className="text-white/40 text-sm hover:underline">Terms</Link>
            <Link href="/legal/privacy" className="text-white/40 text-sm hover:underline">Privacy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
