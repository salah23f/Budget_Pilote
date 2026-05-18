#!/usr/bin/env npx tsx
/**
 * V7a Staging Shadow Log Smoke Test.
 *
 * Inserts a single safe WAIT decision into Flyeas STAGING Supabase,
 * then cleans it up (unless --keep-row is passed).
 *
 * REQUIRED env vars (STAGING only — never production):
 *   V7A_SHADOW_LOG_ENABLED=true
 *   V7A_SHADOW_LOG_ENVIRONMENT=staging
 *   STAGING_SUPABASE_URL=...
 *   STAGING_SUPABASE_SERVICE_ROLE_KEY=...
 *
 * REQUIRED flag:
 *   --confirm-staging-write
 *
 * Usage:
 *   npx tsx scripts/v7a/staging-shadow-log-smoke.ts --dry-run
 *   V7A_SHADOW_LOG_ENABLED=true V7A_SHADOW_LOG_ENVIRONMENT=staging \
 *     STAGING_SUPABASE_URL=... STAGING_SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/v7a/staging-shadow-log-smoke.ts --confirm-staging-write
 *
 * Sprint: b1/v7a-shadow-logging-runtime-adapter-staging
 * No payment. No checkout. No escrow. No auto-buy. No production.
 */

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const confirmWrite = args.includes("--confirm-staging-write");
const keepRow = args.includes("--keep-row");

// =============================================================================
// Safety gates
// =============================================================================

function fatal(msg: string): never {
  console.error(`FATAL: ${msg}`);
  process.exit(1);
}

// Never read production keys
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "WARNING: SUPABASE_SERVICE_ROLE_KEY is set. This script uses STAGING_SUPABASE_SERVICE_ROLE_KEY only."
  );
}
if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn(
    "WARNING: NEXT_PUBLIC_SUPABASE_URL is set. This script uses STAGING_SUPABASE_URL only."
  );
}

const env = {
  enabled: process.env.V7A_SHADOW_LOG_ENABLED,
  environment: process.env.V7A_SHADOW_LOG_ENVIRONMENT,
  url: process.env.STAGING_SUPABASE_URL,
  key: process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,
};

if (dryRun) {
  console.log("DRY RUN — no Supabase call will be made.\n");
  console.log("Environment check:");
  console.log(`  V7A_SHADOW_LOG_ENABLED = ${env.enabled ?? "(unset)"}`);
  console.log(`  V7A_SHADOW_LOG_ENVIRONMENT = ${env.environment ?? "(unset)"}`);
  console.log(`  STAGING_SUPABASE_URL = ${env.url ? "(set)" : "(unset)"}`);
  console.log(`  STAGING_SUPABASE_SERVICE_ROLE_KEY = ${env.key ? "(set)" : "(unset)"}`);
  console.log(`\nWould insert: action=WAIT, route=SMOKE-TEST, can_autobuy=false`);
  console.log("Pass --confirm-staging-write with all env vars to perform real insert.");
  process.exit(0);
}

if (!confirmWrite) {
  fatal("--confirm-staging-write flag is required for real inserts.");
}
if (env.enabled !== "true") {
  fatal("V7A_SHADOW_LOG_ENABLED must be 'true'.");
}
if (env.environment !== "staging") {
  fatal("V7A_SHADOW_LOG_ENVIRONMENT must be 'staging'.");
}
if (!env.url) {
  fatal("STAGING_SUPABASE_URL is not set.");
}
if (!env.key) {
  fatal("STAGING_SUPABASE_SERVICE_ROLE_KEY is not set.");
}

// =============================================================================
// Execute
// =============================================================================

async function main() {
  // Dynamic import to avoid loading supabase unless actually running
  const { createClient } = await import("@supabase/supabase-js");

  const supabase = createClient(env.url!, env.key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const traceId = `v7a-staging-runtime-smoke-${Date.now()}`;
  const payload = {
    environment: "staging" as const,
    shadow_run_id: "smoke-test",
    trace_id: traceId,
    route: "SMOKE-TEST",
    action: "WAIT",
    policy_version: "v7a-balanced-v2",
    can_autobuy: false,
    score_autobuy: 0,
    autobuy_enabled_input: false,
    thresholds: { smoke: true },
    decision_reasons: ["smoke_test_insert"],
    feature_snapshot: {},
    artifact_versions: {},
  };

  console.log(`Inserting WAIT decision with trace_id: ${traceId}`);

  const { data, error } = await supabase
    .from("v7a_shadow_decision_logs")
    .insert(payload)
    .select("id, action, can_autobuy, score_autobuy")
    .single();

  if (error) {
    console.error("INSERT FAILED:", error.message);
    process.exit(1);
  }

  console.log("INSERT SUCCESS:");
  console.log(`  id: ${data.id}`);
  console.log(`  action: ${data.action}`);
  console.log(`  can_autobuy: ${data.can_autobuy}`);
  console.log(`  score_autobuy: ${data.score_autobuy}`);
  console.log(`  trace_id: ${traceId}`);

  if (keepRow) {
    console.log("\n--keep-row passed. Row will NOT be deleted.");
  } else {
    console.log(`\nCleaning up: deleting rows with trace_id=${traceId}`);
    const { error: delErr, count } = await supabase
      .from("v7a_shadow_decision_logs")
      .delete()
      .eq("trace_id", traceId);

    if (delErr) {
      console.error("DELETE FAILED:", delErr.message);
      process.exit(1);
    }
    console.log(`Deleted. Cleanup complete.`);
  }

  console.log("\n✓ Smoke test passed.");
}

main().catch((e) => {
  console.error("UNEXPECTED ERROR:", e);
  process.exit(1);
});
