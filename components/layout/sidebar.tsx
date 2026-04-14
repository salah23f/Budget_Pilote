'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUserStore } from '@/stores/user-store';
import { useStreakStore } from '@/lib/store/streak-store';

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="7" height="7" rx="1.5" />
        <rect x="11" y="2" width="7" height="7" rx="1.5" />
        <rect x="2" y="11" width="7" height="7" rx="1.5" />
        <rect x="11" y="11" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    label: 'Trip Builder',
    href: '/trip-builder',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2l2 4 4.5.7-3.3 3.2.8 4.6L10 12.4 5.9 14.5l.8-4.6-3.3-3.2L8 6z" />
      </svg>
    ),
  },
  {
    label: 'Flights',
    href: '/flights',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3L9.5 10.5M17 3L12 17L9.5 10.5M17 3L3 8L9.5 10.5" />
      </svg>
    ),
  },
  {
    label: 'Hotels',
    href: '/hotels',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17V5a2 2 0 012-2h10a2 2 0 012 2v12" />
        <path d="M1 17h18" />
        <path d="M7 7h2v2H7zM11 7h2v2h-2zM7 11h2v2H7zM11 11h2v2h-2z" />
      </svg>
    ),
  },
  {
    label: 'Cars',
    href: '/cars',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10l2-5h10l2 5" /><rect x="2" y="10" width="16" height="5" rx="1.5" /><circle cx="6" cy="15" r="1.5" /><circle cx="14" cy="15" r="1.5" />
      </svg>
    ),
  },
  {
    label: 'Missions',
    href: '/missions',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="8" />
        <circle cx="10" cy="10" r="5" />
        <circle cx="10" cy="10" r="2" />
      </svg>
    ),
  },
  {
    label: 'Favorites',
    href: '/favorites',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.37 3.84a4.58 4.58 0 00-6.48 0L10 4.73l-.89-.89a4.58 4.58 0 00-6.48 6.48l.89.89L10 17.69l6.48-6.48.89-.89a4.58 4.58 0 000-6.48z" />
      </svg>
    ),
  },
  {
    label: 'Bookings',
    href: '/bookings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2v16l3-2 3 2 3-2 3 2V2H4z" />
        <path d="M7 6h6M7 10h4" />
      </svg>
    ),
  },
  {
    label: 'Account',
    href: '/account',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="7" r="4" /><path d="M3 18c0-3.5 3.1-6 7-6s7 2.5 7 6" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="3" />
        <path d="M10 1.5v2M10 16.5v2M3.4 3.4l1.4 1.4M15.2 15.2l1.4 1.4M1.5 10h2M16.5 10h2M3.4 16.6l1.4-1.4M15.2 4.8l1.4-1.4" />
      </svg>
    ),
  },
];

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const name = useUserStore((s) => s.name);

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
          fixed top-0 left-0 z-50 h-full w-[240px] flex flex-col
          glass
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{
              background: 'var(--flyeas-gradient, var(--flyeas-gradient, linear-gradient(135deg, #F59E0B, #F97316, #EF4444)))',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
            </svg>
          </div>
          <span
            className="text-lg font-bold"
            style={{
              background: 'var(--flyeas-gradient, linear-gradient(135deg, #F59E0B, #F97316, #EF4444))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Flyeas
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <button
          type="button"
          className="mx-3 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/40 hover:text-red-400 hover:bg-red-500/5 transition-colors"
          onClick={() => {
            if (confirm('Log out of Flyeas?')) {
              localStorage.clear();
              window.location.href = '/';
            }
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Log out
        </button>

        {/* User section */}
        <div className="mx-3 mb-3 rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'var(--flyeas-gradient, linear-gradient(135deg, #F59E0B, #EF4444))' }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-white truncate">{name}</div>
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
      <div className="text-[11px] text-white/40 flex items-center gap-1">
        <span>{top.emoji}</span>
        <span className="text-amber-300/70">{top.name}</span>
        {streak > 0 && <span className="text-white/20">· {streak}🔥</span>}
      </div>
    );
  }

  return (
    <div className="text-[11px] text-white/30 flex items-center gap-1">
      Free plan
      {streak > 0 && <span>· {streak}🔥</span>}
    </div>
  );
}
