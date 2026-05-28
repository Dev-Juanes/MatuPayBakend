-- MatuPay — base central en MatuDB (un proyecto, todas las apps de pago)
-- Ejecutar una vez en el proyecto MatuDB dedicado a pagos (service role / SQL editor).

CREATE TABLE IF NOT EXISTS payment_apps (
  slug VARCHAR(64) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  frontend_url TEXT NOT NULL DEFAULT 'http://localhost:5173',
  cors_origins TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  api_token TEXT,
  gateway VARCHAR(32) NOT NULL DEFAULT 'wompi',
  wompi_env VARCHAR(10) NOT NULL DEFAULT 'test',
  wompi_public_key TEXT,
  wompi_private_key TEXT,
  wompi_integrity_secret TEXT,
  wompi_webhook_secret TEXT,
  invoice_brand_name VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_plans (
  app_slug VARCHAR(64) NOT NULL REFERENCES payment_apps(slug) ON DELETE CASCADE,
  plan_id VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  amount_cop INTEGER NOT NULL CHECK (amount_cop > 0),
  period VARCHAR(20) NOT NULL DEFAULT 'monthly',
  period_months INTEGER NOT NULL DEFAULT 1,
  currency VARCHAR(8) NOT NULL DEFAULT 'COP',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (app_slug, plan_id)
);

CREATE TABLE IF NOT EXISTS payment_subscriptions (
  app_slug VARCHAR(64) NOT NULL,
  customer_uid VARCHAR(128) NOT NULL,
  plan_id VARCHAR(80) NOT NULL DEFAULT '',
  billing_period VARCHAR(20) NOT NULL DEFAULT 'monthly',
  status VARCHAR(32) NOT NULL DEFAULT 'inactive',
  current_amount_cop INTEGER NOT NULL DEFAULT 0,
  period_start_ms BIGINT NOT NULL DEFAULT 0,
  period_end_ms BIGINT NOT NULL DEFAULT 0,
  last_reference TEXT,
  last_transaction_id TEXT,
  customer_email TEXT,
  customer_name TEXT,
  last_error TEXT,
  updated_at_ms BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (app_slug, customer_uid)
);

CREATE INDEX IF NOT EXISTS idx_payment_subscriptions_status
  ON payment_subscriptions (app_slug, status, period_end_ms);

CREATE TABLE IF NOT EXISTS payment_records (
  id BIGSERIAL PRIMARY KEY,
  app_slug VARCHAR(64) NOT NULL,
  customer_uid VARCHAR(128) NOT NULL,
  transaction_id VARCHAR(128),
  reference TEXT NOT NULL,
  plan_id VARCHAR(80),
  billing_period VARCHAR(20),
  amount_cop INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  wompi_status TEXT,
  paid_at_ms BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_records_app_customer
  ON payment_records (app_slug, customer_uid, paid_at_ms DESC);

CREATE INDEX IF NOT EXISTS idx_payment_records_reference
  ON payment_records (reference);

-- Winquina (ejemplo)
INSERT INTO payment_apps (
  slug, name, active, frontend_url, cors_origins,
  gateway, wompi_env, invoice_brand_name
) VALUES (
  'winquina',
  'Winquina',
  TRUE,
  'https://winquina.com',
  ARRAY['https://winquina.com', 'https://www.winquina.com', 'http://localhost:5173', 'https://matudb.com'],
  'wompi',
  'test',
  'Winquina'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  frontend_url = EXCLUDED.frontend_url,
  cors_origins = EXCLUDED.cors_origins,
  invoice_brand_name = EXCLUDED.invoice_brand_name,
  updated_at = NOW();

INSERT INTO payment_plans (app_slug, plan_id, name, description, amount_cop, period, period_months)
VALUES (
  'winquina',
  'winquina_pro_monthly',
  'Winquina PRO Mensual',
  'Pronósticos VIP, estadística, insignia PRO.',
  7900,
  'monthly',
  1
)
ON CONFLICT (app_slug, plan_id) DO NOTHING;
