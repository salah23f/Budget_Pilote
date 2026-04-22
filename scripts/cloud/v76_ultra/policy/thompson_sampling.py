"""
thompson_sampling.py — Contextual Thompson Sampling over a small set of
competing buy/wait experts. Produces `thompson_weights.json` that the V7
backtest blends with the other policy signals to exploit / explore as it
sees more decisions per route.

Run (cheap, CPU only):
    modal run scripts/cloud/v76_ultra/policy/thompson_sampling.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import app, volume, base_image, MODELS_DIR, load_split, route_key, ensure_dirs


@app.function(
    image=base_image,
    cpu=4,
    volumes={"/vol": volume},
    timeout=20 * 60,
    memory=8 * 1024,
)
def fit_thompson(experts=("aggressive", "conservative", "v1_heuristic", "bellman"),
                 n_rounds: int = 200):
    """Simulate TS on historical val routes to learn initial Beta priors for
    each expert. Those Beta(α, β) are later used by V7 online."""
    import json
    import numpy as np
    import pandas as pd

    ensure_dirs()
    df = load_split("val")
    df = df.sort_values(["origin", "destination", "fetched_at"]).reset_index(drop=True)
    r = route_key(df)
    prices = df["price_usd"].values.astype(np.float64)
    un, first = np.unique(r, return_index=True)
    order = np.argsort(first)
    un, first = un[order], first[order]
    bounds = np.append(first, len(df))

    # Expert behaviors
    def expert_buy_idx(name, p):
        n = len(p)
        idx = np.arange(n)
        mean = np.cumsum(p) / np.maximum(idx, 1)
        std = np.sqrt(np.maximum((np.cumsum(p * p) / np.maximum(idx, 1)) - mean ** 2, 0)) + 1e-6
        z = (p - mean) / std
        if name == "aggressive":
            cond = (z <= -0.3) | (idx >= n - 3)
        elif name == "conservative":
            cond = (z <= -1.2) | (idx >= n - 3)
        elif name == "v1_heuristic":
            cond = (z <= -0.8) | (idx >= n - 3)
        elif name == "bellman":
            # Crude bellman: buy if current price below cumulative mean
            cond = (p <= mean) & (idx >= 3)
        else:
            cond = np.zeros_like(z, dtype=bool)
            cond[-1] = True
        return int(np.argmax(cond)) if cond.any() else n - 1

    # Bayesian bandit: each expert's "win" is buying within 5% of floor
    alpha = {e: 1.0 for e in experts}
    beta = {e: 1.0 for e in experts}

    rng = np.random.default_rng(42)
    regrets = {e: [] for e in experts}
    wins = {e: 0 for e in experts}
    total = {e: 0 for e in experts}

    for _ in range(n_rounds):
        # sample a random route
        i = int(rng.integers(0, len(un)))
        s, e = bounds[i], bounds[i + 1]
        p = prices[s:e]
        if len(p) < 10:
            continue
        floor = p.min()
        for exp in experts:
            bi = expert_buy_idx(exp, p)
            win = p[bi] <= floor * 1.05
            wins[exp] += int(win)
            total[exp] += 1
            # Beta posterior update
            if win:
                alpha[exp] += 1
            else:
                beta[exp] += 1
            regrets[exp].append(float((p[bi] - floor) / max(floor, 1)))

    summary = {
        "alpha": alpha, "beta": beta,
        "expected_win_rate": {e: float(alpha[e] / (alpha[e] + beta[e])) for e in experts},
        "avg_regret": {e: float(np.mean(regrets[e])) for e in experts},
        "n_rounds": n_rounds,
    }

    print("[thompson] posterior Beta parameters:")
    for e in experts:
        print(f"  {e:<14}  α={alpha[e]:.1f}  β={beta[e]:.1f}  "
              f"winrate={summary['expected_win_rate'][e]:.3f}  "
              f"regret={summary['avg_regret'][e]:.3f}")

    with open(f"{MODELS_DIR}/thompson_weights.json", "w") as f:
        json.dump(summary, f, indent=2)
    volume.commit()
    return {"status": "ok", "summary": summary}


# Standalone: modal run scripts/cloud/v76_ultra/policy/thompson_sampling.py::fit_thompson
