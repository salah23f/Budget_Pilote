import { create } from 'zustand';
import { type CurrencyCode, detectCurrency, getExchangeRates } from '@/lib/currency';

interface CurrencyState {
  currency: CurrencyCode;
  rates: Record<string, number> | null;
  loading: boolean;
  setCurrency: (c: CurrencyCode) => void;
  loadRates: () => Promise<void>;
}

const STORAGE_KEY = 'flyeas_currency';

function loadSaved(): CurrencyCode {
  if (typeof window === 'undefined') return 'USD';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved as CurrencyCode;
  } catch (_) {}
  return detectCurrency();
}

export const useCurrencyStore = create<CurrencyState>()((set, get) => ({
  currency: loadSaved(),
  rates: null,
  loading: false,

  setCurrency: (c) => {
    set({ currency: c });
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY, c); } catch (_) {}
    }
  },

  loadRates: async () => {
    if (get().rates || get().loading) return;
    set({ loading: true });
    const rates = await getExchangeRates();
    set({ rates: Object.keys(rates).length > 0 ? rates : null, loading: false });
  },
}));
