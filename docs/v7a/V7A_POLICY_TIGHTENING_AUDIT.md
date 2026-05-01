# V7a Policy Tightening Audit

> **Algo Sprint — B1 — `b1/v7a-policy-tightening-audit`** ·
> Documentation-only audit of the V7a recommendation/decision layer.
> Read-only inspection of `reports/v7a_*_local.json` and
> `scripts/train/v7a/*.py`. **No code changes. No training. No Modal.
> No tests run.** This document is the only deliverable.
>
> **Scope:** the *policy* layer of V7a — the rules that turn quantile
> predictions and a calibrated drop probability into one of
> `{ABSTAIN, WAIT, ALERT_SOFT, ALERT_STRONG, BUY_NOW, AUTO_BUY}`. The
> *model* layer (LightGBM quantile + isotonic + conformal Mondrian) is
> diagnosed only insofar as its outputs constrain the policy.

---

## 1. Purpose

V7a is the active ML baseline for Flyeas's price-decision layer. It is
shadow-validated end-to-end (per session memory, 2026-04-25) and is now
the candidate algorithm to drive customer-safe advice surfaced through
Largo. Local evaluation reports show that V7a *predicts* well —
capture-median ≈ 0.88–0.91 versus 0.63 for `buy_now`, and the
conformal coverage hits its nominal target almost exactly — but the
*policy* sitting on top of those predictions is too aggressive: it
triggers BUY_NOW or ALERT on ~98% of rows, abstains on only 0.21%, and
delivers an alert-precision-near-floor of ~3%.

The gap is not accuracy. The gap is **decision discipline**. This
audit identifies where the policy must tighten, lays out concrete
gates, defines the metrics the next sprint must move, and recommends
the smallest safe code change to tighten without retraining a single
model.

---

## 2. Executive Verdict

| Question | Verdict |
|---|---|
| Is V7a's *prediction layer* useful? | **Yes.** Quantile pinball losses are reasonable; conformal coverage is honest (89.99% empirical at α=0.10); drop-probability ECE after isotonic calibration is ~0. |
| Is V7a's *policy layer* safe today? | **No.** BUY_NOW share = 44% (`v7a_ml_only`) or 49% (`v7a_hybrid`); ALERT share ≈ 53%; ABSTAIN ≈ 0.21%. The hard ABSTAIN gate (`width_over_price > 5.0`) is so loose it almost never fires. |
| Is the alert layer actionable? | **No.** `alert_precision_floor_1_05` ≈ 0.031 globally; `regret_realized_after_alert_mean` = $226. A user buying at alert time would still leave $226 on the table on average. |
| Best variant for product safety, **today**? | **`ensemble_ttd_switch`** — best capture_median (0.911), best p50 regret ($13), and *no policy aggressiveness* because it is a deterministic TTD-segmented baseline. |
| Best variant for *learning capacity*, **today**? | **`v7a_hybrid`** — slightly lower mean regret than `v7a_ml_only`, slightly tighter p99, but only with policy tightening can it surpass `ensemble_ttd_switch` on safety. |
| Add more probabilistic / deep models now? | **No.** The cheap, high-leverage win is policy tightening on existing predictions. DeepAR / TFT / MAML are premature. |
| Ready for shadow mode? | **Yes**, with mandatory abstain on wide intervals and unknown routes. |
| Ready for real auto-buy? | **No.** Not at any threshold today. Real auto-buy requires `alert_precision_floor_1_05 ≥ 0.20`, BUY_NOW share ≤ 10%, and ABSTAIN ≥ 5%. |

---

## 3. Files and Reports Inspected

### Reports (read-only)

| Path | Purpose |
|---|---|
| `reports/v7a_backtest_local.json` | global + per-variant decision metrics on the 149,937-row test split |
| `reports/v7a_segmented_metrics_local.json` | TTD-segmented metrics for `v7a_ml_only` and `v7a_hybrid` |
| `reports/v7a_conformal_metrics_local.json` | per-bucket conformal coverage, width, buy-trigger rate at α∈{0.05, 0.10, 0.20}; isotonic calibration of drop probability |
| `reports/v7a_baselines_local.json` | global + by-TTD metrics for `buy_now`, `fixed_horizon_14`, `rolling_min_30`, `simple_quantile_10`, `v1_heuristic`, `ensemble_ttd_switch` |
| `reports/v7a_lgbm_metrics_local.json` | pinball / MAE / coverage for target-A (gain) and Brier / logloss for target-B (drop) |
| `reports/v7a_target_build_local.json` | row counts and target descriptive stats per train / val / cal / test split |
| `reports/v7a_dataset_sampling_report_local.json` | 25× systematic sampling QA — 82M → 3.3M rows, 235 routes, L1 marginal distance ≤ 3e-6 |

### Source files (read-only)

