/**
 * V7a Shadow Decision Logger.
 *
 * Pure server-side utility that validates and writes V7a shadow decision
 * logs to Supabase through an injected client. Does NOT create a real
 * Supabase client, import env secrets, or call real network.
 *
 * Sprint: b1/v7a-shadow-logging-supabase
 * Table: v7a_shadow_decision_logs (see migration 20260511000001)
 * Contract: contracts/v7a_shadow_decision_log.schema.json
 *
 * AUTO_BUY is intentionally rejected by validation.
 */

// =============================================================================
// Types
// =============================================================================

export type V7aShadowAction =
  | "ABSTAIN"
  | "BUY_NOW"
  | "ALERT"
  | "MONITOR"
  | "WAIT";

const VALID_ACTIONS: ReadonlySet<string> = new Set([
  "ABSTAIN",
  "BUY_NOW",
  "ALERT",
  "MONITOR",
  "WAIT",
]);

const VALID_ENVIRONMENTS: ReadonlySet<string> = new Set([
  "local",
  "staging",
  "production",
  "test",
]);

export interface V7aShadowDecisionLogInput {
  // Required
  route: string;
  action: string;
  policy_version: string;
  can_autobuy: boolean;
  score_autobuy: number;
  thresholds: Record<string, unknown>;
  decision_reasons: string[];

  // Optional context
  environment?: string;
  shadow_run_id?: string | null;
  trace_id?: string | null;
  mission_id?: string | null;
  user_id?: string | null;
  origin?: string | null;
  destination?: string | null;
  depart_date?: string | null;
  fetched_at?: string | null;
  ttd_days?: number | null;
  price_usd?: number | null;
  q10_gain?: number | null;
  q50_gain?: number | null;
  q90_gain?: number | null;
  c_alpha_gain?: number | null;
  width_over_price?: number | null;
  drop_proba?: number | null;
  q10_train_route?: number | null;
  route_known?: boolean | null;
  route_popularity?: number | null;
  confidence?: number | null;
  score_alert?: number | null;
  score_buy?: number | null;
  autobuy_enabled_input?: boolean;
  policy_source?: string;
  model_version?: string | null;
  feature_snapshot?: Record<string, unknown>;
  artifact_versions?: Record<string, unknown>;
  decision_latency_ms?: number | null;
  error_code?: string | null;
  error_message?: string | null;
}

export interface V7aShadowDecisionLogResult {
  ok: boolean;
  inserted: boolean;
  id?: string;
  error?: string;
  validation_errors?: string[];
}

// =============================================================================
// Supabase-like client interface (for dependency injection)
// =============================================================================

export interface SupabaseLikeInsertResult {
  data: { id: string } | null;
  error: { message: string } | null;
}

export interface SupabaseLikeQueryBuilder {
  insert(payload: Record<string, unknown>): {
    select(columns: string): {
      single(): Promise<SupabaseLikeInsertResult>;
    };
  };
}

export interface SupabaseLikeClient {
  from(table: string): SupabaseLikeQueryBuilder;
}

// =============================================================================
// Validation
// =============================================================================

