"""
v7a/serve.py — Modal endpoint V7a (pivot A).

MOTEUR PRIMAIRE DE DÉCISION : ensemble_ttd_switch (baseline composée)
  - TTD ≤ 7   → règle rolling_min_30 (buy si price ≤ min des 30 obs passées)
  - TTD > 7   → règle simple_quantile_10 (buy si price ≤ Q10 train du trip)

Cette baseline a été prouvée supérieure à la policy ML V7a sur tous les
segments TTD (voir docs/V7A_PIVOT_A_REPORT.md). Le pivot A l'établit comme
moteur officiel de décision produit.

COUCHE ML AUXILIAIRE (non décisionnelle) :
  - q10_gain / q50_gain / q90_gain     : forecast du gain futur
  - conformal_lower / conformal_upper  : intervalle calibré autour de q50
  - drop_proba_calibrated              : proba drop ≥ 10 %
Sert exclusivement à afficher un niveau de confiance et une explication à
l'utilisateur, PAS à décider l'achat.

ALERTING : désactivé en prod tant que target B (drop_proba) n'est pas revue
(actuellement quasi-constante ~0.87 sur dilwong, donc non informative).
Le endpoint retourne un champ `alert_enabled=false` et une `alert_action=null`.

Input  : POST JSON { origin, destination, ttd_days, current_price, fetched_at,
                     price_history?: [{fetched_at, price_usd}, ...],
                     budget_max?, budget_autobuy?, autobuy_enabled? }
Output : JSON { action, action_source, confidence, q10, q50, q90,
                conformal_lower, conformal_upper, drop_proba,
                reason, v7a_version }

Déploiement :
  modal secret create flyeas-v7a-secret MODAL_V7A_SECRET=<bearer>
  modal deploy scripts/cloud/v7a/serve.py

Coût : CPU 2 GB, ~50 ms par requête. ~0 $ en usage normal.
"""

from __future__ import annotations

import json
import os
import pickle
from pathlib import Path
from typing import Any

import modal
from fastapi import Header

APP_NAME = "flyeas-v7a"
VOLUME_NAME = "flyeas-v7a"
MODELS_VOL_PATH = "/vol/models_v7a_modal"

app = modal.App(APP_NAME)
volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "numpy==1.26.4",
        "pandas==2.2.2",
        "scikit-learn==1.5.0",
        "lightgbm==4.3.0",
        "fastapi[standard]",
    )
)


# ----------------------------------------------------------------------------
# Décision primaire : ensemble_ttd_switch (baseline composée, zero-ML)
# ----------------------------------------------------------------------------

TTD_SWITCH_THRESHOLD = 7
ROLLING_WINDOW = 30
ALERT_ENABLED_DEFAULT = False  # pivot A : alerting off tant que target B non revue


def _decision_ensemble_ttd_switch(
    current_price: float,
    ttd_days: float,
    price_history: list[dict] | None,
    q10_train: float | None,
    route_known: bool,
    budget_max: float,
    budget_autobuy: float,
    autobuy_enabled: bool,
) -> dict[str, Any]:
    """
    Ensemble TTD switch :
      - TTD ≤ 7  → rolling_min_30 (buy si current ≤ min des 30 obs passées)
      - TTD > 7  → simple_quantile_10 (buy si current ≤ q10_train_route)

    Ces deux règles ont été validées empiriquement comme meilleure baseline
    sur le test hold-out V7a.
    """
    reasons: list[str] = []

    if not route_known:
        return {
            "action": "ABSTAIN",
            "action_source": "gate_route_unknown",
            "reason": ["route inconnue du dataset train"],
        }

    buy_triggered = False
    if ttd_days <= TTD_SWITCH_THRESHOLD:
        # rolling_min_30 : buy si price ≤ min des prix passés sur window
        hist_prices = [float(h["price_usd"]) for h in (price_history or [])]
        # window = 30 dernières obs avant la courante
        window = hist_prices[-ROLLING_WINDOW:] if hist_prices else []
        if window:
            window_min = min(window)
            if current_price <= window_min:
                buy_triggered = True
                reasons.append(
                    f"rolling_min_30 : price={current_price:.2f} ≤ min({len(window)} obs)={window_min:.2f}"
                )
            else:
                reasons.append(
                    f"rolling_min_30 : price={current_price:.2f} > min({len(window)} obs)={window_min:.2f}"
                )
        else:
            reasons.append("rolling_min_30 : pas d'historique, wait")
    else:
        # simple_quantile_10 : buy si price ≤ Q10(train_route)
        if q10_train is None or q10_train <= 0:
            reasons.append("simple_quantile_10 : Q10 train indisponible, wait")
        elif current_price <= q10_train:
            buy_triggered = True
            reasons.append(
                f"simple_quantile_10 : price={current_price:.2f} ≤ Q10_train={q10_train:.2f}"
            )
        else:
            reasons.append(
                f"simple_quantile_10 : price={current_price:.2f} > Q10_train={q10_train:.2f}"
            )

    # Gate AUTO_BUY (très strict, séparé)
    if buy_triggered and autobuy_enabled and current_price <= budget_autobuy and ttd_days >= 2:
        reasons.append("autobuy_gate_passed")
        return {
            "action": "AUTO_BUY",
            "action_source": "ensemble_ttd_switch+autobuy_gate",
            "reason": reasons,
        }

    if buy_triggered and current_price <= budget_max:
        return {
            "action": "BUY_NOW",
            "action_source": "ensemble_ttd_switch",
            "reason": reasons,
        }

    return {
        "action": "WAIT",
        "action_source": "ensemble_ttd_switch",
        "reason": reasons,
    }