| Path | Purpose |
|---|---|
| `scripts/train/v7a/policy.py` | `PolicyContext` + `classify` decision function; current thresholds |
| `scripts/train/v7a/backtest.py` (first 200 lines) | hold-out evaluation pipeline; honest alert metrics; bucketed conformal lookup |
| `scripts/train/v7a/calibrate.py` (first 120 lines) | conformal Mondrian on residuals + isotonic on drop probability |

The remaining V7a scripts (`lgbm_quantile.py`, `features.py`, `split.py`,
`build_target.py`, `audit_leakage.py`, `baselines.py`, `build_dataset.py`,
`scripts/cloud/v7a/run_v7a_modal.py`) were not opened in this audit
because the policy-tightening question can be fully answered from the
three above plus the seven JSON reports. None of them is touched.

No file was written, edited, formatted, staged, or otherwise mutated.

---

## 4. Current V7a Performance Summary

### 4.1 Sample size

149,937 test rows over 11,750 distinct trajectories (route × depart-date).
The "buy" metrics are evaluated per trajectory; the "alert" metrics are
evaluated per row. TTD distribution is 0-7 (15.6% of rows), 8-21 (29.5%),
22-60 (54.8%), 61+ (empty — no rows).

### 4.2 Quantile model (target A — future gain)

| Split | pinball_10 | pinball_50 | pinball_90 | MAE q50 | coverage 10–90 |
|---|---|---|---|---|---|
| train_oof | 28.34 | 30.79 | 11.99 | 61.58 | — |
| val | 9.27 | 25.54 | 14.73 | 51.07 | 0.823 |
| cal | — | — | — | 53.43 | 0.827 |

The 10–90 in-sample coverage hits ~82% (target 80%) — the quantile
heads themselves are slightly *over*-covering. After conformal
expansion to 90% nominal, marginal coverage = **0.8999952** — an
essentially exact hit.

### 4.3 Drop-probability model (target B)

| Split | Brier | logloss | base_rate | proba_mean |
|---|---|---|---|---|
| val | 0.124 | 0.396 | 0.771 | 0.709 |
| cal | 0.130 | 0.410 | 0.756 | 0.712 |

Pre-isotonic ECE = 0.065. Post-isotonic ECE = ~0 (1.9e-17). Calibration
is healthy across the eight 0.1-wide buckets above 0.2; below 0.2 the
isotonic fit produces tightly-overlapping bins.

### 4.4 Decision metrics — global

| Variant | regret_mean | regret_p50 | regret_p90 | regret_p99 | capture_med | n |
|---|---|---|---|---|---|---|
| **v7a_ml_only** | 49.20 | 19.50 | 133.01 | 373.51 | 0.888 | 11,750 |
| **v7a_hybrid** | 47.37 | 22.00 | 125.39 | 324.71 | 0.873 | 11,750 |
| buy_now | 137.58 | 89.16 | 343.25 | 708.29 | 0.626 | 11,750 |
| fixed_horizon_14 | 126.80 | 79.03 | 319.01 | 658.05 | 0.652 | 11,750 |
| rolling_min_30 | 65.78 | 24.01 | 187.49 | 444.51 | 0.868 | 11,750 |
| simple_quantile_10 | 66.96 | 20.01 | 199.98 | 526.63 | 0.873 | 11,750 |
| v1_heuristic | 81.56 | 33.00 | 230.00 | 558.76 | 0.814 | 11,750 |
| **ensemble_ttd_switch** | **58.33** | **12.98** | 176.09 | 482.57 | **0.911** | 11,750 |

### 4.5 Action distribution

| Action | v7a_ml_only | v7a_hybrid |
|---|---|---|
| BUY_NOW | 66,002 (44.0%) | 74,134 (49.4%) |
| ALERT_STRONG | 68,801 (45.9%) | 64,047 (42.7%) |
| ALERT_SOFT | 11,765 (7.8%) | 8,566 (5.7%) |
| WAIT | 3,049 (2.0%) | 2,870 (1.9%) |
| ABSTAIN | 320 (0.21%) | 320 (0.21%) |
| AUTO_BUY | 0 | 0 |

The fact that ABSTAIN is the same 320 in both variants comes from the
single hard gate (`route_known=false`) firing identically in both;
neither variant ever hits the width-based ABSTAIN because the threshold
`WIDTH_RATIO_ABSTAIN = 5.0` is far above the empirical width-over-price
mean of ~1.05.

### 4.6 Alert metrics

| Metric | v7a_ml_only | v7a_hybrid |
|---|---|---|
| alert_rate | 0.5373 | 0.4843 |
| alert_precision_floor_1_05 | **0.0310** | **0.0244** |
| alert_precision_floor_1_10 | 0.0409 | 0.0328 |
| alert_recall_floor_1_05 | 0.9768 | 0.9802 |
| regret_realized_after_alert_mean | $226.03 | $242.57 |
| regret_realized_after_alert_p90 | $423.62 | $433.59 |
| alert_precision_legacy_future_lower | **0.9928** ⚠️ misleading | **0.9998** ⚠️ misleading |
| alert_too_early_rate | 0.0488 | 0.0497 |
| alert_too_late_rate | 0.0000 | 0.0000 |

