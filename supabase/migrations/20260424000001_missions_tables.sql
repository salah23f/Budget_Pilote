-- ======================================================================
-- 20260424000001_missions_tables.sql
--
-- Migration "missions" + "mission_proposals" — backing store pour
-- lib/store/missions-db.ts. Remplace le JSON filesystem (.data/missions.json)
-- qui disparaît à chaque deploy Vercel.
--
-- Conçue pour être idempotente ET corriger un état antérieur où une
-- table `missions` aurait été créée avec un schéma différent (erreur
-- observée le 2026-04-24 : column "updated_at" does not exist).
--
-- Stratégie :
--   1. Détecter si une table `missions` existe avec un schéma incomplet.
--   2. Si oui, et si elle est vide (cas attendu car filesystem éphémère
--      = aucune donnée persistante jusqu'ici), DROP CASCADE.
--   3. CREATE TABLE IF NOT EXISTS avec le schéma cible.
--   4. CREATE INDEX IF NOT EXISTS.
--
-- Si la table contient des données, la migration AVORTE avec un message
-- clair (raise exception) pour qu'un humain décide du chemin ALTER.
-- ======================================================================

-- ----------------------------------------------------------------------
-- ÉTAPE 1 : Nettoyage conditionnel de l'ancienne table `missions`
-- ----------------------------------------------------------------------
do $$
declare
  col_count int;
  row_count int;
  has_updated_at boolean;
  has_data_jsonb boolean;
begin
  -- Est-ce qu'une table missions existe ?
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'missions'
  ) then
    -- A-t-elle les colonnes qu'on attend ?
    select count(*) into col_count
    from information_schema.columns
    where table_schema = 'public' and table_name = 'missions';

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'missions'
        and column_name = 'updated_at'
    ) into has_updated_at;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'missions'
        and column_name = 'data' and data_type = 'jsonb'
    ) into has_data_jsonb;

    -- Si le schéma est déjà correct, on ne touche à rien
    if has_updated_at and has_data_jsonb then
      raise notice 'Table missions existe déjà avec le schéma cible — skip drop';
    else
      -- Schéma incompatible → on vérifie qu'elle est vide avant de droper
      execute 'select count(*) from public.missions' into row_count;
      if row_count > 0 then
        raise exception
          'Table missions existe avec schéma incompatible ET contient % lignes. '
          'Migration abortée : inspectez manuellement avant de relancer.',
          row_count;
      end if;
      raise notice 'Table missions existe avec schéma incompatible, 0 ligne → DROP CASCADE';
      execute 'drop table public.missions cascade';
    end if;
  end if;

  -- Même logique défensive pour mission_proposals
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'mission_proposals'
  ) then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'mission_proposals'
        and column_name = 'data' and data_type = 'jsonb'
    ) into has_data_jsonb;

    if not has_data_jsonb then
      execute 'select count(*) from public.mission_proposals' into row_count;
      if row_count > 0 then
        raise exception
          'Table mission_proposals existe avec schéma incompatible ET contient % lignes. '
          'Migration abortée.',
          row_count;
      end if;
      execute 'drop table public.mission_proposals cascade';
    end if;
  end if;
end $$;

-- ----------------------------------------------------------------------
-- ÉTAPE 2 : Création des tables cibles
-- ----------------------------------------------------------------------

create table if not exists public.missions (
  id                  text primary key,
  user_id             text not null,
  status              text not null,
  monitoring_enabled  boolean not null default true,
  data                jsonb not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists missions_user_id_idx
  on public.missions (user_id);

create index if not exists missions_status_idx
  on public.missions (status);

create index if not exists missions_monitoring_active_idx
  on public.missions (monitoring_enabled)
  where monitoring_enabled = true;

create index if not exists missions_updated_at_idx
  on public.missions (updated_at desc);

create table if not exists public.mission_proposals (
  id           text primary key,
  mission_id   text not null references public.missions (id) on delete cascade,
  status       text not null,
  data         jsonb not null,
  created_at   timestamptz not null default now()
);

create index if not exists mission_proposals_mission_id_idx
  on public.mission_proposals (mission_id);

create index if not exists mission_proposals_status_idx
  on public.mission_proposals (status);

create index if not exists mission_proposals_created_at_idx
  on public.mission_proposals (created_at desc);

-- ----------------------------------------------------------------------
-- ÉTAPE 3 : Row-Level Security (désactivée pour l'instant)
--
-- Le backend Next.js utilisera SUPABASE_SERVICE_ROLE_KEY côté serveur,
-- ce qui bypasse RLS. Les routes d'API sont déjà gatées par auth
-- applicative (session cookie pour utilisateur, Bearer CRON_SECRET pour
-- cron). On n'active pas RLS tant que le client Supabase n'est pas
-- exposé côté navigateur pour ces tables.
-- ----------------------------------------------------------------------
-- alter table public.missions enable row level security;
-- alter table public.mission_proposals enable row level security;
