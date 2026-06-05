CREATE TABLE IF NOT EXISTS campaigns(
  id SERIAL PRIMARY KEY,
  city TEXT,
  language TEXT,
  category TEXT,
  platform TEXT,
  objective TEXT,
  channel TEXT,
  tone TEXT,
  brief_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signals_cache(
  id SERIAL PRIMARY KEY,
  city TEXT,
  category TEXT,
  signals_json JSONB,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS price_watch(
  id SERIAL PRIMARY KEY,
  sku TEXT,
  city TEXT,
  platform TEXT,
  your_price NUMERIC,
  competitor_price NUMERIC,
  gap_pct NUMERIC,
  alert_level TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS experiment_plans(
  id SERIAL PRIMARY KEY,
  city TEXT,
  category TEXT,
  platform TEXT,
  plan_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learnings(
  id SERIAL PRIMARY KEY,
  campaign_id INT REFERENCES campaigns(id),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
