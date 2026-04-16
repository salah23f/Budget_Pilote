'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase';
import ConnectWalletButton from '@/components/connect-wallet-button';
import { useWallet } from '@/components/wallet-provider';
import { useStreakStore } from '@/lib/store/streak-store';

const greetings = [
  { text: 'Welcome', lang: 'English' },
  { text: 'Bienvenue', lang: 'Français' },
  { text: 'Willkommen', lang: 'Deutsch' },
  { text: 'Bienvenido', lang: 'Español' },
  { text: 'Benvenuto', lang: 'Italiano' },
  { text: 'Bem-vindo', lang: 'Português' },
  { text: 'Hoş geldiniz', lang: 'Türkçe' },
  { text: 'ようこそ', lang: '日本語' },
  { text: '환영합니다', lang: '한국어' },
  { text: '欢迎', lang: '中文' },
  { text: 'مرحباً', lang: 'العربية' },
  { text: 'Добро пожаловать', lang: 'Русский' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { walletAddress } = useWallet();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [gi, setGi] = useState(0);
  const [fade, setFade] = useState(true);

  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [authToken, setAuthToken] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [useSupabaseOtp, setUseSupabaseOtp] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Greetings animation
  useEffect(() => {
    if (step !== 0) return;
    const t = setInterval(() => {
      setFade(false);
      setTimeout(() => { setGi((p) => (p + 1) % greetings.length); setFade(true); }, 300);
    }, 2200);
    return () => clearInterval(t);
  }, [step]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // ── Send verification code via Resend (branded as Flyeas) ──
  async function handleSendCode() {
    if (!firstName.trim()) { setError('Please enter your name'); return; }
    if (!email.includes('@')) { setError('Please enter a valid email'); return; }
    if (!acceptedTerms) { setError('Please accept the Terms of Service and Privacy Policy'); return; }
    setError('');
    setLoading(true);

    // Log consent (GDPR compliance)
    try {
      await fetch('/api/auth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          consents: ['terms_of_service', 'privacy_policy', 'data_processing'],
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (_) {} // Non-blocking

    const trimmedEmail = email.trim().toLowerCase();

    // Try Resend first (branded "Flyeas" email)
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'email', email: trimmedEmail }),
      });
      const data = await res.json();

      if (res.ok && data.token) {
        setAuthToken(data.token);
        setUseSupabaseOtp(false);
        setCodeSent(true);
        setResendTimer(30);
        setLoading(false);
        return;
      }
    } catch (_) {} // Resend failed, try Supabase

    // Fallback: Supabase Auth OTP (works for any email)
    if (supabaseBrowser) {
      try {
        const { error: otpErr } = await supabaseBrowser.auth.signInWithOtp({
          email: trimmedEmail,
          options: { shouldCreateUser: true, data: { first_name: firstName } },
        });

        if (!otpErr) {
          setUseSupabaseOtp(true);
          setCodeSent(true);
          setResendTimer(30);
          setLoading(false);
          return;
        }
        // If both Resend and Supabase fail, let user proceed without verification
        setStep(2);
        setLoading(false);
        return;
      } catch (_) {
        // All methods failed - skip verification
        setStep(2);
        setLoading(false);
        return;
      }
    } else {
      // No email service - skip verification
      setStep(2);
    }

    setLoading(false);
  }

  // ── Resend code (simplified, skips validation) ──
  async function handleResendCode() {
    setCode('');
    setError('');
    setLoading(true);
    const trimmedEmail = email.trim().toLowerCase();

    // Try Resend first
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'email', email: trimmedEmail }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setAuthToken(data.token);
        setUseSupabaseOtp(false);
        setResendTimer(30);
        setLoading(false);
        return;
      }
    } catch (_) {}

    // Fallback: Supabase
    if (supabaseBrowser) {
      try {
        const { error: otpErr } = await supabaseBrowser.auth.signInWithOtp({
          email: trimmedEmail,
          options: { shouldCreateUser: true, data: { first_name: firstName } },
        });
        if (!otpErr) {
          setUseSupabaseOtp(true);
          setResendTimer(30);
          setLoading(false);
          return;
        }
      } catch (_) {}
    }

    setError('Failed to resend. Please try again.');
    setLoading(false);
  }

  // ── Verify code ──
  async function handleVerify() {
    if (code.length < 6) { setError('Enter your verification code'); return; }
    setError('');
    setLoading(true);

    try {
      if (useSupabaseOtp && supabaseBrowser) {
        // Verify via Supabase Auth
        const { error: verr } = await supabaseBrowser.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: code,
          type: 'email',
        });
        if (verr) { setError(verr.message); setLoading(false); return; }
      } else {
        // Verify via our HMAC token
        const res = await fetch('/api/auth/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: authToken, code }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Invalid code'); setLoading(false); return; }
      }

      setLoading(false);
      setStep(2);
    } catch (_) {
      setError('Verification failed. Try again.');
      setLoading(false);
    }
  }

  // ── Finish ──
  async function finish() {
    setLoading(true);
    setError('');
    try {
      const userData = { firstName, email, walletAddress, onboardedAt: new Date().toISOString() };

      if (supabaseBrowser) {
        const { data: { user } } = await supabaseBrowser.auth.getUser();
        if (user) {
          try {
            await supabaseBrowser.from('users').upsert({
              id: user.id, first_name: firstName, email: user.email ?? email,
              wallet_address: walletAddress, wallet_chain: walletAddress ? 'evm' : null,
              auth_method: walletAddress ? 'wallet+email' : 'email',
              primary_wallet_verified: Boolean(walletAddress),
            }, { onConflict: 'id' });
          } catch (_) { /* ignore if users table doesn't exist yet */ }
        }
      }

      localStorage.setItem('sv_user', JSON.stringify(userData));

      // Award 50 welcome bonus points on first signup (initial signup bonus —
      // onboarding completion gives another +50 on /personalize)
      const { totalPoints, addPoints } = useStreakStore.getState();
      if (totalPoints === 0) {
        addPoints(50, 'Welcome bonus');
      }

      setSuccess(true);
      // Route to the gamified personalization flow first — it drops the user
      // onto /dashboard (or /missions/new) when done.
      setTimeout(() => router.push('/personalize'), 1800);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (step === 3 && !success) finish(); }, [step]);

  // ── UI ──
  const steps = ['Account', 'Wallet', 'Done'];
  const Spinner = () => <span className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[420px]">

        {/* Step indicator */}
        {step >= 1 && step <= 2 && (
          <div className="mb-7 flex items-center justify-center">
            {steps.map((l, i) => (
              <div key={l} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all" style={{
                    background: i < step ? 'linear-gradient(135deg,#D4A24C,#F97316)' : i === step ? 'linear-gradient(135deg,#D4A24C,#EF4444)' : 'rgba(255,255,255,0.06)',
                    color: i <= step ? '#fff' : 'rgba(255,255,255,0.3)',
                    boxShadow: i === step ? '0 0 16px rgba(245,158,11,0.25)' : 'none',
                  }}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className="mt-1 text-[10px] font-medium hidden sm:block" style={{ color: i <= step ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)' }}>{l}</span>
                </div>
                {i < steps.length - 1 && <div className="mx-2.5 h-[2px] w-12 sm:w-16 rounded-full" style={{ background: i < step ? '#D4A24C' : 'rgba(255,255,255,0.06)' }} />}
              </div>
            ))}
          </div>
        )}

        {/* Card */}
        <div className="glass rounded-3xl p-7 sm:p-9">

          {/* ══ Step 0: Welcome — editorial ══ */}
          {step === 0 && (
            <div className="py-4">
              <p className="text-micro uppercase text-pen-3 mb-4">
                <span
                  className="inline-block transition-opacity duration-300"
                  style={{ opacity: fade ? 1 : 0 }}
                >
                  {greetings[gi].text} · {greetings[gi].lang}
                </span>
              </p>
              <h1 className="editorial text-[36px] sm:text-[44px] leading-[1.05] text-pen-1">
                Where will you go <em className="italic text-accent">next?</em>
              </h1>
              <p className="mt-5 text-body-lg text-pen-2 max-w-[380px]">
                Flyeas watches flight and hotel prices around the clock, so you never book on the
                wrong day again.
              </p>
              <button
                onClick={() => setStep(1)}
                className="premium-button mt-10 inline-flex items-center gap-2 rounded-md px-5 py-3 text-body font-semibold"
              >
                Begin
              </button>
              <p className="mt-4 text-caption text-pen-3">
                Takes under a minute. No credit card.
              </p>
            </div>
          )}

          {/* ══ Step 1a: Email form ══ */}
          {step === 1 && !codeSent && (
            <div>
              <h2 className="text-lg font-semibold text-white">Create your account</h2>
              <p className="mt-1 text-[13px] text-white/35">We'll send a verification code to your email.</p>

              <form onSubmit={(e) => { e.preventDefault(); handleSendCode(); }} className="mt-6 space-y-4">
                <div>
                  <label className="block text-[11px] font-medium text-white/45 mb-1.5 uppercase tracking-wider">Name</label>
                  <input className="glass-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Your first name" autoFocus />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-white/45 mb-1.5 uppercase tracking-wider">Email</label>
                  <input className="glass-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>

                {/* Consent checkbox */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-amber-500 flex-shrink-0"
                  />
                  <span className="text-[12px] text-white/40 leading-relaxed">
                    I agree to the{' '}
                    <Link href="/legal/terms" target="_blank" className="text-amber-400/70 hover:text-amber-400 underline">Terms of Service</Link>
                    {' '}and{' '}
                    <Link href="/legal/privacy" target="_blank" className="text-amber-400/70 hover:text-amber-400 underline">Privacy Policy</Link>
                  </span>
                </label>

                {error && <p className="text-[13px] text-red-400 bg-red-400/5 rounded-lg px-3 py-2">{error}</p>}

                <button type="submit" disabled={loading || !acceptedTerms} className="premium-button w-full rounded-2xl py-3.5 text-[15px] font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <><Spinner /> Sending code...</> : 'Send verification code'}
                </button>
              </form>
            </div>
          )}

          {/* ══ Step 1b: OTP verification ══ */}
          {step === 1 && codeSent && (
            <div>
              <h2 className="text-lg font-semibold text-white">Check your inbox</h2>
              <p className="mt-1 text-[13px] text-white/35">
                We sent a 6-digit code to <span className="text-white font-medium">{email}</span>
              </p>

              <form onSubmit={(e) => { e.preventDefault(); handleVerify(); }} className="mt-6 space-y-4">
                <div>
                  <label className="block text-[11px] font-medium text-white/45 mb-1.5 uppercase tracking-wider">Verification code</label>
                  <input
                    className="glass-input text-center text-xl tracking-[0.35em] font-mono"
                    type="text" inputMode="numeric" maxLength={8}
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="000000" autoFocus
                  />
                </div>

                <p className="text-[11px] text-white/25 text-center">Check your spam folder if you don't see it.</p>

                {error && <p className="text-[13px] text-red-400 bg-red-400/5 rounded-lg px-3 py-2">{error}</p>}

                <button type="submit" disabled={loading || code.length < 6} className="premium-button w-full rounded-2xl py-3.5 text-[15px] font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <><Spinner /> Verifying...</> : 'Verify & Continue'}
                </button>

                <div className="flex items-center justify-between pt-1">
                  <button type="button" onClick={() => { setCodeSent(false); setCode(''); setError(''); setResendTimer(0); }} className="text-[12px] text-white/30 hover:text-white/50 transition">
                    ← Change email
                  </button>
                  {resendTimer > 0 ? (
                    <span className="text-[12px] text-white/25">
                      Resend in {resendTimer}s
                    </span>
                  ) : (
                    <button type="button" onClick={handleResendCode} disabled={loading} className="text-[12px] text-amber-400/60 hover:text-amber-400 transition disabled:opacity-40">
                      Resend code
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* ══ Step 2: Wallet ══ */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-white">Connect wallet</h2>
              <p className="mt-1 text-[13px] text-white/35">Optional — pay with crypto.</p>

              <div className="mt-6 flex flex-col items-center rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{
                  background: walletAddress ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.08)',
                  border: walletAddress ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(245,158,11,0.15)',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={walletAddress ? '#22c55e' : '#D4A24C'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="6" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M16 14h2" />
                  </svg>
                </div>
                {walletAddress ? (
                  <div className="text-center">
                    <p className="text-[13px] font-medium text-emerald-400">Connected</p>
                    <p className="mt-0.5 text-[11px] font-mono text-white/35">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</p>
                  </div>
                ) : (
                  <p className="mb-2 text-center text-[13px] text-white/30">USDC, ETH or card</p>
                )}
                <div className="mt-2"><ConnectWalletButton /></div>
              </div>

              <div className="mt-5 flex gap-3">
                <button type="button" onClick={() => { setStep(1); setCodeSent(false); }} className="secondary-button flex-1 rounded-2xl py-3 text-[13px] font-medium">Back</button>
                <button type="button" onClick={() => setStep(3)} className="premium-button flex-[2] rounded-2xl py-3 text-[15px] font-semibold">
                  {walletAddress ? 'Continue' : 'Skip for now'}
                </button>
              </div>
            </div>
          )}

          {/* ══ Step 3: Success ══ */}
          {step === 3 && (
            <div className="flex flex-col items-center py-6">
              {success ? (
                <>
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.35)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                  </div>
                  <h2 className="text-lg font-semibold text-white">Welcome, {firstName}!</h2>
                  <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4A24C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L14.9 8.6L22 9.3L16.8 14L18.2 21L12 17.5L5.8 21L7.2 14L2 9.3L9.1 8.6L12 2Z" />
                    </svg>
                    <span className="text-[13px] font-semibold text-amber-400">You earned 50 bonus points!</span>
                  </div>
                  <p className="mt-2 text-[13px] text-white/35">Redirecting...</p>
                  <div className="mt-4 h-1 w-32 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg,#D4A24C,#F97316)', animation: 'grow 1.8s ease forwards' }} />
                  </div>
                </>
              ) : (
                <>
                  <div className="h-8 w-8 rounded-full" style={{ border: '2.5px solid rgba(245,158,11,0.25)', borderTopColor: '#D4A24C', animation: 'spin 0.7s linear infinite' }} />
                  <p className="mt-3 text-[13px] text-white/35">Setting up...</p>
                </>
              )}
              {error && (
                <div className="mt-4 text-center">
                  <p className="text-[13px] text-red-400">{error}</p>
                  <button className="mt-2 text-[12px] text-amber-400 hover:underline" onClick={() => { setStep(0); setError(''); setSuccess(false); }}>Start over</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </main>
  );
}
