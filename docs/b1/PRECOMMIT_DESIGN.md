# PRECOMMIT_DESIGN.md

**Status:** Sprint 0 — design only, no implementation
**Owner:** Founder (final say on activation)
**Scope:** Flyeas/Largo B1 — design future pre-commit protections that prevent the most catastrophic mistakes (secret leaks, forbidden file commits, scope creep) **without blocking documentary work today**.
**Anti-scope:** This document does **not** install Husky, lint-staged, gitleaks, or any other tool. It does not create `.husky/`, modify `package.json`, add npm scripts, or alter `.gitignore`. Implementation is deferred to a dedicated, scoped Sprint 0/1 follow-up prompt explicitly authorized by the founder.

---

## 1. Why pre-commit exists

The repo currently relies on a single line of defense: `.gitignore`. That line of defense has known gaps (see `REPO_HYGIENE_PLAN.md` §6 — `.env.local.bak.*` and `.env.local.prod` are not ignored). A pre-commit hook adds a second, **active** line of defense that:

- Refuses to commit `.env*` files even when staged accidentally.
- Refuses to commit known-secret patterns (Stripe keys, Supabase service-role keys, JWT, etc.).
- Refuses to commit files outside the B1 allow-list during B1 work.
- Refuses to commit large binary artifacts (weights JSON, reports, logs) by accident.
- Refuses to silently re-introduce payment code, auto-buy code, or training scripts touched outside an explicit gated prompt.

The goal is **belt-and-suspenders**: even if Claude Code, the founder, or a future contributor types `git add .` by mistake, the commit cannot land destructive content on `main`.

## 2. Why **design only** in Sprint 0

Activating a pre-commit hook today would block legitimate documentary commits while we are still finalizing B1 guardrails. The hook must be:

1. Designed against a complete allow/deny matrix (`FILE_ALLOW_DENY.md`).
2. Tested in a side branch on a known-safe set of changes.
3. Reviewed by the founder before being made required.

Sprint 0 produces only the **specification** of the hook. Implementation is a separate, named ticket.

## 3. Checks to implement later

| # | Check | Blocks | Severity | Implementation later | Source doc |
|---|-------|--------|----------|----------------------|------------|
| 1 | Reject any staged path matching `.env*` (except `.env.example`) | Secret leak | **Critical** | Single shell test on staged paths | `REPO_HYGIENE_PLAN.md` §6, `CLAUDE_CODE_RULES.md` §4 |
| 2 | Reject staged files containing `sk_live_`, `sk_test_`, `pk_live_`, `eyJhbGciOi`, `SUPABASE_SERVICE_ROLE_KEY=`, `STRIPE_SECRET_KEY=` | Secret leak | **Critical** | grep on staged content (or gitleaks) | `LARGO_SECURITY_PAYMENTS.md` §3 |
| 3 | Reject paths under `.github/workflows/**` unless prompt explicitly authorizes CI changes | Re-arming watcher / cron drift | **High** | Path matcher + opt-in env var (`ALLOW_CI_EDIT=1`) | `B1_IMPLEMENTATION_PLAN.md` §6, `BRANCH_STRATEGY.md` §3 |
| 4 | Reject paths under `scripts/cloud/v7a/**`, `scripts/train/v7a/**`, `scripts/cloud/v76_*/**`, `scripts/train/v76_*/**`, `scripts/ingest/**` | Touching frozen ML / V7a baseline | **High** | Path matcher | `REPO_HYGIENE_PLAN.md` §3, `FILE_ALLOW_DENY.md` |
| 5 | Reject paths under `app/api/cron/**` and any file matching `*watcher*`, `*flyeas-watcher*` | Re-arming background jobs | **High** | Path matcher | `B0_CLOSURE_AUDIT.md` §6 |
| 6 | Reject staged files larger than 1 MB | Accidental weights/report commit | **Medium** | `git diff --cached --numstat` size threshold | `REPO_HYGIENE_PLAN.md` §3 (categories C, E, F) |
| 7 | Reject paths matching `*_weights.json`, `bma_weights.json`, `xgb_meta_weights.json`, `copula_weights.json`, `reports/**`, `logs/**` | Accidental ML artifact commit | **Medium** | Path matcher | `REPO_HYGIENE_PLAN.md` §3 |
| 8 | Reject any path under `supabase/migrations/**` unless prompt explicitly authorizes a migration | Schema drift | **High** | Path matcher + opt-in env var (`ALLOW_MIGRATION=1`) | `LARGO_BACKEND_API_SPEC.md` §11 |
| 9 | Reject staged content matching `stripe`, `Stripe`, `payment_intent`, `setup_intent`, `paymentMethod` outside `docs/**` | Premature payment code | **Critical** | grep on staged content + path filter | `LARGO_SECURITY_PAYMENTS.md` §1, `B0_CLOSURE_AUDIT.md` §10 |
| 10 | Reject staged content matching `auto_buy`, `autoBuy`, `executeAutoBuy`, `silent_purchase` outside `docs/**` and `types/largo/**` (where the field name `can_autobuy` is allowed as a flag only) | Premature auto-buy code | **Critical** | grep on staged content + path filter | `LARGO_ADVICE_CONTRACT.md` §6 |
| 11 | Warn (not block) on commits where staged file count > 20 | Likely `git add .` accident | Low | Numstat count | `CLAUDE_CODE_RULES.md` §5 |

## 4. Secret scanning design

**Goal:** zero secrets on `main`, ever.

**Layer 1 — pattern grep (fast, no dependency):**
- Run on every staged hunk via `git diff --cached`.
- Patterns: see check #2 above. Patterns must match the literal prefix, not the value, to avoid false-positive on docs that *describe* a key shape.
- A line containing `sk_live_<example>` in a doc must still be blocked — docs should refer to keys symbolically only.

