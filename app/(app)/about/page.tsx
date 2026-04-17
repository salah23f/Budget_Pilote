import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function AboutPage() {
  return (
    <div className="py-6">
      <div className="mx-auto max-w-4xl px-4 space-y-10">
        {/* Hero */}
        <div className="text-center py-8">
          <div
            className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6"
            style={{ background: 'var(--flyeas-gradient)' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">About Flyeas</h1>
          <p className="text-base text-white/40 mt-3 max-w-xl mx-auto leading-relaxed">
            The AI-powered travel agent that watches, predicts, and books — so you never overpay for a flight again.
          </p>
        </div>

        {/* Mission */}
        <Card padding="lg">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4A24C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            Our Mission
          </h2>
          <p className="text-sm text-white/60 leading-relaxed">
            We built Flyeas because we were tired of overpaying for flights. The travel industry is opaque — prices change 3-5 times per day,
            airlines use dynamic pricing to maximize revenue, and the average traveler has no way to know if they are getting a good deal.
          </p>
          <p className="text-sm text-white/60 leading-relaxed mt-3">
            Flyeas changes that. Our AI monitors hundreds of routes 24/7, learns the pricing patterns of every airline, and automatically
            books when the price drops below your target. Your money stays in your hands until the moment we find your deal — no custody, no risk.
          </p>
        </Card>

        {/* How we're different */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">How We Are Different</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D4A24C" strokeWidth="1.8"><path d="M12 2a10 10 0 1 0 10 10H12V2z" strokeLinecap="round" strokeLinejoin="round"/><path d="M20 12a8 8 0 0 0-8-8v8h8z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                title: 'Statistical Intelligence',
                desc: 'Z-scores, percentile ranks, trend analysis, and departure-pressure modeling — real math, not marketing.',
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 4v6c0 5.5-3.8 10.7-8 12-4.2-1.3-8-6.5-8-12V6l8-4z"/></svg>,
                title: 'Non-Custodial Payments',
                desc: 'Your budget stays on your card (Stripe hold) or in a smart contract (USDC). We never touch your money until the deal is found.',
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
                title: 'Auto-Buy With Confidence',
                desc: 'The agent only captures funds when prediction confidence exceeds 60%. No blind alerts, no false promises.',
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
                title: 'Transparent Reasoning',
                desc: 'Every recommendation explains itself. You see the z-score, the trend, the probability. No black box.',
              },
            ].map((item) => (
              <Card key={item.title} padding="md" hoverable>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-xs text-white/45 mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Tech stack */}
        <Card padding="lg">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4A24C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            Built With
          </h2>
          <div className="flex flex-wrap gap-2">
            {['Next.js 14', 'React 18', 'TypeScript', 'Tailwind CSS', 'Framer Motion', 'Zustand', 'Stripe', 'Supabase', 'Vercel', 'Sky-Scrapper API', 'Kiwi.com API', 'OpenWeatherMap', 'Resend'].map((tech) => (
              <Badge key={tech} variant="default" size="sm">{tech}</Badge>
            ))}
          </div>
        </Card>

        {/* Founder */}
        <Card padding="lg" className="glass-premium">
          <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4A24C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M3 21c0-4.4 4-8 9-8s9 3.6 9 8"/></svg>
            Founder
          </h2>
          <div className="flex items-start gap-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
              style={{ background: 'var(--flyeas-gradient)' }}
            >
              SF
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Salah Farhat</h3>
              <p className="text-xs text-amber-400/70 font-medium">Founder & Developer</p>
              <p className="text-sm text-white/50 mt-2 leading-relaxed">
                Software engineer passionate about AI, travel, and building products that solve real problems.
                Built Flyeas to prove that technology can make travel affordable for everyone — not just
                those who spend hours refreshing flight comparison sites.
              </p>
              <div className="flex gap-3 mt-4">
                <a href="https://github.com/salah23fs" target="_blank" rel="noopener noreferrer" className="text-xs text-white/30 hover:text-white transition flex items-center gap-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </Card>

        {/* Trust signals */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { value: '400+', label: 'Airlines searched', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4A24C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2"/></svg> },
            { value: '150K+', label: 'Hotels worldwide', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21V7a2 2 0 012-2h14a2 2 0 012 2v14"/><path d="M1 21h22"/></svg> },
            { value: '24/7', label: 'Price monitoring', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> },
            { value: '0%', label: 'Hidden fees', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 4v6c0 5.5-3.8 10.7-8 12-4.2-1.3-8-6.5-8-12V6l8-4z"/></svg> },
          ].map((stat) => (
            <Card key={stat.label} padding="md" className="text-center">
              <div className="flex justify-center mb-2">{stat.icon}</div>
              <p className="text-xl font-bold text-white">{stat.value}</p>
              <p className="text-[10px] text-white/35 mt-0.5">{stat.label}</p>
            </Card>
          ))}
        </div>

        {/* Legal */}
        <div className="text-center space-y-3 py-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs text-white/25">
            Flyeas is an independent travel technology company. We are not affiliated with any airline or hotel chain.
          </p>
          <div className="flex justify-center gap-6">
            <Link href="/legal/terms" className="text-xs text-white/30 hover:text-white/60 transition">Terms of Service</Link>
            <Link href="/legal/privacy" className="text-xs text-white/30 hover:text-white/60 transition">Privacy Policy</Link>
          </div>
          <p className="text-[10px] text-white/15">
            &copy; {new Date().getFullYear()} Flyeas. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
