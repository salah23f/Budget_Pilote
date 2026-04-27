# CLAUDE_CODE_RULES.md

**Status:** Sprint 0 — frozen for B1
**Audience:** Claude Code (the AI assistant) and the founder when writing prompts to Claude Code.
**Scope:** Operating rules that govern every B1 prompt, from Sprint 1 (CustomerSafeAdvice) through GA. Violations are not stylistic — they are stop conditions.

---

## 1. One bounded task per prompt

Each prompt to Claude Code must describe **one** task with a clearly named output. "Add CustomerSafeAdvice type and 15 unit tests" is bounded. "Implement the customer-safe view, plus the API endpoint, plus the frontend hook" is not. Multi-task prompts produce sprawl, untracked edits, and impossible code review.

If a prompt requires more than one bounded task, break it into sequential prompts with founder review between them.

## 2. Inspect before edit

Before modifying any file, Claude must read it (or run `Glob`/`Grep` on the relevant scope) and report what it found. This is non-negotiable for files that already exist on `main`. The inspection must be visible in the conversation so the founder can verify Claude is editing what it thinks it is editing.

## 3. Target files must be named explicitly

Every prompt names its target files. "Edit the type" is invalid; "edit `types/largo/advice.ts` to add `CustomerSafeAdvice`" is valid. If Claude needs to create a new file, it announces the path before writing.

If Claude believes it must edit a file not in the named list, it stops and asks. See rule §17.

## 4. No `.env*` files, ever

Claude must not read, write, edit, copy, rename, move, or stage any `.env*` file (except `.env.example` if explicitly authorized). This includes `.env.local`, `.env.local.bak.*`, `.env.local.prod`, `.env.production`, `.env.development`. The founder rotates secrets manually, out-of-band.

If a debug step requires an env var value, Claude asks the founder for the **name** of the var only, never the value.

## 5. No `git add .`, no `git add -A`, no `git commit -a`

All staging is by named path: `git add docs/b1/X.md docs/b1/Y.md`. Wildcards are forbidden. The founder runs all git commands; Claude proposes the exact command lines.

## 6. Never stage legacy noise

The working tree contains pre-existing modifications and untracked files (V7a outputs, reports, logs, `.env.local.bak.*`, weights JSON). Claude must:
- Run `git status --short` and **list** what it sees.
- Stage **only** the paths the prompt authorizes.
- Never bundle legacy noise into a commit "to clean it up." Cleanup is a separate, named, scoped prompt.

## 7. No V7a, V7.6 Ultra, or watcher edits

`scripts/cloud/v7a/**`, `scripts/train/v7a/**`, `scripts/cloud/v76_ultra/**`, `scripts/cloud/v76_prod/**`, `scripts/train/v76_*/**`, `.github/workflows/scraper.yml`, `.github/workflows/flyeas-watcher.yml`, `app/api/cron/**`, and any file matching `*watcher*` are **read-only** for B1. Claude does not edit, refactor, lint, or rename them. If a B1 task appears to require a change there, Claude stops and asks.

## 8. No migrations

`supabase/migrations/**` is off-limits. Schema work in B1 stays in `LARGO_BACKEND_API_SPEC.md` §4 documentation until a migration is explicitly scheduled. Claude does not generate `.sql` files outside `docs/**`.

## 9. No payment code

Phase 1 forbids Stripe / payment integration code on `main`. Claude does not write code that imports `stripe`, calls `paymentIntents.create`, references `setupIntent`, or implements any charge flow. Symbolic mention in `docs/**` is allowed; runtime code is not.

## 10. No live auto-buy, no silent auto-buy

The `can_autobuy` flag in `LargoAdvice` is a **gate readiness flag** for the cohort program (0 → 10 → 100 → 1000 → GA). It does **not** wire any execution path. Claude does not write code that, conditioned on `can_autobuy === true`, books a flight, charges a card, or contacts a GDS. Auto-buy execution is a future, gated, founder-authorized milestone.

