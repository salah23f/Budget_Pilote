# Largo — Branch Strategy (Sprint 0)

**Document type :** B1 Sprint 0 deliverable, planning only.
**Status :** Draft.
**Version :** 0.1.0
**Last updated :** 2026-04-27
**Scope :** Define how to work cleanly in B1 : branch naming, when to use `main`, when to create a feature branch, commit message format, PR / review policy (even solo), rollback, tags, no-force-push, release checkpoints.

This document is a Sprint 0 deliverable per `docs/b1/B1_IMPLEMENTATION_PLAN.md` Section 11. It is one of the five documents that must be committed before Sprint 1 may begin.

---

## 0. Document scope

This document **does** :

- Pin the branch naming convention.
- Pin when commits go to `main` directly and when a feature branch is required.
- Pin the commit message format and citation discipline.
- Pin the PR / review policy, even in a solo-founder phase.
- Pin the rollback policy.
- Pin the tag policy.
- Forbid force pushes to `main`.
- Pin the release-checkpoint policy.

This document **does not** :

- Create a branch.
- Modify `main`.
- Run any `git` command.
- Modify `.github/**` or any CI configuration.
- Authorize any code change.

The branch strategy applies to every B1 commit, starting with Sprint 0.

---

## 1. Branch naming convention

All B1 work uses the following branch namespaces.

| namespace | use | example |
|---|---|---|
| `main` | source-of-truth ; protected ; no force push | `main` |
| `b1/<scope>` | one bounded B1 ticket | `b1/customer-safe-view`, `b1/largo-fixtures`, `b1/repo-hygiene-cleanup` |
| `b1/docs/<scope>` | doc-only B1 commits when a branch is preferred over direct-to-main | `b1/docs/sprint-2-validator-decision` |
| `b1/fix/<scope>` | bug fix in B1-introduced code | `b1/fix/null-price-stripped` |
| `b1/test/<scope>` | test-only addition (rare ; usually included in feature branch) | `b1/test/strip-idempotency` |
| `hotfix/<scope>` | urgent production fix (Phase 1+ ; not used in early B1 since nothing is in production yet) | `hotfix/<n/a-yet>` |

Rules :

- `<scope>` is short, kebab-case, and matches the ticket. Examples : `customer-safe-view`, `advice-fixtures`, `validator-zod`, `methodology-draft`.
- One branch = one bounded ticket. If two tickets are needed, two branches.
- Branch names never include user names, dates, or PR numbers.
- Branches are deleted after merge (see Section 6 rollback).
- No long-running branches. A B1 branch should merge within a few days of its first commit. If a branch lingers, it is rebased onto `main` or restarted under a fresh name.

Forbidden branch names :

- `dev`, `develop` — there is no separate development line.
- `staging`, `prod`, `production` — environment branches are not the model.
- `wip`, `temp`, `test`, `branch-1` — too vague.
- Names without the `b1/` (or `hotfix/`) prefix — clutters the namespace.

---

## 2. When to use `main` directly

Direct commits to `main` are allowed only for **doc-only** changes, and only when the diff is small and obviously safe.

Allowed direct-to-`main` (with targeted `git add` by file name) :

- Doc additions or edits under `docs/b0/**` or `docs/b1/**` that do not affect any code path.
- Single-file documentation typos or clarifications.
- This branch strategy itself.

Disallowed direct-to-`main` :

- **Any code change** (`lib/**`, `types/**`, `app/**`, `components/**`, `tests/**`).
- **Any `package.json`, `tsconfig.json`, `.gitignore` modification** — these affect the toolchain and require a feature branch.
- **Any migration, any endpoint, any component, any function body.**
- **Any change that touches more than one allow-list category** (per `docs/b1/FILE_ALLOW_DENY.md`).
- **Any change touching deny-list paths.**

If in doubt, use a feature branch. The cost of a branch is small ; the cost of a bad commit on `main` is large.

---

## 3. When to create a feature branch

A feature branch (`b1/<scope>`) is required for :

- Any code change, however small.
- Any `package.json` / `tsconfig.json` / `.gitignore` modification.
- Any change spanning more than one allow-list category.
- Any change that introduces a new dependency.
- Any change that may need to be reverted independently of other work.
- Any change the user wants reviewed before it lands.

Branch lifecycle :

1. **Create from latest `main` :** `git checkout main && git pull --ff-only && git checkout -b b1/<scope>`.
2. **Work in small commits.** Each commit is bounded ; the message cites the B0 section.
3. **Push to `origin/b1/<scope>`** when ready for review.
4. **Open a PR** (or, in solo mode, perform self-review per Section 5).
5. **Merge** via fast-forward or squash (Section 5 chooses).
6. **Delete the branch** locally and on origin after merge.

