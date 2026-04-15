'use client';

import { useState, useEffect, useCallback } from 'react';

type NotificationType =
  | 'price_drop'
  | 'booking'
  | 'booking_confirmed'
  | 'mission'
  | 'mission_created'
  | 'proposal'
  | 'wallet'
  | 'system';

type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: Date;
  read: boolean;
  data?: Record<string, unknown>;
};

// localStorage fallback
const STORAGE_KEY = 'flyeas_notifications';

function loadLocalNotifications(): Notification[] {
  if (typeof window === 'undefined') return [];
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
  return [];
}

function getTypeIcon(type: NotificationType) {
  switch (type) {
    case 'mission':
    case 'mission_created':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="9" r="7" />
          <circle cx="9" cy="9" r="2.5" />
        </svg>
      );
    case 'price_drop':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#E8A317" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 4L9 12 5 4" />
          <path d="M5 15h8" />
        </svg>
      );
    case 'proposal':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 2h8a1.5 1.5 0 011.5 1.5v11a1.5 1.5 0 01-1.5 1.5H5a1.5 1.5 0 01-1.5-1.5v-11A1.5 1.5 0 015 2z" />
          <path d="M7 6h4M7 9h4M7 12h2" />
        </svg>
      );
    case 'booking':
    case 'booking_confirmed':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="9" r="7" />
          <path d="M6 9.5l2.5 2.5L12.5 7" />
        </svg>
      );
    case 'wallet':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="14" height="10" rx="2" />
          <path d="M2 8h14" />
          <path d="M11 12h2" />
        </svg>
      );
    case 'system':
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="9" r="7" />
          <path d="M9 6v4M9 12.5v.5" />
        </svg>
      );
  }
}

function getTypeBgColor(type: NotificationType) {
  switch (type) {
    case 'price_drop':
      return 'rgba(245,158,11,0.1)';
    case 'booking':
    case 'booking_confirmed':
      return 'rgba(34,197,94,0.1)';
    case 'mission':
    case 'mission_created':
      return 'rgba(245,158,11,0.1)';
    case 'proposal':
      return 'rgba(96,165,250,0.1)';
    case 'wallet':
      return 'rgba(167,139,250,0.1)';
    case 'system':
    default:
      return 'rgba(100,116,139,0.1)';
  }
}

function getTypeBorderColor(type: NotificationType) {
  switch (type) {
    case 'price_drop':
      return 'rgba(245,158,11,0.2)';
    case 'booking':
    case 'booking_confirmed':
      return 'rgba(34,197,94,0.2)';
    case 'mission':
    case 'mission_created':
      return 'rgba(245,158,11,0.2)';
    case 'proposal':
      return 'rgba(96,165,250,0.2)';
    case 'wallet':
      return 'rgba(167,139,250,0.2)';
    case 'system':
    default:
      return 'rgba(100,116,139,0.15)';
  }
}

