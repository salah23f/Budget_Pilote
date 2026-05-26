/**
 * V7a Shadow Logging Runtime Adapter — staging only.
 *
 * Wraps the existing logV7aShadowDecision() with environment gate logic:
 * - Only runs if V7A_SHADOW_LOG_ENABLED=true
 * - Only runs if V7A_SHADOW_LOG_ENVIRONMENT=staging
 * - Refuses production environment
 * - Forces can_autobuy=false and score_autobuy=0
 * - Rejects AUTO_BUY action
 *
 * Sprint: b1/v7a-shadow-logging-runtime-adapter-staging
 * No payment, checkout, escrow, or auto-buy behavior.
 */

import type {
  V7aShadowDecisionLogInput,
  V7aShadowDecisionLogResult,
  SupabaseLikeClient,
} from "./shadow-decision-logger";
import { logV7aShadowDecision } from "./shadow-decision-logger";

// =============================================================================
// Types
// =============================================================================

export interface AdapterEnv {
  V7A_SHADOW_LOG_ENABLED?: string;
  V7A_SHADOW_LOG_ENVIRONMENT?: string;
}

export interface AdapterDeps {
  env: AdapterEnv;
  client: SupabaseLikeClient;
  now?: () => string;
}

export type AdapterResult =
  | { ok: true; skipped: false; id?: string }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; skipped: false; error: string; validation_errors?: string[] };

// =============================================================================
// Adapter
// =============================================================================

export async function logV7aShadowDecisionIfEnabled(
  input: V7aShadowDecisionLogInput,
  deps: AdapterDeps
): Promise<AdapterResult> {
  const { env, client } = deps;

  // Gate: feature flag must be explicitly enabled
  if (env.V7A_SHADOW_LOG_ENABLED !== "true") {
    return { ok: true, skipped: true, reason: "disabled" };
  }

  // Gate: environment must be staging
  if (env.V7A_SHADOW_LOG_ENVIRONMENT !== "staging") {
    return {
      ok: true,
      skipped: true,
      reason: `environment_not_staging:${env.V7A_SHADOW_LOG_ENVIRONMENT ?? "unset"}`,
    };
  }

  // Hard refuse production
  if (
    env.V7A_SHADOW_LOG_ENVIRONMENT === "production" ||
    input.environment === "production"
  ) {
    return {
      ok: false,
      skipped: false,
      error: "production_environment_refused",
    };
  }

  // Reject AUTO_BUY action
  if (input.action === "AUTO_BUY") {
    return {
      ok: false,
      skipped: false,
      error: "AUTO_BUY_action_rejected",
    };
  }

  // Force safety fields
  const safeInput: V7aShadowDecisionLogInput = {
    ...input,
    can_autobuy: false,
    score_autobuy: 0,
    environment: input.environment ?? "staging",
  };

  // Delegate to existing logger
  const result: V7aShadowDecisionLogResult = await logV7aShadowDecision(
    client,
    safeInput
  );

  if (result.ok) {
    return { ok: true, skipped: false, id: result.id };
  }
  return {
    ok: false,
    skipped: false,
    error: result.error ?? "unknown_logger_error",
    validation_errors: result.validation_errors,
  };
}
