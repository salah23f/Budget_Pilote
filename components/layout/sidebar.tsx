'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUserStore } from '@/stores/user-store';
import { useStreakStore } from '@/lib/store/streak-store';
import { useLocale } from '@/lib/i18n';
import {
  LayoutGrid,
  Map,
  Plane,
  Building2,
  Car,
  Users,
  Target,
  Heart,
  Receipt,
  Star,
  UserCircle,
  Settings,
  LogOut,
} from 'lucide-react';

const navSections = [
  {
    label: 'Travel',
    items: [
      { labelKey: 'sidebar.dashboard', href: '/dashboard', icon: LayoutGrid },
      { labelKey: 'sidebar.tripBuilder', href: '/trip-builder', icon: Map },
      { labelKey: 'sidebar.flights', href: '/flights', icon: Plane },
      { labelKey: 'sidebar.hotels', href: '/hotels', icon: Building2 },
      { labelKey: 'sidebar.cars', href: '/cars', icon: Car },
      { labelKey: 'sidebar.groupTrip', href: '/group-trip', icon: Users },
    ],
  },
  {
    label: 'AI',
    items: [
      { labelKey: 'sidebar.missions', href: '/missions', icon: Target },
      { labelKey: 'sidebar.favorites', href: '/favorites', icon: Heart },
      { labelKey: 'sidebar.bookings', href: '/bookings', icon: Receipt },
    ],
  },
  {
    label: 'You',
    items: [
      { labelKey: 'sidebar.rewards', href: '/rewards', icon: Star },
      { labelKey: 'sidebar.account', href: '/account', icon: UserCircle },
      { labelKey: 'sidebar.settings', href: '/settings', icon: Settings },
    ],
  },
];

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const name = useUserStore((s) => s.name);
  const { t } = useLocale();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-[260px] flex flex-col
          bg-surface-primary border-r border-border-subtle
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-accent-light to-accent-dark">
            <Plane className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold font-display gradient-text">
            Flyeas
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-1 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.label} className="mb-3">
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href || pathname?.startsWith(item.href + '/');
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                    >
                      <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                      <span>{t(item.labelKey)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Logout */}
        <button
          type="button"
          className="mx-3 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-red-400 hover:bg-red-500/5 transition-colors"
          onClick={() => {
            if (confirm('Log out of Flyeas?')) {
              localStorage.clear();
              window.location.href = '/';
            }
          }}
        >
          <LogOut className="w-3.5 h-3.5" strokeWidth={2} />
          {t('auth.logOut')}
        </button>

        {/* User section */}
        <div className="mx-3 mb-3 rounded-xl p-3 flex items-center gap-3 bg-surface-card border border-border-subtle">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-gradient-to-br from-accent-light to-accent-dark">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-text-primary truncate">{name}</div>
            <SidebarBadge />
          </div>
        </div>
      </aside>
    </>
  );
}

function SidebarBadge() {
  const badges = useStreakStore((s) => s.badges);
  const streak = useStreakStore((s) => s.currentStreak);
  const top = badges.length > 0 ? badges[badges.length - 1] : null;

  if (top) {
    return (
      <div className="text-[11px] text-text-muted flex items-center gap-1">
        <span>{top.emoji}</span>
        <span className="text-accent-light/70">{top.name}</span>
        {streak > 0 && <span className="text-text-muted/50">· {streak}🔥</span>}
      </div>
    );
  }

  return (
    <div className="text-[11px] text-text-muted flex items-center gap-1">
      Free plan
      {streak > 0 && <span>· {streak}🔥</span>}
    </div>
  );
}
