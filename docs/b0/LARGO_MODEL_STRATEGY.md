# Largo — Model Strategy

> **Status:** B0 (pre-implementation framing). Model strategy specification before any new training run, model deployment, or production inference.
> **Audience:** founder, ML/data, security, product, ops, future hires, future external ML reviewers.
> **Author:** Flyeas team.
> **Coherence:** depends on `LARGO_DOMINATION_STRATEGY.md`, `LARGO_PRODUCT_VISION.md`, `LARGO_ADVICE_CONTRACT.md` (v0.1.0), `LARGO_EVALUATION_PLAN.md`, `LARGO_SECURITY_PAYMENTS.md`, `LARGO_DATA_STRATEGY.md`.

---

## 0. Document scope and non-scope

**In scope (B0 documentary):**
- The model philosophy and the deliberate choice of restraint over complexity.
- Inventory of existing models in the repo, with status (V1, V7a, V7.6 Ultra components).
- Recommended model stack per Phase (1 / 2 / 3+).
- Per-task method allowance (price assessment, timing, action, calibration, regret, anomaly, provider reliability, auto-buy gating).
- Training discipline, calibration strategy, ensembling policy, abstain mechanism, interpretability policy.
- Inference architecture, latency budgets, fallback behavior.
- Model versioning, promotion gates, shadow protocol, kill criteria, rollback, graveyard.
- Monitoring (drift, calibration, safety).
- LLM / AI assistance policy in the model lifecycle.
- Forbidden model patterns.
- Phase 1/2/3 rollout gates.
- Open questions explicitly listed.

**Out of scope (B0):**
- Any code change to existing model code (`scripts/cloud/v76_ultra/*`, `scripts/train/*`, `scripts/train/v7a/*`).
- Any new training run, benchmark, deployment, or migration.
- Any modification of existing model artefacts (`bma_weights.json`, `copula_weights.json`, `xgb_meta_weights.json`).
- Any final SLA on model latency or accuracy (those are B1+ commitments tied to live measurement).
- Any public claim of superiority over a named competitor; those are reserved for `LARGO_COMPETITIVE_BENCHMARK.md` and gated by `LARGO_EVALUATION_PLAN.md` Section "Public claims policy".

This document is the **model spine**. Implementation in B1+ will pin specific model versions and training runs against this spine.

---

## 1. Model philosophy

Five principles that override architecture novelty, leaderboard scores, and the reflex to "ship the bigger model."

1. **Model is a depreciating asset; data is the moat.** Per `LARGO_DATA_STRATEGY.md` Section 1, the user-decision data Largo accumulates is uncopyable; the model that consumes it is replaceable. Strategy must invest in data quality and lineage before model sophistication.
2. **Calibrated and explainable beats accurate and proud.** A model that says "BUY_NOW with 0.72 confidence" and is right 72% of the time is more valuable than a model that says "BUY_NOW" with 80% accuracy but no calibrated confidence. Calibration is the price of the right to display confidence at all (per `LARGO_PRODUCT_VISION.md` and `LARGO_EVALUATION_PLAN.md`).
3. **Interpretable beats SOTA at 90% of decisions.** A monotonic LightGBM with SHAP attribution is auditable, debuggable, and explainable to a customer support agent. A 50-layer transformer is not. Strategy chooses the interpretable model unless an explicit measurable gain on a primary metric justifies the trade.
4. **ABSTAIN is a feature, not a bug.** A model that abstains honestly under uncertainty is a moat-building asset (per `LARGO_PRODUCT_VISION.md`). A model that always emits BUY_NOW or WAIT to look "complete" is the V7.6 Ultra trap.
5. **Ensemble before novel architecture.** A modest ensemble of well-calibrated baselines almost always beats a single state-of-the-art model on calibration error and tail behavior. Novel architectures earn their place only after ensembles plateau on a measured metric.

These five principles dominate any "but the new model is so cool" argument. They are not preferences; they are the operating constraint of the team.

---

## 2. Why data strategy matters more than model complexity

### 2.1 The empirical record on pricing models
Public benchmarks on flight-pricing prediction (Kaggle, dilwong, ICDM) show: the gap between a well-tuned LightGBM and a state-of-the-art deep model is small (a few percent on RMSE), while the gap between a model trained on noisy uncontracted data and the same model trained on contracted, lineage-tracked data is large (often double-digit improvement on calibration error). The leverage is in the data, not the architecture.

### 2.2 The 80/20 of calibration
A vanilla quantile regression with proper calibration (Platt or isotonic) and conformal intervals captures most of the achievable calibration quality on flight pricing. Diminishing returns set in fast. Largo invests where the return is, not where the press release lives.

### 2.3 Diminishing returns of architecture sophistication
Each step up in architectural complexity (LightGBM → DeepAR → TFT → custom) buys:
- Higher training cost (compute + time).
- Higher inference latency.
- Lower interpretability.
- More fragile reproducibility.
- More surface for silent regressions.

For Largo Phase 1, the cost-benefit favors the simple model with disciplined calibration, not the sophisticated model with hopeful calibration.

### 2.4 Why not use the biggest model first
- We do not yet have first-party decision-paired data at the volume that justifies a high-capacity model.
- Foundation models trained on public scraped data have unknown bias toward conversion-optimized incumbents (the very thing Largo is *not*).
- A foundation-model wrapper is a thin moat — anyone can copy it.
- Operational cost of a large model in inference would deviate budget from the actual moat (data + audit + safety).
- A failure of a giant model is harder to debug than a failure of a small model. In Phase 1, debug-ability is more valuable than ceiling.

The biggest-model-first reflex is rejected. The discipline is: smallest model that beats the next baseline on a measured metric.

---

## 3. What models are allowed to do

Models in Largo are *advisors* to a contract-bound system, not autonomous agents. They are allowed to:
- Estimate a future price distribution for a route (point estimate + intervals).
- Estimate the probability that price drops below the user's ceiling within the mission window.
- Recommend an action (BUY_NOW / WAIT / ALERT / MONITOR / ABSTAIN) consistent with `LARGO_ADVICE_CONTRACT.md`.
- Produce a numeric confidence (`numeric_value`, internal/admin only) and a semantic label (`confidence_label`, customer-facing).
- Estimate realized regret post-hoc on closed missions (offline).
- Detect anomalies in price observations or provider responses.
- Score provider reliability over time (offline).
- Contribute one signal to the auto-buy condition stack (per `LARGO_SECURITY_PAYMENTS.md` Section 10), never the only signal.

Every model output is consumed by the contract layer, validated, and either surfaced to the user or routed to a fallback. **The model never writes directly to the user-facing UI.**

---

## 4. What models are not allowed to do

