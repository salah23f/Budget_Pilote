# AUDIT — Plan d'action pour les ~30 $ Modal restants

Objectif : **ne pas dépenser un dollar Modal tant qu'une baseline locale n'a pas montré du signal**.  
Principe : chaque job a une condition de go/no-go mesurable. On ne lance pas la suite si la précédente ne passe pas.

Budget total estimé : ~15 $ (sur 30 $) en cas nominal. ~15 $ de marge.

---

## Phase 0 — Refondation locale (obligatoire, 0 $)

### 0.1 Préparation dataset propre

```bash
# local, MacBook M2 8GB
cd ~/Desktop/BudgetPilot_Live

# 1. Geler le script synthétique pour éviter une relance accidentelle
mv scripts/train/01b-expand-temporal.py scripts/train/_DEPRECATED_01b-expand-temporal.py

# 2. Retirer l'ingester Expedia ICDM (contamination hôtels)
mv scripts/ingest/expedia-icdm.ts scripts/ingest/_REMOVED_expedia-icdm.ts

# 3. Ajouter un flag source="synthetic_regression" dans bts-t100.ts
#    puis filtrer downstream (ne pas utiliser comme prix train)

# 4. Patch kaggle.ts : préserver searchDate au lieu de new Date()
#    (voir diff proposé dans §0.6)

# 5. Patch 02-features.py : shift(1) avant chaque rolling transform
#    (voir diff proposé dans §0.7)
```

### 0.2 Ajouter un hold-out final

Éditer `scripts/train/01-split.py` pour produire 4 splits au lieu de 3 :

```
train  < 2024-01-01          (70 %)
val    < 2024-04-01          (15 %)
cal    < 2024-06-01          (10 %)   ← conformal only
test   ≥ 2024-06-01           (5 %)   ← FROZEN
```

Le hold-out test ne doit être lu **par aucun** script train/ensemble/policy, sauf le backtest final.

### 0.3 Audit leakage renforcé

Étendre `scripts/train/audit-leakage.py` :

- Check que toutes les `rolling_*` features ont été précédées d'un `.shift(1)`.
- Check que chaque split lit le précédent en lecture seule.
- Check que `val_features.parquet` n'est lu que par un unique script de training meta.
- Check qu'aucun fichier de `conformal_*` ne lit `train_features.parquet` ou ne touche `test_*`.
- Check que `test_features.parquet` apparaît uniquement dans `v7a_backtest.py` et `conformal_coverage_check.py`.

Sortie : `data/audit/leakage_report.json` avec liste exhaustive des readers par fichier.

### 0.4 Baselines de référence (local)

Créer `scripts/train/v7a_baselines.py` :

```
Baselines à calculer sur test hold-out :
  - buy_now : paie p_t le premier jour observé.
  - fixed_horizon_14 : paie à ttd=14 (si dispo).
  - rolling_min_30 : buy si p_t ≤ min(p_{t-30..t-1}).
  - simple_quantile_10 : buy si p_t ≤ Q10(train_route).
  - V1 (existing heuristique).

Pour chacun : regret_mean, regret_p50, p90, p99, capture_mean, capture_median.
```

### 0.5 LightGBM quantile (local)

Créer `scripts/train/v7a_lgbm_quantile.py` :

```
# Features : toutes les causales de _common.enrich_features (après patch)
# Cible : price_usd
# Split : TimeSeriesSplit(n_splits=5) sur train
# 3 modèles : q10, q50, q90 avec Pinball loss
# OOF prédictions sur train (k-fold) → data/models_v7a/lgbm_oof.parquet
# Évaluation : pinball, MAE, coverage(q10-q90) sur val
```

### 0.6 Isotonic + Conformal (local)

Créer `scripts/train/v7a_calibrate.py` :

