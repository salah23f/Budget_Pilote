'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useDraftStore, draftIsResumable, summarizeDraft } from '@/lib/store/draft-store';
import { ArrowRight, X } from 'lucide-react';

/**
 * ResumeBanner — shows a single-line "continue where you left off" strip
 * at the top of the dashboard if a draft is resumable.
 *
 * Calm, not intrusive. Dismissable but not forgotten — reappears on return.
 */
export function ResumeBanner({ className = '' }: { className?: string }) {
  const draft = useDraftStore((s) => s.draft);
  const hydrate = useDraftStore((s) => s.hydrate);
  const clear = useDraftStore((s) => s.clear);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!draftIsResumable(draft)) return null;

  const summary = summarizeDraft(draft!);
  const ago = timeAgo(draft!.updatedAt);

  return (
    <div
      className={`rounded-md border border-line-1 bg-ink-800 px-4 py-3 flex items-center gap-4 ${className}`}
      role="region"
      aria-label="Resume previous work"
    >
      <div className="flex-1 min-w-0">
        <p className="text-caption text-pen-3 uppercase tracking-wider">Continue</p>
        <p className="text-body text-pen-1 truncate">{summary}</p>
      </div>
      <span className="text-caption text-pen-3 shrink-0 hidden sm:inline">{ago}</span>
      <Link
        href="/missions/new?resume=1"
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-caption text-pen-1 hover:bg-ink-700 transition"
      >
        Resume
        <ArrowRight className="w-3 h-3" strokeWidth={2} />
      </Link>
      <button
        type="button"
        onClick={() => clear()}
        className="rounded-md p-1.5 text-pen-3 hover:text-pen-1 transition"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" strokeWidth={1.8} />
      </button>
    </div>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
