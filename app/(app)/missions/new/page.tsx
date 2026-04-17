'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AirportInput, type AirportSelection } from '@/components/ui/airport-input';
import { HotelDestinationInput, type HotelDestination } from '@/components/ui/hotel-destination-input';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type MissionType = 'flight' | 'hotel' | 'package';

type PaymentRailUi = 'stripe' | 'wallet';

interface FormState {
  // Step 1
  type: MissionType;
  // Payment rail selection (Step 3)
  paymentRail: PaymentRailUi;
  // Flight fields
  origin: string;
  originSkyId: string;
  originEntityId: string;
  destination: string;
  destinationSkyId: string;
  destinationEntityId: string;
  // Hotel fields
  hotelDestination: string;
  hotelEntityId: string;
  // Dates
  departDate: string;
  returnDate: string;
  checkIn: string;
  checkOut: string;
  passengers: number;
  rooms: number;
  // Step 2
  cabinClass: string;
  stopsPreference: string;
  ecoPreference: string;
  preferredAirlines: string;
  // Car rental (package)
  includeCar: boolean;
  carType: string;
  carMaxPerDay: number;
  // Insurance (package)
  includeInsurance: boolean;
  insurancePlan: string;
  // Step 3
  maxBudget: number;
  autoBuyEnabled: boolean;
  autoBuyThreshold: number;
  budgetPoolDeposit: number;
  monitoringFrequency: string;
  emailAlerts: boolean;
}

const STEPS = ['Trip Details', 'Preferences', 'Budget & Auto-Buy'];

function defaultDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

/* ------------------------------------------------------------------ */
/*  Trip Type Selector                                                 */
/* ------------------------------------------------------------------ */

