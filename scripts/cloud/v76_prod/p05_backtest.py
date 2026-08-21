"""p05_backtest.py — Final V7.6 backtest on test set (standalone)."""
import modal

app = modal.App("flyeas-v76-backtest")
volume = modal.Volume.from_name("flyeas-v75", create_if_missing=True)

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "numpy==1.26.4", "pandas==2.2.2", "pyarrow==16.1.0", "scipy==1.13.1",
)


@app.function(image=image, cpu=8, volumes={"/vol": volume},
              timeout=60 * 60, memory=16 * 1024)
def run(alpha: float = 0.10):
    import os
    import json
    import numpy as np
    import pandas as pd

    os.makedirs("/vol/report_v76", exist_ok=True)

    # Pick best ensemble source
    pred_source = None
    for name in ("xgb_meta", "bma", "copula", "qrf"):
        for path in (f"/vol/models_v76/{name}_oof_predictions.parquet",
                     f"/vol/models/{name}_oof_predictions.parquet"):
            if os.path.exists(path):
                pred_source = (name, path); break
        if pred_source:
            break
    if pred_source is None:
        return {"status": "aborted"}
    pred_name, _ = pred_source
    print(f"[v76] ensemble source: {pred_name}")

    c_alpha = 0.0
    cp = "/vol/models_v76/conformal_calibration.json"
    if os.path.exists(cp):
        with open(cp) as f:
            c = json.load(f)
        c_alpha = float(c["offsets"].get(f"alpha_{int(alpha*100)}", 0.0))
    print(f"[v76] conformal c_alpha={c_alpha:.2f}")

    evt = {}
    ep = "/vol/models_v76/route_evt_params.parquet"
    if os.path.exists(ep):
        edf = pd.read_parquet(ep)
        for _, row in edf.iterrows():
            evt[row["route"]] = (row["threshold"], row["shape"], row["scale"])
    print(f"[v76] GPD for {len(evt)} routes")

    iqn_cvar = {}
    ip = "/vol/models_v76/iqn_oof_predictions.parquet"
    if os.path.exists(ip):
        idf = pd.read_parquet(ip)
        if "cvar10" in idf.columns:
            iqn_cvar = dict(idf.groupby("route")["cvar10"].mean())

    test = pd.read_parquet("/vol/features/test_features.parquet")
    test = test.sort_values(["origin", "destination", "fetched_at"]).reset_index(drop=True)
    routes = (test["origin"].astype(str) + "-" + test["destination"].astype(str)).values
    prices = test["price_usd"].values.astype(np.float64)
    un, first = np.unique(routes, return_index=True)
    order = np.argsort(first)
    un, first = un[order], first[order]
    bounds = np.append(first, len(test))

    results = []
    print(f"[v76] {len(un):,} routes test")
    for i, r in enumerate(un):
        s, e = bounds[i], bounds[i + 1]
        p = prices[s:e]
        if len(p) < 10:
            continue
        n = len(p)
        floor = float(p.min())
        opt_mask = p <= floor * 1.05
        idx = np.arange(n)
        cum = np.concatenate([[0.0], np.cumsum(p)])
        cumsq = np.concatenate([[0.0], np.cumsum(p * p)])
        safe = np.maximum(idx, 1)
        mean = cum[idx] / safe
        var = (cumsq[idx] / safe) - mean * mean
        std = np.sqrt(np.maximum(var, 0)) + 1e-8

        z = np.where(idx >= 5, (p - mean) / std, 0.0)
        pct = np.where(z < 0, 40 - z * 20, 50 + z * 20).clip(0, 100)
        ttd = np.maximum(1, n - idx).astype(float)
        comp_v1 = (
            np.where(z <= -0.8, 0.4, 0) + np.where((z > -0.8) & (z < 0), 0.4 * (-z / 0.8), 0)
            - np.where(z >= 0.6, 0.4, 0) - np.where((z > 0) & (z < 0.6), 0.4 * (z / 0.6), 0)
            + np.where(pct <= 20, 0.25, 0) - np.where(pct >= 70, 0.25, 0)
            + np.where(ttd < 7, 0.15, 0) + np.where((ttd >= 7) & (ttd < 14), 0.10, 0)
            - np.where(ttd > 60, 0.05, 0)
        )
        v1_buy = (comp_v1 >= 0.4) & (idx >= 5)
        v1_force = (ttd < 14) & (idx < 5)
        v1_act = v1_buy | v1_force
        v1_bi = int(np.argmax(v1_act)) if v1_act.any() else n - 1
        v1_price = float(p[v1_bi])

        lag1 = np.maximum(idx - 1, 0)
        lag5 = np.maximum(idx - 5, 0)
        velocity = (p[lag1] - p[lag5]) / 4.0
        fair = np.where(idx >= 5, p[lag1] + velocity * 0.5, mean)
        buy_conf = fair - c_alpha

        is_extreme = np.zeros(n, dtype=bool)
        if r in evt and n >= 10:
            u, shape, scale = evt[r]
            try:
                from scipy.stats import genpareto
                deep = genpareto.ppf(0.99, shape, loc=0, scale=scale)
                is_extreme = p < (u - deep * 0.5)
            except Exception:
                is_extreme = p < np.quantile(p[:max(5, n // 2)], 0.05)

        cvar_gain = iqn_cvar.get(r, 0.0)
        signals = np.zeros(n)
        signals += np.where(p <= buy_conf, 3, 0)
        signals += np.where((p - fair) / std < -1.0, 1, 0)
        signals += np.where(is_extreme & (idx >= 5), 2, 0)
        signals += np.where(ttd < 7, 2, 0)
        if cvar_gain > 0:
            signals += 1

        v76_buy = (signals >= 3) & (idx >= 3)
        v76_force = (ttd < 14) & (idx < 3)
        v76_act = v76_buy | v76_force
        v76_bi = int(np.argmax(v76_act)) if v76_act.any() else n - 1
        v76_price = float(p[v76_bi])

        results.append({
            "route": r, "n": n, "floor": floor,
            "v1_price": v1_price, "v76_price": v76_price,
            "v1_capture": floor / max(1, v1_price) * 100,
            "v76_capture": floor / max(1, v76_price) * 100,
            "v1_in_window": bool(opt_mask[v1_bi]),
            "v76_in_window": bool(opt_mask[v76_bi]),
            "v76_beats_v1": v76_price <= v1_price,
        })
        if (i + 1) % 10000 == 0:
            print(f"  {i+1}/{len(un)}")

    res = pd.DataFrame(results)
    print(f"\n[v76] {len(res):,} routes")
    print(f"  V1 capture med:  {res['v1_capture'].median():.2f}%")
    print(f"  V76 capture med: {res['v76_capture'].median():.2f}%")
    print(f"  V76 beats V1:    {res['v76_beats_v1'].mean()*100:.2f}%")

    k10 = max(1, len(res) // 10)
    v1_cvar = float(res.nsmallest(k10, "v1_capture")["v1_capture"].mean())
    v76_cvar = float(res.nsmallest(k10, "v76_capture")["v76_capture"].mean())

    summary = {
        "n_routes": int(len(res)),
        "v1_capture_median": float(res["v1_capture"].median()),
        "v76_capture_median": float(res["v76_capture"].median()),
        "v76_beats_v1_pct": float(res["v76_beats_v1"].mean() * 100),
        "v1_cvar10_capture": v1_cvar,
        "v76_cvar10_capture": v76_cvar,
        "delta_median": float(res["v76_capture"].median() - res["v1_capture"].median()),
        "conformal_c_alpha": c_alpha,
        "pred_source": pred_name,
    }

    res.to_parquet("/vol/report_v76/v76_per_route.parquet", index=False)
    with open("/vol/report_v76/v76_summary.json", "w") as f:
        json.dump(summary, f, indent=2)
    volume.commit()
    return summary


@app.local_entrypoint()
def main():
    print(run.remote())