```
# Input : lgbm_oof sur val
# Isotonic per-quantile : fit sur val_fold_1, apply to val_fold_2 (ou similaire)
# Conformal : utilise le split `cal` (JAMAIS val) :
#   c_α(bucket) = Quantile_{1-α}(y - q50) pour α ∈ {0.05, 0.10, 0.20}
#   Buckets = (TTD_group × route_freq × vol_class)
# Output : conformal_buckets.parquet
```

### 0.7 Decision policy + backtest (local)

Créer `scripts/train/v7a_policy.py` :

```
Action selon §1.1.7 de AUDIT_TARGET_ARCHITECTURE.md :
  BUY_NOW si V_buy_now ≤ V_wait - δ
  FORCE_BUY si ttd < 3
  ALERT ou WAIT sinon

Backtest sur test hold-out :
  - regret (mean, p50, p90, p99)
  - capture (mean, median)
  - coverage conformelle marginale + par bucket
  - Wilcoxon apparié vs chaque baseline
  - IC bootstrap 95 % sur capture_median
  - segment breakdown complet
```

### 0.8 Diffs concrets à appliquer

#### Diff 1 — `02-features.py` (lignes 45-56)

```diff
 for window in [7, 14, 30]:
     col = f"rolling_{window}d"
     df[f"{col}_mean"] = df.groupby(["origin", "destination"])["price_usd"].transform(
-        lambda x: x.rolling(window, min_periods=1).mean()
+        lambda x: x.shift(1).rolling(window, min_periods=1).mean()
     )
     df[f"{col}_std"] = df.groupby(["origin", "destination"])["price_usd"].transform(
-        lambda x: x.rolling(window, min_periods=2).std()
+        lambda x: x.shift(1).rolling(window, min_periods=2).std()
     )
```
(idem min / max, et dans `_common.enrich_features`).

#### Diff 2 — `kaggle.ts` `_normalize_*`

```diff
 return {
     origin: s.origin,
     destination: s.destination,
     price_usd: Number(s.price_usd),
-    fetched_at: new Date().toISOString(),
+    fetched_at: s.searchDate ?? s.fetched_at ?? null,
+    quality: s.searchDate ? 100 : 50,
 };
```

Si `searchDate` absent → marquer `quality=50` et filtrer en aval.

#### Diff 3 — `xgb_meta.py:101`

```diff
 # Sort by time before splitting
-split = int(n * 0.8)
-Xtr, ytr = X[:split], y[:split]
-Xva, yva = X[split:], y[split:]
+# TimeSeriesSplit on original time order
+merged = merged.sort_values("fetched_at").reset_index(drop=True)
+# (and keep an explicit fetched_at column per row)
+tscv = TimeSeriesSplit(n_splits=5)
+for fold, (tr_idx, va_idx) in enumerate(tscv.split(X)):
+    ...
```

*Ou* supprimer `xgb_meta.py` et le remplacer par une régression simple sur vraies OOF k-fold (§0.5).

---

## Phase 0 — Critère go/no-go avant Modal

Après Phase 0, produire `phase0_report.json` :

```json
{
  "lgbm_q50_mae_test": <float>,
  "lgbm_coverage_10_90_test": <float>,
  "lgbm_vs_buy_now_delta_capture_pct": <float>,
  "wilcoxon_pvalue_lgbm_vs_buynow": <float>,
  "wilcoxon_pvalue_lgbm_vs_rollmin": <float>,
  "wilcoxon_pvalue_lgbm_vs_v1": <float>,
  "coverage_by_bucket": { "ttd_0_7": ..., ... }
}
```

**Go Phase 1 si :**
- `lgbm_coverage_10_90_test ∈ [0.78, 0.82]` (proche du 80 % nominal).
- `lgbm_vs_rollmin_delta_capture > 1 pp` et p-value < 0.05.
- Aucun bucket avec coverage < 0.80 au niveau α=0.10.

**No-go sinon** : le signal intrinsèque est trop faible — stop, renforcer les données avant d'investir Modal.

---

## Phase 1 — Foundation model zero-shot (~6 $ Modal)

