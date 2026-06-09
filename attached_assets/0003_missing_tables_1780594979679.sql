-- Migration 0003: add missing tables and indexes not covered by earlier migrations
-- All statements use IF NOT EXISTS so they are safe to re-run.

-- app_config (used by Admin Panel → App Config and the mobile app)
CREATE TABLE IF NOT EXISTS "app_config" (
  "id"     text PRIMARY KEY DEFAULT 'mobile',
  "config" jsonb NOT NULL
);

-- auto_reply_rules (keyword-triggered chat auto-replies)
CREATE TABLE IF NOT EXISTS "auto_reply_rules" (
  "id"         serial PRIMARY KEY,
  "keyword"    text NOT NULL,
  "response"   text NOT NULL,
  "is_active"  boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- spin_logs (gamification spin-wheel history)
CREATE TABLE IF NOT EXISTS "spin_logs" (
  "id"            serial PRIMARY KEY,
  "user_id"       integer NOT NULL,
  "prize"         text NOT NULL,
  "coins_won"     integer NOT NULL DEFAULT 0,
  "discount_code" text,
  "spun_at"       timestamp NOT NULL DEFAULT now()
);

-- email_verifications (persistent OTP store — replaces in-memory Map)
CREATE TABLE IF NOT EXISTS "email_verifications" (
  "email"      text PRIMARY KEY,
  "code"       text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "verified"   boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_email_verif_expires ON email_verifications (expires_at);

-- pg_trgm extension (fuzzy product search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_name_bn_trgm
  ON products USING gin (name_bn gin_trgm_ops)
  WHERE name_bn IS NOT NULL;

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_recently_viewed_product ON recently_viewed (product_id);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_user    ON recently_viewed (user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_payment     ON orders (user_id, payment_status);
