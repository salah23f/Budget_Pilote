'use client';

import { useState } from 'react';

type NotificationType = 'price_drop' | 'booking' | 'mission' | 'wallet' | 'system';

type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: Date;
  read: boolean;
};

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    type: 'price_drop',
    title: 'Price drop detected',
    body: 'Paris CDG to NYC JFK dropped 18% to $342. This is below your auto-buy threshold.',
    timestamp: new Date(Date.now() - 1000 * 60 * 12),
    read: false,
  },
  {
    id: 'n2',
    type: 'booking',
    title: 'Auto-buy executed',
    body: 'Hotel Le Marais booked for $189/night (3 nights). Total: $567 USDC charged from your budget pool.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    read: false,
  },
  {
    id: 'n3',
    type: 'mission',
    title: 'Mission completed',
    body: 'Tokyo monitoring mission found 4 deals below your threshold. Review the results in your dashboard.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
    read: false,
  },
  {
    id: 'n4',
    type: 'wallet',
    title: 'Deposit confirmed',
    body: '500 USDC deposited to your budget pool on Base. Transaction confirmed in 3 blocks.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    read: true,
  },
  {
    id: 'n5',
    type: 'system',
    title: 'New feature available',
    body: 'Multi-city mission tracking is now live. Set up monitoring for complex itineraries.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26),
    read: true,
  },
  {
    id: 'n6',
    type: 'price_drop',
    title: 'Flight price alert',
    body: 'London LHR to Dubai DXB economy tickets at $298 -- 22% below average.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
    read: true,
  },
  {
    id: 'n7',
    type: 'booking',
    title: 'Booking confirmed',
    body: 'Your flight SFO to NRT on March 15 has been confirmed. Boarding pass available.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72),
    read: true,
  },
  {
    id: 'n8',
    type: 'wallet',
    title: 'Withdrawal processed',
    body: '200 USDC withdrawn from budget pool to your wallet. Balance remaining: $1,300.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 120),
    read: true,
  },
  {
    id: 'n9',
    type: 'system',
    title: 'Weekly travel report',
    body: 'Your weekly summary is ready: 12 flights monitored, 3 price drops detected, 1 auto-buy executed.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 168),
    read: true,
  },
];

function getTypeIcon(type: NotificationType) {
  switch (type) {
    case 'price_drop':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 3v12M5 11l4 4 4-4" />
        </svg>
      );
    case 'booking':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 9.5l3.5 3.5L14 6" />
        </svg>
      );
    case 'mission':
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="9" r="7" />
          <circle cx="9" cy="9" r="2.5" />
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
      return 'rgba(34,197,94,0.1)';
    case 'mission':
      return 'rgba(245,158,11,0.1)';
    case 'wallet':
      return 'rgba(167,139,250,0.1)';
    case 'system':
      return 'rgba(100,116,139,0.1)';
  }
}

function getTypeBorderColor(type: NotificationType) {
  switch (type) {
    case 'price_drop':
      return 'rgba(245,158,11,0.2)';
    case 'booking':
      return 'rgba(34,197,94,0.2)';
    case 'mission':
      return 'rgba(245,158,11,0.2)';
    case 'wallet':
      return 'rgba(167,139,250,0.2)';
    case 'system':
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
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filtered =
    filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;
  const groups = groupByDate(filtered);
  const unreadCount = notifications.filter((n) => !n.read).length;

  function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Notifications</h2>
          <p className="mt-1 text-sm muted">
            {unreadCount > 0
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
                    filter === f ? '#F59E0B' : 'rgba(255,255,255,0.5)',
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
                color: '#F59E0B',
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
                                background: '#F59E0B',
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
