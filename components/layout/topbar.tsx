'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/components/wallet-provider';
import { useUserStore } from '@/stores/user-store';
import { useSavingsStore } from '@/lib/store/savings-store';
import { useThemeStore } from '@/lib/store/theme-store';
import { useLocale } from '@/lib/i18n';
import { LanguagePicker } from '@/components/language-picker';
import { CurrencyPicker } from '@/components/currency-picker';
import Link from 'next/link';
import {
  Menu,
  Search,
  Bell,
  Sun,
  Moon,
  TrendingUp,
  Plane,
  Building2,
  Target,
  Wallet,
} from 'lucide-react';

type TopbarProps = {
  onMenuToggle: () => void;
};

export default function Topbar({ onMenuToggle }: TopbarProps) {
  const router = useRouter();
  const { walletAddress } = useWallet();
  const { name, unreadNotifications } = useUserStore();
  const { t } = useLocale();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const shortAddress = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : null;

  function copyAddress() {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    if (q.includes('hotel') || q.includes('stay') || q.includes('room')) {
      router.push('/hotels');
    } else if (q.includes('mission') || q.includes('monitor') || q.includes('alert')) {
      router.push('/missions');
    } else if (q.includes('wallet') || q.includes('deposit') || q.includes('pay')) {
      router.push('/wallet');
    } else if (q.includes('setting') || q.includes('account') || q.includes('profile')) {
      router.push('/settings');
    } else if (q.includes('book')) {
      router.push('/bookings');
    } else {
      router.push('/flights');
    }
    setSearchQuery('');
    setSearchFocused(false);
  }

  const quickLinks = [
    { label: t('pages.searchFlights'), href: '/flights', icon: Plane },
    { label: t('pages.searchHotels'), href: '/hotels', icon: Building2 },
    { label: t('misc.newMission'), href: '/missions/new', icon: Target },
    { label: t('misc.wallet'), href: '/wallet', icon: Wallet },
  ];

  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 px-3 py-2.5 lg:px-5 lg:py-3 bg-surface-primary/85 backdrop-blur-md border-b border-border-subtle">
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
              className={`w-full rounded-xl py-2.5 pl-10 pr-4 text-sm text-text-primary outline-none transition-all border ${
                searchFocused
                  ? 'bg-white/[0.06] border-accent/30'
                  : 'bg-surface-card border-border-subtle'
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

        {/* Wallet chip */}
        {shortAddress && (
          <button onClick={copyAddress} className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono text-text-muted border border-border-subtle transition hover:bg-white/5">
            {copied ? (
              <span className="text-emerald-400">Copied!</span>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {shortAddress}
              </>
            )}
          </button>
        )}

        {/* User avatar */}
        <div className="relative" ref={userRef}>
          <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center p-0.5 rounded-xl hover:bg-white/5 transition">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br from-accent-light to-accent-dark">
              {name.charAt(0).toUpperCase()}
            </div>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 py-1.5 rounded-xl min-w-[180px] shadow-xl bg-surface-elevated border border-border-default">
              <div className="px-4 py-2 mb-1 border-b border-border-subtle">
                <p className="text-sm font-medium text-text-primary">{name}</p>
                <p className="text-[11px] text-text-muted">{t('misc.freePlan')}</p>
              </div>
              {[
                { label: t('sidebar.settings'), href: '/settings' },
                { label: t('misc.wallet'), href: '/wallet' },
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
  const mode = useThemeStore((s) => s.mode);
  const toggleMode = useThemeStore((s) => s.toggleMode);

  return (
    <button
      onClick={toggleMode}
      className="p-2.5 rounded-xl hover:bg-white/5 transition"
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {mode === 'dark' ? (
        <Sun className="w-[18px] h-[18px] text-text-secondary" strokeWidth={1.8} />
      ) : (
        <Moon className="w-[18px] h-[18px] text-text-secondary" strokeWidth={1.8} />
      )}
    </button>
  );
}

