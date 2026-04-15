'use client';

import { useState, useEffect, useMemo } from 'react';

/* ------------------------------------------------------------------ */
/*  A/B Testing Framework                                               */
/*  Assigns users to variants consistently via localStorage.            */
/* ------------------------------------------------------------------ */

const AB_STORAGE_KEY = 'flyeas_ab_tests';

interface ABTest {
  id: string;
  variants: string[];
}

function getAssignment(testId: string, variants: string[]): string {
  if (typeof window === 'undefined') return variants[0];
  try {
    const stored = JSON.parse(localStorage.getItem(AB_STORAGE_KEY) || '{}');
    if (stored[testId] && variants.includes(stored[testId])) return stored[testId];
    // Assign randomly
    const variant = variants[Math.floor(Math.random() * variants.length)];
    stored[testId] = variant;
    localStorage.setItem(AB_STORAGE_KEY, JSON.stringify(stored));
    return variant;
  } catch (_) {
    return variants[0];
  }
}

function trackEvent(testId: string, variant: string, event: string) {
  if (typeof window === 'undefined') return;
  try {
    const key = `flyeas_ab_events`;
    const events = JSON.parse(localStorage.getItem(key) || '[]');
    events.push({ testId, variant, event, ts: Date.now() });
    localStorage.setItem(key, JSON.stringify(events.slice(-500)));
  } catch (_) {}
  // In production, send to analytics
  console.log(`[A/B] ${testId}:${variant} — ${event}`);
}

/* ------------------------------------------------------------------ */
/*  Components                                                          */
/* ------------------------------------------------------------------ */

interface ABTestProps {
  testId: string;
  variants: Record<string, React.ReactNode>;
}

export function ABTest({ testId, variants }: ABTestProps) {
  const variantKeys = useMemo(() => Object.keys(variants), [variants]);
  const [variant, setVariant] = useState<string>(variantKeys[0]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setVariant(getAssignment(testId, variantKeys));
    setMounted(true);
    trackEvent(testId, variant, 'impression');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  if (!mounted) return <>{variants[variantKeys[0]]}</>;
  return <>{variants[variant] || variants[variantKeys[0]]}</>;
}

export function useABTest(testId: string, variants: string[]): { variant: string; track: (event: string) => void } {
  const [variant, setVariant] = useState(variants[0]);

  useEffect(() => {
    const v = getAssignment(testId, variants);
    setVariant(v);
    trackEvent(testId, v, 'impression');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  return {
    variant,
    track: (event: string) => trackEvent(testId, variant, event),
  };
}
