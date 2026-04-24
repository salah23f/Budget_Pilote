# V7A_LEAKAGE — Audit de leakage renforcé

Le script V7.6 `scripts/train/audit-leakage.py` ratait 4 classes de leaks majeurs (rolling non-shifté, split 80/20 non-temporel, double-usage de val, lecture accidentelle du test). V7a remplace cet audit par `scripts/train/v7a/audit_leakage.py` avec checks durcis et sortie machine-readable.

## Contrôles

### A. Temporal overlap
Pour chaque paire adjacente `(train→val, val→cal, cal→test)` :
```
split[a].max(fetched_at) < split[b].min(fetched_at)
```
Sinon → leak critique.

### B. Rolling shift
Sur `features_v7a/train.parquet` on recalcule les deux versions :
- **naïve** : `rolling(W).mean()` (inclut présent)
- **causale** : `shift(1).rolling(W).mean()` (pure lag)

Le feature stocké doit être strictement plus proche de la version causale que de la naïve. Sinon → leak critique.

### C. Target leakage
Pour chaque `feat_*` numérique, `|corr(feat, price_usd)| > 0.98` → leak critique.

### D. Forbidden test reads
Scan AST basique des fichiers `scripts/train/v7a/*.py` (hors `backtest.py`, `audit_leakage.py`, `_env.py`) à la recherche de :
- `splits_v7a/test`
- `features_v7a/test`
- `"test.parquet"` littéral

Toute occurrence → leak critique.

### E. Legacy warnings
Avertissements non bloquants si les anciens scripts V7.6 (`xgb_meta.py`, `bma_aggregator.py`, `copula_ensemble.py`) existent encore sur disque avec leurs patterns cassés. Rappel : ces scripts ne sont pas appelés par V7a.

## Sortie

- `data/audit/leakage_report.json` — machine-readable.
- Exit code **1** si un des `temporal`, `rolling_shift`, `target_leakage`, `forbidden_test_reads` est non vide ; **0** sinon.

## Extensions possibles (V7b)

- Check de **reverse-leak** : est-ce que `depart_date` (futur du fetched_at) est utilisé comme feature directe ? (Non en V7a : seul `ttd_days` est dérivé, ce qui est causal car l'utilisateur connaît sa date de départ à l'observation.)
- Check de **conformal hold-out** : vérifier que `calibrate.py` lit exclusivement `cal.parquet`.
- Check de **double-usage val** : compter les readers distincts de `val.parquet` dans le graphe d'appels.

## Commande

```bash
python3 scripts/train/v7a/audit_leakage.py
# Exit 0 si clean, 1 sinon.
# Rapport : data/audit/leakage_report.json
```
