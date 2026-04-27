# Largo — Repo Hygiene Plan (Sprint 0)

**Document type :** B1 Sprint 0 deliverable, planning only.
**Status :** Draft.
**Version :** 0.1.0
**Last updated :** 2026-04-27
**Scope :** Plan how to handle the noisy working tree without breaking the repo. Inventory legacy artefacts, classify them, decide future disposition. **Does not order any deletion. Does not modify any non-doc file.**

This document is a Sprint 0 deliverable per `docs/b1/B1_IMPLEMENTATION_PLAN.md` Section 11. It is one of the five documents that must be committed before Sprint 1 may begin.

---

## 0. Document scope

This document **does** :

- Inventory legacy artefacts visible in the working tree as of 2026-04-27.
- Classify each artefact category by risk and recommended future disposition.
- Pin the staging procedure that prevents accidental commits of legacy noise.
- Pin the `.env*` policy.
- Pin the weights / reports / logs policy.
- Pin the V7a / V7.6 Ultra policy.
- Define a future cleanup plan (per category, never in one sweep).
- Define stop conditions that pause any cleanup work.

This document **does not** :

- Modify, move, rename, or delete any working-tree file.
- Run any `rm`, `git mv`, `git rm`, or `git clean`.
- Modify `.gitignore` (a separate, scoped Sprint 0 + 1 ticket may, with explicit prompt).
- Stage anything.
- Authorize any cleanup beyond what a future, separately-scoped session approves.

The working tree noise is **out of scope until a per-category prompt opens it.** No mass cleanup, ever.

---

## 1. Current repo risk

Snapshot of risks visible at the time this plan is authored.

| Risk | Concrete observation | Severity |
|---|---|---|
| `.env.local.bak.*` in working tree, **not** covered by `.gitignore` | `.env.local.bak.20260425-192447`, `.env.local.bak.20260425-192513` exist at repo root. `.gitignore` only covers `.env.local` and `.env*.local`. A bak file matches `.env.*.bak.*`, not `.env*.local`. | **catastrophic if staged** |
| `.env.local.prod` in working tree, **not** covered by `.gitignore` | `.env.local.prod` exists at repo root. `.gitignore` does **not** match `.prod` suffix. | **catastrophic if staged** |
| `.env.local` exists but is gitignored | Already protected by line 4 of `.gitignore`. | nominal, monitored |
| `.env.example` is tracked intentionally | Template, no secrets — must remain a template only. | nominal |
| Weights JSON at repo root | `bma_weights.json`, `xgb_meta_weights.json`, `copula_weights.json` are tracked. They are V7.6 Ultra research artefacts (`LARGO_DATA_STRATEGY.md` §3.1 inventory). | low (not secret), but they pollute diffs |
| `models/` is gitignored | Line 11 of `.gitignore` covers `models/`. `models/ensemble_weights.json` is therefore not tracked. | nominal |
| V7a code at `scripts/cloud/v7a/**` and `scripts/train/v7a/**` | Active baseline, shadow-validated 2026-04-25. Must remain untouched. | high if accidentally edited |
| V7.6 Ultra code at `scripts/cloud/v76_ultra/**` and V7.6 prod at `scripts/cloud/v76_prod/**` | Research-only ; not Phase 1 inputs. | medium if accidentally edited |
| Watcher workflows at `.github/workflows/scraper.yml` and `.github/workflows/flyeas-watcher.yml` | Production-impacting. Out of B1 scope. | high if accidentally edited |
| Cron handlers at `app/api/cron/monitor/route.ts` and `app/api/cron/demo-shadow-sweep/route.ts` | Out of B1 scope. | high if accidentally edited |
| Historical reports at `reports/v7a_*.json` | Tracked artefacts of V7a evaluation runs. Source-of-truth for shadow validation. | medium if accidentally modified |
| Historical logs at `logs/**` | Many files. Historical run logs. | low — but bloat `git status` reads |
| `app/api/debug` is gitignored | Line 7 of `.gitignore`. | nominal |
| `data/`, `.venv-train/`, `__pycache__/`, `*.onnx`, `*.parquet`, `*.pyc` are gitignored | Lines 10–16 of `.gitignore`. | nominal |

The two **catastrophic** risks (uncovered `.env.local.bak.*` and `.env.local.prod`) are the highest priority for Sprint 0.

---

## 2. Working tree noise categories

The repository carries six categories of legacy noise. Each is enumerated below, classified, and assigned an action *now* (Sprint 0) and an action *later* (subsequent sprints).

