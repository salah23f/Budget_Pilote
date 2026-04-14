'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/components/wallet-provider';
import { useUserStore } from '@/stores/user-store';
import { useSavingsStore } from '@/lib/store/savings-store';
import { useThemeStore } from '@/lib/store/theme-store';
import { useLocale } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
import Link from 'next/link';

type TopbarProps = {
  onMenuToggle: () => void;
};

export default function Topbar({ onMenuToggle }: TopbarProps) {
  const router = useRouter();
  const { walletAddress } = useWallet();
  const { name, unreadNotifications } = useUserStore();
  const { locale, setLocale, t } = useLocale();

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
    { label: t('pages.searchFlights'), href: '/flights', icon: '✈️' },
    { label: t('pages.searchHotels'), href: '/hotels', icon: '🏨' },
    { label: t('misc.newMission'), href: '/missions/new', icon: '🎯' },
    { label: t('misc.wallet'), href: '/wallet', icon: '💰' },
  ];

  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 px-3 py-2.5 lg:px-5 lg:py-3" style={{ background: 'rgba(12,10,9,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Hamburger */}
      <button onClick={onMenuToggle} className="lg:hidden p-2 rounded-xl hover:bg-white/5 transition" aria-label="Menu">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round">
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
      </button>

      {/* Search bar */}
      <div ref={searchRef} className="flex-1 max-w-lg relative">
        <form onSubmit={handleSearch}>
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder={t('topbar.searchPlaceholder')}
              className="w-full rounded-xl py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-all"
              style={{
                background: searchFocused ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                border: searchFocused ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.06)',
              }}
            />
          </div>
        </form>

        {/* Quick links dropdown */}
        {searchFocused && !searchQuery && (
          <div className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden shadow-2xl" style={{ background: '#1C1917', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="px-4 pt-3 pb-1.5 text-[10px] font-medium text-white/30 uppercase tracking-wider">{t('misc.quickAccess')}</p>
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setSearchFocused(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition"
              >
                <span className="text-base">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {/* Savings badge */}
        <SavingsBadge />

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notification bell */}
        <button className="relative p-2 rounded-xl hover:bg-white/5 transition" aria-label="Notifications">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2a5 5 0 00-5 5c0 4-2 5-2 5h14s-2-1-2-5a5 5 0 00-5-5z" />
            <path d="M8.5 17a1.5 1.5 0 003 0" />
          </svg>
          {unreadNotifications > 0 && (
            <span className="absolute top-1 right-1 flex items-center justify-center min-w-[15px] h-[15px] rounded-full text-[9px] font-bold text-white px-0.5" style={{ background: '#EF4444' }}>
              {unreadNotifications}
            </span>
          )}
        </button>

        {/* Wallet chip */}
        {shortAddress && (
          <button onClick={copyAddress} className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono transition hover:bg-white/5" style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.06)' }}>
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
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--flyeas-gradient, linear-gradient(135deg, #F59E0B, #EF4444))' }}>
              {name.charAt(0).toUpperCase()}
            </div>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 py-1.5 rounded-xl min-w-[180px] shadow-2xl" style={{ background: '#1C1917', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="px-4 py-2 mb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-sm font-medium text-white">{name}</p>
                <p className="text-[11px] text-white/30">{t('misc.freePlan')}</p>
              </div>
              {[
                { label: t('sidebar.settings'), href: '/settings' },
                { label: t('misc.wallet'), href: '/wallet' },
              ].map((item) => (
                <Link key={item.href} href={item.href} className="block px-4 py-2 text-[13px] text-white/60 hover:bg-white/5 hover:text-white transition" onClick={() => setUserMenuOpen(false)}>
                  {item.label}
                </Link>
              ))}
              <div className="px-4 py-2 flex items-center gap-2 text-[13px] text-white/60">
                <span className="text-white/30">Lang:</span>
                {(['en', 'fr', 'es'] as Locale[]).map((l) => (
                  <button key={l} onClick={() => setLocale(l)} className={locale === l ? 'text-amber-400 font-semibold' : 'hover:text-white'}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
              <Link href="/legal/terms" className="block px-4 py-2 text-[13px] text-white/60 hover:bg-white/5 hover:text-white transition" onClick={() => setUserMenuOpen(false)}>
                {t('misc.terms')}
              </Link>
              <div className="my-1 mx-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
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
    <div
      className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium"
      style={{
        background: 'rgba(16,185,129,0.08)',
        border: '1px solid rgba(16,185,129,0.2)',
        color: '#6ee7b7',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 13l4-4 3 3 5-6" /><path d="M10 6h4v4" />
      </svg>
      ${Math.round(totalSaved)} saved
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 10.5a7.5 7.5 0 01-10-10A7.5 7.5 0 1017.5 10.5z" />
    </svg>
  );
}

function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const toggleMode = useThemeStore((s) => s.toggleMode);

  return (
    <button
      onClick={toggleMode}
      className="p-2 rounded-xl hover:bg-white/5 transition"
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {mode === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
