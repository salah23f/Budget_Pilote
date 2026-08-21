"""
fit_gp.py — Modal parallel GP fitting (replaces scripts/train/03-fit-gp.py).

Fits GP with composite kernel (RBF + Periodic7 + Periodic365) for every route
with >= 30 samples, in parallel across Modal containers.

Design:
  - Main entrypoint reads the parquet once (on Modal) to get the list of eligible routes.
  - Route list is split into chunks of ROUTES_PER_WORKER.
  - Each worker re-reads the parquet from the volume (only needed columns), filters
    to its route chunk, and fits GPs sequentially on its chunk.
  - Results are merged locally with incremental checkpoint, then saved back to volume.

Input:  /vol/features/train_features.parquet
Output: /vol/models_v76/gp_params.json

Run:
    modal run scripts/cloud/v76_prod/fit_gp.py
"""
import json
import time
import modal

app = modal.App("flyeas-v76-gp")
volume = modal.Volume.from_name("flyeas-v75", create_if_missing=True)

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "numpy==1.26.4",
    "pandas==2.2.2",
    "pyarrow==16.1.0",
    "scipy==1.13.1",
)

MIN_SAMPLES_PER_ROUTE = 30
MAX_SAMPLES_GP = 300           # GP is O(N^3) — cap for tractability
ROUTES_PER_WORKER = 100        # batch size per container
PARQUET_PATH = "/vol/features/train_features.parquet"
OUTPUT_PATH = "/vol/models_v76/gp_params.json"
NEEDED_COLS = ["origin", "destination", "fetched_at", "price_usd"]


# ---------------- GP math (pure function, runs inside workers) ----------------
def _fit_one_route(route_df):
    import numpy as np
    import pandas as pd
    from scipy.optimize import minimize
    from scipy.spatial.distance import cdist

    def rbf(X1, X2, ls, var):
        d = cdist(X1, X2, "sqeuclidean")
        return var * np.exp(-d / (2 * ls ** 2))

    def per(X1, X2, period, ls, var):
        d = cdist(X1, X2, "euclidean")
        return var * np.exp(-2 * np.sin(np.pi * d / period) ** 2 / ls ** 2)

    def nll(theta, X, y, noise=0.1):
        ls_rbf, v_rbf, ls7, v7, ls365, v365 = np.exp(theta)
        K = rbf(X, X, ls_rbf, v_rbf) + per(X, X, 7.0, ls7, v7) + per(X, X, 365.0, ls365, v365)
        K += noise * np.eye(len(X))
        try:
            L = np.linalg.cholesky(K)
            alpha = np.linalg.solve(L.T, np.linalg.solve(L, y))
            return float(0.5 * y @ alpha + np.sum(np.log(np.diag(L))) + 0.5 * len(y) * np.log(2 * np.pi))
        except np.linalg.LinAlgError:
            return 1e10

    n = min(len(route_df), MAX_SAMPLES_GP)
    sub = route_df.sample(n, random_state=42) if len(route_df) > n else route_df
    times = pd.to_datetime(sub["fetched_at"])
    X = ((times - times.min()).dt.total_seconds() / 86400).values.reshape(-1, 1)
    y = sub["price_usd"].values.astype(float)
    y_mean, y_std = float(y.mean()), float(y.std()) + 1e-8
    y_norm = (y - y_mean) / y_std

    theta0 = np.array([np.log(30), 0.0, 0.0, np.log(0.3), 0.0, np.log(0.2)])
    # Log-space bounds keep L-BFGS-B away from overflow regions (kills the warnings)
    bounds = [(-4, 6)] * 6

    res = minimize(nll, theta0, args=(X, y_norm), method="L-BFGS-B",
                   bounds=bounds, options={"maxiter": 100})
    return {
        "rbf_ls": float(np.exp(res.x[0])),
        "rbf_var": float(np.exp(res.x[1])),
        "per7_ls": float(np.exp(res.x[2])),
        "per7_var": float(np.exp(res.x[3])),
        "per365_ls": float(np.exp(res.x[4])),
        "per365_var": float(np.exp(res.x[5])),
        "y_mean": y_mean, "y_std": y_std,
        "n_samples": n, "nll": float(res.fun),
        "converged": bool(res.success),
    }