**Interpretation:** The legacy metric `alert_precision_legacy_future_lower`
≈ 0.99 is meaningless: it just measures "did the price ever go below
the alert price afterwards?" In a market where 71–82% of rows have a
future price drop, that metric saturates near 1.0. The honest metric is
`alert_precision_floor_1_05` = 3.1% — out of every 100 alerts, only ~3
fire when the price is within 5% of the route floor. The other ~97 are
noise.

### 4.7 Conformal coverage and width

| α | coverage_marginal | width_mean | width_over_price_mean | buy_trigger_rate |
|---|---|---|---|---|
| 0.05 | 0.9500 | $313.78 | 1.43 | 0.679 |
| 0.10 | 0.9000 | $230.64 | **1.05** | 0.580 |
| 0.20 | 0.8000 | $161.35 | 0.73 | 0.477 |

At the operating α=0.10, the conformal interval **width is wider than
the price itself** on average. The "buy trigger" — the share of rows
where the lower bound `q50_gain - c_α` is above zero — is 58%. That's
why BUY_NOW share is so high: the policy uses `q50_gain + c_α ≥ 0` as
its stopping rule, and a $230-wide interval centred near zero almost
always satisfies that.

The per-bucket width in the sparsest cell `0-2-1` is $575 (alpha=0.10);
in the densest cell `2-2-2` it is $205. The buy_trigger_rate in the
sparse cell is **89%** — exactly the wrong direction.

---

## 5. Baseline Comparison

`ensemble_ttd_switch` is a deterministic stitch:
- TTD 0–7  → `rolling_min_30` (capture 0.950, regret_mean $71)
- TTD 8–21 → `simple_quantile_10` (capture 0.899, regret_mean $77)
- TTD 22–60 → `simple_quantile_10` (capture 0.913, regret_mean $45)

| Variant | Strength | Weakness |
|---|---|---|
| `buy_now` | trivial; no model | regret $138, capture 0.63 |
| `fixed_horizon_14` | trivial alternative | barely beats `buy_now` ($127) |
| `rolling_min_30` | strong on short TTD (0-7 capture 0.95) | weaker on 22-60 ($60 vs $45 for quantile) |
| `simple_quantile_10` | best single baseline on 22-60 | weak on 0-7 (capture 0.81) |
| `v1_heuristic` | older deterministic policy | worst non-trivial baseline |
| `ensemble_ttd_switch` | **best capture (0.911), best p50 regret ($13)** | not adaptive — no probability, no per-route signal |
| `v7a_ml_only` | best regret_mean ($49); honest probabilistic outputs | aggressive policy: BUY 44%, ABSTAIN 0.2%; alert_precision_05 = 3% |
| `v7a_hybrid` | best regret_mean ($47.4); slightly tighter p99 | aggressive policy: BUY 49%, ALERT 49% |

**Key finding:** `ensemble_ttd_switch` and `v7a_ml_only` end up at
similar `regret_abs_mean` ($58 vs $49), but the ensemble achieves it
*by being deterministic and conservative*, while V7a achieves it *by
firing BUY everywhere*. The two paths look comparable on global means
yet are very different in safety: the ensemble's BUY decisions are
backed by an interpretable rule (current price ≤ Q10 of train), while
V7a's BUY decisions are backed by a wide conformal lower bound being
positive — a much weaker signal.

---

## 6. BUY_NOW Policy Diagnosis

### 6.1 Is BUY_NOW too aggressive?

**Yes.** The current rule is:

```
BUY_NOW   ⇔   q50_gain + α(ttd) · c_alpha  ≥  0
              where α(ttd) = 1.0 if ttd ≤ 21, 0.3 if ttd > 21
```

Translated: "buy when the lower bound of expected future gain is at
least zero". With `c_alpha` ≈ $115 (half of width $230) at α=0.10, that
threshold tolerates `q50_gain` as negative as **−$115** on short TTD
and as negative as **−$35** on long TTD. The model literally
predicts the future price will drop and BUY_NOW still fires.

### 6.2 BUY_NOW share

| Variant | n_buy | share | mean of `q50_gain + c_alpha` at trigger |
|---|---|---|---|
| v7a_ml_only | 66,002 | 44.0% | $88.94 |
| v7a_hybrid | 74,134 | 49.4% | $83.67 |

The "trigger margin" mean is $84–89, but its lower tail extends well
into negative territory because `c_alpha` is large. A target trigger
margin of ≥ +$20 (instead of ≥ $0) would cut BUY share substantially —
this is one of the cheapest gates to add.

### 6.3 Is `regret_abs_p90` acceptable?

