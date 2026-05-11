-- ======================================================================
-- 20260511000001_v7a_shadow_decision_logs.sql
--
-- Shadow decision logging table for V7a policy evaluation.
--
-- Purpose:
--   Store every V7a policy decision evaluated in shadow/advisory mode,
--   so future analysis can compare recommended actions against observed
--   outcomes. This is an internal analytics table — it does NOT trigger
--   payments, purchases, or any transactional side-effect.
--
-- AUTO_BUY:
--   Intentionally impossible in Phase 1. The action CHECK constraint
--   excludes AUTO_BUY. The can_autobuy column is hard-locked to false.
--   score_autobuy defaults to 0.
--
-- Security:
--   RLS is enabled. No broad public policies are created. Writes should
--   go through server-side service role only (wired in a future sprint).
--
-- Sprint: b1/v7a-shadow-logging-schema
-- ======================================================================

-- Table
create table if not exists public.v7a_shadow_decision_logs (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),

  -- Context identifiers
  environment           text not null default 'local'
    check (environment in ('local', 'staging', 'production', 'test')),
  shadow_run_id         text,
  trace_id              text,
  mission_id            uuid,
  user_id               uuid,

  -- Route / flight context
  route                 text not null,
  origin                text,
  destination           text,
  depart_date           date,
  fetched_at            timestamptz,
  ttd_days              numeric,

  -- Price and model outputs
  price_usd             numeric check (price_usd >= 0),
  q10_gain              numeric,
  q50_gain              numeric,
  q90_gain              numeric,
  c_alpha_gain          numeric,
  width_over_price      numeric check (width_over_price >= 0),
  drop_proba            numeric check (drop_proba between 0 and 1),
  q10_train_route       numeric,
  route_known           boolean,
  route_popularity      integer,

  -- Policy decision
  action                text not null
    check (action in ('ABSTAIN', 'BUY_NOW', 'ALERT', 'MONITOR', 'WAIT')),
  confidence            numeric check (confidence between 0 and 1),
  score_alert           numeric,
  score_buy             numeric,
  score_autobuy         numeric not null default 0,
  can_autobuy           boolean not null default false,
  autobuy_enabled_input boolean not null default false,

  -- Policy metadata
  policy_version        text not null default 'v7a-balanced-v2',
  policy_source         text not null default 'scripts/train/v7a/policy.py',
  model_version         text,
  thresholds            jsonb not null default '{}'::jsonb,
  decision_reasons      jsonb not null default '[]'::jsonb,
  feature_snapshot      jsonb not null default '{}'::jsonb,
  artifact_versions     jsonb not null default '{}'::jsonb,

  -- Diagnostics
  decision_latency_ms   integer check (decision_latency_ms >= 0),
  error_code            text,
  error_message         text
);

comment on table public.v7a_shadow_decision_logs is
  'V7a shadow/advisory decision log. Internal analytics only — no payment execution. AUTO_BUY is intentionally impossible in Phase 1.';

-- Indexes
create index if not exists v7a_sdl_created_at_idx
  on public.v7a_shadow_decision_logs (created_at desc);

create index if not exists v7a_sdl_mission_id_idx
  on public.v7a_shadow_decision_logs (mission_id)
  where mission_id is not null;

create index if not exists v7a_sdl_user_id_idx
  on public.v7a_shadow_decision_logs (user_id)
  where user_id is not null;

create index if not exists v7a_sdl_route_depart_idx
  on public.v7a_shadow_decision_logs (route, depart_date);

create index if not exists v7a_sdl_action_idx
  on public.v7a_shadow_decision_logs (action);

create index if not exists v7a_sdl_policy_version_idx
  on public.v7a_shadow_decision_logs (policy_version);

create index if not exists v7a_sdl_shadow_run_id_idx
  on public.v7a_shadow_decision_logs (shadow_run_id)
  where shadow_run_id is not null;

create index if not exists v7a_sdl_thresholds_gin_idx
  on public.v7a_shadow_decision_logs using gin (thresholds);

-- Row-Level Security
-- Enabled but no policies created. Server-side service role bypasses RLS.
-- App-facing policies will be added in a future sprint when runtime logging is wired.
alter table public.v7a_shadow_decision_logs enable row level security;
