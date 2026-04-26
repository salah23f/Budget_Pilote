# Largo — Security & Payments Plan

> **Status:** B0 (pre-implementation framing). Security, payment, auto-buy, audit and incident response specification before any code, migration, endpoint or deployment.
> **Audience:** founder, ML/data, security, payments, ops, future hires, future external security auditors, future PCI assessors, future Stripe / processor reviewers.
> **Author:** Flyeas team.
> **Coherence:** depends on `LARGO_DOMINATION_STRATEGY.md`, `LARGO_PRODUCT_VISION.md`, `LARGO_ADVICE_CONTRACT.md` (v0.1.0), `LARGO_EVALUATION_PLAN.md`.

---

## 0. Document scope and non-scope

**In scope (B0 documentary):**
- Strategic and operational framing of security, payment, auto-buy, audit and incident response for Largo.
- Hard rules (forbidden patterns) that any future implementation must respect.
- Threat model, trust boundaries, payment lifecycle distinctions.
- Auto-buy safety stack and rollout gates.
- Future kill switches (env var names proposed, not binding).
- Future audit event names, table names, metrics — proposals only, no schema commitment.
- Phase 1 / 2 / 3 rollout gates for payment maturity.
- Open questions explicitly listed as not yet resolved.

**Out of scope (B0):**
- Any code, any endpoint, any handler, any migration, any cron, any deployment, any V7a touch.
- Any commitment to a specific payment processor SKU, vault product, or third-party tool.
- Any final SLA, refund schedule, or customer contract language.
- Any compliance certification claim (SOC 2, ISO 27001, PCI L1) — those are Phase 2/3 commitments tied to revenue and team scale.

This document is the **policy spine**. Implementation documents (B1+) will pin specific products, schemas, and rollout dates against this spine.

---

## 1. Security and payments philosophy

Five principles that override convenience, speed, and even short-term growth:

1. **Payments fail closed, never open.** When in doubt, block. Block is recoverable; bad charge is not.
2. **One bad auto-buy is worse than 1,000 missed auto-buys.** Asymmetry of regret. We optimize for absence of catastrophic events, not maximum throughput.
3. **Trust is rented; lose it once and lose it permanently.** No second chance with a user whose card we mishandled. No second chance with a regulator. No second chance in the press.
4. **Defense in depth, never a single layer.** Every safety check has at least one independent backup. Idempotency × audit row × kill switch × user confirmation is intentional redundancy, not bloat.
5. **Pessimistic by default, opt-in for power.** Every dangerous capability (auto-buy, admin write, mass action) is off by default and requires explicit, audited enablement.

These principles dominate ranking metrics, growth metrics, and even calibration metrics if they conflict.

---

## 2. Threat model

Threats Largo plans for in B0, organized by source. Not exhaustive, but explicit. Future threat model reviews must extend this list, not shrink it.

### 2.1 Insider threats
- Founder or admin with malicious intent.
- Compromised employee laptop.
- Disgruntled departing team member.
- Social-engineered employee handing over credentials.

### 2.2 Supply chain
- Compromised npm / pypi dependency injecting code.
- Compromised CI/CD action.
- Compromised IDE extension reading repo secrets.
- Compromised LLM tool (e.g., this very assistant) writing malicious code.

### 2.3 Secrets and credentials
- Secret committed accidentally to repo.
- Secret leaked in client-side bundle.
- Secret leaked in error log shipped to a third-party log aggregator.
- Stripe key reuse across environments (test ↔ live).

### 2.4 Provider behavior
- Provider returns deliberately misleading price (cache poisoning, A/B tax on bots).
- Provider returns stale price marked as fresh.
- Provider returns wrong inventory after booking confirmation.
- Provider terms change between advice and booking.
- Provider rate-limits Largo at booking time.

### 2.5 ML / calibration behavior
- Model drift causing systematically over-confident predictions.
- Adversarial route input causing model to output BUY_NOW with `high` confidence on a wrong basis.
- Calibration job silently failing, leaving stale numeric_value in production.
- Feature pipeline producing NaN / Inf treated as a real value.

### 2.6 User account
- Stolen credentials (credential stuffing).
- Session hijack via stolen cookie.
- Account takeover for the purpose of triggering auto-buy with stolen card.
- Friendly fraud (user disputes a legitimate charge).

### 2.7 Admin / internal tools
- Admin acting on behalf of user without consent.
- Admin acting on behalf of user with intent to disable safety flags.
- Admin mass-exporting PII without dual control.

### 2.8 Payment processor
- Stripe webhook spoofing (forged events).
- Stripe webhook replay (legitimate event resent maliciously).
- Stripe API quota exhaustion in incident.
- Stripe outage during in-flight payment.

### 2.9 Audit log
- Audit log writer compromised, writing falsified entries.
- Audit log reader compromised, exfiltrating PII.
- Audit log mass-deleted by attacker covering tracks.

### 2.10 User-facing
- Phishing site impersonating Largo to capture cards.
- Email spoofing to direct users to fake refund pages.
- Push notification spoofing.
- Adversarial pricing screenshots to trigger user disputes.

### 2.11 Adversarial economic
- Coordinated dispute fraud rings.
- Adversarial use of mission cancellation to gather pricing data.
- Bot abuse of advice generation to scrape model behavior.

Every implementation choice in B1+ must trace back to a mitigation for at least one of these classes. Mitigations without a mapped threat are ornamental and will be removed.

---

## 3. Trust boundaries

Largo treats every component as untrusted until proven otherwise. Trust labels are explicit, not assumed.

| Component | Trust level | Reason |
|---|---|---|
| Browser / mobile client | **Untrusted** | User-controlled environment; can be tampered, MITMd, replayed |
| Public marketing site | **Untrusted** | No write capability, but assume scraped/cached |
| Backend API | **Semi-trusted** | Owned by Flyeas, but assume compromise possible |
| ML inference services | **Semi-trusted** | Outputs always validated against contract before use |
| Provider APIs (airlines, OTAs) | **Semi-trusted** | Responses validated; never autonomous source of truth for charge |
| Stripe API and webhooks | **External-trusted** | Signed and verified; trust scoped to Stripe's responsibility |
| Database (Supabase / Postgres) | **Trusted within row scope** | Row-level security from day 1; never trusted for cross-tenant queries |
| Audit log store | **Write-trusted, read-restricted** | Append-only; reads gated by role |
| Admin tools | **Highly trusted, gated** | MFA, IP allow-list, every action audited |
| Cron / scheduled jobs | **Semi-trusted** | Same auth boundary as backend; never elevated |
| LLM-assisted code (this very tool) | **Untrusted before review** | All output reviewed by human before merge |

Boundary crossings (user → backend, backend → provider, backend → Stripe, backend → admin) are the only places where trust elevation happens, and each crossing has explicit verification.

