'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  useReferralStore,
  REWARD_TIERS,
  selectCompletedReferrals,
  selectTotalCreditsEarned,
  selectCurrentTier,
  selectNextTier,
  type InviteStatus,
  type InvitedFriend,
  type RewardTier,
} from '@/lib/store/referral-store';
import { useUserStore } from '@/stores/user-store';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { PriceDisplay } from '@/components/ui/price-display';
import {
  Copy,
  Check,
  Share2,
  Mail,
  MessageCircle,
  Send,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Gift,
  Users,
  TrendingUp,
  Plus,
  Lock,
  Trophy,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────── */
/*  Social share buttons — no external SDKs, just deep links    */
/* ─────────────────────────────────────────────────────────── */

function shareLinks(code: string, name?: string) {
  const link = typeof window !== 'undefined'
    ? `${window.location.origin}/?ref=${code}`
    : `https://faregenie.vercel.app/?ref=${code}`;
  const greeting = name ? `${name} is inviting you to Flyeas` : "I'm inviting you to Flyeas";
  const msg = `${greeting} — the travel app that watches prices 24/7 and books the moment they drop. Use my code ${code} to get $10 in travel credit when you sign up: ${link}`;

  return {
    link,
    message: msg,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(msg)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(msg)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}`,
    email: `mailto:?subject=${encodeURIComponent('Join me on Flyeas — $10 travel credit inside')}&body=${encodeURIComponent(msg)}`,
  };
}

/* ─────────────────────────────────────────────────────────── */
/*  FAQ data                                                    */
/* ─────────────────────────────────────────────────────────── */

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'When do I receive the $10 credit?',
    a: 'As soon as your friend signs up AND completes their first real flight search. No booking required — we want to reward real usage, not just sign-ups.',
  },
  {
    q: 'Are there any limits?',
    a: "No hard cap. Every qualified referral earns you $10, and the tier rewards stack on top. You'll also unlock Pro / Elite months and lifetime VIP status at higher thresholds.",
  },
  {
    q: 'Can I spend credits on AI missions?',
    a: 'Yes. Credits work on any paid feature: premium missions with auto-buy, Pro subscription, or booking fees on partner platforms.',
  },
  {
    q: "What if my friend doesn't complete their first search?",
    a: "No credit is issued until they complete a real search. You'll see their status update from Pending → Signed up → Searched in real time.",
  },
  {
    q: 'Can I use it if my friend already has an account?',
    a: 'Referrals are one-time per new user. Existing users can still share the app, but credits only unlock on new sign-ups + first search.',
  },
];

/* ─────────────────────────────────────────────────────────── */
/*  Illustrations (inline SVG — premium, no assets)             */
/* ─────────────────────────────────────────────────────────── */

function AvatarConnectionIllustration() {
  return (
    <svg viewBox="0 0 240 120" className="w-full h-full" aria-hidden="true">
      <defs>
        <linearGradient id="connLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#E8A317" stopOpacity="0" />
          <stop offset="50%" stopColor="#E8A317" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="avatarGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#E8A317" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#E8A317" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Glow circles */}
      <circle cx="60" cy="60" r="45" fill="url(#avatarGlow)" />
      <circle cx="180" cy="60" r="45" fill="url(#avatarGlow)" />

      {/* Animated connecting line (dashed) */}
      <line x1="78" y1="60" x2="162" y2="60" stroke="url(#connLine)" strokeWidth="2" strokeDasharray="4 6">
        <animate attributeName="stroke-dashoffset" from="0" to="-40" dur="2s" repeatCount="indefinite" />
      </line>

      {/* Left avatar */}
      <circle cx="60" cy="60" r="22" fill="rgba(232,163,23,0.15)" stroke="rgba(232,163,23,0.5)" strokeWidth="1.5" />
      <circle cx="60" cy="53" r="7" fill="rgba(255,255,255,0.7)" />
      <path d="M 45 74 Q 60 66 75 74" stroke="rgba(255,255,255,0.7)" strokeWidth="4" fill="none" strokeLinecap="round" />

      {/* Right avatar */}
      <circle cx="180" cy="60" r="22" fill="rgba(232,163,23,0.15)" stroke="rgba(232,163,23,0.5)" strokeWidth="1.5" />
      <circle cx="180" cy="53" r="7" fill="rgba(255,255,255,0.7)" />
      <path d="M 165 74 Q 180 66 195 74" stroke="rgba(255,255,255,0.7)" strokeWidth="4" fill="none" strokeLinecap="round" />

      {/* Plane in middle */}
      <g transform="translate(120, 60)">
        <circle r="16" fill="#09090B" stroke="rgba(232,163,23,0.3)" strokeWidth="1" />
        <path d="M -8 -1 L 6 -1 L 9 -5 L 11 -5 L 9 -1 L 10 -1 L 10 1 L 9 1 L 11 5 L 9 5 L 6 1 L -5 1 L -7 4 L -9 4 L -7 1 L -8 1 Z" fill="#E8A317" transform="scale(1.05)" />
      </g>

      {/* Sparkles */}
      <circle cx="40" cy="30" r="1.5" fill="#E8A317" opacity="0.7">
        <animate attributeName="opacity" from="0.2" to="0.9" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="200" cy="90" r="1.5" fill="#E8A317" opacity="0.5">
        <animate attributeName="opacity" from="0.3" to="1" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <circle cx="120" cy="28" r="1.5" fill="#F97316" opacity="0.6">
        <animate attributeName="opacity" from="0.2" to="0.9" dur="1.2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  Main page                                                   */
/* ─────────────────────────────────────────────────────────── */

export default function ReferralPage() {
  const name = useUserStore((s) => s.name);
  const referralCode = useReferralStore((s) => s.referralCode);
  const friends = useReferralStore((s) => s.friends);
  const unlockedTiers = useReferralStore((s) => s.unlockedTiers);
  const generateCode = useReferralStore((s) => s.generateCode);
  const inviteFriend = useReferralStore((s) => s.inviteFriend);

  const [copied, setCopied] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [celebrateTier, setCelebrateTier] = useState<string | null>(null);
  const prevTiersCount = useRef(unlockedTiers.length);

  // Ensure user has a referral code
  useEffect(() => {
    if (!referralCode) generateCode(name);
  }, [referralCode, generateCode, name]);

  // Celebrate newly unlocked tiers
  useEffect(() => {
    if (unlockedTiers.length > prevTiersCount.current) {
      const newest = unlockedTiers[unlockedTiers.length - 1];
      setCelebrateTier(newest);
      setTimeout(() => setCelebrateTier(null), 2500);
    }
    prevTiersCount.current = unlockedTiers.length;
  }, [unlockedTiers]);

  const state = { friends, unlockedTiers, referralCode, referredBy: null } as any;
  const completedCount = selectCompletedReferrals(state);
  const totalEarned = selectTotalCreditsEarned(state);
  const currentTier = selectCurrentTier(state);
  const nextTier = selectNextTier(state);

  const links = useMemo(() => shareLinks(referralCode, name), [referralCode, name]);

  // Progress to next tier
  const tierProgress = useMemo(() => {
    if (!nextTier) return 100;
    const prevThreshold = currentTier?.threshold || 0;
    const span = nextTier.threshold - prevThreshold;
    const filled = completedCount - prevThreshold;
    return Math.max(0, Math.min(100, Math.round((filled / span) * 100)));
  }, [completedCount, currentTier, nextTier]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  }

  async function nativeShare() {
    if (!navigator.share) {
      await copyCode();
      return;
    }
    try {
      await navigator.share({
        title: 'Join me on Flyeas',
        text: links.message,
        url: links.link,
      });
    } catch (_) {}
  }

  function handleInvite() {
    if (!emailValue || !emailValue.includes('@')) return;
    inviteFriend({ email: emailValue });
    setEmailValue('');
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 2500);

    // Also fire-and-forget a real email if API is wired up
    fetch('/api/referral/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailValue, code: referralCode, senderName: name }),
    }).catch(() => {});
  }

  return (
    <div className="min-h-screen pb-20">
      <Breadcrumb items={[{ label: 'Home', href: '/dashboard' }, { label: 'Invite & Earn' }]} />

      {/* Celebration overlay */}
      {celebrateTier && (
        <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out_forwards]" />
          <div
            className="relative scale-in"
            style={{
              background: 'linear-gradient(135deg, #E8A317, #F97316)',
              padding: '3rem 4rem',
              borderRadius: '24px',
              boxShadow: '0 30px 80px rgba(232,163,23,0.4)',
            }}
          >
            <div className="text-center">
              <Trophy className="w-14 h-14 text-white mx-auto mb-3" strokeWidth={2} />
              <p className="text-[10px] uppercase tracking-widest text-white/80 font-semibold">Tier unlocked</p>
              <p className="text-3xl font-bold text-white mt-2">
                {REWARD_TIERS.find((t) => t.id === celebrateTier)?.title}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hero card */}
      <div
        className="rounded-3xl overflow-hidden mb-6 relative"
        style={{
          background:
            'linear-gradient(135deg, rgba(232,163,23,0.08) 0%, rgba(249,115,22,0.04) 50%, rgba(255,255,255,0.02) 100%)',
          border: '1px solid rgba(232,163,23,0.18)',
        }}
      >
        <div className="grid md:grid-cols-[1fr_320px] gap-0">
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#E8A317]">
                Invite & Earn
              </span>
              <span className="h-1 w-1 rounded-full bg-[#E8A317]/50" />
              <span className="text-[10px] uppercase tracking-widest text-white/40">No limit</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-bold text-white tracking-tight leading-tight">
              Invite friends,<br />
              earn <span style={{ background: 'linear-gradient(135deg,#E8A317,#F97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>real rewards</span>.
            </h1>
            <p className="text-sm text-white/55 mt-3 max-w-md leading-relaxed">
              You get <span className="text-white font-semibold">$10 in travel credits</span> for every friend who joins and makes their first search.
              Unlock Pro, Elite, and lifetime VIP as your tribe grows.
            </p>

            <div className="flex items-center gap-5 mt-6">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/30">Friends invited</p>
                <p className="text-3xl font-bold text-white mt-0.5 tabular-nums">{friends.length}</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/30">Credits earned</p>
                <div className="mt-0.5">
                  <PriceDisplay usd={totalEarned} size="2xl" color="#E8A317" />
                </div>
              </div>
              <div className="w-px h-10 bg-white/10 hidden md:block" />
              <div className="hidden md:block">
                <p className="text-[10px] uppercase tracking-widest text-white/30">Current tier</p>
                <p className="text-lg font-bold text-white mt-0.5">
                  {currentTier?.title || 'Newcomer'}
                </p>
              </div>
            </div>
          </div>
          <div className="relative px-6 pb-6 md:p-6 md:flex md:items-center">
            <AvatarConnectionIllustration />
          </div>
        </div>
      </div>

      {/* Share card — the money shot */}
      <div
        className="rounded-3xl p-6 md:p-8 mb-8"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-widest text-white/35 mb-2">Your unique code</p>
          <div className="inline-flex items-center gap-3 md:gap-4">
            <button
              onClick={copyCode}
              className="group relative flex items-center gap-3 rounded-2xl px-5 md:px-7 py-4 text-2xl md:text-4xl font-mono font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, rgba(232,163,23,0.12), rgba(249,115,22,0.06))',
                border: '1px dashed rgba(232,163,23,0.4)',
                letterSpacing: '0.08em',
              }}
              aria-label="Copy referral code"
            >
              {referralCode || '------'}
              <span
                className="flex items-center justify-center h-9 w-9 rounded-xl transition-all"
                style={{
                  background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                  border: copied ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" strokeWidth={2.5} />
                ) : (
                  <Copy className="w-4 h-4 text-white/50" strokeWidth={1.8} />
                )}
              </span>
            </button>
          </div>
          <p className="text-[11px] text-white/35 mt-3">
            Tap to copy — share on any channel below
          </p>
        </div>

        {/* Social share grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-6 max-w-2xl mx-auto">
          <ShareButton
            href={links.whatsapp}
            label="WhatsApp"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4 0 1.4 1 2.8 1.2 3 .2.2 2 3.1 5 4.4.7.3 1.3.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.5-.3zM12 2.2C6.5 2.2 2.2 6.5 2.2 12c0 1.8.5 3.4 1.3 4.8L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.4 0 9.8-4.4 9.8-9.8S17.4 2.2 12 2.2z" />
              </svg>
            }
            color="#25D366"
          />
          <ShareButton
            href={links.telegram}
            label="Telegram"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.505.505 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            }
            color="#0088cc"
          />
          <ShareButton
            href={links.twitter}
            label="X / Twitter"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            }
            color="#FFFFFF"
            dark
          />
          <ShareButton
            href={links.email}
            label="Email"
            icon={<Mail className="w-4 h-4" strokeWidth={1.8} />}
            color="#60a5fa"
          />
          <button
            onClick={nativeShare}
            className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition hover:bg-white/[0.04]"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <span
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, #E8A317, #F97316)',
              }}
            >
              <Share2 className="w-4 h-4 text-white" strokeWidth={2} />
            </span>
            <span className="text-[10px] text-white/60">More</span>
          </button>
        </div>

        {/* Direct email invite */}
        <div className="mt-6 max-w-md mx-auto">
          <div className="flex gap-2">
            <input
              type="email"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              placeholder="friend@example.com"
              className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-[rgba(232,163,23,0.3)]"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            />
            <button
              onClick={handleInvite}
              disabled={!emailValue || !emailValue.includes('@')}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40"
              style={{
                background: emailSent
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : 'linear-gradient(135deg, #E8A317, #F97316)',
                color: 'white',
              }}
            >
              {emailSent ? (
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4" strokeWidth={2.5} /> Sent
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Send className="w-4 h-4" strokeWidth={2} /> Invite
                </span>
              )}
            </button>
          </div>
          <p className="text-[10px] text-white/25 text-center mt-2">
            We&apos;ll send them a beautifully formatted invite with your code pre-applied.
          </p>
        </div>
      </div>

      {/* Reward Tiers */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-[#E8A317]" strokeWidth={1.8} /> Reward tiers
            </h2>
            <p className="text-xs text-white/40 mt-0.5">Unlock progressively bigger rewards as your network grows</p>
          </div>
          {nextTier && (
            <div className="hidden md:flex items-center gap-2 text-[11px] text-white/50">
              <span>{nextTier.threshold - completedCount} friends to <strong className="text-[#E8A317]">{nextTier.title}</strong></span>
            </div>
          )}
        </div>

        {/* Progress bar to next tier */}
        {nextTier && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-[10px] text-white/40 mb-1.5">
              <span>
                {currentTier?.title || 'Newcomer'} — {completedCount}/{nextTier.threshold}
              </span>
              <span className="font-mono">{tierProgress}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${tierProgress}%`,
                  background: 'linear-gradient(90deg, #E8A317, #F97316)',
                  boxShadow: '0 0 10px rgba(232,163,23,0.3)',
                }}
              />
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {REWARD_TIERS.map((tier) => {
            const isUnlocked = completedCount >= tier.threshold;
            const isCurrent = currentTier?.id === tier.id;
            return (
              <TierCard
                key={tier.id}
                tier={tier}
                unlocked={isUnlocked}
                current={isCurrent}
                completedCount={completedCount}
              />
            );
          })}
        </div>
      </div>

      {/* Your invited friends */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-white/50" strokeWidth={1.8} /> Your invites
          {friends.length > 0 && (
            <span className="text-[11px] font-normal text-white/30">· {friends.length} total</span>
          )}
        </h2>

        {friends.length === 0 ? (
          <EmptyFriends onInvite={() => document.querySelector('input[type=email]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
        ) : (
          <div className="space-y-2">
            {friends.slice().reverse().map((f) => (
              <FriendRow key={f.id} friend={f} />
            ))}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">How it works</h2>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { step: 1, title: 'Share your code', desc: 'Send your unique code to friends by any channel — WhatsApp, email, social, or the link.' },
            { step: 2, title: 'Friend signs up + searches', desc: 'They join Flyeas with your code and complete their first flight or hotel search.' },
            { step: 3, title: 'Both get rewarded', desc: 'You earn $10 travel credit instantly. Your friend gets a welcome bonus. Tiers unlock with more invites.' },
          ].map((s) => (
            <div
              key={s.step}
              className="rounded-2xl p-5"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-[#E8A317] mb-3"
                style={{
                  background: 'rgba(232,163,23,0.1)',
                  border: '1px solid rgba(232,163,23,0.2)',
                }}
              >
                {s.step}
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{s.title}</h3>
              <p className="text-xs text-white/50 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Social proof strip */}
      <div
        className="rounded-2xl p-5 mb-8 flex items-center justify-between gap-4 flex-wrap"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {['#E8A317', '#F97316', '#10b981', '#60a5fa', '#a78bfa'].map((c, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full border-2"
                style={{
                  background: c,
                  borderColor: '#09090B',
                  opacity: 0.8 + i * 0.04,
                }}
              />
            ))}
            <div
              className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold text-white"
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderColor: '#09090B',
              }}
            >
              +
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">12,450+ travelers invited</p>
            <p className="text-[11px] text-white/40">and counting this month</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-emerald-300/80">
          <TrendingUp className="w-3.5 h-3.5" strokeWidth={2} />
          Highest earner this month: <span className="font-semibold text-emerald-300">$3,200 in credits</span>
        </div>
      </div>

      {/* FAQ */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">FAQ</h2>
        <div className="space-y-2">
          {FAQ.map((item, i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden transition-colors"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition"
              >
                <span className="text-sm text-white/85 font-medium">{item.q}</span>
                {openFaq === i ? (
                  <ChevronUp className="w-4 h-4 text-white/40 shrink-0" strokeWidth={1.8} />
                ) : (
                  <ChevronDown className="w-4 h-4 text-white/40 shrink-0" strokeWidth={1.8} />
                )}
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 pt-1 text-xs text-white/55 leading-relaxed">{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Back */}
      <div className="text-center">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8L10 4" />
          </svg>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  Sub-components                                              */
/* ─────────────────────────────────────────────────────────── */

function ShareButton({
  href,
  label,
  icon,
  color,
  dark = false,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  dark?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition hover:bg-white/[0.04]"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <span
        className="flex items-center justify-center w-8 h-8 rounded-lg"
        style={{
          background: dark ? 'rgba(255,255,255,0.08)' : `${color}20`,
          color: color,
          border: dark ? '1px solid rgba(255,255,255,0.15)' : `1px solid ${color}40`,
        }}
      >
        {icon}
      </span>
      <span className="text-[10px] text-white/60">{label}</span>
    </a>
  );
}

function TierCard({
  tier,
  unlocked,
  current,
  completedCount,
}: {
  tier: RewardTier;
  unlocked: boolean;
  current: boolean;
  completedCount: number;
}) {
  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden transition-all"
      style={{
        background: unlocked
          ? 'linear-gradient(135deg, rgba(232,163,23,0.08), rgba(249,115,22,0.04))'
          : 'rgba(255,255,255,0.02)',
        border: unlocked
          ? '1px solid rgba(232,163,23,0.25)'
          : '1px solid rgba(255,255,255,0.05)',
        opacity: unlocked ? 1 : 0.6,
      }}
    >
      {current && (
        <span
          className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
          style={{
            background: 'linear-gradient(135deg, #E8A317, #F97316)',
            color: 'white',
          }}
        >
          Current
        </span>
      )}

      <div className="flex items-center justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: unlocked
              ? 'linear-gradient(135deg, #E8A317, #F97316)'
              : 'rgba(255,255,255,0.04)',
            border: unlocked ? 'none' : '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {unlocked ? (
            <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
          ) : (
            <Lock className="w-4 h-4 text-white/30" strokeWidth={1.8} />
          )}
        </div>
        <span className="text-[10px] uppercase tracking-widest text-white/30 font-mono">
          {tier.threshold} {tier.threshold === 1 ? 'friend' : 'friends'}
        </span>
      </div>

      <h3 className="text-base font-bold text-white mb-1">{tier.title}</h3>
      <p className="text-[11px] text-white/45 mb-3">{tier.description}</p>

      <div className="space-y-1 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-[#E8A317]">+</span>
          <PriceDisplay usd={tier.creditUsd} size="sm" />
          <span className="text-white/50">travel credits</span>
        </div>
        {tier.proMonthsBonus && (
          <div className="flex items-center gap-2 text-white/65">
            <span className="text-[#E8A317]">+</span>
            {tier.proMonthsBonus} month{tier.proMonthsBonus > 1 ? 's' : ''} Pro free
          </div>
        )}
        {tier.eliteMonthsBonus && (
          <div className="flex items-center gap-2 text-white/65">
            <span className="text-[#E8A317]">+</span>
            {tier.eliteMonthsBonus} months Elite
          </div>
        )}
        {tier.vipLifetime && (
          <div className="flex items-center gap-2 text-white/65">
            <span className="text-[#E8A317]">+</span>
            Lifetime VIP status
          </div>
        )}
        {tier.badgeName && (
          <div className="flex items-center gap-2 text-white/65">
            <span className="text-[#E8A317]">+</span>
            &quot;{tier.badgeName}&quot; badge
          </div>
        )}
      </div>

      {!unlocked && (
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-[10px] text-white/35">
            {tier.threshold - completedCount} more to unlock
          </p>
        </div>
      )}
    </div>
  );
}

function FriendRow({ friend }: { friend: InvitedFriend }) {
  const statusConfig: Record<InviteStatus, { label: string; color: string }> = {
    pending: { label: 'Pending signup', color: '#9ca3af' },
    signed_up: { label: 'Signed up', color: '#60a5fa' },
    searched: { label: 'Earned $10', color: '#10b981' },
    booked: { label: 'Booked + earned', color: '#E8A317' },
  };
  const cfg = statusConfig[friend.status];
  const initial = (friend.name || friend.email || '?').charAt(0).toUpperCase();

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl transition hover:bg-white/[0.02]"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
        style={{
          background: 'linear-gradient(135deg, rgba(232,163,23,0.3), rgba(249,115,22,0.2))',
        }}
      >
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/85 truncate">
          {friend.name || friend.email?.replace(/(^.{3}).*(@.*$)/, '$1***$2') || 'Anonymous'}
        </p>
        <p className="text-[10px] text-white/35">
          Invited {new Date(friend.invitedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </p>
      </div>
      <span
        className="px-2.5 py-1 rounded-full text-[10px] font-semibold shrink-0"
        style={{
          background: `${cfg.color}15`,
          color: cfg.color,
          border: `1px solid ${cfg.color}30`,
        }}
      >
        {cfg.label}
      </span>
      {friend.creditEarned > 0 && (
        <PriceDisplay usd={friend.creditEarned} size="sm" color="#10b981" />
      )}
    </div>
  );
}

function EmptyFriends({ onInvite }: { onInvite: () => void }) {
  return (
    <div
      className="rounded-2xl p-8 text-center"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px dashed rgba(255,255,255,0.08)',
      }}
    >
      <div
        className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
        style={{
          background: 'linear-gradient(135deg, rgba(232,163,23,0.15), rgba(249,115,22,0.08))',
          border: '1px solid rgba(232,163,23,0.2)',
        }}
      >
        <Plus className="w-6 h-6 text-[#E8A317]" strokeWidth={1.8} />
      </div>
      <p className="text-sm font-semibold text-white">Invite your first friend</p>
      <p className="text-xs text-white/40 mt-1 mb-4">Earn $10 when they make their first search</p>
      <button
        onClick={onInvite}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition"
        style={{
          background: 'linear-gradient(135deg, #E8A317, #F97316)',
          color: 'white',
        }}
      >
        <Send className="w-3.5 h-3.5" strokeWidth={2} />
        Send an invite
      </button>
    </div>
  );
}