### 1.1 Prérequis
- Phase 0 est **go**.
- Un endpoint `v7a_predict(route, ttd, features)` disponible localement avec LGBM.

### 1.2 Job A : Chronos-Bolt sur routes denses

```bash
# Upload features du test hold-out + val vers Modal volume
python3 scripts/cloud/upload_features.py --only cal,test

# Lancer inference Chronos zero-shot sur routes avec ≥ 32 obs
modal run scripts/cloud/v76_ultra/models/chronos2_inference_v2.py --split cal
modal run scripts/cloud/v76_ultra/models/chronos2_inference_v2.py --split test
```

**Coût** : A10G ~30 min par split × 2 = ~0.6 $.  
**Sortie** : `chronos_q10/q50/q90` par (route, t).

### 1.3 Job B : TiRex zero-shot (optionnel, conditionnel)

Ne lancer que si complémentarité soupçonnée (Chronos et LGBM très corrélés en Spearman).

```bash
modal run scripts/cloud/v76_ultra/models/tirex_inference_v2.py --split cal
modal run scripts/cloud/v76_ultra/models/tirex_inference_v2.py --split test
```

**Coût** : ~0.6 $ × 2 = ~1.2 $.

### 1.4 Local : blend NNLS

Créer `scripts/train/v7a_blend.py` :

```
Inputs :
  - lgbm_q50 (val OOF k-fold)
  - chronos_q50 (val inference)
  - tirex_q50 (val inference, si job B)

NNLS avec contrainte somme=1, bootstrap win ratio vs LGBM seul.
Accepter blend seulement si win_ratio ≥ 0.55 sur CVaR-MAE.
```

Re-calibrer conformal sur résidus blend via `cal` split (NON val).

### 1.5 Critère go/no-go Phase 1

**Go Phase 2 si :**
- Blend bat LGBM seul sur au moins 2 segments (TTD × freq) avec p<0.10.
- Coverage bucket reste ≥ 0.85 sous α=0.10.

**Sinon** : déployer LGBM seul. Foundation n'apporte rien sur ce dataset.

---

## Phase 2 — Validation finale & intégration produit (~3 $)

### 2.1 Job C : Full backtest manifesté

```bash
# local ou Modal selon taille
python3 scripts/train/v7a_full_backtest.py \
    --manifest run_$(git rev-parse --short HEAD)_$(date +%Y%m%d_%H%M%S)
```

Sortie `report/v7a_final/` :
- `summary.json` (toutes métriques)
- `per_route.parquet`
- `coverage_diagrams.png`
- `reliability_diagrams.png`
- `regret_distributions.png`
- `ablations.json` (V7a sans Chronos, V7a sans conformal Mondrian, etc.)
- `manifest.json` : git sha, data hash, seed, modèle filenames.

### 2.2 Job D : Pont Modal ↔ Next.js

Créer `scripts/cloud/v7a_serve.py` :

```python
import modal
from _common import app, volume

@app.function(image=...)
@modal.web_endpoint(method="POST")
def predict(route: str, ttd: int, price_history: list[float]) -> dict:
    # charge le modèle LGBM + conformal + blend (si V7b actif)
    ...
    return {
      "q10": ..., "q50": ..., "q90": ...,
      "conformal_lower": ..., "conformal_width": ...,
      "action": "BUY_NOW" | "WAIT" | "ALERT" | "FORCE_BUY",
      "confidence": 0.87,
      "reason": ["p ≤ q50 - c_alpha", "ttd < 14"]
    }
```

Puis côté TS, dans `lib/agent/watcher.ts` :

```ts
async function predictV7a(offer, history): Promise<Prediction> {
  const resp = await fetch(process.env.MODAL_V7A_URL, {
    method: "POST",
    body: JSON.stringify({ route: offer.route, ttd: offer.ttd, price_history: history.map(h => h.price) })
  });
  return resp.json();
}
```

**Coût** : négligeable (endpoint appelé par cron sweep, pas inference batch).