A B1 branch never carries more than one ticket. If a second concern surfaces during the work, it is recorded as a follow-up and not added to the same branch.

---

## 4. Commit message policy

Format : `<type>(b1): <imperative summary under ~70 chars>`.

Allowed types :

| type | use |
|---|---|
| `feat` | new feature, new type, new pure function |
| `test` | tests only |
| `docs` | doc-only |
| `fix` | bug fix in B1-introduced code |
| `refactor` | refactor of B1-introduced code without behavior change |
| `chore` | tooling, gitignore, package.json devDependency |
| `ci` | CI changes (rare in early B1) |
| `perf` | perf improvement (rare in early B1) |

Rules :

- Subject line under ~70 characters.
- Imperative mood ("add", "remove", "fix"), not past tense ("added", "removed", "fixed").
- Body required for every code commit. Body cites :
  - the B0 section the change implements (e.g. `Implements LARGO_BACKEND_API_SPEC §10`),
  - the B1 sprint and document the change belongs to,
  - the test files added or modified.
- No emoji in commit messages on safety-relevant code (consistent with `LARGO_FRONTEND_UX_SPEC.md` no-emoji-on-safety-surfaces rule).
- No `Co-Authored-By` lines added by the assistant unless the user requests them. The repo's commit policy is owned by the user.
- No `--no-verify`, no `--no-gpg-sign`. Hooks must pass.
- No `--amend` after a hook failure ; create a new commit. (Per Bash tool guidance and convergence mode.)

Examples (good) :

```
feat(b1): add CustomerSafeAdvice type

Implements LARGO_ADVICE_CONTRACT §6 and LARGO_BACKEND_API_SPEC §10
strip rule. Sprint 1 deliverable 1.

- types/largo/customer-safe-advice.ts
```

```
test(b1): cover null price in strip function

Implements LARGO_BACKEND_API_SPEC §10 nullability rule.
Sprint 1 deliverable 3.

- lib/largo/safe-view/strip.test.ts
```

```
docs(b1): add Sprint 0 repo guardrails
```

Examples (bad — rejected at review) :

```
fix stuff                             # not imperative, not specific, no scope
WIP                                   # placeholder, no info
update                                # vague
🚀 ship the new advice card           # emoji on safety surface, no scope, vague
feat(b1): big refactor + new feature  # two concerns in one commit
```

---

## 5. PR / review policy (even solo)

Even in a solo-founder phase, every code commit goes through a review motion.

| change type | review motion |
|---|---|
| Doc-only on `docs/b0/**` or `docs/b1/**`, single file | direct commit to `main` after self-read of the diff (`git diff --staged`) |
| Doc-only spanning multiple files | feature branch, single squash merge after self-review |
| Code change | feature branch, PR opened on GitHub, self-review with checklist (below), then squash merge |
| `package.json`, `tsconfig.json`, `.gitignore` change | feature branch, explicit prompt approval, self-review checklist |
| Any change that touches a deny-list path | refused. Re-scope. |

Self-review checklist (must hold before merge) :

1. The diff implements only what the prompt named.
2. No file outside the prompt's allow-list is touched.
3. No `.env*` is staged.
4. Tests are present (for code changes) or explicitly waived in writing.
5. The commit message body cites the B0 section.
6. The diff is under ~300 lines net unless the prompt explicitly justifies more.
7. `git status --short` after the commit is empty (or contains only files explicitly out of scope).
8. The change does not touch V7a, watcher, crons, Modal, Stripe.
9. The change does not weaken any B0 frozen anchor.
10. The change does not contain numeric confidence, `technical_details`, or `audit_id` in any customer-rendered branch.

If any item fails, the merge does not happen. The branch is fixed or restarted.

PR template (when GitHub PRs are used) :

```
## Summary
<what + why, 2-3 lines>

## B0 citations
- LARGO_<DOC>.md §<N>
- (other sections)

## Files touched
- <path 1>
- <path 2>

## Tests
- <test 1> covers <case>
- (or: "no test required because <reason>")

## Self-review checklist
- [ ] No `.env*` staged
- [ ] No deny-list path touched
- [ ] Diff under ~300 lines net
- [ ] Tests present or explicitly waived
- [ ] No numeric confidence in customer-rendered branch
- [ ] No `technical_details` in customer-rendered branch
- [ ] No `audit_id` in customer-rendered branch
- [ ] No B0 frozen anchor weakened
```

---

## 6. Rollback policy

Every B1 change must be revertable in one command.

Rules :

