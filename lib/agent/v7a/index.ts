/**
 * V7a predictor façade — pivot A.
 *
 * Après pivot A, la décision côté produit vient de la baseline composée
 * `ensemble_ttd_switch` exposée par l'endpoint Modal V7a. Le ML n'est PAS
 * décisionnel. Les quantiles + conformal + drop_proba sont exposés via
 * `ml_layer` pour UI/explainability seulement.
 *
 * Mapping vers l'interface V1 `Prediction` (pour rester compatible avec
 * propose/route.ts) :
 *   V7a.action → V1.action
 *     BUY_NOW / AUTO_BUY  → 'BUY_NOW'
 *     WAIT                → 'MONITOR'
 *     ABSTAIN             → 'WAIT'  (on s'abstient = on ne propose pas)
 */

import { predict, type Prediction, type PredictorInput } from '../predictor';
import { callV7a, type V7aPrediction } from './client';

export interface EnrichedPrediction extends Prediction {
  v7a?: V7aPrediction;
  engine: 'v1' | 'v7a' | 'v7a-fallback-v1';
}

export interface V7aPredictArgs extends PredictorInput {
  origin: string;
  destination: string;
  budgetMaxUsd?: number;
  budgetAutoBuyUsd?: number;
  autobuyEnabled?: boolean;
  preferenceMatch?: number;
  nowIso?: string;
}

function mapV7aActionToV1(action: V7aPrediction['action']): Prediction['action'] {
  if (action === 'BUY_NOW' || action === 'AUTO_BUY') return 'BUY_NOW';
  if (action === 'WAIT') return 'MONITOR';
  // ABSTAIN → on ne propose pas d'achat (V1 'WAIT' = ne rien faire côté user)
  return 'WAIT';
}

export async function predictV7aFirst(args: V7aPredictArgs): Promise<EnrichedPrediction> {
  const algo = (process.env.FLYEAS_ALGO_VERSION || 'v1').toLowerCase();

  if (algo !== 'v7a' && algo !== 'shadow') {
    const p = predict(args);
    return { ...p, engine: 'v1' };
  }

  const history = args.allSamples.map((s) => ({
    fetched_at: s.checkedAt,
    price_usd: s.priceUsd,
  }));

  const v7 = await callV7a({
    origin: args.origin,
    destination: args.destination,
    ttd_days: args.daysUntilDeparture,
    current_price: args.currentPrice,
    fetched_at: args.nowIso ?? new Date().toISOString(),
    price_history: history,
    budget_max: args.budgetMaxUsd,
    budget_autobuy: args.budgetAutoBuyUsd,
    autobuy_enabled: args.autobuyEnabled,
    preference_match: args.preferenceMatch,
  });

  const v1 = predict(args);

  if (!v7) {
    return { ...v1, engine: algo === 'v7a' ? 'v7a-fallback-v1' : 'v1' };
  }

  // Shadow : on renvoie V1 mais on attache V7a pour logs
  if (algo === 'shadow') {
    return { ...v1, v7a: v7, engine: 'v1' };
  }

  // v7a actif : décision V7a (ensemble_ttd_switch côté endpoint)
  const v1Action = mapV7aActionToV1(v7.action);

  // Confidence : si ml_layer disponible, dérive une confiance à partir de
  // la width conformale relative au prix. Sinon, confidence = 0.7 (par
  // défaut, décision baseline sans explication fine).
  let confidence = 0.7;
  if (v7.ml_layer.ml_available && v7.ml_layer.conformal_width !== null) {
    const wop = v7.ml_layer.conformal_width / Math.max(1, v7.current_price);
    confidence = Math.max(0, Math.min(1, 1 - Math.min(1, wop / 2)));
  }

  return {
    action: v1Action,
    confidence,
    zScore: 0,
    percentile: 50,
    trend: 'unknown',
    trendSlopePerDay: 0,
    daysUntilDeparture: args.daysUntilDeparture,
    expectedSavingsIfWait: v7.ml_layer.q50_gain !== null ? -v7.ml_layer.q50_gain : 0,
    probabilityBeaten7d:
      v7.ml_layer.drop_proba_calibrated !== null ? v7.ml_layer.drop_proba_calibrated : 0.5,
    baseline: null,
    sampleCount: args.windowSamples.length,
    reason: v7.reason.join(' ; '),
    subScores: {
      zScoreScore: 0,
      percentileScore: 0,
      trendScore: 0,
      ttdScore: 0,
    },
    v7a: v7,
    engine: 'v7a',
  };
}