No trust is granted by IP, by header, by user-agent, or by "we deployed this ourselves." Trust is granted by signed token, signed webhook, or human review.

---

## 4. Payment architecture

High-level design (no implementation, no schema):

- **Largo never holds card data.** PAN, CVV, magnetic stripe data, full track data: never seen, never stored, never logged. PCI scope: targeting **SAQ-A** (the smallest).
- **Stripe is the system of record for payment intent state.** Largo mirrors Stripe state in its own database via signed webhooks but never overrides Stripe.
- **Backend is the system of record for advice state and audit.** Stripe never sees an advice; advice ID is passed only as Stripe metadata for human-readable cross-reference.
- **Provider booking is the third leg.** A successful payment is meaningless without a successful provider booking. The advice → audit → payment intent → provider booking chain is enforced as a state machine, not a series of optimistic API calls.

**Critical invariant: an advice without a corresponding audit row cannot lead to a payment intent. A payment intent without a corresponding audit row cannot be captured. A capture without a corresponding provider booking attempt is an incident.**

The state machine has explicit terminal failure states (refund issued, booking failed and refunded, etc.) and is never "left dangling" in production.

---

## 5. Stripe usage principles

Concrete usage rules. No code here, but every B1+ payment commit must verify alignment.

- Use **Stripe Elements** (or **Stripe Payment Element**) on the client. PAN never touches Flyeas servers, never enters any input that posts back to Largo origin.
- Use **Setup Intents** to save payment methods for future use. Saved methods stored as `pm_xxx` IDs only.
- Use **Payment Intents with manual capture** for advice-based purchases when the booking is a separate provider call. Authorize first, capture only after provider booking succeeds.
- Use **idempotency keys derived from `audit_id`** on every Stripe API call that creates state. Same audit → same idempotency key → same outcome (Stripe enforces 24h key TTL).
- Use **signed webhooks** with secret rotation; signature verification is mandatory before any state mutation.
- Use **restricted API keys per surface**:
  - Frontend: publishable key only (read-only Stripe.js context).
  - Backend: server key with minimum required scopes.
  - Admin: separate key with audit-logged usage.
- Use **Stripe Radar** rules tuned for travel-specific fraud patterns (high ticket, sudden velocity, distance from billing address) — implementation in B2+, declared here as a commitment.
- Use **3D Secure (3DS) dynamically** through Stripe; never disable across the board.
- Use **Stripe customer IDs** (`cus_xxx`) mapped to Largo user_id in our database. Never invent our own customer ID.

Anti-patterns:
- No use of raw `chargesAPI` (legacy); Payment Intents only.
- No client-side capture confirmation; capture is server-driven only.
- No "trust webhook timestamp"; signature + replay window check both required.
- No mixing test/live keys; environment separation enforced (Section 9).

---

## 6. PCI scope minimization

PCI DSS scope is the perimeter where cardholder data is processed, stored, or transmitted. Largo's strategy: keep the perimeter as close to zero as possible.

Rules:
- **Target SAQ-A** for Phase 2: Largo only redirects/embeds Stripe-hosted card collection.
- **No PAN ever** in: databases, logs, error messages, exception tracebacks, frontend localStorage, frontend cookies, URLs, query parameters, request bodies, response bodies, analytics events, screenshots, screen recordings, customer support tools, debug dumps.
- **No CVV ever** anywhere in any system.
- **No card BIN logic** client-side beyond Stripe's own (which runs in their iframe).
- **Secrets scanner in CI** to prevent regression: any future commit containing a 13-19 digit number near `card`, `pan`, `number` keywords is rejected.
- **No screen recording / session replay tools** that could capture card field iframes (Hotjar, FullStory, etc.). If used elsewhere, must explicitly mask Stripe iframes.
- **Customer support tools never see card details.** Support sees Stripe `pm_xxx` IDs, last 4 (Stripe-provided), brand, and that's all.
- **No fax, email, chat, or phone collection of card data.** All collection through Stripe Elements only.
- **No "pre-fill from URL" of any payment field.** Even non-PAN fields like cardholder name avoid URL params.

If at any future point Largo finds a reason to expand PCI scope, that is a SEV-level decision requiring founder sign-off and an updated SAQ.

---

## 7. Tokenization policy

Stripe is the tokenization authority. Largo does not maintain its own card vault.

- Saved payment methods stored only as Stripe `pm_xxx` IDs in Largo's database.
- Stripe customer IDs `cus_xxx` mapped to Largo user_id.
- **Tokens are scoped to environment** (test mode vs live mode) and to Stripe account. Cross-environment token reuse is forbidden by Stripe and forbidden by Largo policy.
- **No detokenization attempts** of any form; we never need PAN.
- **No BIN-based card brand prediction client-side**; Stripe Elements handles this in its iframe.
- **No "remember last card" via cookies or localStorage**; user must be authenticated and the saved method served from server.
- **Token lifecycle**: when a user removes a saved card, the corresponding `pm_xxx` is detached on Stripe and the row in Largo is hard-deleted. No soft-delete for payment methods (auditable through Stripe).
- **Card expiration handling** (Phase 2+): on `payment_method.attached` and on `payment_intent.payment_failed` webhooks, update local cache; if expired card found at advice consumption, BLOCK auto-buy and prompt re-add.

---

## 8. Secrets management

Secrets are the highest-value attacker target. Mitigations are non-negotiable.

**Hard rules (every one of them is a Forbidden pattern in Section 30):**
- All secrets in environment variables, never in repo.
- `.env*` files in `.gitignore` from day 1, every `.env*` filename pattern, including backups (`.env.local.bak.*` already exists in legacy repo state and is correctly gitignored).
- **Never `git add .` with `.env*` present in the working tree.** Process rule reinforced by .gitignore. Pre-commit hook (gitleaks or trufflehog) to detect regression.
- **Never log secrets** even at debug level. Logging frameworks must redact `Authorization`, `Cookie`, `Stripe-Signature`, `apikey`, `password`, `secret`, `token` keys by default.
- Production secrets stored in a vault (candidates: Vercel encrypted env, Supabase Vault, AWS Secrets Manager, HashiCorp Vault — selection deferred to B1).
- **Per-environment secret rotation policy**:
  - Stripe live keys: rotate every 90 days or immediately on suspected exposure.
  - Database credentials: rotate every 180 days.
  - Admin tool credentials: rotate every 90 days.
  - Webhook signing secrets: rotate every 180 days, with overlap window.
- **Never share secrets across environments**. Test Stripe key never used in prod, prod key never used in dev.
- **Never embed secrets in client-side code** or in public CDN-served assets. Anything bundled to the browser is, by definition, public.
- **Never store secrets in CI/CD logs.** Mask all secret env vars in CI output.
- **Secret access audit**: every secret retrieval from vault generates an audit row (vault-side).

