/**
 * Tests for V7a Shadow Logging Runtime Adapter.
 *
 * Run: npx tsx lib/v7a/shadow-logging-runtime-adapter.test.ts
 *
 * Uses node:assert/strict with in-memory mock client.
 */

import assert from "node:assert/strict";
import type { V7aShadowDecisionLogInput, SupabaseLikeClient } from "./shadow-decision-logger";
import { logV7aShadowDecisionIfEnabled, type AdapterDeps } from "./shadow-logging-runtime-adapter";

// =============================================================================
// Mock
// =============================================================================

interface MockCall {
  table: string;
  payload: Record<string, unknown>;
}

function createMockDeps(opts?: {
  env?: Record<string, string>;
  error?: string;
}): { deps: AdapterDeps; calls: MockCall[] } {
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
                  if (opts?.error) {
                    return { data: null, error: { message: opts.error } };
                  }
                  return { data: { id: "mock-id-001" }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  const deps: AdapterDeps = {
    env: {
      V7A_SHADOW_LOG_ENABLED: "true",
      V7A_SHADOW_LOG_ENVIRONMENT: "staging",
      ...opts?.env,
    },
    client,
  };
  return { deps, calls };
}

function validInput(overrides?: Partial<V7aShadowDecisionLogInput>): V7aShadowDecisionLogInput {
  return {
    route: "JFK-LAX",
    action: "WAIT",
    policy_version: "v7a-balanced-v2",
    can_autobuy: false,
    score_autobuy: 0,
    thresholds: { MAX_WIDTH_OVER_PRICE: 1.5 },
    decision_reasons: ["no_trigger"],
    environment: "staging",
    drop_proba: 0.35,
    confidence: 0.6,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

async function test_skips_when_enabled_missing() {
  const { deps, calls } = createMockDeps({ env: { V7A_SHADOW_LOG_ENVIRONMENT: "staging" } });
  delete (deps.env as any).V7A_SHADOW_LOG_ENABLED;
  const r = await logV7aShadowDecisionIfEnabled(validInput(), deps);
  assert.equal(r.ok, true);
  assert.equal(r.skipped, true);
  assert.equal(calls.length, 0);
  console.log("✓ skips when V7A_SHADOW_LOG_ENABLED is missing");
}

async function test_skips_when_enabled_false() {
  const { deps, calls } = createMockDeps({
    env: { V7A_SHADOW_LOG_ENABLED: "false", V7A_SHADOW_LOG_ENVIRONMENT: "staging" },
  });
  const r = await logV7aShadowDecisionIfEnabled(validInput(), deps);
  assert.equal(r.ok, true);
  assert.equal(r.skipped, true);
  assert.equal(calls.length, 0);
  console.log("✓ skips when V7A_SHADOW_LOG_ENABLED=false");
}

async function test_skips_when_environment_not_staging() {
  const { deps, calls } = createMockDeps({
    env: { V7A_SHADOW_LOG_ENABLED: "true", V7A_SHADOW_LOG_ENVIRONMENT: "local" },
  });
  const r = await logV7aShadowDecisionIfEnabled(validInput(), deps);
  assert.equal(r.ok, true);
  assert.equal(r.skipped, true);
  assert.equal(calls.length, 0);
  console.log("✓ skips when V7A_SHADOW_LOG_ENVIRONMENT is not staging");
}

async function test_refuses_production_environment() {
  const { deps, calls } = createMockDeps({
    env: { V7A_SHADOW_LOG_ENABLED: "true", V7A_SHADOW_LOG_ENVIRONMENT: "production" },
  });
  const r = await logV7aShadowDecisionIfEnabled(validInput(), deps);
  // environment gate catches it before production-refuse fires
  assert.equal(r.ok, true);
  assert.equal(r.skipped, true);
  assert.equal(calls.length, 0);
  // Also test input.environment=production with staging gate
  const { deps: deps2, calls: calls2 } = createMockDeps();
  const r2 = await logV7aShadowDecisionIfEnabled(
    validInput({ environment: "production" }),
    deps2
  );
  assert.equal(r2.ok, false);
  if (!r2.skipped) assert.equal(r2.error, "production_environment_refused");
  assert.equal(calls2.length, 0);
  console.log("✓ refuses production environment");
}

async function test_rejects_auto_buy() {
  const { deps, calls } = createMockDeps();
  const r = await logV7aShadowDecisionIfEnabled(
    validInput({ action: "AUTO_BUY" }),
    deps
  );
  assert.equal(r.ok, false);
  if (!r.skipped) assert.equal(r.error, "AUTO_BUY_action_rejected");
  assert.equal(calls.length, 0);
  console.log("✓ rejects AUTO_BUY");
}

async function test_forces_can_autobuy_false() {
  const { deps, calls } = createMockDeps();
  await logV7aShadowDecisionIfEnabled(
    validInput({ can_autobuy: true as any }),
    deps
  );
  assert.equal(calls[0].payload.can_autobuy, false);
  console.log("✓ forces can_autobuy=false");
}

async function test_forces_score_autobuy_zero() {
  const { deps, calls } = createMockDeps();
  await logV7aShadowDecisionIfEnabled(
    validInput({ score_autobuy: 99 }),
    deps
  );
  assert.equal(calls[0].payload.score_autobuy, 0);
  console.log("✓ forces score_autobuy=0");
}

async function test_passes_valid_wait() {
  const { deps, calls } = createMockDeps();
  const r = await logV7aShadowDecisionIfEnabled(validInput(), deps);
  assert.equal(r.ok, true);
  assert.equal(r.skipped, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].table, "v7a_shadow_decision_logs");
  assert.equal(calls[0].payload.action, "WAIT");
  console.log("✓ passes valid WAIT payload to logger exactly once");
}

async function test_passes_valid_monitor() {
  const { deps, calls } = createMockDeps();
  const r = await logV7aShadowDecisionIfEnabled(
    validInput({ action: "MONITOR", decision_reasons: ["monitor_band drop_proba=0.50"] }),
    deps
  );
  assert.equal(r.ok, true);
  assert.equal(r.skipped, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.action, "MONITOR");
  console.log("✓ passes valid MONITOR payload to logger exactly once");
}

async function test_handles_logger_failure() {
  const { deps } = createMockDeps({ error: "staging db unreachable" });
  const r = await logV7aShadowDecisionIfEnabled(validInput(), deps);
  assert.equal(r.ok, false);
  if (!r.skipped) assert.equal(r.error, "staging db unreachable");
  console.log("✓ handles logger failure and returns ok=false");
}

async function test_no_forbidden_imports() {
  // Verify by checking module exports — no payment/escrow terms
  const mod = await import("./shadow-logging-runtime-adapter");
  const keys = Object.keys(mod);
  for (const forbidden of ["payment", "checkout", "escrow", "modal", "purchase"]) {
    assert.equal(
      keys.some((k) => k.toLowerCase().includes(forbidden)),
      false,
      `module should not export anything containing "${forbidden}"`
    );
  }
  console.log("✓ does not export payment/checkout/escrow/modal terms");
}

// =============================================================================
// Runner
// =============================================================================

async function main() {
  console.log("Running V7a Shadow Logging Runtime Adapter tests...\n");
  await test_skips_when_enabled_missing();
  await test_skips_when_enabled_false();
  await test_skips_when_environment_not_staging();
  await test_refuses_production_environment();
  await test_rejects_auto_buy();
  await test_forces_can_autobuy_false();
  await test_forces_score_autobuy_zero();
  await test_passes_valid_wait();
  await test_passes_valid_monitor();
  await test_handles_logger_failure();
  await test_no_forbidden_imports();
  console.log("\n✓ All 11 tests passed.");
}

main().catch((e) => {
  console.error("TEST FAILED:", e);
  process.exit(1);
});
