/**
 * Pool de routes de démonstration pour shadow mode V7a.
 *
 * Utilisé par /api/cron/demo-shadow-sweep pour faire tourner shadow
 * mode sur des données réelles Sky-Scrapper sans dépendre de la
 * création de missions utilisateur. Chaque entrée déclenche un scan
 * complet : Sky-Scrapper → V7a Modal → ligne dans agent_decisions.
 *
 * Couverture intentionnellement diverse :
 *   - 35 paires US domestic (hubs majeurs, low-cost et legacy)
 *   - 20 paires transatlantiques (US ↔ Europe)
 *   - 15 paires trans-pacifique (US ↔ Asie/Océanie)
 *   - 10 paires US ↔ Amérique latine
 *   - 10 paires intra-Europe
 *   - 10 paires intercontinentales restantes (Moyen-Orient, Afrique, Inde)
 *
 * Total : 100 paires. Sur 14 jours à 10 routes/jour, chaque route est
 * scannée environ 1.4 fois. La rotation est déterministe (basée sur
 * day-of-year) : pas de doublon dans le même jour.
 */

export interface DemoRoute {
  origin: string;
  destination: string;
  /** TTD en jours par rapport à "aujourd'hui" pour la date de départ */
  ttd: number;
  /** Optionnel — étiquette pour logs */
  label?: string;
}