If a secret is suspected compromised, the response is: rotate immediately, audit usage window, notify any third party (Stripe) as required, file an incident.

---

## 9. Environment separation

Three environments minimum: **dev**, **staging**, **prod**. No "shortcut" environment for "quick tests."

Rules:
- Stripe **test mode** only in dev and staging. Stripe **live mode** only in prod.
- **No prod data in dev/staging databases.** Dev uses synthetic or anonymized data only.
- **No cross-environment writes**: a backend in dev cannot write to a prod database, even by misconfiguration. Database connection strings per environment, validated on boot.
- **No cross-environment Stripe key reuse.** Boot-time check: if `NODE_ENV=production` and Stripe key starts with `sk_test_`, refuse to start.
- **No cross-environment domain confusion**: cookies scoped per environment domain. `flyeas.com`, `staging.flyeas.com`, `dev.flyeas.com` do not share cookie scope.
- **No production access from developer laptops** for routine work. Production access is admin-tool-mediated, audited, MFA-gated.
- **Database backups** are per-environment, encrypted, and tested for restore quarterly.
- **Logs and metrics** are per-environment; no shared dashboards mixing prod and staging.

If a developer needs to reproduce a prod issue, the path is: gather audit IDs, reproduce in dev with synthetic data, never copy prod data to dev.

---

## 10. Auto-buy safety model

Auto-buy is the single highest-risk capability. Phase 1 has **zero auto-buy execution in production**. Phase 2+ adds auto-buy only behind a **stack of independent conditions, all of which must be true.**

### 10.1 Contract field mapping

Today's `LargoAdvice` v0.1.0 exposes the auto-buy gate as the flat boolean `can_autobuy` plus dependent fields (`action`, `confidence_label`, `numeric_value`, `ml_available`, `price_observation`, `provider_info`). Future contract versions may introduce a nested `autobuy` block with `can_autobuy`, `requires_user_confirmation`, `autobuy_blocked_reasons[]`, and an explicit `risk_level`. The security policy below is **contract-version-agnostic**: it enumerates conditions and a future enriched contract is expected to surface them as structured fields rather than implicit checks.

### 10.2 Auto-buy condition stack

For an auto-buy to execute in production (Phase 3+), **all** of the following must be true at the moment of execution. Failure of any one → BLOCK auto-buy, return reason, fall back to user-confirmed flow.

| # | Condition | Source field today (v0.1.0) | Notes |
|---|---|---|---|
| 1 | `context_type === 'mission'` | `surface` derived | Auto-buy never fires on a casual search |
| 2 | `action === 'BUY_NOW'` | `action` | The advice itself must say BUY_NOW |
| 3 | Confidence is calibrated | `confidence_label === 'high'` AND `ml_available === true` | Future: explicit `confidence.calibration === 'CALIBRATED'` |
| 4 | Numeric confidence ≥ 0.7 | `numeric_value >= 0.7` | Server-side check; never displayed to user |
| 5 | Risk is LOW | derived: `safety_flags` empty AND no high-risk markers | Future: explicit `risk_level === 'LOW'` |
| 6 | Observed price present | `price_observation.observed_price_usd !== null` | No fake price ever |
| 7 | Provider present | `provider_info.primary_provider !== null` | Anonymous-source charges forbidden |
| 8 | Cross-check agreement (if applicable) | `provider_info.cross_check_disagreement_pct ≤ 1%` if `cross_check_provider !== null` | Provider disagreement → BLOCK |
| 9 | Price freshness ≤ 60s at execution | `provider_info.price_freshness_seconds ≤ 60` | Stale price → BLOCK |
| 10 | Advice not expired | `valid_until > now()` | Hard rule, no grace |
| 11 | No safety flags | future `safety_flags === []` | Empty array required |
| 12 | No blocking data quality flags | future `data_quality_flags` filtered to non-blocking only | Implementation must distinguish blocking vs informational |
| 13 | Price ≤ user's mission ceiling | mission-side field | Mission has explicit ceiling |
| 14 | All consents complete and current | account + mission + auto-buy consents in audit log | See Section 11 |
| 15 | User confirmation in last 60 seconds (Phase 1 / 2 / early 3) | confirmation audit row timestamp | Phase 1 & 2: always required; Phase 3: required for cohort < 1000 |

**These 15 conditions are conjunctive. The stack is the safety model.** A future engineer who proposes weakening any condition must justify it in writing, get founder sign-off, and update this document.

### 10.3 Auto-buy block reasons

Every BLOCK must surface a structured reason from a closed enum (proposed names, future implementation):

`condition_not_mission`, `action_not_buy_now`, `confidence_uncalibrated`, `confidence_below_threshold`, `risk_not_low`, `price_missing`, `provider_missing`, `provider_disagreement`, `price_stale`, `advice_expired`, `safety_flags_present`, `data_quality_blocking`, `price_above_user_ceiling`, `consent_missing`, `consent_stale`, `confirmation_missing`, `confirmation_stale`, `kill_switch_active`, `unknown_route`, `payment_method_invalid`, `payment_method_expired`, `idempotency_replay`, `internal_error`.

These reasons are user-facing (translated) **and** audit-logged. They are also a primary monitoring signal (Section 28).

### 10.4 Auto-buy is opt-in

- Auto-buy is **off by default for every user** at every onboarding.
- Auto-buy is **per-mission opt-in**, not account-wide opt-in.
- Auto-buy can be **revoked at any time**, and revocation is immediate (existing in-flight authorizations are voided).
- Auto-buy is **never re-enabled silently** after a security event, kill switch, or contract version bump.

---

## 11. Consent model

Three consent layers. All three required before any payment-creating action.

### 11.1 Account consent
- Terms of Service acceptance.
- Privacy Policy acceptance.
- Versioned: re-consent on material change.
- Captured at signup; visible to user on profile page.

### 11.2 Mission consent
- Per-mission acknowledgment of: data use scope, FX rate basis, price observation conditions, provider list to be queried.
- Captured at mission creation.
- Stored as audit row tied to `mission_id`.

### 11.3 Auto-buy consent
- Explicit, per-mission, with full context displayed at consent time:
  - Advice ID
  - Action (BUY_NOW)
  - Final price USD + original currency
  - Provider name
  - `valid_until` timestamp
  - User's mission ceiling
  - Refund/cancellation summary
- Stored as audit row with: `consent_id`, timestamp, IP, user-agent, advice snapshot hash.
- **Auto-revoked** on:
  - Advice expiry (`valid_until` passed)
  - User logout
  - Suspicious activity flag
  - Consent age > 60 seconds without confirmation in Phase 1/2
- **Re-consent required** on any material change: price drift > 0.5%, provider change, terms change, FX drift > 0.5%.

