"""m10_timegrad.py — TimeGrad-style diffusion (standalone)."""
import time
import modal

app = modal.App("flyeas-v76-timegrad")
volume = modal.Volume.from_name("flyeas-v75", create_if_missing=True)

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "numpy==1.26.4", "pandas==2.2.2", "pyarrow==16.1.0", "torch==2.3.1",
)


@app.function(image=image, gpu="A100", volumes={"/vol": volume},
              timeout=90 * 60, memory=16 * 1024)
def run(seq_len: int = 32, n_steps: int = 50, d_hidden: int = 128,
        epochs: int = 15, batch: int = 512, lr: float = 5e-4, n_samples: int = 30):
    import os
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
            if n < seq_len + 1:
                continue
            for k in range(seq_len, n):
                X.append(prices[s + k - seq_len:s + k])
                Y.append(prices[s + k])
                rl.append(un[i])
        return np.array(X, dtype=np.float32), np.array(Y, dtype=np.float32), rl

    Xtr, ytr, _ = pairs(tr)
    Xva, yva, rva = pairs(va)

    mu_x = Xtr.mean(axis=0); sd_x = Xtr.std(axis=0).clip(min=1e-6)
    mu_y = ytr.mean(); sd_y = ytr.std() + 1e-8
    Xtr_n = (Xtr - mu_x) / sd_x
    Xva_n = (Xva - mu_x) / sd_x
    ytr_n = (ytr - mu_y) / sd_y

    def cos_betas(T):
        steps = torch.arange(T + 1, dtype=torch.float32) / T
        ab = torch.cos((steps + 0.008) / 1.008 * np.pi / 2) ** 2
        ab = ab / ab[0]
        return (1 - ab[1:] / ab[:-1]).clamp(min=1e-4, max=0.999)

    betas = cos_betas(n_steps).to(DEV)
    alphas = 1 - betas
    ab = torch.cumprod(alphas, dim=0)

    class DN(nn.Module):
        def __init__(self, d_ctx, d=d_hidden):
            super().__init__()
            self.ctx = nn.Linear(d_ctx, d)
            self.t_emb = nn.Sequential(nn.Linear(1, d), nn.GELU())
            self.x_emb = nn.Linear(1, d)
            self.net = nn.Sequential(nn.Linear(d * 3, d), nn.GELU(), nn.Linear(d, d),
                                      nn.GELU(), nn.Linear(d, 1))
        def forward(self, x_t, t, c):
            ex = self.x_emb(x_t.unsqueeze(-1))
            et = self.t_emb(t.float().unsqueeze(-1) / n_steps)
            ec = self.ctx(c)
            return self.net(torch.cat([ex, et, ec], dim=-1)).squeeze(-1)

    model = DN(seq_len).to(DEV)
    opt = torch.optim.AdamW(model.parameters(), lr=lr)

    Xtr_t = torch.from_numpy(Xtr_n).to(DEV)
    ytr_t = torch.from_numpy(ytr_n).to(DEV)

    t0 = time.time()
    for ep in range(epochs):
        model.train()
        perm = torch.randperm(len(Xtr_t), device=DEV)
        loss_sum = 0.0; nb = 0
        for i in range(0, len(Xtr_t) - batch, batch):
            idx = perm[i:i + batch]
            x0 = ytr_t[idx]; c = Xtr_t[idx]
            t = torch.randint(0, n_steps, (x0.size(0),), device=DEV)
            abt = ab[t]
            noise = torch.randn_like(x0)
            x_t = abt.sqrt() * x0 + (1 - abt).sqrt() * noise
            pred = model(x_t, t, c)
            loss = ((pred - noise) ** 2).mean()
            if not torch.isfinite(loss):
                continue
            opt.zero_grad(); loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            loss_sum += loss.item(); nb += 1
        if (ep + 1) % 3 == 0:
            print(f"  ep {ep+1}/{epochs} loss={loss_sum/max(1,nb):.4f} ({time.time()-t0:.0f}s)")

    @torch.no_grad()
    def sample(c, n):
        x = torch.randn(n, device=DEV)
        for t in reversed(range(n_steps)):
            tb = torch.full((n,), t, device=DEV, dtype=torch.long)
            eps = model(x, tb, c)
            abt = ab[t]
            abp = ab[t - 1] if t > 0 else torch.tensor(1.0, device=DEV)
            a = alphas[t]
            mean = (1 / a.sqrt()) * (x - (betas[t] / (1 - abt).sqrt()) * eps)
            if t > 0:
                var = betas[t] * (1 - abp) / (1 - abt)
                x = mean + var.sqrt() * torch.randn_like(x)
            else:
                x = mean
        return x

    Xva_t = torch.from_numpy(Xva_n).to(DEV)
    q10l, q50l, q90l = [], [], []
    CHUNK = 1024
    for i in range(0, len(Xva_t), CHUNK):
        c = Xva_t[i:i + CHUNK]
        samples = np.stack([sample(c, c.size(0)).cpu().numpy() for _ in range(n_samples)], axis=0)
        q10l.extend(np.quantile(samples, 0.1, axis=0))
        q50l.extend(np.quantile(samples, 0.5, axis=0))
        q90l.extend(np.quantile(samples, 0.9, axis=0))

    q10 = np.array(q10l) * sd_y + mu_y
    q50 = np.array(q50l) * sd_y + mu_y
    q90 = np.array(q90l) * sd_y + mu_y

    out = pd.DataFrame({"route": rva, "actual": yva, "prediction": q50,
                         "q10": q10, "q90": q90})
    out.to_parquet("/vol/models_v76/timegrad_oof_predictions.parquet", index=False)
    volume.commit()
    mae = float(np.abs(q50 - yva).mean())
    print(f"[timegrad] MAE={mae:.2f}")
    return {"status": "ok", "mae": mae}


@app.local_entrypoint()
def main():
    print(run.remote())
