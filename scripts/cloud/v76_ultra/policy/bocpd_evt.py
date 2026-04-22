"""
bocpd_evt.py — Per-route BOCPD regime posterior + POT/GPD tail fit.

Produces two parquet files:
  - route_regime_stats.parquet   (hazard, run-length posterior summary)
  - route_evt_params.parquet     (GPD shape/scale/threshold per route)

The V7 backtest loads these to drive hazard-aware decisions and detect
extreme-low mistake fares.

Run:
    modal run scripts/cloud/v76_ultra/policy/bocpd_evt.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import app, volume, base_image, MODELS_DIR, load_split, route_key, ensure_dirs


@app.function(
    image=base_image,
    cpu=8,
    volumes={"/vol": volume},
    timeout=60 * 60,
    memory=16 * 1024,
)
def compute_bocpd_and_evt(hazard_rate: float = 1 / 50, u_quantile: float = 0.93):
    import numpy as np
    import pandas as pd
    from scipy.stats import genpareto

    ensure_dirs()
    df = load_split("train")
    df = df.sort_values(["origin", "destination", "fetched_at"]).reset_index(drop=True)
    routes = route_key(df)
    prices = df["price_usd"].values.astype(np.float64)
    un, first = np.unique(routes, return_index=True)
    order = np.argsort(first)
    un, first = un[order], first[order]
    bounds = np.append(first, len(df))

    # --- BOCPD for each route (simple: gaussian likelihood) ---
    def bocpd(x, max_rl: int = 200):
        """Return (posterior_mean_runlength, posterior_std_runlength).
        Sliding window truncation at max_rl to avoid O(n²) memory."""
        n = len(x)
        if n < 5:
            return 0.0, 0.0, 0.0
        mu = x.mean(); sigma = x.std() + 1e-8
        buf_len = min(n + 1, max_rl + 1)
        p_rt = np.zeros(buf_len)
        p_rt[0] = 1.0
        for t, xt in enumerate(x):
            pred_prob = np.exp(-0.5 * ((xt - mu) / sigma) ** 2) / (sigma * np.sqrt(2 * np.pi))
            active = min(t + 1, buf_len)
            growth = p_rt[:active] * pred_prob * (1 - hazard_rate)
            cp = (p_rt[:active] * pred_prob).sum() * hazard_rate
            new_p_rt = np.zeros(buf_len)
            end = min(active + 1, buf_len)
            new_p_rt[1:end] = growth[:end - 1]
            new_p_rt[0] = cp
            total = new_p_rt.sum()
            if total > 1e-12:
                new_p_rt /= total
            p_rt = new_p_rt
        idx = np.arange(buf_len)
        mean_rl = float(idx @ p_rt)
        var_rl = float((idx ** 2 @ p_rt) - mean_rl ** 2)
        return mean_rl, np.sqrt(max(var_rl, 0)), float(p_rt[0])

    # --- GPD tail fit ---
    def gpd(x):
        if len(x) < 30:
            return None
        # Cap observations to avoid explosion on very long routes
        x_cap = x[:min(500, len(x) // 2)] if len(x) > 1000 else x
        u = np.quantile(x_cap, u_quantile)
        excess = u - x_cap
        excess = excess[excess > 0]
        if len(excess) < 10:
            return None
        try:
            sh, loc, sc = genpareto.fit(excess)
            return {"threshold": float(u), "shape": float(sh),
                    "loc": float(loc), "scale": float(sc),
                    "n_exceed": int(len(excess))}
        except Exception:
            return None

    stats = []
    evt = []
    print(f"[bocpd+evt] processing {len(un):,} routes...")
    for i, r in enumerate(un):
        s, e = bounds[i], bounds[i + 1]
        p = prices[s:e]
        if len(p) < 10:
            continue
        m_rl, s_rl, p_change = bocpd(p)
        stats.append({"route": r, "mean_run_length": m_rl,
                      "std_run_length": s_rl, "prob_changepoint": p_change,
                      "n_obs": int(len(p))})
        g = gpd(p)
        if g is not None:
            g["route"] = r
            evt.append(g)
        if (i + 1) % 10000 == 0:
            print(f"  {i+1}/{len(un)}")

    pd.DataFrame(stats).to_parquet(f"{MODELS_DIR}/route_regime_stats.parquet", index=False)
    pd.DataFrame(evt).to_parquet(f"{MODELS_DIR}/route_evt_params.parquet", index=False)
    volume.commit()
    return {"status": "ok", "n_bocpd": len(stats), "n_evt": len(evt)}


# Standalone: modal run scripts/cloud/v76_ultra/policy/bocpd_evt.py::compute_bocpd_and_evt
