-- V7 Scraper + Training pipeline tables
-- Run: supabase db push or paste in Supabase SQL editor

-- Real scraped price samples from RapidAPI sources
CREATE TABLE IF NOT EXISTS real_price_samples (
  id bigserial PRIMARY KEY,
  origin text NOT NULL,
  destination text NOT NULL,
  depart_date date NOT NULL,
  return_date date,
  price_usd numeric(10,2) NOT NULL,
  airline text,
  stops int DEFAULT 0,
  duration_minutes int,
  cabin_class text DEFAULT 'economy',
  source text NOT NULL,  -- sky-scrapper, kiwi, air-scraper, etc.
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rps_route ON real_price_samples (origin, destination);
CREATE INDEX IF NOT EXISTS idx_rps_depart ON real_price_samples (depart_date);
CREATE INDEX IF NOT EXISTS idx_rps_fetched ON real_price_samples (fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_rps_source ON real_price_samples (source);

-- Aggregated fare data (from BTS, Kaggle, etc. — no exact TTD)
CREATE TABLE IF NOT EXISTS real_aggregated_fares (
  id bigserial PRIMARY KEY,
  origin text NOT NULL,
  destination text NOT NULL,
  year int NOT NULL,
  quarter int NOT NULL,
  avg_fare_usd numeric(10,2),
  median_fare_usd numeric(10,2),
  min_fare_usd numeric(10,2),
  max_fare_usd numeric(10,2),
  sample_count int,
  source text NOT NULL,  -- bts-db1b, bts-t100, kaggle, expedia
  ingested_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_raf_route ON real_aggregated_fares (origin, destination);
CREATE INDEX IF NOT EXISTS idx_raf_period ON real_aggregated_fares (year, quarter);

-- Ingestion run log
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id bigserial PRIMARY KEY,
  source text NOT NULL,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  rows_ingested int DEFAULT 0,
  rows_skipped int DEFAULT 0,
  errors text[],
  status text DEFAULT 'running'  -- running, completed, failed
);

-- Pre-computed features for ML training
CREATE TABLE IF NOT EXISTS real_features (
  id bigserial PRIMARY KEY,
  route_key text NOT NULL,       -- e.g. CDG-NRT
  feature_date date NOT NULL,
  ttd_days int,                  -- days to departure (null for aggregated)
  features jsonb NOT NULL,       -- { rolling_mean_7d, rolling_std_7d, z_score, ... }
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rf_route ON real_features (route_key);
CREATE INDEX IF NOT EXISTS idx_rf_date ON real_features (feature_date);

-- V7 model registry
CREATE TABLE IF NOT EXISTS model_runs (
  id bigserial PRIMARY KEY,
  model_id text NOT NULL,        -- e.g. kalman, hmm-regime, ensemble
  version text NOT NULL,
  trained_at timestamptz DEFAULT now(),
  hyperparams jsonb,
  metrics jsonb,                 -- { mae, mape, coverage_90, capture_eff, ... }
  data_hash text,
  artifact_path text,            -- path to .onnx or .json model file
  is_active boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_mr_model ON model_runs (model_id, version);

-- Scraper run log
CREATE TABLE IF NOT EXISTS scraper_runs (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  routes_attempted int DEFAULT 0,
  routes_succeeded int DEFAULT 0,
  routes_failed int DEFAULT 0,
  total_flights int DEFAULT 0,
  cheapest_overall numeric(10,2),
  quota_snapshot jsonb,
  created_at timestamptz DEFAULT now()
);

-- Drift alerts (monitored by cron)
CREATE TABLE IF NOT EXISTS drift_alerts (
  id bigserial PRIMARY KEY,
  route_key text NOT NULL,
  metric text NOT NULL,          -- kl_divergence, mean_shift, variance_ratio
  value numeric,
  threshold numeric,
  severity text DEFAULT 'info',  -- info, warning, critical
  acknowledged boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_da_route ON drift_alerts (route_key);
CREATE INDEX IF NOT EXISTS idx_da_created ON drift_alerts (created_at DESC);