**Layer 2 — `gitleaks` (deferred):**
- Stronger entropy + ruleset coverage.
- Optional dependency, gated behind founder approval to avoid adding a Go binary today.
- Runs only if `gitleaks` is on PATH; otherwise falls back to layer 1.

**Allow-list:**
- `.env.example` is the only `.env*` that may ever be committed, and it must contain placeholder values (`STRIPE_SECRET_KEY=sk_test_REPLACE_ME`).
- The hook must explicitly allow `.env.example` and reject all other `.env*` paths.

## 5. `.env*` block design

```
# Pseudocode — DO NOT ADD TO REPO YET
for path in $(git diff --cached --name-only --diff-filter=ACM); do
  case "$path" in
    .env.example) continue ;;
    .env*) echo "BLOCKED: $path is an env file" >&2; exit 1 ;;
  esac
done
```

The check runs **before** secret scanning, because a file named `.env.local.bak.20260420` should be blocked on its name alone, regardless of content.

## 6. Forbidden path block design

The hook reads a single source-of-truth file: `docs/b1/FILE_ALLOW_DENY.md` (denylist section). Implementation reads the deny patterns once at hook start and matches each staged path against them.

Override mechanism:
- Each high-severity deny category has a named opt-in env var (e.g. `ALLOW_CI_EDIT=1`, `ALLOW_MIGRATION=1`, `ALLOW_V7A_DOC_ONLY=1`).
- The opt-in must be set on the **single** commit and is logged in the commit body via a manual `Allow:` trailer (e.g. `Allow: CI_EDIT — reason: rotate scraper.yml secret`).
- No global "skip all" override exists.

## 7. No-large-artifact block design

- Threshold: **1 MB** per file.
- Implementation: `git diff --cached --numstat` for line-based files, `wc -c` on the staged blob for binaries.
- Override: none. Large artifacts go to a separate storage (S3/Supabase Storage) and are referenced by URL in docs.

## 8. No-payment-code accidental block

Phase 1 forbids any payment code outside `docs/**` per `LARGO_SECURITY_PAYMENTS.md` §1 and `B0_CLOSURE_AUDIT.md` §10.

The hook greps staged content for the patterns in check #9 above. Documentation files (`docs/**`, `*.md`) are exempt because security and contract docs legitimately mention `stripe` and `payment_intent` symbolically.

When auto-buy reaches its gated cohort phase, this block must be **explicitly** lifted via a scoped prompt and reflected in `FILE_ALLOW_DENY.md`. Until then, any match aborts the commit.

## 9. No-migration accidental block

Phase 1 has zero migrations on `main` until `LARGO_BACKEND_API_SPEC.md` §11 contracts are stable and a migration is reviewed.

The hook rejects any path matching `supabase/migrations/**` and any file containing `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE` in `.sql` files. Override: `ALLOW_MIGRATION=1` plus an `Allow: MIGRATION` trailer in the commit body.

## 10. Claude Code compatibility

The hook must:
- Run quickly (< 2 seconds on a 30-file commit) so it does not impede iterative documentary work.
- Print a **clear, single-line reason** when it blocks ("BLOCKED: path .env.local matches .env* deny rule"), so Claude Code can surface the message verbatim to the founder.
- Never auto-fix. Blocking, never mutating.
- Be invoked from `.husky/pre-commit` (when implemented) and also be runnable manually as `bash scripts/precommit/check.sh` so Claude Code can dry-run before suggesting `git commit`.

Claude Code's operating contract (`CLAUDE_CODE_RULES.md` §15) already requires showing the diff before commit. The pre-commit hook is the second-to-last line of defense; the founder running `git commit` is the last.

## 11. Future implementation ticket

When activated, the implementation prompt must be **scoped**, named, and produce only:
- `scripts/precommit/check.sh` (one shell file, executable).
- `.husky/pre-commit` (one file, calls `scripts/precommit/check.sh`).
- A diff to `package.json` adding `"prepare": "husky"` and `husky` to `devDependencies`.
- Tests in `tests/precommit/` covering each of the 11 checks above with positive and negative fixtures.
- A short PR body citing `PRECOMMIT_DESIGN.md` §3 row-by-row.

The implementation prompt must **not**:
- Touch any file outside the four artifacts above.
- Add `lint-staged`, `commitlint`, or any check beyond the 11 listed.
- Modify `.gitignore` (that is a separate `REPO_HYGIENE_PLAN.md` follow-up).

## 12. Document status

This document is **Sprint 0 / design only**. It does not authorize implementation. It will be referenced by the future implementation ticket as the canonical source of behaviour. Any change to the 11 checks above requires an update to this document **before** the implementation prompt is written.

---

**Cross-references:**
- `docs/b1/REPO_HYGIENE_PLAN.md` — current working-tree state and gitignore gaps.
- `docs/b1/BRANCH_STRATEGY.md` — when and how the hook runs in the branch lifecycle.
- `docs/b1/CLAUDE_CODE_RULES.md` — operating rules that the hook enforces.
- `docs/b1/FILE_ALLOW_DENY.md` — canonical allow/deny matrix the hook reads.
- `docs/b0/B0_CLOSURE_AUDIT.md` §10, §6 — frozen anti-scope anchors.
- `docs/b0/LARGO_SECURITY_PAYMENTS.md` §1, §3 — payment and secret rules.
- `docs/b0/LARGO_BACKEND_API_SPEC.md` §11 — migration policy.
- `docs/b0/LARGO_ADVICE_CONTRACT.md` §6 — auto-buy field rules.
