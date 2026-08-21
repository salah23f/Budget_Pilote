"""m07_kan.py — Kolmogorov-Arnold Network (standalone)."""
import time
import modal

app = modal.App("flyeas-v76-kan")
volume = modal.Volume.from_name("flyeas-v75", create_if_missing=True)

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "numpy==1.26.4", "pandas==2.2.2", "pyarrow==16.1.0",
    "torch==2.3.1", "pykan==0.2.8",
)


@app.function(image=image, gpu="A10G", volumes={"/vol": volume},
              timeout=60 * 60, memory=16 * 1024)
def run(seq_len: int = 32, hidden: int = 32, epochs: int = 10, batch: int = 1024, lr: float = 1e-3):
    import os
    import numpy as np
    import pandas as pd
    import torch
    import torch.nn as nn

    try:
        from kan import KAN
    except ImportError:
        print("[kan] pykan not available")
        return {"status": "skipped"}

    os.makedirs("/vol/models_v76", exist_ok=True)
    DEV = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    tr = pd.read_parquet("/vol/features/train_features.parquet")
    va = pd.read_parquet("/vol/features/val_features.parquet")

    def flatten(df):
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

    Xtr, ytr, _ = flatten(tr)
    Xva, yva, rva = flatten(va)

    mu_x = Xtr.mean(axis=0); sd_x = Xtr.std(axis=0).clip(min=1e-6)
    mu_y = ytr.mean(); sd_y = ytr.std() + 1e-8
    Xtr_n = (Xtr - mu_x) / sd_x
    Xva_n = (Xva - mu_x) / sd_x
    ytr_n = (ytr - mu_y) / sd_y

    try:
        model = KAN(width=[seq_len, hidden, 1], grid=5, k=3, device=str(DEV))
    except Exception as e:
        print(f"[kan] init failed: {e}")
        return {"status": "skipped", "reason": str(e)}

    Xtr_t = torch.from_numpy(Xtr_n).to(DEV).float()
    ytr_t = torch.from_numpy(ytr_n).to(DEV).float().unsqueeze(-1)
    Xva_t = torch.from_numpy(Xva_n).to(DEV).float()

    opt = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.MSELoss()

    t0 = time.time()
    for ep in range(epochs):
        perm = torch.randperm(len(Xtr_t))
        loss_sum = 0.0; nb = 0
        for i in range(0, len(Xtr_t) - batch, batch):
            idx = perm[i:i + batch]
            opt.zero_grad()
            pred = model(Xtr_t[idx])
            loss = loss_fn(pred, ytr_t[idx])
            if not torch.isfinite(loss):
                continue
            loss.backward(); opt.step()
            loss_sum += loss.item(); nb += 1
        if (ep + 1) % 2 == 0:
            print(f"  ep {ep+1}/{epochs} loss={loss_sum/max(1,nb):.4f} ({time.time()-t0:.0f}s)")

    model.eval()
    CHUNK = 4096
    preds = []
    with torch.no_grad():
        for i in range(0, len(Xva_t), CHUNK):
            preds.append(model(Xva_t[i:i + CHUNK]).cpu().numpy().squeeze())
    preds = np.concatenate(preds) * sd_y + mu_y
    actual = yva

    out = pd.DataFrame({"route": rva, "actual": actual, "prediction": preds})
    out.to_parquet("/vol/models_v76/kan_oof_predictions.parquet", index=False)
    volume.commit()
    mae = float(np.abs(preds - actual).mean())
    print(f"[kan] MAE={mae:.2f}")
    return {"status": "ok", "mae": mae}


@app.local_entrypoint()
def main():
    print(run.remote())
