"""p01_bocpd_evt.py — BOCPD + POT/GPD per route (standalone)."""
import modal

app = modal.App("flyeas-v76-bocpd-evt")
volume = modal.Volume.from_name("flyeas-v75", create_if_missing=True)

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "numpy==1.26.4", "pandas==2.2.2", "pyarrow==16.1.0", "scipy==1.13.1",
)


@app.function(image=image, cpu=8, volumes={"/vol": volume},
              timeout=60 * 60, memory=16 * 1024)
def run(hazard_rate: float = 1 / 50, u_quantile: float = 0.95):
    import os
    import numpy as np
    import pandas as pd
    from scipy.stats import genpareto

    os.makedirs("/vol/models_v76", exist_ok=True)
    df = pd.read_parquet("/vol/features/train_features.parquet")
    df = df.sort_values(["origin", "destination", "fetched_at"]).reset_index(drop=True)
    routes = (df["origin"].astype(str) + "-" + df["destination"].astype(str)).values
    prices = df["price_usd"].values.astype(np.float64)
    un, first = np.unique(routes, return_index=True)
    order = np.argsort(first)
    un, first = un[order], first[order]
    bounds = np.append(first, len(df))

    def bocpd(x):
        n = len(x)
        if n < 5:
            return 0.0, 0.0, 0.0
        mu = x.mean(); sigma = x.std() + 1e-8
        p_rt = np.zeros(n + 1); p_rt[0] = 1.0
        for t, xt in enumerate(x):
            pp = np.exp(-0.5 * ((xt - mu) / sigma) ** 2) / (sigma * np.sqrt(2 * np.pi))
            growth = p_rt[:t + 1] * pp * (1 - hazard_rate)
            cp = (p_rt[:t + 1] * pp).sum() * hazard_rate
            new = np.zeros(n + 1)
            new[1:t + 2] = growth
            new[0] = cp
            p_rt = new / (new.sum() + 1e-12)
        mean_rl = float(np.arange(n + 1) @ p_rt)
        var_rl = float((np.arange(n + 1) ** 2 @ p_rt) - mean_rl ** 2)
        return mean_rl, np.sqrt(max(var_rl, 0)), float(p_rt[0])

    def gpd(x):
        if len(x) < 30:
            return None
        u = np.quantile(x, u_quantile)
        excess = u - x
        excess = excess[excess > 0]
        if len(excess) < 10:
            return None
        try:
            sh, loc, sc = genpareto.fit(excess)
            return {"threshold": float(u), "shape": float(sh),
                    "loc": float(loc), "scale": float(sc), "n_exceed": int(len(excess))}
        except Exception:
            return None

    stats, evt = [], []
    print(f"[bocpd+evt] {len(un):,} routes")
    for i, r in enumerate(un):
        s, e = bounds[i], bounds[i + 1]
        p = prices[s:e]
        if len(p) < 10:
            continue
        m_rl, s_rl, pc = bocpd(p)
        stats.append({"route": r, "mean_run_length": m_rl,
                       "std_run_length": s_rl, "prob_changepoint": pc,
                       "n_obs": int(len(p))})
        g = gpd(p)
        if g is not None:
            g["route"] = r
            evt.append(g)
        if (i + 1) % 10000 == 0:
            print(f"  {i+1}/{len(un)}")

    pd.DataFrame(stats).to_parquet("/vol/models_v76/route_regime_stats.parquet", index=False)
    pd.DataFrame(evt).to_parquet("/vol/models_v76/route_evt_params.parquet", index=False)
    volume.commit()
    return {"status": "ok", "n_bocpd": len(stats), "n_evt": len(evt)}


@app.local_entrypoint()
def main():
    print(run.remote())