| category | examples | risk | action now | future action |
|---|---|---|---|---|
| **A — Environment files (potentially containing secrets)** | `.env.local.bak.20260425-192447`, `.env.local.bak.20260425-192513`, `.env.local.prod`, `.env.local`, `.env.example` | catastrophic if any non-template file is staged | Do not stage anything. Add gitignore patterns in a scoped Sprint 0/1 prompt to cover `.env.local.bak.*`, `.env.local.prod`, `.env.*.bak`, `.env*.bak.*`. Do not delete the bak/prod files (they may contain values the user needs out-of-band). | After gitignore is tightened : user moves the bak/prod files **out of the repo** (e.g. to a personal vault). Then a scoped ticket can `git rm --cached` if any of them is currently tracked, but only after a `git ls-files \| grep '^\.env'` audit. |
| **B — V7a active baseline code** | `scripts/cloud/v7a/**`, `scripts/train/v7a/**` (16 files), V7a docs in `docs/V7A_*.md` | high if accidentally edited (breaks shadow loop) | Hands off. Forbidden path per `docs/b1/FILE_ALLOW_DENY.md`. | Untouched throughout B1 unless an explicit V7a-scoped prompt opens a single file. |
| **C — V7.6 Ultra / V7.6 prod research code** | `scripts/cloud/v76_ultra/**`, `scripts/cloud/v76_prod/**` (~50 files), V7.6 docs | medium — research-only, not Phase 1 inputs | Hands off. | Untouched through Phase 1. May be quarantined or moved to a separate `research/` directory in a far-later, separately-scoped ticket. |
| **D — Watcher workflows + cron handlers** | `.github/workflows/scraper.yml`, `.github/workflows/flyeas-watcher.yml`, `app/api/cron/monitor/route.ts`, `app/api/cron/demo-shadow-sweep/route.ts` | high — production-impacting | Hands off. Forbidden path. | Untouched until a B1 watcher/cron-scoped sprint, which is not in Sprint 0–5. |
| **E — Historical reports and logs** | `reports/v7a_*.json` (8 files), `logs/**` (many files including ingest-bts, full_train, v76_max_power, training_*.log) | low to medium ; reports inform V7a baseline | Hands off in Sprint 0. Do not delete, do not stage. `logs/**` is a candidate for a future `.gitignore` entry. | Sprint 0/1 may add `logs/**` to `.gitignore` under a scoped prompt. `reports/` remains tracked because it contains the V7a baseline numbers (`reports/v7a_baselines_local.json`, etc.). Cleanup is per-file, never sweep. |
| **F — Weights JSON at repo root** | `bma_weights.json`, `xgb_meta_weights.json`, `copula_weights.json` | low (not secrets), pollutes diffs | Hands off. | A future scoped ticket may move them to `research/v76_ultra/weights/` or to a `.gitignore`'d location. Decision deferred ; not Sprint 0 work. |

The matrix above is the canonical Sprint 0 classification. Any working-tree file not in one of the six categories is either : `node_modules/**` (gitignored), `.next/**` (gitignored), `data/**` (gitignored), or a Largo doc/code path covered elsewhere by `docs/b1/FILE_ALLOW_DENY.md`.

---

## 3. Files that must never be staged accidentally

Restated for emphasis. The following files exist on disk and **must never** appear in `git status` as staged.

- `.env.local`
- `.env.local.bak.20260425-192447`
- `.env.local.bak.20260425-192513`
- `.env.local.prod`
- Any future `.env.*` file other than `.env.example`.
- Any private key file (`*.pem`, `*.p12`, `*.key`).
- Any session-token dump (`session.json` outside a fixture path, `cookies.txt`, etc.).
- Any provider API key dump.
- Any Stripe key dump.

If any of these appears in `git status`, **stop immediately**, surface to user, do not run `git add`, do not commit. See Section 11 stop conditions.

---

## 4. `.env*` policy

Non-negotiable.

1. **No `.env*` file may be staged or committed in B1**, except `.env.example` which is a template with no secrets.
2. **`.gitignore` must be tightened** in a separately-scoped Sprint 0/1 prompt to cover the patterns missed today : `.env.local.bak.*`, `.env.local.prod`, `.env.*.bak.*`, `.env.*.prod`. The tightening is a one-line-per-pattern change ; the assistant may not perform it implicitly.
3. **Backup environment files** (`.env.local.bak.*`) and **production environment files** (`.env.local.prod`) **belong out of the repo**. The user is responsible for relocating them to a personal vault. Until then, the gitignore tightening of point 2 is the perimeter.
4. **If a tracked `.env*` file is discovered** via `git ls-files | grep -E '^\.env'`, a scoped ticket runs `git rm --cached <file>` for that single file, with explicit prompt approval. The local file remains, the tracking is removed, and the gitignore covers it.
5. **No secret in any commit, ever.** Even rotated. Even expired. Even in tests. Use `<REDACTED>` placeholders or the project's chosen secret-management pattern.
6. **The assistant never reads `.env*` files** in B1. If a value is needed, the user provides it inline at runtime.

