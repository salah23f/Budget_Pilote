# Largo — B1 Implementation Plan

**Document type :** B1 planning document, not implementation.
**Status :** Draft, opening artefact of B1.
**Version :** 0.1.0
**Last updated :** 2026-04-27
**Scope :** Translate B0 into an executable, ordered, safe plan for B1. Define the order of the first sprints, the files that may be touched later, the forbidden files, the gates before any implementation, the Claude Code operating rules, the first recommended code task, the expected tests, the commit conditions, and the major risks to avoid.

This document does **not** implement Largo. It does **not** create code, components, endpoints, migrations, or deployment artefacts. It produces only the plan under which a future, separately-scoped session may begin coding.

---

## 0. Executive summary

B0 is closed (per `docs/b0/B0_CLOSURE_AUDIT.md`, verdict A) and the eleven specification documents are pushed. This plan opens B1 as a **discipline-installation phase**, not a feature phase. The first sprints write rules, types, fixtures, and tests — not endpoints, components, or migrations.

The recommended order is :

1. **Sprint 0** — repository safety and implementation guardrails (no production code ; only repo hygiene plan, branch strategy, pre-commit hooks design, allow-list/deny-list files, Claude Code rules acceptance).
2. **Sprint 1** — contract-safe foundations : the `CustomerSafeAdvice` type derived from `LargoAdvice` v0.1.0, a pure stripping function with unit tests, no endpoint, no component.
3. **Sprint 2** — `LargoAdvice` fixture examples and a runtime validator (zod or equivalent) — design + types + tests, no producer code.
4. **Sprint 3** — backend skeleton **planning** (route shape, error model wiring, no live route).
5. **Sprint 4** — frontend mock **planning** (AdviceCard state matrix, no React).
6. **Sprint 5** — methodology page draft and waitlist landing copy (Markdown, no live route).

The first code task recommended by this plan is **the customer-safe view type plus its pure stripping function plus its unit tests**. It is small, contract-bound, citable to `LARGO_ADVICE_CONTRACT.md` §6 and `LARGO_BACKEND_API_SPEC.md` §10, and risks nothing (no endpoint, no DB, no Stripe, no provider, no V7a, no cron, no Modal).

The plan forbids any first task that touches : auto-buy, Stripe, provider booking, Supabase migrations, V7a, model training, full frontend, exposed production endpoints. The plan affirms the B0 frozen anchors — `LargoAdvice` v0.1.0, `AuditBlock` minimal, `audit_id === advice_id` Phase 1, customer-safe view stripped server-side, numeric confidence admin-only, ABSTAIN first-class, no live auto-buy, no silent auto-buy, no LLM in decision path, no dark patterns, no public claims before evidence.

The transition from B1 planning to B1 coding is gated by Section 25 : explicit founder approval, B0 anchors re-affirmed, repo hygiene plan committed, branch strategy committed, the chosen first task scoped in writing.

---

## 1. Scope and non-scope

**In scope (this document) :**

- Order the B1 sprints from safety installation to first contract-safe code.
- Pin which file paths are allowed (later, under explicit prompt) and which are forbidden.
- Pin the gates that must be met before any implementation begins.
- Pin the Claude Code operating rules in B1.
- Recommend a first concrete code task and define the tests it must pass.
- List the alternative first tasks that were rejected and why.
- Surface the risks of the early B1 phase.
- Define the stop conditions that pause B1 immediately.
- Define what success looks like at the end of B1 planning, before any code is written.

**Out of scope (this document) :**

- Any code, any function body, any class, any component, any route handler, any migration, any test runner configuration.
- Any V7a touch, any watcher touch, any Modal touch, any cron touch.
- Any deployment, any model run, any training run, any provider call.
- Any modification of files outside `docs/b1/B1_IMPLEMENTATION_PLAN.md`.
- Any commit, any push, any branch creation, any merge by the assistant.
- Any cleanup of the working tree (legacy `scripts/*`, `.env.local.bak.*`, `reports/`, `logs/` remain untouched, per Section 5).
- Any decision that re-opens an already-frozen B0 anchor (those require an explicit B0 amendment session, not this plan).

If a contradiction with a B0 frozen anchor is discovered while drafting B1 work, this plan defers to the B0 anchor and to the B0 amendment process — it does not silently override.

---

## 2. B1 philosophy

Five principles, non-negotiable.

1. **Smallest safe step.** Every B1 ticket is small enough to inspect end-to-end in one review. Big PRs are rejected.
2. **Documentation before code.** Each ticket cites the B0 section it implements. A ticket without citation is incomplete.
3. **Type and test before behavior.** Types and tests come before the function body. Producer code that lacks a contract is not authorized.
4. **Server is authority, frontend is renderer.** This anchor (`LARGO_BACKEND_API_SPEC` §1) governs every B1 ticket. No frontend ticket precedes its server-side authority.
5. **Convergence mode.** Diff before execution. Format respected mot pour mot. Parallel findings noted, not opened. Git operations controlled by the user.

These principles dominate any "but it's faster the other way" argument.

---

## 3. Source documents

The B1 plan is bound to the following B0 documents at their pushed commit hashes :

