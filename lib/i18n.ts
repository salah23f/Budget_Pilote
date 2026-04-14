'use client';

import { useLocaleStore } from '@/lib/store/locale-store';

export type Locale = 'en' | 'fr' | 'es';

const translations: Record<string, Record<Locale, string>> = {
  // Sidebar
  'sidebar.dashboard': { en: 'Dashboard', fr: 'Tableau de bord', es: 'Panel' },
  'sidebar.tripBuilder': { en: 'Trip Builder', fr: 'Planificateur', es: 'Planificador' },
  'sidebar.flights': { en: 'Flights', fr: 'Vols', es: 'Vuelos' },
  'sidebar.hotels': { en: 'Hotels', fr: 'Hotels', es: 'Hoteles' },
  'sidebar.cars': { en: 'Cars', fr: 'Voitures', es: 'Coches' },
  'sidebar.groupTrip': { en: 'Group Trip', fr: 'Voyage de groupe', es: 'Viaje en grupo' },
  'sidebar.insurance': { en: 'Insurance', fr: 'Assurance', es: 'Seguro' },
  'sidebar.missions': { en: 'Missions', fr: 'Missions', es: 'Misiones' },
  'sidebar.favorites': { en: 'Favorites', fr: 'Favoris', es: 'Favoritos' },
  'sidebar.bookings': { en: 'Bookings', fr: 'Reservations', es: 'Reservas' },
  'sidebar.rewards': { en: 'Rewards', fr: 'Recompenses', es: 'Recompensas' },
  'sidebar.account': { en: 'Account', fr: 'Compte', es: 'Cuenta' },
  'sidebar.pricing': { en: 'Pricing', fr: 'Tarifs', es: 'Precios' },
  'sidebar.settings': { en: 'Settings', fr: 'Parametres', es: 'Ajustes' },
  'sidebar.about': { en: 'About', fr: 'A propos', es: 'Acerca de' },

  // Page titles
  'pages.searchFlights': { en: 'Search Flights', fr: 'Rechercher des vols', es: 'Buscar vuelos' },
  'pages.searchHotels': { en: 'Search Hotels', fr: 'Rechercher des hotels', es: 'Buscar hoteles' },
  'pages.yourDashboard': { en: 'Your Dashboard', fr: 'Votre tableau de bord', es: 'Tu panel' },

  // Buttons
  'button.search': { en: 'Search', fr: 'Rechercher', es: 'Buscar' },
  'button.bookNow': { en: 'Book Now', fr: 'Reserver', es: 'Reservar ahora' },
  'button.compare': { en: 'Compare', fr: 'Comparer', es: 'Comparar' },
  'button.clear': { en: 'Clear', fr: 'Effacer', es: 'Borrar' },
  'button.cancel': { en: 'Cancel', fr: 'Annuler', es: 'Cancelar' },
  'button.save': { en: 'Save', fr: 'Enregistrer', es: 'Guardar' },
  'button.applyFilters': { en: 'Apply Filters', fr: 'Appliquer les filtres', es: 'Aplicar filtros' },
  'button.createMission': { en: 'Create Mission', fr: 'Creer une mission', es: 'Crear mision' },

  // Empty states
  'empty.noFlights': { en: 'No flights found', fr: 'Aucun vol trouve', es: 'No se encontraron vuelos' },
  'empty.noHotels': { en: 'No hotels match', fr: 'Aucun hotel correspondant', es: 'No hay hoteles que coincidan' },
  'empty.noRecentSearches': { en: 'No recent searches', fr: 'Aucune recherche recente', es: 'Sin busquedas recientes' },

  // Common
  'common.loading': { en: 'Loading', fr: 'Chargement', es: 'Cargando' },
  'common.error': { en: 'Error', fr: 'Erreur', es: 'Error' },
  'common.perPerson': { en: 'per person', fr: 'par personne', es: 'por persona' },
  'common.perNight': { en: 'per night', fr: 'par nuit', es: 'por noche' },
  'common.total': { en: 'total', fr: 'total', es: 'total' },
  'common.stops': { en: 'stops', fr: 'escales', es: 'escalas' },
  'common.nonstop': { en: 'Nonstop', fr: 'Direct', es: 'Directo' },
  'common.duration': { en: 'duration', fr: 'duree', es: 'duracion' },

  // Topbar
  'topbar.searchPlaceholder': { en: 'Where do you want to go?', fr: 'Ou voulez-vous aller ?', es: 'A donde quieres ir?' },

  // Auth
  'auth.signUp': { en: 'Sign Up', fr: 'Inscription', es: 'Registrarse' },
  'auth.logIn': { en: 'Log In', fr: 'Connexion', es: 'Iniciar sesion' },
  'auth.logOut': { en: 'Log Out', fr: 'Deconnexion', es: 'Cerrar sesion' },
  'auth.welcomeBack': { en: 'Welcome back', fr: 'Content de vous revoir', es: 'Bienvenido de nuevo' },

  // Pricing
  'pricing.free': { en: 'Free', fr: 'Gratuit', es: 'Gratis' },
  'pricing.pro': { en: 'Pro', fr: 'Pro', es: 'Pro' },
  'pricing.elite': { en: 'Elite', fr: 'Elite', es: 'Elite' },
  'pricing.perMonth': { en: 'per month', fr: 'par mois', es: 'por mes' },
  'pricing.getStarted': { en: 'Get started', fr: 'Commencer', es: 'Empezar' },
  'pricing.startProTrial': { en: 'Start Pro trial', fr: 'Essayer Pro', es: 'Probar Pro' },
  'pricing.goElite': { en: 'Go Elite', fr: 'Passer Elite', es: 'Ir a Elite' },

  // Misc
  'misc.saved': { en: 'saved', fr: 'economise', es: 'ahorrado' },
  'misc.flightsSearchedToday': { en: 'flights searched today', fr: 'vols recherches aujourd\'hui', es: 'vuelos buscados hoy' },
  'misc.travelersSaving': { en: 'travelers saving right now', fr: 'voyageurs economisant en ce moment', es: 'viajeros ahorrando ahora mismo' },
  'misc.freePlan': { en: 'Free plan', fr: 'Plan gratuit', es: 'Plan gratuito' },
  'misc.quickAccess': { en: 'Quick access', fr: 'Acces rapide', es: 'Acceso rapido' },
  'misc.newMission': { en: 'New Mission', fr: 'Nouvelle mission', es: 'Nueva mision' },
  'misc.wallet': { en: 'Wallet', fr: 'Portefeuille', es: 'Cartera' },
  'misc.terms': { en: 'Terms', fr: 'Conditions', es: 'Terminos' },
};

/**
 * Get a translated string by dot-notation key.
 * Falls back to English, then returns the key itself if not found.
 */
export function t(key: string, locale: Locale = 'en'): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[locale] ?? entry['en'] ?? key;
}

/**
 * React hook that provides the current locale and a bound translation function.
 */
export function useLocale() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return {
    locale,
    setLocale,
    t: (key: string) => t(key, locale),
  };
}
