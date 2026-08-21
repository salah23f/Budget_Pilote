import Link from 'next/link';
import { LogoMark } from '@/components/landing/logo';

/* Landing top nav — server-safe, anchor links to page sections. */

const NAV_LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#difference', label: 'The difference' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

export function SiteNav() {
  return (
    <header className="topbar-glass sticky top-0 z-40">
      <div className="mx-auto flex h-16 max-w-wide items-center justify-between px-6 lg:px-12">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark />
          <span className="editorial text-body-lg tracking-tight text-pen-1">Flyeas</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-body text-pen-2 transition hover:text-pen-1"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/onboarding"
            className="hidden px-3 py-2 text-body text-pen-2 transition hover:text-pen-1 sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/onboarding"
            className="premium-button inline-flex items-center rounded-md px-4 py-2 text-body"
          >
            Start a mission
          </Link>
        </div>
      </div>
    </header>
  );
}