| # | document | commit |
|---|---|---|
| 1 | `docs/b0/LARGO_DOMINATION_STRATEGY.md` | `ea674a16` |
| 2 | `docs/b0/LARGO_PRODUCT_VISION.md` | `133691e7` |
| 3 | `docs/b0/LARGO_ADVICE_CONTRACT.md` | `d9b25872` |
| 4 | `docs/b0/LARGO_EVALUATION_PLAN.md` | `9b2245c4` |
| 5 | `docs/b0/LARGO_SECURITY_PAYMENTS.md` | `1cbbf08f` |
| 6 | `docs/b0/LARGO_DATA_STRATEGY.md` | `3cac38bf` |
| 7 | `docs/b0/LARGO_MODEL_STRATEGY.md` | `c87e71fd` |
| 8 | `docs/b0/LARGO_BACKEND_API_SPEC.md` | `dae875d6` |
| 9 | `docs/b0/LARGO_FRONTEND_UX_SPEC.md` | `fd180847` |
| 10 | `docs/b0/LARGO_COMPETITIVE_BENCHMARK.md` | `74c2f3d7` |
| 11 | `docs/b0/LARGO_GO_TO_MARKET.md` | `61c18a41` |
| 12 | `docs/b0/B0_CLOSURE_AUDIT.md` | `4cd9fc20` |

Any B1 deliverable that contradicts the documents at these hashes is paused until either the deliverable is corrected or a B0 amendment session re-opens the relevant anchor.

The two highest-resolution authority documents for early B1 work are :

- `LARGO_ADVICE_CONTRACT.md` v0.1.0 — the typed shape of every decision.
- `LARGO_BACKEND_API_SPEC.md` §10 — the canonical strip rule for the customer-safe view.

---

## 4. B0 decisions carried into B1

The following anchors are **frozen** and B1 work must respect them as starting constraints. They are restated here for B1 ticket review ; the canonical source remains the B0 documents.

- Phase 1 = flights only.
- Phase 1 = no live auto-buy.
- Phase 1 = no silent auto-buy.
- `LargoAdvice` contract version = `0.1.0`.
- `AuditBlock` minimal envelope : `audit_id`, `parent_advice_id` only.
- `audit_id === advice_id` in Phase 1.
- Customer-safe view is stripped server-side, deterministic, version-locked.
- Numeric confidence (`confidence.numeric_value`) is internal / admin only.
- `technical_details` is admin only. Never customer UI.
- ABSTAIN is a first-class product state. Returns 200, never 4xx, never 5xx.
- `observed_price_usd` may be `null`. Never coerced to 0.
- `provider.primary_provider` may be `null`. Never coerced.
- No fake zero price. `null` renders as a proper failure state.
- Backend is authoritative for every safety value.
- Frontend is untrusted. Frontend renders, never decides.
- ML output is semi-trusted. Validated, gated, overrideable by the rule layer.
- No LLM in the decision path.
- No public claim before benchmark evidence.
- No dark patterns. No fake scarcity, no fake urgency, no hidden cancel, no pre-checked auto-buy.
- No auto-buy implementation until the security gate stack is met.
- No Stripe live keys in Phase 1.
- No Supabase migration without an explicit, named, reviewed migration plan.
- No endpoint without a bounded implementation ticket citing `LARGO_BACKEND_API_SPEC.md`.

These twenty-three rails are non-negotiable in B1. A ticket that conflicts with one of them is rejected at review.

---

## 5. Repository state warning

The working tree may contain legacy artefacts from earlier phases (V1, V7, V7a, V7.6 Ultra). The B0 closure audit (Section 29) flags them as out-of-scope for B0 :

- `scripts/*` (ML training, ingestion, ops scripts ; V7a is the active baseline ; V7.6 Ultra is research-only).
- `.env.local.bak.*` (backup environment files — must never be staged).
- `reports/` (historical evaluation outputs).
- `logs/` (historical run logs).
- `.tmp-bts-db1b/`, `.tmp-bts-t100/` (working ingestion directories).

This plan **does not clean any of them**. The repo hygiene plan is **a Sprint 0 deliverable** (Section 11) and must :

- enumerate each legacy artefact with its current path or glob ;
- propose a per-category disposition (keep / quarantine / remove / move) ;
- mark explicitly any artefact whose disposition the V7a shadow loop depends on ;
- be reviewed by the founder before any `rm` or `git mv` is executed ;
- be a separate commit per category ; never a mass cleanup commit ;
- forbid `git add .` during cleanup.

Until the repo hygiene plan is committed, no other B1 sprint may begin.

---

## 6. Branching and commit discipline

Branch strategy (recommended, Sprint 0 must finalize) :

- `main` is the source-of-truth for both docs and (eventually) code.
- B1 documentation work commits directly to `main` only when explicitly scoped (this plan is one such case).
- B1 code work uses dedicated feature branches : `b1/<scope>` where `<scope>` is short and matches the ticket.
- No direct commit to `main` for code work.
- No `git push --force` to `main`. Period.
- No `git rebase -i` on `main`. Period.

Commit discipline (binding for every B1 commit) :

- One bounded change per commit.
- Stage by name, never `git add .`, never `git add -A`.
- Commit message format : `<scope>(b1): <imperative summary>` (e.g. `feat(b1): add CustomerSafeAdvice type`, `test(b1): cover null price in strip function`, `docs(b1): clarify Sprint 0 hygiene plan`).
- Commit message body cites the B0 section the change implements.
- No `--no-verify`, no `--no-gpg-sign`. Hooks must pass.
- No `--amend` after a hook failure ; create a new commit.
- No `.env*` ever in any commit.

PR discipline (when GitHub PRs are introduced — likely Sprint 0 or Sprint 1 decision) :

- Description cites the B0 section.
- Diff under ~300 lines net unless the ticket explicitly justifies more.
- Tests included or explicitly waived in writing.
- Reviewer (founder, in early B1) signs off before merge.

---

## 7. Implementation principles

Six principles for any B1 implementation work, derived from the B0 stack.

