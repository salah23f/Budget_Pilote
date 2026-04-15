'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

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
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center bg-red-500/8 border border-red-500/15">
          <AlertCircle className="w-7 h-7 text-red-400" strokeWidth={1.5} />
        </div>

        <h2 className="text-xl font-semibold font-display text-text-primary mb-2">
          We hit a turbulence
        </h2>
        <p className="text-sm text-text-muted mb-8 leading-relaxed">
          Something unexpected happened. This usually fixes itself — give it another try.
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-gradient-to-r from-accent-light to-accent-dark text-white rounded-xl px-6 py-3 text-sm font-semibold hover:shadow-glow transition-all"
          >
            Try again
          </button>
          <button
            onClick={() => (window.location.href = '/dashboard')}
            className="bg-surface-card border border-border-subtle rounded-xl px-6 py-3 text-sm font-medium text-text-secondary hover:text-text-primary hover:border-border-default transition-all"
          >
            Back to dashboard
          </button>
        </div>

        {error.digest && (
          <p className="text-[10px] text-text-muted/30 mt-8 font-mono">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
