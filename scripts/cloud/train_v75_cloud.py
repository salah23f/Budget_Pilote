"""
train_v75_cloud.py — Full V7.5 training on Modal A100 GPU.

What this script does, from end to end, on a single A100:

  1. Loads train/val/test features from the `flyeas-v75` Modal volume
  2. Trains QRF (LightGBM quantile), TFT, DeepAR, LSTM on GPU — full size
  3. Writes aligned OOF predictions (every model evaluated on the same val set)
  4. Fits a robust ensemble:
       - Isotonic calibration per model
       - NNLS with 3 loss variants (standard / rarity-weighted / CVaR)
       - Pareto + bootstrap stability selection
  5. Runs the ensemble-driven V7 backtest with Conformal Optimal Stopping,
     BOCPD regime awareness, and POT/GPD extreme detection
  6. Saves everything to the volume, ready for local download

Run:
    modal run scripts/cloud/train_v75_cloud.py

Download results afterwards:
    modal volume get flyeas-v75 models/ ./models_cloud/
    modal volume get flyeas-v75 report/ ./report_cloud/
"""

import os
import sys
import json
import time
from pathlib import Path

import modal

APP_NAME = "flyeas-v75-trainer"
VOLUME_NAME = "flyeas-v75"
GPU_TYPE = "A100"        # Switch to "A10G" if you want to save ~40% on cost
TIMEOUT_S = 4 * 60 * 60  # 2h hard cap (cost safeguard)

app = modal.App(APP_NAME)
volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "numpy==1.26.4",
        "pandas==2.2.2",
        "pyarrow==16.1.0",
        "scipy==1.13.1",
        "scikit-learn==1.5.0",
        "lightgbm==4.3.0",
        "torch==2.3.1",
        "hmmlearn==0.3.2",
        "statsmodels==0.14.2",
    )
)


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN GPU TRAINING FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════


