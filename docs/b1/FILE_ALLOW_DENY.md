# FILE_ALLOW_DENY.md

**Status:** Sprint 0 — frozen for B1
**Purpose:** Canonical allow/deny path matrix for all B1 work. Every Claude Code prompt and every future pre-commit hook reads this file as source-of-truth. If a path is not on the allow list, it is denied by default.
**Default policy:** **deny**. Allow paths are enumerated; everything else is forbidden until explicitly added here via a founder-authorized update.

---

## 1. Allowed paths (B1 in-scope)

These paths Claude Code may read, edit, create, and stage during B1 — **subject to the prompt-type constraints in §3**.

### 1.1 Documentation
- `docs/b1/**` — B1 docs and sprint outputs.
- `docs/b0/**` — **read-only** reference; never edited in B1.
- `docs/largo/**` (if created) — supplemental Largo docs.

### 1.2 Type definitions
- `types/largo/**` — TypeScript contracts (`LargoAdvice`, `CustomerSafeAdvice`, `AuditBlock`, etc.).

### 1.3 Pure library code
- `lib/largo/**` — pure functions: `stripToCustomerSafe`, validators, formatters, fixture loaders. No I/O, no external calls.

### 1.4 Customer & admin components
- `components/largo/**` — React/Next components for the Largo surface, split into:
  - `components/largo/customer/**` — receives only `CustomerSafeAdvice`.
  - `components/largo/admin/**` — may receive full `LargoAdvice` plus `AuditBlock`.

### 1.5 API routes
- `app/api/largo/**` — Largo HTTP endpoints (advice, audit, admin).
- Explicitly **not** `app/api/cron/**` (denied — see §2).

### 1.6 Tests
- `tests/largo/**` — unit and integration tests for everything in §1.2 to §1.5.
- `tests/fixtures/largo/**` — golden fixtures for advice payloads.

### 1.7 Build / config (read-only by default in B1)
- `package.json`, `pnpm-lock.yaml`, `tsconfig.json` — **read-only** unless prompt explicitly authorizes a named dependency or config change per `CLAUDE_CODE_RULES.md` §18.
- `next.config.js`, `vercel.json` (or `vercel.ts` if migrated) — **read-only** in B1.

## 2. Forbidden paths (B1 out-of-scope)

These paths are denied by default. Touching them requires a scoped, named, founder-authorized prompt that quotes this file and the relevant B0 anchor.

### 2.1 Secrets and environment
- `.env`, `.env.local`, `.env.local.bak.*`, `.env.local.prod`, `.env.production`, `.env.development`, `.env.test` — **never** read, written, or staged by Claude.
- `.env.example` — read-only reference; modifications require an explicit prompt.

### 2.2 CI / CD
- `.github/workflows/**` — including `scraper.yml`, `flyeas-watcher.yml`. Re-arming the watcher is a separate, gated decision.
- `vercel.json` / `vercel.ts` — read-only in B1.

### 2.3 V7a baseline (frozen ML)
- `scripts/cloud/v7a/**`
- `scripts/train/v7a/**`
- `models/v7a/**`
- Any file matching `v7a_*.py`, `v7a_*.json`.

### 2.4 V7.6 Ultra & V7.6 Prod (research-only)
- `scripts/cloud/v76_ultra/**`
- `scripts/cloud/v76_prod/**`
- `scripts/train/v76_*/**`
- `models/v76_*/**`

### 2.5 Other ML / training / ingest
- `scripts/train/**` (all subfolders)
- `scripts/ingest/**`
- `scripts/scrape/**`
- Any file matching `*_train.py`, `*_eval.py`, `*_backtest.py`.

### 2.6 Cron and watcher
- `app/api/cron/**` — including `monitor/route.ts`, `demo-shadow-sweep/route.ts`.
- Any file matching `*watcher*`, `*flyeas-watcher*`.

### 2.7 Database migrations
- `supabase/migrations/**` — schema is documentation-only in B1 until `LARGO_BACKEND_API_SPEC.md` §11 contracts stabilize.
- `prisma/migrations/**` — same.
- Any `.sql` file outside `docs/**`.

### 2.8 Payment code (Phase 1)
- Anything importing `stripe`, `@stripe/*`, calling `paymentIntents`, `setupIntent`, `paymentMethod`. Symbolic mention in `docs/**` only.

### 2.9 ML weights and artifacts
- `bma_weights.json`, `xgb_meta_weights.json`, `copula_weights.json` (root).
- Any file matching `*_weights.json`, `*_model.pkl`, `*.onnx`, `*.gguf` outside an explicit storage layer.

