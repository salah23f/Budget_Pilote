'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ONBOARDING_KEY = 'flyeas_onboarding_done';

const slides = [
  {
    icon: (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </svg>
    ),
    title: 'Find the cheapest flights',
    desc: 'Compare 400+ airlines in real-time. Our AI finds deals you won\'t see anywhere else.',
    color: '#F59E0B',
  },
  {
    icon: (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      </svg>
    ),
    title: 'Set price missions',
    desc: 'Tell us your target price. We monitor 24/7 and alert you the instant it drops.',
    color: '#EF4444',
  },
  {
    icon: (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
      </svg>
    ),
    title: 'Save up to 40%',
    desc: 'Track your savings, earn rewards, and share deals with friends.',
    color: '#10B981',
  },
];

export function OnboardingTutorial() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) setShow(true);
  }, []);

  const dismiss = useCallback(() => {
    setShow(false);
    localStorage.setItem(ONBOARDING_KEY, '1');
  }, []);

  const next = useCallback(() => {
    if (step < slides.length - 1) setStep((s) => s + 1);
    else dismiss();
  }, [step, dismiss]);

  if (!show) return null;

  const slide = slides[step];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-sm mx-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex flex-col items-center text-center"
          >
            {/* Icon circle */}
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center mb-8"
              style={{
                background: `${slide.color}15`,
                border: `2px solid ${slide.color}30`,
                color: slide.color,
                boxShadow: `0 0 60px ${slide.color}15`,
              }}
            >
              {slide.icon}
            </div>

            <h2 className="text-2xl font-bold text-white mb-3">{slide.title}</h2>
            <p className="text-white/50 text-[15px] leading-relaxed max-w-xs">{slide.desc}</p>
          </motion.div>
        </AnimatePresence>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-10 mb-8">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className="transition-all duration-300"
              style={{
                width: i === step ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i === step ? slide.color : 'rgba(255,255,255,0.15)',
              }}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={next}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white transition-transform active:scale-[0.97]"
            style={{ background: `linear-gradient(135deg, ${slide.color}, ${slide.color}cc)`, boxShadow: `0 8px 30px ${slide.color}30` }}
          >
            {step === slides.length - 1 ? 'Get Started' : 'Next'}
          </button>
          {step < slides.length - 1 && (
            <button onClick={dismiss} className="text-white/30 text-sm hover:text-white/50 transition-colors">
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
