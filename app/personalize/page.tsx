'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStreakStore } from '@/lib/store/streak-store';
import { useReferralStore } from '@/lib/store/referral-store';
import { useUserStore } from '@/stores/user-store';
import {
  Backpack,
  Briefcase,
  Users,
  Crown,
  MapPin,
  Sparkles,
  Check,
  ArrowRight,
  ArrowLeft,
  Plane,
  Heart,
} from 'lucide-react';

/**
 * Gamified post-auth personalization — 3 steps + celebration.
 * Awards 50 bonus points on completion and routes to dashboard.
 */

type TravelStyle = 'backpacker' | 'business' | 'family' | 'luxury';

const TRAVEL_STYLES: Array<{
  id: TravelStyle;
  title: string;
  subtitle: string;
  icon: typeof Backpack;
  gradient: string;
  description: string;
}> = [
  {
    id: 'backpacker',
    title: 'Backpacker',
    subtitle: 'Budget-first, adventure everywhere',
    icon: Backpack,
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    description: "We'll prioritize the cheapest flights, hostels & hidden gems",
  },
  {
    id: 'business',
    title: 'Business',
    subtitle: 'Fast, reliable, no-nonsense',
    icon: Briefcase,
    gradient: 'linear-gradient(135deg, #60a5fa, #2563eb)',
    description: "We'll prioritize direct flights, quality hotels & flexibility",
  },
  {
    id: 'family',
    title: 'Family',
    subtitle: 'Safe, fun, the whole tribe',
    icon: Users,
    gradient: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
    description: "We'll prioritize family-friendly hotels, reasonable connections & kid-ready activities",
  },
  {
    id: 'luxury',
    title: 'Luxury',
    subtitle: 'First class, five stars, nothing less',
    icon: Crown,
    gradient: 'linear-gradient(135deg, #E8A317, #F97316)',
    description: "We'll prioritize business class, 5-star hotels & private transfers",
  },
];

const DREAM_DESTINATIONS = [
  { city: 'Paris', country: 'France', x: 49, y: 34, emoji: '🇫🇷' },
  { city: 'Tokyo', country: 'Japan', x: 83, y: 43, emoji: '🇯🇵' },
  { city: 'New York', country: 'USA', x: 27, y: 40, emoji: '🇺🇸' },
  { city: 'Bali', country: 'Indonesia', x: 79, y: 66, emoji: '🇮🇩' },
  { city: 'Dubai', country: 'UAE', x: 62, y: 47, emoji: '🇦🇪' },
  { city: 'Barcelona', country: 'Spain', x: 48, y: 39, emoji: '🇪🇸' },
  { city: 'Rome', country: 'Italy', x: 52, y: 40, emoji: '🇮🇹' },
  { city: 'Istanbul', country: 'Turkey', x: 56, y: 40, emoji: '🇹🇷' },
  { city: 'Marrakech', country: 'Morocco', x: 45, y: 45, emoji: '🇲🇦' },
  { city: 'Cape Town', country: 'South Africa', x: 54, y: 74, emoji: '🇿🇦' },
  { city: 'Rio', country: 'Brazil', x: 34, y: 69, emoji: '🇧🇷' },
  { city: 'Singapore', country: 'Singapore', x: 77, y: 60, emoji: '🇸🇬' },
  { city: 'Seoul', country: 'South Korea', x: 81, y: 43, emoji: '🇰🇷' },
  { city: 'Sydney', country: 'Australia', x: 86, y: 72, emoji: '🇦🇺' },
  { city: 'Mumbai', country: 'India', x: 68, y: 52, emoji: '🇮🇳' },
];

const STORAGE_KEY = 'flyeas_personalization';