---

## 5. Legacy ML artefact policy

Three sub-policies.

### 5.1 V7a (active baseline)

- **Status :** active, in shadow, validated 2026-04-25.
- **Paths :** `scripts/cloud/v7a/**`, `scripts/train/v7a/**`, `docs/V7A_*.md`, `reports/v7a_*.json`.
- **Policy :** untouched throughout B1. Any modification requires a V7a-scoped prompt naming the single file and citing why. This Sprint 0 plan does not authorize any V7a edit.
- **Rationale :** V7a outputs feed the shadow loop. Any silent edit risks breaking the baseline against which Largo's first models are measured.

### 5.2 V7.6 Ultra and V7.6 prod (research)

- **Status :** research-only, not Phase 1 inputs.
- **Paths :** `scripts/cloud/v76_ultra/**`, `scripts/cloud/v76_prod/**`, weights JSON at repo root.
- **Policy :** untouched. May be quarantined or relocated in a far-later, separately-scoped ticket. Sprint 0–5 do not touch them.
- **Rationale :** preserving the research as a frozen reference is more valuable than tidying the layout.

### 5.3 Other legacy training scripts

- **Status :** various.
- **Paths :** `scripts/train/**` outside `scripts/train/v7a/**`, `scripts/cloud/**` outside the three above.
- **Policy :** untouched. Inventoried by the data strategy doc (`LARGO_DATA_STRATEGY.md` §3.1). A scoped sprint may revisit them ; Sprint 0 does not.

---

## 6. Reports / logs policy

### 6.1 `reports/`

- **Status :** tracked. Contains V7a evaluation outputs (`v7a_baselines_local.json`, `v7a_lgbm_metrics_local.json`, etc.) that source-of-truth the V7a baseline numbers cited in B0 docs ($58.33 mean abs regret on 11,750 trips).
- **Policy :** untouched. No deletion in Sprint 0. No new files in Sprint 0 (this directory will be re-opened by a future evaluation-scoped sprint).
- **Future :** a B1 evaluation sprint may add new files under `reports/largo/**` (Phase 1 reporting locations per `LARGO_EVALUATION_PLAN.md` §24) — separate scope, not Sprint 0.

### 6.2 `logs/`

- **Status :** tracked, ~30 historical run logs.
- **Policy :** untouched in Sprint 0. Candidate for `.gitignore` addition under a scoped prompt (separately from Sprint 0).
- **Future :** Sprint 0/1 ticket may add `logs/**` to `.gitignore` so future logs do not pollute the working tree. Existing tracked logs would remain tracked (history preserved) until a future per-file decision.

---

## 7. Weights JSON policy

- **Status :** `bma_weights.json`, `xgb_meta_weights.json`, `copula_weights.json` exist at repo root and are tracked.
- **Policy :** untouched. They are not secrets. They pollute diffs but do no harm.
- **Future :** a far-later, scoped ticket may move them to `research/v76_ultra/weights/` or add them to `.gitignore` and `git rm --cached` them. Decision deferred ; not Sprint 0 work.
- **Forbidden in Sprint 0 :** any modification to these three files. Hands off.

---

## 8. Scripts / V7 / V7.6 policy

Consolidated.

| path glob | status | Sprint 0 action | Sprint 1+ action |
|---|---|---|---|
| `scripts/cloud/v7a/**` | active baseline | hands off | hands off unless V7a-scoped prompt |
| `scripts/train/v7a/**` | active baseline | hands off | hands off unless V7a-scoped prompt |
| `scripts/cloud/v76_ultra/**` | research-only | hands off | hands off unless research-scoped prompt |
| `scripts/cloud/v76_prod/**` | research-only | hands off | hands off unless research-scoped prompt |
| `scripts/cloud/upload_features.py`, `train_v75_cloud.py` | legacy | hands off | hands off unless legacy-scoped prompt |
| `scripts/train/**` outside `v7a/**` | legacy | hands off | hands off |
| `scripts/ingest/**` | inventoried in B0 | hands off | re-evaluation in a far-later data sprint, scoped |

---

## 9. Safe staging procedure

Every B1 commit must follow this procedure. The assistant never deviates ; the user is the safeguard.