1. **Inspect before edit.** Read the file ; understand the function ; then propose the diff.
2. **Name target files before editing.** Each prompt names the files in scope. Files outside the named list are not touched.
3. **Cite B0 sections in every ticket and PR description.** A ticket without a citation is rejected.
4. **Types and tests before behavior.** TypeScript types and unit tests precede any function body. The function body is justified by the type and tested by the test.
5. **Pure functions where the contract allows.** The strip function, the validator, fixture-builders, the regret-label computation are pure. Side effects are confined to a small adapter layer specified in B0.
6. **Stop on ambiguity.** If the prompt is unclear, the assistant asks. It does not invent.

---

## 8. Files allowed in B1

Files that **may be touched** in B1, only under an explicit, scoped prompt. Touch outside an explicit scope is a stop condition (Section 22).

- `lib/largo/**` — Largo library code (types, pure functions, validators).
- `types/largo/**` — alternative location for shared types if the project later prefers `types/` over `lib/`. One of the two locations will be picked in Sprint 1 ; the other becomes forbidden.
- `app/api/largo/**` — future API route handlers. Not in early B1 sprints.
- `components/largo/**` — future React components for Largo surfaces. Not in early B1 sprints.
- `tests/largo/**` or co-located `**/*.test.ts(x)` — Largo test files.
- `docs/b1/**` — B1 documentation.
- `docs/b1/sprints/**` — per-sprint planning notes if needed.
- `package.json` — only when adding a development dependency required by an authorized ticket (e.g. zod for schema validation), with explicit prompt.
- `tsconfig.json` — only if a tsconfig adjustment is required for a Largo type path, with explicit prompt.
- `.gitignore` — only to add new ignore lines that protect against accidental commits (e.g. `*.env*`), with explicit prompt.

Anything else is forbidden unless the prompt explicitly opens it.

---

## 9. Files forbidden in B1

Files that **must not be touched** in B1 unless the prompt explicitly scopes the touch with a documented reason.

- `.env*` — every environment file. No exception. Includes `.env`, `.env.local`, `.env.local.bak.*`, `.env.production`, `.env.test`. Touching these aborts the session.
- `scripts/cloud/v7a/**` — V7a code path (active baseline, shadow-validated 2026-04-25). Hands off.
- `scripts/cloud/v76_ultra/**` — V7.6 Ultra research artefacts. Research-only ; not Phase 1 inputs.
- `scripts/train/**` — any training script. No new training run in early B1.
- `scripts/ingest/**` — ingestion scripts inventoried in `LARGO_DATA_STRATEGY.md` §3.1 with no Phase 1 commitment. Not touched in early B1.
- `app/api/cron/**` — cron handlers. No cron change in early B1.
- Watcher-related files (paths to be enumerated by the repo hygiene plan, Sprint 0 deliverable). Not touched.
- `supabase/migrations/**` — Supabase migrations. None created in B1 unless an explicit migration prompt with table policy is given.
- Stripe payment execution code paths (any file under `lib/stripe/**` or `app/api/payments/**` once they exist). No payment code in early B1.
- Modal deployment code. Hands off.
- `bma_weights.json`, `copula_weights.json`, `xgb_meta_weights.json` — V7.6 Ultra training artefacts in repo root. Hands off.
- `reports/**`, `logs/**`, `.tmp-bts-db1b/**`, `.tmp-bts-t100/**` — historical artefacts. Not touched until repo hygiene plan dictates.

A B1 prompt may open one of these paths only by naming it explicitly and citing why. Implicit touch is forbidden.

---

## 10. Sprint structure

B1 candidate sprints. Order is recommended ; only Sprint 0 is mandatorily first.

| sprint | goal | allowed file types | forbidden actions | exit criteria |
|---|---|---|---|---|
| Sprint 0 | Repo safety + implementation guardrails (repo hygiene plan, branch strategy, pre-commit hook design, Claude Code rules acceptance, allow/deny file lists confirmed) | `docs/b1/**` only | Any code change ; any `.env*` touch ; any V7a / watcher / cron / Modal / Stripe / Supabase touch | Repo hygiene plan committed ; branch strategy committed ; founder accepts the rules in writing ; readiness gates of `B0_CLOSURE_AUDIT.md` §23 all green |
| Sprint 1 | Contract-safe foundations : `CustomerSafeAdvice` type derived from `LargoAdvice` v0.1.0, pure stripping function, unit tests | `lib/largo/**` (or `types/largo/**`), test files, `docs/b1/**`, optionally `package.json` for a dev dep | Endpoints, components, migrations, providers, payments, ML, V7a, watcher, cron | `CustomerSafeAdvice` type committed ; pure strip function committed with tests ; tests cover null price, ABSTAIN, numeric confidence stripped, technical_details stripped, audit_id stripped |
| Sprint 2 | Fixtures and runtime validation : valid `LargoAdvice` v0.1.0 fixtures, runtime schema validator, fixture-against-validator tests | `lib/largo/**`, `tests/largo/**`, `docs/b1/**` | Same forbidden as Sprint 1, plus no producer code | Fixtures cover the eleven critical UI states ; validator rejects invalid payloads ; round-trip tests strip-then-validate pass |
| Sprint 3 | Backend skeleton planning (route shape design, error model wiring design, idempotency model design — design only, no live route) | `docs/b1/**` only ; **no** `app/api/largo/**` files yet | Live route handlers ; database calls ; Stripe ; provider calls | Route design doc committed ; mapping `LARGO_BACKEND_API_SPEC.md` endpoints → file structure committed ; no runtime code |
| Sprint 4 | Frontend mock planning (AdviceCard state matrix per `LARGO_FRONTEND_UX_SPEC.md`, copy library draft) | `docs/b1/**` only ; **no** `components/largo/**` files yet | Live components ; CSS ; routes | State matrix doc committed ; copy library draft committed |
| Sprint 5 | Methodology page draft + waitlist landing copy (Markdown only) | `docs/b1/**` only | Live route ; analytics ; signup endpoint | Methodology Markdown committed ; landing copy Markdown committed ; no live page |