| Bucket | regret_p90 | regret_p99 |
|---|---|---|
| Global v7a_ml_only | $133 | **$374** |
| Global v7a_hybrid | $125 | **$325** |

For shadow mode: p90 ≈ $125 is acceptable. For real auto-buy: a 1-in-100
trip costing the user $325–$374 of unnecessary spend is **not**
acceptable. A safe target for auto-buy is `regret_abs_p99 ≤ $200`.

### 6.4 Riskiest segments (by TTD) — `v7a_ml_only`

| Bucket | n trips | regret_mean | regret_p99 | capture_median |
|---|---|---|---|---|
| 0-7 | 2,682 | 52.97 | 295.35 | 0.940 |
| 8-21 | 4,304 | 50.76 | 294.18 | 0.880 |
| 22-60 | 6,835 | **46.83** | **427.79** | 0.908 |

The 22-60 bucket has the **lowest mean regret** but the **highest p99
regret** — the policy occasionally makes large mistakes on long-horizon
trips. This is consistent with the H1 correction in `policy.py`
(`α(ttd) = 0.3 for ttd > 21`) only partially solving the problem.

### 6.5 Should BUY_NOW be allowed only under strict gates?

**Yes.** Concretely:
- Require trigger margin ≥ +$20 instead of ≥ 0.
- Require `width_over_price ≤ 0.50` (currently 1.05 globally — half the rows fail this).
- Require `drop_proba_calibrated ≤ 0.30` (currently no upper-bound on drop_proba at BUY time — the policy will BUY_NOW even when drop_proba=0.95, which is contradictory).
- Require `route_popularity ≥ 100`.
- Require `ttd_days ≥ 3`.

These five gates compound: BUY_NOW share would fall from 44% to an
estimated **8–12%** based on the per-bucket buy_trigger_rates in the
conformal report (0-2-1 rows with high width and rare-route would no
longer pass).

---

## 7. ALERT Policy Diagnosis

### 7.1 Why is `alert_rate` too high?

Current rule:

```
ALERT_STRONG  ⇔  drop_proba_calibrated · ttd_weight  ≥  0.75
ALERT_SOFT    ⇔  drop_proba_calibrated · ttd_weight  ≥  0.55
```

with `ttd_weight ∈ {0.1, 0.6, 1.0, 0.3}` based on TTD bands. The
calibrated drop-probability has a **base rate of 0.756** on the
calibration set. So a threshold at 0.55–0.75 fires on the majority of
rows, producing a 53% global alert rate — that is *expected* given how
"likely a 10% drop is" in the underlying market, not a model failure
per se. It's a **threshold mismatch** between "is a drop likely?"
(yes, 76% of the time) and "is this an actionable alert?" (rarely).

### 7.2 Why is `alert_precision_floor_1_05` low?

The current alert objective is **"will price drop ≥ 10% in the
window?"** — not **"is the current price near the route floor?"**
These are *different* questions. A trip can have an 80% probability of
dropping 10% *and* be far from its route floor. Alerts based on the
former will fire on rows nowhere near the floor, hence a 3% precision
on the floor metric.

### 7.3 Why is `alert_precision_legacy_future_lower` misleading?

That metric measures "did the price ever go below the alert price
afterwards?". With a market where 71–82% of trajectories see a drop,
this is essentially measuring volatility, not alert quality. **Stop
reporting this metric on the dashboard.** Keep it in the JSON for
diff-tracking only.

### 7.4 New alert objective

The alert should answer the customer-relevant question:

> "If you buy at this price now, what is the probability that the
> realized regret vs the trajectory floor is small?"

Operationally:

```
ALERT  ⇔  drop_proba_calibrated ≥ 0.55
      AND price ≤ q10_train_route × 1.05      (price already near floor)
      AND width_over_price ≤ 0.50              (uncertainty is bounded)
      AND not duplicated within 24h             (deduplication)
      AND ttd_days in [3, 60]                   (in-distribution)
```

### 7.5 Reducing noise while preserving useful recall

The trade-off is published already in the conformal report: at α=0.20,
the buy_trigger_rate in the dense bucket `2-2-2` falls to 53% (from
89% at the sparse `0-2-1`). The same bucket-aware tightening logic
must be applied to the alert layer:
- For `seg_freq = sparse` (route_popularity < 50): require
  `drop_proba_calibrated ≥ 0.85` and `width_over_price ≤ 0.40`.
- For `seg_freq = dense`: keep current threshold but add the floor and
  width gates above.

Expected effect (from per-bucket buy_trigger_rate ratios): alert_rate
falls from 53% to ~15–20%, alert_precision_floor_1_05 rises from 3% to
~15–25%, alert_recall_floor_1_05 falls from 98% to ~60–70%. That is the
trade we want.

---

## 8. Uncertainty and Calibration Diagnosis

### 8.1 Conformal coverage

