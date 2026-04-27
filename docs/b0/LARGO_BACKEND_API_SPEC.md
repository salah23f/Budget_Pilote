# LARGO_BACKEND_API_SPEC

**Document type :** B0 documentary specification
**Status :** Draft, frozen for B0
**Version :** 0.1.0
**Last updated :** 2026-04-27
**Scope :** Future backend / API of Largo. Not implemented. No code shipped from this document.

This document specifies the **future** backend and API surface of Largo. It is intentionally written **before** code, before migrations, before endpoint implementation, before deployment. It defines the rules the implementation must obey, not the implementation itself.

Cross-document dependencies (must remain consistent) :

- `LARGO_DOMINATION_STRATEGY.md`
- `LARGO_PRODUCT_VISION.md`
- `LARGO_ADVICE_CONTRACT.md`
- `LARGO_EVALUATION_PLAN.md`
- `LARGO_SECURITY_PAYMENTS.md`
- `LARGO_DATA_STRATEGY.md`
- `LARGO_MODEL_STRATEGY.md`

Anchors preserved across all docs :

- `LargoAdvice` contract version `0.1.0`
- `AuditBlock` is a separate, minimal envelope : `audit_id`, `parent_advice_id`
- `audit_id === advice_id` in Phase 1
- Phase 1 = flights only
- Phase 1 = no silent auto-buy
- ABSTAIN is a first-class product state, not an error
- Numeric confidence is internal/admin only, never customer UI
- Provider and observed price may be null — never coerced to 0
- V7a remains the active baseline (anchor 2026-04-25)

---

## 0. Document scope

This document does **not** :

- Create endpoints
- Generate Supabase migrations
- Touch `.env*` files
- Modify the watcher, V7a, V7.6 Ultra scripts, Modal, or crons
- Write implementation code
- Decide infrastructure deployment

This document **does** :

- Specify the backend surface Largo will eventually expose
- Pin trust boundaries
- Pin error semantics
- Pin idempotency keys
- Pin audit construction rules
- Pin Phase 1 / Phase 2 / Phase 3 promotion gates
- Pin forbidden backend patterns

If a future implementation contradicts this document, the document wins until the document is amended through B0 review.

---

## 1. Backend philosophy

Five principles. Non-negotiable.

1. **The server is the authority.** Every safety-relevant value (price, confidence, recommendation, `can_autobuy`, audit) is computed, validated, and stored server-side. The client renders. The client never decides.
2. **The frontend is untrusted.** Frontend state is treated as adversarial input. Any field received from the client is re-validated, re-typed, re-bounded server-side before use.
3. **The ML output is semi-trusted.** Model predictions are inputs to a server-side decision policy. They are validated, gated, and capable of being overridden by the rule layer or by ABSTAIN.
4. **Audit is append-only.** Once written, an audit row is immutable. Anonymization is the only future mutation, and only under a separately documented policy.
5. **Fail loud, fail safe.** Ambiguity returns ABSTAIN with a reason. Failure of payment/auto-buy returns 503 with a stable error code. Silent fallback to BUY_NOW is forbidden.

Inversion of trust : the more dangerous the action, the more the backend must distrust everyone — including its own ML.

---

## 2. System responsibilities

What the backend **must own** :

| Responsibility | Why |
|---|---|
| `LargoAdvice` generation | Single source of truth, schema-validated |
| AuditBlock construction | Append-only chain of decisions |
| Confidence computation | Calibrated, internal-only numeric |
| Identity / session management | RBAC, MFA, RLS |
| Rate limiting | Cost protection + abuse protection |
| Provider calls | Tokens never reach client |
| Payment authorization decisions | Backend gates capture, not Stripe |
| Kill switch enforcement | Centralized, env-driven |
| Idempotency enforcement | Server-side keyed |
| Latency budgets / fallback selection | Server timing, not client timing |

What the backend **may delegate to the frontend** :

| Delegated | Conditions |
|---|---|
| Rendering of customer-safe advice | Backend strips admin fields first |
| UX timing of confirmation modal | Backend still enforces TTL via `valid_until` |
| Display caching (read-only) | No mutation, no derivation |
| Optimistic UI for non-safety-critical reads | Server reconciles on next call |

What the frontend **must never** do :

- Compute price, confidence, `can_autobuy`, or any audit field
- Hold a Stripe secret key
- Hold a provider API token
- Decide whether to capture payment
- Override an ABSTAIN

---

## 3. Trust boundaries

Layered trust model :

| Tier | Examples | Treatment |
|---|---|---|
| Untrusted | Anonymous user, public client, unauthenticated request | Re-validate everything, rate-limit hard, no PII access |
| Semi-trusted | Authenticated user (JWT verified) | Re-validate fields, RLS enforced, scope-checked |
| Semi-trusted | ML model output | Schema-validated, ranges enforced, can be overridden by rule layer |
| Semi-trusted | Provider responses | Schema-validated, disagreement-checked, freshness-checked |
| Trusted | Backend services (Largo API process) | Internal mTLS or process-level isolation, secrets in env |
| Trusted | Stripe webhook **after** signature verification | Pre-verification = untrusted |
| Fully trusted | Append-only audit table | Immutable, rotation only via documented anonymization |
| Fully trusted | Kill switches (env-driven) | Reading them never fails open |

Crossing a boundary upward (from untrusted → trusted) requires : authentication, validation, RLS, rate-limit pass, idempotency check.

---

## 4. API surface overview

All Largo endpoints live under `/api/largo/`. Three tiers :

| Tier | Path prefix | Auth | Phase 1 status |
|---|---|---|---|
| Public | `/api/largo/*` (advice only) | Anonymous tolerated with quota | Active |
| Authenticated | `/api/largo/missions/*`, `/api/largo/payments/*`, `/api/largo/autobuy/*` | Supabase Auth JWT | Mixed (advice active, payments/autobuy disabled) |
| Admin | `/api/largo/admin/*` | Admin role + MFA + IP allowlist | Active for read-only audit, disabled for mutations |

