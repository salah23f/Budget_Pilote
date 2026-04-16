'use client';

import { useEffect, useRef, useState } from 'react';
import { useSavingsStore } from '@/lib/store/savings-store';

/**
 * Savings celebration — detects when the user crosses a milestone
 * ($100, $250, $500, $1000, $2500, $5000) and shows a full-screen
 * celebration animation. The user feels accomplished and wants to
 * keep using the app to hit the next milestone.
 *
 * Mount this once in the AppShell layout. It listens to the savings
 * store and fires when totalSaved crosses a threshold.
 */

const MILESTONES = [100, 250, 500, 1000, 2500, 5000, 10000];

const MESSAGES: Record<number, { emoji: string; title: string; sub: string }> = {
  100: { emoji: '🎉', title: 'You saved $100!', sub: 'Your first milestone. The journey begins.' },
  250: { emoji: '🚀', title: '$250 saved!', sub: 'That\'s a weekend getaway in savings.' },
  500: { emoji: '*', title: '$500 saved!', sub: 'Half a flight to anywhere. Keep going!' },
  1000: { emoji: '🏆', title: '$1,000 saved!', sub: 'A thousand reasons to celebrate.' },
  2500: { emoji: '💎', title: '$2,500 saved!', sub: 'You\'re in the top 5% of smart travelers.' },
  5000: { emoji: '👑', title: '$5,000 saved!', sub: 'Travel legend status unlocked.' },
  10000: { emoji: '🌍', title: '$10,000 saved!', sub: 'You could fly around the world with those savings.' },
};

export function SavingsCelebration() {
  const totalSaved = useSavingsStore((s) => s.totalSaved);
  const prevRef = useRef(totalSaved);
  const [celebration, setCelebration] = useState<{
    emoji: string;
    title: string;
    sub: string;
    amount: number;
  } | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = totalSaved;

    // Check if we crossed a milestone
    for (const m of MILESTONES) {
      if (prev < m && totalSaved >= m) {
        const msg = MESSAGES[m];
        if (msg) {
          setCelebration({ ...msg, amount: m });
          // Auto-dismiss after 4 seconds
          setTimeout(() => setCelebration(null), 4000);
        }
        break;
      }
    }
  }, [totalSaved]);

  if (!celebration) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
      style={{ animation: 'fadeIn 0.3s ease-out' }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="relative rounded-3xl p-8 text-center max-w-sm mx-4"
        style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(16,185,129,0.1))',
          border: '1px solid rgba(245,158,11,0.3)',
          boxShadow: '0 20px 60px rgba(245,158,11,0.2)',
          animation: 'scaleIn 0.4s ease-out',
        }}
      >
        <div className="text-6xl mb-4" style={{ animation: 'bounce 0.6s ease-out' }}>
          {celebration.emoji}
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {celebration.title}
        </h2>
        <p className="text-sm text-white/60">{celebration.sub}</p>

        {/* Confetti particles */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                background: ['#E8A317', '#EF4444', '#10B981', '#8B5CF6', '#3B82F6'][i % 5],
                left: `${10 + Math.random() * 80}%`,
                top: `-5%`,
                animation: `confettiFall ${1.5 + Math.random() * 2}s ease-out ${Math.random() * 0.5}s forwards`,
              }}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