At α=0.10, marginal coverage is **0.8999952** — calibration is
essentially exact. Per-bucket coverage ranges from 0.8990 (`0-2-1`,
n=109) to 0.9000 (`2-2-2`, n=164,769). Mondrian binning by
(TTD × pop × volatility) is doing its job: the small buckets remain
within ±0.001 of nominal.

### 8.2 Width interpretation

| α | width_mean | width_over_price_mean |
|---|---|---|
| 0.05 | $313.78 | **1.43** |
| 0.10 | $230.64 | **1.05** |
| 0.20 | $161.35 | 0.73 |

At α=0.10 the interval width is, on average, **larger than the price
itself**. This is honest — it reflects the genuine uncertainty over
"future gain in USD" given a target with mean −$127 and p99 swings up
to $700+. But for a *decision* layer, an interval that spans more than
the price is not actionable: the policy can satisfy
`q50_gain + c_α ≥ 0` while the actual outcome ranges from −$200 to
+$30, which makes BUY_NOW a coin flip.

### 8.3 Why good coverage with wide intervals is not enough

Coverage measures *whether the truth is inside the interval*. It says
nothing about *whether the interval is small enough to act on*. A
$500-wide interval that covers 90% of outcomes is technically
calibrated and operationally useless. BUY_NOW based on the lower bound
of such an interval being above zero is equivalent to BUY_NOW under
maximum tolerance for being wrong.

### 8.4 Proposed uncertainty gates

| Gate | Current | Proposed | Rationale |
|---|---|---|---|
| max conformal width (USD) | none | $200 (TTD ≤ 21), $300 (TTD > 21) | absolute cap on uncertainty before BUY |
| max width_over_price | 5.0 (ABSTAIN gate) | **0.50** (BUY/ALERT gate); 1.0 (ABSTAIN) | tighten by 5× — the current threshold is essentially decorative |
| min calibrated drop_proba (BUY) | none | **≤ 0.30** | don't BUY when model says drop is likely |
| min calibrated drop_proba (ALERT) | 0.55 / 0.75 | 0.55 / 0.85 (sparse buckets) | preserve current strong threshold; raise on sparse routes |
| min route support (n train rows) | implicit via `route_known` | **≥ 100** | rare routes have unreliable c_α |
| TTD-specific gate | α(ttd)=0.3 above 21d | additional: `ttd ∈ [3, 60]` else ABSTAIN | extremes are out-of-distribution (no 61+ data) |

---

## 9. Segment-Level Findings

### 9.1 Per-TTD alert behaviour (`v7a_ml_only`)

| Bucket | n_rows | alert_rate | precision_05 | precision_05_strong | regret_after_alert_mean |
|---|---|---|---|---|---|
| 0-7 | 23,440 | 16.5% | 1.7% | 4.3% | $307 |
| 8-21 | 44,281 | 44.1% | 3.4% | 3.1% | $264 |
| 22-60 | 82,216 | **69.5%** | 4.8% | 3.2% | $198 |

The 22-60 bucket is **the worst alert-volume offender**: 70% of rows
fire an alert. Yet `precision_05_strong` is only 3.2% there. The
model is essentially saying "drops are likely on long-horizon trips" —
which is true on average (target_future_drop_rate ≈ 0.71 on test) but
useless as an action signal.

### 9.2 Per-conformal-bucket BUY trigger (α=0.10)

| Bucket | n | width_mean | buy_trigger_rate |
|---|---|---|---|
| 0-2-1 (sparse, low-vol, short TTD) | 109 | $575.75 | **0.890** |
| 0-2-2 (sparse, high-vol, short TTD) | 39,212 | $301.59 | 0.723 |
| 1-2-1 (mid-pop, low-vol, mid TTD) | 298 | $446.96 | 0.735 |
| 1-2-2 (mid-pop, high-vol, mid TTD) | 87,968 | $243.68 | 0.598 |
| 2-2-1 (dense, low-vol, mid TTD) | 580 | $448.60 | 0.712 |
| 2-2-2 (dense, high-vol, mid TTD) | 164,769 | $205.40 | 0.535 |

The lowest trigger rate (53%) is in the densest, highest-volatility
bucket — exactly the bucket where the model is most informed. The
sparsest bucket (89% trigger rate, n=109) is where it should be most
cautious.

### 9.3 Data-quality red flags

- TTD bucket `61+` has **zero rows** in train, val, cal, and test.
  Any production deployment must ABSTAIN on TTD > 60.
- The dataset spans only **2022-04 to 2022-10** — no winter, no 2023+,
  no 2024+. Temporal drift is unmeasured.
- `target_future_drop_rate` has dropped from 82% (train) → 71% (test).
  This is a non-trivial label-distribution shift that the calibration
  step partially addresses but does not eliminate.
- All routes are LAX-hub heavy. Performance on non-LAX or international
  routes is **unknown**.

---

## 10. Recommended Tightened Policy Gates

Concrete proposed gates. Numbers are starting points for the next
sprint's threshold sweep — not values to ship blind.