A non-Largo endpoint (e.g. existing flight search, watcher API) is **out of scope** for this document. This spec does not modify them.

---

## 5. Endpoint naming policy

- All Largo endpoints prefixed `/api/largo/`.
- Resource-style for entities : `/missions/:mission_id`, `/advice/:advice_id`.
- Verb-noun for explicit actions : `/autobuy/confirm`, `/payments/capture`, `/missions/:mission_id/cancel`.
- No mixed style within an endpoint family.
- Versioning is **not** in the path. Schema version travels in the payload (`schema_version: "0.1.0"`).
- Breaking changes will introduce a parallel endpoint family (`/api/largo/v2/...`) only when the contract version changes.
- Plural for collections, singular for actions.

Counter-examples (forbidden) :

- `/api/getLargoAdvice` (verb in path for resource read)
- `/api/largo/v0.1.0/advice` (version in URL for non-breaking change)
- `/api/largo/buyNow` (camelCase + ambiguous)

---

## 6. Authentication and authorization

Authentication :

- Supabase Auth as primary identity provider.
- Bearer JWT (Supabase-issued) on the `Authorization` header.
- Anonymous requests permitted **only** for simple search advice, gated by quota (Section 7).
- Service-to-service (admin tools, internal cron) uses a service role JWT, never exposed client-side.

Authorization (RBAC) :

| Role | Capabilities |
|---|---|
| `anonymous` | Simple search advice (rate-limited), no PII, no mission, no payment |
| `user` | All `anonymous` + missions (create/read/update/cancel own), advice history (own) |
| `paying_user` | All `user` + payment preauth/capture (Phase 2+) |
| `admin` | All read surfaces + admin audit views, **no** customer-impact mutations without 4-eyes |
| `sre` | Read-only observability, kill-switch toggle (logged + alerted) |
| `finance` | Read-only payment / refund / dispute surfaces |

All admin endpoints require :

- Authenticated session
- `admin` role
- MFA verified within session
- Source IP within allowlist (production only)

RLS enforced at the Supabase layer : a `user` cannot read another user's advice, mission, or audit. Admin reads bypass RLS via service role and are themselves audited.

---

## 7. Anonymous search quota

Anonymous simple search is allowed because it is the funnel into trust. Quota protects cost and prevents abuse :

| Dimension | Limit (Phase 1 default) | Action on exceed |
|---|---|---|
| Per IP | 30 advice requests / hour | 429 + `Retry-After` |
| Per fingerprint (cookie or header) | 60 advice requests / hour | 429 + `Retry-After` |
| Global anonymous (across all IPs) | Configurable cap, sliding window | 503 LARGO_RATE_LIMITED |

Window : sliding 1-hour and 1-minute (burst protection).

When rate-limited :

- Return HTTP 429 with stable error code `LARGO_RATE_LIMITED`
- Include `Retry-After` header
- Do **not** return advice
- Do **not** silently degrade to a cached or fake advice
- Do log the rate-limit event with anonymized identifiers

Anonymous quota is **not** a substitute for ABSTAIN. Quota is operational. ABSTAIN is epistemic.

---

## 8. Rate limiting

Multi-tier strategy :

1. **Per IP** — first line, blunt, cheap.
2. **Per user (authenticated)** — finer, scoped to JWT subject.
3. **Per endpoint family** — payment endpoints stricter than advice.
4. **Per route in payload** — same `(origin, destination)` from same actor capped to prevent provider hammering.
5. **Global** — circuit breaker for systemic abuse.

