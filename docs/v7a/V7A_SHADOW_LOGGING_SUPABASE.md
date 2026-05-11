# V7a Shadow Decision Logger — Supabase Module

> **Sprint:** `b1/v7a-shadow-logging-supabase`
> **Date:** 2026-05-11
> **Status:** Module created. No runtime wiring. No real Supabase calls.

## 1. Purpose

Provide a validated, injectable, server-side TypeScript module for writing V7a shadow decision logs to the `v7a_shadow_decision_logs` table via Supabase.

## 2. Scope

- Creates `lib/v7a/shadow-decision-logger.ts` with validation + insert logic.
- Creates `lib/v7a/shadow-decision-logger.test.ts` with 10 in-memory tests.
- Does NOT wire any app route, API handler, or cron job.
- Does NOT create a real Supabase client or import env secrets.
- Does NOT call real network or apply migrations.
- Does NOT enable AUTO_BUY.
- Does NOT touch payment/checkout/escrow code.

## 3. Logger API

```typescript
// Types
type V7aShadowAction = "ABSTAIN" | "BUY_NOW" | "ALERT" | "MONITOR" | "WAIT";

interface V7aShadowDecisionLogInput { ... }  // mirrors JSON schema
interface V7aShadowDecisionLogResult {
  ok: boolean;
  inserted: boolean;
  id?: string;
  error?: string;
  validation_errors?: string[];
}

// Validation
function validateV7aShadowDecisionLog(input): { valid: boolean; errors: string[] }

// Insert (dependency-injected Supabase client)
async function logV7aShadowDecision(
  client: SupabaseLikeClient,
  input: V7aShadowDecisionLogInput
): Promise<V7aShadowDecisionLogResult>
```

## 4. Validation Rules

| Rule | Constraint |
| --- | --- |
| `action` | Must be ABSTAIN, BUY_NOW, ALERT, MONITOR, or WAIT |
| `action` | Must NOT be AUTO_BUY |
| `can_autobuy` | Must be `false` |
| `score_autobuy` | Must be `0` |
| `environment` | Must be local, staging, production, or test |
| `drop_proba` | Between 0 and 1 if present |
| `confidence` | Between 0 and 1 if present |
| `width_over_price` | >= 0 if present |
| `price_usd` | >= 0 if present |
| `decision_latency_ms` | >= 0 if present |
| `thresholds` | Non-null object |
| `decision_reasons` | Array |
| `route` | Non-empty string |
| `policy_version` | Non-empty string |

## 5. Supabase Insert Contract

```typescript
client
  .from("v7a_shadow_decision_logs")
  .insert(payload)
  .select("id")
  .single()
```

- Uses dependency injection — caller provides the Supabase client.
- No env vars are read by this module.
- `can_autobuy` is always set to `false` in the payload regardless of input.
- `score_autobuy` is always set to `0` in the payload regardless of input.

## 6. Test Strategy

10 tests using `node:assert/strict` with a fully in-memory mock client:

1. Accepts valid WAIT payload, calls insert once.
2. Rejects AUTO_BUY action.
3. Rejects `can_autobuy=true`.
4. Rejects `score_autobuy` non-zero.
5. Rejects `drop_proba > 1`.
6. Rejects negative `price_usd`.
7. Handles Supabase error, returns `ok=false`.
8. Verifies table name is `v7a_shadow_decision_logs`.
9. Verifies no payment/checkout/escrow fields in payload.
10. Verifies action enum excludes AUTO_BUY, includes 5 valid.

Run: `npx tsx lib/v7a/shadow-decision-logger.test.ts`

## 7. Safety Constraints

- **AUTO_BUY is rejected** by validation — cannot be logged.
- **can_autobuy is always false** in the written payload.
- **score_autobuy is always 0** in the written payload.
- No payment, checkout, escrow, or booking logic exists in this module.
- No real Supabase call is made (dependency injection).
- No env secrets are imported.
- No migration was applied.
- No Supabase CLI command was run.

## 8. Runtime Wiring Plan

Future sprint `b1/v7a-shadow-logging-runtime` will:
1. Import `logV7aShadowDecision` from this module.
2. Inject the existing service-role Supabase client (same pattern as `missions-db.ts`).
3. Call the logger from the watcher/cron path after each policy evaluation.
4. Gate with feature flag: `V7A_SHADOW_LOG_ENABLED=true`.
5. Not trigger any purchase, payment, or auto-buy.

## 9. Non-Goals

- No migration applied.
- No real Supabase call made.
- No app route wired.
- No payment/checkout/escrow code touched.
- No auto-buy enabled.
- No retraining.
- No Modal.
- Not production-ready.
- No npm/pnpm install required (uses existing deps).

## 10. Next Steps

- Merge this PR.
- Sprint `b1/v7a-shadow-logging-runtime`: wire the logger into the watcher cron.
- Sprint: add Supabase INSERT RLS policy for service role.
- Sprint: build analysis dashboard on logged decisions.
- Sprint: compare shadow decisions against observed outcomes.
- AUTO_BUY enablement requires a separate, gated sprint with explicit approval.