### BUY_NOW (allowed only if all true)

- `route_known == True`
- `route_popularity ≥ 100`
- `ttd_days ≥ 3`
- `ttd_days ≤ 60`
- `width_over_price ≤ 0.50`
- `q50_gain + α(ttd) · c_alpha ≥ +20`  (tightened from ≥ 0)
- `drop_proba_calibrated ≤ 0.30`  (NEW — refuse to BUY when drop is likely)
- `feat_route_known == True` AND no leakage warning flag
- (Optional) `current_price ≤ q10_train_route × 1.10`  (defensive ceiling)

Expected effect: BUY_NOW share ↓ from 44% → 8–12%.

### ALERT_STRONG (allowed only if all true)

- `drop_proba_calibrated ≥ 0.75` (unchanged threshold)
- `current_price ≤ q10_train_route × 1.05`  (NEW — must be near the floor)
- `width_over_price ≤ 0.50`
- `route_popularity ≥ 50`
- `ttd_days ∈ [3, 60]`
- Not duplicated for the same `(route, depart_date)` within the last 24h
- After backtest tuning: `alert_precision_floor_1_05 ≥ 0.20` on the held-out test
  (else lower threshold or add stricter gate)

### ALERT_SOFT (advisory; same as STRONG but)

- `drop_proba_calibrated ≥ 0.55`
- `current_price ≤ q10_train_route × 1.10`  (looser proximity)
- All other gates same as STRONG except `alert_precision_floor_1_10 ≥ 0.20`

### MONITOR (NEW first-class action; today silently absorbed by ALERT_SOFT/WAIT)

- `drop_proba_calibrated ≥ 0.40` AND `< 0.55` (uncertain band)
- `ttd_days ≥ 14`
- `width_over_price ≤ 0.75`
- Route is known and supported
- → Customer-facing message: "We're watching this route; we'll let you know."

### WAIT (default catch-all)

- Triggered when no BUY / ALERT / MONITOR / ABSTAIN gate fires.

### ABSTAIN (allowed only if at least one is true — TIGHTENED)

- `route_known == False`
- `route_popularity < 30`
- `width_over_price > 1.0`  (TIGHTENED from 5.0)
- `ttd_days < 1` OR `ttd_days > 60`
- `drop_proba_calibrated ∈ [0.40, 0.60]` AND `width_over_price > 0.6` (model unsure + interval wide)
- Feature-pipeline integrity flag is set (leakage warning)
- Out-of-distribution route (e.g. non-2022 calendar context, non-LAX hub if model trained only on LAX)

Expected effect: ABSTAIN share ↑ from 0.21% → 5–10%.

### AUTO_BUY (locked off in production until further notice)

- Hard-gated to `False` regardless of any score until the next sprint
  shows `alert_precision_floor_1_05 ≥ 0.20` AND BUY_NOW share ≤ 10%
  AND `regret_abs_p99 ≤ $200`.

---

## 11. Metrics to Optimize Next

The next sprint's policy-tuning script must move these numbers, in
priority order. Targets are aspirational; the sweep will surface the
Pareto frontier.

| Metric | Current | Target (next sprint) | Auto-buy gate |
|---|---|---|---|
| `alert_precision_floor_1_05` | 0.031 | **≥ 0.15** | ≥ 0.20 |
| `alert_precision_floor_1_10` | 0.041 | ≥ 0.25 | ≥ 0.35 |
| `alert_rate` | 0.537 | ≤ 0.25 | ≤ 0.15 |
| `alert_recall_floor_1_05` | 0.977 | ≥ 0.55 | ≥ 0.45 |
| `regret_abs_mean` | $49.2 | ≤ $60 | ≤ $50 |
| `regret_abs_p90` | $133 | ≤ $150 | ≤ $130 |
| `regret_abs_p99` | $374 | ≤ $300 | **≤ $200** |
| `capture_median` | 0.888 | ≥ 0.85 | ≥ 0.85 |
| **abstain_rate** | 0.0021 | **≥ 0.05** | ≥ 0.05 |
| **monitor_rate** | n/a | introduce; ≥ 0.10 | ≥ 0.10 |
| **BUY_NOW share** | 0.440 | ≤ 0.20 | ≤ 0.10 |
| ECE by TTD bucket (target B) | ≤ 0.001 | ≤ 0.05 (already met) | unchanged |
| conformal width_p90 by TTD | not reported | report it | `width_over_price ≤ 0.50` for ≥ 80% rows |

Two metrics to *deprecate* from the production dashboard (keep in
JSON only for archival):

- `alert_precision_legacy_future_lower` — saturated, uninformative.
- `alert_too_late_rate` — currently always 0.0; not informative until window logic changes.

---

## 12. Probabilistic and Stochastic Model Roadmap

The audit's strong recommendation: **do not add models. Tighten the
policy on existing models first.** The current LightGBM quantile +
isotonic + conformal stack is already accurate enough for the question
"is the floor near?". The bottleneck is decisions, not predictions.