### 2.10 Reports and logs
- `reports/**` — including `reports/v7a_*.json`.
- `logs/**`.
- `tmp/**`, `cache/**`.

### 2.11 Anything not explicitly allowed
Default deny. If a path does not appear in §1, it is forbidden until added here.

## 3. Path allow/deny matrix

| Path | Status | Allowed phase | Required prompt type | Reason |
|------|--------|---------------|----------------------|--------|
| `docs/b1/**` | **Allow** | Sprint 0 → GA | Doc-only, direct-to-`main` allowed (`docs(b1):` commit) | B1 documentation surface. |
| `docs/b0/**` | **Read-only** | All | No edit prompts in B1 | B0 is frozen; updates require a B0-revision sprint. |
| `types/largo/**` | **Allow** | Sprint 1+ | Code prompt on `b1/<scope>` branch | Contract surface for `CustomerSafeAdvice`, `LargoAdvice`, `AuditBlock`. |
| `lib/largo/**` | **Allow** | Sprint 1+ | Code prompt on `b1/<scope>` branch with tests | Pure logic only; `stripToCustomerSafe`, validators. |
| `components/largo/customer/**` | **Allow** | Sprint 4+ | Code prompt on `b1/<scope>` branch with strip-respect tests | Customer UI; receives `CustomerSafeAdvice` only per `LARGO_FRONTEND_UX_SPEC.md` §6. |
| `components/largo/admin/**` | **Allow** | Sprint 4+ | Code prompt on `b1/<scope>` branch | Admin/ops UI; full advice + audit. |
| `app/api/largo/**` | **Allow** | Sprint 3+ | Code prompt on `b1/<scope>` branch with contract tests | Largo HTTP endpoints per `LARGO_BACKEND_API_SPEC.md`. |
| `tests/largo/**` | **Allow** | Sprint 1+ | Code prompt on `b1/<scope>` or `b1/test/<scope>` branch | Unit + integration tests for Largo. |
| `tests/fixtures/largo/**` | **Allow** | Sprint 2+ | Code prompt on `b1/<scope>` branch | Golden fixtures for advice payloads. |
| `package.json` | **Read-only by default** | All | Explicit dep prompt naming dependency, version, justification | Lockfile and supply-chain integrity per `CLAUDE_CODE_RULES.md` §18. |
| `pnpm-lock.yaml` / `yarn.lock` | **Read-only by default** | All | Same as `package.json` | Lockfile drift protection. |
| `tsconfig.json` | **Read-only by default** | All | Explicit config prompt | Compiler config stability. |
| `next.config.js` | **Read-only** | All | Explicit framework prompt | Framework config stability. |
| `vercel.json` / `vercel.ts` | **Read-only** | All | Founder-only | Deployment config; production-affecting. |
| `.env*` (except `.env.example`) | **Deny — Critical** | Never via Claude | None | Secrets; founder-only out-of-band rotation. |
| `.env.example` | **Read-only** | All | Explicit prompt to add a placeholder | Schema for env vars; must contain only placeholders. |
| `.github/workflows/**` | **Deny** | None in B1 | Founder-authorized scoped prompt with `Allow: CI_EDIT` trailer | Re-arming watcher / scraper is a separate gated decision. |
| `scripts/cloud/v7a/**` | **Deny** | None in B1 | Founder-authorized; touching V7a halts shadow validation | Frozen baseline (LightGBM quantile, $58.33 mean abs regret). |
| `scripts/train/v7a/**` | **Deny** | None in B1 | Founder-authorized | Training pipeline; out of B1 scope. |
| `scripts/cloud/v76_ultra/**` | **Deny** | None in B1 | Founder-authorized; research-only | V7.6 Ultra is a research asset, not a production target. |
| `scripts/cloud/v76_prod/**` | **Deny** | None in B1 | Founder-authorized | V7.6 prod is gated by V7a stability. |
| `scripts/train/**` | **Deny** | None in B1 | Founder-authorized | Training out of B1 scope. |
| `scripts/ingest/**` | **Deny** | None in B1 | Founder-authorized | Ingest out of B1 scope. |
| `scripts/scrape/**` | **Deny** | None in B1 | Founder-authorized | Scrape out of B1 scope. |
| `app/api/cron/**` | **Deny** | None in B1 | Founder-authorized | Cron jobs are gated; re-arming requires B1 + ops sign-off. |
| `*watcher*`, `*flyeas-watcher*` | **Deny** | None in B1 | Founder-authorized | Watcher is paused; reactivation is a separate decision. |
| `supabase/migrations/**` | **Deny** | None in B1 (until §11 stable) | Founder-authorized with `Allow: MIGRATION` trailer | Schema drift protection per `LARGO_BACKEND_API_SPEC.md` §11. |
| `prisma/migrations/**` | **Deny** | None in B1 | Founder-authorized | Same. |
| `*.sql` outside `docs/**` | **Deny** | None in B1 | Founder-authorized | No raw SQL in code paths in B1. |
| Stripe / payment imports outside `docs/**` | **Deny — Critical** | Phase 1 forbids; future cohort gate | Founder-authorized at the gated cohort milestone | `LARGO_SECURITY_PAYMENTS.md` §1; `B0_CLOSURE_AUDIT.md` §10. |
| Live auto-buy / silent auto-buy code | **Deny — Critical** | Phase 1 forbids | Founder-authorized at GA | `LARGO_ADVICE_CONTRACT.md` §6 (`can_autobuy` is a flag, not a wire). |
| `bma_weights.json`, `xgb_meta_weights.json`, `copula_weights.json` (root) | **Deny** | None in B1 | Founder-authorized cleanup prompt | Root-level weights are a hygiene issue per `REPO_HYGIENE_PLAN.md` §3 cat. F. |
| `*_weights.json` (any path) | **Deny** | None in B1 | Founder-authorized | Large artifact protection. |
| `reports/**`, `reports/v7a_*.json` | **Deny** | None in B1 | Founder-authorized cleanup prompt | Output artifact, not source. |
| `logs/**` | **Deny** | None in B1 | Founder-authorized cleanup prompt | Output artifact. |
| `models/**` | **Deny** | None in B1 | Founder-authorized | Binary models out of B1 scope. |
| `tmp/**`, `cache/**` | **Deny** | None in B1 | Founder-authorized cleanup prompt | Ephemeral by definition. |
| Any path not listed above | **Deny (default)** | None | Founder must add the path here first | Default-deny policy. |

