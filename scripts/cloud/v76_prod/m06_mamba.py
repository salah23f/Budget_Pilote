"""m06_mamba.py — Mamba/TimeMachine SSM (standalone)."""
import time
import modal

app = modal.App("flyeas-v76-mamba")
volume = modal.Volume.from_name("flyeas-v75", create_if_missing=True)

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "numpy==1.26.4", "pandas==2.2.2", "pyarrow==16.1.0",
    "torch==2.3.1", "mamba-ssm==2.2.2", "causal-conv1d==1.4.0",
)


@app.function(image=image, gpu="A100", volumes={"/vol": volume},
              timeout=2 * 60 * 60, memory=32 * 1024)
def run(seq_len: int = 64, d_model: int = 64, n_layers: int = 4,
        epochs: int = 15, batch: int = 256, lr: float = 5e-4):
    import os
    import numpy as np
    import pandas as pd
    import torch
    import torch.nn as nn

    try:
        from mamba_ssm import Mamba
    except ImportError:
        print("[mamba] mamba-ssm not available → fallback LSTM")
        Mamba = None

    os.makedirs("/vol/models_v76", exist_ok=True)
    DEV = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    def feat_cols(df):
        return [c for c in df.columns
                if df[c].dtype in (np.float64, np.float32, np.int64, np.int32)
                and c != "price_usd" and "id" not in c.lower()
                and not c.startswith("Unnamed")]

    tr = pd.read_parquet("/vol/features/train_features.parquet")
    va = pd.read_parquet("/vol/features/val_features.parquet")
    cols = feat_cols(tr)
    for df in (tr, va):
        df[cols] = df[cols].fillna(0).replace([np.inf, -np.inf], 0)

    mu = tr[cols].values.mean(axis=0).astype(np.float32)
    sd = tr[cols].values.std(axis=0).clip(min=1e-6).astype(np.float32)
    y_mu = float(tr["price_usd"].mean())
    y_sd = float(tr["price_usd"].std() + 1e-8)

    def make_seqs(df):
        df = df.sort_values(["origin", "destination", "fetched_at"]).reset_index(drop=True)
        r = (df["origin"].astype(str) + "-" + df["destination"].astype(str)).values
        un, first = np.unique(r, return_index=True)
        first = first[np.argsort(first)]
        un = r[first]
        bounds = np.append(first, len(df))
        X_n = np.clip((df[cols].values.astype(np.float32) - mu) / sd, -5, 5)
        y_n = (df["price_usd"].values.astype(np.float32) - y_mu) / y_sd
        X_all, y_all, r_all = [], [], []
        for i in range(len(un)):
            s, e = bounds[i], bounds[i + 1]
            n = e - s
            if n < seq_len + 1:
                continue
            for k in range(seq_len, n):
                X_all.append(X_n[s + k - seq_len:s + k])
                y_all.append(y_n[s + k])
                r_all.append(un[i])
        return (np.array(X_all, dtype=np.float32),
                np.array(y_all, dtype=np.float32), r_all)

    Xtr, ytr, _ = make_seqs(tr)
    Xva, yva, rva = make_seqs(va)

    class TM(nn.Module):
        def __init__(self, C, d, L, use_mamba=True):
            super().__init__()
            self.proj = nn.Linear(C, d)
            if use_mamba and Mamba is not None:
                self.core = nn.ModuleList([Mamba(d) for _ in range(L)])
                self.use_mamba = True
            else:
                self.lstm = nn.LSTM(d, d, L, batch_first=True, dropout=0.1)
                self.use_mamba = False
            self.head = nn.Linear(d, 1)

        def forward(self, x):
            h = self.proj(x)
            if self.use_mamba:
                for layer in self.core:
                    h = layer(h) + h
            else:
                h, _ = self.lstm(h)
            return self.head(h[:, -1]).squeeze(-1)

    model = TM(len(cols), d_model, n_layers).to(DEV)
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-5)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)

    Xtr_t = torch.from_numpy(Xtr).to(DEV)
    ytr_t = torch.from_numpy(ytr).to(DEV)
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
    CHUNK = 4096
    preds = []
    with torch.no_grad():
        for i in range(0, len(Xva_t), CHUNK):
            preds.append(model(Xva_t[i:i + CHUNK]).cpu().numpy())
    preds = np.concatenate(preds) * y_sd + y_mu
    actual = yva * y_sd + y_mu

    out = pd.DataFrame({"route": rva, "actual": actual, "prediction": preds})
    out.to_parquet("/vol/models_v76/mamba_oof_predictions.parquet", index=False)
    volume.commit()
    mae = float(np.abs(preds - actual).mean())
    print(f"[mamba] MAE={mae:.2f}")
    return {"status": "ok", "mae": mae}


@app.local_entrypoint()
def main():
    print(run.remote())
