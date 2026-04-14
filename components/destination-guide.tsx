'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';

/* ------------------------------------------------------------------ */
/*  Destination data                                                    */
/* ------------------------------------------------------------------ */

interface DestinationInfo {
  visa: string;
  currency: string;
  currencySymbol: string;
  language: string;
  plug: string;
  tipping: string;
  emergency: string;
  timezone: string;
  waterSafe: boolean;
  drivingSide: 'left' | 'right';
  tips: string[];
}

const DESTINATIONS: Record<string, DestinationInfo> = {
  france: {
    visa: 'Schengen visa required for non-EU citizens. US/UK/CA citizens: 90 days visa-free.',
    currency: 'Euro (EUR)', currencySymbol: '€',
    language: 'French (English widely spoken in Paris)',
    plug: 'Type C/E (European 2-pin, 230V)',
    tipping: '5-10% at restaurants. Service is included in the bill (service compris).',
    emergency: '112 (EU) / 15 (medical) / 17 (police)',
    timezone: 'CET (UTC+1) / CEST (UTC+2 summer)',
    waterSafe: true, drivingSide: 'right',
    tips: ['Metro is the fastest way around Paris', 'Most shops closed on Sundays', 'Always say "Bonjour" when entering a shop'],
  },
  italy: {
    visa: 'Schengen visa required for non-EU citizens. US/UK/CA citizens: 90 days visa-free.',
    currency: 'Euro (EUR)', currencySymbol: '€',
    language: 'Italian (English in tourist areas)',
    plug: 'Type C/F/L (European 2/3-pin, 230V)',
    tipping: 'Not expected. Coperto (cover charge) is added to bills.',
    emergency: '112 (EU) / 118 (medical)',
    timezone: 'CET (UTC+1) / CEST (UTC+2 summer)',
    waterSafe: true, drivingSide: 'right',
    tips: ['Validate train tickets before boarding', 'Coffee at the bar is cheaper than seated', 'Many museums closed on Mondays'],
  },
  spain: {
    visa: 'Schengen visa required for non-EU citizens. US/UK/CA citizens: 90 days visa-free.',
    currency: 'Euro (EUR)', currencySymbol: '€',
    language: 'Spanish (Catalan in Barcelona)',
    plug: 'Type C/F (European 2-pin, 230V)',
    tipping: 'Not mandatory. Round up or leave 5-10% for good service.',
    emergency: '112',
    timezone: 'CET (UTC+1) / CEST (UTC+2 summer)',
    waterSafe: true, drivingSide: 'right',
    tips: ['Lunch is 2-4pm, dinner after 9pm', 'Siesta is real — shops close 2-5pm', 'Tapas are often free with drinks in some cities'],
  },
  'united kingdom': {
    visa: 'US/EU/CA citizens: 6 months visa-free.',
    currency: 'British Pound (GBP)', currencySymbol: '£',
    language: 'English',
    plug: 'Type G (British 3-pin, 230V)',
    tipping: '10-15% at restaurants if no service charge.',
    emergency: '999 / 112',
    timezone: 'GMT (UTC+0) / BST (UTC+1 summer)',
    waterSafe: true, drivingSide: 'left',
    tips: ['Stand on the right on escalators', 'Oyster card for London transport', 'Pubs often stop serving food at 9pm'],
  },
  japan: {
    visa: 'US/EU/UK/CA citizens: 90 days visa-free.',
    currency: 'Japanese Yen (JPY)', currencySymbol: '¥',
    language: 'Japanese (limited English)',
    plug: 'Type A/B (US-style 2-pin, 100V)',
    tipping: 'Never tip — it can be considered rude.',
    emergency: '110 (police) / 119 (fire/ambulance)',
    timezone: 'JST (UTC+9, no daylight saving)',
    waterSafe: true, drivingSide: 'left',
    tips: ['Get a Suica/Pasmo card for transport', 'Cash is still king in many places', 'Remove shoes when entering homes and some restaurants'],
  },
  usa: {
    visa: 'ESTA required for VWP countries. Others need B1/B2 visa.',
    currency: 'US Dollar (USD)', currencySymbol: '$',
    language: 'English (Spanish widely spoken)',
    plug: 'Type A/B (US 2-pin, 120V)',
    tipping: '18-20% at restaurants, $1-2 per drink at bars.',
    emergency: '911',
    timezone: 'EST/CST/MST/PST (UTC-5 to UTC-8)',
    waterSafe: true, drivingSide: 'right',
    tips: ['Sales tax not included in displayed prices', 'Rideshare apps are common', 'Portions are large — sharing is normal'],
  },
  thailand: {
    visa: 'US/EU/UK citizens: 30-60 days visa-free.',
    currency: 'Thai Baht (THB)', currencySymbol: '฿',
    language: 'Thai (English in tourist areas)',
    plug: 'Type A/B/C (mixed, 220V)',
    tipping: 'Not expected. Round up for good service.',
    emergency: '191 (police) / 1669 (ambulance)',
    timezone: 'ICT (UTC+7)',
    waterSafe: false, drivingSide: 'left',
    tips: ['Never touch someone\'s head', 'Remove shoes before entering temples', 'Always negotiate tuk-tuk prices beforehand'],
  },
  'united arab emirates': {
    visa: 'US/EU/UK citizens: 30-90 days visa on arrival.',
    currency: 'UAE Dirham (AED)', currencySymbol: 'AED',
    language: 'Arabic (English widely spoken)',
    plug: 'Type G (British 3-pin, 220V)',
    tipping: '10-15% at restaurants.',
    emergency: '999 (police) / 998 (ambulance)',
    timezone: 'GST (UTC+4)',
    waterSafe: true, drivingSide: 'right',
    tips: ['Dress modestly outside hotels/beaches', 'Metro is excellent in Dubai', 'Friday is the holy day (weekend is Fri-Sat)'],
  },
  morocco: {
    visa: 'US/EU/UK citizens: 90 days visa-free.',
    currency: 'Moroccan Dirham (MAD)', currencySymbol: 'MAD',
    language: 'Arabic, French, Berber',
    plug: 'Type C/E (European 2-pin, 220V)',
    tipping: '10% at restaurants. Tip guides and drivers.',
    emergency: '19 (police) / 15 (ambulance)',
    timezone: 'WET (UTC+1)',
    waterSafe: false, drivingSide: 'right',
    tips: ['Haggling is expected in souks', 'Dress conservatively outside tourist areas', 'Always agree on taxi fare before riding'],
  },
  turkey: {
    visa: 'US/UK citizens need e-Visa. EU citizens: 90 days visa-free.',
    currency: 'Turkish Lira (TRY)', currencySymbol: '₺',
    language: 'Turkish (English in tourist areas)',
    plug: 'Type C/F (European 2-pin, 220V)',
    tipping: '5-10% at restaurants.',
    emergency: '112',
    timezone: 'TRT (UTC+3)',
    waterSafe: false, drivingSide: 'right',
    tips: ['Istanbulkart for public transport', 'Tea is offered everywhere — accept it', 'Remove shoes when entering mosques'],
  },
};

