"""
01b-expand-temporal.py — DEPRECATED (gelé par l'audit V7.6 → V7a).

Ce script est désactivé intentionnellement. Il synthétisait 50 observations
quotidiennes par route-trimestre en tirant i.i.d. d'une N(mean, std) clippée
à [min, max]. La structure temporelle intra-trimestre était donc du bruit
gaussien pur, ce qui invalidait tout signal temporel appris en aval.

Voir:
  - docs/audit/AUDIT_EXECUTIVE_SUMMARY.md  (finding #1)
  - docs/audit/AUDIT_RISK_REGISTER.md      (R1)
  - docs/V7A_SCOPE.md                       (composant explicitement supprimé)

Pour V7a, utiliser à la place:
  - scripts/train/v7a/build_dataset.py      (dataset réel, horodaté)

Si, dans une version future, on doit ré-introduire une synthèse temporelle,
cela devra se faire avec:
  - un vrai modèle de dépendance temporelle (AR, GARCH empiriques par route),
  - un flag `source="synthetic"` préservé jusqu'au backtest,
  - un filtrage explicite dans les splits d'évaluation,
  - un audit de leakage adapté.

Aucune de ces conditions n'est satisfaite ici. Le script refuse donc de
s'exécuter.
"""

from __future__ import annotations

import sys


def main() -> None:
    sys.stderr.write(
        "\n"
        "[DEPRECATED] 01b-expand-temporal.py est désactivé depuis l'audit V7.6.\n"
        "Raison : synthèse i.i.d. N(µ_q, σ_q) des prix intra-trimestre.\n"
        "Voir docs/V7A_SCOPE.md. Utiliser scripts/train/v7a/build_dataset.py.\n"
        "\n"
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
