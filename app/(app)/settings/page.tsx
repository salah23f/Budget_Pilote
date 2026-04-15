'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/components/wallet-provider';
import { ThemeCustomizer } from '@/components/theme-customizer';
import { requestNotificationPermission, getNotificationPermission } from '@/lib/push-notifications';

/* ── Component ────────────────────────────────────────────── */

export default function SettingsPage() {
  // Real user profile — loaded from localStorage, no hardcoded values.
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
  });

  const [prefs, setPrefs] = useState({
    currency: 'USD',
    cabin: 'economy',
    eco: 'balanced',
  });

  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    priceDrops: true,
    bookingConfirm: true,
  });

  // Real connected wallet (from WalletProvider) — no hardcoded addresses.
  const { walletAddress } = useWallet();
  const wallets = walletAddress
    ? [{ address: walletAddress, chain: 'Ethereum', primary: true }]
    : [];

  // Hydrate profile + preferences from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sv_user');
      if (stored) {
        const user = JSON.parse(stored);
        setProfile({
          name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || '',
          email: user.email || '',
          phone: user.phone || '',
        });
        if (user.preferences) {
          setPrefs((p) => ({
            ...p,
            currency: user.preferences.defaultCurrency || p.currency,
            cabin: user.preferences.cabinClass || p.cabin,
            eco: user.preferences.ecoPreference || p.eco,
          }));
        }
      }
    } catch (_) {}
  }, []);

  const handleProfileChange = (field: string, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="py-2">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">Settings</h1>
          <p className="mt-1 text-sm text-white/50">Manage your account preferences</p>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <div className="glass rounded-2xl p-6">
            <h2 className="mb-5 text-lg font-semibold">Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="label mb-1.5 block">Full Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => handleProfileChange('name', e.target.value)}
                  className="glass-input w-full"
                />
              </div>
              <div>
                <label className="label mb-1.5 block">Email</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => handleProfileChange('email', e.target.value)}
                  className="glass-input w-full"
                />
              </div>
              <div>
                <label className="label mb-1.5 block">Phone</label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => handleProfileChange('phone', e.target.value)}
                  className="glass-input w-full"
                />
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="glass rounded-2xl p-6">
            <h2 className="mb-5 text-lg font-semibold">Preferences</h2>
            <div className="space-y-4">
              <div>
                <label className="label mb-1.5 block">Default Currency</label>
                <select
                  value={prefs.currency}
                  onChange={(e) => setPrefs((p) => ({ ...p, currency: e.target.value }))}
                  className="glass-input w-full appearance-none"
                >
                  <option value="USDC">USDC</option>
                  <option value="ETH">ETH</option>
                  <option value="USD">USD (Fiat)</option>
                  <option value="EUR">EUR (Fiat)</option>
                </select>
              </div>
              <div>
                <label className="label mb-1.5 block">Preferred Cabin Class</label>
                <select
                  value={prefs.cabin}
                  onChange={(e) => setPrefs((p) => ({ ...p, cabin: e.target.value }))}
                  className="glass-input w-full appearance-none"
                >
                  <option value="economy">Economy</option>
                  <option value="premium_economy">Premium Economy</option>
                  <option value="business">Business</option>
                  <option value="first">First</option>
                </select>
              </div>
              <div>
                <label className="label mb-1.5 block">Eco Preference</label>
                <select
                  value={prefs.eco}
                  onChange={(e) => setPrefs((p) => ({ ...p, eco: e.target.value }))}
                  className="glass-input w-full appearance-none"
                >
                  <option value="price_only">Price only</option>
                  <option value="balanced">Balanced (price + carbon)</option>
                  <option value="eco_first">Eco first</option>
                </select>
              </div>
            </div>
          </div>

          {/* Theme Customizer */}
          <div className="glass rounded-2xl p-6">
            <ThemeCustomizer userTier="free" />
          </div>

          {/* Notifications */}
          <div className="glass rounded-2xl p-6">
            <h2 className="mb-5 text-lg font-semibold">Notifications</h2>
            <div className="space-y-4">
              {[
                { key: 'email', label: 'Email Alerts', desc: 'Receive price drop and booking notifications via email' },
                { key: 'push', label: 'Push Notifications', desc: 'Get real-time push alerts on your device' },
                { key: 'priceDrops', label: 'Price Drop Alerts', desc: 'Notify when a tracked flight drops below your threshold' },
                { key: 'bookingConfirm', label: 'Booking Confirmations', desc: 'Receive confirmation when an auto-buy is triggered' },
              ].map((item) => {
                const isOn = notifications[item.key as keyof typeof notifications];
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-xl p-4"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="mt-0.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isOn}
                      onClick={async () => {
                        if (item.key === 'push' && !isOn) {
                          const granted = await requestNotificationPermission();
                          if (!granted) return;
                        }
                        setNotifications((prev) => ({
                          ...prev,
                          [item.key]: !prev[item.key as keyof typeof prev],
                        }));
                      }
                      }
                      style={{
                        position: 'relative',
                        width: 44,
                        height: 24,
                        borderRadius: 12,
                        border: 'none',
                        cursor: 'pointer',
                        flexShrink: 0,
                        background: isOn
                          ? 'linear-gradient(135deg, #E8A317, #F97316)'
                          : 'rgba(255,255,255,0.12)',
                        transition: 'background 0.2s ease',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: 2,
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          background: 'white',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                          transition: 'transform 0.2s ease',
                          transform: isOn ? 'translateX(20px)' : 'translateX(0)',
                        }}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Connected Wallets */}
          <div className="glass rounded-2xl p-6">
            <h2 className="mb-5 text-lg font-semibold">Connected Wallets</h2>
            {wallets.length === 0 ? (
              <p className="text-sm text-white/40">
                No wallet connected. Connect one from the Wallet page to enable crypto deposits.
              </p>
            ) : (
              <div className="space-y-3">
                {wallets.map((w) => (
                  <div
                    key={w.address}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-mono text-sm font-medium break-all">{w.address}</p>
                        <div className="mt-1 flex gap-2">
                          <span className="badge highlight-badge text-xs">{w.chain}</span>
                          {w.primary && <span className="badge success-badge text-xs">Primary</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Data & Privacy */}
          <div className="glass rounded-2xl p-6">
            <h2 className="mb-4 text-lg font-semibold">Data & Privacy</h2>
            <div className="space-y-3">
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/user/export');
                    const data = await res.json();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'flyeas-data-export.json'; a.click();
                    URL.revokeObjectURL(url);
                  } catch (_) { alert('Export failed'); }
                }}
                className="secondary-button w-full rounded-xl px-5 py-2.5 text-sm font-medium text-left"
              >
                Export My Data (GDPR)
              </button>
              <div className="flex gap-4 text-xs text-white/30">
                <a href="/legal/terms" className="hover:text-white/50 transition">Terms of Service</a>
                <a href="/legal/privacy" className="hover:text-white/50 transition">Privacy Policy</a>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
            <h2 className="mb-2 text-lg font-semibold text-red-400">Danger Zone</h2>
            <p className="mb-4 text-sm text-white/45">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button
              onClick={async () => {
                if (!confirm('Are you sure? This will permanently delete your account and all data.')) return;
                try {
                  await fetch('/api/user/delete', { method: 'DELETE' });
                  localStorage.removeItem('sv_user');
                  window.location.href = '/';
                } catch (_) { alert('Deletion failed'); }
              }}
              className="danger-button rounded-xl px-5 py-2.5 text-sm font-semibold"
            >
              Delete Account
            </button>
          </div>

          {/* Save */}
          <div className="flex justify-end pb-8">
            <button
              onClick={() => {
                try {
                  const stored = localStorage.getItem('sv_user');
                  const user = stored ? JSON.parse(stored) : {};
                  const [firstName, ...rest] = profile.name.trim().split(/\s+/);
                  localStorage.setItem(
                    'sv_user',
                    JSON.stringify({
                      ...user,
                      firstName: firstName || user.firstName || '',
                      lastName: rest.join(' ') || user.lastName || '',
                      name: profile.name,
                      email: profile.email,
                      phone: profile.phone,
                      preferences: {
                        ...(user.preferences || {}),
                        defaultCurrency: prefs.currency,
                        cabinClass: prefs.cabin,
                        ecoPreference: prefs.eco,
                      },
                      updatedAt: new Date().toISOString(),
                    })
                  );
                  alert('Settings saved!');
                } catch (_) {
                  alert('Could not save — try again.');
                }
              }}
              className="premium-button rounded-xl px-8 py-3 text-sm font-semibold"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
