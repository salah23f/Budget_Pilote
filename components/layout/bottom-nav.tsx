'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/lib/i18n';
import { Home, Plane, Target, Building2, Settings } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useLocale();

  const tabs = [
    { label: t('sidebar.dashboard'), href: '/dashboard', icon: Home },
    { label: t('sidebar.flights'), href: '/flights', icon: Plane },
    { label: t('sidebar.missions'), href: '/missions', icon: Target, elevated: true },
    { label: t('sidebar.hotels'), href: '/hotels', icon: Building2 },
    { label: t('sidebar.settings'), href: '/settings', icon: Settings },
  ];

  return (
    <nav className="bottom-nav" role="tablist">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname?.startsWith(tab.href + '/');
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
              -webkit-tap-highlight-color-transparent
              ${isActive ? 'text-accent' : 'text-pen-3'}
              ${tab.elevated ? '' : ''}
            `}
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(5);
              }
            }}
          >
            {tab.elevated ? (
              <span className="flex items-center justify-center w-11 h-11 -mt-3 rounded-xl" style={{ background: 'var(--accent)', color: 'var(--ink-950)' }}>
                <Icon className="w-5 h-5" strokeWidth={2} />
              </span>
            ) : (
              <Icon
                className={`w-[22px] h-[22px] transition-transform duration-200 ${isActive ? '-translate-y-px' : ''}`}
                strokeWidth={isActive ? 2 : 1.5}
                fill={isActive ? 'currentColor' : 'none'}
              />
            )}
            <span className={`text-[10px] font-medium tracking-wide ${tab.elevated ? 'mt-0.5' : ''}`}>
              {tab.label}
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
