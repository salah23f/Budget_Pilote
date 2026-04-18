# Flyeas V7 Predictor Architecture

## Overview

V7 replaces V1's static 4-signal composite (z-score, percentile, trend, TTD) with a
**6-model ensemble** that runs in parallel and is aggregated by a weighted stacking layer.

## Models

### Tier S — Shipped

1. **Kalman Filter** (`kalman.ts`) — State `[price, velocity]` estimated online. Process
   noise scales with 1/TTD. Decision: buy when current price is >1.5σ below fair price.

2. **HMM 6-State Regime** (`hmm-regime.ts`) — Forward algorithm over 6 regimes
   (PLATEAU_HIGH, DESCENT, OPTIMAL_FLOOR, ASCENT, PANIC_LATE, MISTAKE_FARE). Gaussian
   emissions on normalized price level + log-returns. TTD-adjusted transition matrix.

3. **Bayesian Optimal Stopping** (`bayesian-stopping.ts`) — Backward induction on an
   OU-process price model with finite horizon T. Computes a buy-threshold per day; current
   price below threshold → BUY. Parameters (μ, φ, σ) estimated from data.

4. **BOCPD** (`bocpd.ts`) — Adams & MacKay (2007). Conjugate Normal-InverseGamma model
   on log-returns. Posterior over run length. Detects promotions, mistake fares, competitor
   moves in real time.

5. **EVT / Generalized Pareto** (`evt.ts`) — Peaks-Over-Threshold at the 10th percentile.
   PWM estimation of (ξ, σ). Computes return levels (1-in-100 low price) and P(mistake fare).
   Critical for detecting when a price is so low it's likely a flash sale.

6. **Survival Analysis** (`survival.ts`) — Kaplan-Meier on "time to price drop below target".
   Exponential parametric model for forecasting. Answers "how long should I wait?" and
   "what's the probability of improvement in D days?"

### Ensemble

**Weighted stacking** (`ensemble.ts`) — adaptive weights based on TTD, data quality, and
model confidence. Disagreement entropy widens intervals. Outputs: action, confidence,
P(better 7d), P(better before departure), expected floor, CVaR 5%, confidence intervals
at 80/90/95%, regime state, per-model breakdown, natural-language reason, feature importances.

### Conformal Prediction

**Split conformal + CQR** (`conformal.ts`) — distribution-free calibrated intervals.
Wraps ensemble output. Synthetic calibration bootstrap when real data is scarce.

### Simulator

**OU-jump simulator** (`simulator.ts`) — generates realistic 50-route fixture curves with
seasonal components, TTD-dependent volatility, and Poisson jump process for mistake fares.
50 routes calibrated to real airline pricing parameters.

## Architecture

```
Observation → Kalman (state) ──┐
           → HMM (regime) ─────┤
           → BayesStopping ─────┤→ Ensemble → Conformal → Decision + Intervals
           → BOCPD (change) ────┤
           → EVT (tails) ───────┤
           → Survival (timing) ─┘
```

## Feature Flag

`FLYEAS_ALGO_VERSION` env var:
- `v1` (default) — original predictor.ts
- `v7` — V7 ensemble
- `shadow` — both run, V1 returned, V7 logged

Wired into:
- `app/api/missions/[id]/prediction/route.ts`
- `lib/agent/watcher.ts`

## V1 Coexistence

V1 is untouched. V7 lives entirely in `lib/agent/v7/`. No breaking changes to types or
interfaces. V7 output is mapped to V1's `Prediction` shape when returned to existing UI.

## Performance

All models are pure TypeScript math — no external APIs, no LLM calls, fully deterministic.
Target: p95 < 300ms Node. Actual: ~50-150ms for 6 models on 30-100 samples.

## Next: V8 Roadmap

1. **GP Regression** — Gaussian Process price surface with composite kernel
2. **Quantile Regression Forest** — distribution-free quantile forecasting
3. **MCTS** — Monte Carlo Tree Search for multi-step planning
4. **Thompson Sampling** — contextual bandit for policy selection
5. **Online learning** — Bayesian update of model weights from user outcomes
