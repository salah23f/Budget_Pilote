"""p02_iqn.py — Implicit Quantile Network distributional policy (standalone)."""
import time
import modal

app = modal.App("flyeas-v76-iqn")
volume = modal.Volume.from_name("flyeas-v75", create_if_missing=True)

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "numpy==1.26.4", "pandas==2.2.2", "pyarrow==16.1.0", "torch==2.3.1",
)


@app.function(image=image, gpu="A10G", volumes={"/vol": volume},
              timeout=90 * 60, memory=16 * 1024)
def run(seq_len: int = 32, d_hidden: int = 128, n_cos: int = 64,
        epochs: int = 12, batch: int = 512, lr: float = 5e-4, alpha_cvar: float = 0.1):
    import os
    import json
    import numpy as np
    import pandas as pd
    import torch
    import torch.nn as nn

    os.makedirs("/vol/models_v76", exist_ok=True)
    DEV = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    tr = pd.read_parquet("/vol/features/train_features.parquet")
    va = pd.read_parquet("/vol/features/val_features.parquet")

    def pairs(df):
        df = df.sort_values(["origin", "destination", "fetched_at"]).reset_index(drop=True)
        r = (df["origin"].astype(str) + "-" + df["destination"].astype(str)).values
        un, first = np.unique(r, return_index=True)
        first = first[np.argsort(first)]
        un = r[first]
        bounds = np.append(first, len(df))
        prices = df["price_usd"].values.astype(np.float32)
        X, Y, rl = [], [], []
        for i in range(len(un)):
            s, e = bounds[i], bounds[i + 1]
            n = e - s
            if n < seq_len + 2:
                continue
            for k in range(seq_len, n - 1):
                hist = prices[s + k - seq_len:s + k]
                cur = prices[s + k]
                fm = prices[s + k:s + k + min(30, e - s - k)].min()
                X.append(np.concatenate([hist, [cur]]))
                Y.append(fm - cur); rl.append(un[i])
        return np.array(X, dtype=np.float32), np.array(Y, dtype=np.float32), rl

    Xtr, ytr, _ = pairs(tr)
    Xva, yva, rva = pairs(va)

    mu_x = Xtr.mean(axis=0); sd_x = Xtr.std(axis=0).clip(min=1e-6)
    Xtr_n = (Xtr - mu_x) / sd_x
    Xva_n = (Xva - mu_x) / sd_x
    mu_y, sd_y = ytr.mean(), ytr.std() + 1e-8
    ytr_n = (ytr - mu_y) / sd_y

    class IQN(nn.Module):
        def __init__(self, d_state, d=d_hidden, n_cos=n_cos):
            super().__init__()
            self.psi = nn.Sequential(nn.Linear(d_state, d), nn.GELU(), nn.Linear(d, d))
            self.phi = nn.Linear(n_cos, d)
            self.head = nn.Sequential(nn.Linear(d, d), nn.GELU(), nn.Linear(d, 1))
            self.n_cos = n_cos
        def cos_embed(self, tau):
            idx = torch.arange(1, self.n_cos + 1, device=tau.device, dtype=torch.float32)
            return torch.cos(tau.unsqueeze(-1) * idx * 3.14159265)
        def forward(self, state, tau):
            return self.head(self.psi(state) * self.phi(self.cos_embed(tau))).squeeze(-1)

    model = IQN(Xtr_n.shape[1]).to(DEV)
    opt = torch.optim.AdamW(model.parameters(), lr=lr)

    Xtr_t = torch.from_numpy(Xtr_n).to(DEV)
    ytr_t = torch.from_numpy(ytr_n).to(DEV)

    def pinball(qp, y, tau):
        err = y - qp
        return torch.max(tau * err, (tau - 1) * err).mean()

    t0 = time.time()
    for ep in range(epochs):
        model.train()
        perm = torch.randperm(len(Xtr_t), device=DEV)
        loss_sum = 0.0; nb = 0
        for i in range(0, len(Xtr_t) - batch, batch):
            idx = perm[i:i + batch]
            state = Xtr_t[idx]; y = ytr_t[idx]
            tau = torch.rand(state.size(0), device=DEV)
            loss = pinball(model(state, tau), y, tau)
            if not torch.isfinite(loss):
                continue
            opt.zero_grad(); loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            loss_sum += loss.item(); nb += 1
        if (ep + 1) % 3 == 0:
            print(f"  ep {ep+1}/{epochs} loss={loss_sum/max(1,nb):.4f} ({time.time()-t0:.0f}s)")

    model.eval()
    Xva_t = torch.from_numpy(Xva_n).to(DEV)
    cvar_preds, median_preds = [], []
    CHUNK = 2048
    with torch.no_grad():
        for i in range(0, len(Xva_t), CHUNK):
            state = Xva_t[i:i + CHUNK]
            B = state.size(0)
            taus = torch.rand(B, 50, device=DEV) * alpha_cvar
            sr = state.unsqueeze(1).expand(-1, 50, -1).reshape(B * 50, -1)
            q = model(sr, taus.reshape(-1)).reshape(B, 50)
            cvar_preds.extend(q.mean(dim=1).cpu().numpy())
            tau50 = torch.full((B,), 0.5, device=DEV)
            median_preds.extend(model(state, tau50).cpu().numpy())

    cvar = np.array(cvar_preds) * sd_y + mu_y
    med = np.array(median_preds) * sd_y + mu_y

    out = pd.DataFrame({"route": rva, "actual": yva,
                         "prediction": med, "cvar10": cvar})
    out.to_parquet("/vol/models_v76/iqn_oof_predictions.parquet", index=False)
    with open("/vol/models_v76/iqn_meta.json", "w") as f:
        json.dump({"alpha_cvar": alpha_cvar, "n_samples": int(len(out))}, f, indent=2)
    volume.commit()
    print(f"[iqn] MAE(q50)={float(np.abs(med - yva).mean()):.2f}")
    return {"status": "ok"}


@app.local_entrypoint()
def main():
    print(run.remote())
