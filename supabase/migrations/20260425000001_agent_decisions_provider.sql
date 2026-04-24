-- ======================================================================
-- 20260425000001_agent_decisions_provider.sql
--
-- Ajoute la colonne `provider` à `agent_decisions` pour tracer
-- l'upstream effectivement utilisé par le watcher pour récupérer le
-- prix de référence d'une décision V7a.
--
-- Valeurs attendues :
--   - 'sky_scrapper'  → Sky-Scrapper (RapidAPI)
--   - 'kiwi'          → Kiwi.com (RapidAPI, fallback)
--   - 'amadeus'       → Amadeus (fallback secondaire)
--   - NULL            → log V7a sans offer associée (ex: ping diagnostic)
-- ======================================================================

alter table public.agent_decisions
  add column if not exists provider text;

create index if not exists agent_decisions_provider_idx
  on public.agent_decisions (provider)
  where provider is not null;