## 4. Prompt-type definitions

- **Doc-only prompt:** edits files only under `docs/b1/**`. Direct-to-`main` allowed per `BRANCH_STRATEGY.md` §3. Commit prefix: `docs(b1):`.
- **Code prompt on `b1/<scope>` branch:** edits files in §1.2 to §1.6. Branch + PR + squash-merge per `BRANCH_STRATEGY.md` §3-§7. Commit prefix: `feat(b1):` / `fix(b1):` / `test(b1):`.
- **Founder-authorized scoped prompt:** required for any deny path. The prompt must:
  1. Quote the deny path and its row in the matrix above.
  2. Quote the B0 anchor that authorizes the change.
  3. Name a single file (or single small set of files) being touched.
  4. Set the appropriate override env var if/when the pre-commit hook is implemented (`Allow: CI_EDIT`, `Allow: MIGRATION`, `Allow: V7A_DOC_ONLY`, etc.).
  5. Be reviewed by the founder before Claude proposes any `git` command.

## 5. Updating this file

This document is **frozen for the duration of Sprint 0**. Updates after Sprint 0 require:
- A `docs(b1):` commit on `main` (doc-only).
- A reference to the B0 or B1 doc that justifies the path-status change.
- Founder sign-off in the commit body.

Reductions to the deny list (i.e. opening a previously-denied path) are particularly sensitive. They must cite a passed cohort gate or a completed milestone in `B1_IMPLEMENTATION_PLAN.md`.

---

**Cross-references:**
- `docs/b1/B1_IMPLEMENTATION_PLAN.md` — sprint sequence and gates.
- `docs/b1/BRANCH_STRATEGY.md` — branch namespaces and commit discipline.
- `docs/b1/REPO_HYGIENE_PLAN.md` — current working-tree noise inventory.
- `docs/b1/PRECOMMIT_DESIGN.md` — automated enforcement (deferred).
- `docs/b1/CLAUDE_CODE_RULES.md` — operating rules that this matrix supports.
- `docs/b0/B0_CLOSURE_AUDIT.md` — 23 frozen anchors.
- `docs/b0/LARGO_BACKEND_API_SPEC.md` §10, §11 — strip rule and migration policy.
- `docs/b0/LARGO_FRONTEND_UX_SPEC.md` §6 — qualitative band rule.
- `docs/b0/LARGO_ADVICE_CONTRACT.md` §6 — `can_autobuy` semantics.
- `docs/b0/LARGO_SECURITY_PAYMENTS.md` §1, §3 — payment and secret rules.