interface TripOption {
  value: MissionType;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

const TRIP_OPTIONS: TripOption[] = [
  {
    value: 'flight',
    title: 'Flight Only',
    subtitle: 'Track and auto-book flights',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </svg>
    ),
  },
  {
    value: 'hotel',
    title: 'Hotel Only',
    subtitle: 'Track and auto-book hotels',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 22V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14" />
        <path d="M1 22h22" />
        <path d="M7 10h1M11 10h1M15 10h1M7 14h1M11 14h1M15 14h1M7 18h1M11 18h1M15 18h1" />
      </svg>
    ),
  },
  {
    value: 'package',
    title: 'Flight + Hotel',
    subtitle: 'Complete trip as one package',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.5 7.3 12 2 3.5 7.3v9.4L12 22l8.5-5.3z" />
        <path d="M12 22V12M3.5 7.3 12 12l8.5-4.7" />
      </svg>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function NewMissionPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [form, setForm] = useState<FormState>({
    type: 'flight',
    paymentRail: 'stripe',
    origin: '',
    originSkyId: '',
    originEntityId: '',
    destination: '',
    destinationSkyId: '',
    destinationEntityId: '',
    hotelDestination: '',
    hotelEntityId: '',
    departDate: defaultDate(30),
    returnDate: defaultDate(37),
    checkIn: defaultDate(30),
    checkOut: defaultDate(37),
    passengers: 1,
    rooms: 1,
    cabinClass: 'economy',
    stopsPreference: 'any',
    ecoPreference: 'balanced',
    preferredAirlines: '',
    maxBudget: 0,
    autoBuyEnabled: false,
    autoBuyThreshold: 0,
    budgetPoolDeposit: 0,
    includeCar: false,
    carType: 'economy',
    carMaxPerDay: 0,
    includeInsurance: false,
    insurancePlan: 'standard',
    monitoringFrequency: 'every_3h',
    emailAlerts: true,
  });

  // AI advisory state — computed from real market data when user reaches step 3
  const [marketInsight, setMarketInsight] = useState<{
    loading: boolean;
    cheapest?: number;
    average?: number;
    count?: number;
    error?: string;
    kind?: 'flight' | 'hotel';
  }>({ loading: false });

  // When user reaches step 3 with enough info, fetch a real price preview.
  // This is advisory — we never overwrite the user's budget.
  useEffect(() => {
    if (step !== 2) return;
    if (marketInsight.cheapest !== undefined && !marketInsight.error) return; // already fetched

    const canFlight =
      (form.type === 'flight' || form.type === 'package') &&
      form.origin && form.destination && form.departDate;
    const canHotel =
      form.type === 'hotel' && form.hotelEntityId && form.checkIn && form.checkOut;

    if (!canFlight && !canHotel) return;

    let cancelled = false;
    setMarketInsight({ loading: true });

    const run = async () => {
      try {
        if (canFlight) {
          const res = await fetch('/api/flights/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              origin: form.originSkyId || form.origin,
              destination: form.destinationSkyId || form.destination,
              departDate: form.departDate,
              returnDate: form.returnDate || undefined,
              adults: form.passengers,
              cabinClass: form.cabinClass,
              originSkyId: form.originSkyId || undefined,
              originEntityId: form.originEntityId || undefined,
              destSkyId: form.destinationSkyId || undefined,
              destEntityId: form.destinationEntityId || undefined,
            }),
          });
          const data = await res.json();
          if (cancelled) return;
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            const prices: number[] = data.data.map((d: any) => d.priceUsd).filter((p: number) => p > 0);
            const cheapest = Math.min(...prices);
            const average = Math.round(prices.reduce((s: number, p: number) => s + p, 0) / prices.length);
            setMarketInsight({ loading: false, cheapest, average, count: prices.length, kind: 'flight' });
          } else {
            setMarketInsight({ loading: false, error: data.error || 'No live data available for this route right now.', kind: 'flight' });
          }
        } else if (canHotel) {
          const res = await fetch('/api/hotels/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entityId: form.hotelEntityId,
              query: form.hotelDestination,
              checkIn: form.checkIn,
              checkOut: form.checkOut,
              adults: form.passengers,
              rooms: form.rooms,
            }),
          });
          const data = await res.json();
          if (cancelled) return;
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            const prices: number[] = data.data.map((d: any) => d.priceUsd).filter((p: number) => p > 0);
            const cheapest = Math.min(...prices);
            const average = Math.round(prices.reduce((s: number, p: number) => s + p, 0) / prices.length);
            setMarketInsight({ loading: false, cheapest, average, count: prices.length, kind: 'hotel' });
          } else {
            setMarketInsight({ loading: false, error: data.error || 'No live data available for this destination.', kind: 'hotel' });
          }
        }
      } catch (e: any) {
        if (!cancelled) setMarketInsight({ loading: false, error: e?.message || 'Price preview unavailable.' });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function update(partial: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function validateStep(s: number): string[] {
    const errs: string[] = [];
    if (s === 0) {
      if (form.type === 'flight' || form.type === 'package') {
        if (!form.origin) errs.push('Please pick an origin airport.');
        if (!form.destination) errs.push('Please pick a destination airport.');
        if (!form.departDate) errs.push('Please set a departure date.');
      }
      if (form.type === 'hotel' || form.type === 'package') {
        if (!form.hotelDestination && form.type === 'hotel') errs.push('Please pick a hotel destination.');
        if (!form.checkIn) errs.push('Please set a check-in date.');
        if (!form.checkOut) errs.push('Please set a check-out date.');
      }
    }
    return errs;
  }

  function next() {
    const errs = validateStep(step);
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    if (step < 2) setStep(step + 1);
  }

  function back() {
    setErrors([]);
    if (step > 0) setStep(step - 1);
  }

  async function handleSubmit() {
    const errs = validateStep(0);
    if (errs.length > 0) {
      setErrors(errs);
      setStep(0);
      return;
    }
    if (form.maxBudget <= 0) {
      setErrors(['Please enter a maximum budget greater than $0.']);
      return;
    }
    if (form.autoBuyEnabled) {
      if (form.autoBuyThreshold <= 0) {
        setErrors(['Auto-buy is on — please set a threshold greater than $0.']);
        return;
      }
      if (form.autoBuyThreshold > form.maxBudget) {
        setErrors(['Auto-buy threshold must be lower than your maximum budget.']);
        return;
      }
    }
    setSubmitting(true);
    setErrors([]);

    try {
      const payload: any = {
        type: form.type,
        cabinClass: form.cabinClass,
        stopsPreference: form.stopsPreference,
        ecoPreference: form.ecoPreference,
        preferredAirlines: form.preferredAirlines
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        maxBudgetUsd: form.maxBudget,
        autoBuyThresholdUsd: form.autoBuyEnabled ? form.autoBuyThreshold : undefined,
        budgetDepositedUsd: form.autoBuyEnabled ? form.budgetPoolDeposit : 0,
        monitoringEnabled: true,
        alertEmailEnabled: form.emailAlerts,
        passengers: form.passengers,
      };

      if (form.type === 'flight' || form.type === 'package') {
        payload.origin = form.originSkyId || form.origin;
        payload.originCity = form.origin;
        payload.destination = form.destinationSkyId || form.destination;
        payload.destinationCity = form.destination;
        payload.departDate = form.departDate;
        payload.returnDate = form.returnDate || undefined;
      }
      if (form.type === 'hotel' || form.type === 'package') {
        payload.hotelEntityId = form.hotelEntityId;
        payload.hotelDestination = form.hotelDestination;
        payload.checkIn = form.checkIn;
        payload.checkOut = form.checkOut;
        payload.rooms = form.rooms;
      }

      // Car rental (package missions)
      if (form.includeCar) {
        payload.packageIncludes = [...(payload.packageIncludes || []), 'car'];
        payload.carPickupLocation = form.destination || form.hotelDestination;
        payload.carPickupDate = form.departDate || form.checkIn;
        payload.carDropoffDate = form.returnDate || form.checkOut;
        payload.carType = form.carType;
        payload.carMaxPerDay = form.carMaxPerDay || undefined;
      }

      // Insurance
      if (form.includeInsurance) {
        payload.packageIncludes = [...(payload.packageIncludes || []), 'insurance'];
        payload.insurancePlan = form.insurancePlan;
        payload.insuranceIncluded = true;
      }

      // Set packageIncludes for flight/hotel base
      if (form.type === 'package' || form.includeCar || form.includeInsurance) {
        const includes: string[] = [];
        if (form.type === 'flight' || form.type === 'package') includes.push('flight');
        if (form.type === 'hotel' || form.type === 'package') includes.push('hotel');
        if (form.includeCar) includes.push('car');
        if (form.includeInsurance) includes.push('insurance');
        payload.packageIncludes = includes;
        if (includes.length > 1) payload.type = 'package';
      }

      // Route through the payment-enabled create endpoint. This one
      // actually reserves funds (Stripe hold OR on-chain escrow) — the
      // legacy /api/mission only did a price search without a hold.
      payload.paymentRail = form.paymentRail;

      // The wallet rail needs the user's address. If Privy is
      // connected at form time, read it from the Privy wallets list.
      // The pay page will re-check and prompt connect if missing.
      try {
        const privy = (window as any).__privyLastWallet;
        if (form.paymentRail === 'wallet' && privy) {
          payload.walletAddress = privy;
        }
      } catch (_) {}

      const res = await fetch('/api/missions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create mission');
      }

      // Cache the rail-specific payload so the /pay page can pick it up
      // without us re-hitting the API (the Stripe client secret in
      // particular is only returned ONCE at creation time).
      try {
        sessionStorage.setItem(
          `flyeas:mission:${data.mission.id}:pay`,
          JSON.stringify({
            mission: data.mission,
            stripe: data.stripe,
            wallet: data.wallet,
          })
        );
      } catch (_) {}

      setSubmitted(true);
      setTimeout(
        () => router.push(`/missions/${data.mission.id}/pay`),
        1200
      );
    } catch (err: any) {
      setErrors([err.message || 'Failed to create mission']);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-8 fade-in">
        <Card padding="lg" className="text-center">
          <div className="flex flex-col items-center gap-5 py-8">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #10b981, #D4A24C)' }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 16l6 6L24 10" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Mission Launched</h2>
              <p className="text-white/50 mt-2 text-sm">Your AI agent is now monitoring prices for the best deals.</p>
              <p className="text-white/30 mt-1 text-xs">Redirecting to missions...</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const showFlight = form.type === 'flight' || form.type === 'package';
  const showHotel = form.type === 'hotel' || form.type === 'package';

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8 fade-in">
      {/* Header */}
      <div className="mb-6">
        <Badge variant="highlight">New Mission</Badge>
        <h1 className="text-2xl font-bold text-white mt-3 tracking-tight">Configure Your Booking Agent</h1>
        <p className="text-sm text-white/50 mt-1">Set up an AI agent to find and book the best travel deals for you.</p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  i < step
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : i === step
                    ? 'text-white border-2 border-amber-400'
                    : 'text-white/30 border border-white/10'
                }`}
                style={i === step ? { background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.15))' } : {}}
              >
                {i < step ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 7l3 3L11 4" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className={`text-sm hidden sm:inline ${i === step ? 'text-white font-medium' : 'text-white/40'}`}>{label}</span>
              {i < STEPS.length - 1 && (
                <div className={`hidden sm:block w-16 lg:w-24 h-px mx-2 ${i < step ? 'bg-emerald-500/40' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${((step + 1) / STEPS.length) * 100}%`,
              background: 'linear-gradient(90deg, #D4A24C, #F97316, #EF4444)',
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Form area */}
        <Card padding="lg">
          {/* Step 1: Trip Details */}
          {step === 0 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-white">Trip Details</h2>

              {/* Visual trip type selector */}
              <div>
                <label className="block text-xs font-medium text-white/50 mb-2">What do you want to book?</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {TRIP_OPTIONS.map((opt) => {
                    const active = form.type === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => update({ type: opt.value })}
                        className="relative text-left rounded-xl p-4 transition-all duration-200"
                        style={{
                          background: active
                            ? 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(239,68,68,0.12))'
                            : 'rgba(255,255,255,0.02)',
                          border: active
                            ? '1px solid rgba(245,158,11,0.5)'
                            : '1px solid rgba(255,255,255,0.06)',
                          boxShadow: active ? '0 0 0 3px rgba(245,158,11,0.08)' : undefined,
                        }}
                      >
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${active ? 'text-amber-300' : 'text-white/40'}`}
                          style={{
                            background: active ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
                          }}
                        >
                          {opt.icon}
                        </div>
                        <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-white/80'}`}>
                          {opt.title}
                        </p>
                        <p className="text-xs text-white/40 mt-0.5">{opt.subtitle}</p>
                        {active && (
                          <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #D4A24C, #F97316)' }}>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 5l2 2 4-4" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Flight section */}
              {showFlight && (
                <div className="space-y-4 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-300">✈</span>
                    <h3 className="text-sm font-semibold text-white/80">Flight</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AirportInput
                      label="Origin"
                      placeholder="From airport..."
                      value={form.origin}
                      onChange={(sel: AirportSelection) =>
                        update({ origin: sel.code, originSkyId: sel.skyId, originEntityId: sel.entityId })
                      }
                    />
                    <AirportInput
                      label="Destination"
                      placeholder="To airport..."
                      value={form.destination}
                      onChange={(sel: AirportSelection) =>
                        update({ destination: sel.code, destinationSkyId: sel.skyId, destinationEntityId: sel.entityId })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Departure Date" type="date" value={form.departDate} onChange={(e) => update({ departDate: e.target.value })} />
                    <Input label="Return Date (optional)" type="date" value={form.returnDate} onChange={(e) => update({ returnDate: e.target.value })} />
                  </div>
                  <Input label="Passengers" type="number" min={1} max={9} value={form.passengers} onChange={(e) => update({ passengers: Number(e.target.value) })} />
                </div>
              )}

              {/* Hotel section */}
              {showHotel && (
                <div className="space-y-4 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-300">Hotel</span>
                    <h3 className="text-sm font-semibold text-white/80">Hotel</h3>
                  </div>
                  {form.type === 'hotel' && (
                    <HotelDestinationInput
                      label="Destination"
                      placeholder="City, neighborhood, hotel..."
                      value={form.hotelDestination}
                      onChange={(sel: HotelDestination) => update({ hotelDestination: sel.name, hotelEntityId: sel.entityId })}
                    />
                  )}
                  {form.type === 'package' && (
                    <p className="text-xs text-white/40">Hotel destination will use your flight destination city.</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Check-in" type="date" value={form.checkIn} onChange={(e) => update({ checkIn: e.target.value })} />
                    <Input label="Check-out" type="date" value={form.checkOut} onChange={(e) => update({ checkOut: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Guests" type="number" min={1} max={10} value={form.passengers} onChange={(e) => update({ passengers: Number(e.target.value) })} />
                    <Input label="Rooms" type="number" min={1} max={5} value={form.rooms} onChange={(e) => update({ rooms: Number(e.target.value) })} />
                  </div>
                </div>
              )}

              {/* Car rental add-on */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.includeCar}
                    onChange={(e) => update({ includeCar: e.target.checked })}
                    className="w-5 h-5 rounded accent-amber-400"
                  />
                  <div>
                    <span className="text-sm font-semibold text-white flex items-center gap-2">
                      + Add car rental
                    </span>
                    <p className="text-xs text-white/35">Monitor car prices at your destination</p>
                  </div>
                </label>
                {form.includeCar && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs text-white/50 mb-1.5">Car type</label>
                      <select
                        value={form.carType}
                        onChange={(e) => update({ carType: e.target.value })}
                        className="glass-input w-full rounded-xl py-2.5 px-3 text-sm"
                      >
                        <option value="economy">Economy</option>
                        <option value="compact">Compact</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="suv">SUV</option>
                        <option value="premium">Premium</option>
                        <option value="minivan">Minivan</option>
                      </select>
                    </div>
                    <Input
                      label="Max price per day (USD)"
                      type="number"
                      placeholder="e.g. 40"
                      min={0}
                      value={form.carMaxPerDay || ''}
                      onChange={(e) => update({ carMaxPerDay: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>

              {/* Insurance add-on */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.includeInsurance}
                    onChange={(e) => update({ includeInsurance: e.target.checked })}
                    className="w-5 h-5 rounded accent-amber-400"
                  />
                  <div>
                    <span className="text-sm font-semibold text-white flex items-center gap-2">
                      + Add travel insurance
                    </span>
                    <p className="text-xs text-white/35">Protect your trip with VisitorsCoverage</p>
                  </div>
                </label>
                {form.includeInsurance && (
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {[
                      { value: 'basic', label: 'Basic', price: '$29', desc: 'Medical $50K' },
                      { value: 'standard', label: 'Standard', price: '$49', desc: 'Medical $100K + car' },
                      { value: 'premium', label: 'Premium', price: '$79', desc: 'Full coverage' },
                    ].map((plan) => (
                      <button
                        key={plan.value}
                        type="button"
                        onClick={() => update({ insurancePlan: plan.value })}
                        className={`rounded-xl p-3 text-center transition-all ${
                          form.insurancePlan === plan.value
                            ? 'bg-amber-500/10 border border-amber-500/30 text-white'
                            : 'bg-white/2 border border-white/6 text-white/50 hover:text-white/70'
                        }`}
                      >
                        <p className="text-xs font-semibold">{plan.label}</p>
                        <p className="text-sm font-bold text-amber-400 mt-1">{plan.price}</p>
                        <p className="text-[9px] text-white/30 mt-0.5">{plan.desc}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Preferences */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-white">Preferences</h2>
              {showFlight && (
                <>
                  <Select
                    label="Cabin Class"
                    value={form.cabinClass}
                    onChange={(e) => update({ cabinClass: e.target.value })}
                    options={[
                      { value: 'economy', label: 'Economy' },
                      { value: 'premium_economy', label: 'Premium Economy' },
                      { value: 'business', label: 'Business' },
                      { value: 'first', label: 'First' },
                    ]}
                  />
                  <Select
                    label="Stops Preference"
                    value={form.stopsPreference}
                    onChange={(e) => update({ stopsPreference: e.target.value })}
                    options={[
                      { value: 'any', label: 'Any number of stops' },
                      { value: 'nonstop', label: 'Nonstop only' },
                      { value: 'max_1', label: 'Max 1 stop' },
                    ]}
                  />
                </>
              )}
              <Select
                label="Eco Preference"
                value={form.ecoPreference}
                onChange={(e) => update({ ecoPreference: e.target.value })}
                options={[
                  { value: 'balanced', label: 'Balanced' },
                  { value: 'green', label: 'Prefer greener options' },
                  { value: 'cheapest', label: 'Cheapest regardless' },
                ]}
              />
              {showFlight && (
                <Input
                  label="Preferred Airlines (optional)"
                  placeholder="e.g. Swiss, Lufthansa, SAS"
                  value={form.preferredAirlines}
                  onChange={(e) => update({ preferredAirlines: e.target.value })}
                  helperText="Comma-separated airline names"
                />
              )}
            </div>
          )}

          {/* Step 3: Budget & Auto-Buy */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-white">Budget & Auto-Buy</h2>

              {/* Live market insight — real data from Sky-Scrapper */}
              <div
                className="rounded-xl p-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(245,158,11,0.06))',
                  border: '1px solid rgba(16,185,129,0.15)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(16,185,129,0.15)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 13l4-4 3 3 5-6" />
                      <path d="M10 6h4v4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Live Market Insight</p>
                    {marketInsight.loading ? (
                      <p className="text-sm text-white/50 mt-1">Checking current prices…</p>
                    ) : marketInsight.error ? (
                      <p className="text-sm text-white/50 mt-1">{marketInsight.error}</p>
                    ) : marketInsight.cheapest !== undefined ? (
                      <div className="mt-1">
                        <p className="text-sm text-white/70">
                          Right now we see <span className="text-white font-bold">{marketInsight.count}</span> {marketInsight.kind === 'flight' ? 'flights' : 'hotels'} for your dates.
                        </p>
                        <div className="flex gap-4 mt-2">
                          <div>
                            <p className="text-[10px] text-white/40 uppercase">Cheapest</p>
                            <p className="text-lg font-bold text-emerald-300">${marketInsight.cheapest}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-white/40 uppercase">Average</p>
                            <p className="text-lg font-bold text-white">${marketInsight.average}</p>
                          </div>
                        </div>
                        <p className="text-[11px] text-white/40 mt-2 italic">
                          Set any budget you're comfortable with. This is information, not a recommendation.
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-white/50 mt-1">
                        Complete step 1 to see real-time market prices for your route.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment rail — choose how the budget is held */}
              <div>
                <p className="text-xs font-medium text-white/50 mb-2 uppercase tracking-wider">Payment method</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => update({ paymentRail: 'stripe' })}
                    className="rounded-xl p-4 text-left transition-all"
                    style={{
                      background: form.paymentRail === 'stripe' ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
                      border: form.paymentRail === 'stripe' ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">💳</span>
                      <p className="text-sm font-semibold text-white">Credit / Debit card</p>
                    </div>
                    <p className="text-xs text-white/50 mt-2 leading-relaxed">
                      Stripe authorizes your full budget but never charges it until we book. Remaining amount released automatically. Non-custodial.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ paymentRail: 'wallet' })}
                    className="rounded-xl p-4 text-left transition-all"
                    style={{
                      background: form.paymentRail === 'wallet' ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
                      border: form.paymentRail === 'wallet' ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🔗</span>
                      <p className="text-sm font-semibold text-white">Crypto wallet · USDC</p>
                    </div>
                    <p className="text-xs text-white/50 mt-2 leading-relaxed">
                      Deposit USDC into a non-custodial escrow on Base. You keep the keys. Withdraw anytime. ~$0.01 gas.
                    </p>
                  </button>
                </div>
              </div>

              <Input
                label="Maximum Budget (USD)"
                type="number"
                min={0}
                placeholder="e.g. 500"
                value={form.maxBudget || ''}
                onChange={(e) => update({ maxBudget: Number(e.target.value) })}
                helperText="Your absolute ceiling — the agent will never book above this amount."
              />

              {/* Auto-buy toggle */}
              <div
                className="rounded-xl px-4 py-4"
                style={{
                  background: form.autoBuyEnabled ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.03)',
                  border: form.autoBuyEnabled ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.06)',
                  transition: 'all 0.2s ease',
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Auto-Buy</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      When a deal drops below your threshold, our AI agent automatically books it for you
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.autoBuyEnabled}
                    onClick={() => update({ autoBuyEnabled: !form.autoBuyEnabled })}
                    className="relative h-7 w-12 rounded-full transition-colors duration-200 flex-shrink-0 ml-4"
                    style={{
                      background: form.autoBuyEnabled
                        ? 'linear-gradient(135deg, #D4A24C, #F97316)'
                        : 'rgba(255,255,255,0.1)',
                    }}
                  >
                    <span
                      className="absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200"
                      style={{
                        transform: form.autoBuyEnabled ? 'translateX(20px)' : 'translateX(0)',
                      }}
                    />
                  </button>
                </div>

                {form.autoBuyEnabled && (
                  <div className="mt-4 space-y-4 pt-3 border-t border-white/[0.07]">
                    <Input
                      label="Auto-Buy Threshold (USD)"
                      type="number"
                      min={0}
                      placeholder="e.g. 400"
                      value={form.autoBuyThreshold || ''}
                      onChange={(e) => update({ autoBuyThreshold: Number(e.target.value) })}
                      helperText="If a deal falls below this price, the agent auto-books it instantly."
                    />
                    <Input
                      label="Budget Pool Deposit (USD)"
                      type="number"
                      min={0}
                      placeholder="e.g. 500"
                      value={form.budgetPoolDeposit || ''}
                      onChange={(e) => update({ budgetPoolDeposit: Number(e.target.value) })}
                      helperText="Funds reserved for auto-buy. Fully refundable if unused."
                    />
                  </div>
                )}
              </div>

              <Select
                label="Monitoring Frequency"
                value={form.monitoringFrequency}
                onChange={(e) => update({ monitoringFrequency: e.target.value })}
                options={[
                  { value: 'every_1h', label: 'Every hour' },
                  { value: 'every_3h', label: 'Every 3 hours' },
                  { value: 'every_6h', label: 'Every 6 hours' },
                  { value: 'every_12h', label: 'Every 12 hours' },
                  { value: 'daily', label: 'Once daily' },
                ]}
              />

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.emailAlerts}
                  onChange={(e) => update({ emailAlerts: e.target.checked })}
                  className="w-5 h-5 rounded accent-amber-400"
                />
                <div>
                  <p className="text-sm font-medium text-white">Email Alerts</p>
                  <p className="text-xs text-white/40">Get notified when the agent finds a good deal</p>
                </div>
              </label>
            </div>
          )}

          {errors.length > 0 && (
            <div className="mt-4 rounded-xl px-4 py-3 border border-red-500/30 bg-red-500/5">
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-red-300">
                  {e}
                </p>
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.07]">
            <Button variant="ghost" onClick={back} disabled={step === 0}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 4L6 8l4 4" />
              </svg>
              Back
            </Button>
            {step < 2 ? (
              <Button variant="primary" onClick={next}>
                Next
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </Button>
            ) : (
              <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Launching...' : 'Launch Mission'}
              </Button>
            )}
          </div>
        </Card>

        {/* Summary Preview */}
        <div className="space-y-4">
          <Card padding="md">
            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">Mission Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Type</span>
                <span className="text-white font-medium capitalize">
                  {form.type === 'package' ? 'Flight + Hotel' : form.type}
                </span>
              </div>
              {showFlight && form.origin && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Route</span>
                  <span className="text-white font-medium">
                    {form.origin} {form.destination ? `\u2192 ${form.destination}` : ''}
                  </span>
                </div>
              )}
              {showHotel && form.hotelDestination && form.type === 'hotel' && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Hotel</span>
                  <span className="text-white font-medium truncate max-w-[160px]">{form.hotelDestination}</span>
                </div>
              )}
              {showFlight && form.departDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Depart</span>
                  <span className="text-white font-medium">{form.departDate}</span>
                </div>
              )}
              {showFlight && form.returnDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Return</span>
                  <span className="text-white font-medium">{form.returnDate}</span>
                </div>
              )}
              {showHotel && form.checkIn && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Check-in</span>
                  <span className="text-white font-medium">{form.checkIn}</span>
                </div>
              )}
              {showHotel && form.checkOut && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Check-out</span>
                  <span className="text-white font-medium">{form.checkOut}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-white/50">{showHotel ? 'Guests' : 'Passengers'}</span>
                <span className="text-white font-medium">{form.passengers}</span>
              </div>
              {showFlight && (
                <div className="border-t border-white/[0.07] pt-3 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Cabin</span>
                    <span className="text-white font-medium capitalize">{form.cabinClass.replace('_', ' ')}</span>
                  </div>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Eco</span>
                <span className="text-white font-medium capitalize">{form.ecoPreference}</span>
              </div>
              <div className="border-t border-white/[0.07] pt-3 mt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Budget</span>
                  <span className="text-white font-bold">
                    {form.maxBudget > 0 ? `$${form.maxBudget}` : 'Not set'}
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Auto-buy</span>
                <span className={`font-bold ${form.autoBuyEnabled && form.autoBuyThreshold > 0 ? 'text-amber-300' : 'text-white/30'}`}>
                  {form.autoBuyEnabled && form.autoBuyThreshold > 0 ? `< $${form.autoBuyThreshold}` : 'Off'}
                </span>
              </div>
              {form.autoBuyEnabled && form.budgetPoolDeposit > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Pool deposit</span>
                  <span className="text-emerald-300 font-bold">${form.budgetPoolDeposit}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Alerts</span>
                <span className="text-white font-medium">{form.emailAlerts ? 'On' : 'Off'}</span>
              </div>
            </div>
          </Card>

          <Card padding="md" className="border-amber-500/10">
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.2))' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#D4A24C" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3l2 1" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">AI-Powered Monitoring</p>
                <p className="text-xs text-white/40 mt-1">Your agent continuously scans for the best fares using live market data and price prediction.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