| Idea | When to add | Why now / not now |
|---|---|---|
| **Threshold-sweep policy tuning** | **Next sprint (3.7-equivalent)** | Cheapest, no retraining, biggest expected lift on alert_precision_floor_1_05 |
| Bucket-aware (Mondrian) thresholds | Same sprint | Already have bucketed `c_alpha`; reuse the bucket key for `BUY_THRESHOLD`, `ALERT_THRESHOLD` |
| Cross-validation+ / jackknife+ conformal | Sprint after policy tuning | Replaces split conformal; tighter intervals on small buckets at the cost of compute |
| Bayesian quantile regression on rare buckets | After CV+ | Only useful for `seg_freq=sparse` cells; ~10% of rows |
| Hidden Markov Model (HMM) on regime | Phase 2 (months later) | Useful for "fare-war" regimes; needs longer time series than 2022-Apr-to-Oct |
| Bayesian Online Change-Point Detection (BOCPD) | Phase 2 | Same horizon constraint as HMM |
| Monte-Carlo trajectory simulation | Phase 2 | Lets us answer "if I wait k days, distribution of regret"; needs trajectory model |
| Gaussian Process on residuals | Skip | Doesn't scale to 2.2M train rows; quantile LightGBM already near optimal on this data |
| **DeepAR / TFT** | Skip until Phase 3 | Modest predictive gains likely; massive operational cost; *zero* effect on the policy aggressiveness problem |
| **MAML / meta-learning** | Skip until Phase 3 | Premature; dataset has 235 routes — not enough task diversity to justify |

**Crisp principle.** Adding more probabilistic / deep models *cannot*
reduce BUY_NOW share or raise alert_precision_floor_1_05 unless the
decision layer is tightened first. The policy is upstream of model
choice in terms of impact-per-engineering-hour.

---

## 13. Modal / Compute Recommendation

- Modal CLI is **not installed** in the user's local terminal (per
  earlier session check; absence of `modal` on PATH).
- The next sprint **does not need** Modal: policy tuning is a pure
  evaluation of cached LightGBM predictions on the test parquet
  (`data/models_v7a_local/lgbm_test.parquet` per `backtest.py` line
  129) and the existing `conformal_mondrian.json`. No GPU, no
  retraining, no cloud job.
- Modal becomes useful only when:
  - re-training LightGBM on more recent data (2023+, 2024+) — Phase 2;
  - running CV+ / jackknife+ conformal at scale — Phase 2;
  - exploring HMM / BOCPD / DeepAR on extended history — Phase 3.
- **Decision rule:** do not introduce Modal as a dependency for the
  next sprint. Re-evaluate after the policy-tuning report shows what
  *needs* recomputation.

---

## 14. Product Readiness Decision

| Surface | Ready? | Conditions |
|---|---|---|
| **Shadow-mode recommendations** (log advice; never act) | **YES** | with mandatory ABSTAIN on `width_over_price > 1.0` and on `route_known=False`; output goes to log only |
| **User-facing non-transactional advice** (Largo-style customer-safe card) | **CONDITIONAL** | only via the customer-safe pipeline (already built, customer-safe validators in place); ABSTAIN must surface as "Confidence unavailable"; never display BUY_NOW until next sprint's gates are in place |
| **Auto-buy *simulation*** (offline only) | **YES** | useful for sweep evaluation; results never reach production |
| **Real auto-buy** | **NO — hard NO** | none of: `alert_precision_floor_1_05 ≥ 0.20`, BUY_NOW share ≤ 10%, `regret_abs_p99 ≤ 200`. Until *all three* are met *plus* a separate human-review checkpoint, AUTO_BUY remains hard-gated to `False` in `policy.py`. |

**Strict line:** any production wiring of V7a → user-visible BUY/ALERT
must wait until the policy-tuning sprint (next item) lands and a
follow-up review approves. Customer-safe shadow advice can ship before.

---

## 15. Recommended Next Implementation Sprint

**Sprint name:** Algo Sprint — V7a policy tightening (offline tuning).

| Field | Value |
|---|---|
| Branch name | `b1/v7a-policy-tightening` |
| Demo or prod-visible? | **Offline only** — no app code, no Largo, no API change |
| Touches backend? | **No** |
| Requires Modal? | **No** |
| Requires retraining? | **No** |

### Files to **create** (new, isolated)