### 2.3 Shadow mode 2 semaines

Dans `app/api/missions/[id]/propose` : enregistrer *chaque* décision BUY_NOW dans la table `agent_decisions` sans exécuter, pendant 2 semaines, sur un sous-ensemble utilisateur opt-in.

Métriques à surveiller :
- regret réalisé a posteriori,
- coverage conformelle vraie,
- taux d'action BUY_NOW par segment.

### 2.4 Critère go production

**Auto-buy plafonné activable si :**
- regret_p90 ≤ 8 % sur shadow data.
- 0 auto-buy FPR-cata (paid > 120 % floor) sur shadow.
- kill-switch testé.
- explanation UI déployée.

---

## Budget prévisionnel

| Phase | Description | Coût |
|---|---|---|
| 0 | Local (refondation + LGBM + baselines + conformal) | 0 $ |
| 1A | Chronos zero-shot cal + test | ~0.6 $ |
| 1B | TiRex zero-shot cal + test (conditionnel) | ~1.2 $ |
| 2A | Full backtest manifesté (local majoritairement, Modal pour foundation inference reproduction) | ~1 $ |
| 2B | Endpoint Modal web + runtime pendant shadow | ~2-3 $ sur 2 semaines |
| Marge | Retries, debug, itérations | ~18 $ |
| **Total** | | **~5-7 $ nominal, marge 23-25 $** |

**Le budget de 30 $ est largement suffisant si on respecte la séquence.**

Le piège à éviter : relancer `run_all_v3.py` end-to-end sur l'architecture actuelle — qui coûterait 10-15 $ pour re-produire des résultats invalides.

---

## Ordre exact des commandes (executive)

```bash
# ==== Phase 0 (local, ~1 jour de travail) ====
# 1. Patch code (diffs §0.8)
# 2. Re-run data pipeline local
python3 scripts/train/00-export-to-local.py
python3 scripts/train/01-split.py               # produit train/val/cal/test
python3 scripts/train/02-features.py            # version patchée (shift(1))
python3 scripts/train/audit-leakage.py          # version renforcée
python3 scripts/train/v7a_baselines.py
python3 scripts/train/v7a_lgbm_quantile.py
python3 scripts/train/v7a_calibrate.py
python3 scripts/train/v7a_policy.py
python3 scripts/train/v7a_backtest.py
# → data/report/phase0_report.json

# ==== Go/no-go ====
python3 scripts/train/check_phase0_go.py        # exit 0 si go, 1 sinon

# ==== Phase 1 (Modal, ~1-2 jours) ====
python3 scripts/cloud/upload_features.py --only cal,test
modal run scripts/cloud/v76_ultra/models/chronos2_inference_v2.py --split cal
modal run scripts/cloud/v76_ultra/models/chronos2_inference_v2.py --split test
python3 scripts/train/v7a_blend.py
python3 scripts/train/v7a_backtest.py --with-foundation
# → data/report/phase1_report.json

# ==== Phase 2 ====
python3 scripts/train/v7a_full_backtest.py --manifest run_$(git rev-parse --short HEAD)_$(date +%Y%m%d)
modal deploy scripts/cloud/v7a_serve.py
# patch lib/agent/watcher.ts pour appeler MODAL_V7A_URL
# activer shadow mode
```

---

## Note finale

**Ne pas lancer Modal tant que le `phase0_report` ne montre pas :**
- LGBM > rolling-min (Wilcoxon p<0.05)
- Coverage ~80 % au niveau α=0.10
- Regret_p90 ≤ 10 % sur au moins les routes fréquentes

Si Phase 0 échoue, le problème est dans les données, pas dans les modèles — et aucun budget Modal ne résoudra ça.

**Meilleur usage possible des 30 $ = ~5-10 $ dépensés + 20-25 $ de marge qui ne seront probablement pas utilisés.** C'est le signe d'un bon plan : ne pas brûler du compute pour impressionner.
