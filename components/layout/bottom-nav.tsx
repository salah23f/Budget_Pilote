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
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname?.startsWith(tab.href + '/');
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(5);
              }
            }}
          >
            <span className={`bottom-nav-icon ${tab.elevated ? 'bottom-nav-elevated' : ''}`}>
              <Icon
                className={`w-[22px] h-[22px] ${tab.elevated && isActive ? 'text-white' : ''}`}
                strokeWidth={isActive ? 2.2 : 1.8}
                fill={isActive && !tab.elevated ? 'currentColor' : 'none'}
              />
            </span>
            <span className="bottom-nav-label">{tab.label}</span>
            {isActive && <span className="bottom-nav-dot" />}
          </Link>
        );
      })}
    </nav>
  );
}