Consent is the user's contract. Largo never assumes it; never extends it; never reuses it.

---

## 12. Confirmation model

Phase 1 and Phase 2: **100% of bookings require an explicit user confirmation tap**. No exceptions.

### 12.1 Confirmation surface
The confirmation surface displays:
- Final price in USD and in user's currency
- Provider name and identifying offer ID
- Refund / cancellation policy summary
- `audit_id`
- Last verified at timestamp (price_freshness)
- Cancel button (always larger than confirm button — anti-dark-pattern, per `LARGO_PRODUCT_VISION.md`)

### 12.2 Confirmation TTL
- Confirmation surface valid for 60 seconds.
- Expiry → fresh price re-fetch + new confirmation surface.
- No "remember confirmation" carry-over.

### 12.3 Confirmation audit
- Each confirmation generates an audit row: `confirmation_id`, `advice_id`, `audit_id`, `timestamp`, `ip`, `user_agent`, `surface_snapshot_hash`.
- Confirmation row is referenced in the payment intent metadata.
- Stripe metadata: `audit_id`, `confirmation_id`, `mission_id` (no PII).

### 12.4 Phase 3 reduction
- For cohorts < 1000 in Phase 3, confirmation is still required.
- Beyond Phase 3 (true silent execution): requires founder sign-off, updated public privacy/ToS language, and an additional layer of fraud monitoring not yet specified.

---

## 13. Idempotency model

**Every state-creating payment operation requires an idempotency key.** No exceptions.

- Idempotency key = `audit_id` (the advice → audit → idempotency key chain).
- Stripe enforces idempotency 24h TTL; Largo's own idempotency table (future) extends if needed.
- Replay handling:
  - Same key, same payload → return original response (Stripe handles).
  - Same key, different payload → 409 Conflict, log alert, no state change.
- Idempotency table proposal (future, no schema commitment):
  - `idempotency_keys (key TEXT PRIMARY KEY, first_seen_at TIMESTAMP, response_hash TEXT, status TEXT)`
- Idempotency is also enforced on:
  - Refund creation
  - Void / cancel
  - Booking attempt against provider
- Idempotency keys are never reused across distinct logical operations (capture and refund of the same audit have different keys, derived deterministically).

---

## 14. Refund / cancellation policy

Largo never promises a refund the provider does not allow.

### 14.1 Refund eligibility matrix
| Source of refund | Funded by | Triggered by | Promise level |
|---|---|---|---|
| Provider-allowed cancellation | Provider | User request, within provider terms | Disclosed at booking |
| Provider booking failure (after capture) | Largo refunds full charge | Automatic, in incident response | Hard guarantee |
| Largo mistake (admin, ML, system error) | Largo refunds Largo's service fee + pursues provider refund best-effort | Incident response, SEV2+ | Conditional on incident classification |
| User dispute (chargeback) | Card issuer | User-side | Largo defends per Section 27 |

### 14.2 Voluntary user cancellation
- Largo facilitates the provider's cancellation flow.
- Largo does not invent extra promises.
- All cancellation attempts audit-logged with provider response.

### 14.3 Refund flow integrity
- **Refund flow always creates audit row before Stripe API call.** No silent refund.
- Refund webhooks update the audit chain on receipt.
- Failed refunds escalate to manual queue, never silently dropped.

### 14.4 Refund-related forbidden behaviors
- No "auto-refund any complaint" policy that bypasses incident classification (creates fraud incentive).
- No partial refund without explicit user agreement, except for unavoidable provider fees, disclosed.

---

## 15. Provider failure handling

Three failure modes, each with explicit ladder.

### 15.1 Pre-payment failure
- Provider price changed (drift > tolerance), provider unavailable, provider rate-limited, provider returned malformed response.
- Action: BLOCK current advice consumption. Generate fresh advice. Notify user with explanation.
- No retry without user re-confirmation.

### 15.2 Mid-payment failure (the dangerous case)
- Payment authorized OR captured, but provider booking call fails.
- Ladder:
  1. Retry booking once with the same payment authorization (within 30 seconds).
  2. If still failing: void / refund payment immediately.
  3. Notify user with `audit_id` and plain explanation.
  4. Open SEV2 incident automatically.
  5. Postmortem within 7 days.
- **No mid-payment failure may leave a captured charge without a corresponding successful provider booking, ever.** This is the highest invariant of the payment system.

### 15.3 Post-payment failure
- Booking confirmed by provider's API, but ticket issuance later fails (airline-side problem).
- Ladder:
  1. Hold position, notify user immediately.
  2. Engage provider customer service through documented escalation channel.
  3. If unresolvable within 24h: full refund + Largo absorbs provider fees.
  4. Open SEV2 incident.
  5. Track provider reliability metric (Section 28).

### 15.4 Provider on-boarding gate
- Before a new provider can carry production payments, it must pass:
  - 30-day shadow period in staging
  - Documented escalation contact and SLA
  - Tested retry behavior
  - Tested cancellation behavior
  - Tested webhook (if any) signature verification

---

## 16. Race conditions and duplicate charge prevention

The single most common cause of multi-charge bugs is concurrent execution. Largo prevents this with redundant locks.

- **Idempotency key on every payment intent creation** (Section 13).
- **Database advisory lock** on `(user_id, mission_id)` during payment flow. Held for the duration of intent creation through capture-or-void.
- **Stripe webhook deduplication** via `stripe_event_id` table (future): each Stripe event processed at most once.
- **Time-bounded payment flow**: max 5 minutes from intent creation to capture or void. Stale intents auto-voided after 30 minutes via cleanup process (B2+; not a cron in B0).
- **No "fire and forget" payment calls**. Every Stripe call is followed by an in-process state update before responding.
- **Confirmation TTL** (Section 12) provides another layer: an old confirmation cannot be silently replayed.

The combination is intentional defense in depth. A single one of these would suffice in theory; in practice, defense in depth is non-negotiable.

---

## 17. Price verification before payment

The frontend display is illustrative. The backend price verification is authoritative.

### 17.1 Two-step verification
- **Step 1 (frontend):** display observed price from advice, allow user to see it.
- **Step 2 (backend, before any capture):** re-fetch from provider, compare to advice's `observed_price_usd`:
  - Drift ≤ 1% **and** ≤ $5 absolute → proceed.
  - Drift > 1% **or** > $5 absolute → BLOCK, fresh advice required.
- Backend price verification result is audit-logged on every attempt.

### 17.2 Anti-tampering
- **Never trust frontend-submitted price as basis for charge.** The charge amount is derived from backend re-verification, not from any user-submitted value.
- Frontend may show "we re-checked at booking time" message to set expectation.