## 11. No numeric confidence in customer UI

The numeric confidence field is admin/internal only. Customer-facing components must use the qualitative band (low/medium/high) per `LARGO_FRONTEND_UX_SPEC.md` §6 and `LARGO_BACKEND_API_SPEC.md` §10 strip rules. Claude does not pass `advice.confidence` (number) into a customer component, ever.

## 12. No `technical_details` in customer UI

Same source: `technical_details`, `audit_block`, `model_version`, `feature_vector`, and any other admin-only field listed in `LARGO_BACKEND_API_SPEC.md` §10 are stripped server-side and never reach the customer renderer. Claude does not import them into `components/largo/customer/**`.

## 13. No LLM in the decision path

The advice decision (BUY / WAIT / ABSTAIN) comes from the deterministic V7a model. LLMs (including Claude itself, GPT, etc.) are explicitly out of the decision pipeline. Claude does not write code that calls an LLM API to "improve" or "explain" an advice. Explanations are templated from structured fields.

## 14. Stop on ambiguity

If a prompt is unclear, contradicts a B0 anchor, or requires a decision Claude cannot ground in a B0/B1 doc, Claude stops and asks. It does **not** guess, infer, or default to "the simplest interpretation." The cost of asking is one round-trip; the cost of guessing is a wrong commit.

## 15. Show the diff before commit

Before proposing any `git commit` command, Claude:
- Lists the files it modified or created.
- Pastes the salient hunks (or runs `git diff --cached` and surfaces the output).
- Names the proposed commit message.

The founder reads the diff and runs the commit. Claude never commits.

## 16. Cite the B0 section

Every code change must cite the B0 doc and section that authorizes it. Example: "This implements the strip rule per `LARGO_BACKEND_API_SPEC.md` §10 row 4." If no B0 section authorizes the change, the change is out of scope — see rule §14.

The citation goes in the PR body (or commit body for direct-to-`main` doc commits) per `BRANCH_STRATEGY.md` §5.

## 17. Stop on unexpected files

If `git status --short` shows files Claude did not edit but that appear modified or untracked in unexpected places (e.g. a new file in `scripts/cloud/v7a/`, a deleted file in `types/`), Claude:
- Lists them.
- Does **not** stage them.
- Asks the founder before any further action.

This protects against IDE auto-formatters, agent drift, and merge surprises.

## 18. No new dependencies without authorization

`package.json`, `pnpm-lock.yaml`, `yarn.lock`, `requirements.txt`, `pyproject.toml` are not modified unless the prompt explicitly authorizes a named dependency with a justification. Claude does not `npm install foo` to "make the test pass."

## 19. No deployment, no CI changes, no secrets rotation

Claude does not run `vercel deploy`, `vercel env add`, `gh workflow run`, or any command that affects production. Claude does not modify `.github/workflows/**`. Secrets rotation, environment variable changes, and deployments are founder-only operations.

## 20. Convergence mode

Per the founder's working preference: diff before execution, format respected mot pour mot, parallel findings noted but not opened (logged for a future scoped prompt), git ops controlled by the founder. Claude's job is to converge on the founder's spec — not to expand it, optimize it, or "improve" it.

## 21. Claude stop conditions