- **Squash-merge** is the default for feature branches : the merge produces a single commit on `main` that can be reverted as a unit.
- **`git revert <sha>`** is the rollback method for B1-introduced changes. It produces a new commit, preserving history. **Never `git reset --hard` on `main`.** Never rewrite published history.
- **Branches are deleted after merge.** Both locally (`git branch -d <name>`) and on origin (`git push origin --delete <name>`). A reverted change is not "rebranched" ; it is fixed forward in a new branch.
- **No `git push --force` to `main`.** Period. (See Section 8.)
- **No `git push --force-with-lease` to `main`.** Period.
- **For published feature branches**, `git push --force-with-lease` is allowed only when the branch is owned by a single author and the lease is verified. The default is to avoid it.
- **A failed merge is not retried via `--amend` and a force push.** It is fixed in a new commit on the same branch.

If a change is broken and the rollback path is unclear, **stop**, surface to the user, and do not push further commits. Reverting partially-broken state is worse than rolling forward with a clean fix.

---

## 7. Tag policy

Tags are used for **release checkpoints**, not for daily work.

| tag pattern | use |
|---|---|
| `b1-sprint0-complete` | Sprint 0 closure : the five Sprint 0 documents committed and signed off |
| `b1-sprint1-complete` | Sprint 1 closure : `CustomerSafeAdvice` + strip function + tests merged |
| `b1-sprint2-complete` | Sprint 2 closure : fixtures + validator merged |
| `b1-sprint3-design` | Sprint 3 design docs committed |
| `b1-sprint4-design` | Sprint 4 design docs committed |
| `b1-sprint5-drafts` | Sprint 5 methodology / waitlist drafts committed |
| `phase1-mvp-candidate` | when (eventually) Phase 1 MVP is feature-complete in shadow ; not in early B1 |
| `phase1-mvp-release` | when (eventually) Phase 1 MVP exits cohort 0 → 0→10 |

Tag rules :

- Tags are **annotated** (`git tag -a <name> -m "<message>"`), never lightweight.
- Tags are pushed explicitly (`git push origin <tag>`), never with `--tags` blanket.
- A tag is created **only after** the corresponding sprint exit criteria are verified in writing by the user.
- Tags are immutable. A mis-tagged checkpoint is fixed by adding a new tag, not by deleting and recreating.

---

## 8. No force push policy

Hard rule.

- **No `git push --force` to `main`.** Ever.
- **No `git push --force-with-lease` to `main`.** Ever.
- **No `git push --force` to a tag.** Ever.
- **No `git push --force` to a branch with more than one author.** Ever.

The only situation where any `--force` form is acceptable is on a single-author feature branch, owned exclusively by the author, where a rebase onto current `main` is needed and `--force-with-lease` is the safer alternative. Even then, the default is to avoid it.

If the assistant proposes any `--force` push, the user **stops** and reviews. If the assistant proposes `--force` to `main`, the user **refuses** and surfaces the request as a stop condition.

---

## 9. Release checkpoint policy

A "release" in early B1 is **a sprint closure tag**, not a production deployment. There is no production deployment in Sprint 0–5.

Per-sprint checkpoint procedure :

1. Verify exit criteria of the sprint per `docs/b1/B1_IMPLEMENTATION_PLAN.md` Sections 11–16.
2. Verify the readiness gates of `docs/b0/B0_CLOSURE_AUDIT.md` §23 are still green.
3. Run `git status --short` ; working tree must be clean of unintended changes.
4. Create the annotated tag (Section 7).
5. Push the tag explicitly.
6. Open the next sprint's planning document.

If at step 1 or 2 the criteria are not met, **the sprint does not close**. The tag is not created. The team revisits the open items.

A future "production release" (Phase 1 MVP exit, cohort step transitions) will have its own checklist, derived from `LARGO_GO_TO_MARKET.md` and `LARGO_SECURITY_PAYMENTS.md`. Not in scope for Sprint 0.

---

## 10. Document status

| field | value |
|---|---|
| Document type | Sprint 0 — Branch Strategy |
| Phase | B1 Sprint 0 |
| Version | 0.1.0 |
| Status | Draft, opening |
| Source | `docs/b1/B1_IMPLEMENTATION_PLAN.md` Section 6, 11 |
| Open items | none — strategy is internally complete ; verify on first feature branch usage |
| Forbidden in this document | code, migrations, endpoints, components, V7a touch, any working-tree file modification, commits and pushes by the assistant, `.env*` modification, broad git staging, modification of any file outside `docs/b1/BRANCH_STRATEGY.md` |
| Successor documents | `docs/b1/PRECOMMIT_DESIGN.md`, `docs/b1/CLAUDE_CODE_RULES.md`, `docs/b1/FILE_ALLOW_DENY.md` |
| Last updated | 2026-04-27 |

Sprint 0 branch strategy opens here. The first B1 feature branch is the test of this strategy.