Each sprint is small. Each sprint has at least one written exit criterion. No sprint begins before the prior sprint's exit criteria are met. No sprint contains "while we are at it" work.

---

## 11. Sprint 0 — repo safety and implementation guardrails

**Goal.** Install the safety perimeter so that B1 coding cannot accidentally touch V7a, the watcher, crons, Stripe, providers, or `.env*`.

**Deliverables (all in `docs/b1/`) :**

1. `docs/b1/REPO_HYGIENE_PLAN.md` — enumerates legacy artefacts (per Section 5 above), per-category disposition, V7a-dependence flags, per-category commit policy.
2. `docs/b1/BRANCH_STRATEGY.md` — finalizes the recommendations of Section 6 of this plan ; pins `b1/<scope>` convention ; pins commit message format ; pins PR template if PRs are used.
3. `docs/b1/PRECOMMIT_DESIGN.md` — design (not implementation) of the pre-commit hooks intended to catch `.env*` staging, broad `git add .` usage, and forbidden-path edits. The hook itself is implemented in a later sprint when the relevant tooling is in scope.
4. `docs/b1/CLAUDE_CODE_RULES.md` — codifies the rules of Section 20 of this plan into a self-contained reference Claude can be pointed to in every B1 prompt.
5. `docs/b1/FILE_ALLOW_DENY.md` — a stricter, machine-checkable version of Sections 8 and 9 of this plan.

**Forbidden in Sprint 0 :**

- Any code change.
- Any `.env*` touch.
- Any V7a / watcher / cron / Modal / Stripe / Supabase touch.
- Any installation of dependencies (no `npm install`, no `pnpm add`).
- Any change to `package.json`, `tsconfig.json`, `.gitignore` (those are Sprint 1+ if needed).

**Exit criteria :**

- The five Sprint 0 documents committed.
- Founder signs off on the rules in writing (commit message acknowledgement, or a separate `docs/b1/SIGNOFF.md`).
- `B0_CLOSURE_AUDIT.md` §23 readiness gates re-checked and all green.
- No file outside `docs/b1/` modified during the sprint.

Sprint 0 is the entry point. It must not be skipped, condensed, or merged into Sprint 1.

---

## 12. Sprint 1 — contract-safe foundations

**Goal.** Land the smallest, safest piece of Largo code : the customer-safe view type and its pure stripping function, with unit tests, citing `LARGO_ADVICE_CONTRACT.md` and `LARGO_BACKEND_API_SPEC.md` §10.

**Deliverables :**

1. **`CustomerSafeAdvice` type** in `lib/largo/types/customer-safe-advice.ts` (or `types/largo/customer-safe-advice.ts` once Sprint 1 picks the location). Derived from `LargoAdvice` v0.1.0 via `Pick`, `Omit`, or a hand-written interface that mirrors the strip rule of `LARGO_BACKEND_API_SPEC.md` §10.
2. **`stripToCustomerSafe(advice: LargoAdvice): CustomerSafeAdvice`** — a pure function in `lib/largo/safe-view/strip.ts`. No side effects. No I/O. No async. Inputs validated ; output structurally guaranteed by the type.
3. **Unit tests** in `lib/largo/safe-view/strip.test.ts` (or `tests/largo/strip.test.ts`). Required cases :
   - `confidence.numeric_value` removed in output.
   - `confidence.calibration_meta` removed in output.
   - `audit_block.audit_id` removed in output.
   - `audit_block.parent_advice_id` removed in output.
   - `technical_details` removed in output.
   - `provider.disagreement` summarized (or stripped, whichever the strip rule says) in output.
   - `observed_price_usd` preserved when null. Never coerced to 0.
   - `provider.primary_provider` preserved when null. Never coerced.
   - `recommendation === 'ABSTAIN'` preserved.
   - `valid_until` preserved.
   - `schema_version === '0.1.0'` preserved.
4. **Citations.** Each deliverable cites `LARGO_ADVICE_CONTRACT.md` §3, §6, §17 and `LARGO_BACKEND_API_SPEC.md` §10.

**Forbidden in Sprint 1 :**

- Any endpoint, any route handler, any `app/api/largo/**` file.
- Any component, any `components/largo/**` file.
- Any Supabase migration, any `supabase/migrations/**` file.
- Any provider call, any HTTP fetch.
- Any Stripe code path.
- Any V7a / watcher / cron / Modal touch.
- Any `.env*` touch.
- Any test that depends on a network or a database.

**Exit criteria :**

- Type committed ; pure function committed ; tests committed and passing locally.
- Coverage shows the eleven required test cases.
- Diff under 300 lines net.
- PR description (or commit message body) cites the B0 sections.
- No file outside the named list touched.

Sprint 1 is the first real code. It is intentionally small and contract-bound.

---

## 13. Sprint 2 — fixtures and validation

**Goal.** Land the fixtures and the runtime validator that the rest of B1 will rely on for tests and design reviews.

**Deliverables :**

1. **Fixtures** in `lib/largo/fixtures/largo-advice/*.ts`. Minimum set : one fixture per critical UI state from `LARGO_FRONTEND_UX_SPEC.md` (BUY_NOW high, BUY_NOW moderate, WAIT, MONITOR, ALERT, ABSTAIN with `unavailable` confidence, ABSTAIN due to provider disagreement, ABSTAIN due to null price, error after retry, expired advice, anonymous quota exceeded surface placeholder).
2. **Runtime validator** in `lib/largo/validator/advice-validator.ts`. Likely zod or equivalent ; choice locked in this sprint after a short comparison note. The validator mirrors the type structure and rejects invalid payloads with structured errors.
3. **Round-trip tests** : every fixture passes `validate(fixture)` ; every fixture passes through `stripToCustomerSafe` and the result still passes `validateCustomerSafe(stripped)`.
4. **Docs** : `docs/b1/sprints/SPRINT_2_NOTES.md` capturing the validator-library decision and the rationale.

