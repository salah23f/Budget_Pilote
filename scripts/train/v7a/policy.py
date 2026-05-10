"""
v7a/policy.py — V7a decision policy, Balanced V2 (strict).

Selected candidate from docs/v7a/V7A_POLICY_SWEEP_V2_RESULTS.md.
Sprint: b1/v7a-policy-apply-balanced-v2.

Actions (ordered): ABSTAIN → BUY_NOW → ALERT → MONITOR → WAIT.
AUTO_BUY is hard-locked off in Phase 1.

Score mapping:
  score_alert  = ctx.drop_proba (calibrated probability)
  score_buy    = q50_gain + alpha(ttd) * c_alpha_gain (raw trigger, USD)
  score_autobuy = 0.0 (disabled)
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))
from _env import log  # noqa: E402


# =============================================================================
# Balanced V2 thresholds — docs/v7a/V7A_POLICY_SWEEP_V2_RESULTS.md
# =============================================================================

MAX_WIDTH_OVER_PRICE = 1.50          # BUY/ALERT width gate
ABSTAIN_WIDTH_OVER_PRICE = 2.00      # ABSTAIN width gate
BUY_TRIGGER_MARGIN_USD = 20.0        # buy_trigger >= margin to fire BUY_NOW
DROP_PROBA_BUY_MAX = 0.25            # BUY_NOW only if drop_proba <= this
ALERT_DROP_THRESHOLD = 0.95          # ALERT requires drop_proba >= this
ALERT_NEAR_FLOOR_PCT = 1.01          # ALERT requires price <= q10_train * pct
ROUTE_POPULARITY_MIN = 30            # ABSTAIN if route_popularity < this
TTD_LOWER = 5                        # ABSTAIN if ttd < this
TTD_UPPER = 90                       # ABSTAIN if ttd > this

# MONITOR band constants
MONITOR_DROP_PROBA_MIN = 0.30        # MONITOR requires drop_proba >= this
MONITOR_TTD_MIN = 7                  # MONITOR requires ttd >= this
MONITOR_WIDTH_OVER_PRICE_MAX = 0.50  # MONITOR requires width_over_price <= this


# =============================================================================
# Data classes
# =============================================================================

@dataclass
class PolicyContext:
    price: float
    q10_gain: float              # gain futur quantile 10
    q50_gain: float              # gain futur quantile 50 (médiane)
    q90_gain: float              # gain futur quantile 90
    c_alpha_gain: float          # conformal half-width sur gain (résidu absolu)
    drop_proba: float            # probabilité calibrée de drop ≥ 10%
    ttd_days: float
    route_known: bool
    route_popularity: int
    budget_max: float
    budget_autobuy: float        # legacy, kept for back-compat
    autobuy_enabled: bool        # legacy, kept for back-compat
    preference_match: float = 1.0
    q10_train_route: float = 0.0  # used for alert near-floor reference
    hybrid_mode: bool = False     # legacy, kept for back-compat


@dataclass
class PolicyDecision:
    action: str
    confidence: float
    score_offer: float
    score_alert: float
    score_buy: float
    score_autobuy: float
    conformal_width_gain: float
    width_over_price: float
    q50_gain: float
    drop_proba: float
    reason: list[str]


# =============================================================================
# Classify
# =============================================================================

def classify(ctx: PolicyContext) -> PolicyDecision:
    """Classify a single observation. Action order: ABSTAIN → BUY_NOW → ALERT → MONITOR → WAIT."""
    reasons: list[str] = []

    # Internals
    conformal_width = max(0.0, 2.0 * ctx.c_alpha_gain)
    width_over_price = conformal_width / max(ctx.price, 1.0)

    # Alpha(ttd) damping — H1 correction
    alpha_ttd = 1.0 if ctx.ttd_days <= 21 else 0.3
    buy_trigger = ctx.q50_gain + alpha_ttd * ctx.c_alpha_gain

    # Scores
    score_alert = ctx.drop_proba
    score_buy = buy_trigger
    score_autobuy = 0.0  # AUTO_BUY disabled Phase 1
    score_offer = 0.0  # retained for interface compat

    # Confidence: bounded user-facing scalar
    confidence = max(0.0, min(1.0, 0.5 + buy_trigger / 40.0))

    def _decision(action: str) -> PolicyDecision:
        return PolicyDecision(
            action=action,
            confidence=confidence,
            score_offer=score_offer,
            score_alert=score_alert,
            score_buy=score_buy,
            score_autobuy=score_autobuy,
            conformal_width_gain=conformal_width,
            width_over_price=width_over_price,
            q50_gain=ctx.q50_gain,
            drop_proba=ctx.drop_proba,
            reason=reasons,
        )

    # --- 1. ABSTAIN gates ---
    if not ctx.route_known:
        reasons.append("route_unknown")
        return _decision("ABSTAIN")
    if width_over_price > ABSTAIN_WIDTH_OVER_PRICE:
        reasons.append(f"width_over_price={width_over_price:.3f}>{ABSTAIN_WIDTH_OVER_PRICE}")
        return _decision("ABSTAIN")
    if ctx.route_popularity < ROUTE_POPULARITY_MIN:
        reasons.append(f"route_popularity={ctx.route_popularity}<{ROUTE_POPULARITY_MIN}")
        return _decision("ABSTAIN")
    if ctx.ttd_days < TTD_LOWER or ctx.ttd_days > TTD_UPPER:
        reasons.append(f"ttd_days={ctx.ttd_days} outside [{TTD_LOWER},{TTD_UPPER}]")
        return _decision("ABSTAIN")

    # --- 2. BUY_NOW gates ---
    if (
        width_over_price <= MAX_WIDTH_OVER_PRICE
        and buy_trigger >= BUY_TRIGGER_MARGIN_USD
        and ctx.drop_proba <= DROP_PROBA_BUY_MAX
        and ctx.price <= ctx.budget_max
    ):
        reasons.append(f"buy_trigger={buy_trigger:.2f}>=margin")
        return _decision("BUY_NOW")

    # --- 3. ALERT gates ---
    # near_floor_ref: if q10_train_route > 0, use it * pct; else inf (vacuously pass)
    near_floor_ref = (
        ctx.q10_train_route * ALERT_NEAR_FLOOR_PCT
        if ctx.q10_train_route > 0
        else float("inf")
    )
    if (
        ctx.drop_proba >= ALERT_DROP_THRESHOLD
        and ctx.price <= near_floor_ref
        and width_over_price <= MAX_WIDTH_OVER_PRICE
    ):
        reasons.append(f"alert_drop={ctx.drop_proba:.2f}>=threshold,near_floor")
        return _decision("ALERT")

    # --- 4. MONITOR gates ---
    if (
        ctx.drop_proba >= MONITOR_DROP_PROBA_MIN
        and ctx.drop_proba < ALERT_DROP_THRESHOLD
        and ctx.ttd_days >= MONITOR_TTD_MIN
        and width_over_price <= MONITOR_WIDTH_OVER_PRICE_MAX
    ):
        reasons.append(f"monitor_band drop_proba={ctx.drop_proba:.2f}")
        return _decision("MONITOR")

    # --- 5. WAIT ---
    reasons.append("no_trigger")
    return _decision("WAIT")


# =============================================================================
# Utilities
# =============================================================================

def decision_to_dict(d: PolicyDecision) -> dict[str, Any]:
    return asdict(d)


def _demo() -> None:
    ctx = PolicyContext(
        price=320.0,
        q10_gain=-40.0, q50_gain=-5.0, q90_gain=25.0,
        c_alpha_gain=15.0,
        drop_proba=0.35,
        ttd_days=21,
        route_known=True, route_popularity=800,
        budget_max=500.0, budget_autobuy=400.0,
        autobuy_enabled=False,
    )
    d = classify(ctx)
    log("demo decision", **{k: v for k, v in decision_to_dict(d).items()})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--ctx-json", help="JSON string of PolicyContext fields")
    args = parser.parse_args()
    if args.ctx_json:
        payload = json.loads(args.ctx_json)
        ctx = PolicyContext(**payload)
        print(json.dumps(decision_to_dict(classify(ctx)), indent=2))
    else:
        _demo()
