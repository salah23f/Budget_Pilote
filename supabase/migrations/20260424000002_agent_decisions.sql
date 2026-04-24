-- ======================================================================
-- 20260424000002_agent_decisions.sql
--
-- Table `agent_decisions` — log append-only des décisions V7a en
-- shadow mode et en production. Écrite par `/api/agent/shadow-log` à
-- chaque scan watcher (mission réelle ou sim-watch).
--
-- Usage prospectif : sert de base à l'évaluation causale V1 vs V7a sur
-- 2 semaines de shadow mode. On compare, à date T+k, quelle action
-- aurait minimisé le prix effectivement payé.
--
-- Schéma snake_case aligné avec PostgREST. `app/api/agent/shadow-log/
-- route.ts` translate les clés camelCase du payload en snake_case
-- avant insert.
-- ======================================================================

create table if not exists public.agent_decisions (
  id           bigserial primary key,
  logged_at    timestamptz not null default now(),
  mission_id   text,
  route        text,
  price        numeric(10,2),
  ttd_days     int,
  engine       text,                  -- 'v1' | 'v7a' | 'v7a-fallback-v1'
  action       text,                  -- action du moteur décisionnel (V1 en shadow)
  confidence   numeric(4,3),
  v7a          jsonb,                 -- payload V7aPrediction complet
  note         text
);

create index if not exists agent_decisions_logged_at_idx
  on public.agent_decisions (logged_at desc);

create index if not exists agent_decisions_route_idx
  on public.agent_decisions (route);

create index if not exists agent_decisions_engine_idx
  on public.agent_decisions (engine);

create index if not exists agent_decisions_mission_idx
  on public.agent_decisions (mission_id)
  where mission_id is not null;

-- RLS désactivée (service role côté serveur, pas d'accès client direct)
-- alter table public.agent_decisions enable row level security;
