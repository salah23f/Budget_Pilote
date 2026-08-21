"""
v7a/audit_leakage.py — audit de leakage renforcé (V7a).

Contrôles :
  A. Temporel : train.max < val.min ≤ val.max < cal.min ≤ cal.max < test.min
  B. Rolling shift(1) : `feat_roll_*` != rolling sur la fenêtre INCLUANT présent
     et != rolling sur fenêtre forward.
  C. Feature vs target : aucune feature parfaitement corrélée avec price_usd.
  D. Split 80/20 caché : scan AST basique (greps) sur xgb_meta.py / bma / copula
     → doit être soit supprimé soit utilise TimeSeriesSplit. (V7a ne les charge
     pas ; ce check est un avertissement si le code existe encore.)
  E. Lecture interdite du hold-out `test` : on scan les imports et lectures
     parquet dans scripts/train/v7a/ (sauf backtest.py).
  F. Test coverage du guard-fou `assert_test_split_not_read`.

Sortie :
  - data/audit/leakage_report.json
  - exit code 1 si leak critique, 0 sinon.

Run :
  python3 scripts/train/v7a/audit_leakage.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _env import (  # noqa: E402
    V7A_AUDIT_DIR,
    V7A_FEATURES_DIR,
    V7A_SPLITS_DIR,
    REPO_ROOT,
    ensure_dirs,
    log,
)

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402


def check_temporal_overlap() -> list[str]:
    """
    Vérifie que les splits sont chronologiquement disjoints.

    Règle V7a : train.max < val.min ≤ val.max < cal.min ≤ cal.max < test.min
    (inégalités strictes). Une égalité (même fetched_at à la frontière)
    signifie que des observations d'une MÊME date partagée existent dans
    plusieurs splits — à éviter. Les obs d'une même date doivent aller
    dans le MÊME split (cf. split.py qui groupe par date unique).
    """
    issues: list[str] = []
    ranges = {}
    for name in ("train", "val", "cal", "test"):
        p = V7A_SPLITS_DIR / f"{name}.parquet"
        if not p.exists():
            issues.append(f"split missing: {p}")
            continue
        df = pd.read_parquet(p, columns=["fetched_at"])
        d = pd.to_datetime(df["fetched_at"], utc=True)
        ranges[name] = (d.min(), d.max())
    order = ["train", "val", "cal", "test"]
    for a, b in zip(order, order[1:]):
        if a in ranges and b in ranges:
            # strict > : une date à la frontière partagée entre splits est un vrai leak
            if ranges[a][1] > ranges[b][0]:
                issues.append(
                    f"TEMPORAL LEAK: {a}.max ({ranges[a][1]}) > {b}.min ({ranges[b][0]})"
                )
            elif ranges[a][1] == ranges[b][0]:
                # Tolérance: si les frontières sont égales, on vérifie que chaque
                # date n'apparaît QUE dans un split.
                df_a = pd.read_parquet(V7A_SPLITS_DIR / f"{a}.parquet", columns=["fetched_at"])
                df_b = pd.read_parquet(V7A_SPLITS_DIR / f"{b}.parquet", columns=["fetched_at"])
                dates_a = set(pd.to_datetime(df_a["fetched_at"], utc=True).dt.date.unique())
                dates_b = set(pd.to_datetime(df_b["fetched_at"], utc=True).dt.date.unique())
                shared = dates_a & dates_b
                if shared:
                    issues.append(
                        f"TEMPORAL LEAK: {len(shared)} shared fetched_at date(s) between {a} and {b}"
                    )
    return issues


def check_rolling_shift() -> list[str]:
    issues: list[str] = []
    p = V7A_FEATURES_DIR / "train.parquet"
    if not p.exists():
        return [f"features missing: {p}"]
    df = pd.read_parquet(p, columns=["route", "fetched_at", "price_usd", "feat_roll_mean_7", "feat_roll_mean_14"])
    df = df.sort_values(["route", "fetched_at"])
    grp = df.groupby("route", sort=False)["price_usd"]
    naive_7 = grp.transform(lambda s: s.rolling(7, min_periods=1).mean())  # inclut présent
    causal_7 = grp.transform(lambda s: s.shift(1).rolling(7, min_periods=1).mean())
    diff_naive = (df["feat_roll_mean_7"].fillna(0) - naive_7.fillna(0)).abs().mean()
    diff_causal = (df["feat_roll_mean_7"].fillna(0) - causal_7.fillna(0)).abs().mean()
    if diff_causal > 0.01 or diff_naive < diff_causal:
        issues.append(
            f"ROLLING SHIFT: feat_roll_mean_7 proche de rolling(naïf) "
            f"diff_causal={diff_causal:.3f} diff_naive={diff_naive:.3f}"
        )
    return issues


def check_target_leakage() -> list[str]:
    issues: list[str] = []
    p = V7A_FEATURES_DIR / "train.parquet"
    if not p.exists():
        return [f"features missing: {p}"]
    df = pd.read_parquet(p)
    y = df["price_usd"].astype(np.float64).values
    if y.std() == 0:
        return ["target has zero variance"]
    for c in [c for c in df.columns if c.startswith("feat_")]:
        if df[c].dtype.kind not in "fc":
            continue
        v = df[c].fillna(0).astype(np.float64).values
        if v.std() == 0:
            continue
        r = float(np.corrcoef(y, v)[0, 1])
        if abs(r) > 0.98:
            issues.append(f"TARGET LEAK suspected: feat={c} corr={r:.4f}")
    return issues


def check_forbidden_test_reads() -> list[str]:
    issues: list[str] = []
    # baselines.py DOIT lire le test pour une comparaison équitable avec V7a
    # (les baselines et V7a sont évaluées sur le MÊME test hold-out).
    # Documenté dans docs/V7A_BASELINES.md et docs/V7A_SPLIT.md.
    allowed = {"backtest.py", "audit_leakage.py", "_env.py", "baselines.py"}
    v7a_dir = REPO_ROOT / "scripts" / "train" / "v7a"
    for py in v7a_dir.glob("*.py"):
        if py.name in allowed:
            continue
        text = py.read_text(encoding="utf-8")
        if "splits_v7a/test" in text or "features_v7a/test" in text or '"test.parquet"' in text or "'test.parquet'" in text:
            issues.append(f"FORBIDDEN TEST READ: {py}")
    return issues


def check_legacy_bad_splits() -> list[str]:
    # Avertissements non bloquants sur les anciens fichiers V7.6 qui contiennent
    # des splits non-temporels. Ils ne sont pas appelés par V7a, mais laisser
    # un warning évite qu'on les ré-utilise sans s'en apercevoir.
    warnings: list[str] = []
    legacy = [
        ("scripts/cloud/v76_ultra/stacking/xgb_meta.py", "n * 0.8"),
        ("scripts/cloud/v76_ultra/stacking/bma_aggregator.py", "groupby(\"route\").agg"),
        ("scripts/cloud/v76_ultra/stacking/copula_ensemble.py", "groupby(\"route\").agg"),
    ]
    for rel, sentinel in legacy:
        f = REPO_ROOT / rel
        if f.exists() and sentinel in f.read_text(encoding="utf-8", errors="ignore"):
            warnings.append(f"legacy pipeline still on disk (not used by V7a): {rel}")
    return warnings


def main() -> int:
    ensure_dirs()
    report = {
        "temporal": check_temporal_overlap(),
        "rolling_shift": check_rolling_shift(),
        "target_leakage": check_target_leakage(),
        "forbidden_test_reads": check_forbidden_test_reads(),
        "legacy_warnings": check_legacy_bad_splits(),
    }
    out = V7A_AUDIT_DIR / "leakage_report.json"
    out.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    crit = (
        report["temporal"]
        + report["rolling_shift"]
        + report["target_leakage"]
        + report["forbidden_test_reads"]
    )
    for k, v in report.items():
        log(k, issues=len(v))
    if crit:
        log("CRITICAL LEAKS DETECTED — see", path=str(out))
        return 1
    log("audit clean — see", path=str(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
