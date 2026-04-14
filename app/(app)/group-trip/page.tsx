'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function GroupTripPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-8">
      <Card padding="lg" className="text-center py-16">
        <div className="max-w-sm mx-auto">
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6" style={{ background: 'rgba(139,92,246,0.12)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="7" r="4" /><circle cx="17" cy="10" r="3" />
              <path d="M2 21c0-4 3-7 7-7s7 3 7 7" /><path d="M15 21c0-3 2-5 5-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Group Trip Planner</h1>
          <p className="text-sm text-white/40 leading-relaxed mb-2">
            Invite friends, vote on destinations, and split costs — all in one place.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold mb-6" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
            Coming Soon
          </div>
          <p className="text-xs text-white/30 mb-6">
            We are building a real-time collaborative trip planner with shared itineraries, group polls, and expense splitting. Sign up for early access.
          </p>
          <Link href="/dashboard">
            <Button variant="secondary" size="md">Back to Dashboard</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