# ----------------------------------------------------------------------------
# Couche ML : confiance + explication (pas de décision)
# ----------------------------------------------------------------------------

def _compute_ml_confidence_layer(
    payload: dict,
    stats: dict,
    models_dir: str,
) -> dict[str, Any]:
    """
    Calcule les sorties ML pour UI seulement. Si les modèles ne sont pas
    disponibles (pas encore déployés), renvoie un bloc vide sans casser.
    """
    import numpy as np

    out: dict[str, Any] = {
        "q10_gain": None,
        "q50_gain": None,
        "q90_gain": None,
        "conformal_lower": None,
        "conformal_upper": None,
        "conformal_width": None,
        "drop_proba_calibrated": None,
        "ml_available": False,
    }

    lgbm_files = [f"{models_dir}/lgbm_q{q}.pkl" for q in ("10", "50", "90")]
    mondrian_path = f"{models_dir}/conformal_mondrian.json"
    drop_path = f"{models_dir}/lgbm_drop.pkl"
    drop_iso_path = f"{models_dir}/isotonic_drop.pkl"
    runtime_stats_path = f"{models_dir}/runtime_stats.json"

    if not all(Path(p).exists() for p in lgbm_files + [mondrian_path, runtime_stats_path]):
        return out

    try:
        with open(runtime_stats_path) as f:
            runtime_stats = json.load(f)
    except Exception:
        return out

    # Build features at runtime (same schema as scripts/train/v7a/features.py).
    # NOTE : implémentation minimaliste — voir scripts/train/v7a/features.py
    # pour la parité complète. Si parité pas garantie, skip ML layer.
    try:
        feats = _build_runtime_features(payload, runtime_stats)
    except Exception:
        return out

    X = np.array([[feats[k] for k in sorted(feats.keys())]], dtype=np.float32)

    try:
        preds: dict[str, float] = {}
        for q, path in zip(("q10", "q50", "q90"), lgbm_files):
            with open(path, "rb") as f:
                m = pickle.load(f)
            preds[q] = float(m.predict(X)[0])
        mondrian = json.loads(open(mondrian_path).read())
        # bucket key identique à calibrate.py
        ttd = float(payload["ttd_days"])
        pop = float(stats["pop"].get(f"{payload['origin']}-{payload['destination']}", 0))
        mean_t = float(stats["route_mean"].get(f"{payload['origin']}-{payload['destination']}", 0))
        std_t = float(stats["route_std"].get(f"{payload['origin']}-{payload['destination']}", 0))
        std_ratio = std_t / mean_t if mean_t > 0 else 0.0
        b_ttd = 0 if ttd <= 7 else 1 if ttd <= 21 else 2 if ttd <= 60 else 3
        b_freq = 0 if pop < 50 else 1 if pop < 500 else 2
        b_vol = 0 if std_ratio < 0.10 else 1 if std_ratio < 0.30 else 2
        bucket = f"{b_ttd}-{b_freq}-{b_vol}"
        alpha = payload.get("alpha", 0.10)
        tag = f"alpha_{int(alpha * 100):02d}"
        c_alpha = mondrian["alpha"].get(tag, {}).get(bucket, {}).get(
            "c", mondrian.get("global", {}).get(tag, 0.0)
        )
        conformal_lower = preds["q50"] - c_alpha
        conformal_upper = preds["q50"] + c_alpha

        drop_proba_cal = None
        try:
            with open(drop_path, "rb") as f:
                drop_clf = pickle.load(f)
            raw = float(drop_clf.predict_proba(X)[0, 1])
            with open(drop_iso_path, "rb") as f:
                iso = pickle.load(f)
            drop_proba_cal = float(iso.predict([raw])[0])
        except Exception:
            drop_proba_cal = None

        out.update(
            {
                "q10_gain": preds["q10"],
                "q50_gain": preds["q50"],
                "q90_gain": preds["q90"],
                "conformal_lower": conformal_lower,
                "conformal_upper": conformal_upper,
                "conformal_width": max(0.0, conformal_upper - conformal_lower),
                "drop_proba_calibrated": drop_proba_cal,
                "ml_available": True,
            }
        )
    except Exception as e:
        out["ml_error"] = str(e)[:200]
    return out