Models in Largo are not allowed to:
- **Decide silently.** No model output triggers a payment without the auto-buy condition stack (`LARGO_SECURITY_PAYMENTS.md` Section 10).
- **Replace audit logic.** A model's output never substitutes for an `AuditBlock` row.
- **Replace consent.** A model's output never bypasses the consent layers (`LARGO_SECURITY_PAYMENTS.md` Section 11).
- **Replace human review for SEV1.** Incidents are handled by humans first; models are diagnostic at best.
- **Be deployed without baseline-beating proof on the primary metric.** Section 14 below pins the criteria.
- **Be deployed without calibration measurement.** No model goes to production with `numeric_value` populated and uncalibrated.
- **Be deployed without lineage.** Per `LARGO_DATA_STRATEGY.md` Section 29, every model declares the snapshot IDs it was trained on.
- **Override safety flags.** Safety flags from upstream signals (`LARGO_ADVICE_CONTRACT.md`) are not model-controllable.
- **Loop back into their own training data without holdout.** Per `LARGO_DATA_STRATEGY.md` Section 33, feedback loops are explicit and managed.
- **Be promoted on a non-temporal metric.** Random-split scores are forbidden as the basis for promotion (`LARGO_DATA_STRATEGY.md` Section 26).
- **Be presented to the customer as more confident than calibration justifies.** Customer UI shows semantic labels only (per `LARGO_PRODUCT_VISION.md`).

---

## 5. Current model inventory

Snapshot of model artefacts and code paths visible in the repo today. **Inventory only — no commitment to use, modify, or run any of these in B0.** Each item is classified for Phase 1 status.

| Component | Type | Repo trace | Status (Phase 1) |
|---|---|---|---|
| **V1 heuristic** | Non-ML rule baseline | (specification placeholder; not yet pinned in repo) | Reference baseline, must be defined in B1 |
| **V7a — LightGBM quantile** | Quantile regression with calibration | `scripts/train/v7a/lgbm_quantile.py`, `calibrate.py`, `policy.py` | **Active baseline.** Shadow-validated 2026-04-25. Reference for regret comparison ($58.33 mean abs regret on 11,750 trips). |
| V7a — features pipeline | Feature engineering | `scripts/train/v7a/features.py`, `build_dataset.py`, `build_target.py` | Active baseline support |
| V7a — split & leakage audit | Temporal split + leakage check | `scripts/train/v7a/split.py`, `audit_leakage.py` | Active |
| V7a — backtest & baselines | Evaluation | `scripts/train/v7a/backtest.py`, `baselines.py` | Active |
| V7a — local vs Modal compare | Reproducibility check | `scripts/train/v7a/compare_local_vs_modal.py` | Active |
| V7a — dilwong fetch | Public data ingest | `scripts/train/v7a/fetch_dilwong.py` | Active |
| V7.6 Ultra — BOCPD-EVT | Bayesian Online Change-Point Detection + Extreme Value Theory | `scripts/cloud/v76_ultra/policy/bocpd_evt.py` | **Research asset.** Not Phase 1 candidate. |
| V7.6 Ultra — IQN policy | Implicit Quantile Network policy | `scripts/cloud/v76_ultra/policy/iqn_policy.py` | Research asset |
| V7.6 Ultra — XGB meta-stack | XGBoost stacking | `scripts/cloud/v76_ultra/stacking/xgb_meta.py`, `xgb_meta_weights.json` | Research asset |
| V7.6 Ultra — BMA weights | Bayesian Model Averaging | `bma_weights.json` | Research asset |
| V7.6 Ultra — Copula weights | Copula combiner | `copula_weights.json` | Research asset |
| V7.6 Ultra — backtest | V7.6 backtest | `scripts/cloud/v76_ultra/policy/v76_backtest.py` | Research asset |
| V7.6 Ultra — common | Shared utilities | `scripts/cloud/v76_ultra/_common.py` | Research asset |
| Earlier training pipeline — GP | Gaussian Process | `scripts/train/03-fit-gp.py` | Research asset |
| Earlier training pipeline — HMM | Hidden Markov Model | `scripts/train/04-fit-hmm.py`, `04-fit-hmm-fast.py` | Research asset |
| Earlier training pipeline — QRF | Quantile Regression Forest | `scripts/train/05-fit-qrf.py` | Research asset |
| Earlier training pipeline — LSTM | LSTM | `scripts/train/06-train-lstm.py` | Research asset |
| Earlier training pipeline — TFT | Temporal Fusion Transformer | `scripts/train/07-train-tft.py`, `07-train-tft-fast.py` | Research asset |
| Earlier training pipeline — DeepAR | DeepAR | `scripts/train/08-train-deepar.py`, `08-train-deepar-fast.py` | Research asset |
| Earlier training pipeline — MAML | Model-Agnostic Meta-Learning | `scripts/train/10-train-maml.py` | Research asset |
| Earlier training pipeline — Ensemble | Ensemble combiner | `scripts/train/12-fit-ensemble.py` | Research asset |
| Earlier training pipeline — Validate | Fast validation | `scripts/train/13-validate-fast.py` | Research asset |
| Splits | Temporal & expanded splits | `scripts/train/01-split.py`, `01b-expand-temporal.py`, `00-export-to-local.py` | Research asset |

**"Research asset"** means: the artifact may have value in research / dev / experimentation; it is **not** approved as a Phase 1 production candidate. Re-approval requires Section 14 criteria.

---

## 6. V1 heuristic status

### 6.1 Definition
A simple non-ML rule set used as a sanity baseline. Examples (illustrative, to be pinned in B1):
- "BUY_NOW if observed price ≤ 90% of route 30-day rolling median and `valid_until` > 24h."
- "WAIT if observed price > 110% of route 30-day rolling median and mission ceiling allows ≥ 7 more days."
- "ABSTAIN if route has fewer than N historical observations."

### 6.2 Why V1 exists
- Sanity floor: any model claiming improvement must beat V1 on calibration and regret.
- Failure-tolerant: V1 keeps running when ML services are down.
- Communication aid: V1 is explainable to anyone in the team and to support agents.

### 6.3 Status
- **Specification placeholder in B0.** V1 must be specified concretely in B1.
- Counted in the "Baselines to beat" table (Section 13).

---

## 7. V7a baseline status

### 7.1 What V7a is
A LightGBM quantile regression pipeline with calibration and a policy layer, trained on public data (dilwong + supporting features). V7a is the current best-validated Largo predecessor.

### 7.2 Validated facts (per memory)
- **Shadow mode validated end-to-end** on 2026-04-25.
- **Pivot A confirmed live.**
- **Two open findings**: `ml_available=false` observed in shadow output; `confidence=NULL` observed in shadow output. Both are tracked, neither blocks V7a's role as baseline.
- **Reference regret**: $58.33 mean absolute regret on 11,750 trips (per `LARGO_EVALUATION_PLAN.md`).

### 7.3 Role in Largo
- **Reference baseline for any Largo model.** Per `LARGO_EVALUATION_PLAN.md`, no Largo model claims superiority without beating V7a on regret on the same temporal slice.
- **Shadow-eligible.** V7a may run in shadow alongside any new Largo model under development.
- **Untouched in B0.** No code changes; no new training runs.

### 7.4 V7a's two open findings
- `ml_available=false`: documented in shadow output. Likely a feature-flag or service-availability signal, not a calibration error. Re-investigate in B1 before promoting V7a-derived signal in production.
- `confidence=NULL`: documented in shadow output. Either calibration step missing in the shadow path or contract-level null acceptable for ABSTAIN-equivalent state. To resolve in B1.

These findings do not invalidate V7a as baseline; they constrain how V7a's shadow output is consumed.

