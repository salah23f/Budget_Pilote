'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/lib/store/user-store';
import { useSavingsStore } from '@/lib/store/savings-store';
import { useThemeStore } from '@/lib/store/theme-store';
import { useLocale } from '@/lib/i18n';
import { LanguagePicker } from '@/components/language-picker';
import { CurrencyPicker } from '@/components/currency-picker';
import { useIdentity } from '@/lib/store/identity-store';
import Link from 'next/link';
import {
  Menu,
  Search,
  Bell,
  Sun,
  Moon,
  TrendingUp,
  Target,
  UserCircle,
} from 'lucide-react';

type TopbarProps = {
  onMenuToggle: () => void;
};

export default function Topbar({ onMenuToggle }: TopbarProps) {
  const router = useRouter();
  const { unreadNotifications } = useUserStore();
  const { displayName, initials } = useIdentity();
  const { t } = useLocale();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const userRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchFocused(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    const lower = q.toLowerCase();
    if (lower.includes('mission') || lower.includes('monitor') || lower.includes('watch')) {
      router.push('/missions');
    } else if (lower.includes('setting') || lower.includes('account') || lower.includes('profile')) {
      router.push('/account');
    } else {
      // "Where do you want to go?" — a destination starts a mission
      router.push(`/missions/new?destination=${encodeURIComponent(q)}`);
    }
    setSearchQuery('');
    setSearchFocused(false);
  }

  const quickLinks = [
    { label: t('nav.newMission'), href: '/missions/new', icon: Target },
    { label: t('sidebar.missions'), href: '/missions', icon: Target },
    { label: t('sidebar.profile'), href: '/account', icon: UserCircle },
  ];

  return (
    <header className="topbar-glass sticky top-0 z-30 flex items-center gap-2 px-3 py-2 lg:px-5 lg:py-3">
      {/* Hamburger */}
      <button onClick={onMenuToggle} className="lg:hidden p-2.5 rounded-xl hover:bg-white/5 transition" aria-label="Menu">
        <Menu className="w-5 h-5 text-text-secondary" strokeWidth={1.8} />
      </button>

      {/* Search bar */}
      <div ref={searchRef} className="flex-1 max-w-lg relative">
        <form onSubmit={handleSearch}>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none w-4 h-4 text-text-muted" strokeWidth={1.8} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder={t('topbar.searchPlaceholder')}
              className={`w-full rounded-lg py-2 pl-10 pr-4 text-[16px] sm:text-body text-pen-1 outline-none transition-all border ${
                searchFocused
                  ? 'bg-ink-700 border-line-3'
                  : 'bg-ink-800 border-line-1'
              }`}
            />
            <kbd className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-text-muted bg-white/[0.04] border border-border-subtle">
              ⌘K
            </kbd>
          </div>
        </form>

        {/* Quick links dropdown */}
        {searchFocused && !searchQuery && (
          <div className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden shadow-xl bg-surface-elevated border border-border-default">
            <p className="px-4 pt-3 pb-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-[0.1em]">{t('misc.quickAccess')}</p>
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setSearchFocused(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-white/5 hover:text-text-primary transition"
                >
                  <Icon className="w-4 h-4 text-text-muted" strokeWidth={1.8} />
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {/* Savings badge */}
        <SavingsBadge />

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notification bell */}
        <button className="relative p-2.5 rounded-xl hover:bg-white/5 transition" aria-label="Notifications">
          <Bell className="w-[18px] h-[18px] text-text-secondary" strokeWidth={1.8} />
          {unreadNotifications > 0 && (
            <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[15px] h-[15px] rounded-full text-[9px] font-bold text-white px-0.5 bg-red-500">
              {unreadNotifications}
            </span>
          )}
        </button>

        {/* User avatar */}
        <div className="relative" ref={userRef}>
          <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center p-0.5 rounded-xl hover:bg-white/5 transition">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              {initials || 'U'}
            </div>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 py-1.5 rounded-lg w-[260px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-80px)] overflow-y-auto shadow-elev-3 bg-ink-700 border border-line-2">
              <div className="px-4 py-2 mb-1 border-b border-line-1">
                <p className="text-body font-medium text-pen-1">{displayName || 'Account'}</p>
                <p className="text-caption text-pen-3">{t('misc.freePlan')}</p>
              </div>
              {[
                { label: t('sidebar.profile'), href: '/account' },
                { label: t('sidebar.settings'), href: '/settings' },
              ].map((item) => (
                <Link key={item.href} href={item.href} className="block px-4 py-2 text-[13px] text-text-secondary hover:bg-white/5 hover:text-text-primary transition" onClick={() => setUserMenuOpen(false)}>
                  {item.label}
                </Link>
              ))}
              <div className="px-4 py-2 text-[13px] text-text-secondary">
                <span className="text-text-muted text-[11px] block mb-2">{t('misc.language')}</span>
                <LanguagePicker onSelect={() => setUserMenuOpen(false)} />
              </div>
              <div className="px-4 py-2 text-[13px] text-text-secondary">
                <span className="text-text-muted text-[11px] block mb-2">Currency</span>
                <CurrencyPicker onSelect={() => setUserMenuOpen(false)} />
              </div>
              <Link href="/legal/terms" className="block px-4 py-2 text-[13px] text-text-secondary hover:bg-white/5 hover:text-text-primary transition" onClick={() => setUserMenuOpen(false)}>
                {t('misc.terms')}
              </Link>
              <div className="my-1 mx-3 border-t border-border-subtle" />
              <button className="block w-full text-left px-4 py-2 text-[13px] text-red-400/70 hover:bg-white/5 hover:text-red-400 transition" onClick={() => { localStorage.removeItem('sv_user'); window.location.href = '/'; }}>
                {t('auth.logOut')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function SavingsBadge() {
  const totalSaved = useSavingsStore((s) => s.totalSaved);
  if (totalSaved <= 0) return null;
  return (
    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-500/8 border border-emerald-500/20 text-emerald-300">
      <TrendingUp className="w-3 h-3" strokeWidth={2} />
      ${Math.round(totalSaved)} saved
    </div>
  );
}

function ThemeToggle() {
  // Mode comes from localStorage — render the SSR-stable icon (Moon)
  // until mounted so server and client first-render markup match.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const storeMode = useThemeStore((s) => s.mode);
  const toggleMode = useThemeStore((s) => s.toggleMode);
  const mode = mounted ? storeMode : 'light';

  return (
    <button
      onClick={toggleMode}
      className="p-2.5 rounded-md hover:bg-ink-600 transition"
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {mode === 'dark' ? (
        <Sun className="w-[18px] h-[18px] text-pen-2" strokeWidth={1.8} />
      ) : (
        <Moon className="w-[18px] h-[18px] text-pen-2" strokeWidth={1.8} />
      )}
    </button>
  );
}

