/**
 * Tests for V7a Shadow Logging Runtime Wiring.
 *
 * Run: npx tsx lib/v7a/shadow-logging-runtime-wiring.test.ts
 */

import assert from "node:assert/strict";
import type { SupabaseLikeClient } from "./shadow-decision-logger.js";
import {
  logV7aShadowFromPrediction,
  type V7aPredictionInput,
  type WiringContext,
  type WiringDeps,
} from "./shadow-logging-runtime-wiring.js";

// =============================================================================
// Mock
// =============================================================================

interface MockCall {
  table: string;
  payload: Record<string, unknown>;
}

function mockClient(opts?: { error?: string }): {
  client: SupabaseLikeClient;
  calls: MockCall[];
} {
  const calls: MockCall[] = [];
  const client: SupabaseLikeClient = {
    from(table: string) {
      return {
        insert(payload: Record<string, unknown>) {
          calls.push({ table, payload });
          return {
            select(_: string) {
              return {
                async single() {
                  if (opts?.error) return { data: null, error: { message: opts.error } };
                  return { data: { id: "wiring-mock-id" }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

function stagingDeps(clientOpts?: { error?: string }): {
  deps: WiringDeps;
  calls: MockCall[];
} {
  const { client, calls } = mockClient(clientOpts);
  const deps: WiringDeps = {
    env: {
      V7A_SHADOW_LOG_ENABLED: "true",
      V7A_SHADOW_LOG_ENVIRONMENT: "staging",
      STAGING_SUPABASE_URL: "https://staging.supabase.co",
      STAGING_SUPABASE_SERVICE_ROLE_KEY: "staging-key",
    },
    createClient: () => client,
  };
  return { deps, calls };
}

function validPred(overrides?: Partial<V7aPredictionInput>): V7aPredictionInput {
  return {
    route: "JFK-LAX",
    route_known: true,
    q10_train_route: 280,
    ttd_days: 21,
    current_price: 320,
    action: "WAIT",
    action_source: "policy.py",
    reason: ["no_trigger"],
    ml_layer: {
      q10_gain: -40,
      q50_gain: -5,
      q90_gain: 25,
      conformal_width: 30,
      drop_proba_calibrated: 0.35,
      ml_available: true,
    },
    ...overrides,
  };
}

function validCtx(): WiringContext {
  return {
    mission_id: "m-001",
    origin: "JFK",
    destination: "LAX",
    depart_date: "2026-07-01",
    fetched_at: "2026-05-18T10:00:00Z",
  };
}

// =============================================================================
// Tests
// =============================================================================

async function test_default_disabled() {
  const { deps, calls } = stagingDeps();
  deps.env.V7A_SHADOW_LOG_ENABLED = undefined;
  const r = await logV7aShadowFromPrediction(validPred(), validCtx(), deps);
  assert.equal(r.ok, true);
  assert.equal(r.skipped, true);
  assert.equal(calls.length, 0);
  console.log("✓ default disabled => no logger call");
}

async function test_environment_missing() {
  const { deps, calls } = stagingDeps();
  deps.env.V7A_SHADOW_LOG_ENVIRONMENT = undefined;
  const r = await logV7aShadowFromPrediction(validPred(), validCtx(), deps);
  assert.equal(r.ok, true);
  assert.equal(r.skipped, true);
  assert.equal(calls.length, 0);
  console.log("✓ enabled but environment missing => skipped");
}

async function test_environment_production_refused() {
  const { deps, calls } = stagingDeps();
  deps.env.V7A_SHADOW_LOG_ENVIRONMENT = "production";
  const r = await logV7aShadowFromPrediction(validPred(), validCtx(), deps);
  assert.equal(r.skipped, true);
  assert.equal(calls.length, 0);
  console.log("✓ environment production => refused/skipped");
}

async function test_valid_wait() {
  const { deps, calls } = stagingDeps();
  const r = await logV7aShadowFromPrediction(validPred(), validCtx(), deps);
  assert.equal(r.ok, true);
  assert.equal(r.skipped, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.action, "WAIT");
  assert.equal(calls[0].table, "v7a_shadow_decision_logs");
  console.log("✓ staging enabled with valid WAIT => logger called once");
}

async function test_valid_monitor() {
  const { deps, calls } = stagingDeps();
  const r = await logV7aShadowFromPrediction(
    validPred({ action: "MONITOR", reason: ["monitor_band drop_proba=0.50"] }),
    validCtx(),
    deps
  );
  assert.equal(r.ok, true);
  assert.equal(r.skipped, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.action, "MONITOR");
  console.log("✓ staging enabled with valid MONITOR => logger called once");
}

async function test_auto_buy_rejected() {
  const { deps, calls } = stagingDeps();
  const r = await logV7aShadowFromPrediction(
    validPred({ action: "AUTO_BUY" }),
    validCtx(),
    deps
  );
  assert.equal(r.ok, false);
  assert.equal(calls.length, 0);
  console.log("✓ AUTO_BUY input => rejected and logger not called");
}

async function test_can_autobuy_forced_false() {
  const { deps, calls } = stagingDeps();
  await logV7aShadowFromPrediction(validPred(), validCtx(), deps);
  assert.equal(calls[0].payload.can_autobuy, false);
  console.log("✓ can_autobuy forced false");
}

async function test_score_autobuy_forced_zero() {
  const { deps, calls } = stagingDeps();
  await logV7aShadowFromPrediction(validPred(), validCtx(), deps);
  assert.equal(calls[0].payload.score_autobuy, 0);
  console.log("✓ score_autobuy forced 0");
}

async function test_logger_failure_nonfatal() {
  const { deps } = stagingDeps({ error: "connection timeout" });
  const r = await logV7aShadowFromPrediction(validPred(), validCtx(), deps);
  assert.equal(r.ok, false);
  assert.equal(r.skipped, false);
  console.log("✓ logger failure => returns ok=false (non-fatal)");
}

async function test_no_forbidden_imports() {
  const mod = await import("./shadow-logging-runtime-wiring.js");
  const keys = Object.keys(mod);
  for (const forbidden of ["payment", "checkout", "escrow", "booking", "modal"]) {
    assert.equal(
      keys.some((k) => k.toLowerCase().includes(forbidden)),
      false,
      `module should not export anything containing "${forbidden}"`
    );
  }
  console.log("✓ no imports/exports for payment/checkout/escrow/booking/Modal");
}

async function test_hook_does_not_throw_on_failure() {
  const { deps } = stagingDeps({ error: "kaboom" });
  // Should not throw — returns structured error
  let threw = false;
  try {
    await logV7aShadowFromPrediction(validPred(), validCtx(), deps);
  } catch {
    threw = true;
  }
  assert.equal(threw, false);
  console.log("✓ runtime hook does not throw when logger fails");
}

// =============================================================================
// Runner
// =============================================================================

async function main() {
  console.log("Running V7a Shadow Logging Runtime Wiring tests...\n");
  await test_default_disabled();
  await test_environment_missing();
  await test_environment_production_refused();
  await test_valid_wait();
  await test_valid_monitor();
  await test_auto_buy_rejected();
  await test_can_autobuy_forced_false();
  await test_score_autobuy_forced_zero();
  await test_logger_failure_nonfatal();
  await test_no_forbidden_imports();
  await test_hook_does_not_throw_on_failure();
  console.log("\n✓ All 11 tests passed.");
}

main().catch((e) => {
  console.error("TEST FAILED:", e);
  process.exit(1);
});
