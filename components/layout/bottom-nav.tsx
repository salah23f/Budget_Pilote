'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Plane, Target, Building2, Settings } from 'lucide-react';

const tabs = [
  { label: 'Home', href: '/dashboard', icon: Home },
  { label: 'Flights', href: '/flights', icon: Plane },
  { label: 'Missions', href: '/missions', icon: Target, elevated: true },
  { label: 'Hotels', href: '/hotels', icon: Building2 },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();

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
              ${isActive ? 'text-accent' : 'text-white/30'}
              ${tab.elevated ? '' : ''}
            `}
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(5);
              }
            }}
          >
            {tab.elevated ? (
              <span className="flex items-center justify-center w-11 h-11 -mt-3 rounded-2xl bg-gradient-to-br from-accent-light to-accent-dark shadow-lg shadow-accent/20">
                <Icon
                  className="w-5 h-5 text-white"
                  strokeWidth={2}
                />
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
            {/* Active indicator — subtle line */}
            {isActive && !tab.elevated && (
              <span className="absolute -bottom-0.5 w-5 h-[2px] rounded-full bg-accent" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
