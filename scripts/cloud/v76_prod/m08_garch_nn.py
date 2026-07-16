"""m08_garch_nn.py — GARCH-Informed Neural Network (standalone)."""
import time
import modal

app = modal.App("flyeas-v76-garch-nn")
volume = modal.Volume.from_name("flyeas-v75", create_if_missing=True)

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "numpy==1.26.4", "pandas==2.2.2", "pyarrow==16.1.0",
    "torch==2.3.1", "arch==6.3.0",
)


@app.function(image=image, gpu="A10G", volumes={"/vol": volume},
              timeout=90 * 60, memory=16 * 1024)
def run(context_len: int = 64, epochs: int = 15, batch: int = 256, lr: float = 5e-4):
    import os
    import numpy as np
    import pandas as pd
    import torch
    import torch.nn as nn
    from arch import arch_model

    os.makedirs("/vol/models_v76", exist_ok=True)
    DEV = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    tr = pd.read_parquet("/vol/features/train_features.parquet")
    va = pd.read_parquet("/vol/features/val_features.parquet")

    def build_feats(df):
        df = df.sort_values(["origin", "destination", "fetched_at"]).reset_index(drop=True)
        r = (df["origin"].astype(str) + "-" + df["destination"].astype(str)).values
        un, first = np.unique(r, return_index=True)
        first = first[np.argsort(first)]
        un = r[first]
        bounds = np.append(first, len(df))
        prices = df["price_usd"].values.astype(np.float64)
        X, Y, rl = [], [], []
        for i in range(len(un)):
            s, e = bounds[i], bounds[i + 1]
            n = e - s
            if n < context_len + 2:
                continue
            rp = prices[s:e]
            rets = np.diff(np.log(np.maximum(rp, 1.0)))
            try:
                am = arch_model(rets[:context_len] * 100, vol="GARCH", p=1, q=1,
                                 mean="zero", dist="normal")
                res = am.fit(disp="off", show_warning=False, last_obs=None)
                omega = float(res.params.get("omega", 0.0))
                alpha = float(res.params.get("alpha[1]", 0.0))
                beta = float(res.params.get("beta[1]", 0.0))
            except Exception:
                omega, alpha, beta = 0.0, 0.1, 0.8
            for k in range(context_len + 1, n):
                w = rp[k - context_len:k]
                feat = np.concatenate([
                    np.log(w),
                    np.diff(np.log(np.maximum(w, 1))),
                    [omega, alpha, beta],
                    [float(np.log(max(rp[k - 1], 1))),
                     float(np.log(w).mean()),
                     float(np.log(w).std())],
                ]).astype(np.float32)
                X.append(feat); Y.append(rp[k]); rl.append(un[i])
        return np.array(X, dtype=np.float32), np.array(Y, dtype=np.float32), rl

    print("[garch-nn] building features...")
    Xtr, ytr, _ = build_feats(tr)
    Xva, yva, rva = build_feats(va)
    print(f"  train={len(Xtr):,} val={len(Xva):,} dim={Xtr.shape[1]}")

    mu_y, sd_y = float(ytr.mean()), float(ytr.std() + 1e-8)
    ytr_n = (ytr - mu_y) / sd_y

    class GINN(nn.Module):
        def __init__(self, d_in, d=128):
            super().__init__()
            self.net = nn.Sequential(
                nn.Linear(d_in, d), nn.GELU(), nn.Dropout(0.1),
                nn.Linear(d, d), nn.GELU(), nn.Dropout(0.1),
                nn.Linear(d, 1),
            )
        def forward(self, x):
            return self.net(x).squeeze(-1)

    model = GINN(Xtr.shape[1]).to(DEV)
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-5)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)

    Xtr_t = torch.from_numpy(Xtr).to(DEV)
    ytr_t = torch.from_numpy(ytr_n).to(DEV)
    Xva_t = torch.from_numpy(Xva).to(DEV)

    t0 = time.time()
    for ep in range(epochs):
        model.train()
        perm = torch.randperm(len(Xtr_t), device=DEV)
        loss_sum = 0.0; nb = 0
        for i in range(0, len(Xtr_t) - batch, batch):
            idx = perm[i:i + batch]
            opt.zero_grad()
            pred = model(Xtr_t[idx])
            loss = ((pred - ytr_t[idx]) ** 2).mean()
            if not torch.isfinite(loss):
                continue
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            loss_sum += loss.item(); nb += 1
        sched.step()
        if (ep + 1) % 3 == 0:
            print(f"  ep {ep+1}/{epochs} loss={loss_sum/max(1,nb):.4f} ({time.time()-t0:.0f}s)")

    model.eval()
    with torch.no_grad():
        preds = model(Xva_t).cpu().numpy() * sd_y + mu_y

    out = pd.DataFrame({"route": rva, "actual": yva, "prediction": preds})
    out.to_parquet("/vol/models_v76/garch_nn_oof_predictions.parquet", index=False)
    volume.commit()
    mae = float(np.abs(preds - yva).mean())
    print(f"[garch-nn] MAE={mae:.2f}")
    return {"status": "ok", "mae": mae}


@app.local_entrypoint()
def main():
    print(run.remote())
