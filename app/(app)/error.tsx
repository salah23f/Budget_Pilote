'use client';

import { useEffect } from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Flyeas Error]', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.2)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-sm text-white/40 mb-6 leading-relaxed">
          An unexpected error occurred. This has been logged and we are looking into it.
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="premium-button rounded-xl px-6 py-3 text-sm font-semibold text-white"
          >
            Try Again
          </button>
          <button
            onClick={() => (window.location.href = '/dashboard')}
            className="glass rounded-xl px-6 py-3 text-sm font-medium text-white/60 hover:text-white transition"
          >
            Go Home
          </button>
        </div>

        {error.digest && (
          <p className="text-[10px] text-white/15 mt-6 font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
