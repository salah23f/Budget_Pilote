/**
 * V7a Shadow Logging Runtime Wiring — staging only.
 *
 * Converts the existing V7aPrediction runtime object into a validated
 * V7a shadow decision log payload and calls the staging-only adapter.
 *
 * This module is the integration point between the watcher's
 * EnrichedPrediction and the structured shadow logging table.
 *
 * Sprint: b1/v7a-shadow-logging-runtime-wiring-staging
 * No payment. No checkout. No escrow. No auto-buy. No production.
 */

import type { V7aShadowDecisionLogInput, SupabaseLikeClient } from "./shadow-decision-logger";
import {
  logV7aShadowDecisionIfEnabled,
  type AdapterEnv,
  type AdapterResult,
} from "./shadow-logging-runtime-adapter";

// =============================================================================
// Types (matches V7aPrediction from lib/agent/v7a/client.ts)
// =============================================================================

export interface V7aMlLayerInput {
  q10_gain: number | null;
  q50_gain: number | null;
  q90_gain: number | null;
  conformal_width: number | null;
  drop_proba_calibrated: number | null;
  ml_available: boolean;
}

export interface V7aPredictionInput {
  route: string;
  route_known: boolean;
  q10_train_route: number | null;
  ttd_days: number;
  current_price: number;
  action: string;
  action_source: string;
  reason: string[];
  ml_layer: V7aMlLayerInput;
}

export interface WiringContext {
  mission_id?: string;
  user_id?: string;
  origin?: string;
  destination?: string;
  depart_date?: string;
  fetched_at?: string;
  route_popularity?: number;
  provider?: string | null;
}

export interface WiringDeps {
  env: AdapterEnv & {
    STAGING_SUPABASE_URL?: string;
    STAGING_SUPABASE_SERVICE_ROLE_KEY?: string;
  };
  createClient?: (url: string, key: string) => SupabaseLikeClient;
  now?: () => string;
}

export interface WiringResult {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  error?: string;
  id?: string;
}

// =============================================================================
// Conversion
// =============================================================================

function v7aPredictionToLogInput(
  pred: V7aPredictionInput,
  ctx: WiringContext
): V7aShadowDecisionLogInput {
  const ml = pred.ml_layer;
  const conformalWidth = ml.conformal_width ?? 0;
  const widthOverPrice = conformalWidth / Math.max(pred.current_price, 1);

  return {
    route: pred.route,
    action: pred.action,
    policy_version: "v7a-balanced-v2",
    can_autobuy: false,
    score_autobuy: 0,
    thresholds: {
      MAX_WIDTH_OVER_PRICE: 1.5,
      ABSTAIN_WIDTH_OVER_PRICE: 2.0,
      BUY_TRIGGER_MARGIN_USD: 20.0,
      DROP_PROBA_BUY_MAX: 0.25,
      ALERT_DROP_THRESHOLD: 0.95,
      ALERT_NEAR_FLOOR_PCT: 1.01,
      ROUTE_POPULARITY_MIN: 30,
      TTD_LOWER: 5,
      TTD_UPPER: 90,
    },
    decision_reasons: pred.reason,
    environment: "staging",
    mission_id: ctx.mission_id ?? null,
    user_id: ctx.user_id ?? null,
    origin: ctx.origin ?? null,
    destination: ctx.destination ?? null,
    depart_date: ctx.depart_date ?? null,
    fetched_at: ctx.fetched_at ?? null,
    ttd_days: pred.ttd_days,
    price_usd: pred.current_price,
    q10_gain: ml.q10_gain,
    q50_gain: ml.q50_gain,
    q90_gain: ml.q90_gain,
    c_alpha_gain: conformalWidth > 0 ? conformalWidth / 2 : null,
    width_over_price: widthOverPrice,
    drop_proba: ml.drop_proba_calibrated,
    q10_train_route: pred.q10_train_route,
    route_known: pred.route_known,
    route_popularity: ctx.route_popularity ?? null,
    confidence: ml.ml_available && ml.conformal_width !== null
      ? Math.max(0, Math.min(1, 1 - Math.min(1, widthOverPrice / 2)))
      : null,
    score_alert: ml.drop_proba_calibrated,
    score_buy: ml.q50_gain !== null && conformalWidth > 0
      ? ml.q50_gain + (pred.ttd_days <= 21 ? 1.0 : 0.3) * (conformalWidth / 2)
      : null,
    autobuy_enabled_input: false,
    feature_snapshot: {},
    artifact_versions: {},
  };
}

// =============================================================================
// Main wiring function
// =============================================================================

export async function logV7aShadowFromPrediction(
  pred: V7aPredictionInput,
  ctx: WiringContext,
  deps: WiringDeps
): Promise<WiringResult> {
  const { env } = deps;

  // Early exit if not enabled — must be non-blocking
  if (env.V7A_SHADOW_LOG_ENABLED !== "true") {
    return { ok: true, skipped: true, reason: "disabled" };
  }
  if (env.V7A_SHADOW_LOG_ENVIRONMENT !== "staging") {
    return { ok: true, skipped: true, reason: "not_staging" };
  }

  // Staging Supabase client creation
  const url = env.STAGING_SUPABASE_URL;
  const key = env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { ok: true, skipped: true, reason: "staging_credentials_missing" };
  }

  let client: SupabaseLikeClient;
  if (deps.createClient) {
    client = deps.createClient(url, key);
  } else {
    // Default: import @supabase/supabase-js dynamically
    try {
      const { createClient: sc } = await import("@supabase/supabase-js");
      client = sc(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      }) as unknown as SupabaseLikeClient;
    } catch {
      return { ok: false, skipped: false, error: "supabase_import_failed" };
    }
  }

  // Convert prediction to log input
  const input = v7aPredictionToLogInput(pred, ctx);

  // Call adapter (which enforces all safety gates)
  const result: AdapterResult = await logV7aShadowDecisionIfEnabled(input, {
    env,
    client,
  });

  if (result.skipped) {
    return { ok: true, skipped: true, reason: (result as any).reason };
  }
  if (!result.ok) {
    return {
      ok: false,
      skipped: false,
      error: (result as any).error,
    };
  }
  return { ok: true, skipped: false, id: (result as any).id };
}