export default function PersonalizePage() {
  const router = useRouter();
  const addPoints = useStreakStore((s) => s.addPoints);
  const generateReferralCode = useReferralStore((s) => s.generateCode);
  const userName = useUserStore((s) => s.name);
  const setUserName = useUserStore((s) => s.setName);

  const [step, setStep] = useState(0);
  const [style, setStyle] = useState<TravelStyle | null>(null);
  const [destinations, setDestinations] = useState<string[]>([]);
  const [missionIntent, setMissionIntent] = useState<'create' | 'later' | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [resolvedName, setResolvedName] = useState(userName || '');
  const totalSteps = 3;

  // Skip if user already completed personalization; also rehydrate name from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.completed) router.replace('/dashboard');
      }
      if (!resolvedName) {
        const savedUser = localStorage.getItem('sv_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed.firstName) {
            setResolvedName(parsed.firstName);
            setUserName(parsed.firstName);
          }
        }
      }
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function toggleDestination(city: string) {
    setDestinations((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    );
  }

  function goNext() {
    if (step < totalSteps - 1) setStep(step + 1);
    else finish();
  }

  function goBack() {
    if (step > 0) setStep(step - 1);
  }

  async function finish() {
    // Persist choices
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          completed: true,
          style,
          destinations,
          missionIntent,
          completedAt: new Date().toISOString(),
        })
      );
    } catch (_) {}

    // Award bonus points
    addPoints(50, 'Onboarding completed');

    // Generate referral code now that we know the name
    generateReferralCode(resolvedName);

    // Celebrate
    setCelebrating(true);

    setTimeout(() => {
      if (missionIntent === 'create') {
        router.push('/missions/new');
      } else {
        router.push('/dashboard');
      }
    }, 2200);
  }

  const canProceed =
    (step === 0 && style !== null) ||
    (step === 1 && destinations.length > 0) ||
    (step === 2 && missionIntent !== null);

  return (
    <div className="min-h-screen flex flex-col bg-[#09090B]">
      {/* Celebration overlay */}
      {celebrating && <CelebrationOverlay />}

      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-40 h-0.5 bg-white/5">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${((step + 1) / totalSteps) * 100}%`,
            background: 'linear-gradient(90deg, #E8A317, #F97316)',
          }}
        />
      </div>

      {/* Header */}
      <div className="px-5 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: 'linear-gradient(135deg, #E8A317, #F97316)' }}
          >
            <Plane className="w-3.5 h-3.5 text-white" strokeWidth={2.2} />
          </div>
          <span className="text-sm font-bold text-white">Flyeas</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-white/40">
          <span>Step {step + 1} of {totalSteps}</span>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-4xl">
          {step === 0 && (
            <StepTravelStyle
              userName={resolvedName}
              selected={style}
              onSelect={setStyle}
            />
          )}
          {step === 1 && (
            <StepDestinations
              style={style}
              selected={destinations}
              onToggle={toggleDestination}
            />
          )}
          {step === 2 && (
            <StepFirstMission
              destinations={destinations}
              intent={missionIntent}
              onSelect={setMissionIntent}
            />
          )}
        </div>
      </div>

      {/* Footer navigation */}
      <div className="px-5 py-6 flex items-center justify-between max-w-4xl mx-auto w-full">
        <button
          onClick={goBack}
          disabled={step === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition disabled:opacity-0 disabled:pointer-events-none"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.8} />
          Back
        </button>

        <button
          onClick={goNext}
          disabled={!canProceed}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: canProceed
              ? 'linear-gradient(135deg, #E8A317, #F97316)'
              : 'rgba(255,255,255,0.06)',
            color: canProceed ? 'white' : 'rgba(255,255,255,0.4)',
          }}
        >
          {step === totalSteps - 1 ? "Let's go" : 'Continue'}
          <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  Step 1: Travel Style                                        */
/* ────────────────────────────────────────────────────────── */

