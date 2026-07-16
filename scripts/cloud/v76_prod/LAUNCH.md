# V7.6 Production — Launch guide (final)

All 19 scripts here are **self-contained**. No `_common.py` import, no
shared local files: each script defines its own Modal app + image. This is
the version that fixes the `ModuleNotFoundError: '_common'` you hit earlier.

## Pre-flight

```bash
# 1. Make sure nothing old is still running
python3 -m modal app list

# 2. Keep Mac awake (6h buffer)
caffeinate -d -i -s -t 21600 &
```

## Block 1 — Foundation models (parallel, ~20 min, ~$1)

Copy-paste the 4 lines together:

```bash
cd ~/Desktop/BudgetPilot_Live
python3 -m modal run --detach scripts/cloud/v76_prod/m01_chronos2.py
python3 -m modal run --detach scripts/cloud/v76_prod/m02_tirex.py
python3 -m modal run --detach scripts/cloud/v76_prod/m03_moirai2.py
python3 -m modal run --detach scripts/cloud/v76_prod/m04_timesfm.py
```

Modal runs these 4 jobs in parallel on different GPUs.

## Block 2 — Custom trained (parallel, ~2h, ~$6)

Run **after** Block 1 (not strictly required but avoids flooding Modal's
queue):

```bash
python3 -m modal run --detach scripts/cloud/v76_prod/m05_patchtst.py
python3 -m modal run --detach scripts/cloud/v76_prod/m06_mamba.py
python3 -m modal run --detach scripts/cloud/v76_prod/m07_kan.py
python3 -m modal run --detach scripts/cloud/v76_prod/m08_garch_nn.py
python3 -m modal run --detach scripts/cloud/v76_prod/m09_mlcaformer.py
python3 -m modal run --detach scripts/cloud/v76_prod/m10_timegrad.py
python3 -m modal run --detach scripts/cloud/v76_prod/m11_ts2vec.py
```

## Check block 1+2 progress

```bash
python3 -m modal app list
python3 -m modal volume ls flyeas-v75 /models_v76/
```

Wait until all 11 level-0 apps show `stopped`. You should see 11 parquet
files under `/models_v76/` (plus `qrf_oof_predictions.parquet` inherited
from V7.5 under `/models/`).

## Block 3 — Stacking (sequential, ~5 min, <$0.10)

Must run AFTER blocks 1+2 finish (stacking reads the OOFs they produce):

```bash
python3 -m modal run --detach scripts/cloud/v76_prod/s01_xgb_meta.py
python3 -m modal run --detach scripts/cloud/v76_prod/s02_bma.py
python3 -m modal run --detach scripts/cloud/v76_prod/s03_copula.py
```

## Block 4 — Policy + final backtest (~45 min, ~$1.50)

Run AFTER block 3:

```bash
python3 -m modal run --detach scripts/cloud/v76_prod/p01_bocpd_evt.py
python3 -m modal run --detach scripts/cloud/v76_prod/p02_iqn.py
python3 -m modal run --detach scripts/cloud/v76_prod/p03_thompson.py
python3 -m modal run --detach scripts/cloud/v76_prod/p04_conformal.py
# p05 must wait for p01+p02+p04 — run it last, once you confirm the others
# are stopped:
python3 -m modal run --detach scripts/cloud/v76_prod/p05_backtest.py
```

## Download results

```bash
cd ~/Desktop/BudgetPilot_Live
python3 -m modal volume get flyeas-v75 models_v76/ ./models_v76_cloud/
python3 -m modal volume get flyeas-v75 report_v76/ ./report_v76_cloud/
cat report_v76_cloud/v76_summary.json
```

## Total budget

~$9 across all 19 jobs. Well within your $23 remaining credits.

## If a slot fails

Each script is independent. If, for example, TiRex fails at load (HF
checkpoint issue) you can skip it and still run the rest. The stacking /
policy blocks only use whichever OOF parquets actually exist on the volume.

If you want to rerun a single failed slot:

```bash
python3 -m modal run --detach scripts/cloud/v76_prod/m02_tirex.py
```

That's it — no orchestrator, no imports, no collisions.
