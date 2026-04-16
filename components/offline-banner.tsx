'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useLocale } from '@/lib/i18n';

/**
 * Detects when the user goes offline and shows a discreet banner at top.
 * Auto-hides when connection is restored.
 */
export function OfflineBanner() {
  const { t } = useLocale();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOffline(!navigator.onLine);

    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] px-4 py-2 text-center"
      style={{
        background: 'linear-gradient(90deg, rgba(239,68,68,0.12), rgba(249,115,22,0.12))',
        borderBottom: '1px solid rgba(239,68,68,0.25)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'flyeas-slide-up 0.25s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <p className="text-xs text-red-200 flex items-center justify-center gap-2">
        <WifiOff className="w-3.5 h-3.5" strokeWidth={1.8} />
        <span>{t('common.offline') || 'You are offline'}</span>
        <span className="text-white/40">·</span>
        <span className="text-white/50">{t('common.offlineMsg') || 'Showing cached results'}</span>
      </p>
    </div>
  );
}