# ---------------- Modal functions ----------------
@app.function(image=image, volumes={"/vol": volume}, cpu=1.0, memory=4096, timeout=60 * 10)
def list_eligible_routes() -> list:
    """Runs once on Modal. Loads parquet, returns routes with >= MIN_SAMPLES_PER_ROUTE rows."""
    import pandas as pd
    print(f"[list] reading {PARQUET_PATH}")
    df = pd.read_parquet(PARQUET_PATH, columns=["origin", "destination"])
    df["route"] = df["origin"] + "-" + df["destination"]
    counts = df.groupby("route").size()
    eligible = counts[counts >= MIN_SAMPLES_PER_ROUTE].index.tolist()
    print(f"[list] {len(eligible)} eligible routes out of {len(counts)} total")
    return eligible


@app.function(image=image, volumes={"/vol": volume}, cpu=2.0, memory=8192, timeout=60 * 30)
def fit_chunk(chunk_idx: int, routes_in_chunk: list) -> dict:
    """Read parquet, filter to our routes, fit GP for each. Returns {route: params}."""
    import pandas as pd

    t_read = time.time()
    df = pd.read_parquet(PARQUET_PATH, columns=NEEDED_COLS)
    df["route"] = df["origin"] + "-" + df["destination"]
    df = df[df["route"].isin(routes_in_chunk)]
    print(f"[chunk {chunk_idx}] loaded+filtered {len(df)} rows in {time.time()-t_read:.1f}s")

    out = {}
    t0 = time.time()
    for r in routes_in_chunk:
        rd = df[df["route"] == r]
        if len(rd) < MIN_SAMPLES_PER_ROUTE:
            continue
        try:
            out[r] = _fit_one_route(rd)
        except Exception as e:
            out[r] = {"error": str(e), "n_samples": int(len(rd))}
    print(f"[chunk {chunk_idx}] fit {len(out)}/{len(routes_in_chunk)} routes in {time.time()-t0:.1f}s")
    return out


@app.function(image=image, volumes={"/vol": volume}, cpu=1.0, memory=2048)
def save_final(gp_params: dict):
    import os
    os.makedirs("/vol/models_v76", exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(gp_params, f, indent=2)
    volume.commit()
    print(f"[save] wrote {len(gp_params)} routes to {OUTPUT_PATH}")


# ---------------- Local orchestration ----------------
@app.local_entrypoint()
def main():
    print("1. Listing eligible routes on Modal...")
    routes = list_eligible_routes.remote()
    print(f"   -> {len(routes)} routes to fit")

    chunks = [routes[i:i + ROUTES_PER_WORKER] for i in range(0, len(routes), ROUTES_PER_WORKER)]
    print(f"2. Split into {len(chunks)} chunks of ~{ROUTES_PER_WORKER} routes each")
    print(f"3. Fanning out fit_chunk.map() across Modal workers...")

    merged = {}
    t0 = time.time()
    args = [(i, c) for i, c in enumerate(chunks)]
    for i, partial in enumerate(fit_chunk.starmap(args)):
        merged.update(partial)
        # Local checkpoint so nothing is lost if something crashes
        with open("/tmp/gp_params_checkpoint.json", "w") as f:
            json.dump(merged, f)
        elapsed = time.time() - t0
        pct = 100 * (i + 1) / len(chunks)
        print(f"   [{i+1}/{len(chunks)}] merged={len(merged)} routes | "
              f"{elapsed:.0f}s elapsed | {pct:.1f}% done")

    print(f"\n4. Saving final result back to volume...")
    save_final.remote(merged)
    print(f"Done. {len(merged)} routes fitted in {time.time()-t0:.0f}s")