**Forbidden in Sprint 2 :**

- Same forbidden as Sprint 1.
- No producer code (no function that *generates* a `LargoAdvice` from input — only validates and strips).
- No connection to Supabase, Stripe, providers, V7a.

**Exit criteria :**

- Eleven (or more) fixtures committed.
- Validator committed and passing all fixture tests.
- Round-trip tests passing.
- Validator-library decision committed in writing.

---

## 14. Sprint 3 — backend skeleton planning

**Goal.** Design the file structure, the error wiring, the idempotency model, and the route shape for the future `app/api/largo/**` endpoints, **without writing any handler**.

**Deliverables (in `docs/b1/`) :**

1. `docs/b1/sprints/SPRINT_3_ROUTE_DESIGN.md` — maps each endpoint of `LARGO_BACKEND_API_SPEC.md` to a future file path, an HTTP method, an input shape, an output shape, and an error model.
2. `docs/b1/sprints/SPRINT_3_IDEMPOTENCY.md` — finalizes the idempotency design with `audit_id` as the natural key, with replay semantics for repeat calls.
3. `docs/b1/sprints/SPRINT_3_ERROR_MODEL.md` — pins the eleven stable error codes from `LARGO_BACKEND_API_SPEC.md` to their HTTP statuses and customer-safe messages.

**Forbidden in Sprint 3 :**

- Any file under `app/api/largo/**`.
- Any database call, any migration, any Stripe call, any provider call.
- Any environment variable read.

**Exit criteria :**

- Three design docs committed.
- Cross-references to `LARGO_BACKEND_API_SPEC.md` sections complete.
- No runtime code created.

---

## 15. Sprint 4 — frontend mock planning

**Goal.** Lock the AdviceCard state matrix, the copy library, and the failure-state UX **without writing any component**.

**Deliverables (in `docs/b1/`) :**

1. `docs/b1/sprints/SPRINT_4_ADVICECARD_STATES.md` — exhaustive state matrix mapping each input shape (per fixture from Sprint 2) to a rendered state name and a copy id.
2. `docs/b1/sprints/SPRINT_4_COPY_LIBRARY.md` — copy ids and their English Phase 1 strings, derived from `LARGO_FRONTEND_UX_SPEC.md` §29 sample copy.
3. `docs/b1/sprints/SPRINT_4_FAILURE_UX.md` — null price UX, ABSTAIN UX, provider disagreement UX, expired advice UX, anonymous quota exceeded UX.

**Forbidden in Sprint 4 :**

- Any file under `components/largo/**`.
- Any CSS, any design tokens.
- Any route file.

**Exit criteria :**

- Three planning docs committed.
- Copy ids referenced in the state matrix exist in the copy library.
- No runtime code created.

---

## 16. Sprint 5 — methodology / waitlist planning

**Goal.** Draft the methodology page content and the waitlist landing copy as Markdown, **without creating live routes**.

**Deliverables (in `docs/b1/`) :**

1. `docs/b1/methodology-draft.md` — long-form content for the methodology page, derived from `LARGO_DOMINATION_STRATEGY.md`, `LARGO_PRODUCT_VISION.md`, `LARGO_EVALUATION_PLAN.md`. Founder-signed voice. No `[to verify]` markers without resolution path.
2. `docs/b1/landing-draft.md` — landing page sections per `LARGO_GO_TO_MARKET.md` §35, founder-signed voice, no fake testimonials, no comparative claims.
3. `docs/b1/waitlist-draft.md` — waitlist questions per `LARGO_GO_TO_MARKET.md` §15.1.

**Forbidden in Sprint 5 :**

- Any live route, any `app/methodology/**`, any `app/landing/**`, any `app/waitlist/**`.
- Any analytics integration.
- Any signup endpoint.

**Exit criteria :**

- Three Markdown drafts committed.
- Founder signs off on copy tone.
- No runtime code created.

---

## 17. First code task recommendation

The first real code task recommended by this plan is **Sprint 1, deliverable 1 + 2 + 3** : create `CustomerSafeAdvice`, write the pure `stripToCustomerSafe` function, write its unit tests.

**Why this task and no other :**

- It is grounded in the most authoritative B0 sections (`LARGO_ADVICE_CONTRACT.md` §6 and `LARGO_BACKEND_API_SPEC.md` §10), which leave no ambiguity about what the function must do.
- It closes ambiguity #6 of `B0_CLOSURE_AUDIT.md` §19 (canonical strip rule reconciliation between BACKEND and FRONTEND).
- It is purely functional. No I/O, no DB, no network, no async, no Stripe, no provider, no V7a, no cron, no Modal.
- It produces an asset (a type and a function) that every later B1 ticket reuses.
- Its tests cover the most-violated invariants (null price never coerced, numeric confidence never leaks, audit_id never leaks, technical_details never leak, ABSTAIN preserved).
- It is small enough to inspect end-to-end in one review.
- It introduces no new dependency unless the validator decision pulls in a library, which is reserved for Sprint 2.

**This document does not implement that task.** It only recommends it. The implementation must come from a separately-scoped B1 prompt, after Sprint 0 deliverables are committed.

---

## 18. Alternative first code tasks rejected

Tasks considered as candidates for the first real code commit and **rejected** for the reasons given.