### 17.3 Edge cases
- Provider down at verification time → BLOCK (do not "trust the cached price").
- Provider returns price in different currency than advice → BLOCK (do not silently FX-convert without re-consent).
- Provider returns price with different fare class than advice → BLOCK.

---

## 18. FX / currency risk

### 18.1 FX rate locking
- FX rate locked at advice generation time (`PriceObservation.fx_rate_to_usd`, `fx_observed_at`).
- FX rate valid until advice's `valid_until`.
- FX rate source documented and consistent across advices generated in the same window.

### 18.2 Charge currency
- Charge in the user's preferred currency when the provider supports it natively.
- Otherwise, charge in provider's quoting currency, with FX disclosed to user.
- Stripe handles the actual currency conversion at settlement.

### 18.3 Slippage handling
- Slippage = difference between displayed price (advice time) and final charge (verification time) due to FX or provider drift.
- Bands:
  - **≤ 0.5%** → silent absorb (Largo eats the spread, no user notification needed).
  - **0.5% – 2%** → user notified, re-confirmation required before capture.
  - **> 2%** → BLOCK, fresh advice required.

### 18.4 Anti-patterns
- **No speculative FX positions held** by Largo. Largo is not a currency trader.
- **No FX margin markup** undisclosed. If Largo ever takes an FX margin, it is disclosed in the price observation. (Phase 1 commitment: zero FX markup.)
- **No "convenience rates"** that diverge from observable market rates.

---

## 19. Audit logging

Audit logging is the system that makes everything else verifiable. Without audit, no other guarantee is auditable.

### 19.1 Coverage
- **Every advice → corresponding `AuditBlock` row** (`audit_id`, `parent_advice_id`).
- **Every payment-related state change → append-only audit event row.**
- **Every consent → audit row.**
- **Every confirmation → audit row.**
- **Every admin action → audit row** with reason field.
- **Every kill switch state change → audit row.**

### 19.2 Audit event categories (proposed names, no schema commitment)
- `advice.generated`, `advice.viewed`, `advice.expired`, `advice.refreshed`
- `autobuy.condition_evaluated`, `autobuy.blocked`, `autobuy.confirmed`
- `consent.granted`, `consent.revoked`, `consent.stale_detected`
- `confirmation.requested`, `confirmation.captured`, `confirmation.expired`
- `payment.intent_created`, `payment.authorized`, `payment.captured`, `payment.failed`
- `payment.refunded`, `payment.voided`, `payment.disputed`
- `booking.attempted`, `booking.confirmed`, `booking.failed`, `booking.partial`
- `webhook.received`, `webhook.signature_failed`, `webhook.replayed`
- `admin.viewed_user`, `admin.acted_on_user`, `admin.exported_data`
- `incident.opened`, `incident.escalated`, `incident.closed`
- `kill_switch.activated`, `kill_switch.deactivated`
- `secret.rotated`, `secret.suspected_leak`

### 19.3 Audit log integrity
- **Append-only.** No UPDATE. No DELETE.
- **Retention**: minimum 7 years for payment-related events (regulatory).
- **Hash chain** consideration: each event hash includes prior event hash, making silent tampering detectable. Implementation candidates: in-database trigger, immudb, external WORM storage. Selection deferred to B1.
- **Read-restricted**: audit log reads gated by role. Mass exports require dual control.

### 19.4 Audit log forbidden patterns
- No PII in audit `event_body` beyond what is strictly necessary for traceability.
- No PAN, ever (already forbidden globally).
- No direct deletion of audit rows even by founder.
- No "summarization job" that replaces individual rows with aggregates.

---

## 20. Access control

### 20.1 Roles (minimum)
| Role | Description | Auth requirement |
|---|---|---|
| `user` | Default; scoped to own data only | Email + password (or OAuth), optional MFA |
| `support_agent` | Read-only access to user data within tenant; cannot trigger payment | SSO + MFA, IP allow-list |
| `admin` | Full access; can trigger administrative refund; cannot edit audit | SSO + MFA + IP allow-list, session-level reauth every 8h |
| `founder` | Founder-level emergency access for kill switches | Same as admin + secondary out-of-band verification |

### 20.2 Service-to-service auth
- Short-lived signed tokens (e.g., JWT with ≤ 15 min expiry).
- Never long-lived static API keys for inter-service calls.
- Token rotation on suspected exposure.

### 20.3 Database access
- **Row-level security from day 1** on every user-scoped table (Supabase RLS or equivalent — no migration committed in B0, declared as policy).
- No "service account that can read everything" used by routine application paths. Application paths use the user's session context.
- Backup access is separate and audit-logged.

### 20.4 No shared accounts
- One human, one account.
- No "founder@" shared mailbox tied to admin login.
- Departing employees revoked within 1 hour of departure.

---

## 21. Admin / internal tools safety

Admin tooling is a high-value attacker target and a high-risk insider surface. Treat accordingly.

### 21.1 Admin UI rules
- Always shows **"ACTING AS USER X"** banner when in user context.
- Cannot trigger payment without a user re-consent token.
- **Cannot disable safety flags.**
- **Cannot edit audit rows.**
- **Cannot edit advice rows.** (Advice is immutable post-generation.)
- Cannot mass-export PII without **dual control** (two admin approvals).
- All actions audit-logged with mandatory reason field.
- All actions visible in user-facing audit timeline (user can see what admins did to their account, with redacted internal IDs if needed).

### 21.2 Admin API
- Separate base path (e.g., `/admin/*`).
- Separate API keys.
- IP allow-list (corporate VPN or fixed admin office IPs).
- MFA required at session level; reauth every 8h.
- All admin API calls audit-logged with full request body (PII redacted at log layer).

### 21.3 Internal tools (analytics, debug)
- Read-only by default.
- Aggregated views; raw user-level access requires admin role and audit row.
- No cross-tenant queries by default.
- LLM-assisted internal tools (e.g., this assistant) treated as untrusted code authors; output reviewed before merge.

---

## 22. PII handling

### 22.1 PII categories tracked
| Category | Examples |
|---|---|
| Identity | Name, email, phone, address |
| Travel | Passport, frequent flyer ID, DOB (especially for minors) |
| Payment | Stripe IDs, billing address, last 4 (Stripe-provided) |
| Behavioral | Search history, missions, advice interactions, decision outcomes |
| Device | IP, user-agent, session metadata |

### 22.2 Storage rules
- **Encryption at rest** (database-level).
- **Encryption in transit** (TLS 1.3 minimum; older versions explicitly disabled).
- **Field-level encryption** for high-sensitivity (passport numbers, DOB of minors).
- **Pseudonymization** in analytics data warehouses (no raw email/phone).
- **PII never logged in plaintext** in application logs. Use IDs in logs; PII fetched on-demand from authoritative tables.
- **PII in error reports** (Sentry-like): explicit allow-list of fields; default deny.
- **PII export to user on request** (GDPR Art. 15): self-serve UI in Phase 2+, manual process if needed before.
- **PII deletion on request**: hard-delete with audit-redaction strategy (event body of audit rows is hashed/scrubbed, but the existence of the audit row remains for regulatory audit). Strategy detail TBD in B1.