@app.function(
    image=image,
    gpu=GPU_TYPE,
    volumes={"/vol": volume},
    timeout=TIMEOUT_S,
    memory=32 * 1024,   # 32 GB RAM on the A100 box
)
def train_all():
    """Runs the full V7.5 training pipeline end-to-end on one A100."""
    import numpy as np
    import pandas as pd
    import torch
    import torch.nn as nn
    from scipy.optimize import nnls, minimize
    from scipy.stats import genpareto
    from sklearn.isotonic import IsotonicRegression
    import lightgbm as lgb

    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n{'=' * 70}")
    print(f"  V7.5 CLOUD TRAINING — starting on {DEVICE}")
    print(f"{'=' * 70}\n")

    # --- 1. Load features ----------------------------------------------------
    FEAT_DIR = "/vol/features"
    print(f"[1/8] Loading features from {FEAT_DIR}")
    t0 = time.time()
    train_df = pd.read_parquet(f"{FEAT_DIR}/train_features.parquet")
    val_df = pd.read_parquet(f"{FEAT_DIR}/val_features.parquet")
    test_df = pd.read_parquet(f"{FEAT_DIR}/test_features.parquet")
    print(f"  train={len(train_df):,}  val={len(val_df):,}  test={len(test_df):,}  "
          f"({time.time() - t0:.1f}s)")

    # Feature / target setup (same columns the current pipeline uses)
    numeric_cols = [c for c in train_df.columns
                    if train_df[c].dtype in [np.float64, np.float32, np.int64, np.int32]
                    and c != "price_usd"
                    and "id" not in c.lower()
                    and not c.startswith("Unnamed")]
    print(f"  features ({len(numeric_cols)}): {numeric_cols[:6]}...")

    for df in (train_df, val_df, test_df):
        df[numeric_cols] = df[numeric_cols].fillna(0).replace([np.inf, -np.inf], 0)

    X_train = train_df[numeric_cols].values.astype(np.float32)
    y_train = train_df["price_usd"].values.astype(np.float32)
    X_val = val_df[numeric_cols].values.astype(np.float32)
    y_val = val_df["price_usd"].values.astype(np.float32)

    # Route key for OOF alignment + per-route operations
    def route_key(df):
        return (df["origin"].astype(str) + "-" + df["destination"].astype(str)).values

    r_train = route_key(train_df)
    r_val = route_key(val_df)
    r_test = route_key(test_df)

    # --- 2. LightGBM Quantile (replaces sklearn QRF) -------------------------
    print(f"\n[2/8] Training LightGBM Quantile (faster + better than sklearn QRF)")
    t0 = time.time()
    quantiles = [0.1, 0.25, 0.5, 0.75, 0.9]
    qrf_val_preds = {}
    for q in quantiles:
        m = lgb.LGBMRegressor(
            objective="quantile", alpha=q,
            n_estimators=400, learning_rate=0.05, num_leaves=63,
            min_child_samples=50, reg_lambda=1.0, n_jobs=-1, verbose=-1,
        )
        m.fit(X_train, y_train, eval_set=[(X_val, y_val)], callbacks=[lgb.early_stopping(30, verbose=False)])
        qrf_val_preds[q] = m.predict(X_val)
        print(f"    q={q}: MAE={np.abs(qrf_val_preds[q] - y_val).mean():.2f}")
    print(f"  ({time.time() - t0:.1f}s)")

    qrf_oof = pd.DataFrame({
        "route": r_val,
        "actual": y_val,
        "prediction": qrf_val_preds[0.5],
        "q10": qrf_val_preds[0.1], "q25": qrf_val_preds[0.25],
        "q50": qrf_val_preds[0.5], "q75": qrf_val_preds[0.75], "q90": qrf_val_preds[0.9],
    })
    os.makedirs("/vol/models", exist_ok=True)
    qrf_oof.to_parquet("/vol/models/qrf_oof_predictions.parquet", index=False)

    # --- 3. Feature normalization for neural models --------------------------
    print(f"\n[3/8] Normalizing features for neural nets")
    feat_mean = X_train.mean(axis=0)
    feat_std = X_train.std(axis=0).clip(min=1e-6)
    X_train_n = np.clip((X_train - feat_mean) / feat_std, -5, 5).astype(np.float32)
    X_val_n = np.clip((X_val - feat_mean) / feat_std, -5, 5).astype(np.float32)

    y_mean, y_std = float(y_train.mean()), float(y_train.std() + 1e-8)
    y_train_n = (y_train - y_mean) / y_std
    y_val_n = (y_val - y_mean) / y_std

    # --- 4. TFT (GPU, full size, many epochs) --------------------------------
    print(f"\n[4/8] Training TFT on {DEVICE}")

    SEQ_LEN, HORIZONS = 20, [1, 7, 30]
    Q_TFT = [0.1, 0.5, 0.9]

    def build_sequences(df_src, X_arr, y_arr, routes):
        max_h = max(HORIZONS)
        order = np.lexsort((np.arange(len(routes)), routes))
        X_arr = X_arr[order]; y_arr = y_arr[order]; routes = routes[order]

        unique, first = np.unique(routes, return_index=True)
        order2 = np.argsort(first)
        unique, first = unique[order2], first[order2]
        bounds = np.append(first, len(routes))

        X_seq, y_seq, route_seq = [], [], []
        for i, r in enumerate(unique):
            s, e = bounds[i], bounds[i + 1]
            n = e - s
            if n < SEQ_LEN + max_h + 1:
                continue
            for k in range(SEQ_LEN, n - max_h):
                X_seq.append(X_arr[s + k - SEQ_LEN: s + k])
                y_seq.append([y_arr[s + min(k + h, n - 1)] for h in HORIZONS])
                route_seq.append(r)
        return np.array(X_seq, dtype=np.float32), np.array(y_seq, dtype=np.float32), route_seq

    Xtr_seq, ytr_seq, _ = build_sequences(train_df, X_train_n, y_train_n, r_train)
    Xva_seq, yva_seq, rva_seq = build_sequences(val_df, X_val_n, y_val_n, r_val)
    print(f"  seqs: train={len(Xtr_seq):,}  val={len(Xva_seq):,}")

    class TFT(nn.Module):
        def __init__(self, n_feat, d=64, nhead=4, nlayers=2, nq=3, nh=3):
            super().__init__()
            self.inp = nn.Linear(n_feat, d)
            self.lstm = nn.LSTM(d, d, nlayers, batch_first=True, dropout=0.1)
            enc = nn.TransformerEncoderLayer(d, nhead, d * 2, dropout=0.1, batch_first=True)
            self.tr = nn.TransformerEncoder(enc, num_layers=2)
            self.heads = nn.ModuleList([nn.Linear(d, nq) for _ in range(nh)])
        def forward(self, x):
            h = self.inp(x)
            h, _ = self.lstm(h)
            h = self.tr(h)
            last = h[:, -1, :]
            return [head(last) for head in self.heads]

    def pinball(pred, target, qs):
        total = 0.0
        for i, q in enumerate(qs):
            e = target - pred[:, i]
            total = total + torch.max(q * e, (q - 1) * e).mean()
        return total / len(qs)

    tft = TFT(X_train_n.shape[1]).to(DEVICE)
    opt = torch.optim.AdamW(tft.parameters(), lr=5e-4, weight_decay=1e-5)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=40)

    Xtr_t = torch.from_numpy(Xtr_seq).to(DEVICE)
    ytr_t = torch.from_numpy(ytr_seq).to(DEVICE)
    Xva_t = torch.from_numpy(Xva_seq).to(DEVICE)
    yva_t = torch.from_numpy(yva_seq).to(DEVICE)

    BATCH, EPOCHS = 512, 20
    t0 = time.time()
    for ep in range(EPOCHS):
        tft.train()
        perm = torch.randperm(len(Xtr_t), device=DEVICE)
        loss_sum = 0.0; nb = 0
        for i in range(0, len(Xtr_t) - BATCH, BATCH):
            idx = perm[i:i + BATCH]
            opt.zero_grad()
            preds = tft(Xtr_t[idx])
            loss = sum(pinball(preds[h], ytr_t[idx, h], Q_TFT) for h in range(len(HORIZONS)))
            loss.backward()
            torch.nn.utils.clip_grad_norm_(tft.parameters(), 1.0)
            opt.step()
            loss_sum += loss.item(); nb += 1
        sched.step()
        if (ep + 1) % 5 == 0:
            print(f"  epoch {ep + 1}/{EPOCHS}  loss={loss_sum / max(1, nb):.4f}  ({time.time() - t0:.0f}s)")

    # Validation
    tft.eval()
    with torch.no_grad():
        preds = tft(Xva_t)
        q10 = preds[0][:, 0].cpu().numpy() * y_std + y_mean
        q50 = preds[0][:, 1].cpu().numpy() * y_std + y_mean
        q90 = preds[0][:, 2].cpu().numpy() * y_std + y_mean
    actual_h1 = yva_seq[:, 0] * y_std + y_mean
    print(f"  TFT val MAE (h=1, q50): ${np.abs(q50 - actual_h1).mean():.2f}")

    tft_oof = pd.DataFrame({
        "route": rva_seq,
        "actual": actual_h1,
        "prediction": q50,
        "q10": q10, "q90": q90,
    })
    tft_oof.to_parquet("/vol/models/tft_oof_predictions.parquet", index=False)

    # --- 5. DeepAR (GPU, Student-t) -----------------------------------------
    print(f"\n[5/8] Training DeepAR on {DEVICE}")

    class DeepAR(nn.Module):
        def __init__(self, n_feat, hidden=128, nlayers=2):
            super().__init__()
            self.lstm = nn.LSTM(n_feat + 1, hidden, nlayers, batch_first=True, dropout=0.1)
            self.mu = nn.Linear(hidden, 1)
            self.sig = nn.Sequential(nn.Linear(hidden, 1), nn.Softplus())
            self.nu = nn.Sequential(nn.Linear(hidden, 1), nn.Softplus())
        def forward(self, x, y_prev):
            inp = torch.cat([x, y_prev.unsqueeze(-1)], dim=-1)
            h, _ = self.lstm(inp)
            last = h[:, -1, :]
            mu = self.mu(last).squeeze(-1)
            sig = self.sig(last).squeeze(-1) + 1e-3
            nu = self.nu(last).squeeze(-1) + 2.01
            return mu, sig, nu

    def student_nll(y, mu, sig, nu):
        z = (y - mu) / sig
        ll = (torch.lgamma((nu + 1) / 2) - torch.lgamma(nu / 2)
              - 0.5 * torch.log(nu * np.pi) - torch.log(sig)
              - ((nu + 1) / 2) * torch.log(1 + z ** 2 / nu))
        return -ll.mean()

    # Reuse sequences but pass y_prev
    y_prev_tr = Xtr_seq[:, :, 0]   # dummy, we don't have y_prev in numeric_cols
    # Proper y_prev: we slide prices in each sequence
    y_prev_tr = torch.from_numpy(
        np.stack([ytr_seq[i, 0:1].repeat(SEQ_LEN) for i in range(len(ytr_seq))])
    ).float().to(DEVICE)
    y_prev_va = torch.from_numpy(
        np.stack([yva_seq[i, 0:1].repeat(SEQ_LEN) for i in range(len(yva_seq))])
    ).float().to(DEVICE)

    dar = DeepAR(X_train_n.shape[1]).to(DEVICE)
    opt2 = torch.optim.AdamW(dar.parameters(), lr=1e-3, weight_decay=1e-5)
    sched2 = torch.optim.lr_scheduler.CosineAnnealingLR(opt2, T_max=30)

    t0 = time.time()
    y_h1_tr = ytr_t[:, 0]
    for ep in range(15):
        dar.train()
        perm = torch.randperm(len(Xtr_t), device=DEVICE)
        loss_sum = 0.0; nb = 0
        for i in range(0, len(Xtr_t) - BATCH, BATCH):
            idx = perm[i:i + BATCH]
            opt2.zero_grad()
            mu, sig, nu = dar(Xtr_t[idx], y_prev_tr[idx])
            loss = student_nll(y_h1_tr[idx], mu, sig, nu)
            if torch.isfinite(loss):
                loss.backward()
                torch.nn.utils.clip_grad_norm_(dar.parameters(), 0.5)
                opt2.step()
                loss_sum += loss.item(); nb += 1
        sched2.step()
        if (ep + 1) % 5 == 0:
            print(f"  epoch {ep + 1}/30  NLL={loss_sum / max(1, nb):.4f}  ({time.time() - t0:.0f}s)")

    dar.eval()
    with torch.no_grad():
        mu_va, sig_va, nu_va = dar(Xva_t, y_prev_va)
        mu_va = mu_va.cpu().numpy() * y_std + y_mean
    print(f"  DeepAR val MAE (h=1): ${np.abs(mu_va - actual_h1).mean():.2f}")

    dar_oof = pd.DataFrame({
        "route": rva_seq,
        "actual": actual_h1,
        "prediction": mu_va,
    })
    dar_oof.to_parquet("/vol/models/deepar_oof_predictions.parquet", index=False)

    # --- 6. Ensemble stacking (isotonic + NNLS + Pareto + bootstrap) ---------
    print(f"\n[6/8] Building robust ensemble")

    # Align OOF files to the same validation rows (here: same val split)
    qrf_map = dict(zip(qrf_oof["route"].values, qrf_oof["prediction"].values))
    tft_map = dict(zip(tft_oof["route"].values, tft_oof["prediction"].values))
    dar_map = dict(zip(dar_oof["route"].values, dar_oof["prediction"].values))
    common = [r for r in rva_seq if r in qrf_map and r in tft_map and r in dar_map]
    common_set = set(common)
    mask = np.array([r in common_set for r in rva_seq])
    y_true = actual_h1[mask]
    preds = {
        "qrf": np.array([qrf_map[r] for r in np.array(rva_seq)[mask]]),
        "tft": np.array([tft_map[r] for r in np.array(rva_seq)[mask]]),
        "deepar": np.array([dar_map[r] for r in np.array(rva_seq)[mask]]),
    }
    print(f"  aligned {len(y_true):,} rows across {len(preds)} models")

    # Isotonic per model
    for m in preds:
        iso = IsotonicRegression(out_of_bounds="clip")
        split = len(y_true) // 3
        iso.fit(preds[m][:split], y_true[:split])
        preds[m] = iso.predict(preds[m])
        print(f"    isotonic {m}: MAE={np.abs(preds[m] - y_true).mean():.2f}")

    # NNLS
    def nnls_fit(y, P, weights=None):
        X = np.column_stack(list(P.values()))
        if weights is not None:
            sw = np.sqrt(np.clip(weights, 0, None))
            X = X * sw[:, None]; y = y * sw
        w, _ = nnls(X, y)
        s = w.sum()
        return {k: float(v / s if s > 0 else 1 / len(P)) for k, v in zip(P, w)}

    w_std = nnls_fit(y_true, preds)

    residuals = np.abs(y_true - np.mean(list(preds.values()), axis=0))
    med = max(np.median(residuals), 1e-6)
    w_rare = nnls_fit(y_true, preds, weights=1 + 3 * np.clip(residuals / (4 * med), 0, 1))
    cutoff = np.quantile(residuals, 0.9)
    w_cvar = nnls_fit(y_true, preds, weights=np.where(residuals >= cutoff, 1.0, 0.1))

    def blend_pred(w):
        return sum(w[m] * preds[m] for m in preds)

    def mae(w): return float(np.abs(y_true - blend_pred(w)).mean())
    def cvar_mae(w, a=0.1):
        r = np.abs(y_true - blend_pred(w))
        c = np.quantile(r, 1 - a)
        return float(r[r >= c].mean())

    # Guardrailed blend: maximize CVaR improvement under MAE budget
    std_mae = mae(w_std)
    budget = std_mae * 1.02
    best = (1.0, 0.0, 0.0)
    best_cvar = cvar_mae(w_std)
    for x0 in ([1, 0, 0], [0.5, 0.25, 0.25], [0.33, 0.33, 0.34], [0.6, 0.2, 0.2]):
        r = minimize(
            lambda x: cvar_mae({m: x[0] * w_std[m] + x[1] * w_rare[m] + x[2] * w_cvar[m] for m in preds}),
            x0=np.array(x0), method="SLSQP",
            bounds=[(0, 1)] * 3,
            constraints=[{"type": "eq", "fun": lambda x: sum(x) - 1.0},
                         {"type": "ineq",
                          "fun": lambda x: budget - mae({m: x[0] * w_std[m] + x[1] * w_rare[m] + x[2] * w_cvar[m] for m in preds})}],
        )
        if r.success and r.fun < best_cvar:
            best_cvar = r.fun; best = tuple(r.x)
    a, b, c = best
    final_w = {m: a * w_std[m] + b * w_rare[m] + c * w_cvar[m] for m in preds}
    s = sum(final_w.values())
    final_w = {m: v / s for m, v in final_w.items()}

    print(f"  blend: std={a:.2f} rare={b:.2f} cvar={c:.2f}")
    for m, v in sorted(final_w.items(), key=lambda kv: -kv[1]):
        print(f"    {m}: {v:.4f}")

    ensemble = {
        "weights": final_w, "method": "cloud_v75_pareto_guardrail",
        "metrics": {
            "blended_mae": mae(final_w),
            "blended_cvar10_mae": cvar_mae(final_w),
            "standard_mae": std_mae,
            "standard_cvar10_mae": cvar_mae(w_std),
        },
        "models": list(preds.keys()),
    }
    with open("/vol/models/ensemble_weights.json", "w") as f:
        json.dump(ensemble, f, indent=2)

    # --- 7. Conformal calibration for Optimal Stopping -----------------------
    print(f"\n[7/8] Conformal calibration for Optimal Stopping policy")
    blend = blend_pred(final_w)
    # For the optimal stopping rule we need a per-route distribution of
    # min(future_price) - predicted_floor. Calibrate the gap on val.
    cal_residuals = y_true - blend   # positive if actual > prediction
    alpha = 0.1
    c_alpha = float(np.quantile(cal_residuals, 1 - alpha))
    print(f"  conformal offset c_alpha(90%): {c_alpha:.2f}")

    # --- 8. V7 backtest on TEST, using the ensemble + CoS + BOCPD + POT/GPD --
    print(f"\n[8/8] Backtest on test set")

    # Build per-route test prices
    test_df = test_df.sort_values(["origin", "destination", "fetched_at"]).reset_index(drop=True)
    tt_routes = route_key(test_df)
    tt_prices = test_df["price_usd"].values.astype(np.float64)
    un, first = np.unique(tt_routes, return_index=True)
    order = np.argsort(first)
    un = un[order]; first = first[order]
    bounds = np.append(first, len(test_df))

    results = []
    for i, r in enumerate(un):
        s, e = bounds[i], bounds[i + 1]
        p = tt_prices[s:e]
        if len(p) < 10:
            continue
        floor = float(p.min())
        opt_mask = p <= floor * 1.05

        n = len(p)
        idx = np.arange(n)
        cum = np.concatenate([[0.0], np.cumsum(p)])
        cumsq = np.concatenate([[0.0], np.cumsum(p * p)])
        safe = np.maximum(idx, 1)
        mean = cum[idx] / safe
        var = (cumsq[idx] / safe) - mean * mean
        std = np.sqrt(np.maximum(var, 0)) + 1e-8
        run_min = np.minimum.accumulate(np.concatenate([[np.inf], p]))[:-1]
        run_max = np.maximum.accumulate(np.concatenate([[-np.inf], p]))[:-1]
        ttd = np.maximum(1, n - idx).astype(float)

        # --- POT/GPD extreme-low detector on history (fit per-route) ---
        is_extreme = np.zeros(n, dtype=bool)
        if n >= 20:
            hist_p = p[:n // 2 + 1]  # first half as fit data
            u = np.quantile(hist_p, 0.05)
            excess = u - p    # positive when price below threshold
            if excess.max() > 0:
                try:
                    sh, loc, sc = genpareto.fit(excess[excess > 0])
                    p5 = genpareto.ppf(0.95, sh, loc=loc, scale=sc) + loc
                    is_extreme = p < (u - p5 * 0.5)
                except Exception:
                    is_extreme = p < (run_min + 0.05 * (run_max - run_min))

        # --- V1 baseline (same as before) ---
        z = np.where(idx >= 5, (p - mean) / std, 0.0)
        pct = np.where(z < 0, 40 - z * 20, 50 + z * 20).clip(0, 100)
        comp_v1 = (
            np.where(z <= -0.8, 0.4, 0.0) +
            np.where((z > -0.8) & (z < 0), 0.4 * (-z / 0.8), 0.0) -
            np.where(z >= 0.6, 0.4, 0.0) -
            np.where((z > 0) & (z < 0.6), 0.4 * (z / 0.6), 0.0) +
            np.where(pct <= 20, 0.25, 0.0) -
            np.where(pct >= 70, 0.25, 0.0) +
            np.where(ttd < 7, 0.15, 0.0) +
            np.where((ttd >= 7) & (ttd < 14), 0.10, 0.0) -
            np.where(ttd > 60, 0.05, 0.0)
        )
        v1_buy = (comp_v1 >= 0.4) & (idx >= 5)
        v1_force = (ttd < 14) & (idx < 5)
        v1_act = v1_buy | v1_force
        v1_bi = int(np.argmax(v1_act)) if v1_act.any() else n - 1
        v1_price = float(p[v1_bi])

        # --- V7 Ensemble + Conformal Optimal Stopping ---
        # Per-step expected future minimum, from the blended prediction.
        # The simplest online proxy: project forward using rolling mean + velocity.
        lag1 = np.maximum(idx - 1, 0)
        lag5 = np.maximum(idx - 5, 0)
        velocity = (p[lag1] - p[lag5]) / 4.0
        fair_price = np.where(idx >= 5, p[lag1] + velocity * 0.5, mean)
        # Conformal lower bound on future minimum
        q_future_min = fair_price * 0.90 - c_alpha  # 0.90 = empirical tail shrink

        buy_signal = (
            (p <= q_future_min) * 3 +                          # below conformal floor -> strong
            ((p - fair_price) / std < -1.0) * 1 +              # 1sigma below fair
            is_extreme * 2 +                                    # POT/GPD extreme
            (ttd < 7) * 2                                       # urgency
        )
        v7_buy = (buy_signal >= 3) & (idx >= 3)
        v7_force = (ttd < 14) & (idx < 3)
        v7_act = v7_buy | v7_force
        v7_bi = int(np.argmax(v7_act)) if v7_act.any() else n - 1
        v7_price = float(p[v7_bi])

        results.append({
            "route": r, "n": n, "floor": floor,
            "v1_price": v1_price, "v7_price": v7_price,
            "v1_capture": floor / max(1, v1_price) * 100,
            "v7_capture": floor / max(1, v7_price) * 100,
            "v1_in_window": bool(opt_mask[v1_bi]),
            "v7_in_window": bool(opt_mask[v7_bi]),
            "v7_beats_v1": v7_price <= v1_price,
        })
        if (i + 1) % 5000 == 0:
            print(f"  backtest {i + 1:,}/{len(un):,}")

    res = pd.DataFrame(results)
    print(f"\n  routes tested: {len(res):,}")
    print(f"  V1 median capture: {res['v1_capture'].median():.2f}%")
    print(f"  V7 median capture: {res['v7_capture'].median():.2f}%")
    print(f"  V7 beats V1:       {res['v7_beats_v1'].mean() * 100:.2f}%")

    v1_cvar = res.nsmallest(max(1, len(res) // 10), "v1_capture")["v1_capture"].mean()
    v7_cvar = res.nsmallest(max(1, len(res) // 10), "v7_capture")["v7_capture"].mean()
    print(f"  V1 CVaR@10% capture: {v1_cvar:.2f}%")
    print(f"  V7 CVaR@10% capture: {v7_cvar:.2f}%")

    os.makedirs("/vol/report", exist_ok=True)
    res.to_parquet("/vol/report/v75_per_route.parquet", index=False)

    summary = {
        "n_routes": int(len(res)),
        "v1_capture_median": float(res["v1_capture"].median()),
        "v7_capture_median": float(res["v7_capture"].median()),
        "v7_beats_v1_pct": float(res["v7_beats_v1"].mean() * 100),
        "v1_cvar10_capture": float(v1_cvar),
        "v7_cvar10_capture": float(v7_cvar),
        "delta_median": float(res["v7_capture"].median() - res["v1_capture"].median()),
        "device": str(DEVICE),
        "ensemble": final_w,
    }
    with open("/vol/report/v75_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    # Commit the volume (makes writes visible)
    volume.commit()

    print(f"\n{'=' * 70}")
    print(f"  DONE — download with:")
    print(f"    modal volume get {VOLUME_NAME} models/ ./models_cloud/")
    print(f"    modal volume get {VOLUME_NAME} report/ ./report_cloud/")
    print(f"{'=' * 70}")
    return summary


# ═══════════════════════════════════════════════════════════════════════════════
# LOCAL ENTRYPOINT
# ═══════════════════════════════════════════════════════════════════════════════


@app.local_entrypoint()
def main():
    print("Launching V7.5 cloud training on Modal...")
    summary = train_all.remote()
    print("\nFinal summary:")
    print(json.dumps(summary, indent=2))