| candidate | rejection reason |
|---|---|
| Implement `app/api/largo/advice` route | Requires producer logic, error wiring, idempotency, and a runtime validator that do not yet exist. Premature surface for the first code task. Reserved for after Sprint 3 design. |
| Implement an `AdviceCard` React component | Requires a customer-safe view type, fixtures, and a copy library that do not yet exist. Premature ; depends on Sprints 1 + 2 + 4. |
| Create the eight Supabase tables of `LARGO_BACKEND_API_SPEC.md` | Requires a migration policy not yet adopted (`B0_CLOSURE_AUDIT.md` §20 item 2). Forbidden until the policy is signed. |
| Wire Stripe Payment Intent (sandbox) | Forbidden by `LARGO_SECURITY_PAYMENTS.md` and `B0_CLOSURE_AUDIT.md` §21. No payment code in early B1. |
| Build the `LargoAdvice` producer pipeline | Requires the validator and the strip function as inputs ; bypasses Sprint 1 + 2. Also pulls in V7a integration, which is forbidden. |
| Touch V7a to "wire the shadow loop into Largo" | Forbidden. V7a is the active baseline, untouched. The B1 sequence does not need V7a touch ; the producer adapter (in a later sprint) reads V7a outputs without modifying V7a code. |
| Open the public audit page | Phase 2+ deliverable. Premature ; would expose insufficient data. |
| Run a Modal / training job for a new model | No new training run in early B1. Model strategy locked to V7a baseline ; no successor authorized yet. |
| Refactor the working tree (legacy `scripts/*`, `.env.local.bak.*`) | Forbidden as a first task. Repo hygiene plan must be authored first (Sprint 0) ; cleanup happens later, per category, never as a sweep. |

These rejections are not provisional. They become re-eligible only when their named dependencies are met, in the order this plan specifies.

---

## 19. Required tests before first code commit

The first code commit (Sprint 1, deliverables 1 + 2 + 3) must include unit tests covering the following cases. A commit that does not cover these is not authorized.

1. **Null price preserved.** `stripToCustomerSafe` with `observed_price_usd: null` produces `observed_price_usd: null`. Never `0`. Never `undefined`. Never absent.
2. **Null primary provider preserved.** `stripToCustomerSafe` with `provider.primary_provider: null` produces `provider.primary_provider: null`. Never coerced.
3. **Numeric confidence stripped.** `stripToCustomerSafe` output contains no `confidence.numeric_value` field at any nesting level.
4. **Calibration meta stripped.** No `confidence.calibration_meta` anywhere in the output.
5. **Audit id stripped.** No `audit_block.audit_id` anywhere in the output.
6. **Parent advice id stripped.** No `audit_block.parent_advice_id` anywhere in the output.
7. **Technical details stripped.** No `technical_details` anywhere in the output.
8. **Provider disagreement summarized only.** The `provider.disagreement` field, if present in input, is replaced by the summary form specified by `LARGO_BACKEND_API_SPEC.md` §10 in the output.
9. **ABSTAIN preserved.** `recommendation: 'ABSTAIN'` in input → `recommendation: 'ABSTAIN'` in output.
10. **`valid_until` preserved.** Stripping never modifies the validity timestamp.
11. **`schema_version` preserved.** Stripping never modifies `schema_version` (`'0.1.0'` in/out).
12. **Idempotency.** `stripToCustomerSafe(stripToCustomerSafe(x))` equals `stripToCustomerSafe(x)` (the function is idempotent on its own output).
13. **Purity.** No mutation of input. The input `LargoAdvice` is structurally unchanged after the call.
14. **Type-level guarantee.** `CustomerSafeAdvice` is structurally a strict subset of `LargoAdvice`. A TypeScript test (`tsd` or equivalent) ensures the strip output type is assignable to `CustomerSafeAdvice` and not to `LargoAdvice` (i.e., admin fields cannot accidentally type-leak).
15. **Determinism.** Calling the function twice with the same input yields equal output (deep equality).

Tests must run locally without network, without database, without Stripe, without environment variables, in under one second.

---

## 20. Claude Code operating rules

Strict rules that bind every Claude Code session in B1.

1. **One bounded task per prompt.** No "while we are at it" sweeps. If the prompt names two tasks, ask the user to split.
2. **Inspect before edit.** Read the file ; understand the function ; then propose the diff.
3. **Name target files before editing.** The prompt names the files in scope. Files outside the named list are not touched.
4. **Never touch `.env*`.** Period. No exception. If a secret is needed, the user adds it manually, out of the repo.
5. **Never use `git add .`.** Never `git add -A`. Stage by name.
6. **Never stage legacy noise.** Files outside the prompt's allow-list are never staged, even if they show in `git status`.
7. **Never edit V7a / watcher / crons** unless the prompt explicitly requests it with a documented reason.
8. **Never create migrations** (Supabase or otherwise) unless the prompt says "create migration" with the table policy referenced.
9. **Never implement payment code** without a SECURITY_PAYMENTS-specific prompt that names the section being implemented and confirms sandbox-only keys.
10. **Never implement auto-buy** before the gate stack of `LARGO_SECURITY_PAYMENTS.md` is met. Auto-buy in Phase 1 is forbidden.
11. **Never expose numeric confidence to customer UI.** This is non-negotiable across every ticket.
12. **Never expose `technical_details` to customer UI.** Same.
13. **Never expose `audit_id` to customer UI.** Same.
14. **Stop on ambiguity.** Ask the user. Do not invent.
15. **Show diff summary before commit.** Never auto-commit a code change.
16. **Every implementation cites the B0 section.** A PR or commit message without a citation is rejected.
17. **If unexpected files change, stop immediately.** Surface the surprise to the user. Do not proceed.
18. **No `git push` from the assistant by default.** Push is a user action.
19. **Convergence mode.** Diff before execution. Format respected mot pour mot. Parallel findings noted, not opened. Git operations controlled by the user.
20. **No "improvements" outside the ticket.** Even if a better way is visible, stay in scope unless invited.