### 22.3 Sharing PII with third parties
- No PII sold or shared for advertising.
- PII shared with Stripe limited to what Stripe needs (billing address, email, phone).
- PII shared with airlines/providers limited to what they need for booking (passenger name, DOB, document number when required).
- Every third-party PII flow documented in a data flow register (B1).

---

## 23. GDPR / privacy notes

### 23.1 B0 commitment
**GDPR-shaped from day 1**, even if initial users are US-only. The cost of retrofitting GDPR compliance later is much higher than building right.

### 23.2 Lawful bases (anticipated)
- **Contract**: processing necessary to fulfill the booking.
- **Consent**: auto-buy execution, marketing communications.
- **Legitimate interest**: fraud prevention, system security.
- **Legal obligation**: tax records, anti-money-laundering, dispute response.

### 23.3 Data Subject Rights
- Access (Art. 15): user can request and receive their data.
- Rectification (Art. 16): user can correct inaccurate data.
- Erasure (Art. 17): user can request deletion, with audit-log limits.
- Restriction (Art. 18): user can limit processing.
- Portability (Art. 20): user can export in machine-readable format.
- Objection (Art. 21): user can object to processing based on legitimate interest.

### 23.4 Cross-border transfers
- Documented; SCCs (Standard Contractual Clauses) where required.
- Data residency commitments per region (TBD when EU users meaningful).

### 23.5 DPO and other roles
- Data Protection Officer designation TBD when team grows or EU users exceed regulatory threshold.
- Privacy notices versioned; user re-consent on material change.

### 23.6 What B0 does NOT promise
- **No SOC 2 / ISO 27001 / PCI Level 1 commitment.** These are Phase 2/3 commitments tied to revenue and team scale. Public-facing compliance claims are forbidden in Phase 1 unless audited.
- **No CCPA-specific commitment** until California users meaningful and legal review done.
- **No HIPAA** (we are not a healthcare app).

---

## 24. Incident response

### 24.1 Incident definition
**Any event causing or risking user financial loss, data exposure, or trust loss.** Latency or UI bugs not in scope unless they cascade.

### 24.2 Lifecycle
1. **Detect** — monitoring alert or user report.
2. **Triage** — assign SEV (Section 25).
3. **Contain** — kill switch if needed (Section 29).
4. **Investigate** — root cause analysis.
5. **Communicate** — user, internal, regulator if required (Section 26).
6. **Remediate** — fix, deploy, verify.
7. **Postmortem** — blameless; public for SEV1/SEV2.
8. **Track** — open issues, prevention measures, regression tests.

### 24.3 Roles
- **Incident commander**: rotation TBD when team > 1 ops-capable. Founder by default in Phase 1.
- **Communications lead**: same person as commander in Phase 1, separates in Phase 2+.
- **Scribe**: chronology and decisions, separate from commander when team ≥ 3.

### 24.4 War room
- Slack channel + Zoom for SEV1/SEV2.
- All commands and decisions logged in the channel (which becomes part of the postmortem record).

### 24.5 External communication
- Only by designated person.
- Never improvised.
- Never blame providers, models, or users without verification.

---

## 25. SEV levels

Reuses the SEV ladder declared in `LARGO_EVALUATION_PLAN.md` and pins payment-specific triggers.

| SEV | Triggers (payment-specific) | Response |
|---|---|---|
| **SEV1** | Aggregate financial loss > $10k OR data exposure of any user OR auto-buy malfunction (any execution outside the safety stack) OR audit log integrity breach OR Stripe key leak | Kill switch on, all-hands, public postmortem within 7 days, regulator notification if PII exposed |
| **SEV2** | Aggregate financial loss < $10k OR provider booking failure cluster (>1% over 1h) OR auth breach for single user OR webhook signature failures > 0 sustained OR refund queue backed up > 24h | Targeted fix, user comms within 24h, internal postmortem within 14 days |
| **SEV3** | Degraded experience, no financial loss, no PII exposure (e.g., advice generation latency spike, single failed booking that recovered) | Ticket, fix in next deploy, no proactive comms |
| **SEV4** | Minor cosmetic or copy issue | Backlog |

SEV escalation rules:
- SEV3 → SEV2 if any user reports financial concern.
- SEV2 → SEV1 if scope expands beyond initial estimate.
- Never de-escalate without postmortem.

---

## 26. User communication during incidents

### 26.1 Cadence by SEV
| SEV | Initial comms | Update cadence | Postmortem |
|---|---|---|---|
| SEV1 | In-app banner + email within **1 hour** | Daily until resolved | Public postmortem email within 7 days |
| SEV2 | In-app banner + email within **4 hours** | Updates as state changes | Internal postmortem; user-facing summary if direct impact |
| SEV3 | In-app notice if user-affecting | Resolution notice | None |
| SEV4 | None proactive | None | None |

### 26.2 Communication principles
- **Acknowledge fast** even without root cause. "We're investigating" is better than silence.
- **Never blame the user.**
- **Never blame the provider** unless verified and material.
- **Never speculate publicly** about causes.
- **Always provide audit ID** for affected users.
- **Always offer concrete remediation** when possible (refund processed, account locked while we fix, etc.).
- **Never use marketing language** in incident comms.

### 26.3 Channels
- **In-app banner**: always for affected users, dismissible after acknowledgment.
- **Email**: always for SEV1, often for SEV2.
- **Push notification**: SEV1 only, when material to user action (e.g., "your auto-buy is paused").
- **SMS**: not used in Phase 1; under review for SEV1 in Phase 2.
- **Public status page**: from Phase 2 onward.

---

## 27. Dispute handling

### 27.1 Dispute = chargeback
A dispute is when a user opens a chargeback through their card issuer, bypassing Largo's own refund flow.

### 27.2 Response window
- **7 calendar days** internally from Stripe's notification to assemble response.
- Stripe's external deadline followed strictly.

### 27.3 Response package
Every dispute response includes:
- `audit_id` and full audit trail.
- Advice snapshot at time of decision (immutable).
- Consent records (account + mission + auto-buy if applicable).
- Confirmation record (timestamp, IP, user-agent).
- Provider booking confirmation.
- Communication record with user (emails, in-app messages).
- FX rate basis at decision time (if applicable).

### 27.4 Outcomes
| Outcome | Action |
|---|---|
| Won | No refund; track for fraud pattern. If pattern emerges (same user, same provider) → review user account for ban. |
| Lost | Refund + ledger entry; root cause review. If lost due to Largo error → SEV2 incident. |
| Lost-fraud | User banned; fraud report filed (Stripe Radar, possible law enforcement). |

