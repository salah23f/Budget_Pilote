/**
 * 100 most popular global flight routes for price monitoring.
 * Mix of short-haul, long-haul, transatlantic, intra-Europe, Asia, Americas.
 */

export interface ScraperRoute {
  origin: string;       // IATA
  destination: string;  // IATA
  region: 'transatlantic' | 'europe' | 'asia' | 'americas' | 'middle-east' | 'africa' | 'oceania';
}

export const ROUTES: ScraperRoute[] = [
  // Transatlantic (25 routes)
  { origin: 'CDG', destination: 'JFK', region: 'transatlantic' },
  { origin: 'LHR', destination: 'JFK', region: 'transatlantic' },
  { origin: 'CDG', destination: 'LAX', region: 'transatlantic' },
  { origin: 'LHR', destination: 'LAX', region: 'transatlantic' },
  { origin: 'FRA', destination: 'JFK', region: 'transatlantic' },
  { origin: 'AMS', destination: 'JFK', region: 'transatlantic' },
  { origin: 'MAD', destination: 'MIA', region: 'transatlantic' },
  { origin: 'FCO', destination: 'JFK', region: 'transatlantic' },
  { origin: 'LHR', destination: 'SFO', region: 'transatlantic' },
  { origin: 'CDG', destination: 'YUL', region: 'transatlantic' },
  { origin: 'LHR', destination: 'BOS', region: 'transatlantic' },
  { origin: 'BCN', destination: 'JFK', region: 'transatlantic' },
  { origin: 'LIS', destination: 'EWR', region: 'transatlantic' },
  { origin: 'DUB', destination: 'JFK', region: 'transatlantic' },
  { origin: 'CDG', destination: 'SFO', region: 'transatlantic' },
  { origin: 'MUC', destination: 'ORD', region: 'transatlantic' },
  { origin: 'ZRH', destination: 'JFK', region: 'transatlantic' },
  { origin: 'LHR', destination: 'YYZ', region: 'transatlantic' },
  { origin: 'CDG', destination: 'GRU', region: 'transatlantic' },
  { origin: 'MAD', destination: 'EZE', region: 'transatlantic' },
  { origin: 'LHR', destination: 'IAD', region: 'transatlantic' },
  { origin: 'AMS', destination: 'LAX', region: 'transatlantic' },
  { origin: 'FRA', destination: 'ORD', region: 'transatlantic' },
  { origin: 'CDG', destination: 'MEX', region: 'transatlantic' },
  { origin: 'LHR', destination: 'ATL', region: 'transatlantic' },

  // Europe (20 routes)
  { origin: 'CDG', destination: 'BCN', region: 'europe' },
  { origin: 'LHR', destination: 'CDG', region: 'europe' },
  { origin: 'AMS', destination: 'BCN', region: 'europe' },
  { origin: 'CDG', destination: 'FCO', region: 'europe' },
  { origin: 'LHR', destination: 'AMS', region: 'europe' },
  { origin: 'BER', destination: 'BCN', region: 'europe' },
  { origin: 'CDG', destination: 'LIS', region: 'europe' },
  { origin: 'LHR', destination: 'FCO', region: 'europe' },
  { origin: 'CDG', destination: 'ATH', region: 'europe' },
  { origin: 'AMS', destination: 'LIS', region: 'europe' },
  { origin: 'CDG', destination: 'RAK', region: 'europe' },
  { origin: 'LHR', destination: 'AGP', region: 'europe' },
  { origin: 'FRA', destination: 'PMI', region: 'europe' },
  { origin: 'CDG', destination: 'DUB', region: 'europe' },
  { origin: 'BER', destination: 'LHR', region: 'europe' },
  { origin: 'MXP', destination: 'CDG', region: 'europe' },
  { origin: 'CDG', destination: 'PRG', region: 'europe' },
  { origin: 'LHR', destination: 'VIE', region: 'europe' },
  { origin: 'AMS', destination: 'CPH', region: 'europe' },
  { origin: 'CDG', destination: 'BUD', region: 'europe' },

  // Asia (20 routes)
  { origin: 'CDG', destination: 'NRT', region: 'asia' },
  { origin: 'LHR', destination: 'SIN', region: 'asia' },
  { origin: 'CDG', destination: 'BKK', region: 'asia' },
  { origin: 'LHR', destination: 'HND', region: 'asia' },
  { origin: 'FRA', destination: 'PVG', region: 'asia' },
  { origin: 'AMS', destination: 'ICN', region: 'asia' },
  { origin: 'CDG', destination: 'PEK', region: 'asia' },
  { origin: 'LHR', destination: 'BOM', region: 'asia' },
  { origin: 'CDG', destination: 'HKG', region: 'asia' },
  { origin: 'LHR', destination: 'DEL', region: 'asia' },
  { origin: 'FRA', destination: 'BKK', region: 'asia' },
  { origin: 'LHR', destination: 'KUL', region: 'asia' },
  { origin: 'CDG', destination: 'SGN', region: 'asia' },
  { origin: 'AMS', destination: 'NRT', region: 'asia' },
  { origin: 'JFK', destination: 'NRT', region: 'asia' },
  { origin: 'LAX', destination: 'NRT', region: 'asia' },
  { origin: 'SFO', destination: 'ICN', region: 'asia' },
  { origin: 'LAX', destination: 'SYD', region: 'asia' },
  { origin: 'SFO', destination: 'HND', region: 'asia' },
  { origin: 'JFK', destination: 'ICN', region: 'asia' },

  // Americas (15 routes)
  { origin: 'JFK', destination: 'LAX', region: 'americas' },
  { origin: 'JFK', destination: 'MIA', region: 'americas' },
  { origin: 'LAX', destination: 'CUN', region: 'americas' },
  { origin: 'JFK', destination: 'SJU', region: 'americas' },
  { origin: 'ORD', destination: 'CUN', region: 'americas' },
  { origin: 'LAX', destination: 'HNL', region: 'americas' },
  { origin: 'MIA', destination: 'BOG', region: 'americas' },
  { origin: 'JFK', destination: 'LIM', region: 'americas' },
  { origin: 'MIA', destination: 'GRU', region: 'americas' },
  { origin: 'LAX', destination: 'MEX', region: 'americas' },
  { origin: 'JFK', destination: 'PTY', region: 'americas' },
  { origin: 'ORD', destination: 'GDL', region: 'americas' },
  { origin: 'ATL', destination: 'MBJ', region: 'americas' },
  { origin: 'DFW', destination: 'CUN', region: 'americas' },
  { origin: 'SFO', destination: 'PVR', region: 'americas' },

  // Middle East (10 routes)
  { origin: 'CDG', destination: 'DXB', region: 'middle-east' },
  { origin: 'LHR', destination: 'DXB', region: 'middle-east' },
  { origin: 'CDG', destination: 'IST', region: 'middle-east' },
  { origin: 'LHR', destination: 'IST', region: 'middle-east' },
  { origin: 'FRA', destination: 'DOH', region: 'middle-east' },
  { origin: 'JFK', destination: 'DXB', region: 'middle-east' },
  { origin: 'CDG', destination: 'TLV', region: 'middle-east' },
  { origin: 'LHR', destination: 'AMM', region: 'middle-east' },
  { origin: 'AMS', destination: 'IST', region: 'middle-east' },
  { origin: 'CDG', destination: 'RUH', region: 'middle-east' },

  // Africa (10 routes)
  { origin: 'CDG', destination: 'CMN', region: 'africa' },
  { origin: 'CDG', destination: 'TUN', region: 'africa' },
  { origin: 'LHR', destination: 'CPT', region: 'africa' },
  { origin: 'CDG', destination: 'ALG', region: 'africa' },
  { origin: 'LHR', destination: 'NBO', region: 'africa' },
  { origin: 'CDG', destination: 'DKR', region: 'africa' },
  { origin: 'AMS', destination: 'ACC', region: 'africa' },
  { origin: 'LHR', destination: 'LOS', region: 'africa' },
  { origin: 'CDG', destination: 'TNR', region: 'africa' },
  { origin: 'JFK', destination: 'ADD', region: 'africa' },
];