1. **Inspect first :** `git status --short` and `git diff --staged` before any `git add`.
2. **Stage by name :** `git add <explicit-path-1> <explicit-path-2>`. Never `git add .`. Never `git add -A`. Never `git add -u`.
3. **Re-verify :** `git status --short` after staging. Only the named files should appear staged. If anything else appears, **unstage immediately** with `git reset HEAD <file>` and surface the surprise.
4. **Inspect staged diff :** `git diff --staged` before committing. The diff must contain only what the prompt authorized.
5. **Commit by message :** `git commit -m "<scope>(b1): <imperative summary>"` with the message body citing the B0 section.
6. **Verify after commit :** `git log --oneline -3` to confirm the commit landed cleanly. `git status --short` must be empty (or contain only files explicitly out of scope).
7. **Do not push automatically :** push is a user action. Even when the user says "go", the assistant shows the push command, the user runs it.

If at any step a stop condition (Section 11) fires, the procedure halts.

---

## 10. Future cleanup plan

Cleanup happens **per category, never in one sweep**, **one commit per category**, **scoped prompt for each**. The order below is recommended.

| order | category | scope | prompt sketch |
|---|---|---|---|
| 1 | tighten `.gitignore` for `.env.local.bak.*`, `.env.local.prod`, `.env.*.bak.*`, `.env.*.prod` | `.gitignore` only | "Add four gitignore patterns covering env backup and prod files. No other change." |
| 2 | tighten `.gitignore` for `logs/**` | `.gitignore` only | "Add `logs/**` to gitignore. No file deletion." |
| 3 | move (out of repo, by user) `.env.local.bak.*` and `.env.local.prod` to a personal vault | working tree only, not repo | user-driven, no assistant action |
| 4 | (only if any `.env*` is tracked) `git rm --cached` per file | one file per commit | "Untrack `<file>` ; gitignore already covers it." |
| 5 | weights JSON relocation | `bma_weights.json`, `xgb_meta_weights.json`, `copula_weights.json` | "Move three V7.6 Ultra weights to `research/v76_ultra/weights/`. Single commit." |
| 6 | logs cleanup | `logs/**` | per-file decision ; not a sweep |

Sprints 0–5 of B1 do **not** execute any of these by themselves. They are listed here so the future cleanup work has a documented sequence.

---

## 11. Stop conditions

Conditions that immediately pause any repo hygiene work.

1. **Any `.env*` file appears in `git diff --staged` or in a proposed staging command.** Stop. Surface. Unstage. Verify.
2. **`git add .` or `git add -A` appears in any proposed command.** Stop. Reformulate by file name.
3. **Any file under `scripts/cloud/v7a/**` or `scripts/train/v7a/**` appears modified.** Stop. V7a is untouched.
4. **Any file under `.github/workflows/**` appears modified.** Stop. Watcher is untouched.
5. **Any file under `app/api/cron/**` appears modified.** Stop. Crons are untouched.
6. **Any V7.6 Ultra or V7.6 prod file appears modified.** Stop.
7. **A weights JSON file at repo root appears modified.** Stop.
8. **A `reports/v7a_*.json` file appears modified.** Stop.
9. **A `git rm` or `git rm --cached` command is proposed without a per-file scoped prompt.** Stop.
10. **A `git mv` is proposed for a legacy file outside the future-cleanup-plan order.** Stop.
11. **The user proposes a "mass cleanup" or "sweep" of the working tree.** Stop. Reformulate per category.
12. **`.gitignore` is being modified for more than one pattern at a time.** Stop. One pattern per commit.
13. **A tracked file is being moved into `data/`, `models/`, `__pycache__/`, or any other ignored path** (which would make it disappear silently). Stop.

A stop condition is the safety system working. It is not a failure.

---

## 12. Document status

| field | value |
|---|---|
| Document type | Sprint 0 — Repo Hygiene Plan |
| Phase | B1 Sprint 0 |
| Version | 0.1.0 |
| Status | Draft, opening |
| Source | `docs/b1/B1_IMPLEMENTATION_PLAN.md` Section 5, 11 ; `docs/b0/B0_CLOSURE_AUDIT.md` Section 29 |
| Open items | future cleanup plan in Section 10, six ordered items, none authorized yet |
| Forbidden in this document | code, migrations, endpoints, components, V7a touch, any working-tree file modification, commits and pushes by the assistant, `.env*` modification, broad git staging, modification of any file outside `docs/b1/REPO_HYGIENE_PLAN.md` |
| Successor documents | `docs/b1/BRANCH_STRATEGY.md`, `docs/b1/PRECOMMIT_DESIGN.md`, `docs/b1/CLAUDE_CODE_RULES.md`, `docs/b1/FILE_ALLOW_DENY.md` |
| Last updated | 2026-04-27 |

Sprint 0 hygiene plan opens here. Cleanup does not start in this document.