export function validateV7aShadowDecisionLog(
  input: V7aShadowDecisionLogInput
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!input.route || typeof input.route !== "string" || input.route.trim() === "") {
    errors.push("route is required and must be a non-empty string");
  }
  if (!VALID_ACTIONS.has(input.action)) {
    errors.push(
      `action must be one of ${[...VALID_ACTIONS].join(", ")}; got "${input.action}"`
    );
  }
  if (input.action === "AUTO_BUY") {
    errors.push("AUTO_BUY is not permitted");
  }
  if (!input.policy_version || typeof input.policy_version !== "string") {
    errors.push("policy_version is required");
  }
  if (input.can_autobuy !== false) {
    errors.push("can_autobuy must be false");
  }
  if (input.score_autobuy !== 0) {
    errors.push("score_autobuy must be 0");
  }
  if (input.thresholds == null || typeof input.thresholds !== "object" || Array.isArray(input.thresholds)) {
    errors.push("thresholds must be a non-null object");
  }
  if (!Array.isArray(input.decision_reasons)) {
    errors.push("decision_reasons must be an array");
  }

  // Environment
  if (input.environment != null && !VALID_ENVIRONMENTS.has(input.environment)) {
    errors.push(
      `environment must be one of ${[...VALID_ENVIRONMENTS].join(", ")}; got "${input.environment}"`
    );
  }

  // Numeric range checks
  if (input.drop_proba != null && (input.drop_proba < 0 || input.drop_proba > 1)) {
    errors.push("drop_proba must be between 0 and 1");
  }
  if (input.confidence != null && (input.confidence < 0 || input.confidence > 1)) {
    errors.push("confidence must be between 0 and 1");
  }
  if (input.width_over_price != null && input.width_over_price < 0) {
    errors.push("width_over_price must be >= 0");
  }
  if (input.price_usd != null && input.price_usd < 0) {
    errors.push("price_usd must be >= 0");
  }
  if (input.decision_latency_ms != null && input.decision_latency_ms < 0) {
    errors.push("decision_latency_ms must be >= 0");
  }

  return { valid: errors.length === 0, errors };
}

// =============================================================================
// Logger
// =============================================================================

const TABLE_NAME = "v7a_shadow_decision_logs";

export async function logV7aShadowDecision(
  client: SupabaseLikeClient,
  input: V7aShadowDecisionLogInput
): Promise<V7aShadowDecisionLogResult> {
  // Validate
  const { valid, errors } = validateV7aShadowDecisionLog(input);
  if (!valid) {
    return {
      ok: false,
      inserted: false,
      error: "validation_failed",
      validation_errors: errors,
    };
  }

  // Build insert payload
  const payload: Record<string, unknown> = {
    environment: input.environment ?? "local",
    shadow_run_id: input.shadow_run_id ?? null,
    trace_id: input.trace_id ?? null,
    mission_id: input.mission_id ?? null,
    user_id: input.user_id ?? null,
    route: input.route,
    origin: input.origin ?? null,
    destination: input.destination ?? null,
    depart_date: input.depart_date ?? null,
    fetched_at: input.fetched_at ?? null,
    ttd_days: input.ttd_days ?? null,
    price_usd: input.price_usd ?? null,
    q10_gain: input.q10_gain ?? null,
    q50_gain: input.q50_gain ?? null,
    q90_gain: input.q90_gain ?? null,
    c_alpha_gain: input.c_alpha_gain ?? null,
    width_over_price: input.width_over_price ?? null,
    drop_proba: input.drop_proba ?? null,
    q10_train_route: input.q10_train_route ?? null,
    route_known: input.route_known ?? null,
    route_popularity: input.route_popularity ?? null,
    action: input.action,
    confidence: input.confidence ?? null,
    score_alert: input.score_alert ?? null,
    score_buy: input.score_buy ?? null,
    score_autobuy: 0,
    can_autobuy: false,
    autobuy_enabled_input: input.autobuy_enabled_input ?? false,
    policy_version: input.policy_version,
    policy_source: input.policy_source ?? "scripts/train/v7a/policy.py",
    model_version: input.model_version ?? null,
    thresholds: input.thresholds,
    decision_reasons: input.decision_reasons,
    feature_snapshot: input.feature_snapshot ?? {},
    artifact_versions: input.artifact_versions ?? {},
    decision_latency_ms: input.decision_latency_ms ?? null,
    error_code: input.error_code ?? null,
    error_message: input.error_message ?? null,
  };

  // Insert
  const { data, error } = await client
    .from(TABLE_NAME)
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    return {
      ok: false,
      inserted: false,
      error: error.message,
    };
  }

  return {
    ok: true,
    inserted: true,
    id: data?.id,
  };
}
