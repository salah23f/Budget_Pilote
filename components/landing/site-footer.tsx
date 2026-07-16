import Link from 'next/link';
import { LogoMark } from '@/components/landing/logo';

/* Landing footer — sober, existing routes only. Server-safe. */

const COLUMNS: Array<{ title: string; items: Array<{ href: string; label: string }> }> = [
  {
    title: 'Product',
    items: [
      { href: '/flights', label: 'Flights' },
      { href: '/hotels', label: 'Hotels' },
      { href: '/missions', label: 'Missions' },
      { href: '/rewards', label: 'Rewards' },
    ],
  },
  {
    title: 'Company',
    items: [
      { href: '/about', label: 'About' },
      { href: '/blog', label: 'Journal' },
      { href: '/legal/terms', label: 'Terms' },
      { href: '/legal/privacy', label: 'Privacy' },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/onboarding', label: 'Sign in' },
      { href: '/onboarding', label: 'Create account' },
      { href: '#pricing', label: 'Pricing' },
      { href: '/settings', label: 'Preferences' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line-1 bg-ink-950">
      <div className="mx-auto max-w-wide px-6 py-16 lg:px-12 lg:py-20">
        <div className="mb-12 grid gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="mb-4 flex items-center gap-2">
              <LogoMark />
              <span className="editorial text-body-lg text-pen-1">Flyeas</span>
            </Link>
            <p className="max-w-[320px] text-caption leading-relaxed text-pen-2">
              A travel concierge. You set the mission &mdash; destination, dates, budget &mdash;
              and Flyeas watches, advises, and books within it.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="mb-4 text-micro uppercase text-pen-3">{col.title}</p>
              <ul className="space-y-2.5">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-caption text-pen-2 transition hover:text-pen-1"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line-1 pt-8">
          <p className="text-caption text-pen-3">
            &copy; {new Date().getFullYear()} Flyeas. All rights reserved.
          </p>
          <p className="text-caption text-pen-3">
            Every price you see includes taxes and required fees.
          </p>
        </div>
      </div>
    </footer>
  );
}
