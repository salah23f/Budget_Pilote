"""
iqn_policy.py — Implicit Quantile Networks for distributional buy/wait policy.

Instead of predicting a single expected future price, IQN learns the full
quantile function of `future_min_price - current_price`. The policy at
inference uses CVaR (left-tail average) to decide BUY vs WAIT:
    BUY if CVaR_alpha(future_min - current_price) ≥ 0

Run:
    modal run scripts/cloud/v76_ultra/policy/iqn_policy.py
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import app, volume, gpu_image, load_split, route_key, MODELS_DIR, ensure_dirs, seed_everything


@app.function(
    image=gpu_image,
    gpu="A10G",
    volumes={"/vol": volume},
    timeout=90 * 60,
    memory=16 * 1024,
)
def train_iqn(seq_len: int = 32, d_hidden: int = 128, n_cos: int = 64,
              epochs: int = 20, batch: int = 512, lr: float = 5e-4,
              alpha_cvar: float = 0.15):
    import os, json
    import numpy as np
    import pandas as pd
    import torch
    import torch.nn as nn

    ensure_dirs()
    seed_everything(42)
    DEV = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    tr = load_split("train")
    va = load_split("val")

    def make_pairs(df):
        df = df.sort_values(["origin", "destination", "fetched_at"]).reset_index(drop=True)
        r = route_key(df)
        un, first = np.unique(r, return_index=True)
        first = first[np.argsort(first)]
        un = r[first]
        bounds = np.append(first, len(df))
        prices = df["price_usd"].values.astype(np.float32)
        X, Y, rlist = [], [], []
        for i in range(len(un)):
            s, e = bounds[i], bounds[i + 1]
            n = e - s
            if n < seq_len + 2:
                continue
            # Target = future-min price minus the current price,
            # to give the policy an explicit "how much can I still save?" signal.
            for k in range(seq_len, n - 1):
                history = prices[s + k - seq_len:s + k]
                cur = prices[s + k]
                fut_min = prices[s + k:s + k + min(30, e - s - k)].min()
                X.append(np.concatenate([history, [cur]]))
                Y.append(fut_min - cur)
                rlist.append(un[i])
        return np.array(X, dtype=np.float32), np.array(Y, dtype=np.float32), rlist

    print("[iqn] building (state, reward) pairs...")
    Xtr, ytr, _ = make_pairs(tr)
    Xva, yva, rva = make_pairs(va)

    mu_x = Xtr.mean(axis=0); sd_x = Xtr.std(axis=0).clip(min=1e-6)
    Xtr_n = (Xtr - mu_x) / sd_x
    Xva_n = (Xva - mu_x) / sd_x
    mu_y, sd_y = ytr.mean(), ytr.std() + 1e-8
    ytr_n = (ytr - mu_y) / sd_y

    class IQN(nn.Module):
        """Given state s and quantile tau ∈ [0,1], predict Q(s, tau) = F^{-1}(tau|s)."""
        def __init__(self, d_state, d=d_hidden, n_cos=n_cos):
            super().__init__()
            self.psi = nn.Sequential(nn.Linear(d_state, d), nn.GELU(),
                                      nn.Linear(d, d))
            self.phi = nn.Linear(n_cos, d)
            self.head = nn.Sequential(nn.Linear(d, d), nn.GELU(),
                                       nn.Linear(d, 1))
            self.n_cos = n_cos
        def cos_embed(self, tau):
            idx = torch.arange(1, self.n_cos + 1, device=tau.device, dtype=torch.float32)
            return torch.cos(tau.unsqueeze(-1) * idx * 3.14159265)
        def forward(self, state, tau):
            psi = self.psi(state)
            phi = self.phi(self.cos_embed(tau))
            h = psi * phi
            return self.head(h).squeeze(-1)

    model = IQN(Xtr_n.shape[1]).to(DEV)
    opt = torch.optim.AdamW(model.parameters(), lr=lr)

    Xtr_t = torch.from_numpy(Xtr_n).to(DEV)
    ytr_t = torch.from_numpy(ytr_n).to(DEV)

    def pinball(q_pred, y, tau):
        err = y - q_pred
        return torch.max(tau * err, (tau - 1) * err).mean()

    t0 = time.time()
    for ep in range(epochs):
        model.train()
        perm = torch.randperm(len(Xtr_t), device=DEV)
        loss_sum = 0.0; nb = 0
        for i in range(0, len(Xtr_t) - batch, batch):
            idx = perm[i:i + batch]
            state = Xtr_t[idx]
            y = ytr_t[idx]
            tau = torch.rand(state.size(0), device=DEV)
            q = model(state, tau)
            loss = pinball(q, y, tau)
            if not torch.isfinite(loss):
                continue
            opt.zero_grad(); loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            loss_sum += loss.item(); nb += 1
        if (ep + 1) % 3 == 0:
            print(f"  ep {ep+1}/{epochs}  loss={loss_sum/max(1,nb):.4f}  ({time.time()-t0:.0f}s)")

    # Evaluate CVaR: for each val state, sample 50 taus in [0, alpha_cvar]
    # and take the mean of predicted quantiles → left-tail (worst case regret).
    model.eval()
    Xva_t = torch.from_numpy(Xva_n).to(DEV)
    cvar_preds = []
    median_preds = []
    CHUNK = 2048
    with torch.no_grad():
        for i in range(0, len(Xva_t), CHUNK):
            state = Xva_t[i:i + CHUNK]
            B = state.size(0)
            taus = torch.rand(B, 50, device=DEV) * alpha_cvar
            state_rep = state.unsqueeze(1).expand(-1, 50, -1).reshape(B * 50, -1)
            taus_flat = taus.reshape(-1)
            q = model(state_rep, taus_flat).reshape(B, 50)
            cvar_preds.extend(q.mean(dim=1).cpu().numpy())
            # Median quantile for reference
            tau50 = torch.full((B,), 0.5, device=DEV)
            q50 = model(state, tau50).cpu().numpy()
            median_preds.extend(q50)

    cvar_pred = np.array(cvar_preds) * sd_y + mu_y
    median_pred = np.array(median_preds) * sd_y + mu_y

    # Save predictions as "iqn" OOF (prediction = q50 of future_min − cur,
    # plus extra CVaR column for policy)
    oof = pd.DataFrame({
        "route": rva,
        "actual": yva,                  # actual fut_min - current
        "prediction": median_pred,
        "cvar10": cvar_pred,
    })
    oof.to_parquet(f"{MODELS_DIR}/iqn_oof_predictions.parquet", index=False)
    with open(f"{MODELS_DIR}/iqn_meta.json", "w") as f:
        json.dump({"alpha_cvar": alpha_cvar,
                    "n_samples": int(len(oof))}, f, indent=2)
    volume.commit()
    print(f"[iqn] val MAE(q50) = {float(np.abs(median_pred - yva).mean()):.2f}")
    return {"status": "ok"}


# Standalone: modal run scripts/cloud/v76_ultra/policy/iqn_policy.py::train_iqn