def _build_runtime_features(payload: dict, runtime_stats: dict) -> dict[str, float]:
    """Stub minimal runtime features — parité stricte avec features.py requise.

    Pour le pivot A, la décision ne dépend PAS de cette couche. Si la parité
    n'est pas garantie, on saute simplement cette couche (ML bloc null).
    """
    raise NotImplementedError("runtime feature parity — à garantir avant ré-activation ML layer")


# ----------------------------------------------------------------------------
# Endpoint Modal
# ----------------------------------------------------------------------------

@app.function(
    image=image,
    volumes={"/vol": volume},
    timeout=60,
    memory=2048,
    secrets=[modal.Secret.from_name("flyeas-v7a-secret")],
)
@modal.fastapi_endpoint(method="POST")
def predict(payload: dict, authorization: str = Header(default="")) -> dict:
    """V7a prediction endpoint (pivot A).

    Auth : FastAPI injecte automatiquement la valeur du header HTTP
    `authorization` dans le paramètre grâce à `Header(default="")`.
    On attend `Bearer <MODAL_V7A_SECRET>`.
    """
    secret_expected = os.environ.get("MODAL_V7A_SECRET", "")
    if secret_expected and authorization != f"Bearer {secret_expected}":
        return {"error": "unauthorized"}

    required = ["origin", "destination", "ttd_days", "current_price", "fetched_at"]
    missing = [k for k in required if k not in payload]
    if missing:
        return {"error": "missing fields", "fields": missing}

    assets_path = f"{MODELS_VOL_PATH}/baseline_assets.json"
    if not Path(assets_path).exists():
        return {"error": "baseline_assets.json not found on volume — run export_baseline_assets.py then upload"}

    with open(assets_path) as f:
        assets = json.load(f)

    route_key = f"{payload['origin']}-{payload['destination']}"
    q10_train = assets["q10_train_route"].get(route_key)
    pop = int(assets["route_popularity"].get(route_key, 0))
    route_known = pop > 0

    decision = _decision_ensemble_ttd_switch(
        current_price=float(payload["current_price"]),
        ttd_days=float(payload["ttd_days"]),
        price_history=payload.get("price_history"),
        q10_train=q10_train,
        route_known=route_known,
        budget_max=float(payload.get("budget_max", 1e9)),
        budget_autobuy=float(payload.get("budget_autobuy", 0)),
        autobuy_enabled=bool(payload.get("autobuy_enabled", False)),
    )

    # Couche ML confidence (best-effort, jamais bloquante)
    runtime_stats_path = f"{MODELS_VOL_PATH}/runtime_stats.json"
    stats: dict = {}
    if Path(runtime_stats_path).exists():
        try:
            with open(runtime_stats_path) as f:
                stats = json.load(f)
        except Exception:
            stats = {}
    ml_layer = _compute_ml_confidence_layer(payload, stats, MODELS_VOL_PATH)

    # Alerting : désactivé en prod pivot A
    alert_payload = {
        "alert_enabled": ALERT_ENABLED_DEFAULT,
        "alert_action": None,
        "alert_reason": ["alerting désactivé — pivot A, target B non validée"],
    }

    return {
        "v7a_version": "0.2.0-pivot-a",
        "route": route_key,
        "route_known": route_known,
        "q10_train_route": q10_train,
        "ttd_days": float(payload["ttd_days"]),
        "current_price": float(payload["current_price"]),
        **decision,
        **alert_payload,
        "ml_layer": ml_layer,
    }