export const DEMO_ROUTES: DemoRoute[] = [
  // ============================
  // US DOMESTIC (35)
  // ============================
  { origin: 'JFK', destination: 'LAX', ttd: 30, label: 'NYC-LA' },
  { origin: 'LAX', destination: 'JFK', ttd: 30 },
  { origin: 'JFK', destination: 'SFO', ttd: 30 },
  { origin: 'SFO', destination: 'JFK', ttd: 30 },
  { origin: 'ORD', destination: 'LAX', ttd: 21 },
  { origin: 'ORD', destination: 'JFK', ttd: 21 },
  { origin: 'ATL', destination: 'LAX', ttd: 30, label: 'ATL-LA' },
  { origin: 'ATL', destination: 'JFK', ttd: 14 },
  { origin: 'ATL', destination: 'MIA', ttd: 14 },
  { origin: 'ATL', destination: 'ORD', ttd: 14 },
  { origin: 'DFW', destination: 'LAX', ttd: 21 },
  { origin: 'DFW', destination: 'JFK', ttd: 30 },
  { origin: 'DFW', destination: 'MIA', ttd: 21 },
  { origin: 'MIA', destination: 'JFK', ttd: 14 },
  { origin: 'MIA', destination: 'LAX', ttd: 30 },
  { origin: 'BOS', destination: 'LAX', ttd: 30 },
  { origin: 'BOS', destination: 'SFO', ttd: 30 },
  { origin: 'BOS', destination: 'ORD', ttd: 21 },
  { origin: 'SEA', destination: 'JFK', ttd: 30 },
  { origin: 'SEA', destination: 'LAX', ttd: 14 },
  { origin: 'DEN', destination: 'JFK', ttd: 30 },
  { origin: 'DEN', destination: 'LAX', ttd: 21 },
  { origin: 'DEN', destination: 'ORD', ttd: 14 },
  { origin: 'IAH', destination: 'LAX', ttd: 21 },
  { origin: 'IAH', destination: 'JFK', ttd: 30 },
  { origin: 'PHX', destination: 'JFK', ttd: 30 },
  { origin: 'PHX', destination: 'ORD', ttd: 21 },
  { origin: 'LAS', destination: 'JFK', ttd: 30 },
  { origin: 'LAS', destination: 'LAX', ttd: 7, label: 'LAS-LAX-short' },
  { origin: 'EWR', destination: 'LAX', ttd: 30 },
  { origin: 'EWR', destination: 'SFO', ttd: 30 },
  { origin: 'LGA', destination: 'ORD', ttd: 21 },
  { origin: 'LGA', destination: 'MIA', ttd: 14 },
  { origin: 'BWI', destination: 'LAX', ttd: 30 },
  { origin: 'MCO', destination: 'JFK', ttd: 14 },

  // ============================
  // TRANSATLANTIC US ↔ EUROPE (20)
  // ============================
  { origin: 'JFK', destination: 'LHR', ttd: 45, label: 'NYC-London' },
  { origin: 'LHR', destination: 'JFK', ttd: 45 },
  { origin: 'JFK', destination: 'CDG', ttd: 45, label: 'NYC-Paris' },
  { origin: 'CDG', destination: 'JFK', ttd: 45 },
  { origin: 'JFK', destination: 'AMS', ttd: 45 },
  { origin: 'JFK', destination: 'FRA', ttd: 45 },
  { origin: 'JFK', destination: 'MAD', ttd: 45 },
  { origin: 'JFK', destination: 'FCO', ttd: 45 },
  { origin: 'BOS', destination: 'LHR', ttd: 45 },
  { origin: 'BOS', destination: 'CDG', ttd: 45 },
  { origin: 'EWR', destination: 'LHR', ttd: 45 },
  { origin: 'EWR', destination: 'FRA', ttd: 45 },
  { origin: 'IAD', destination: 'LHR', ttd: 45 },
  { origin: 'ORD', destination: 'LHR', ttd: 60 },
  { origin: 'ORD', destination: 'CDG', ttd: 60 },
  { origin: 'ATL', destination: 'LHR', ttd: 60 },
  { origin: 'ATL', destination: 'CDG', ttd: 60 },
  { origin: 'MIA', destination: 'LHR', ttd: 45 },
  { origin: 'MIA', destination: 'MAD', ttd: 45 },
  { origin: 'LAX', destination: 'LHR', ttd: 60 },

  // ============================
  // TRANS-PACIFIC US ↔ ASIE/OCÉANIE (15)
  // ============================
  { origin: 'LAX', destination: 'NRT', ttd: 60, label: 'LA-Tokyo' },
  { origin: 'NRT', destination: 'LAX', ttd: 60 },
  { origin: 'LAX', destination: 'HND', ttd: 60 },
  { origin: 'LAX', destination: 'ICN', ttd: 60 },
  { origin: 'SFO', destination: 'NRT', ttd: 60 },
  { origin: 'SFO', destination: 'HKG', ttd: 75 },
  { origin: 'SFO', destination: 'PVG', ttd: 75 },
  { origin: 'JFK', destination: 'NRT', ttd: 75 },
  { origin: 'JFK', destination: 'PEK', ttd: 75 },
  { origin: 'JFK', destination: 'HKG', ttd: 75 },
  { origin: 'SEA', destination: 'NRT', ttd: 60 },
  { origin: 'SEA', destination: 'ICN', ttd: 60 },
  { origin: 'LAX', destination: 'SYD', ttd: 75 },
  { origin: 'SFO', destination: 'SYD', ttd: 75 },
  { origin: 'LAX', destination: 'SIN', ttd: 75 },

  // ============================
  // US ↔ AMÉRIQUE LATINE (10)
  // ============================
  { origin: 'MIA', destination: 'GRU', ttd: 45, label: 'MIA-Sao-Paulo' },
  { origin: 'MIA', destination: 'EZE', ttd: 60 },
  { origin: 'MIA', destination: 'MEX', ttd: 30 },
  { origin: 'MIA', destination: 'BOG', ttd: 30 },
  { origin: 'MIA', destination: 'LIM', ttd: 45 },
  { origin: 'MIA', destination: 'SCL', ttd: 60 },
  { origin: 'JFK', destination: 'GRU', ttd: 45 },
  { origin: 'JFK', destination: 'MEX', ttd: 30 },
  { origin: 'LAX', destination: 'MEX', ttd: 21 },
  { origin: 'IAH', destination: 'MEX', ttd: 14 },

  // ============================
  // INTRA-EUROPE (10)
  // ============================
  { origin: 'LHR', destination: 'CDG', ttd: 21, label: 'London-Paris' },
  { origin: 'CDG', destination: 'LHR', ttd: 21 },
  { origin: 'LHR', destination: 'FRA', ttd: 21 },
  { origin: 'LHR', destination: 'MAD', ttd: 30 },
  { origin: 'LHR', destination: 'FCO', ttd: 30 },
  { origin: 'CDG', destination: 'FCO', ttd: 21 },
  { origin: 'CDG', destination: 'MAD', ttd: 21 },
  { origin: 'AMS', destination: 'BCN', ttd: 30 },
  { origin: 'FRA', destination: 'IST', ttd: 30 },
  { origin: 'CDG', destination: 'IST', ttd: 30 },

  // ============================
  // AUTRES INTERCONTINENTAUX (10)
  // ============================
  { origin: 'JFK', destination: 'DXB', ttd: 60, label: 'NYC-Dubai' },
  { origin: 'JFK', destination: 'TLV', ttd: 60 },
  { origin: 'JFK', destination: 'DEL', ttd: 75 },
  { origin: 'JFK', destination: 'BOM', ttd: 75 },
  { origin: 'LHR', destination: 'DXB', ttd: 30 },
  { origin: 'LHR', destination: 'JNB', ttd: 60 },
  { origin: 'CDG', destination: 'DXB', ttd: 30 },
  { origin: 'CDG', destination: 'CAI', ttd: 30 },
  { origin: 'FRA', destination: 'DEL', ttd: 60 },
  { origin: 'AMS', destination: 'NBO', ttd: 60 },
];

/**
 * Sélectionne N routes du pool en utilisant une fenêtre roulante basée
 * sur le day-of-year. Garantit qu'aucune route n'est piochée deux fois
 * dans le même appel et que la couverture est progressive sur ~10 jours.
 */
export function pickRotatingRoutes(
  count: number,
  date: Date = new Date()
): DemoRoute[] {
  if (count <= 0 || DEMO_ROUTES.length === 0) return [];
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = date.getTime() - start;
  const dayOfYear = Math.floor(diff / 86400000);
  const offset = (dayOfYear * count) % DEMO_ROUTES.length;
  const out: DemoRoute[] = [];
  for (let i = 0; i < count; i++) {
    out.push(DEMO_ROUTES[(offset + i) % DEMO_ROUTES.length]);
  }
  return out;
}