---

## 8. V7.6 Ultra status / lessons

### 8.1 What V7.6 Ultra is
A 19-script training and policy stack combining: BOCPD-EVT, IQN policy, XGB meta-stacking, BMA, Copula combination, plus the older training pipeline (GP / HMM / QRF / LSTM / TFT / DeepAR / MAML / ensemble). Designed as a "max-capability" research effort.

### 8.2 Empirical ceiling (per memory)
- **~82% capture ceiling with the 19 scripts** in current configuration.
- **~92% theoretical maximum without GDS data**.
- The ceiling is dominated by data limits (lack of GDS / real-time inventory), not model capacity.

### 8.3 Lessons from V7.6 Ultra

The V7.6 Ultra effort is the most important lesson for Largo's model strategy. The lessons are not "the components were bad"; they are about *the ratio of complexity to validated gain*.

| Lesson | What V7.6 Ultra showed | Largo discipline derived |
|---|---|---|
| **Complexity is a tax, not a feature.** | 19 scripts to chain, debug, deploy, version. Each adds failure surface. | Phase 1 maximum: one model with one calibrator and one policy layer. |
| **Capture ceiling is data-bound, not model-bound.** | 82% with a heavy stack; 92% theoretical without GDS. The remaining gain is in **data**, not in **architecture**. | Invest in data acquisition, contracts, and lineage before any architecture sophistication. |
| **Stacking without a proven base is theatre.** | XGB meta + BMA + Copula combiners only matter if each base model is independently calibrated and beats baseline. Otherwise stacking averages noise. | Do not stack until each base passes Section 14 alone. |
| **Backtest gains do not equal production gains.** | Strong backtest improvements that did not translate to validated user-decision improvement, because backtest didn't include user behavior, ABSTAIN, or auto-buy gating. | Promotion requires Section 28 gates with shadow-mode evidence, not backtest evidence alone. |
| **Without ABSTAIN, you optimize the wrong loss.** | Models trained to always emit a forecast bias toward overconfidence. | ABSTAIN is a first-class output (Section 21), not a fallback. |
| **No interpretability, no debugging.** | Deep stacks made it nearly impossible to attribute a prediction to a feature in support / dispute scenarios. | SHAP attribution available for every production prediction (Section 22). |
| **Reproducibility erodes silently.** | Training-run drift across environments (local vs Modal) found via `compare_local_vs_modal.py`. The fact that we needed such a comparator at all is the lesson. | Snapshot binding (Section 16) and reproducibility tests are mandatory before promotion. |
| **Component pride bias.** | Each researcher loves their component; the stack accumulates. | Section 30: kill criteria are written before models are added. |

### 8.4 V7.6 Ultra is **not** declared useless
- Components remain valuable as **research assets** for benchmarking and as a reservoir of potential future signals.
- Specific components (e.g., BOCPD-EVT for change-point detection) may earn promotion in later phases under Section 14 criteria.
- The stack as a whole is **not a Phase 1 production candidate** without Section 28 gate evidence.

### 8.5 Operational implication
- V7.6 Ultra code stays in repo, untouched in B0.
- No new V7.6 Ultra training run in B0.
- Any future re-activation requires an updated rationale tracing to Section 14 criteria.

---

## 9. Largo Phase 1 model stack

### 9.1 Recommended Phase 1 model stack

| Slot | Choice | Rationale |
|---|---|---|
| **Price quantile estimator** | LightGBM quantile regression (V7a-aligned) | Best validated baseline; interpretable; fast inference; reasonable training cost |
| **Calibrator** | Isotonic regression on a held-out calibration set | Non-parametric, robust to mis-specification, works with quantile outputs |
| **Conformal layer** | Split conformal with route-stratified calibration | Distribution-free coverage guarantee; well-understood failure modes |
| **Action policy** | Rule-based policy mapping (price quantile, mission ceiling, time to departure, valid_until) → action | Auditable; aligns with PRODUCT_VISION's action enum; modifiable without retraining |
| **ABSTAIN trigger** | Coverage / data-quality / confidence rules | Honest abstention; never lazy abstention |
| **Anomaly detector** | Simple z-score per route / cabin (diagnostic only) | Cheap signal for safety_flags |
| **V1 fallback** | Rule baseline (Section 6) | Runs when ML services unavailable |

### 9.2 What is **not** in Phase 1 stack
- No deep learning (no LSTM, TFT, DeepAR, IQN).
- No meta-stacking / BMA / Copula.
- No HMM / GP.
- No MAML / few-shot transfer.
- No foundation-model wrapper.
- No real-time online learning.

These are not declared useless; they are not Phase 1 candidates. Section 11 describes the conditions under which any of them could earn a slot.

### 9.3 Phase 1 stack constraints
- Inference latency p95 ≤ 500 ms on advice generation path (preliminary target; pinned in B1 against measured infra).
- Training time bounded such that retraining can complete within 24 hours of a snapshot.
- Total operational cost (compute + storage) for Phase 1 stack ≤ a small fixed budget (numeric in B1, not B0).
- Single-team maintainable: a single engineer must be able to retrain, deploy, and rollback.

---

## 10. Largo Phase 2 model stack

### 10.1 What changes in Phase 2
Phase 2 begins live data accumulation with real users. The model stack does **not** automatically grow; it earns its growth.

