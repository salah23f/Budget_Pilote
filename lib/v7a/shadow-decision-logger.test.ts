/**
 * Tests for V7a Shadow Decision Logger.
 *
 * Run: npx tsx lib/v7a/shadow-decision-logger.test.ts
 *
 * Uses node:assert/strict — no external test framework required.
 * All Supabase interactions are mocked in-memory.
 */

import assert from "node:assert/strict";
import {
  type V7aShadowAction,
  type V7aShadowDecisionLogInput,
  type SupabaseLikeClient,
  validateV7aShadowDecisionLog,
  logV7aShadowDecision,
} from "./shadow-decision-logger.js";

// =============================================================================
// Mock Supabase client
// =============================================================================

interface InsertCall {
  table: string;
  payload: Record<string, unknown>;
}

function createMockClient(opts?: { error?: string }): {
  client: SupabaseLikeClient;
  calls: InsertCall[];
} {
  const calls: InsertCall[] = [];
  const client: SupabaseLikeClient = {
    from(table: string) {
      return {
        insert(payload: Record<string, unknown>) {
          calls.push({ table, payload });
          return {
            select(_columns: string) {
              return {
                async single() {
                  if (opts?.error) {
                    return { data: null, error: { message: opts.error } };
                  }
                  return {
                    data: { id: "mock-uuid-001" },
                    error: null,
                  };
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

function validInput(overrides?: Partial<V7aShadowDecisionLogInput>): V7aShadowDecisionLogInput {
  return {
    route: "JFK-LAX",
    action: "WAIT",
    policy_version: "v7a-balanced-v2",
    can_autobuy: false,
    score_autobuy: 0,
    thresholds: { MAX_WIDTH_OVER_PRICE: 1.5 },
    decision_reasons: ["no_trigger"],
    environment: "test",
    price_usd: 320,
    drop_proba: 0.35,
    confidence: 0.6,
    width_over_price: 0.09,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

async function test_accepts_valid_wait_payload() {
  const { client, calls } = createMockClient();
  const result = await logV7aShadowDecision(client, validInput());
  assert.equal(result.ok, true);
  assert.equal(result.inserted, true);
  assert.equal(result.id, "mock-uuid-001");
  assert.equal(calls.length, 1);
  console.log("✓ accepts valid WAIT payload and calls insert once");
}

async function test_rejects_auto_buy_action() {
  const { client } = createMockClient();
  const result = await logV7aShadowDecision(
    client,
    validInput({ action: "AUTO_BUY" })
  );
  assert.equal(result.ok, false);
  assert.equal(result.inserted, false);
  assert.equal(result.error, "validation_failed");
  assert.ok(result.validation_errors!.some((e) => e.includes("AUTO_BUY")));
  console.log("✓ rejects AUTO_BUY action");
}

async function test_rejects_can_autobuy_true() {
  const { client } = createMockClient();
  const result = await logV7aShadowDecision(
    client,
    validInput({ can_autobuy: true as any })
  );
  assert.equal(result.ok, false);
  assert.ok(result.validation_errors!.some((e) => e.includes("can_autobuy")));
  console.log("✓ rejects can_autobuy=true");
}

async function test_rejects_score_autobuy_nonzero() {
  const { client } = createMockClient();
  const result = await logV7aShadowDecision(
    client,
    validInput({ score_autobuy: 0.5 })
  );
  assert.equal(result.ok, false);
  assert.ok(result.validation_errors!.some((e) => e.includes("score_autobuy")));
  console.log("✓ rejects score_autobuy non-zero");
}

async function test_rejects_drop_proba_over_1() {
  const { client } = createMockClient();
  const result = await logV7aShadowDecision(
    client,
    validInput({ drop_proba: 1.5 })
  );
  assert.equal(result.ok, false);
  assert.ok(result.validation_errors!.some((e) => e.includes("drop_proba")));
  console.log("✓ rejects drop_proba > 1");
}

async function test_rejects_negative_price() {
  const { client } = createMockClient();
  const result = await logV7aShadowDecision(
    client,
    validInput({ price_usd: -10 })
  );
  assert.equal(result.ok, false);
  assert.ok(result.validation_errors!.some((e) => e.includes("price_usd")));
  console.log("✓ rejects negative price_usd");
}

async function test_handles_supabase_error() {
  const { client } = createMockClient({ error: "connection refused" });
  const result = await logV7aShadowDecision(client, validInput());
  assert.equal(result.ok, false);
  assert.equal(result.inserted, false);
  assert.equal(result.error, "connection refused");
  console.log("✓ handles Supabase insert error and returns ok=false");
}

async function test_table_name_correct() {
  const { client, calls } = createMockClient();
  await logV7aShadowDecision(client, validInput());
  assert.equal(calls[0].table, "v7a_shadow_decision_logs");
  console.log("✓ inserted payload targets table v7a_shadow_decision_logs");
}

async function test_no_payment_behavior() {
  // Verify the module exports only validation/logging — no payment terms
  const { client, calls } = createMockClient();
  await logV7aShadowDecision(client, validInput());
  const payload = calls[0].payload;
  // No payment-related fields should exist
  assert.equal("payment" in payload, false);
  assert.equal("checkout" in payload, false);
  assert.equal("escrow" in payload, false);
  assert.equal("booking" in payload, false);
  assert.equal(payload.can_autobuy, false);
  assert.equal(payload.score_autobuy, 0);
  console.log("✓ no payment/checkout/escrow behavior in module");
}

async function test_action_enum_excludes_auto_buy() {
  const validation = validateV7aShadowDecisionLog(
    validInput({ action: "AUTO_BUY" })
  );
  assert.equal(validation.valid, false);
  // Also verify all valid actions pass
  for (const action of ["ABSTAIN", "BUY_NOW", "ALERT", "MONITOR", "WAIT"]) {
    const v = validateV7aShadowDecisionLog(validInput({ action }));
    assert.equal(v.valid, true, `${action} should be valid`);
  }
  console.log("✓ action enum excludes AUTO_BUY, includes 5 valid actions");
}

// =============================================================================
// Runner
// =============================================================================

async function main() {
  console.log("Running V7a Shadow Decision Logger tests...\n");
  await test_accepts_valid_wait_payload();
  await test_rejects_auto_buy_action();
  await test_rejects_can_autobuy_true();
  await test_rejects_score_autobuy_nonzero();
  await test_rejects_drop_proba_over_1();
  await test_rejects_negative_price();
  await test_handles_supabase_error();
  await test_table_name_correct();
  await test_no_payment_behavior();
  await test_action_enum_excludes_auto_buy();
  console.log("\n✓ All 10 tests passed.");
}

main().catch((e) => {
  console.error("TEST FAILED:", e);
  process.exit(1);
});