### 27.5 Targets
- **Dispute rate < 0.5% of bookings** (consistent with `LARGO_EVALUATION_PLAN.md`).
- **Dispute rate > 1% in any 30-day rolling window** → kill switch evaluation, automatic SEV2.

### 27.6 Anti-pattern
- No "auto-grant any chargeback request without internal review." Creates fraud incentive and erodes our evidence.

---

## 28. Monitoring and alerting

### 28.1 Mandatory monitors (declarations only; implementation in B2+)

| Metric | Target / threshold | Alert trigger |
|---|---|---|
| Payment success rate | > 99% | Drop > 1% over 15 min |
| Payment latency p95 | < 5s | > 8s sustained 5 min |
| Auto-buy block rate by reason | No single reason > 30% sustained | Reason-skew detected |
| Provider price drift events / hour | < 5% of evaluations | Spike > 10% |
| Booking failure rate | < 0.5% | > 1% over 1h |
| Refund rate | < 2% | > 5% over 24h |
| Dispute rate | < 0.5% | > 1% over 30 days |
| Webhook signature failures | = 0 | Any single occurrence |
| Idempotency replay attempts | ~ 0 (legitimate retries excluded) | > 5/hour |
| Auth failures by user | < 10/min per user | > 10/min single user (likely credential stuffing) |
| Admin action volume | Anomaly-detected baseline | Volume > 3σ baseline |
| Kill switch state | Off in normal ops | Any activation logged |

### 28.2 Alert routing
- **SEV1 trigger** → page on-call **immediately**.
- **SEV2 trigger** → page on-call within **15 minutes**.
- **SEV3/4** → ticket queue, no paging.

### 28.3 Anti-vanity alerts
- **No alerts on DAU, conversion rate, time-on-page, or other vanity metrics.**
- **No alerts on Stripe revenue thresholds** (creates pressure to keep flow open during incidents).
- Alerts only on safety, financial integrity, and security signals.

---

## 29. Kill switches

Kill switches are the operational equivalent of a circuit breaker. Each one disables a specific dangerous capability without taking the whole system offline.

### 29.1 Proposed env-var-driven kill switches (names not yet binding)

| Kill switch | Effect |
|---|---|
| `LARGO_KILL_AUTOBUY` | Disables all auto-buy execution paths globally; advice generation continues |
| `LARGO_KILL_PAYMENTS` | Disables all payment intent creation; existing intents allowed to settle |
| `LARGO_KILL_NEW_BOOKINGS` | Accepts no new bookings; in-flight bookings allowed to finish |
| `LARGO_KILL_PROVIDER_<NAME>` | Disables specific provider; falls back to others |
| `LARGO_KILL_ADVICE_GENERATION` | Emergency, last resort; disables all advice generation |
| `LARGO_FORCE_USER_CONFIRMATION` | Overrides any auto-buy consent; forces tap on every booking |
| `LARGO_KILL_ADMIN_WRITES` | Admin role becomes read-only (mitigates compromised admin) |
| `LARGO_KILL_WEBHOOKS` | Stops webhook processing; webhooks queue for later replay |

### 29.2 Activation authority
- Designated on-call (any SEV1/SEV2).
- Founder (any time).
- Automated guardrail (e.g., dispute rate > threshold over rolling window).

### 29.3 Visibility
- Kill switch state visible in admin dashboard.
- Kill switch state audit-logged on every change.
- Active kill switches surfaced as banner in user-facing app when relevant ("auto-buy is currently paused").

### 29.4 Recovery
- Kill switch deactivation requires:
  - Confirmation that root cause is resolved.
  - Sign-off by incident commander + founder for SEV1 cases.
  - Audit row recording reason for deactivation.

---

## 30. Forbidden payment / security patterns

The hard "no" list. Any future commit that violates one of these is a regression to be reverted, not negotiated.

| # | Pattern | Why forbidden |
|---|---|---|
| 1 | Storing PAN in any Largo system | PCI scope explosion |
| 2 | Logging PAN even partially in custom logs | Same |
| 3 | Raw card data in URLs or query params | Same |
| 4 | Storing CVV anywhere ever | PCI prohibition |
| 5 | Auto-buy on provider disagreement | Wrong-source charge risk |
| 6 | Auto-buy on stale price | Charge mismatch |
| 7 | Auto-buy on expired advice | Logic break |
| 8 | Auto-buy on unknown route | Untested behavior |
| 9 | Auto-buy when ML/calibration unavailable | No trust signal |
| 10 | Auto-buy with non-empty `safety_flags` | Self-explanatory |
| 11 | Auto-buy with blocking `data_quality_flags` | Same |
| 12 | Auto-buy without consent token captured in last 60s | Consent freshness |
| 13 | Auto-buy without explicit user confirmation in Phase 1 / 2 | Phase rule |
| 14 | Payment based solely on frontend-submitted price | Tampering risk |
| 15 | Stripe capture without idempotency key | Duplicate charge risk |
| 16 | Stripe capture without prior audit row | Untraceable charge |
| 17 | Webhook handler without signature verification | Forgery risk |
| 18 | Webhook handler without replay protection | Replay risk |
| 19 | Silent execution of any kind in Phase 1 | Trust violation |
| 20 | Promising universal refund | False promise |
| 21 | `git add .` with `.env*` present | Secret leak |
| 22 | Adding `.env*` to git history at any time | Permanent leak |
| 23 | Sharing Stripe keys across environments | Cross-env contamination |
| 24 | Long-lived service tokens | Theft risk |
| 25 | Admin without MFA | Privilege escalation |
| 26 | Audit log UPDATE or DELETE | Tampering risk |
| 27 | Cached provider response > 60s used as basis for capture | Stale risk |
| 28 | `git push --force` on `main` | History destruction |
| 29 | Bypassing pre-commit hooks "for speed" | Discipline collapse |
| 30 | LLM-generated code merged without human review | Supply-chain risk |
| 31 | Public claim of PCI / SOC 2 / ISO 27001 without certification | Regulatory + reputational risk |
| 32 | Refunds processed without audit row | Untraceable money movement |
| 33 | Admin disabling safety flags on any account | Insider risk |
| 34 | Cross-tenant database query in routine application path | Privacy + breach risk |
| 35 | PII in URL or referrer | Leak risk |
| 36 | Allowing 3DS to be globally disabled | Fraud risk |
| 37 | Using customer email or phone as session identifier | Hijack risk |
| 38 | Soft-deleting payment methods (must be hard delete + Stripe detach) | Stale data risk |

This list is **append-only**. Removing an entry requires the same level of review as a kill switch deactivation.

---

