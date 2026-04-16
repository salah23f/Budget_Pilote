'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useUserStore } from '@/stores/user-store';

export type Notification = {
  id: string;
  type: 'price_drop' | 'booking' | 'booking_confirmed' | 'mission' | 'mission_created' | 'proposal' | 'wallet' | 'system';
  title: string;
  body: string;
  timestamp: Date;
  read: boolean;
  data?: Record<string, unknown>;
};

// Load notifications from localStorage (real events, not mocks)
const STORAGE_KEY = 'flyeas_notifications';

function loadNotifications(): Notification[] {
  if (typeof window === 'undefined') return getWelcomeNotifications();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as any[];
      if (parsed.length > 0) {
        return parsed.map((n) => ({
          ...n,
          timestamp: new Date(n.timestamp),
        }));
      }
    }
  } catch (_) {}
  return getWelcomeNotifications();
}

function saveNotifications(list: Notification[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(list.slice(-30).map((n) => ({ ...n, timestamp: n.timestamp.toISOString() })))
    );
  } catch (_) {}
}

function getWelcomeNotifications(): Notification[] {
  return [
    {
      id: 'welcome-1',
      type: 'system',
      title: 'Welcome to Flyeas',
      body: 'Your AI travel agent is ready. Create your first mission to start saving.',
      timestamp: new Date(),
      read: false,
    },
  ];
}

/**
 * Add a notification from anywhere in the app. Call this after a
 * flight search, mission status change, or booking completion.
 */
export function pushNotification(n: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
  if (typeof window === 'undefined') return;
  const existing = loadNotifications();
  const full: Notification = {
    ...n,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date(),
    read: false,
  };
  const updated = [...existing, full];
  saveNotifications(updated);
  // Dispatch a custom event so the NotificationBell re-reads
  window.dispatchEvent(new CustomEvent('flyeas:notification'));
}

function getTypeIcon(type: Notification['type']) {
  switch (type) {
    case 'mission':
    case 'mission_created':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="6" />
          <circle cx="8" cy="8" r="2" />
        </svg>
      );
    case 'price_drop':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--flyeas-accent, #D4A24C)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3L8 10 4 3" />
          <path d="M4 13h8" />
        </svg>
      );
    case 'proposal':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 2h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
          <path d="M6 5h4M6 8h4M6 11h2" />
        </svg>
      );
    case 'booking':
    case 'booking_confirmed':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="6" />
          <path d="M5.5 8l2 2 3.5-4" />
        </svg>
      );
    case 'wallet':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="12" height="9" rx="1.5" />
          <path d="M2 7h12" />
          <path d="M10 10h2" />
        </svg>
      );
    case 'system':
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="6" />
          <path d="M8 5v3M8 10.5v.5" />
        </svg>
      );
  }
}

function getTypeColor(type: Notification['type']) {
  switch (type) {
    case 'price_drop':
      return 'color-mix(in srgb, var(--flyeas-accent, #D4A24C) 12%, transparent)';
    case 'booking':
    case 'booking_confirmed':
      return 'rgba(34,197,94,0.12)';
    case 'mission':
    case 'mission_created':
      return 'color-mix(in srgb, var(--flyeas-accent, #D4A24C) 12%, transparent)';
    case 'proposal':
      return 'rgba(96,165,250,0.12)';
    case 'wallet':
      return 'rgba(167,139,250,0.12)';
    case 'system':
    default:
      return 'rgba(100,116,139,0.12)';
  }
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(() => loadNotifications());
  const ref = useRef<HTMLDivElement>(null);
  const { setUnreadNotifications } = useUserStore();

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Sync count with store
  useEffect(() => {
    setUnreadNotifications(unreadCount);
  }, [unreadCount, setUnreadNotifications]);

  // Fetch notifications from API if the user has an id
  const fetchFromApi = useCallback(async () => {
    try {
      const stored = localStorage.getItem('sv_user');
      if (!stored) return;
      const user = JSON.parse(stored);
      const userId = user.id || user.email;
      if (!userId) return;

      const res = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}&limit=20`);
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success || !json.notifications?.length) return;

      // Merge API notifications with local ones
      const apiNotifs: Notification[] = json.notifications.map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        timestamp: new Date(n.created_at),
        read: n.read ?? false,
        data: n.data,
      }));

      setNotifications((prev) => {
        const localIds = new Set(prev.map((p) => p.id));
        const newFromApi = apiNotifs.filter((a) => !localIds.has(a.id));
        if (newFromApi.length === 0) return prev;
        const merged = [...prev, ...newFromApi].sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
        );
        saveNotifications(merged);
        return merged;
      });
    } catch (_) {
      // Silently fail — local notifications still work
    }
  }, []);

  useEffect(() => {
    fetchFromApi();
  }, [fetchFromApi]);

  // Listen for new notifications pushed from other components
  useEffect(() => {
    function reload() { setNotifications(loadNotifications()); }
    window.addEventListener('flyeas:notification', reload);
    return () => window.removeEventListener('flyeas:notification', reload);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function markAllRead() {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
    // Also mark as read on the API
    notifications.filter((n) => !n.read).forEach((n) => {
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: n.id, read: true }),
      }).catch(() => {});
    });
  }

  function markRead(id: string) {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      saveNotifications(updated);
      return updated;
    });
    // Also mark as read on the API
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, read: true }),
    }).catch(() => {});
  }

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/5"
        aria-label="Notifications"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 2a5 5 0 00-5 5c0 4-2 5-2 5h14s-2-1-2-5a5 5 0 00-5-5z" />
          <path d="M8.5 17a1.5 1.5 0 003 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              boxShadow: '0 2px 8px rgba(239,68,68,0.4)',
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-2xl sm:w-96"
          style={{
            background: 'rgba(12, 10, 9, 0.97)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-medium transition-colors hover:text-amber-300"
                style={{ color: 'var(--flyeas-accent, #D4A24C)' }}
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[380px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center py-10">
                <p className="text-sm muted">No notifications yet</p>
              </div>
            ) : (
              [...notifications]
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                .map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: n.read ? 'transparent' : 'color-mix(in srgb, var(--flyeas-accent, #D4A24C) 3%, transparent)',
                  }}
                >
                  {/* Type icon */}
                  <div
                    className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: getTypeColor(n.type) }}
                  >
                    {getTypeIcon(n.type)}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className="truncate text-sm"
                        style={{
                          color: n.read ? 'rgba(255,255,255,0.6)' : 'white',
                          fontWeight: n.read ? 400 : 500,
                        }}
                      >
                        {n.title}
                      </p>
                      {!n.read && (
                        <span
                          className="h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ background: 'var(--flyeas-accent, #D4A24C)' }}
                        />
                      )}
                    </div>
                    <p
                      className="mt-0.5 truncate text-xs"
                      style={{ color: 'rgba(255,255,255,0.4)' }}
                    >
                      {n.body}
                    </p>
                    <p
                      className="mt-1 text-[10px]"
                      style={{ color: 'rgba(255,255,255,0.25)' }}
                    >
                      {timeAgo(n.timestamp)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            className="px-4 py-2.5 text-center"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <a
              href="/settings"
              className="text-xs font-medium transition-colors hover:text-amber-300"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              View all notifications
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
