'use client';

import { useEffect, useState } from 'react';

/**
 * PWA install prompt banner.
 *
 * Shows a dismissible banner inviting the user to add Flyeas to their
 * home screen when the browser fires `beforeinstallprompt`. Falls back
 * to iOS-specific instructions for Safari users (no BIP support).
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'flyeas_pwa_dismissed';

export default function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [standalone, setStandalone] = useState(false);

  // Register Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    // Already installed? Don't show.
    const inStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      // iOS Safari
      (window.navigator as any).standalone === true;
    if (inStandalone) {
      setStandalone(true);
      return;
    }

    // Already dismissed recently?
    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (dismissedAt && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) {
        return; // Don't bug them for a week
      }
    } catch (_) {}

    // iOS detection (Safari doesn't support beforeinstallprompt)
    const ua = window.navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);
    if (ios) {
      setIsIos(true);
      // Show after a short delay so it doesn't feel spammy
      setTimeout(() => setVisible(true), 4000);
      return;
    }

    // Non-iOS: wait for the browser's install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function install() {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setVisible(false);
    } catch (_) {}
    setDeferred(null);
  }

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch (_) {}
  }

  if (!visible || standalone) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-[60] rounded-2xl p-4 fade-in"
      style={{
        background: 'rgba(12,10,9,0.96)',
        border: '1px solid color-mix(in srgb, var(--flyeas-accent, #D4A24C) 30%, transparent)',
        boxShadow: '0 20px 60px color-mix(in srgb, var(--flyeas-accent, #D4A24C) 15%, transparent)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--flyeas-gradient, linear-gradient(135deg, #D4A24C, #F97316, #EF4444))' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Install Flyeas</p>
          <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">
            {isIos
              ? 'Tap the Share button, then "Add to Home Screen" for the fastest experience.'
              : 'Add Flyeas to your home screen for instant access to real travel prices.'}
          </p>

          <div className="flex items-center gap-2 mt-3">
            {!isIos && deferred && (
              <button
                onClick={install}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'var(--flyeas-gradient, linear-gradient(135deg, #D4A24C, #F97316))', color: 'white' }}
              >
                Install
              </button>
            )}
            <button
              onClick={dismiss}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white/90 transition"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Close"
          className="text-white/30 hover:text-white/60 transition p-1 -m-1"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
