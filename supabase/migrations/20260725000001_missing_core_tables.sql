-- ======================================================================
-- 20260725000001_missing_core_tables.sql
--
-- RATTRAPAGE DE DETTE : 16 tables utilisées par le code applicatif mais
-- jamais versionnées dans supabase/migrations/.
--
-- Contexte :
--   Ces tables ont été créées à la main dans le projet Supabase de prod
--   (SQL editor) au fil des sprints. Le code les interroge via
--   supabase.from('<table>'), mais aucun fichier de migration ne les
--   décrivait — le schéma n'était donc reproductible ni en local, ni sur
--   un nouveau projet Supabase (preview / staging). Plusieurs routes
--   compensent d'ailleurs en try/catch avec le commentaire
--   « table may not exist ».
--
-- Cette migration rattrape ce retard. Elle est écrite pour être
-- 100 % idempotente : `create table if not exists` + `create index if
-- not exists` partout. Sur la base de prod (où les tables existent déjà)
-- elle est un no-op complet et ne modifie AUCUNE colonne existante.
-- Corollaire à connaître : si une table de prod diverge du schéma ci-
-- dessous, cette migration ne la corrigera pas — elle documente le
-- schéma cible déduit du code.
--
-- Méthode :
--   Chaque colonne ci-dessous correspond à un usage réellement observé
--   dans le code (.select / .insert / .update / .upsert / .eq / .order /
--   onConflict). Aucune colonne « au cas où » n'a été ajoutée. Les rares
--   incertitudes sont explicitement signalées par un commentaire
--   « INCERTAIN » et typées en jsonb ou text nullable.
--
-- RLS :
--   Non activée, conformément à 20260424000001_missions_tables.sql : le
--   backend Next.js passe par SUPABASE_SERVICE_ROLE_KEY (qui bypasse
--   RLS) et les routes sont gatées par l'auth applicative. Attention
--   avant d'activer RLS ici : `users` est aussi écrite depuis le
--   NAVIGATEUR (supabaseBrowser.from('users').upsert dans
--   app/onboarding/page.tsx) — activer RLS sans policy casserait
--   l'onboarding.
-- ======================================================================