| # | Condition | Why dangerous | Required response |
|---|-----------|---------------|-------------------|
| 1 | Prompt asks to "clean up" the working tree | Could stage legacy noise, weights, reports, `.env.local.bak.*` | Stop. Quote `REPO_HYGIENE_PLAN.md` §3. Ask founder to scope cleanup to a single category. |
| 2 | Prompt asks to edit V7a / V7.6 / watcher / cron | Re-arms frozen ML or background jobs, breaks shadow validation | Stop. Quote `B1_IMPLEMENTATION_PLAN.md` §6 and rule §7. Refuse until founder authorizes via a scoped prompt naming the file. |
| 3 | Prompt asks to add Stripe, payment, charge, or live auto-buy code | Phase 1 forbids it; risk of accidental customer harm | Stop. Quote `LARGO_SECURITY_PAYMENTS.md` §1 and rule §9 / §10. Refuse. |
| 4 | Prompt asks to render `confidence`, `technical_details`, `audit_block`, or `model_version` in a customer component | Violates strip rule, leaks internal state | Stop. Quote `LARGO_BACKEND_API_SPEC.md` §10 and rule §11 / §12. Refuse. |
| 5 | Prompt asks to call an LLM in the decision path | Decision must stay deterministic; non-reproducible advice | Stop. Quote rule §13 and `B0_CLOSURE_AUDIT.md`. Refuse. |
| 6 | `git status --short` shows unexpected modifications | Drift, IDE auto-format, accidental edit, merge debris | Stop. List the unexpected paths. Ask founder before proceeding. |
| 7 | Prompt is a one-line "do it" with no named target file | Unbounded; produces sprawl | Stop. Ask for named files and acceptance criteria. |
| 8 | Prompt requires editing more than one B1 scope (types + lib + components + api) | Multi-task; impossible to review cleanly | Stop. Propose decomposition into sequential prompts. |
| 9 | Prompt asks to read or write `.env*` (any variant) | Secret exposure | Stop. Quote rule §4. Refuse. Ask for the variable **name** only if needed. |
| 10 | Prompt asks to run `git add .`, `git add -A`, or `git commit -a` | Stages legacy noise, secrets, artifacts | Stop. Quote rule §5. Refuse. Propose explicit `git add <named paths>`. |
| 11 | Prompt asks to add a new dependency without justification | Supply-chain risk, lockfile drift | Stop. Quote rule §18. Ask for the name, version, and justification. |
| 12 | Prompt asks to deploy, change CI, or rotate secrets | Production-affecting; founder-only | Stop. Quote rule §19. Refuse. |
| 13 | Prompt asks to write code that contradicts a B0 anchor (23 frozen anchors) | Breaks the contract surface | Stop. Quote the anchor. Ask the founder to update B0 first if the change is intentional. |
| 14 | Prompt asks Claude to commit on its own | Convergence mode violation | Stop. Quote rule §15 / §20. Surface the diff and the proposed command; let the founder run it. |
| 15 | Prompt requires generating SQL outside `docs/**` | Migration drift | Stop. Quote rule §8. Refuse. |
| 16 | Working tree shows a file in an `app/api/cron/**` path is staged | Re-arms a cron in production | Stop. Unstage. Quote rule §7. |
| 17 | Prompt asks for "best-effort" or "rough" code | Production code; no rough drafts | Stop. Ask for acceptance criteria. Refuse to ship un-tested logic into `lib/largo/**` or `app/api/largo/**`. |

---

**Cross-references:**
- `docs/b1/B1_IMPLEMENTATION_PLAN.md` — sprint structure and gates that these rules protect.
- `docs/b1/BRANCH_STRATEGY.md` — branch and commit discipline.
- `docs/b1/REPO_HYGIENE_PLAN.md` — known working-tree noise to refuse.
- `docs/b1/PRECOMMIT_DESIGN.md` — automated enforcement of the same rules later.
- `docs/b1/FILE_ALLOW_DENY.md` — canonical allow/deny path matrix.
- `docs/b0/B0_CLOSURE_AUDIT.md` — 23 frozen anchors and 9 readiness gates.
- `docs/b0/LARGO_BACKEND_API_SPEC.md` §10 — strip rule.
- `docs/b0/LARGO_FRONTEND_UX_SPEC.md` §6 — qualitative band rule.
- `docs/b0/LARGO_ADVICE_CONTRACT.md` §6 — `can_autobuy` semantics.
- `docs/b0/LARGO_SECURITY_PAYMENTS.md` §1, §3 — payment and secret rules.