// Aliases
const ALIASES: Record<string, string> = {
  paris: 'france', lyon: 'france', nice: 'france', marseille: 'france',
  london: 'united kingdom', edinburgh: 'united kingdom', manchester: 'united kingdom',
  rome: 'italy', milan: 'italy', venice: 'italy', florence: 'italy', naples: 'italy',
  barcelona: 'spain', madrid: 'spain', seville: 'spain', malaga: 'spain',
  tokyo: 'japan', osaka: 'japan', kyoto: 'japan',
  'new york': 'usa', 'los angeles': 'usa', miami: 'usa', chicago: 'usa', 'san francisco': 'usa', boston: 'usa', seattle: 'usa', houston: 'usa', dallas: 'usa',
  bangkok: 'thailand', phuket: 'thailand', 'chiang mai': 'thailand',
  dubai: 'united arab emirates', 'abu dhabi': 'united arab emirates',
  marrakech: 'morocco', casablanca: 'morocco', fez: 'morocco',
  istanbul: 'turkey', antalya: 'turkey', cappadocia: 'turkey',
};

function getDestinationInfo(destination: string): DestinationInfo | null {
  const key = destination.toLowerCase().trim();
  if (DESTINATIONS[key]) return DESTINATIONS[key];
  const alias = ALIASES[key];
  if (alias && DESTINATIONS[alias]) return DESTINATIONS[alias];
  // Try partial match
  for (const [name, info] of Object.entries(DESTINATIONS)) {
    if (key.includes(name) || name.includes(key)) return info;
  }
  for (const [alias, country] of Object.entries(ALIASES)) {
    if (key.includes(alias) || alias.includes(key)) return DESTINATIONS[country];
  }
  return null;
}