- The Phase 1 stack continues, retrained on the growing first-party dataset (per `LARGO_DATA_STRATEGY.md` Section 33's feedback-loop discipline).
- A second calibrator may be added (e.g., Platt as cross-check on isotonic) to monitor calibration agreement.
- Provider reliability scoring becomes a real (not placeholder) component, fed by accumulated provider-disagreement data (`LARGO_DATA_STRATEGY.md` Section 12).
- ABSTAIN rules tighten or loosen based on measured cohort outcomes.

### 10.2 What earns a slot in Phase 2
- Any new component must pass Section 28 promotion gates against the running Phase 1 stack as baseline.
- "It's the same as before but bigger" is not a justification.

### 10.3 Calibration monitoring becomes continuous
- ECE rolling 30-day window per cohort.
- Per-route calibration cards (small-cell suppressed per `LARGO_DATA_STRATEGY.md` Section 31.1).

---

## 11. Largo Phase 3 model stack

### 11.1 What Phase 3 unlocks
Phase 3 is the first opportunity for a model trained on first-party decision-paired data to enter shadow mode (per `LARGO_EVALUATION_PLAN.md` and `LARGO_DATA_STRATEGY.md` Section 41). This is the moment Largo's moat starts to compound.

### 11.2 What would justify advanced models later

A more advanced model earns a slot in Phase 3 (or beyond) only if **all** of the following are true:

1. The current stack has plateaued on the primary metric (regret, calibration ECE) over a measured window.
2. The new model demonstrably beats the current stack on the primary metric, on a temporal hold-out, with a sample size sufficient to declare statistical confidence.
3. The new model's interpretability story is acceptable (SHAP or equivalent attribution available for every production prediction).
4. The new model's inference latency stays within the per-surface budget (Section 24).
5. The new model's failure mode is at least as graceful as the current stack's (it can ABSTAIN; it has a fallback).
6. The new model's training cost and reproducibility are acceptable (single-team retrainable).
7. The new model has an explicit kill criterion written before promotion (Section 30).

These conditions are conjunctive. Failing any one means the model stays in research, not production.

### 11.3 How Largo becomes stronger over time without overfitting

Largo's strength compounds through a discipline, not through a model upgrade ladder.

- **Better data, same model.** As the decision-paired dataset grows, the same V7a-style model retrained on the larger set improves calibration. This is the cheapest, safest improvement and the one Largo prioritizes.
- **Better labels, same model.** As regret labels accumulate (per `LARGO_DATA_STRATEGY.md` Section 25), the model learns from regret directly rather than from price proxies.
- **Better ABSTAIN, same model.** As cohort outcomes inform abstention thresholds, the same model abstains more honestly without retraining.
- **Better calibration, same model.** As calibration sets grow, the calibrator (isotonic / Platt) becomes finer-grained per cohort.
- **Provider reliability becomes a feature.** Once provider-disagreement data accumulates, provider reliability scores feed back as a feature that costs no model upgrade.

Only after these "same model, better data" levers are exhausted should an architecture upgrade be considered. The discipline rejects "let's add a transformer because we have more data" without measured plateau evidence.

### 11.4 Phase 3+ candidates (none committed)
- Conformalized quantile regression with cohort-specific calibration.
- Sparse mixture-of-experts where each expert is a small interpretable model and the gating is auditable.
- Bayesian model averaging across the V1 / V7a-derived / V7.6-derived components, with audited weights.
- Sequence models (LSTM / TFT) only if temporal patterns prove material on first-party data (likely material for missions; less so for casual searches).
- Foundation-model wrappers only if a measured improvement on regret is shown, **and** the wrapper does not introduce conversion-bias inherited from training data.

---

## 12. Model tasks and allowed methods

### 12.1 Tasks and allowed methods

| Task | Allowed methods (Phase 1) | Allowed methods (Phase 2+) | Forbidden methods (any phase) |
|---|---|---|---|
| **Price quantile estimation** | LightGBM quantile regression | + cohort-stratified variants | Models without temporal split; uncalibrated outputs to user |
| **Timing assessment** (price likely to drop within window) | Rule-based on price quantile + time-to-departure | + ML classifier with proper calibration | Heuristics that ignore mission ceiling |
| **Action recommendation** | Deterministic rule mapping (price quantile, ceiling, time, valid_until, safety) → action | + learned policy with conformal guarantees | RL without offline counterfactual evaluation |
| **Confidence calibration** | Isotonic regression on held-out set | + Platt cross-check, conformal intervals | Uncalibrated softmax; outputs presented as probabilities without ECE measurement |
| **Regret estimation** | Forward-window batch computation (offline) | + same | Imputed regret on incomplete realizations |
| **Route coverage** | Static lookup (route in / out of trained set) | + on-line coverage scoring | "Predict everywhere with extrapolation" without flagging |
| **Anomaly detection** | Z-score per route / cabin | + Isolation Forest, Mahalanobis | Silent removal of anomalies (must flag, not drop) |
| **Provider reliability** | Placeholder / configured constants | Empirical scoring from accumulated disagreement data | Single-provider trust without cross-check policy |
| **Auto-buy safety gating** | Rule layer reading model output + contract conditions | Same; never replaced by a learned gate | Learned gate that overrides any condition in `LARGO_SECURITY_PAYMENTS.md` Section 10 |

### 12.2 Cross-task discipline
- Every model output that becomes part of `LargoAdvice` is validated against the contract before emission.
- Every model output is logged with the model version and the snapshot it was trained on (per `LARGO_DATA_STRATEGY.md` Section 29).
- No model output is consumed by another model without a documented contract between them.

---

## 13. Baselines to beat

A model is not deployed unless it beats the relevant baseline on the primary metric on a temporal hold-out.

| Baseline | Description | Metric to beat | Source |
|---|---|---|---|
| **Always-BUY_NOW** | Trivial recommender | Realized regret | `LARGO_EVALUATION_PLAN.md` |
| **Always-WAIT** | Trivial recommender | Realized regret | Same |
| **V1 heuristic** | Rule baseline (Section 6) | Realized regret + ABSTAIN-rate honesty | This document |
| **V7a** | LightGBM quantile + calibration + policy | Realized regret ($58.33 mean abs reference); calibration ECE | Memory + `LARGO_EVALUATION_PLAN.md` |
| **Largo previous** | The model currently in production | Same metrics | `LARGO_EVALUATION_PLAN.md` |
| **User manual** | What a savvy user achieves with public tools | Same metrics, on a small sampled cohort | `LARGO_EVALUATION_PLAN.md` |

**A new model must beat its predecessor on the primary metric and not regress on calibration. Both are required.**

---

## 14. Model selection criteria

Selection criteria are conjunctive. A candidate model that fails any criterion is rejected.

1. **Beats the relevant baseline (Section 13)** on the primary metric, on a temporal hold-out, with a sample size sufficient to clear a stated noise floor.
2. **Calibration measurable.** ECE is computed and tracked; under the targets in `LARGO_EVALUATION_PLAN.md` (< 0.07 Phase 1, < 0.05 Phase 2).
3. **Interpretability available.** SHAP or equivalent feature attribution for every production prediction.
4. **Reproducibility verified.** Two independent training runs on the same snapshot produce numerically equivalent (within tolerance) models.
5. **Inference latency within budget** (Section 24).
6. **Training cost and time within budget** (single-team retrainable within 24h of a snapshot).
7. **Failure mode graceful.** Model has a defined behavior when input is out-of-distribution; ABSTAIN trigger reachable.
8. **Lineage complete.** Snapshot IDs declared, contracts pinned, training-run record stored.
9. **Kill criterion written** (Section 30) before promotion.
10. **No forbidden pattern (Section 37) violated.**

A candidate that meets all 10 criteria is *eligible* for shadow mode. Shadow-mode evidence is the bridge to production (Section 29).

---

## 15. Training discipline

Training discipline is the operational expression of the principles in Section 1.

- Every training run produces a `training_run` record: snapshot IDs (`LARGO_DATA_STRATEGY.md` Section 28), code commit, hyperparameters, random seeds, environment hash, hardware fingerprint, started_at, ended_at, metrics on validation, calibration on calibration set.
- Random seeds are fixed and recorded. Stochasticity that affects reproducibility is treated as a defect.
- Training data is read from snapshots, not from live tables.
- Training never reads from a live table that could change during the run.
- Training never reads from a snapshot whose contract version differs from the model's declared input contract.
- Training failures are first-class: failed runs are logged with the same diligence as successful ones.
- A successful training run does not auto-promote; promotion goes through Section 28.

---

## 16. Dataset snapshot binding

Every model declares the exact snapshot IDs of every dataset that fed its training.

- A snapshot is identified by `<dataset_name>__<contract_version>__<snapshot_date>` per `LARGO_DATA_STRATEGY.md` Section 28.
- A model trained on snapshot X cannot silently switch to snapshot Y; that is a new model version.
- Inference logs the model version, which logs its training snapshots; given any production prediction, lineage is reconstructable per `LARGO_DATA_STRATEGY.md` Section 29.

---

## 17. Temporal split and leakage prevention

Per `LARGO_DATA_STRATEGY.md` Sections 26–27 (binding for this document):
- **Temporal split mandatory** for all price-related models. Train / val / test boundaries are time-based.
- **Random shuffle forbidden** for price models.
- **Test set is never used for model selection.** Model selection on validation; test only at promotion.
- **Feature `available_at` enforced.** Every feature carries availability metadata; training-set construction fails if any feature in a row has `available_at > row.decision_at`.
- **Cross-mission features** respect time order; aggregates over user history are computed from snapshots, not live data.
- **Calibration leakage forbidden.** ECE is computed on the test cohort, not on the training cohort.
- **V7a as reference.** Any new model is evaluated against V7a on the same temporal slice for fair comparison.

---

## 18. Calibration strategy

### 18.1 Why calibration first
Per `LARGO_PRODUCT_VISION.md` and `LARGO_EVALUATION_PLAN.md`, the right to display confidence at all is conditional on calibration. A miscalibrated model with high accuracy is more dangerous than a calibrated model with lower accuracy.

### 18.2 Methods (Phase 1)
- **Isotonic regression** as primary calibrator. Non-parametric, robust to mis-specification, works with quantile outputs.
- Fit on a held-out calibration set, never on training set.
- Recalibration cadence: at minimum every snapshot refresh; sooner if drift detected.

### 18.3 Methods (Phase 2+)
- **Platt scaling** as cross-check. If isotonic and Platt diverge materially, that itself is a drift signal.
- **Per-cohort calibration cards** (route, cabin, lead time bucket) once data volume permits, with k-anonymity floor per `LARGO_DATA_STRATEGY.md` Section 31.1.

### 18.4 Calibration targets
Per `LARGO_EVALUATION_PLAN.md`:
- Phase 1 internal target: ECE < 0.07.
- Phase 2 internal target: ECE < 0.05.
- Phase 3 cohort gate: sustained < 0.05 over a measured window.

### 18.5 Calibration anti-patterns
- No "soft calibration" where the model's pre-softmax score is presented as confidence without ECE measurement.
- No "calibration on training set" — that is overfitting, not calibration.
- No silent calibrator updates — every recalibration is a model version event.

---

## 19. Conformal prediction strategy

### 19.1 Why conformal
Conformal prediction provides distribution-free coverage guarantees: a 90% prediction interval covers the true value 90% of the time under the exchangeability assumption. This is the cleanest way to attach honest uncertainty to a price prediction.

### 19.2 Method (Phase 1)
- **Split conformal** with route-stratified calibration set.
- Coverage levels exposed: 80%, 90%, 95% (the latter for safety-flag triggering, not for user UI).
- Conformal scores stored with every advice (internal, not customer-facing).

### 19.3 Failure modes managed
- **Distribution shift breaks exchangeability.** Mitigation: per-cohort recalibration; drift detection (Section 33) triggers conformal recalibration.
- **Small calibration set in narrow cohorts.** Mitigation: fall back to a coarser cohort or to ABSTAIN.
- **Coverage drift over time.** Mitigation: rolling-window monitoring of empirical coverage (Section 34).

### 19.4 Conformal in advice contract
- Conformal intervals do not directly appear in `LargoAdvice` v0.1.0's customer-facing fields (numeric confidence is internal-only).
- They feed `confidence_label` thresholds and ABSTAIN triggers.

---

## 20. Ensembling policy

### 20.1 When to ensemble
- When two independently-calibrated base models disagree in ways that suggest complementary signal.
- When ensembling demonstrably reduces calibration error on a temporal hold-out.
- When the ensemble's failure mode is at least as graceful as each base model's.

### 20.2 When NOT to ensemble
- When base models are not independently passing Section 14 criteria.
- When ensembling masks a problem (e.g., averages a biased base with an unbiased one).
- When the ensemble's interpretability story is worse than the base models'.

### 20.3 Weights audited
- Ensemble weights are not a model-internal hidden state; they are stored, versioned, and reviewable.
- Weight changes are model version events.
- BMA, copula, or stacking are allowed only when each base independently meets Section 14 (lesson from V7.6 Ultra: no stacking on noisy bases).

### 20.4 Phase 1 default
- **No ensemble in Phase 1.** A single calibrated model with conformal layer is the default.
- Ensembling earns its place in Phase 2+ after measured plateau.

---

## 21. Abstain mechanism

### 21.1 First-class output
ABSTAIN is one of the actions in `LARGO_ADVICE_CONTRACT.md` v0.1.0's action enum. It is not a fallback or an error — it is a deliberate output the model emits when conditions warrant.

### 21.2 ABSTAIN triggers
- **Out-of-distribution input** (route not in training set, or insufficient training observations).
- **Low conformal coverage** at the relevant level.
- **Data quality flag present** that materially affects model input.
- **Provider unavailability** for the queried route.
- **Calibration unavailable** (e.g., post-snapshot, before recalibration completes).
- **Mission window past** (advice would not be actionable).
- **Cross-check disagreement** above tolerance when multi-provider expected.

### 21.3 Honest vs. lazy ABSTAIN (per `LARGO_EVALUATION_PLAN.md`)
- **Honest ABSTAIN**: triggered by a condition the user can understand; surfaces a useful next step ("we'll alert you when we have data").
- **Lazy ABSTAIN**: triggered by model uncertainty when better effort would yield an answer. Tracked as a quality defect.

### 21.4 ABSTAIN rate monitoring
- Per `LARGO_EVALUATION_PLAN.md`, lazy-ABSTAIN rate target < 25%.
- Honest-ABSTAIN rate is not a defect; it is a surface of integrity.
- Spike in ABSTAIN rate without a corresponding trigger reason is itself a signal (Section 35).

---

## 22. Interpretability policy

### 22.1 Mandatory in Phase 1+
- Every production prediction is reproducible with feature-level attribution (SHAP for tree models; per-feature linear approximation for others).
- Attribution is stored for at least 7 days (cost-bounded; B1 may extend).
- Attribution is queryable from the audit chain (per `LARGO_SECURITY_PAYMENTS.md` Section 19) given an `advice_id`.

### 22.2 Used for diagnosis, not as verdict
- Attribution is diagnostic: it explains a prediction; it does not justify it.
- Attribution is not surfaced as primary explanation to the customer (`LARGO_PRODUCT_VISION.md` controls customer messaging).
- Attribution informs support agents, dispute response, postmortems.

### 22.3 Monotonicity constraints
- Where domain knowledge supports it (e.g., "earlier booking date should not, on average, increase predicted price"), monotonicity constraints are enforced in tree-based models.
- Constraints are documented per model version.

### 22.4 Interpretability anti-patterns
- "Explainable AI" marketing claims when no per-prediction attribution is actually stored.
- Post-hoc narratives generated by an LLM that don't trace to actual model internals.
- Monotonicity claims without enforcement.

---

## 23. Inference architecture

### 23.1 Modes
- **Online inference** for advice generation: synchronous, latency-budgeted.
- **Batch inference** for offline regret labeling, calibration sets, anomaly sweeps.
- **Shadow inference** for new-model evaluation alongside current production model.

### 23.2 Failure isolation
- Model service is a separate failure domain from advice generation logic.
- Model service unreachable → advice generation falls back to V1 heuristic (Section 25).
- No model service blocks the user-facing path beyond its latency budget.

### 23.3 Versioning at inference
- Each inference logs: `model_version`, `snapshot_ids`, `feature_set_version`, `calibrator_version`, `policy_version`.
- Multi-version inference (during shadow / canary) is supported by the audit chain.

---

## 24. Latency budgets

Preliminary targets, pinned in B1 against measured infrastructure.

| Surface | Latency p95 budget | Action on breach |
|---|---|---|
| Mission advice generation (post-confirmation re-fetch) | ≤ 800 ms (model + feature + policy) | Model fallback to V1 |
| Mission advice generation (background) | ≤ 5 s | No user-facing impact; alert |
| Simple search advice generation | ≤ 1.2 s | Fall back to V1 |
| Anomaly scoring | ≤ 200 ms (or async) | Drop to async |
| Auto-buy gating evaluation | ≤ 300 ms (model contribution) | BLOCK auto-buy on timeout (per `LARGO_SECURITY_PAYMENTS.md` Section 10) |

Latency budgets are enforced; a model that consistently breaches its budget is a candidate for kill criteria (Section 30).

---

## 25. Fallback behavior

### 25.1 When model unavailable
- Advice generation falls back to V1 heuristic.
- `ml_available: false` is set in the advice (per `LARGO_ADVICE_CONTRACT.md` v0.1.0).
- `confidence_label` is downgraded; `numeric_value` may be null.
- Auto-buy is blocked (per `LARGO_SECURITY_PAYMENTS.md` Section 10's condition stack).

### 25.2 When confidence below threshold
- Advice may downgrade from BUY_NOW to MONITOR or ABSTAIN.
- The downgrade is logged with reason.
- The user sees a semantic label only, never the numeric threshold.

### 25.3 When model is in shadow
- Production model emits the user-facing advice.
- Shadow model emits a parallel advice for comparison.
- Shadow output never reaches the user.

### 25.4 Never default to BUY_NOW
- BUY_NOW is the highest-trust action. Falling back *to* BUY_NOW under failure is forbidden.
- Falling back *from* BUY_NOW to MONITOR or ABSTAIN is the safe direction.

---

## 26. Model versioning

### 26.1 Semver
- Model versions follow semver: `MAJOR.MINOR.PATCH`.
- MAJOR: input contract change, output contract change, fundamental architecture change.
- MINOR: feature addition, retraining on new snapshot with measurable metric change.
- PATCH: fixed bug, no metric change.

### 26.2 Snapshot binding
- Every model version pins its training snapshot IDs and contract versions (Section 16).
- A retraining on a new snapshot is at minimum a MINOR bump.

### 26.3 Calibrator versioning
- Calibrators are versioned independently from the underlying model.
- A model + calibrator pair is the deployable unit; both versions are logged.

### 26.4 Policy versioning
- The action policy layer is versioned independently.
- A policy change without a model change is a `policy_version` bump only.

---

## 27. Model registry future design

### 27.1 Proposal (not committed in B0)
A model registry that stores, for every model version:
- Identifier (`model_name@version`).
- Training snapshot IDs.
- Code commit hash.
- Calibrator version + artefact.
- Policy version + artefact.
- Validation metrics (per `LARGO_EVALUATION_PLAN.md`).
- Calibration metrics (ECE per cohort).
- Promotion status (`research`, `shadow`, `canary`, `production`, `retired`).
- Kill criteria record.
- Audit row references.

### 27.2 Candidates
- MLflow.
- Weights & Biases.
- Neptune.
- Custom on Postgres with object-store-backed artefacts.

Selection deferred to B1.

### 27.3 Discipline regardless of choice
- A model not in the registry is not deployable.
- A registry entry is append-only for status transitions (no silent demotion).

---

## 28. Promotion gates

A model moves through statuses with explicit gates.

| From → To | Gate evidence required |
|---|---|
| `research` → `shadow` | Section 14 criteria all met; kill criteria written; lineage complete; reproducibility check passed |
| `shadow` → `canary` | At least 30 days in shadow with no SEV1/SEV2 caused; calibration ECE under target on shadow output; regret on shadow output ≤ baseline; audit log clean |
| `canary` → `production` | At least 14 days in canary on a small cohort; calibration sustained; regret sustained or improved; no incident attributable to model |
| `production` → `retired` | Section 30 kill criteria triggered, OR replaced by a new production model with overlap window |
| Any → `research` | Demotion from production is allowed; demotion is logged; never silent |

**No status transition is automatic.** Each transition is signed off by a human, recorded in the registry, and audit-logged.

---

## 29. Shadow mode protocol

### 29.1 Purpose
Shadow mode evaluates a candidate model in real conditions without exposing its output to users. The candidate sees the same input as production and emits parallel output that is logged, evaluated, but never displayed.

### 29.2 Protocol (per `LARGO_EVALUATION_PLAN.md` and validated by V7a's 2026-04-25 shadow run)
- Candidate runs alongside production.
- Inputs are identical (same snapshot, same feature pipeline, same time of evaluation).
- Outputs are stored in a shadow log, never reaching the user.
- Comparison is on calibration, regret (post-realization), ABSTAIN-rate honesty, and disagreement-with-production.
- Duration: minimum 30 days, longer if metrics are noisy.
- Exit: promotion to canary (Section 28) or back to research (with documented rationale).

### 29.3 Shadow does not mean unsafe
- Shadow does not consume payment paths.
- Shadow does not bypass any safety check.
- Shadow output is treated as semi-trusted: logged for evaluation, never autonomously acted on.

---

## 30. Kill criteria

Every promoted model has written kill criteria, evaluated continuously. Triggering any criterion initiates the rollback procedure (Section 31).

| Criterion | Threshold | Source signal |
|---|---|---|
| Calibration regression | ECE rises above the target's tolerance band over a 7-day rolling window | Calibration monitoring (Section 34) |
| Regret regression | Realized regret rises above pre-deployment level by more than the noise floor over 30 days | Regret monitoring (per `LARGO_EVALUATION_PLAN.md`) |
| ABSTAIN-rate spike | Lazy-ABSTAIN rate exceeds 30% sustained 7 days | Section 35 |
| Latency breach | p95 above budget for sustained 24h | Inference monitoring |
| Drift breach | Feature/label drift triggers redirect | Drift monitoring (Section 33) |
| Safety event attributable to model | Any SEV1/SEV2 root-caused to model | Incident response |
| Provider trust collapse | Provider data feeding model becomes unreliable | Provider reliability monitoring |
| Snapshot unavailability | Required snapshot can no longer be reconstructed | Lineage check |
| Contract version mismatch | Upstream contract changes incompatible | Schema monitoring |
| Reproducibility breach | Two retraining runs on same snapshot diverge beyond tolerance | Reproducibility check |

**Kill criteria are written before promotion.** No model is promoted without them.

---

## 31. Rollback policy

### 31.1 Modes
- **Automatic rollback**: kill criterion auto-triggered → revert to last known good model version. Time-to-rollback target: ≤ 5 minutes for critical surfaces.
- **Manual rollback**: human-initiated based on judgment, even if no kill criterion fired.
- **Soft rollback**: route a fraction of traffic back to previous version while investigating.

### 31.2 Rollback observability
- Rollback events are audit-logged.
- Rollback events emit a SEV2-track incident if not preceded by a planned trigger.
- Rollback events trigger a postmortem within 7 days.

### 31.3 No silent rollback
- Rollback to an undocumented model state is forbidden.
- Rollback target must be a registry-pinned, snapshot-bound version.

---

## 32. Model graveyard policy

### 32.1 Retired models retained
- Retired model artefacts (weights, calibrator, policy, training metadata) are retained in cold storage indefinitely while the model's predictions remain in the audit chain.
- Retention is tied to audit retention (per `LARGO_SECURITY_PAYMENTS.md` Section 19): 7 years minimum.

### 32.2 Re-activation
- A retired model is never silently re-activated.
- Re-activation is a fresh promotion (Section 28); the model goes through gates from `research` again.
- A retired model with stable retired status > 12 months may be a candidate for re-evaluation if data has evolved materially.

### 32.3 V7.6 Ultra components in the graveyard frame
- V7.6 Ultra components are **research assets**, not retired models. They have not been in production.
- They live in the same long-term storage discipline.
- A future re-activation goes through Section 28 from `research`.

---

## 33. Drift monitoring

Per `LARGO_DATA_STRATEGY.md` Section 34 (binding) — model-side specifics below.

### 33.1 Model-side drift signals
- **Prediction distribution drift**: distribution of model predictions over time vs. training. KS / PSI on predicted quantiles, weekly.
- **Feature contribution drift**: SHAP value distribution per feature drifts → indicates model is leaning on different features over time.
- **Calibration drift**: predicted vs. realized calibration card moves. Triggers Section 34.
- **Action distribution drift**: ratio of BUY_NOW / WAIT / ALERT / MONITOR / ABSTAIN over time. Spikes are signals.

### 33.2 Drift response
- Mild drift: alert, schedule retraining at next snapshot.
- Severe drift: emergency retraining, possible kill-criterion trigger.
- Concept drift (model becomes less accurate even if features look stable): kill-criterion candidate.

### 33.3 No silent retrain on drift
- Retraining is deliberate; drift-triggered retraining requires sign-off.

---

## 34. Calibration monitoring

### 34.1 Continuous ECE
- ECE computed on a rolling 30-day window per cohort (model-wide + per-route + per-cabin where k-anonymous).
- Reliability diagrams produced weekly, archived.
- Per `LARGO_EVALUATION_PLAN.md` reporting cadence.

### 34.2 Alerting
- ECE above target's tolerance band for 7 days → alert ML team.
- ECE above target's hard threshold for 24h → kill-criterion review.
- Disagreement between isotonic and Platt calibrators above tolerance → alert.

### 34.3 No public claim without measured calibration
- Per `LARGO_EVALUATION_PLAN.md`'s public claims policy, no public claim of "calibrated" without measured ECE plus the 5 conditions.

---

## 35. Safety monitoring

### 35.1 Adversarial probes
- Synthetic adversarial inputs (per `LARGO_DATA_STRATEGY.md` Section 23.1) probe model behavior on edge inputs.
- Probes run nightly on a frozen probe set.
- Behavior changes on probes are signals, not necessarily failures.

### 35.2 Safety-flag attribution
- When a safety flag fires on an advice that the model contributed to, the model's contribution is logged.
- Sustained safety-flag attribution to the same model triggers kill-criterion review.

### 35.3 Auto-buy gating model
- The model that contributes to auto-buy gating (per `LARGO_SECURITY_PAYMENTS.md` Section 10) has stricter monitoring: any single false-positive (auto-buy fired when it should not have) is a SEV2 minimum.

---

## 36. LLM / AI assistance policy

LLM (including the assistant authoring this document) interaction with the model lifecycle is governed by the same trust-boundary and review discipline as any external code source.

### 36.1 Allowed
- LLM-assisted code generation for training scripts, with human review.
- LLM-assisted documentation and analysis (this file is an example).
- LLM-assisted dispute response drafting, with human approval.
- LLM-assisted research summarization.

### 36.2 Forbidden
- **LLM in the production decision path** (no LLM emits `LargoAdvice`).
- **LLM-generated training code merged without human review** (per `LARGO_SECURITY_PAYMENTS.md` Section 30 forbidden patterns).
- **LLM-generated synthetic training data** in production training without explicit founder + ML lead sign-off (per `LARGO_DATA_STRATEGY.md` Section 23).
- **LLM-generated SHAP narratives** presented as actual model attribution.
- **LLM-generated calibration claims** without measured ECE.
- **LLM-driven auto-merge** of model-affecting PRs.

### 36.3 LLM-as-evaluator
- LLM-based evaluation of model output (e.g., "is this advice clear?") is allowed for *editorial* quality only, not for *correctness*.
- Correctness is measured against realized outcomes, not against an LLM's opinion.

---

## 37. Forbidden model patterns

The append-only model-side "no" list. Each entry is a regression to revert, not negotiate.

| # | Pattern | Why forbidden |
|---|---|---|
| 1 | Deploying without baseline-beating proof on primary metric | Section 14 |
| 2 | Deploying without measured calibration | Section 18 |
| 3 | Deploying without lineage | Section 16 |
| 4 | Random-shuffle splits for price models | Time-leak per `LARGO_DATA_STRATEGY.md` |
| 5 | Calibration on training set | Overfitting masquerading as calibration |
| 6 | Reusing test set for selection | Test-set leakage |
| 7 | Stacking on uncalibrated bases | V7.6 Ultra lesson |
| 8 | Using `realized_regret` as a feature | Future-leak |
| 9 | Auto-promoting on backtest gain | Backtest ≠ production |
| 10 | Silent calibrator update | Unversioned change |
| 11 | Silent ensemble weight change | Same |
| 12 | Defaulting to BUY_NOW on failure | Asymmetry of harm |
| 13 | Lazy ABSTAIN as default for "I don't know" | Per `LARGO_EVALUATION_PLAN.md` |
| 14 | LLM in production decision path | Section 36.2 |
| 15 | LLM-generated synthetic training data without sign-off | Per `LARGO_DATA_STRATEGY.md` |
| 16 | Model overriding any condition in `LARGO_SECURITY_PAYMENTS.md` Section 10 | Safety boundary |
| 17 | Model emitting customer-facing numeric confidence | Per `LARGO_PRODUCT_VISION.md` |
| 18 | Model writing directly to customer UI | Architecture boundary |
| 19 | Model trained on synthetic data without `is_synthetic` propagated | Data hygiene |
| 20 | Hidden feedback loop (model output → user → model training) without holdout cohort | Reward hacking risk |
| 21 | Re-activating a retired model silently | Section 32 |
| 22 | Promoting a model without written kill criteria | Section 30 |
| 23 | Stacking V7.6 Ultra components into Phase 1 production without per-base Section 14 evidence | Direct V7.6 Ultra lesson |
| 24 | Public claim of "calibrated" / "best" / "beats Hopper" without `LARGO_EVALUATION_PLAN.md` 5 conditions met | Public claims policy |
| 25 | Adding a model because it is architecturally novel | Novelty bias |
| 26 | Adding a model to "complete the stack" | Aesthetic bias |
| 27 | Re-using V7.6 Ultra component without re-training on Largo's contracted data | Stale-data drift |
| 28 | Cross-model output consumption without a documented contract | Hidden coupling |
| 29 | Inference latency repeatedly breaching budget without rollback | Discipline collapse |
| 30 | Reproducibility tolerance loosened to "make tests pass" | Hidden defect |
| 31 | Optimization for click-through as the primary loss | Per `LARGO_EVALUATION_PLAN.md` |
| 32 | Optimization for booking conversion as the primary loss | Same |

This list is **append-only**. Removal of any entry requires the same review level as deactivating a kill switch per `LARGO_SECURITY_PAYMENTS.md` Section 29.

---

## 38. Phase 1 / Phase 2 / Phase 3 gates

### Phase 1 — Documentary + dev (current)
- All work is design, model strategy framing, and dev-environment alignment.
- No new training run, benchmark, or deployment.
- Existing model artefacts and code untouched.
- V7a remains the validated baseline (untouched in B0).
- V7.6 Ultra remains research asset (untouched in B0).

**Gates to enter Phase 2:**
- [ ] All B0 docs complete and signed off.
- [ ] Phase 1 model stack pinned in B1 specification (recommended stack from Section 9.1).
- [ ] V1 heuristic specified concretely (Section 6.3).
- [ ] V7a's two open findings (Section 7.4) resolved or documented as accepted.
- [ ] Calibration measurement infrastructure defined.
- [ ] Conformal infrastructure defined.
- [ ] Model registry choice made.
- [ ] Promotion gate workflow operational.

### Phase 2 — Live data accumulation, Phase 1 stack in production
- Phase 1 stack runs in production on live first-party data.
- V7a continues in shadow as reference baseline.
- Calibration and regret computed continuously per `LARGO_EVALUATION_PLAN.md`.
- No new advanced model promoted yet.

**Gates to enter Phase 3:**
- [ ] ≥ 90 days clean operation in Phase 2.
- [ ] Calibration ECE < 0.07 sustained.
- [ ] Regret on Largo cohort ≤ V7a regret on equivalent cohort.
- [ ] No SEV1 attributable to model in Phase 2.
- [ ] Drift, calibration, safety monitoring all operational.
- [ ] First-party decision-paired dataset reaches sample-size threshold (TBD in B1).

### Phase 3 — First first-party-trained Largo model in shadow
- A model trained on first-party data enters shadow per Section 29.
- Production stack remains Phase 1 stack until shadow evidence justifies promotion.

**Gates to enter Phase 4 (auto-buy expansion):**
- Inherited from `LARGO_SECURITY_PAYMENTS.md` Section 31 and `LARGO_EVALUATION_PLAN.md` cohort gates.

### Cross-phase principles
- **No skipping a phase.**
- **No marketing-driven phase advancement.**
- **Regression rolls back.** A SEV2 attributable to model returns operations to the prior phase's protocols.

---

## 39. Open questions before implementation

Explicit list of questions this document does not resolve. Each must be resolved (or explicitly deferred with rationale) before the corresponding implementation begins.

1. **V1 concrete specification**: which exact rules, with which thresholds, on which features?
2. **V7a findings resolution**: `ml_available=false` and `confidence=NULL` — root cause and fix priority?
3. **Model registry choice**: MLflow, Weights & Biases, Neptune, or custom?
4. **Calibration recompute cadence**: nightly, weekly, on-snapshot? Trade-off between freshness and stability?
5. **Conformal stratification key**: route alone, or route + cabin + lead time bucket? Trade-off vs. small-cell suppression?
6. **Inference platform**: Modal, Vercel function, dedicated endpoint, edge runtime? (Pinned in B1 — security/payments doc forbids edge for capture, neutral on inference.)
7. **Latency budget enforcement mechanism**: timeout + fallback, or async with cached default?
8. **Action policy implementation**: hand-coded rules, table-driven, or learned? (Phase 1 default: hand-coded; Phase 2 candidate: table-driven.)
9. **Kill-criterion automation level**: human-in-the-loop, auto-rollback for hard breaches?
10. **Shadow-mode infra**: same path as production with branching, or fully separate service?
11. **Reproducibility tolerance**: bit-exact (rare for floats), or numeric tolerance with documented bound?
12. **Per-cohort calibration data thresholds**: what k-anonymity floor for which cohort?
13. **Provider reliability scoring**: Bayesian update with what prior, what window?
14. **Anomaly detector method**: simple z-score Phase 1, IsolationForest Phase 2 — when to migrate?
15. **Monotonicity constraints**: which features, with what direction, on whose authority?
16. **Cross-environment training reproducibility**: V7a's `compare_local_vs_modal.py` showed drift; what tolerance and what triggers a fail?
17. **First-party data sample-size threshold**: what counts as "enough" to train Largo's first first-party model?
18. **LLM in research workflow**: explicit allowed list of tools, with security review?
19. **Model attribution storage cost**: 7-day retention default, but volume might require sampling?
20. **Postmortem template for model incidents**: shared with payment incidents (per `LARGO_SECURITY_PAYMENTS.md`) or separate?

These questions are tracked here so they cannot be silently bypassed.

---

## 40. Document status

- **B0 documentary specification.** No code, no training, no migration, no endpoint, no deployment derived from this document.
- **Aligned with**:
  - `LARGO_DOMINATION_STRATEGY.md` (data > model thesis, calibration as wedge, ABSTAIN as integrity).
  - `LARGO_PRODUCT_VISION.md` (semantic confidence labels customer-facing only; ABSTAIN as product state).
  - `LARGO_ADVICE_CONTRACT.md` v0.1.0 (action enum, `numeric_value` internal-only, `ml_available`, nullable price/provider, `valid_until`).
  - `LARGO_EVALUATION_PLAN.md` (ECE targets, regret anchor V7a $58.33, baselines, public claims policy, cohort gates).
  - `LARGO_SECURITY_PAYMENTS.md` (auto-buy condition stack 10 not overrideable by model; kill switches; SEV ladder).
  - `LARGO_DATA_STRATEGY.md` (snapshot binding, temporal split, leakage prevention, lineage, drift, synthetic data discipline).
- **V7a is the validated baseline**, untouched in B0.
- **V7.6 Ultra is research-only**, untouched in B0; not declared useless; not Phase 1 candidate.
- **Phase 1 model stack** is deliberately small: LightGBM quantile + isotonic + conformal + rule policy + V1 fallback.
- **Append-only forbidden patterns list.** Removal of any entry requires the same level of review as deactivating a kill switch.
- **Open for review by**: founder, future ML/data hire, future external ML reviewer.
- **Next document expected**: `LARGO_BACKEND_API_SPEC.md` (the API surface that produces and consumes `LargoAdvice`, governed by all six prior B0 documents).

---

*End of LARGO_MODEL_STRATEGY.md.*