Headers exposed (when applicable) :

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After`

Stricter limits :

| Endpoint family | Authenticated user limit (Phase 1 default) |
|---|---|
| `/advice` | 120 / hour |
| `/missions/*` | 60 / hour |
| `/payments/*` | 10 / hour (Phase 2 active) |
| `/autobuy/*` | 5 / hour (Phase 3 active) |
| `/admin/*` | 200 / hour, IP-bound |

Concrete numbers will be tuned in Phase 1 from real traffic and live in env, not in code.

---

## 9. Request validation

Every endpoint validates input at the edge before any business logic :

- Schema = Zod (or equivalent) defined per endpoint.
- Strict mode : unknown fields rejected with `LARGO_INTERNAL_ERROR` or 400 depending on cause.
- Typed primitives : ISO 4217 currency, IATA airport (3 letters, allowlist-validated), ISO 8601 UTC timestamps, ULID for IDs.
- Bounded ranges : passenger count 1–9, dates within plausible window, amounts within currency-appropriate bounds.
- Length limits : free-text fields capped to prevent abuse.
- Reject silently-truncated UTF-8.
- Reject duplicate query parameters.
- Reject body for GET.

Validation failures return HTTP 400 with a stable error code and a customer-safe message. The admin-only detail field carries the field path and reason.

---

## 10. Response validation

Every response that includes `LargoAdvice` is validated against the v0.1.0 schema **before** being sent :

- If invalid → 500 with `LARGO_INTERNAL_ERROR`, audit row marked `schema_invalid`.
- The customer-safe view is the result of a strip transform applied to the full advice. The strip is server-side, deterministic, and version-locked.
- The full advice (including `confidence.numeric_value`, `technical_details`, full `AuditBlock`) is **never** sent to a customer surface.

Strip rules (high level) — full list in `LARGO_ADVICE_CONTRACT.md` :

| Field | Customer view | Admin view |
|---|---|---|
| `recommendation` | yes | yes |
| `recommendation_reason_code` | yes | yes |
| `recommendation_human_summary` | yes | yes |
| `confidence.label` (e.g. low/medium/high) | yes | yes |
| `confidence.numeric_value` | **no** | yes |
| `confidence.calibration_meta` | **no** | yes |
| `observed_price_usd` | yes (or null) | yes |
| `provider.primary_provider` | yes (or null) | yes |
| `provider.disagreement` | summarized only | full |
| `valid_until` | yes | yes |
| `schema_version` | yes | yes |
| `audit_block.audit_id` | **no** | yes |
| `audit_block.parent_advice_id` | **no** | yes |
| `technical_details.*` | **no** | yes |

Customer view never contains numeric confidence. Stripping is enforced by a server middleware, not by the caller.

---

## 11. LargoAdvice generation flow

Sequential, server-side. No step is optional. No step is client-driven.

1. **Validate input** (Section 9). Reject early.
2. **Resolve actor context** : anonymous vs authenticated, mission link if any, role, rate-limit pass.
3. **Snapshot the request** : `request_id` (ULID), timestamp UTC, kill-switch status snapshot.
4. **Fetch live price** via provider chain (Section 20). May return `null` (Section 31).
5. **Call ML model** if enabled and route in scope (Section 21). May return ABSTAIN.
6. **Apply rule layer** (always present, deterministic). Rules can override ML toward ABSTAIN, never toward BUY_NOW silently.
7. **Compute confidence** : numeric (internal) + label (customer). Calibrated per `LARGO_MODEL_STRATEGY.md`.
8. **Decide recommendation** via decision policy : BUY_NOW / WAIT / ABSTAIN.
9. **Construct AuditBlock** : `audit_id` = `advice_id` (Phase 1), `parent_advice_id` if mission has prior advice.
10. **Persist audit row** to `largo_advices` (append-only). On DB failure, return 503, do not return uncached advice.
11. **Persist event** to `largo_advice_events` (Section 23).
12. **Strip to customer view** (Section 10).
13. **Return response** with `schema_version: "0.1.0"`, `valid_until` populated.

If any step times out beyond the latency budget (Section 36), the flow degrades to ABSTAIN with the appropriate reason code, audit row still written.

---

## 12. Simple search advice endpoint

`POST /api/largo/advice`

| Property | Value |
|---|---|
| Phase | 1 active |
| Auth | Anonymous tolerated, authenticated preferred |
| Rate limit | Per Section 7 / 8 |
| Request | `{origin, destination, depart_date, return_date?, passengers?, currency?}` |
| Response | `LargoAdvice` (customer-safe view) |
| Idempotency | Optional `Idempotency-Key` header |
| Side effects | Writes `largo_advices` row + `largo_advice_events` row |

Constraints :

- One-shot. No mission attachment.
- No price persisted beyond the audit row.
- No provider tokens leaked to response.
- ABSTAIN is a 200 response, not an error.

---

## 13. Mission advice endpoint

`POST /api/largo/missions/:mission_id/advice`

| Property | Value |
|---|---|
| Phase | 1 active |
| Auth | Authenticated user, mission owner only |
| Rate limit | Per user, stricter than simple search |
| Request | `{snapshot_intent?, refresh?: boolean}` |
| Response | `LargoAdvice` (customer-safe view) |
| Idempotency | `Idempotency-Key` recommended |
| Side effects | Writes `largo_advices` row, links to mission, writes `largo_mission_events` row |

Constraints :

- Mission must exist and belong to the actor.
- Advice is linked via `parent_advice_id` chain when refreshing.
- The mission's intent snapshot binds the advice (cannot change destination silently between advices).

---

## 14. Mission creation / update / cancel future endpoints

| Endpoint | Phase | Auth | Notes |
|---|---|---|---|
| `POST /api/largo/missions` | 1 minimal, 2 expanded | User | Create mission with intent, budget, constraints |
| `GET /api/largo/missions/:mission_id` | 1 active | User (own) or admin | Read mission |
| `GET /api/largo/missions` | 1 active | User (own) | List own missions, paginated |
| `PATCH /api/largo/missions/:mission_id` | 1 limited, 2 expanded | User (own) | Update budget / constraints / dates window |
| `POST /api/largo/missions/:mission_id/cancel` | 1 active | User (own) or admin | Soft-cancel, append event |

Constraints :

- Mission cancellation is soft : status changes, audit event written, no row deletion.
- Concurrent updates resolved via optimistic locking (`mission.version` field).
- Date / budget changes invalidate prior advice freshness but never delete prior advice rows.

---

## 15. Advice history endpoint

`GET /api/largo/missions/:mission_id/advices`

| Property | Value |
|---|---|
| Phase | 1 active |
| Auth | Mission owner or admin |
| Pagination | Cursor-based, server-issued cursor |
| Sort | `created_at DESC` only |
| Response | Array of customer-safe `LargoAdvice` views + chain metadata (`parent_advice_id`) |

Customer view, not full audit. Admin view of the same chain is at `/api/largo/admin/missions/:mission_id/audit`.

---

## 16. Audit endpoint / admin-only surfaces

| Endpoint | Phase | Auth | Notes |
|---|---|---|---|
| `GET /api/largo/admin/advices/:advice_id` | 1 active | Admin + MFA | Full advice including numeric confidence and audit_block |
| `GET /api/largo/admin/audit/:audit_id` | 1 active | Admin + MFA | Audit envelope only |
| `GET /api/largo/admin/missions/:mission_id/audit` | 1 active | Admin + MFA | Full chain for the mission |
| `GET /api/largo/admin/payments/:attempt_id` | 2 | Admin + finance + MFA | Payment attempt detail |
| `GET /api/largo/admin/model_runs/:run_id` | 1 active | Admin + MFA | Model run snapshot for reproducibility |
| `GET /api/largo/admin/evaluation_snapshots/:snapshot_id` | 1 active | Admin + MFA | Evaluation snapshot reference |

Admin surfaces are read-only by default. Mutations (re-issuance, refund, anonymization) are separate, more strictly gated, and out of Phase 1 scope.

---

## 17. Auto-buy confirmation endpoint future spec

`POST /api/largo/autobuy/confirm`

**Phase 1 status : disabled.** Endpoint exists for forward-compatibility but always returns :

```
HTTP 503
{ "error_code": "LARGO_AUTOBUY_BLOCKED", "reason": "phase_1_disabled" }
```

Future (Phase 3+) requirements before any 200 response :

1. Kill switch `LARGO_KILL_AUTOBUY` is OFF.
2. Caller is authenticated and `paying_user`.
3. Referenced `advice_id` exists, belongs to caller, is **not expired** (`valid_until > now`).
4. Server re-fetches live price and re-validates against advice price within tolerance band.
5. Provider disagreement check passes.
6. Confidence label is at the threshold required by `LARGO_SECURITY_PAYMENTS.md` (15-condition stack).
7. Idempotency key matches `audit_id` of the parent advice.
8. Audit row for the auto-buy attempt is written **before** any payment intent is created.
9. Confirmation TTL (60s, anti-dark-pattern) has not elapsed.
10. User explicit confirmation is recorded with timestamp.

Failure of any of the 10 → ABSTAIN-equivalent : 409 with stable error code, no payment intent created, audit row written.

---

## 18. Payment pre-authorization endpoint future spec

`POST /api/largo/payments/preauthorize`

**Phase 1 status : disabled.** Returns :

```
HTTP 503
{ "error_code": "LARGO_PAYMENT_DISABLED", "reason": "phase_1_disabled" }
```

Future (Phase 2+) :

| Aspect | Rule |
|---|---|
| Stripe mode | Payment Intent with `capture_method: manual` |
| Idempotency key | Server-generated, equals `audit_id` of the auto-buy attempt |
| Amount | Server-revalidated against fresh provider quote |
| Currency | ISO 4217, locked to advice currency |
| Customer | Stripe Customer scoped to authenticated user only |
| Card data | Never touches our server. Stripe Elements client-side only |
| Logging | Stripe `payment_intent_id` logged. Card fingerprint OK. PAN, CVV, full expiry **never logged** |

`POST /api/largo/payments/capture` follows the same model with `capture` action, idempotent on the same `audit_id`. Capture without an existing audit row is rejected with `LARGO_AUTOBUY_BLOCKED`.

---

## 19. Webhook handling policy

`POST /api/largo/webhooks/stripe`

Hard rules :

1. **Signature verification first.** Before any parsing, validate the Stripe-Signature header. Failure → 400, no processing.
2. **Idempotency by event ID.** Stripe `event.id` is the natural key. Replay → no-op, return 200.
3. **Append-only event log.** All webhook events written to `largo_payment_attempts` events sub-table.
4. **No outbound side effects until verification.** Do not query DB, do not log payload contents until signature verified.
5. **Secret rotation supported.** Two valid secrets accepted during rotation window.
6. **Timeouts respected.** Stripe expects 2xx within 30s. Heavy processing offloaded to async job (Phase 2+) with the webhook returning 200 after persisting raw event.

Non-Stripe webhooks : not in Phase 1 scope.

---

## 20. Provider chain integration

- Provider tokens stored in env, never in DB row, never returned in any response.
- Calls are server-side only. Frontend never has a provider token.
- Chain : ordered fallback, with timeout per provider (typically 600–900ms p95 budget per call).
- Disagreement detection : when ≥2 providers respond, prices are compared. Disagreement above tolerance is captured in `provider.disagreement` and feeds the decision policy.
- Caching : short TTL only (≤60s) for cost optimization, never for safety. Auto-buy must always re-fetch live, no cache hit allowed.
- Quotation hash : the raw provider response is hashed and stored in `largo_provider_observations` for audit reproducibility.
- Provider errors are logged with stable error codes. Provider 4xx ≠ provider 5xx ≠ provider timeout — distinct codes.
- A "provider chain exhausted" event yields `observed_price_usd = null` and ABSTAIN with `LARGO_PRICE_UNAVAILABLE`.

---

## 21. ML/model service integration

- ML lives behind a typed internal service (Phase 1 : co-located process or local function). External hosting (Modal etc.) is **out of scope** for Phase 1 and not addressed by this document.
- Calls are time-bounded by the latency budget (Section 36).
- ML output is validated : score in [0, 1], quantile shape valid, required fields present.
- ML failure / timeout / NaN → server falls back to V1 heuristic or returns ABSTAIN, per `LARGO_MODEL_STRATEGY.md`.
- ML never returns `recommendation` directly. The decision policy (server-side) maps ML output + rules + context to the final recommendation.
- Confidence is captured as numeric internal + label customer.
- Each ML call is recorded as a `largo_model_runs` event with model version, input hash, output hash, latency.

ML is **never** allowed to write to user-visible state. It is an input.

---

## 22. Supabase persistence policy

- Supabase is the system of record for advice, mission, audit, payment, evaluation.
- All writes go through the backend with the service role key. **No client-side write to advice / audit / payment / mission tables.**
- RLS policies enforced for read access scoped to user.
- Append-only tables (`largo_advices`, `largo_advice_events`, `largo_mission_events`, `largo_autobuy_audit`, `largo_provider_observations`, `largo_model_runs`) will have DB-level triggers (future) blocking UPDATE/DELETE except via documented anonymization role.
- Migrations are out of scope for B0. This document only specifies the **conceptual** future schema.
- Connection pool sized for Phase 1 expected concurrency (small). Phase 2 scaling addressed separately.

---

## 23. Future table inventory without migrations

These are conceptual table names. **No migration is created from this document.** The implementation phase will produce the actual DDL.

| Table | Purpose | Mutability |
|---|---|---|
| `largo_advices` | One row per `LargoAdvice` ever generated | Append-only |
| `largo_advice_events` | Lifecycle events of an advice (created, viewed, expired, refreshed) | Append-only |
| `largo_mission_events` | Lifecycle events of a mission (created, updated, cancelled, advice attached) | Append-only |
| `largo_payment_attempts` | Stripe Payment Intent attempts and their states | Append-only (state via separate event rows) |
| `largo_autobuy_audit` | Auto-buy decision and execution audit | Append-only |
| `largo_provider_observations` | Provider price quotations as seen at decision time | Append-only |
| `largo_model_runs` | Model invocations with version, input/output hashes, latency | Append-only |
| `largo_evaluation_snapshots` | Reference IDs of evaluation snapshots produced under `LARGO_EVALUATION_PLAN.md` | Append-only |

Append-only ≠ no DELETE forever. Anonymization is the only mutation, and only under a separately documented retention/PII policy (`LARGO_DATA_STRATEGY.md`).

---

## 24. Idempotency model

Every non-GET endpoint that mutates state accepts and respects an `Idempotency-Key` header.

Behavior :

- The server stores `(idempotency_key, request_hash, response, expiry)`.
- Replay with same key + same request hash → returns cached response, no side effects.
- Replay with same key + different request hash → 409 with `LARGO_INTERNAL_ERROR` (mismatched replay).
- Window : 24 hours minimum for advice, 7 days for payments, 30 days for webhooks.

Idempotency key by endpoint :

| Endpoint | Idempotency key source |
|---|---|
| `POST /api/largo/advice` | Optional, client-provided |
| `POST /api/largo/missions/:mission_id/advice` | Optional, client-provided |
| `POST /api/largo/missions` | Optional, client-provided |
| `PATCH /api/largo/missions/:mission_id` | Required, client-provided |
| `POST /api/largo/missions/:mission_id/cancel` | Required, client-provided |
| `POST /api/largo/autobuy/confirm` | **Required**, equals `audit_id` of parent advice |
| `POST /api/largo/payments/preauthorize` | **Required**, equals `audit_id` of auto-buy attempt |
| `POST /api/largo/payments/capture` | **Required**, equals `audit_id` of auto-buy attempt |
| `POST /api/largo/webhooks/stripe` | Stripe `event.id` |

---

## 25. ULID generation policy

- All Largo IDs are ULID (128-bit, lexicographically sortable, timestamp-prefixed).
- Generated **server-side only**. Client-supplied IDs are rejected.
- Used for : `advice_id`, `audit_id`, `mission_id`, `event_id`, `model_run_id`, `payment_attempt_id`, `evaluation_snapshot_id`, `provider_observation_id`.
- ULID provides natural ordering by creation time without requiring a separate `created_at` index for sort.
- UUIDv7 acceptable as an equivalent if the implementation chooses, but ULID is the canonical choice.

---

## 26. AuditBlock handling

- `AuditBlock` is the minimal audit envelope embedded in `LargoAdvice` :

```
AuditBlock {
  audit_id: ULID
  parent_advice_id: ULID | null
}
```

- `audit_id` is generated server-side. **Never accepted from the client.**
- Phase 1 invariant : `audit_id === advice_id`. The two IDs are the same value. This is intentional : in Phase 1 there is no separate audit aggregation across advices.
- Phase 2+ may decouple them when multi-step auto-buy chains span multiple advices and a single audit envelope. The contract version will bump accordingly.
- `parent_advice_id` : set when the advice is a refresh / chained advice within a mission. Otherwise `null`.
- AuditBlock is **never modified after write**.
- AuditBlock chain forms a DAG per mission. Cycles are forbidden by construction (parent must precede child in time).

---

## 27. Error model

Every Largo error response has the shape :

```
{
  "error_code": "LARGO_*",       // stable, machine-readable
  "type": "validation|auth|business|system|payment|rate_limit",
  "customer_message": "...",      // safe to render
  "admin_detail": "..." | null,   // only in admin/internal logs, never in customer response
  "request_id": ULID,             // for support / debugging
  "retry_after_seconds": number?  // optional
}
```

Customer message is short, neutral, non-blaming. No stack trace. No internal field names. No model version. No provider name unless the error is provider-specific and the disclosure adds value.

HTTP status mapping :

| Class | Status |
|---|---|
| Validation | 400 |
| Auth required | 401 |
| Forbidden | 403 |
| Not found | 404 |
| Conflict / replay mismatch | 409 |
| Rate limited | 429 |
| Business gate (auto-buy disabled, payment disabled) | 503 |
| Provider chain exhausted | 503 (or 200 with ABSTAIN, see Section 30) |
| Internal error | 500 |

ABSTAIN is **not an error**. It is a 200 response with `recommendation: "ABSTAIN"`.

---

## 28. Error codes

| Code | Class | When | Customer-visible? |
|---|---|---|---|
| `LARGO_PRICE_UNAVAILABLE` | Business | Provider chain exhausted, no price | Yes (paired with ABSTAIN) |
| `LARGO_PROVIDER_DISAGREEMENT` | Business | Providers disagree beyond tolerance | Yes (paired with ABSTAIN) |
| `LARGO_ROUTE_UNKNOWN` | Validation | Origin/destination not in allowlist | Yes |
| `LARGO_ADVICE_EXPIRED` | Business | `valid_until` elapsed for the referenced advice | Yes |
| `LARGO_CONFIDENCE_UNAVAILABLE` | Business | Calibration absent for this route/segment | Yes (paired with ABSTAIN) |
| `LARGO_AUTOBUY_BLOCKED` | Business | Auto-buy disabled or condition stack failed | Yes |
| `LARGO_PAYMENT_DISABLED` | Business | Payment endpoint disabled in current phase | Yes |
| `LARGO_RATE_LIMITED` | Rate limit | Quota exceeded | Yes (with Retry-After) |
| `LARGO_UNAUTHORIZED` | Auth | Missing or invalid auth | Yes (terse) |
| `LARGO_FORBIDDEN` | Auth | Authenticated but lacks role / scope | Yes (terse) |
| `LARGO_INTERNAL_ERROR` | System | Unexpected server error | Yes (terse, request_id only) |

Codes are append-only. New codes are added; existing codes never change meaning.

---

## 29. Fallback behavior

| Failure | Fallback |
|---|---|
| Provider 1 timeout | Try Provider 2 |
| All providers exhausted | ABSTAIN with `LARGO_PRICE_UNAVAILABLE` |
| Provider returns suspicious price (zero, negative, outside band) | Treat as missing, ABSTAIN |
| ML timeout | V1 heuristic if confidence still meaningful, else ABSTAIN |
| ML returns invalid output | Discard, V1 fallback or ABSTAIN |
| Calibration missing for route | ABSTAIN with `LARGO_CONFIDENCE_UNAVAILABLE` |
| Stripe down | 503 `LARGO_PAYMENT_DISABLED` |
| Supabase down | 503 with retry-after |
| Kill switch ON for advice | 503 `LARGO_INTERNAL_ERROR` (never silent) |
| Kill switch ON for autobuy | `LARGO_AUTOBUY_BLOCKED` |
| Kill switch ON for payments | `LARGO_PAYMENT_DISABLED` |

**Forbidden fallback** : silent BUY_NOW. Under no failure condition does the server downgrade to BUY_NOW. Either WAIT or ABSTAIN. Never BUY_NOW by default.

---

## 30. ABSTAIN behavior

ABSTAIN is a **valid 200 response** with `recommendation: "ABSTAIN"`.

Properties :

- HTTP 200, not an error
- `recommendation_reason_code` populated (from a fixed enum)
- `confidence.label` may be `"unknown"` when calibration unavailable
- `observed_price_usd` may be present or null
- Audit row is written
- Customer-safe message explains the abstention without blame

ABSTAIN reason codes (subset, fixed enum, append-only) :

- `price_unavailable`
- `provider_disagreement`
- `confidence_unavailable`
- `route_out_of_scope`
- `data_freshness_failed`
- `model_unavailable`
- `policy_threshold_not_met`
- `kill_switch_active`

ABSTAIN must be **honest** (epistemic) not **lazy** (operational). A surge of `policy_threshold_not_met` without route-level reason is a kill criterion per `LARGO_MODEL_STRATEGY.md`.

---

## 31. Nullability and missing-data behavior

| Field | Nullable | If null, do not |
|---|---|---|
| `observed_price_usd` | yes | coerce to 0, fabricate, infer from cache |
| `provider.primary_provider` | yes | coerce to "unknown", fabricate, default to one |
| `confidence.numeric_value` (admin) | yes | coerce to 0.5, default, infer |
| `confidence.label` (customer) | yes | coerce to "medium" |
| `valid_until` | **no** | issue advice without `valid_until` |
| `schema_version` | **no** | issue advice without `schema_version` |
| `audit_block.audit_id` | **no** | issue advice without audit |
| `audit_block.parent_advice_id` | yes (top of chain) | invent a parent |

The principle from `LARGO_DATA_STRATEGY.md` propagates here : **missing is information**. The backend surfaces `null` and lets the decision policy and the customer message handle it explicitly.

---

## 32. Security headers / CORS / CSRF

Required response headers (production) :

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Content-Security-Policy: default-src 'self'; ...` (strict allowlist, no inline scripts on Largo surfaces)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: ...` (disable unused powerful APIs)
- `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`)

CORS :

- Allowlist : Largo frontend domain(s) only.
- No wildcard origin in production.
- Credentials allowed only for first-party origins.

CSRF :

- All state-changing requests require either a per-session CSRF token or a same-origin authentication scheme combined with `SameSite=Strict` (or `Lax` with explicit double-submit).
- Webhook endpoints exempt from CSRF (signature verification is the equivalent).

---

## 33. Secrets and env var policy

- Secrets are env-only. Never in code, never in DB, never in logs, never in client bundle, never in error messages.
- Per environment : `.env.local` (dev), `.env.staging`, `.env.production` — strictly separated.
- Rotation : quarterly minimum for provider tokens, on-demand for Stripe (after any incident).
- Deletion of `.env*.bak` files is the user's responsibility, not Claude's. Working-tree noise is noted but not acted on.
- Kill-switch env vars (Largo) :
  - `LARGO_KILL_ADVICE`
  - `LARGO_KILL_AUTOBUY`
  - `LARGO_KILL_PAYMENTS`
  - `LARGO_KILL_PROVIDER_<NAME>`
  - `LARGO_KILL_ML`
  - `LARGO_KILL_ANONYMOUS`
  - `LARGO_KILL_WEBHOOKS`
  - `LARGO_KILL_ADMIN`

Reading a kill switch must never fail open. If the env read errors, the safe default is "active" (i.e. blocking the dangerous action), never "off".

---

## 34. Logging and redaction

Structured JSON logs only. Free-form text discouraged.

Mandatory fields per log entry :

- `request_id` (ULID)
- `actor_type` (anonymous / user / admin / service)
- `actor_id_hash` (never raw user id in non-admin logs)
- `endpoint`
- `latency_ms`
- `status_code`
- `error_code` if applicable

Forbidden in logs :

- Raw email addresses (use hash)
- Raw passenger names
- Card PAN, CVV, full expiry
- Stripe customer secret keys, provider tokens
- Full provider payloads with personal data
- Numeric confidence in customer-facing log streams

A redaction middleware is applied before serialization. Bypass is forbidden.

---

## 35. Observability and traces

- Trace ID per request, propagated across internal hops (provider, ML, DB).
- Span per provider call, ML call, DB write.
- Metrics : request count, latency p50/p95/p99, error rate by code, ABSTAIN rate by reason, provider disagreement rate, kill-switch state changes.
- Alerting routes to Sentry / Slack / PagerDuty are out of scope for B0 but the metrics/tracing surface is fixed here so future ops integrates without redesign.
- Sampling : 100% for errors, 100% for payment/autobuy, 1–10% for normal advice depending on volume.

---

## 36. Latency budgets

Inherited from `LARGO_MODEL_STRATEGY.md`. The backend enforces them.

| Endpoint | p95 budget | Action on breach |
|---|---|---|
| `POST /api/largo/advice` (simple search) | 1.2 s | Degrade to ABSTAIN, audit reason `data_freshness_failed` |
| `POST /api/largo/missions/:mission_id/advice` | 800 ms | Degrade to V1 fallback or ABSTAIN |
| `POST /api/largo/autobuy/confirm` | 300 ms | Hard fail, no payment, `LARGO_AUTOBUY_BLOCKED` |
| `POST /api/largo/payments/*` | 500 ms client-perceived (Stripe budget separate) | Fail, no capture, audit |
| `GET /api/largo/admin/*` | 2 s | No degradation, log slow query |
| `POST /api/largo/webhooks/stripe` | 5 s (Stripe SLA buffer) | Acknowledge fast, defer heavy work |

p95 budgets are **server-side**. Network and frontend rendering are tracked separately.

---

## 37. Caching policy

| Layer | Cache? | TTL |
|---|---|---|
| Advice response (full) | **No** | n/a |
| Customer-safe view of past advice | Yes (CDN) | Until `valid_until` |
| Provider price | Yes (server-side, conservative) | ≤ 60 s, **bypassed for autobuy** |
| Static refs (airport list, currencies) | Yes | hours / day |
| Audit / payment / mission rows | **No** | n/a |
| ML model artifact | Yes (process-local) | until model version change |

Cache keys never include PII. Cache hits never bypass auth or RLS.

---

## 38. Queue / async jobs future policy

- Phase 1 : synchronous only.
- Phase 2 : queue introduced for slow ML batch tasks, model retraining triggers, evaluation snapshot generation, anonymization runs.
- All async jobs must be idempotent. Job key = ULID + job kind.
- Queue technology decision deferred. Vercel Queues, Supabase pg_boss, or external are all candidates. Choice does not affect this contract.
- No job is allowed to mutate audit rows.
- No job is allowed to send email or notification without going through a dedicated comms layer with its own audit trail.

---

## 39. Consistency model

| Operation | Consistency |
|---|---|
| Read own advice immediately after write | Read-your-writes (strong) |
| Read own mission after update | Read-your-writes (strong) |
| Cohort metrics (admin) | Eventual, refresh window documented |
| Payment state read after capture | Strong (linearizable per attempt) |
| Audit chain read | Strong (append-only, monotonic) |
| Cross-user analytics | Eventual |

The customer never observes payment in an ambiguous state. Either the capture is confirmed or the failure is confirmed. No "pending" surfaced to customer without explicit handling.

---

## 40. Concurrency and race condition handling

- **Mission updates** : optimistic locking via `mission.version`. Conflict → 409, client refreshes and retries.
- **Advice generation** : single-flight per `(actor, route, date_range)` short window (e.g. 2 s). Duplicate concurrent requests collapse to one ML/provider call, response shared.
- **Auto-buy / payment** : idempotency key required. Concurrent calls with same key collapse to one outcome.
- **Audit writes** : append-only, monotonic ULID, no ordering ambiguity.
- **Webhook replay** : event ID dedup at write boundary.
- **Race against expiry** : `valid_until` is checked server-side at every dependent action. Client-side TTL is advisory only.

Forbidden : "last write wins" on any payment or audit row. Either deduplicated by idempotency or rejected by version check.

---

## 41. Admin tools restrictions

- Admin endpoints require `admin` role + active MFA verification + IP allowlist (production).
- Mutations on production user data require 4-eyes (two distinct admins approving) for irreversible actions : refund, anonymization, mission deletion (if/when allowed), kill-switch toggle.
- Every admin action writes its own audit event with admin actor ID, intent, target, before/after.
- Admin tools never have a "force payment capture" button. There is no override for the auto-buy condition stack from the admin surface.
- Admin reads are also audited (less verbose than mutations) : who read which advice / payment when.

---

## 42. Testing strategy

| Layer | Coverage target |
|---|---|
| Unit | Validators, decision rules, audit construction, redaction, idempotency store |
| Integration | Provider chain (with stubbed providers), ML stub, Supabase test schema |
| Contract | `LargoAdvice` v0.1.0 schema enforced bidirectionally (request + response) |
| End-to-end | Limited Phase 1 : simple search → ABSTAIN, mission advice, advice history |
| Load | Phase 2+, focused on payment endpoints |
| Chaos | Phase 3+, focused on kill switches and provider failures |

Tests run in a separate Supabase project with its own schema. Production is never used as a test target.

---

## 43. Staging / prod separation

- Separate Supabase projects, separate DBs, separate connection strings.
- Separate Stripe accounts (or test mode for staging) with separate webhooks.
- Separate ML endpoints / model artifacts.
- Separate provider API tokens (sandbox where available).
- No shared secret across environments.
- No production data copied to staging without anonymization.
- Per-environment kill switches default to "active" in staging for any non-validated capability.

---

## 44. Phase 1 / Phase 2 / Phase 3 gates

| Gate | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| Simple search advice | Active | Active | Active |
| Mission advice | Active | Active | Active |
| Mission CRUD | Minimal | Expanded | Full |
| Advice history | Active | Active | Active |
| Admin audit reads | Active | Active | Active |
| Admin mutations | Read-only | Limited | 4-eyes-gated |
| Payment preauth | **Disabled** | Active | Active |
| Payment capture | **Disabled** | Active | Active |
| Auto-buy confirm | **Disabled** | **Disabled** | Active (cohort-gated) |
| Stripe webhooks | Disabled | Active | Active |
| Provider chain | Active (1–2 providers) | Expanded | Full |
| ML model | Optional, fallback to V1 | Active, calibrated | Active, monotonic |
| Kill switches | Active | Active | Active |
| Cohort gates | 0 → 10 | 10 → 100 | 100 → 1000 → GA |

Phase advancement requires the corresponding gates in `LARGO_DATA_STRATEGY.md`, `LARGO_MODEL_STRATEGY.md`, `LARGO_SECURITY_PAYMENTS.md`, and `LARGO_EVALUATION_PLAN.md` to all be satisfied. No unilateral backend phase bump.

---

## 45. Forbidden backend patterns

Append-only list. New patterns are added; existing patterns never softened.

| # | Pattern | Why forbidden |
|---|---|---|
| 1 | Trusting frontend-computed price | Frontend is untrusted |
| 2 | Trusting frontend-computed confidence | Frontend is untrusted |
| 3 | Trusting frontend-computed `can_autobuy` | Safety decision is server-only |
| 4 | Coercing missing price to 0 | Hides risk |
| 5 | Returning numeric confidence to customer | Internal-only |
| 6 | Returning audit_id to customer | Internal-only |
| 7 | Returning technical_details to customer | Internal-only |
| 8 | Auto-buy execution in Phase 1 | Out of phase |
| 9 | Payment capture without audit row | Untraceable |
| 10 | Payment capture without fresh price revalidation | Stale-price abuse |
| 11 | Stripe webhook processing before signature verification | Spoofable |
| 12 | Logging PAN, CVV, full expiry | PCI violation |
| 13 | Logging provider tokens | Credential leak |
| 14 | Logging raw card data anywhere | PCI violation |
| 15 | Generating advice without `schema_version` | Contract violation |
| 16 | Generating advice without `valid_until` | Freshness violation |
| 17 | Mutating audit rows after write | Audit invariant |
| 18 | UPDATE/DELETE on audit tables outside anonymization | Audit invariant |
| 19 | Silent fallback to BUY_NOW on any failure | Safety-critical |
| 20 | Silent fallback to BUY_NOW on calibration miss | Safety-critical |
| 21 | Retrying provider on 4xx in a tight loop | Abuse / cost |
| 22 | Retrying Stripe on 4xx | Will worsen state |
| 23 | LLM in the decision path | Non-deterministic safety |
| 24 | LLM-generated audit fields | Non-reproducible |
| 25 | Public claims / metrics endpoint before benchmark doc | Misleading |
| 26 | Admin endpoint without MFA | Privilege escalation risk |
| 27 | Admin endpoint without role check | Privilege escalation risk |
| 28 | Admin write without audit event | Untraceable |
| 29 | Hardcoded provider URL or token | Operational |
| 30 | Wildcard CORS in production | XSRF surface |
| 31 | Inline script CSP allowance on Largo surfaces | XSS surface |
| 32 | Cookie without `SameSite` | CSRF surface |
| 33 | Returning stack traces to customer | Info leak |
| 34 | Returning DB error text to customer | Info leak |
| 35 | Caching auto-buy responses | Replay risk |
| 36 | Caching payment responses | Replay risk |
| 37 | Sharing idempotency keys across endpoints | Cross-effect |
| 38 | Generating IDs client-side | Predictability / forgery |
| 39 | Accepting client-supplied `audit_id` | Forgery |
| 40 | Accepting client-supplied `valid_until` | Freshness forgery |
| 41 | Accepting client-supplied `confidence.numeric_value` | Forgery |
| 42 | Accepting client-supplied `recommendation` | Decision forgery |
| 43 | Issuing advice while DB write failed | Inconsistent state |
| 44 | Issuing advice without writing audit | Untraceable |
| 45 | Default-allow on kill-switch read failure | Safety-critical |
| 46 | Time-based reasoning on client clock | Untrusted clock |
| 47 | Cross-environment secret reuse | Blast radius |

---

## 46. Open questions before implementation

These questions are tracked for resolution before the corresponding implementation phase. They are not blockers for B0.

1. Final list of allowed routes (IATA pairs) for Phase 1 cohort.
2. Concrete rate-limit numbers tuned to Phase 1 traffic.
3. Caching backend (Vercel KV deprecated per platform note → choose alternative).
4. Async job queue choice (Vercel Queues, Supabase pg_boss, external).
5. Provider 1 + Provider 2 selection and SLA baseline.
6. Stripe account setup : single account for Phase 2, multi-account if multi-currency growth.
7. Webhook secret rotation cadence and tooling.
8. Admin MFA mechanism : Supabase MFA, separate TOTP, hardware key.
9. Admin IP allowlist source of truth (env, GitHub Actions secret, separate config).
10. Kill-switch toggle UI : env-only or admin endpoint with 4-eyes.
11. Logging backend : Vercel logs, Sentry, separate log sink.
12. Tracing backend : OpenTelemetry export target.
13. Anonymization policy detail (retention windows, k-anonymity ≥ 5 application).
14. RLS exact policies per table.
15. Cursor format for advice history (opaque vs ULID-based).
16. Pagination limits per endpoint.
17. Error budget for ABSTAIN rate (when does high ABSTAIN trigger investigation vs accept honest abstain).
18. Concrete shape of `provider.disagreement` field for customer view.
19. Customer message catalog for ABSTAIN reason codes (i18n strategy).
20. Admin export format for evaluation snapshots (CSV / JSON / both).
21. Treatment of authenticated user without `paying_user` role attempting payment endpoint (403 vs 503).
22. `Idempotency-Key` window per endpoint (final values).
23. Whether `Idempotency-Key` is mandatory or optional for `POST /api/largo/missions`.
24. Phase 1 cohort acceptance flow (waitlist gate, invite code, no gate).
25. Audit row size budget and retention window before anonymization.

---

## 47. Document status

| Property | Value |
|---|---|
| Document | `LARGO_BACKEND_API_SPEC.md` |
| Phase | B0 documentary |
| Status | Frozen for B0, amendable via B0 review |
| Version | 0.1.0 |
| Date | 2026-04-27 |
| Implementation | None. No endpoint, no migration, no deploy from this document. |
| V7a impact | None. V7a remains active baseline, untouched. |
| Cross-doc consistency | Pinned to `LargoAdvice` v0.1.0, AuditBlock minimal envelope, Phase 1 = flights only, ABSTAIN first-class, numeric confidence admin-only, append-only audit. |
| Next B0 | `LARGO_FRONTEND_UX_SPEC.md`, `LARGO_COMPETITIVE_BENCHMARK.md`, `LARGO_GO_TO_MARKET.md` (order TBD by user) |

This document is a contract on the backend implementation. The implementation must justify any deviation through a B0 amendment.