-- ----------------------------------------------------------------------
-- users
-- Utilisée par : app/api/me/route.ts (GET select / PATCH update),
--                app/api/user/export/route.ts, app/api/user/delete/route.ts,
--                app/onboarding/page.tsx (upsert onConflict 'id')
-- ----------------------------------------------------------------------
create table if not exists public.users (
  -- id = auth.users.id (uuid renvoyé par supabaseAdmin.auth.getUser)
  -- Pas de FK vers auth.users : aligné sur missions.user_id qui n'en a pas
  -- non plus, et évite d'échouer si le schéma auth n'est pas accessible.
  id                        uuid primary key,
  first_name                text,
  last_name                 text,
  email                     text,
  avatar_url                text,
  -- Rail crypto/wallet (écrit par l'onboarding, actuellement masqué côté UI)
  wallet_address            text,
  wallet_chain              text,          -- 'evm' | null
  auth_method               text,          -- 'email' | 'wallet+email'
  primary_wallet_verified   boolean not null default false,
  created_at                timestamptz not null default now()
);

-- ----------------------------------------------------------------------
-- user_preferences
-- Utilisée par : app/api/user/preferences/route.ts
--                (select 'preferences, updated_at' .eq('user_id'),
--                 upsert onConflict 'user_id')
-- ----------------------------------------------------------------------
create table if not exists public.user_preferences (
  -- text et non uuid : le userId vient d'un query param client et peut
  -- être un deviceId anonyme autant qu'un uuid auth (même convention que
  -- missions.user_id).
  user_id      text primary key,
  preferences  jsonb not null,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------
-- user_favorites
-- Utilisée par : app/api/user/favorites/route.ts
--                (select * .eq('user_id') .order('created_at' desc),
--                 upsert onConflict 'id,user_id', delete .eq('id').eq('user_id'))
--                lib/store/favorites-store.ts (lit row.item_data)
-- ----------------------------------------------------------------------
create table if not exists public.user_favorites (
  -- id = identifiant du FavoriteItem généré côté client (string, pas uuid)
  id          text not null,
  user_id     text not null,
  item_type   text,          -- item.kind : 'flight' | 'hotel' | ...
  item_data   jsonb not null, -- FavoriteItem complet, relu tel quel par le store
  created_at  timestamptz not null default now(),
  -- PK composite : requise par l'upsert onConflict 'id,user_id'
  primary key (id, user_id)
);

create index if not exists user_favorites_user_created_idx
  on public.user_favorites (user_id, created_at desc);

-- ----------------------------------------------------------------------
-- bookings
-- Utilisée par : app/api/user/export/route.ts (select * .eq('user_id')),
--                app/api/user/delete/route.ts (delete .eq('user_id'))
--
-- INCERTAIN : aucune route n'ÉCRIT dans cette table dans le code actuel.
-- Seul `user_id` est observable. Le reste du payload est donc stocké en
-- jsonb nullable plutôt que deviné à partir de lib/types.ts (interface
-- Booking) qui n'est jamais persistée telle quelle.
-- ----------------------------------------------------------------------
create table if not exists public.bookings (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  data        jsonb,   -- INCERTAIN : forme du payload inconnue (aucun writer)
  created_at  timestamptz not null default now()
);

create index if not exists bookings_user_id_idx
  on public.bookings (user_id);

-- ----------------------------------------------------------------------
-- notifications
-- Utilisée par : app/api/notifications/route.ts
--                (GET select * .eq('user_id') .order('created_at' desc),
--                 POST insert {user_id,type,title,body,data},
--                 PATCH update {read} .eq('id')),
--                lib/notifications.ts (createNotification)
-- ----------------------------------------------------------------------
create table if not exists public.notifications (
  -- id non fourni à l'insert → default obligatoire ; le PATCH le reçoit
  -- ensuite en string depuis le client.
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  -- 'mission_created' | 'price_drop' | 'proposal' | 'booking_confirmed'
  -- | 'system' (type NotificationType). Pas de CHECK : lib/notifications.ts
  -- accepte un `type: string` libre.
  type        text not null,
  title       text not null,
  body        text not null,
  data        jsonb,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- ----------------------------------------------------------------------
-- subscribers
-- Utilisée par : app/api/subscribe/route.ts
--                (upsert {email, subscribed_at, active} onConflict 'email')
-- ----------------------------------------------------------------------
create table if not exists public.subscribers (
  -- email en PK : requis par l'upsert onConflict 'email' (normalisé
  -- lowercase + trim côté route).
  email          text primary key,
  subscribed_at  timestamptz not null default now(),
  active         boolean not null default true
);

-- ----------------------------------------------------------------------
-- offers_history
-- Utilisée par : app/api/mission/[id]/route.ts
--                (select * .eq('mission_id') .order('score' desc))
--
-- INCERTAIN : aucune route n'écrit dans cette table dans le code actuel ;
-- les colonnes sont déduites de la lecture (offer.id, offer.airline,
-- offer.price_usd, offer.carbon_kg, offer.score, offer.label).
-- ----------------------------------------------------------------------
create table if not exists public.offers_history (
  -- text : l'id est réexposé comme Offer.id (string) dans lib/types.ts
  id          text primary key default gen_random_uuid()::text,
  mission_id  text not null references public.missions (id) on delete cascade,
  airline     text,
  price_usd   numeric(10,2),
  carbon_kg   numeric(10,2),
  score       numeric,
  label       text,
  created_at  timestamptz not null default now()
);

create index if not exists offers_history_mission_score_idx
  on public.offers_history (mission_id, score desc);

-- ----------------------------------------------------------------------
-- shared_trips
-- Utilisée par : app/api/trips/share/route.ts (insert {share_id, trip_data}),
--                app/api/trips/[shareId]/route.ts
--                (select 'share_id, trip_data, created_at' .eq('share_id'))
-- ----------------------------------------------------------------------
create table if not exists public.shared_trips (
  -- share_id = 8 caractères générés côté route (alphabet sans ambiguïté).
  -- La route rejette toute longueur != 8.
  share_id    text primary key,
  -- { title, flights[], hotels[], cars[], totalPrice, destination,
  --   destinationCoords, createdBy }
  trip_data   jsonb not null,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------
-- consent_logs
-- Utilisée par : app/api/auth/consent/route.ts (insert)
-- ----------------------------------------------------------------------
create table if not exists public.consent_logs (
  id            bigserial primary key,
  email         text not null,
  -- tableau de strings envoyé en JSON → jsonb (et non text[]) pour rester
  -- tolérant si la forme évolue.
  consents      jsonb,
  consent_hash  text,          -- sha256 immuable du triplet (email, consents, timestamp)
  -- text et non inet : la route insère littéralement 'unknown' quand
  -- x-forwarded-for est absent.
  ip_address    text,
  user_agent    text,
  -- fourni explicitement par la route (timestamp ISO du client)
  created_at    timestamptz not null default now()
);

create index if not exists consent_logs_email_idx
  on public.consent_logs (email);

create index if not exists consent_logs_created_at_idx
  on public.consent_logs (created_at desc);

-- ----------------------------------------------------------------------
-- audit_logs
-- Utilisée par : lib/audit.ts (logAudit → insert {action, user_id, details,
--                created_at}), appelée notamment par app/api/user/delete/route.ts
-- ----------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          bigserial primary key,
  action      text not null,
  user_id     text,            -- nullable : logAudit accepte userId = null
  details     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

create index if not exists audit_logs_action_idx
  on public.audit_logs (action);

create index if not exists audit_logs_user_id_idx
  on public.audit_logs (user_id)
  where user_id is not null;

-- ----------------------------------------------------------------------
-- behavior_events
-- Utilisée par : app/api/events/route.ts (insert par batch de 100 max)
-- Forme de la ligne : BehaviorEvent (lib/algorithm/types) mappé snake_case.
-- ----------------------------------------------------------------------
create table if not exists public.behavior_events (
  id                bigserial primary key,
  user_id           text,            -- nullable : sessions anonymes
  device_id         text not null,
  -- l'événement porte un ts epoch ms converti en ISO avant insert
  ts                timestamptz not null,
  -- 'impression' | 'click' | 'save' | 'dismiss' | 'book' | 'abandon'
  -- | 'widen_applied' (whitelist appliquée par sanitize() côté route)
  kind              text not null,
  watch_id          text,
  offer_features    jsonb,
  context_features  jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists behavior_events_ts_idx
  on public.behavior_events (ts desc);

create index if not exists behavior_events_device_id_idx
  on public.behavior_events (device_id);

create index if not exists behavior_events_kind_idx
  on public.behavior_events (kind);

create index if not exists behavior_events_user_id_idx
  on public.behavior_events (user_id)
  where user_id is not null;

-- ----------------------------------------------------------------------
-- group_trips
-- Utilisée par : app/api/group-trips/route.ts (insert + select * .in('id')
--                .order('created_at' desc)),
--                app/api/group-trips/[id]/route.ts,
--                app/api/group-trips/[id]/join/route.ts (select id, invite_code, name),
--                app/api/group-trips/[id]/invite/route.ts (select id, name,
--                destination, invite_code)
-- ----------------------------------------------------------------------
create table if not exists public.group_trips (
  -- id non fourni à l'insert (relu ensuite via .select().single())
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  destination  text,
  start_date   date,
  end_date     date,
  -- owner_id reçoit l'email de l'organisateur ou la string 'anonymous'
  -- → text, pas uuid.
  owner_id     text not null,
  owner_name   text,
  -- invite_code n'est JAMAIS écrit par le code : il est relu juste après
  -- l'insert (trip.invite_code) et comparé au ?code= de l'URL dans
  -- /join. Il DOIT donc avoir un default non nul côté base.
  invite_code  text not null default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  created_at   timestamptz not null default now()
);

-- Unicité du code d'invitation : il sert de secret d'accès au trip.
create unique index if not exists group_trips_invite_code_key
  on public.group_trips (invite_code);

create index if not exists group_trips_owner_id_idx
  on public.group_trips (owner_id);

create index if not exists group_trips_created_at_idx
  on public.group_trips (created_at desc);

-- ----------------------------------------------------------------------
-- group_members
-- Utilisée par : app/api/group-trips/route.ts (insert ; select 'group_id'
--                .eq('user_email')),
--                app/api/group-trips/[id]/route.ts (select * .eq('group_id')
--                .order('joined_at')),
--                app/api/group-trips/[id]/join/route.ts (select id .eq(...)+ insert),
--                app/api/group-trips/[id]/invite/route.ts
--                (upsert onConflict 'group_id,user_email')
-- ----------------------------------------------------------------------
create table if not exists public.group_members (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.group_trips (id) on delete cascade,
  user_name   text,
  user_email  text,          -- nullable : un membre peut être ajouté sans email
  role        text not null default 'member',     -- 'organizer' | 'member'
  status      text not null default 'confirmed',  -- 'confirmed' | 'pending'
  joined_at   timestamptz not null default now()
);

-- Requis par l'upsert onConflict 'group_id,user_email' de /invite.
-- NB : les NULL restent distincts en Postgres → plusieurs membres sans
-- email restent possibles, ce qui correspond au comportement voulu.
create unique index if not exists group_members_group_email_key
  on public.group_members (group_id, user_email);

create index if not exists group_members_group_id_idx
  on public.group_members (group_id);

create index if not exists group_members_user_email_idx
  on public.group_members (user_email);

-- ----------------------------------------------------------------------
-- group_expenses
-- Utilisée par : app/api/group-trips/[id]/expenses/route.ts (insert),
--                app/api/group-trips/[id]/route.ts (select * .eq('group_id')
--                .order('created_at' desc))
-- ----------------------------------------------------------------------
create table if not exists public.group_expenses (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.group_trips (id) on delete cascade,
  description  text not null,
  amount       numeric(12,2) not null,
  -- nom libre saisi côté client ('Unknown' par défaut), pas une FK member
  paid_by      text,
  created_at   timestamptz not null default now()
);

create index if not exists group_expenses_group_created_idx
  on public.group_expenses (group_id, created_at desc);

-- ----------------------------------------------------------------------
-- group_polls
-- Utilisée par : app/api/group-trips/[id]/polls/route.ts (insert),
--                app/api/group-trips/[id]/route.ts
--                (select '*, group_poll_options(*)' .eq('group_id')
--                 .order('created_at'))
-- ----------------------------------------------------------------------
create table if not exists public.group_polls (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.group_trips (id) on delete cascade,
  question    text not null,
  created_at  timestamptz not null default now()
);

create index if not exists group_polls_group_created_idx
  on public.group_polls (group_id, created_at);

-- ----------------------------------------------------------------------
-- group_poll_options
-- Utilisée par : app/api/group-trips/[id]/polls/route.ts (insert
--                {poll_id, text, votes}),
--                app/api/group-trips/[id]/polls/[pollId]/vote/route.ts
--                (select 'votes' .eq('id') + update {votes}),
--                app/api/group-trips/[id]/route.ts (embed group_poll_options(*))
--
-- La FK poll_id ci-dessous n'est pas décorative : c'est elle qui permet à
-- PostgREST de résoudre l'embed `group_polls.select('*, group_poll_options(*)')`.
-- ----------------------------------------------------------------------
create table if not exists public.group_poll_options (
  id       uuid primary key default gen_random_uuid(),
  poll_id  uuid not null references public.group_polls (id) on delete cascade,
  text     text not null,
  votes    integer not null default 0
);

create index if not exists group_poll_options_poll_id_idx
  on public.group_poll_options (poll_id);

-- ----------------------------------------------------------------------
-- Note pour plus tard (hors périmètre de cette migration) :
-- app/api/group-trips/[id]/polls/[pollId]/vote/route.ts appelle
-- db.rpc('increment_vote', { option_id }). Cette fonction n'existe pas ;
-- la route retombe sur un read-modify-write non atomique. Créer la
-- fonction fera l'objet d'une migration dédiée.
-- ----------------------------------------------------------------------

-- ----------------------------------------------------------------------
-- RLS : volontairement non activée (voir l'en-tête).
-- ----------------------------------------------------------------------
-- alter table public.users enable row level security;
-- alter table public.user_preferences enable row level security;
-- ...
