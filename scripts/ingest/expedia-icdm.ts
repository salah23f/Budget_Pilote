/**
 * expedia-icdm.ts — REMOVED (contamination identifiée par l'audit V7.6 → V7a).
 *
 * Ce module ingérait le jeu Kaggle "Expedia Personalized Sort ICDM 2013",
 * qui contient des prix HÔTELS (pas vols), et les injectait dans la table
 * `real_aggregated_fares` avec `origin='EXP'` et `destination=prop_country_id`.
 * Résultat : pollution directe du dataset prix-vol avec des prix hôtels de
 * 2013.
 *
 * Voir:
 *   - docs/audit/AUDIT_EXECUTIVE_SUMMARY.md  (top weakness #7)
 *   - docs/audit/AUDIT_RISK_REGISTER.md      (R23)
 *   - docs/V7A_SCOPE.md
 *
 * Toute tentative d'exécution lève une erreur explicite au lieu de polluer
 * silencieusement la base. Pour remettre en service, il faudra :
 *   - une table de destination distincte (hôtels)
 *   - un mapping propre vers des entités hôtelières (pas IATA)
 *   - une justification écrite dans docs/V7A_SCOPE.md
 */

export async function ingestExpediaICDM(_csvContent: string): Promise<never> {
  throw new Error(
    "[REMOVED] expedia-icdm.ts est désactivé depuis l'audit V7.6. " +
      'Les données ICDM 2013 sont des prix hôtels et polluaient real_aggregated_fares. ' +
      'Voir docs/V7A_SCOPE.md.'
  );
}

export default ingestExpediaICDM;