These rules are not preferences. They are the operating contract.

---

## 21. Risk register

Risks specific to early B1.

| risk | likelihood | impact | mitigation |
|---|---|---|---|
| Sprint 0 is skipped or condensed into Sprint 1 | medium | high | This plan blocks Sprint 1 entry until Sprint 0 deliverables exist (Section 11 exit criteria) |
| First code task drifts to an endpoint or component | medium | high | Section 17 names the first task ; Section 18 enumerates rejected alternatives ; reviewer checks PR scope against Section 17 |
| Customer-safe view type drifts from `LARGO_BACKEND_API_SPEC.md` §10 strip rule | medium | high | Tests of Section 19 enforce the rule field by field ; canonical source is BACKEND_API_SPEC §10 |
| `numeric_value` accidentally leaks into a customer surface | low | catastrophic | Type-level test (Section 19 case 14) catches at compile time ; runtime test catches at runtime ; both required |
| `null` price coerced to `0` somewhere in stripping or rendering | medium | high | Sections 19 cases 1 + 2 ; failure-state UX in Sprint 4 |
| Legacy `.env.local.bak.*` accidentally committed | low | catastrophic | `.gitignore` audit in Sprint 0 ; pre-commit hook design in Sprint 0 ; rule §20.4 |
| V7a accidentally modified during a Largo ticket | low | high | Section 9 forbids ; rule §20.7 ; reviewer checks diff |
| Migration shipped without policy | low | catastrophic | Rule §20.8 ; readiness gate `B0_CLOSURE_AUDIT.md` §23 gate 6 |
| Stripe live key referenced anywhere | low | catastrophic | Rule §20.9 ; sandbox-only convention ; pre-commit hook design |
| Auto-buy code path created "to test" | low | catastrophic | Rule §20.10 ; cohort discipline ; reviewer scope check |
| Producer code shipped before validator | medium | medium-high | Sprint order locks Sprint 2 (validator) before Sprint 3 (backend skeleton) ; rule §7.4 (types and tests before behavior) |
| Frontend component shipped before customer-safe view | low | high | Section 9 forbids ; Sprint order locks Sprint 1 before Sprint 4 |
| LLM-generated code merged without review | medium | medium | Rule §20.15 (show diff before commit) ; PR review by founder ; rule §20.16 (cite B0 section) |
| Branch strategy ambiguity → direct commits to `main` for code | medium | medium | Sprint 0 deliverable 2 (BRANCH_STRATEGY.md) finalizes ; rule §6 |
| Re-opening B0 frozen anchors mid-B1 | medium | high | Section 1 defers to B0 amendment process ; this plan does not silently override |
| Vocabulary drift between Phase 1/2/3 (technical) and cohort 0/0→10/100/1000/GA (GTM) | high | low | `B0_CLOSURE_AUDIT.md` §19 ambiguity 1 ; B1 ticket templates require explicit phase-cohort mapping |
| Working tree noise misleads `git status` reads | high | low | Sprint 0 repo hygiene plan ; rule §20.6 |

These risks are revisited at the end of each sprint.

---

## 22. Stop conditions

Conditions that immediately pause B1 work. The assistant must surface the condition to the user and not proceed.

1. **Unexpected file modifications.** Any file changed outside the prompt's named scope.
2. **Any `.env*` staged.** Even accidentally. Hard stop.
3. **Migration created without prompt.** Any new file under `supabase/migrations/**` without an explicit `create migration` prompt.
4. **V7a touched.** Any change to `scripts/cloud/v7a/**` or related paths.
5. **Watcher touched.** Any change to watcher-related files (paths to be enumerated by the repo hygiene plan).
6. **Cron touched.** Any change to `app/api/cron/**`.
7. **Modal touched.** Any change to Modal deployment code.
8. **Payment code touched.** Any change to `lib/stripe/**` or `app/api/payments/**` outside an explicit, scoped payment prompt.
9. **Stripe live key referenced.** Anywhere. Including comments. Hard stop.
10. **Multiple scopes edited in one prompt.** If the assistant starts changing files across two unrelated allow-list categories, stop.
11. **Customer-safe view ambiguity.** If a strip-rule field is unclear, stop and resolve against `LARGO_BACKEND_API_SPEC.md` §10 before proceeding.
12. **Failing tests without clear cause.** If tests fail and the cause is not understood within one inspection cycle, stop and surface.
13. **Numeric confidence appears in any customer-rendered branch.** Even in a draft. Stop.
14. **`technical_details` appears in any customer-rendered branch.** Stop.
15. **`audit_id` appears in any customer-rendered branch.** Stop.
16. **A B0 frozen anchor is being silently weakened.** If the implementation appears to require relaxing a B0 anchor, stop. Open a B0 amendment session, do not edit through.
17. **An endpoint is being created before its ticket is approved.** Stop.
18. **A component is being created before the customer-safe view is committed.** Stop.
19. **Time pressure overrides scope.** If the assistant feels pulled to widen scope to "ship something today", stop. Time pressure is a forbidden reason in B1.

A stop condition is not a failure. It is the safety system working.

---

## 23. Success criteria for B1

What B1 looks like when planning is complete (this document committed) and when early sprints have landed cleanly.

**End of B1 planning (after this document is committed) :**

- This plan exists at `docs/b1/B1_IMPLEMENTATION_PLAN.md`.
- Founder has read and accepted Sections 4, 8, 9, 17, 20, 22, 25.
- The four readiness items of `B0_CLOSURE_AUDIT.md` §30 are tracked : `B1_IMPLEMENTATION_PLAN.md` ✓, gates of §23 (open), Section 28 rules accepted (open), repo hygiene plan (open).
- No code has been written.