function groupByDate(notifications: Notification[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: Notification[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'This Week', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const n of notifications) {
    const d = n.timestamp;
    if (d >= today) {
      groups[0].items.push(n);
    } else if (d >= yesterday) {
      groups[1].items.push(n);
    } else if (d >= weekAgo) {
      groups[2].items.push(n);
    } else {
      groups[3].items.push(n);
    }
  }

  return groups.filter((g) => g.items.length > 0);
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);

  // Fetch from API and merge with local
  const fetchNotifications = useCallback(async () => {
    // Start with local notifications
    const local = loadLocalNotifications();
    setNotifications(local);
    setLoading(false);

    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('sv_user') : null;
      if (!stored) return;
      const user = JSON.parse(stored);
      const userId = user.id || user.email;
      if (!userId) return;

      const res = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}&limit=50`);
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success || !json.notifications?.length) return;

      const apiNotifs: Notification[] = json.notifications.map((n: any) => ({
        id: n.id,
        type: n.type as NotificationType,
        title: n.title,
        body: n.body,
        timestamp: new Date(n.created_at),
        read: n.read ?? false,
        data: n.data,
      }));

      // Merge: dedupe by id, sort newest first
      const localIds = new Set(local.map((l) => l.id));
      const newFromApi = apiNotifs.filter((a) => !localIds.has(a.id));
      const merged = [...local, ...newFromApi].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
      );
      setNotifications(merged);
    } catch (_) {
      // API unavailable — local notifications still shown
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Listen for local push events
  useEffect(() => {
    function reload() {
      const local = loadLocalNotifications();
      setNotifications((prev) => {
        const prevIds = new Set(prev.filter((p) => !p.id.startsWith('notif_')).map((p) => p.id));
        const apiOnly = prev.filter((p) => prevIds.has(p.id));
        const localIds = new Set(local.map((l) => l.id));
        const merged = [...local, ...apiOnly.filter((a) => !localIds.has(a.id))].sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
        );
        return merged;
      });
    }
    window.addEventListener('flyeas:notification', reload);
    return () => window.removeEventListener('flyeas:notification', reload);
  }, []);

  const filtered =
    filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;
  const groups = groupByDate(filtered);
  const unreadCount = notifications.filter((n) => !n.read).length;

  function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    // Persist to API
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, read: true }),
    }).catch(() => {});
  }

  function markAllRead() {
    const unread = notifications.filter((n) => !n.read);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    // Persist each to API
    for (const n of unread) {
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: n.id, read: true }),
      }).catch(() => {});
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Notifications</h2>
          <p className="mt-1 text-sm muted">
            {loading
              ? 'Loading notifications...'
              : unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                : 'All caught up!'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filter tabs */}
          <div
            className="flex rounded-lg p-0.5"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {(['all', 'unread'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all duration-200"
                style={{
                  background:
                    filter === f ? 'rgba(245,158,11,0.12)' : 'transparent',
                  color:
                    filter === f ? '#E8A317' : 'rgba(255,255,255,0.5)',
                }}
              >
                {f}
                {f === 'unread' && unreadCount > 0 && (
                  <span
                    className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                    style={{ background: '#ef4444' }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5"
              style={{
                color: '#E8A317',
                border: '1px solid rgba(245,158,11,0.2)',
              }}
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Grouped notifications */}
      {groups.length === 0 ? (
        <div
          className="glass flex flex-col items-center rounded-2xl py-16"
        >
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 5a10 10 0 00-10 10c0 8-4 10-4 10h28s-4-2-4-10a10 10 0 00-10-10z" />
            <path d="M17 35a3 3 0 006 0" />
          </svg>
          <p className="mt-4 text-sm muted">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              {/* Group label */}
              <h3
                className="mb-3 text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                {group.label}
              </h3>

              {/* Cards */}
              <div className="space-y-2">
                {group.items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className="flex w-full items-start gap-4 rounded-2xl p-4 text-left transition-all duration-200 hover:bg-white/[0.02]"
                    style={{
                      background: n.read
                        ? 'rgba(255,255,255,0.02)'
                        : 'rgba(245,158,11,0.03)',
                      border: n.read
                        ? '1px solid rgba(255,255,255,0.05)'
                        : '1px solid rgba(245,158,11,0.1)',
                    }}
                  >
                    {/* Icon */}
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                      style={{
                        background: getTypeBgColor(n.type),
                        border: `1px solid ${getTypeBorderColor(n.type)}`,
                      }}
                    >
                      {getTypeIcon(n.type)}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className="text-sm"
                          style={{
                            color: n.read ? 'rgba(255,255,255,0.6)' : 'white',
                            fontWeight: n.read ? 400 : 500,
                          }}
                        >
                          {n.title}
                        </p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className="text-[11px]"
                            style={{ color: 'rgba(255,255,255,0.25)' }}
                          >
                            {formatTimestamp(n.timestamp)}
                          </span>
                          {!n.read && (
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                background: '#E8A317',
                                boxShadow: '0 0 6px rgba(245,158,11,0.4)',
                              }}
                            />
                          )}
                        </div>
                      </div>
                      <p
                        className="mt-1 text-xs leading-relaxed"
                        style={{ color: 'rgba(255,255,255,0.4)' }}
                      >
                        {n.body}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