function getCountryName(destination: string): string {
  const key = destination.toLowerCase().trim();
  if (DESTINATIONS[key]) return key.charAt(0).toUpperCase() + key.slice(1);
  const alias = ALIASES[key];
  if (alias) return alias.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return destination;
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

interface DestinationGuideProps {
  destination: string;
  className?: string;
}

export function DestinationGuide({ destination, className = '' }: DestinationGuideProps) {
  const info = useMemo(() => getDestinationInfo(destination), [destination]);
  const country = useMemo(() => getCountryName(destination), [destination]);

  if (!info) return null;

  const svgIcon = (d: string) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
  const items = [
    { icon: svgIcon('M12 2l8 4v6c0 5.5-3.8 10.7-8 12-4.2-1.3-8-6.5-8-12V6l8-4z'), label: 'Visa', value: info.visa },
    { icon: svgIcon('M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6'), label: 'Currency', value: info.currency },
    { icon: svgIcon('M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'), label: 'Language', value: info.language },
    { icon: svgIcon('M13 2L3 14h9l-1 8 10-12h-9l1-8z'), label: 'Power', value: info.plug },
    { icon: svgIcon('M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6'), label: 'Tipping', value: info.tipping },
    { icon: svgIcon('M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72'), label: 'Emergency', value: info.emergency },
    { icon: svgIcon('M12 6v6l4 2'), label: 'Timezone', value: info.timezone },
    { icon: svgIcon('M5 17H3a2 2 0 01-2-2V9a1 1 0 011-1h1l2-4h10l2 4h1a1 1 0 011 1v6a2 2 0 01-2 2h-2'), label: 'Driving', value: `${info.drivingSide === 'left' ? 'Left' : 'Right'} side of the road` },
    { icon: svgIcon('M12 2a10 10 0 0110 10c0 5-4 8-10 10C6 20 2 17 2 12A10 10 0 0112 2z'), label: 'Tap Water', value: info.waterSafe ? 'Safe to drink' : 'Not safe — drink bottled water' },
  ];

  return (
    <div className={`glass rounded-2xl p-5 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
          Travel Guide — {country}
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-start gap-2.5 rounded-xl p-3"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <span className="text-white/30 flex-shrink-0 mt-0.5">{item.icon}</span>
            <div className="min-w-0">
              <p className="text-[10px] text-white/35 font-medium uppercase tracking-wider">{item.label}</p>
              <p className="text-xs text-white/70 leading-relaxed mt-0.5">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pro tips */}
      {info.tips.length > 0 && (
        <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 017 7c0 2.4-1.2 4.5-3 5.7V17a1 1 0 01-1 1h-6a1 1 0 01-1-1v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 017-7z"/></svg>
            Local Tips
          </p>
          <ul className="space-y-1.5">
            {info.tips.map((tip, i) => (
              <li key={i} className="text-xs text-white/50 flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
