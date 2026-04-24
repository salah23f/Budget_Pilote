/**
 * V7a Modal client — pivot A.
 *
 * Appelle l'endpoint POST MODAL_V7A_URL/predict avec Bearer MODAL_V7A_SECRET.
 * En cas d'échec ou d'indisponibilité, renvoie `null` pour permettre au
 * caller de tomber sur le predictor TS V1 de fallback.
 *
 * Timeout court (2 s) : le watcher tourne toutes les 15 min et ne doit pas
 * être bloqué par un Modal froid.
 *
 * Après pivot A :
 *   - `action` et `action_source` viennent de la baseline composée
 *     `ensemble_ttd_switch`. Le ML n'est PAS décisionnel.
 *   - `ml_layer` contient les sorties ML (quantiles, conformal, drop_proba)
 *     pour UI/explainability uniquement.
 *   - `alert_enabled=false` en prod — sera ré-activé après fix target B.
 */

export interface V7aPredictInput {
  origin: string;
  destination: string;
  ttd_days: number;
  current_price: number;
  fetched_at: string;
  price_history?: { fetched_at: string; price_usd: number }[];
  budget_max?: number;
  budget_autobuy?: number;
  autobuy_enabled?: boolean;
  preference_match?: number;
  alpha?: number;
}

export type V7aAction = 'WAIT' | 'BUY_NOW' | 'AUTO_BUY' | 'ABSTAIN';

export interface V7aMlLayer {
  q10_gain: number | null;
  q50_gain: number | null;
  q90_gain: number | null;
  conformal_lower: number | null;
  conformal_upper: number | null;
  conformal_width: number | null;
  drop_proba_calibrated: number | null;
  ml_available: boolean;
  ml_error?: string;
}

export interface V7aPrediction {
  v7a_version: string;
  route: string;
  route_known: boolean;
  q10_train_route: number | null;
  ttd_days: number;
  current_price: number;
  action: V7aAction;
  action_source: string;
  reason: string[];
  alert_enabled: boolean;
  alert_action: string | null;
  alert_reason: string[];
  ml_layer: V7aMlLayer;
}

const DEFAULT_TIMEOUT_MS = 2000;

export async function callV7a(
  input: V7aPredictInput,
  opts: { timeoutMs?: number; url?: string; secret?: string } = {}
): Promise<V7aPrediction | null> {
  const url = opts.url ?? process.env.MODAL_V7A_URL ?? '';
  const secret = opts.secret ?? process.env.MODAL_V7A_SECRET ?? '';
  if (!url) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(secret ? { authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify(input),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as V7aPrediction | { error: string };
    if ('error' in data) return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
