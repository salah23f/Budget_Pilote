'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface InsurancePlan {
  id: string;
  name: string;
  price: number;
  features: string[];
  color: string;
}

export interface InsuranceDetailModalProps {
  plan: InsurancePlan | null;
  onClose: () => void;
  destination?: string;
  departDate?: string;
  returnDate?: string;
  travelers?: number;
}

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                          */
/* ------------------------------------------------------------------ */

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function ShieldIcon({ color }: { color: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 4v6c0 5.5-3.8 10.7-8 12-4.2-1.3-8-6.5-8-12V6l8-4z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Coverage data per plan                                             */
/* ------------------------------------------------------------------ */

type PlanTier = 'Basic' | 'Standard' | 'Premium';

interface CoverageRow {
  type: string;
  Basic: string;
  Standard: string;
  Premium: string;
}

const COVERAGE_LIMITS: CoverageRow[] = [
  { type: 'Medical expenses', Basic: '$50,000', Standard: '$250,000', Premium: '$1,000,000' },
  { type: 'Emergency evacuation', Basic: '$100,000', Standard: '$500,000', Premium: 'Unlimited' },
  { type: 'Baggage loss/damage', Basic: '$500', Standard: '$2,000', Premium: '$5,000' },
  { type: 'Trip cancellation', Basic: '$1,000', Standard: '$5,000', Premium: '$10,000' },
  { type: 'Travel delay', Basic: '--', Standard: '$500', Premium: '$1,000' },
  { type: 'Adventure sports', Basic: '--', Standard: '--', Premium: 'Included' },
];

interface CoveredItem {
  text: string;
  premiumOnly?: boolean;
}

const WHATS_COVERED: CoveredItem[] = [
  { text: 'Emergency medical treatment' },
  { text: 'Hospital stays' },
  { text: 'Emergency dental' },
  { text: 'Trip cancellation (illness, death in family, natural disaster)' },
  { text: 'Trip interruption' },
  { text: 'Baggage loss or delay' },
  { text: 'Travel delay (>6 hours)' },
  { text: 'Personal liability' },
  { text: 'Adventure sports coverage', premiumOnly: true },
  { text: 'Rental car damage', premiumOnly: true },
];

const EXCLUSIONS = [
  'Pre-existing medical conditions (within 60 days)',
  'Extreme sports (Basic/Standard only)',
  'Travel to countries under government travel advisory',
  'Self-inflicted injuries',
  'War, terrorism, civil unrest',
  'Alcohol/drug-related incidents',
  'Non-disclosed pre-existing conditions',
  'Cancellation due to "change of mind"',
];

const CLAIM_STEPS = [
  { icon: <PhoneIcon />, title: 'Contact assistance', desc: 'Call the 24/7 assistance hotline within 48 hours of the incident' },
  { icon: <DocumentIcon />, title: 'Gather documents', desc: 'Collect medical reports, police reports, and original receipts' },
  { icon: <UploadIcon />, title: 'Submit claim', desc: 'File your claim online within 90 days of the incident' },
];

const REQUIRED_DOCS = [
  'Valid passport or ID',
  'Proof of travel (boarding pass, hotel reservation)',
  'Medical certificate (for medical claims)',
  'Police report (for theft or loss)',
  'Original receipts for claimed items',
];

const FAQS = [
  {
    question: 'When does coverage start?',
    answer: 'Coverage begins from the moment you leave your home for the trip and continues until you return. Make sure to purchase your plan before departure.',
  },
  {
    question: 'Can I extend my coverage?',
    answer: 'Yes, you can extend your coverage by contacting support before your current policy expires. Extensions are subject to availability and may require additional documentation.',
  },
  {
    question: 'Is COVID-19 covered?',
    answer: 'Yes, COVID-19 is treated as any other illness under your medical coverage. This includes testing, treatment, and quarantine-related expenses up to your plan limit.',
  },
];

/* ------------------------------------------------------------------ */
/*  Section header                                                     */
/* ------------------------------------------------------------------ */

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon && <span className="text-amber-400/70">{icon}</span>}
      <h3 className="text-xs font-bold text-white/90 uppercase tracking-wider">{children}</h3>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function InsuranceDetailModal({
  plan,
  onClose,
  destination,
  departDate,
  returnDate,
  travelers,
}: InsuranceDetailModalProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  if (!plan) return null;

  const tier = plan.name as PlanTier;
  const isRecommended = plan.name === 'Standard';

  const affiliateLink = buildLink(plan.name, destination, departDate, returnDate, travelers);

  return (
    <Modal isOpen onClose={onClose} title="" size="lg">
      <div className="space-y-6 -mt-2 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">

        {/* ---- Header ---- */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldIcon color={plan.color} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{plan.name} Plan</h2>
                {isRecommended && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider" style={{ background: 'var(--flyeas-gradient)', color: 'white' }}>
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-sm text-white/40 mt-0.5">Travel insurance coverage</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold" style={{ color: plan.color }}>${plan.price}</p>
            <p className="text-[10px] text-white/30">{travelers && travelers > 1 ? `total for ${travelers} travelers` : 'per trip'}</p>
          </div>
        </div>

        {/* ---- Coverage Limits ---- */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <SectionTitle icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 3v18" />
            </svg>
          }>Coverage Limits</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-2 pr-4 text-white/35 font-medium">Coverage</th>
                  <th className="text-right py-2 px-2 text-white/35 font-medium">Limit</th>
                </tr>
              </thead>
              <tbody>
                {COVERAGE_LIMITS.map((row) => {
                  const val = row[tier];
                  if (val === '--') return null;
                  return (
                    <tr key={row.type} className="border-b border-white/[0.03]">
                      <td className="py-2.5 pr-4 text-white/60 flex items-center gap-2">
                        <CheckIcon className="text-emerald-400 flex-shrink-0" />
                        {row.type}
                      </td>
                      <td className="py-2.5 px-2 text-right font-semibold text-white/80">{val}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- What's Covered ---- */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <SectionTitle icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }>{"What's Covered"}</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {WHATS_COVERED.map((item) => {
              const available = item.premiumOnly ? tier === 'Premium' : true;
              return (
                <div key={item.text} className="flex items-start gap-2 text-xs">
                  {available ? (
                    <CheckIcon className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XIcon className="text-white/15 flex-shrink-0 mt-0.5" />
                  )}
                  <span className={available ? 'text-white/60' : 'text-white/20'}>
                    {item.text}
                    {item.premiumOnly && !available && (
                      <span className="ml-1 text-[9px] text-white/20">(Premium only)</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---- Exclusions ---- */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <SectionTitle icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          }>{"What's NOT Covered (Exclusions)"}</SectionTitle>
          <div className="space-y-2">
            {EXCLUSIONS.map((item) => (
              <div key={item} className="flex items-start gap-2 text-xs">
                <XIcon className="text-red-400/70 flex-shrink-0 mt-0.5" />
                <span className="text-white/50">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ---- How to File a Claim ---- */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <SectionTitle icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          }>How to File a Claim</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {CLAIM_STEPS.map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center mb-2" style={{ background: 'rgba(245,158,11,0.12)' }}>
                  <span className="text-amber-400">{step.icon}</span>
                </div>
                <p className="text-[10px] font-bold text-amber-400/80 uppercase tracking-wider mb-1">Step {i + 1}</p>
                <p className="text-xs font-semibold text-white/80 mb-1">{step.title}</p>
                <p className="text-[10px] text-white/40 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ---- Required Documents ---- */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <SectionTitle icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
          }>Required Documents</SectionTitle>
          <div className="space-y-2">
            {REQUIRED_DOCS.map((doc) => (
              <div key={doc} className="flex items-start gap-2 text-xs">
                <CheckIcon className="text-amber-400/70 flex-shrink-0 mt-0.5" />
                <span className="text-white/60">{doc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ---- FAQ ---- */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <SectionTitle icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          }>Frequently Asked Questions</SectionTitle>
          <div className="space-y-1">
            {FAQS.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i} className="rounded-lg overflow-hidden" style={{ background: isOpen ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="text-xs font-medium text-white/70">{faq.question}</span>
                    <ChevronIcon open={isOpen} />
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3">
                      <p className="text-[11px] text-white/45 leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ---- Book CTA ---- */}
        <div className="pt-2">
          <a href={affiliateLink} target="_blank" rel="noopener noreferrer" className="block">
            <Button variant="primary" size="lg" fullWidth>
              <span className="flex items-center justify-center gap-2">
                Get covered on VisitorsCoverage
                <ExternalLinkIcon />
              </span>
            </Button>
          </a>
          <p className="text-[9px] text-white/20 text-center mt-2">
            {"You'll complete your purchase on visitorscoverage.com"}
          </p>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Affiliate link helper                                              */
/* ------------------------------------------------------------------ */

function buildLink(
  planName: string,
  destination?: string,
  departDate?: string,
  returnDate?: string,
  travelers?: number,
): string {
  const base = 'https://www.visitorscoverage.com';
  const query = new URLSearchParams({
    destination: destination || '',
    start_date: departDate || '',
    end_date: returnDate || '',
    travelers: String(travelers || 1),
    plan_type: planName.toLowerCase(),
    utm_source: 'flyeas',
    utm_medium: 'referral',
    utm_campaign: 'travel_insurance',
  });
  return `${base}/travel-insurance?${query.toString()}`;
}
