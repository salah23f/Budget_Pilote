"""p03_thompson.py — Contextual Thompson Sampling over expert priors (standalone)."""
import modal

app = modal.App("flyeas-v76-thompson")
volume = modal.Volume.from_name("flyeas-v75", create_if_missing=True)

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "numpy==1.26.4", "pandas==2.2.2", "pyarrow==16.1.0",
)


@app.function(image=image, cpu=4, volumes={"/vol": volume},
              timeout=20 * 60, memory=8 * 1024)
def run(n_rounds: int = 200):
    import os
    import json
    import numpy as np
    import pandas as pd

    os.makedirs("/vol/models_v76", exist_ok=True)
    experts = ("aggressive", "conservative", "v1_heuristic", "bellman")

    df = pd.read_parquet("/vol/features/val_features.parquet")
    df = df.sort_values(["origin", "destination", "fetched_at"]).reset_index(drop=True)
    r = (df["origin"].astype(str) + "-" + df["destination"].astype(str)).values
    prices = df["price_usd"].values.astype(np.float64)
    un, first = np.unique(r, return_index=True)
    order = np.argsort(first)
    un, first = un[order], first[order]
    bounds = np.append(first, len(df))

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
            cond = (p <= mean) & (idx >= 3)
        else:
            cond = np.zeros_like(z, dtype=bool); cond[-1] = True
        return int(np.argmax(cond)) if cond.any() else n - 1

    alpha = {e: 1.0 for e in experts}
    beta = {e: 1.0 for e in experts}
    regrets = {e: [] for e in experts}
    wins = {e: 0 for e in experts}
    total = {e: 0 for e in experts}

    rng = np.random.default_rng(42)
    for _ in range(n_rounds):
        i = int(rng.integers(0, len(un)))
        s, e = bounds[i], bounds[i + 1]
        p = prices[s:e]
        if len(p) < 10:
            continue
        floor = p.min()
        for exp in experts:
            bi = expert_buy_idx(exp, p)
            win = p[bi] <= floor * 1.05
            wins[exp] += int(win); total[exp] += 1
            if win: alpha[exp] += 1
            else: beta[exp] += 1
            regrets[exp].append(float((p[bi] - floor) / max(floor, 1)))

    summary = {
        "alpha": alpha, "beta": beta,
        "expected_win_rate": {e: float(alpha[e] / (alpha[e] + beta[e])) for e in experts},
        "avg_regret": {e: float(np.mean(regrets[e])) for e in experts},
        "n_rounds": n_rounds,
    }

    for e in experts:
        print(f"  {e:<14} α={alpha[e]:.1f} β={beta[e]:.1f} "
              f"winrate={summary['expected_win_rate'][e]:.3f} "
              f"regret={summary['avg_regret'][e]:.3f}")

    with open("/vol/models_v76/thompson_weights.json", "w") as f:
        json.dump(summary, f, indent=2)
    volume.commit()
    return {"status": "ok", "summary": summary}


@app.local_entrypoint()
def main():
    print(run.remote())
