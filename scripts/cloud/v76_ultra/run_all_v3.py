"""
run_all_v3.py — V7.6 Ultra orchestrator, revision 3 (final).

Fix vs v2: v2 imported the individual scripts whose own `@app.local_entrypoint`
`main()` functions collided under a single Modal app name. v3 declares its
own Modal app and only imports the `@app.function` objects, re-registering
them under a fresh app with `cls()`-style pattern via module wiring.

This orchestrator is the one you should run in production.

Run:
    python3 -m modal run --detach scripts/cloud/v76_ultra/run_all_v3.py
    python3 -m modal run --detach scripts/cloud/v76_ultra/run_all_v3.py --mode foundation_only
    python3 -m modal run --detach scripts/cloud/v76_ultra/run_all_v3.py --mode custom_only
    python3 -m modal run --detach scripts/cloud/v76_ultra/run_all_v3.py --mode stacking_only
    python3 -m modal run --detach scripts/cloud/v76_ultra/run_all_v3.py --mode policy_only
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

# NOTE: we import only the Modal `app` object from _common; we deliberately do
# NOT import the per-script `main` functions (each of those is a
# local_entrypoint on the shared app, and calling them from here would clash).
# Instead we invoke the Modal functions via their `.remote()` method.

from _common import app, volume

from models.chronos2_inference_v2 import run_chronos2_v2
from models.tirex_inference_v2 import run_tirex_v2
from models.moirai2_inference_v2 import run_moirai2_v2
from models.timesfm_inference_v2 import run_timesfm_v2
from models.patchtst_train import train_patchtst
from models.mamba_timemachine import train_mamba
from models.kan_train import train_kan
from models.garch_nn_train import train_garch_nn
from models.mlcaformer_train import train_mlcaformer
from models.timegrad_diffusion import train_timegrad
from models.ts2vec_pretrain import train_ts2vec
from stacking.xgb_meta import fit_xgb_meta
from stacking.bma_aggregator import fit_bma
from stacking.copula_ensemble import fit_copula
from policy.conformal_os import calibrate_conformal
from policy.bocpd_evt import compute_bocpd_and_evt
from policy.iqn_policy import train_iqn
from policy.thompson_sampling import fit_thompson
from policy.v76_backtest import run_backtest


FOUNDATION = [
    ("chronos2", run_chronos2_v2),
    ("tirex", run_tirex_v2),
    ("moirai2", run_moirai2_v2),
    ("timesfm", run_timesfm_v2),
]

CUSTOM = [
    ("patchtst", train_patchtst),
    ("mamba", train_mamba),
    ("kan", train_kan),
    ("garch_nn", train_garch_nn),
    ("mlcaformer", train_mlcaformer),
    ("timegrad", train_timegrad),
    ("ts2vec", train_ts2vec),
]

STACKING = [
    ("xgb_meta", fit_xgb_meta),
    ("bma", fit_bma),
    ("copula", fit_copula),
]

POLICY = [
    ("bocpd_evt", compute_bocpd_and_evt),
    ("iqn_policy", train_iqn),
    ("thompson", fit_thompson),
    ("conformal_os", calibrate_conformal),
    ("v76_backtest", run_backtest),
]


def _safe_call(name, fn):
    try:
        print(f"\n====================  {name}  ====================")
        result = fn.remote()
        print(f"[{name}] OK → {result}")
        return {"name": name, "status": "ok", "result": result}
    except Exception as e:
        print(f"[{name}] FAILED: {type(e).__name__}: {e}")
        return {"name": name, "status": "failed", "error": str(e)}


# The orchestrator reuses the `app` from _common so all child functions
# are registered under a single Modal app. There is only ONE entrypoint on
# this app — right here — and no collision with per-script entrypoints because
# we import the Modal functions themselves, not their local_entrypoint wrappers.
@app.local_entrypoint()
def orchestrate(mode: str = "all"):
    outputs = []

    if mode in ("all", "foundation_only"):
        print("\n\n#### LEVEL 0 — FOUNDATION MODELS (v2 APIs) ####")
        for name, fn in FOUNDATION:
            outputs.append(_safe_call(name, fn))

    if mode in ("all", "custom_only"):
        print("\n\n#### LEVEL 0 — CUSTOM TRAINED ####")
        for name, fn in CUSTOM:
            outputs.append(_safe_call(name, fn))

    if mode in ("all", "stacking_only"):
        print("\n\n#### LEVEL 1 — STACKING ####")
        for name, fn in STACKING:
            outputs.append(_safe_call(name, fn))

    if mode in ("all", "policy_only"):
        print("\n\n#### LEVEL 2 — POLICY ####")
        for name, fn in POLICY:
            outputs.append(_safe_call(name, fn))

    volume.commit()

    print("\n\n==========  V7.6 ULTRA v3 — SUMMARY  ==========")
    for o in outputs:
        print(f"  [{o['status']:<7}]  {o['name']}")
    print("================================================")

    ok = [o for o in outputs if o["status"] == "ok"]
    failed = [o for o in outputs if o["status"] == "failed"]
    print(f"\n{len(ok)}/{len(outputs)} steps OK, {len(failed)} failed")
    if failed:
        print("\nFailed steps:")
        for o in failed:
            print(f"  - {o['name']}: {o['error']}")
    return outputs
