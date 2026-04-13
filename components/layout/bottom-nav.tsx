'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  {
    label: 'Home',
    href: '/dashboard',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
        {!active && <path d="M9 21V12h6v9" />}
      </svg>
    ),
  },
  {
    label: 'Flights',
    href: '/flights',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </svg>
    ),
  },
  {
    label: 'Missions',
    href: '/missions',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" fill={active ? 'currentColor' : 'none'} />
        <circle cx="12" cy="12" r="5" stroke={active ? 'var(--flyeas-accent)' : 'currentColor'} fill={active ? 'rgba(0,0,0,0.3)' : 'none'} />
        <circle cx="12" cy="12" r="1.5" fill={active ? 'var(--flyeas-accent)' : 'currentColor'} />
      </svg>
    ),
  },
  {
    label: 'Hotels',
    href: '/hotels',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21V7a2 2 0 012-2h14a2 2 0 012 2v14" />
        <path d="M1 21h22" />
        <path d="M7 9h2v2H7zM11 9h2v2h-2zM15 9h2v2h-2zM7 13h2v2H7zM11 13h2v2h-2zM15 13h2v2h-2z" fill="none" stroke={active ? 'rgba(0,0,0,0.5)' : 'currentColor'} strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" fill={active ? 'rgba(0,0,0,0.4)' : 'none'} />
        <path d="M12 1.5v2M12 20.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1.5 12h2M20.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname?.startsWith(tab.href + '/');
        return (
          <Link key={tab.href} href={tab.href} className={`bottom-nav-item ${isActive ? 'active' : ''}`}>
            <span className="bottom-nav-icon">{tab.icon(isActive)}</span>
            <span className="bottom-nav-label">{tab.label}</span>
            {isActive && <span className="bottom-nav-dot" />}
          </Link>
        );
      })}
    </nav>
  );
}
