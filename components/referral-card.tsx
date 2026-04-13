'use client';

import { useEffect, useState } from 'react';
import { useReferralStore } from '@/lib/store/referral-store';

/**
 * Referral card — shows the user's unique referral code with a
 * one-tap copy/share button. Designed for the dashboard.
 */
export function ReferralCard() {
  const { referralCode, referralsCount, creditsEarned, generateCode } = useReferralStore();
  const [copied, setCopied] = useState(false);

  // Auto-generate code on first render if missing
  useEffect(() => {
    if (!referralCode) {
      try {
        const stored = localStorage.getItem('sv_user');
        const name = stored ? JSON.parse(stored).firstName : undefined;
        generateCode(name);
      } catch {
        generateCode();
      }
    }
  }, [referralCode, generateCode]);

  if (!referralCode) return null;

  const shareUrl = `https://faregenie.vercel.app/?ref=${referralCode}`;
  const shareText = `I'm using Flyeas to find cheap flights with AI. Join with my code ${referralCode}!`;

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join Flyeas', text: shareText, url: shareUrl });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(245,158,11,0.05))',
        border: '1px solid rgba(139,92,246,0.15)',
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-violet-300 mb-1">
            Invite friends · earn $10
          </p>
          <p className="text-sm text-white/60 leading-relaxed">
            Share your code. When a friend signs up and books their first flight, you earn <span className="text-violet-300 font-semibold">$10 credit</span>.
          </p>

          {/* Stats */}
          <div className="flex gap-4 mt-3">
            <div>
              <p className="text-[10px] text-white/30 uppercase">Referrals</p>
              <p className="text-lg font-bold text-white">{referralsCount}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase">Earned</p>
              <p className="text-lg font-bold text-emerald-300">${creditsEarned}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          {/* Code display */}
          <div
            className="px-4 py-2 rounded-xl font-mono text-base font-bold text-white tracking-widest text-center"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px dashed rgba(139,92,246,0.3)',
              minWidth: 140,
            }}
          >
            {referralCode}
          </div>

          {/* Share / Copy button */}
          <button
            onClick={handleShare}
            className="w-full px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all"
            style={{
              background: copied
                ? 'rgba(16,185,129,0.2)'
                : 'linear-gradient(135deg, #8B5CF6, #F59E0B)',
              border: copied ? '1px solid rgba(16,185,129,0.3)' : 'none',
            }}
          >
            {copied ? '✓ Copied!' : '🔗 Invite & earn $10'}
          </button>
        </div>
      </div>
    </div>
  );
}
