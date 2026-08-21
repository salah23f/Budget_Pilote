'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/lib/i18n';
import { Home, Target, Plus, UserCircle, Settings } from 'lucide-react';

// Missions-first: the elevated center action creates a mission.
const TABS = [
  { labelKey: 'sidebar.home', href: '/dashboard', icon: Home, elevated: false },
  { labelKey: 'sidebar.missions', href: '/missions', icon: Target, elevated: false },
  { labelKey: 'nav.newMission', href: '/missions/new', icon: Plus, elevated: true },
  { labelKey: 'sidebar.profile', href: '/account', icon: UserCircle, elevated: false },
  { labelKey: 'sidebar.settings', href: '/settings', icon: Settings, elevated: false },
];

function isTabActive(href: string, elevated: boolean, pathname: string | null): boolean {
  if (!pathname) return false;
  if (elevated) return pathname === href;
  if (href === '/missions') {
    // /missions/new belongs to the elevated "+" tab, not the list tab
    return pathname === '/missions' || (pathname.startsWith('/missions/') && pathname !== '/missions/new');
  }
  return pathname === href || pathname.startsWith(href + '/');
}

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <nav className="bottom-nav" role="tablist">
      {TABS.map((tab) => {
        const isActive = isTabActive(tab.href, tab.elevated, pathname);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={`
              flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 relative
              transition-colors duration-200
              ${isActive && !tab.elevated ? 'text-accent' : 'text-pen-3'}
            `}
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(5);
              }
            }}
          >
            {tab.elevated ? (
              <span className="flex items-center justify-center w-11 h-11 -mt-3 rounded-full bg-accent text-accent-ink shadow-elev-2">
                <Icon className="w-5 h-5" strokeWidth={2.2} />
              </span>
            ) : (
              <Icon
                className={`w-[22px] h-[22px] transition-transform duration-200 ${isActive ? '-translate-y-px' : ''}`}
                strokeWidth={isActive ? 2 : 1.5}
              />
            )}
            <span className={`text-[10px] font-medium tracking-wide ${tab.elevated ? 'mt-0.5' : ''}`}>
              {t(tab.labelKey)}
            </span>
            {isActive && !tab.elevated && (
              <span className="absolute -bottom-0.5 w-5 h-[2px] rounded-full bg-accent" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
