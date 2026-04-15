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
  ChevronRight,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';

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
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-[260px] flex flex-col
          bg-[#0a0a0c] border-r border-white/[0.06]
          transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-accent-light to-accent-dark">
            <Plane className="w-3.5 h-3.5 text-white" strokeWidth={2.2} />
          </div>
          <span className="text-[15px] font-bold font-display tracking-tight gradient-text">
            Flyeas
          </span>
        </div>

        {/* Separator */}
        <div className="mx-4 h-px bg-white/[0.06]" />

        {/* Navigation */}
        <nav className="flex-1 px-3 pt-4 pb-2 overflow-y-auto">
          {navSections.map((section, sectionIdx) => (
            <div key={section.label} className={sectionIdx > 0 ? 'mt-6' : ''}>
              <p className="px-3 mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-white/25">
                {section.label}
              </p>
              <div className="space-y-px">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href || pathname?.startsWith(item.href + '/');
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`
                        group relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium
                        transition-all duration-150 cursor-pointer
                        ${isActive
                          ? 'text-text-primary bg-white/[0.06]'
                          : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03]'
                        }
                      `}
                    >
                      {/* Active indicator — left bar */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-accent" />
                      )}
                      <Icon className="w-[16px] h-[16px] shrink-0" strokeWidth={isActive ? 2 : 1.6} />
                      <span className="truncate">{t(item.labelKey)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User section */}
        <div className="mx-3 mb-2 shrink-0">
          <div className="h-px bg-white/[0.06] mb-3" />

          {/* Account card */}
          <Link
            href="/account"
            className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors group"
          >
            <Avatar size="sm" fallback={name.charAt(0).toUpperCase()} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-white/80 truncate leading-tight">{name}</div>
              <SidebarBadge />
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-white/30 transition-colors shrink-0" />
          </Link>

          {/* Logout */}
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-3 py-2 mt-1 mb-1 rounded-lg text-[12px] text-white/25 hover:text-red-400/80 hover:bg-red-500/[0.04] transition-colors"
            onClick={() => {
              if (confirm('Log out of Flyeas?')) {
                localStorage.clear();
                window.location.href = '/';
              }
            }}
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.8} />
            {t('auth.logOut')}
          </button>
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
      <div className="text-[11px] text-white/30 flex items-center gap-1 leading-tight">
        <span>{top.emoji}</span>
        <span className="text-accent/60">{top.name}</span>
        {streak > 0 && <span className="text-white/15">· {streak}🔥</span>}
      </div>
    );
  }

  return (
    <div className="text-[11px] text-white/20 leading-tight">
      Free plan
      {streak > 0 && <span className="ml-1">· {streak}🔥</span>}
    </div>
  );
}