function StepTravelStyle({
  userName,
  selected,
  onSelect,
}: {
  userName: string;
  selected: TravelStyle | null;
  onSelect: (s: TravelStyle) => void;
}) {
  return (
    <div>
      <div className="text-center mb-10">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#E8A317] font-semibold mb-3">
          1 of 3 · About you
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
          Hey {userName || 'there'}, how do you travel?
        </h1>
        <p className="text-sm text-white/50 mt-3 max-w-lg mx-auto">
          Pick the closest match — we&apos;ll tune everything (prices, hotels, recommendations) to your vibe.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {TRAVEL_STYLES.map((t) => {
          const Icon = t.icon;
          const isSelected = selected === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={`group relative rounded-2xl p-5 text-left transition-all ${
                isSelected ? 'scale-[1.02]' : 'hover:-translate-y-1'
              }`}
              style={{
                background: isSelected
                  ? 'rgba(232,163,23,0.08)'
                  : 'rgba(255,255,255,0.02)',
                border: isSelected
                  ? '1px solid rgba(232,163,23,0.4)'
                  : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl mb-4 transition-transform group-hover:scale-110"
                style={{ background: t.gradient }}
              >
                <Icon className="w-5 h-5 text-white" strokeWidth={1.8} />
              </div>
              <p className="text-base font-bold text-white">{t.title}</p>
              <p className="text-xs text-white/55 mt-1">{t.subtitle}</p>
              {isSelected && (
                <div className="mt-3 pt-3 flex items-start gap-2" style={{ borderTop: '1px solid rgba(232,163,23,0.2)' }}>
                  <Sparkles className="w-3.5 h-3.5 text-[#E8A317] shrink-0 mt-0.5" strokeWidth={1.8} />
                  <p className="text-[11px] text-white/65 leading-relaxed">{t.description}</p>
                </div>
              )}
              {isSelected && (
                <div
                  className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full"
                  style={{ background: 'linear-gradient(135deg, #E8A317, #F97316)' }}
                >
                  <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  Step 2: Dream Destinations                                  */
/* ────────────────────────────────────────────────────────── */

function StepDestinations({
  style: _style,
  selected,
  onToggle,
}: {
  style: TravelStyle | null;
  selected: string[];
  onToggle: (city: string) => void;
}) {
  return (
    <div>
      <div className="text-center mb-8">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#E8A317] font-semibold mb-3">
          2 of 3 · Your wishlist
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
          Where do you dream of going?
        </h1>
        <p className="text-sm text-white/50 mt-3 max-w-lg mx-auto">
          Pick as many as you like — we&apos;ll watch prices on every route and ping you when they drop.
        </p>
      </div>

      {/* Map with clickable pins */}
      <div
        className="rounded-2xl p-5 mb-6 relative"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <svg viewBox="0 0 100 80" className="w-full h-auto" aria-hidden="true">
          <defs>
            <radialGradient id="pinSelected" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#E8A317" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#E8A317" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Sparse continent dots */}
          {continentDots().map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r="0.35" fill="rgba(255,255,255,0.08)" />
          ))}

          {/* Destination pins */}
          {DREAM_DESTINATIONS.map((d) => {
            const isSelected = selected.includes(d.city);
            return (
              <g key={d.city} style={{ cursor: 'pointer' }} onClick={() => onToggle(d.city)}>
                {isSelected && <circle cx={d.x} cy={d.y} r="3" fill="url(#pinSelected)" />}
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={isSelected ? 1.5 : 1}
                  fill={isSelected ? '#E8A317' : 'rgba(255,255,255,0.5)'}
                  stroke={isSelected ? 'white' : 'transparent'}
                  strokeWidth="0.3"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* City grid — clickable chips */}
      <div className="flex flex-wrap justify-center gap-2">
        {DREAM_DESTINATIONS.map((d) => {
          const isSelected = selected.includes(d.city);
          return (
            <button
              key={d.city}
              onClick={() => onToggle(d.city)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full text-sm transition-all"
              style={{
                background: isSelected
                  ? 'linear-gradient(135deg, rgba(232,163,23,0.15), rgba(249,115,22,0.08))'
                  : 'rgba(255,255,255,0.03)',
                border: isSelected
                  ? '1px solid rgba(232,163,23,0.4)'
                  : '1px solid rgba(255,255,255,0.08)',
                color: isSelected ? 'white' : 'rgba(255,255,255,0.55)',
              }}
            >
              <MapPin className="w-3.5 h-3.5" strokeWidth={isSelected ? 2 : 1.5} />
              {d.city}
              {isSelected && (
                <Check className="w-3.5 h-3.5 text-[#E8A317]" strokeWidth={2.5} />
              )}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <p className="text-xs text-white/50 text-center mt-6">
          <span className="text-[#E8A317] font-semibold">{selected.length}</span> destination{selected.length > 1 ? 's' : ''} selected · we&apos;ll start watching prices
        </p>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  Step 3: First mission intent                                */
/* ────────────────────────────────────────────────────────── */

function StepFirstMission({
  destinations,
  intent,
  onSelect,
}: {
  destinations: string[];
  intent: 'create' | 'later' | null;
  onSelect: (i: 'create' | 'later') => void;
}) {
  const topDest = destinations[0] || 'Paris';

  return (
    <div>
      <div className="text-center mb-10">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#E8A317] font-semibold mb-3">
          3 of 3 · Your first mission
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
          Ready to unleash the AI?
        </h1>
        <p className="text-sm text-white/50 mt-3 max-w-xl mx-auto">
          AI missions watch prices 24/7 across 400+ airlines and auto-book the moment your target hits.
          Set one up for <span className="text-white font-semibold">{topDest}</span> — or skip and explore first.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-3 max-w-3xl mx-auto">
        {/* Create mission */}
        <button
          onClick={() => onSelect('create')}
          className="group relative rounded-2xl p-6 text-left transition-all hover:-translate-y-0.5"
          style={{
            background: intent === 'create'
              ? 'linear-gradient(135deg, rgba(232,163,23,0.12), rgba(249,115,22,0.06))'
              : 'rgba(255,255,255,0.02)',
            border: intent === 'create'
              ? '1px solid rgba(232,163,23,0.4)'
              : '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl mb-4"
            style={{ background: 'linear-gradient(135deg, #E8A317, #F97316)' }}
          >
            <Sparkles className="w-5 h-5 text-white" strokeWidth={1.8} />
          </div>
          <p className="text-base font-bold text-white">Create my first mission</p>
          <p className="text-xs text-white/55 mt-1 leading-relaxed">
            Pick a destination, set a target price, and let the AI do the rest.
          </p>
          <div className="flex items-center gap-1.5 mt-4 text-[11px] text-[#E8A317] font-medium">
            <Plane className="w-3 h-3" strokeWidth={2} />
            Opens the mission wizard
          </div>
          {intent === 'create' && (
            <div
              className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full"
              style={{ background: 'linear-gradient(135deg, #E8A317, #F97316)' }}
            >
              <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
            </div>
          )}
        </button>

        {/* Explore first */}
        <button
          onClick={() => onSelect('later')}
          className="group relative rounded-2xl p-6 text-left transition-all hover:-translate-y-0.5"
          style={{
            background: intent === 'later'
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(255,255,255,0.02)',
            border: intent === 'later'
              ? '1px solid rgba(255,255,255,0.2)'
              : '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl mb-4"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <Heart className="w-5 h-5 text-white/70" strokeWidth={1.8} />
          </div>
          <p className="text-base font-bold text-white">Let me explore first</p>
          <p className="text-xs text-white/55 mt-1 leading-relaxed">
            Take me to the dashboard. I&apos;ll set up a mission when I&apos;m ready.
          </p>
          <div className="flex items-center gap-1.5 mt-4 text-[11px] text-white/50 font-medium">
            <ArrowRight className="w-3 h-3" strokeWidth={2} />
            Straight to the dashboard
          </div>
          {intent === 'later' && (
            <div
              className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
            </div>
          )}
        </button>
      </div>

      <p className="text-center text-[11px] text-white/30 mt-6">
        Either way, you&apos;ll earn{' '}
        <span className="text-[#E8A317] font-semibold">+50 bonus points</span> for completing onboarding.
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  Celebration overlay                                         */
/* ────────────────────────────────────────────────────────── */

function CelebrationOverlay() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.25s_ease-out_forwards]" />
      <div
        className="relative scale-in"
        style={{
          background: 'linear-gradient(135deg, #E8A317 0%, #F97316 100%)',
          padding: '3rem 4rem',
          borderRadius: '28px',
          boxShadow: '0 40px 100px rgba(232,163,23,0.5)',
        }}
      >
        {/* Confetti sparkles */}
        {[...Array(12)].map((_, i) => {
          const angle = (i / 12) * 360;
          const dist = 80 + Math.random() * 40;
          const x = Math.cos((angle * Math.PI) / 180) * dist;
          const y = Math.sin((angle * Math.PI) / 180) * dist;
          return (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                left: '50%',
                top: '50%',
                background: i % 2 === 0 ? '#fef3c7' : '#fff',
                transform: `translate(${x}px, ${y}px)`,
                animation: `flyeas-confetti-burst 1.6s ease-out ${i * 0.04}s forwards`,
                opacity: 0,
              }}
            />
          );
        })}
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.25)' }}
          >
            <Sparkles className="w-8 h-8 text-white" strokeWidth={2} />
          </div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/80 font-semibold">
            Welcome aboard
          </p>
          <p className="text-3xl font-bold text-white mt-2">+50 points</p>
          <p className="text-sm text-white/80 mt-1">Your journey starts now</p>
        </div>
      </div>
    </div>
  );
}

function continentDots(): Array<{ x: number; y: number }> {
  const dots: Array<{ x: number; y: number }> = [];
  const regions = [
    { x: 10, y: 35, w: 18, h: 20 },
    { x: 27, y: 60, w: 10, h: 20 },
    { x: 44, y: 28, w: 15, h: 15 },
    { x: 48, y: 45, w: 15, h: 25 },
    { x: 60, y: 28, w: 30, h: 25 },
    { x: 80, y: 65, w: 12, h: 10 },
  ];
  for (const r of regions) {
    for (let i = r.x; i < r.x + r.w; i += 1.5) {
      for (let j = r.y; j < r.y + r.h; j += 1.5) {
        if (Math.sin(i * 0.3) + Math.cos(j * 0.4) > -0.3) {
          dots.push({ x: i, y: j });
        }
      }
    }
  }
  return dots;
}
