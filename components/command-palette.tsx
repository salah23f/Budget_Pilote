'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/lib/i18n';
import {
  LayoutGrid,
  Plane,
  Building2,
  Car,
  Target,
  Heart,
  Receipt,
  Star,
  Settings,
  Shield,
  Users,
  Map,
  Search,
  ArrowRight,
  Command,
} from 'lucide-react';

type CommandItem = {
  id: string;
  label: string;
  icon: typeof Plane;
  href: string;
  section: 'pages' | 'actions';
  keywords?: string;
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { t } = useLocale();

  const commands: CommandItem[] = useMemo(() => [
    // Pages
    { id: 'dashboard', label: t('sidebar.dashboard'), icon: LayoutGrid, href: '/dashboard', section: 'pages', keywords: 'home overview' },
    { id: 'flights', label: t('sidebar.flights'), icon: Plane, href: '/flights', section: 'pages', keywords: 'search fly airline ticket' },
    { id: 'hotels', label: t('sidebar.hotels'), icon: Building2, href: '/hotels', section: 'pages', keywords: 'stay room accommodation' },
    { id: 'cars', label: t('sidebar.cars'), icon: Car, href: '/cars', section: 'pages', keywords: 'rent rental drive' },
    { id: 'missions', label: t('sidebar.missions'), icon: Target, href: '/missions', section: 'pages', keywords: 'monitor alert ai auto' },
    { id: 'favorites', label: t('sidebar.favorites'), icon: Heart, href: '/favorites', section: 'pages', keywords: 'saved liked' },
    { id: 'bookings', label: t('sidebar.bookings'), icon: Receipt, href: '/bookings', section: 'pages', keywords: 'reservation order' },
    { id: 'rewards', label: t('sidebar.rewards'), icon: Star, href: '/rewards', section: 'pages', keywords: 'points badges streak level' },
    { id: 'insurance', label: t('sidebar.insurance'), icon: Shield, href: '/insurance', section: 'pages', keywords: 'protect coverage' },
    { id: 'group-trip', label: t('sidebar.groupTrip'), icon: Users, href: '/group-trip', section: 'pages', keywords: 'friends family share' },
    { id: 'trip-builder', label: t('sidebar.tripBuilder'), icon: Map, href: '/trip-builder', section: 'pages', keywords: 'plan itinerary' },
    { id: 'settings', label: t('sidebar.settings'), icon: Settings, href: '/settings', section: 'pages', keywords: 'preferences currency language' },
    // Actions
    { id: 'new-mission', label: t('misc.newMission'), icon: Target, href: '/missions/new', section: 'actions', keywords: 'create alert monitor price' },
    { id: 'search-flights', label: t('pages.searchFlights'), icon: Plane, href: '/flights', section: 'actions', keywords: 'find fly ticket' },
    { id: 'search-hotels', label: t('pages.searchHotels'), icon: Building2, href: '/hotels', section: 'actions', keywords: 'find stay room' },
  ], [t]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter((cmd) => {
      const searchText = `${cmd.label} ${cmd.keywords || ''}`.toLowerCase();
      return q.split(' ').every((word) => searchText.includes(word));
    });
  }, [query, commands]);

  // Group by section
  const grouped = useMemo(() => {
    const pages = filtered.filter((c) => c.section === 'pages');
    const actions = filtered.filter((c) => c.section === 'actions');
    return { pages, actions };
  }, [filtered]);

  const flatList = useMemo(() => [...grouped.pages, ...grouped.actions], [grouped]);

  // Keyboard handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Open with Cmd+K or Ctrl+K
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen((prev) => !prev);
      return;
    }

    if (!open) return;

    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flatList[selectedIndex];
      if (item) {
        router.push(item.href);
        setOpen(false);
      }
    }
  }, [open, flatList, selectedIndex, router]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  function navigate(href: string) {
    router.push(href);
    setOpen(false);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Dialog */}
      <div
        className="fixed left-1/2 top-[20%] z-[61] w-[90vw] max-w-[520px] -translate-x-1/2 rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(9,9,11,0.98)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(232,163,23,0.05)',
        }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Search className="w-5 h-5 text-white/30 shrink-0" strokeWidth={1.8} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('cmd.placeholder')}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 outline-none"
          />
          <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-white/25 bg-white/[0.04] border border-white/[0.06]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-y-auto py-2">
          {flatList.length === 0 && (
            <p className="px-5 py-6 text-center text-sm text-white/30">{t('cmd.noResults')}</p>
          )}

          {grouped.pages.length > 0 && (
            <div>
              <p className="px-5 pt-2 pb-1 text-[10px] font-semibold text-white/20 uppercase tracking-[0.1em]">
                {t('cmd.pages')}
              </p>
              {grouped.pages.map((item, idx) => {
                const Icon = item.icon;
                const globalIdx = idx;
                const isSelected = globalIdx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.href)}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                    className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                      isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-accent' : 'text-white/30'}`} strokeWidth={1.8} />
                    <span className={`text-sm flex-1 ${isSelected ? 'text-white' : 'text-white/60'}`}>{item.label}</span>
                    {isSelected && <ArrowRight className="w-3.5 h-3.5 text-white/20" strokeWidth={1.8} />}
                  </button>
                );
              })}
            </div>
          )}

          {grouped.actions.length > 0 && (
            <div>
              <p className="px-5 pt-3 pb-1 text-[10px] font-semibold text-white/20 uppercase tracking-[0.1em]">
                {t('cmd.actions')}
              </p>
              {grouped.actions.map((item, idx) => {
                const Icon = item.icon;
                const globalIdx = grouped.pages.length + idx;
                const isSelected = globalIdx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.href)}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                    className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                      isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-accent' : 'text-white/30'}`} strokeWidth={1.8} />
                    <span className={`text-sm flex-1 ${isSelected ? 'text-white' : 'text-white/60'}`}>{item.label}</span>
                    {isSelected && <ArrowRight className="w-3.5 h-3.5 text-white/20" strokeWidth={1.8} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-5 py-3 text-[10px] text-white/20" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-white/30">&uarr;</kbd>
            <kbd className="px-1 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-white/30">&darr;</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-white/30">&crarr;</kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-white/30">esc</kbd>
            close
          </span>
        </div>
      </div>
    </>
  );
}
