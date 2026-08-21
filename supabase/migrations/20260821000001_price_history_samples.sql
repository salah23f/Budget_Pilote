-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  price_history_samples — the agent's statistical memory           ║
-- ╚══════════════════════════════════════════════════════════════════╝
--
-- Why this table exists
-- ---------------------
-- The price history was written to `.data/price-history.json` via fs, on a
-- filesystem that is EPHEMERAL on Vercel. Every lambda recycle wiped it, and
-- the write failure was swallowed by a console.warn. The predictor needs 5
-- samples to leave its cold-start branch and 30 to be confident, so in
-- practice it almost never got there: the "prediction engine" degraded to a
-- single rule — buy if departure is under 14 days away.
--
-- This is the store that turns a cron that searches into an agent with
-- memory. It has to survive the process.
--
-- Design notes
-- ------------
--  * Append-only. Observations are facts; we never rewrite history.
--  * route_key is the canonical "ORIGIN|DEST|cabin|adults" string produced
--    by routeKey() — indexed because every read filters on it.
--  * No 2000-row-per-route ceiling here. That cap existed to keep a JSON
--    file small; in Postgres it was throwing away the very seasonality the
--    model needs. Retention is a pruning job's concern, not a write-path one.
--  * Kept separate from real_price_samples (the scraper's table): that one
--    stores raw scraped offers, this one stores per-sweep aggregates
--    (cheapest, second, median, offer count) with time-to-departure.

create table if not exists price_history_samples (
  id bigserial primary key,

  -- Canonical route identity, e.g. 'GVA|LIS|economy|2'
  route_key text not null,

  -- When the observation was taken
  checked_at timestamptz not null,

  -- The flight being priced
  depart_date date not null,
  return_date date,

  -- Days between checked_at and depart_date. Denormalised on purpose: every
  -- baseline query buckets on it, and recomputing it per row is wasteful.
  days_until_departure int not null,

  -- The observation itself
  price_usd numeric(10,2) not null,
  second_price numeric(10,2),
  median_price numeric(10,2),
  offer_count int not null default 0,

  -- Provenance
  airline text,
  source text,

  created_at timestamptz not null default now()
);

-- Every read is "samples for this route, newest first".
create index if not exists idx_phs_route_checked
  on price_history_samples (route_key, checked_at desc);

-- Baselines compare today's price against other observations taken at a
-- similar time-to-departure, so this pair is queried together.
create index if not exists idx_phs_route_ttd
  on price_history_samples (route_key, days_until_departure);

-- Retention sweeps and coverage stats scan by age alone.
create index if not exists idx_phs_checked
  on price_history_samples (checked_at desc);

comment on table price_history_samples is
  'Per-sweep price observations keyed by canonical route. Append-only; feeds the predictor baselines. Replaces the ephemeral .data/price-history.json.';

-- RLS is intentionally left off, matching the other tables in this project:
-- writes come from the server-side watcher using the service key, and this
-- table is never read from the browser.
