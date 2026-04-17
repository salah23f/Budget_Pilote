'use client';

import { useState, useEffect } from 'react';

/**
 * Cookie consent banner — GDPR compliance.
 * Stores the user's choice in localStorage so it only shows once.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('flyeas_cookie_consent');
    if (!consent) {
      // Show after a short delay so it doesn't flash on first paint
      const t = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  function accept() {
    localStorage.setItem('flyeas_cookie_consent', 'accepted');
    setVisible(false);
  }

  function decline() {
    localStorage.setItem('flyeas_cookie_consent', 'declined');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-[9998] rounded-2xl p-5 shadow-2xl"
      style={{
        background: 'rgba(28, 25, 23, 0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <p className="text-sm text-white/70 mb-3 leading-relaxed">
        We use cookies to improve your experience and analyze traffic. No tracking, no ads — just essential functionality.
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={accept}
          className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--flyeas-gradient, linear-gradient(135deg, #D4A24C, #EF4444))' }}
        >
          Accept
        </button>
        <button
          onClick={decline}
          className="px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white border border-white/10 transition"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