| Path | Purpose |
|---|---|
| `scripts/train/v7a/policy_tune.py` | Threshold-sweep evaluator; parameterized over `WIDTH_RATIO_ABSTAIN`, `WIDTH_RATIO_BUY`, `BUY_THRESHOLD`, `BUY_TRIGGER_MARGIN`, `DROP_PROBA_BUY_MAX`, `ALERT_THRESHOLDS`, `ROUTE_POPULARITY_MIN`, `TTD_GATE`. For each candidate config, recomputes the policy decisions on the cached `lgbm_test.parquet` + `conformal_mondrian.json`, runs the same backtest metrics, and writes a row to a comparison JSON. **Reads only existing artifacts; writes only `reports/v7a_policy_tuning_local.json`.** |
| `reports/v7a_policy_tuning_local.json` | (output) array of {config, metrics} pairs over the candidate grid |
| `tests/v7a/test_policy_tune.py` | (optional) light smoke test that the sweep runs on a 1-row stub config and produces deterministic output |

### Files **NOT** to modify (deny-list for that sprint)

- `scripts/train/v7a/policy.py` (the production policy stays frozen this sprint — only the *tuning script* explores variants in-memory; do not rewrite `classify`)
- `scripts/train/v7a/backtest.py`
- `scripts/train/v7a/calibrate.py`
- `scripts/train/v7a/lgbm_quantile.py`
- `scripts/train/v7a/build_*` and `audit_leakage.py`
- `scripts/cloud/v7a/run_v7a_modal.py`
- `data/**`, `models/**`, `reports/v7a_*_local.json` (existing reports) — read only
- `app/**`, `components/**`, `lib/**`, `types/**`, `tests/**` (except the new `tests/v7a/test_policy_tune.py`), `contracts/**`, `supabase/**`, `.github/**`, `.claude/**`, `package.json`, `tsconfig.json`, `next.config.js`, `vercel.json`, `.env*`, `README.md`, `STATUS.md`

### Sweep grid (starting point)

```python
WIDTH_RATIO_ABSTAIN  ∈ {0.6, 1.0, 1.5, 2.0}      # currently 5.0
WIDTH_RATIO_BUY      ∈ {0.40, 0.50, 0.75}        # NEW gate
BUY_TRIGGER_MARGIN   ∈ {0, 10, 20, 30}            # currently 0
DROP_PROBA_BUY_MAX   ∈ {None, 0.40, 0.30, 0.25}  # NEW gate
ALERT_DROP_THRESHOLD ∈ {0.55, 0.65, 0.75, 0.85}
ALERT_NEAR_FLOOR_PCT ∈ {1.05, 1.10, 1.15}        # NEW gate
ROUTE_POPULARITY_MIN ∈ {30, 50, 100}             # NEW gate
TTD_LOWER            ∈ {1, 3, 7}                 # NEW gate
TTD_UPPER            ∈ {45, 60}                  # already empty above 60
```

Cardinality: 4 × 3 × 4 × 4 × 4 × 3 × 3 × 3 × 2 = **41,472 configs**.
Pure-Python evaluation on 149,937 rows takes ~3 ms/config worst case
once `lgbm_test.parquet` is loaded; the sweep finishes in
≈ 2 minutes locally, no Modal.

### Output schema

```json
{
  "config": { ... grid coords ... },
  "metrics": {
    "buy_now_share": 0.12,
    "alert_rate": 0.18,
    "alert_precision_floor_1_05": 0.21,
    "alert_recall_floor_1_05": 0.62,
    "regret_abs_mean": 53.4,
    "regret_abs_p90": 142.0,
    "regret_abs_p99": 245.0,
    "capture_median": 0.872,
    "abstain_rate": 0.078,
    "monitor_rate": 0.131
  }
}
```

### Selection rule

After the sweep, pick the Pareto frontier on
`(alert_precision_floor_1_05, regret_abs_p99, abstain_rate)`. The
chosen config becomes the proposal for a subsequent (gated) PR that
edits `policy.py` thresholds — that PR is **not** the next sprint, it's
the one after.

---

## 16. Non-Goals

- **No code changes outside this file.** No edits to `policy.py`,
  `backtest.py`, or any V7a script in this audit sprint.
- **No retraining.** All inferences in this audit are from cached JSON
  reports.
- **No Modal usage.** No cloud jobs, no install of the Modal CLI.
- **No Largo coupling.** This audit is independent of the Largo
  customer-safe UI work tracked separately on `b1/largo-*` branches.
- **No reliance on the dirty working tree.** Pre-existing modifications
  under `scripts/cloud/**`, `.github/workflows/**`, `docs/**`, `logs/**`,
  `reports/**`, `data/**`, `models/**` are untouched and explicitly
  out of scope.
- **No invocation of any auto-suggested skill.** Convergence-mode
  discipline: parallel findings noted, never opened.
- **No tests run.** `npm test`, `pytest`, `tsx`, and any custom
  harness are not invoked.
- **No commit, no push, no PR** by Claude. Git operations stay
  user-controlled.

---

## 17. Files Created or Modified

| Path | Action |
|---|---|
| `docs/v7a/V7A_POLICY_TIGHTENING_AUDIT.md` | **created** (this file) |

No other path in the working tree was modified by this sprint.

---

*End of V7a Policy Tightening Audit — `b1/v7a-policy-tightening-audit`.*