## 31. Phase 1 / Phase 2 / Phase 3 rollout gates

Payment maturity rolls out in phases, each with explicit entry gates.

### Phase 1 — Documentary + design (current)
- All payment work is design + test-mode integration in dev/staging only.
- **No live Stripe key in any environment yet.**
- Auto-buy execution: **0 users**.
- Manual user-confirmed bookings: **not active in production**.
- Documentary discipline: B0 → B1 transition gate.

### Phase 2 — Live, manual confirmation only
- Live Stripe key in prod with restricted scope.
- Manual user-confirmed bookings: enabled.
- Auto-buy execution: still **0 users** (UI may collect interest, no execution).

**Gates required to enter Phase 2:**
- [ ] All B0 documents complete and signed off.
- [ ] Threat model reviewed externally.
- [ ] PCI SAQ-A assessment complete.
- [ ] Stripe integration code reviewed (internal + ideally external).
- [ ] Pen test on payment flow.
- [ ] 30-day shadow run with synthetic charges in staging.
- [ ] Audit logging operational with hash chain candidate selected.
- [ ] Kill switches implemented and drilled.
- [ ] Incident response runbook drafted and rehearsed once.
- [ ] Rollback plan documented and tested.

### Phase 3 — Auto-buy cohort (closed beta, 10 users)
- Auto-buy execution: **10 users** (closed beta), opt-in, fully monitored.
- Confirmation still required per cohort-< 1000 rule.

**Gates required to enter Phase 3:**
- [ ] 90 days clean operation in Phase 2.
- [ ] Calibration ECE < 0.07 sustained (per `LARGO_EVALUATION_PLAN.md`).
- [ ] Dispute rate < 0.5% sustained.
- [ ] Booking failure rate < 0.5% sustained.
- [ ] Refund rate < 2% sustained.
- [ ] All forbidden patterns audited absent.
- [ ] Incident response drilled twice with positive review.
- [ ] Cohort selection criteria written and approved.
- [ ] Cohort opt-out flow tested.
- [ ] Cohort kill switch (`LARGO_KILL_AUTOBUY`) drilled.

### Phase 4 / 5 — Auto-buy expansion
- Cohort gates from `LARGO_EVALUATION_PLAN.md`: 10 → 100 → 1000 → GA.
- Each step requires: clean previous step + improved metrics, not just maintained.
- Beyond 1000: silent execution still requires founder sign-off and additional fraud-monitoring layer not yet specified.

### Cross-phase principles
- **No skipping a phase.** Phase 3 cannot be entered without 90 days in Phase 2.
- **Regression triggers rollback.** A SEV1 in Phase 3 returns the cohort to Phase 2 with confirmation forced for everyone.
- **No marketing-driven phase advancement.** Metrics drive phases, not press cycles.

---

## 32. Open questions before implementation

Explicit list of things this document does **not** resolve. Each must be resolved (or explicitly deferred with rationale) before the corresponding implementation begins.

1. **Payment processor choice**: Stripe-only initially, or multi-processor (Adyen as backup) from day 1?
2. **Vault choice**: Vercel encrypted env, Supabase Vault, AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault?
3. **Audit-log integrity mechanism**: hash chain, immudb, external WORM, or simpler append-only with periodic snapshot signing?
4. **3DS strategy**: always, dynamic via Stripe Radar, or per-region?
5. **SCA exemption strategy** in EU once EU users meaningful?
6. **Card expiration handling** mid-mission: re-prompt at booking, or proactively on `payment_method.updated` webhook?
7. **Refund delta** when provider has stricter terms than Largo's customer-facing promise (Largo absorbs difference, or transparent disclosure)?
8. **Auto-buy in non-USD currencies**: charge in user currency (Stripe-assisted FX), or convert to USD always (simpler accounting)?
9. **Stolen-card scenario** where booking is non-refundable: who eats the cost?
10. **E&O / cyber insurance**: when to acquire (revenue threshold, user count threshold)?
11. **Bug bounty program**: when to launch (Phase 2 or Phase 3)?
12. **SOC 2 Type II target**: when (Phase 3 or Phase 4), with which auditor?
13. **Audit retention beyond 7 years**: legal review needed; 10 years is a common floor in some jurisdictions.
14. **Cross-border data residency** for EU users: full EU residency, or SCC-based transfer?
15. **Provider booking failure mid-payment**: who eats the cost when provider refuses refund (Largo, user, or provider via dispute)?
16. **Admin tooling build vs buy**: internal build, Retool, or other (cost vs control trade-off)?
17. **Customer support tooling**: Zendesk, Front, custom, or none until Phase 3?
18. **SEV1 user comms channels**: email-only, or SMS / push / phone for urgent cases?
19. **Public security contact**: `security@flyeas.com` policy, PGP key, response SLA?
20. **CSP / SRI strategy** for embedded Stripe Elements and other third-party script?
21. **DPO designation trigger**: EU user count, EU revenue, or qualitative threshold?
22. **Postmortem publication policy**: always public for SEV1, or selective?
23. **Auto-buy attempt counter per user per day** to avoid runaway scenarios (cap at 1? 3? unbounded?).
24. **Cohort opt-out mechanism** when shrinking from Phase 3 back to Phase 2 (forced opt-out, or persuaded re-confirmation?).

These questions are tracked here so they cannot be silently bypassed.

---

## 33. Document status

- **B0 documentary specification**, schema-agnostic policy.
- **Aligned with**: `LargoAdvice` contract v0.1.0 (`can_autobuy` flat boolean today; future contract versions may introduce a nested `autobuy` block with `requires_user_confirmation`, `autobuy_blocked_reasons[]`, and `risk_level` per the security policy enumerated above; the security stack itself is contract-version-agnostic).
- **Aligned with**:
  - `LARGO_DOMINATION_STRATEGY.md` (trust-as-moat thesis).
  - `LARGO_PRODUCT_VISION.md` (no dark patterns; confirmation surface; cancel button always larger than confirm button).
  - `LARGO_ADVICE_CONTRACT.md` (`AuditBlock` envelope; nullable price/provider semantics; `valid_until` mandatory).
  - `LARGO_EVALUATION_PLAN.md` (SEV ladder; dispute rate < 0.5%; cohort gates 10 → 100 → 1000 → GA; public claims policy).
- **Open for review by**: founder, future security/payments hire, future external auditor, future PCI assessor.
- **No code, no migration, no endpoint, no deployment, no V7a touch derived from this document.** Implementation begins in B1+ against the constraints declared here.
- **Append-only forbidden patterns list**. Removing an entry requires the same level of review as deactivating a kill switch.
- **Next document expected**: `LARGO_DATA_STRATEGY.md` (data sources, ingestion, retention, lineage, ML data contracts).

---

*End of LARGO_SECURITY_PAYMENTS.md.*
