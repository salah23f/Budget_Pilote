"""m11_ts2vec.py — TS2Vec self-supervised + linear readout (standalone)."""
import time
import modal

app = modal.App("flyeas-v76-ts2vec")
volume = modal.Volume.from_name("flyeas-v75", create_if_missing=True)

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "numpy==1.26.4", "pandas==2.2.2", "pyarrow==16.1.0", "torch==2.3.1",
)


@app.function(image=image, gpu="A100", volumes={"/vol": volume},
              timeout=2 * 60 * 60, memory=24 * 1024)
def run(seq_len: int = 64, d_repr: int = 64, epochs: int = 10,
        batch: int = 512, lr: float = 3e-4, tau: float = 0.1, head_epochs: int = 10):
    import os
    import numpy as np
    import pandas as pd
    import torch
    import torch.nn as nn

    os.makedirs("/vol/models_v76", exist_ok=True)
    DEV = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    tr = pd.read_parquet("/vol/features/train_features.parquet")
    va = pd.read_parquet("/vol/features/val_features.parquet")

    def seqs(df):
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
            if n < seq_len + 1:
                continue
            for k in range(seq_len, n):
                X.append(prices[s + k - seq_len:s + k])
                Y.append(prices[s + k])
                rl.append(un[i])
        return np.array(X, dtype=np.float32), np.array(Y, dtype=np.float32), rl

    Xtr, ytr, _ = seqs(tr)
    Xva, yva, rva = seqs(va)

    mu = Xtr.mean(); sd = Xtr.std() + 1e-8
    Xtr_n = (Xtr - mu) / sd
    Xva_n = (Xva - mu) / sd
    y_mu = ytr.mean(); y_sd = ytr.std() + 1e-8

    class Enc(nn.Module):
        def __init__(self, d=d_repr):
            super().__init__()
            self.net = nn.Sequential(
                nn.Conv1d(1, 32, 3, padding=1), nn.GELU(),
                nn.Conv1d(32, 64, 3, padding=1), nn.GELU(),
                nn.Conv1d(64, d, 3, padding=1), nn.GELU(),
            )
            self.pool = nn.AdaptiveAvgPool1d(1)
        def forward(self, x):
            h = self.net(x.unsqueeze(1))
            return self.pool(h).squeeze(-1)

    encoder = Enc().to(DEV)

    def augment(x):
        mask = torch.rand_like(x) < 0.15
        x2 = x.clone()
        x2[mask] = 0.0
        x2 = x2 + 0.02 * torch.randn_like(x2)
        return x2

    def nt_xent(z1, z2, tau):
        z1 = nn.functional.normalize(z1, dim=-1)
        z2 = nn.functional.normalize(z2, dim=-1)
        B = z1.size(0)
        sim = torch.mm(z1, z2.t()) / tau
        labels = torch.arange(B, device=z1.device)
        return (nn.functional.cross_entropy(sim, labels) +
                 nn.functional.cross_entropy(sim.t(), labels)) / 2

    opt = torch.optim.AdamW(encoder.parameters(), lr=lr)
    Xtr_t = torch.from_numpy(Xtr_n).to(DEV)

    t0 = time.time()
    for ep in range(epochs):
        encoder.train()
        perm = torch.randperm(len(Xtr_t), device=DEV)
        loss_sum = 0.0; nb = 0
        for i in range(0, len(Xtr_t) - batch, batch):
            idx = perm[i:i + batch]
            a, b = augment(Xtr_t[idx]), augment(Xtr_t[idx])
            loss = nt_xent(encoder(a), encoder(b), tau)
            if not torch.isfinite(loss):
                continue
            opt.zero_grad(); loss.backward(); opt.step()
            loss_sum += loss.item(); nb += 1
        if (ep + 1) % 2 == 0:
            print(f"  pretrain {ep+1}/{epochs} loss={loss_sum/max(1,nb):.4f} ({time.time()-t0:.0f}s)")

    for p in encoder.parameters():
        p.requires_grad_(False)

    head = nn.Linear(d_repr, 1).to(DEV)
    opt2 = torch.optim.Adam(head.parameters(), lr=3e-3)
    ytr_n = torch.from_numpy((ytr - y_mu) / y_sd).to(DEV)

    for ep in range(head_epochs):
        head.train()
        perm = torch.randperm(len(Xtr_t), device=DEV)
        loss_sum = 0.0; nb = 0
        for i in range(0, len(Xtr_t) - batch, batch):
            idx = perm[i:i + batch]
            with torch.no_grad():
                z = encoder(Xtr_t[idx])
            pred = head(z).squeeze(-1)
            loss = ((pred - ytr_n[idx]) ** 2).mean()
            if not torch.isfinite(loss):
                continue
            opt2.zero_grad(); loss.backward(); opt2.step()
            loss_sum += loss.item(); nb += 1

    head.eval(); encoder.eval()
    Xva_t = torch.from_numpy(Xva_n).to(DEV)
    CHUNK = 2048
    preds = []
    with torch.no_grad():
        for i in range(0, len(Xva_t), CHUNK):
            z = encoder(Xva_t[i:i + CHUNK])
            preds.append(head(z).squeeze(-1).cpu().numpy())
    preds = np.concatenate(preds) * y_sd + y_mu

    out = pd.DataFrame({"route": rva, "actual": yva, "prediction": preds})
    out.to_parquet("/vol/models_v76/ts2vec_oof_predictions.parquet", index=False)
    volume.commit()
    mae = float(np.abs(preds - yva).mean())
    print(f"[ts2vec] MAE={mae:.2f}")
    return {"status": "ok", "mae": mae}


@app.local_entrypoint()
def main():
    print(run.remote())