**End of Sprint 0 :**

- The five Sprint 0 documents committed.
- Founder sign-off captured.
- Working tree noise unchanged ; no legacy file modified ; no `.env*` staged.

**End of Sprint 1 :**

- `CustomerSafeAdvice` type and `stripToCustomerSafe` function committed with tests.
- Coverage on the fifteen test cases of Section 19.
- No file outside `lib/largo/**`, test files, and `docs/b1/**` modified.
- `git log --oneline -5` shows small, scope-bound commits.

**End of Sprint 2 :**

- Fixtures and validator committed.
- Round-trip tests passing.

**End of Sprint 3, 4, 5 :**

- Design docs committed in `docs/b1/sprints/**`.
- No runtime code created in those sprints.

If at any sprint the success criteria are not met, B1 pauses until the gap is closed. No "we'll catch up next sprint."

---

## 24. What B1 must not implement

Restated from `B0_CLOSURE_AUDIT.md` §25 and adapted for B1 ticket review.

- **Live auto-buy.** Architecture only. No Stripe capture in Phase 1.
- **Stripe capture in production.** No live keys. Sandbox only when payment work begins, gated to a later phase.
- **Provider booking.** No booking handoff that converts to a real ticket in Phase 1.
- **Model training (any new run).** V7a remains the active baseline, untouched.
- **V7.6 Ultra resurrection.** Research-only.
- **Supabase migrations without plan.** Each migration requires its own ticket and review.
- **Public benchmark claims.** No public comparative claim until `[to verify]` markers are validated.
- **Paid acquisition.** Phase 1 = founder-led organic only.
- **Broad public launch.** Cohort discipline.
- **Silent execution of any kind.**
- **LLM decisioning.**
- **Removing V7a.** Stays as active baseline until a successor beats it on the named primary metric.
- **Live keys in any environment.** No `.env*` commit.
- **Components without contract citation.** Every component cites its source-of-truth section.
- **Endpoints without ticket citation.** Every endpoint cites its source-of-truth section.
- **Refactor of legacy code "while we are at it".** Strictly forbidden.
- **Adding dependencies outside an authorized prompt.** No surprise installs.
- **Modifying `package.json`, `tsconfig.json`, or `.gitignore`** outside an authorized prompt.

This list is not exhaustive. The forbidden patterns of `B0_CLOSURE_AUDIT.md` §22 remain authoritative.

---

## 25. Transition criteria from B1 planning to B1 coding

B1 coding may not begin until **all** of the following are true.

1. **`B1_IMPLEMENTATION_PLAN.md` committed.** This document at `docs/b1/B1_IMPLEMENTATION_PLAN.md`.
2. **Founder accepts the rules.** Signed off in writing (commit acknowledgement, or a separate `docs/b1/SIGNOFF.md`).
3. **Sprint 0 deliverables committed** (Section 11) :
   - `docs/b1/REPO_HYGIENE_PLAN.md`
   - `docs/b1/BRANCH_STRATEGY.md`
   - `docs/b1/PRECOMMIT_DESIGN.md`
   - `docs/b1/CLAUDE_CODE_RULES.md`
   - `docs/b1/FILE_ALLOW_DENY.md`
4. **`B0_CLOSURE_AUDIT.md` §23 readiness gates all green.**
5. **The first task scoped in writing.** A short prompt naming the files, the citations, the tests, and the expected diff size.
6. **Branch created.** `b1/<scope>` per Section 6.
7. **No working-tree ambiguity for the target files.** The legacy noise is either stable (Sprint 0 hygiene plan resolved) or explicitly outside the target paths.

If any one of these is missing, coding does not begin. The session pauses.

---

## 26. Final recommendation

**Recommendation : open Sprint 0 immediately after this plan is committed.** Do not skip to Sprint 1.

Rationale :

- Sprint 0 has zero code risk.
- Sprint 0 produces five reference documents that every subsequent B1 prompt cites.
- Sprint 0 closes the readiness gates of `B0_CLOSURE_AUDIT.md` §23.
- Sprint 0 catches `.env*`-staging risks and forbidden-path edits before they happen.
- Skipping Sprint 0 transfers all of its risk into Sprint 1, which is the first sprint with real code.

After Sprint 0 closes, the recommendation is **Sprint 1 task : `CustomerSafeAdvice` type + `stripToCustomerSafe` pure function + the fifteen unit tests of Section 19**. It is the smallest, safest, most contract-bound first code task available.

V7a remains in shadow, untouched. V7.6 Ultra remains research-only, untouched.

This document does not implement any of the above. It only authorizes the next session to plan Sprint 0 in writing, after explicit founder approval.

---

## 27. Document status

| field | value |
|---|---|
| Document type | B1 implementation plan |
| Phase | B1 planning, opening artefact |
| Version | 0.1.0 |
| Status | Draft, opening |
| Frozen anchors inherited | per Section 4, twenty-three rails |
| Source documents | per Section 3, twelve B0 documents at pinned commits |
| Open transition criteria | per Section 25, seven items |
| Recommended first sprint | Sprint 0 — repo safety + implementation guardrails |
| Recommended first code task | `CustomerSafeAdvice` type + `stripToCustomerSafe` + tests, Sprint 1 |
| Successor | Sprint 0 deliverables in `docs/b1/` (separate session) |
| Forbidden in this document | code, migrations, endpoints, components, V7a touch, deployment, model runs, training runs, commits and pushes by the assistant, `.env*` modification, broad git staging, modification of any file outside `docs/b1/B1_IMPLEMENTATION_PLAN.md` |
| Author | Flyeas team (assistant-supported, founder-validated) |
| Last updated | 2026-04-27 |

B1 planning opens here.
