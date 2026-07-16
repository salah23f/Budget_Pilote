"""m09_mlcaformer.py — Multi-Level Causal Attention Transformer (standalone)."""
import time
import modal

app = modal.App("flyeas-v76-mlcaformer")
volume = modal.Volume.from_name("flyeas-v75", create_if_missing=True)

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "numpy==1.26.4", "pandas==2.2.2", "pyarrow==16.1.0", "torch==2.3.1",
)


@app.function(image=image, gpu="A100", volumes={"/vol": volume},
              timeout=2 * 60 * 60, memory=32 * 1024)
def run(seq_len: int = 64, d_model: int = 64, n_heads: int = 4, n_scales: int = 3,
        epochs: int = 20, batch: int = 512, lr: float = 5e-4):
    import os
    import numpy as np
    import pandas as pd
    import torch
    import torch.nn as nn

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
    print(f"[mlcaformer] train={len(Xtr):,} val={len(Xva):,}")

    class CA(nn.Module):
        def __init__(self, d, h):
            super().__init__()
            self.a = nn.MultiheadAttention(d, h, batch_first=True, dropout=0.1)
        def forward(self, x):
            T = x.size(1)
            m = torch.triu(torch.ones(T, T, device=x.device), diagonal=1).bool()
            o, _ = self.a(x, x, x, attn_mask=m)
            return o

    class MLC(nn.Module):
        def __init__(self, C, d, h, scales):
            super().__init__()
            self.proj = nn.Linear(C, d)
            self.scales = [2 ** i for i in range(scales)]
            self.attns = nn.ModuleList([CA(d, h) for _ in self.scales])
            self.norm = nn.LayerNorm(d)
            self.head = nn.Sequential(nn.Linear(d * len(self.scales), d),
                                       nn.GELU(), nn.Linear(d, 1))
        def forward(self, x):
            h = self.proj(x)
            outs = []
            for s, a in zip(self.scales, self.attns):
                if s == 1:
                    pooled = h
                else:
                    pooled = h.unfold(1, s, s).mean(dim=-1)
                z = a(self.norm(pooled))
                outs.append(z[:, -1])
            return self.head(torch.cat(outs, dim=-1)).squeeze(-1)

    model = MLC(len(cols), d_model, n_heads, n_scales).to(DEV)
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
        if (ep + 1) % 5 == 0:
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
    out.to_parquet("/vol/models_v76/mlcaformer_oof_predictions.parquet", index=False)
    volume.commit()
    mae = float(np.abs(preds - actual).mean())
    print(f"[mlcaformer] MAE={mae:.2f}")
    return {"status": "ok", "mae": mae}


@app.local_entrypoint()
def main():
    print(run.remote())
