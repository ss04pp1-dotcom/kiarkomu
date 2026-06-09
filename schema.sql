-- =============================================================
--  Shohure — Full Database Schema
--  Run once against a blank PostgreSQL database to create
--  every table and enum. Safe to re-run (idempotent).
--
--  Usage:
--    psql "$DATABASE_URL" -f schema.sql
--
--  Note: PostgreSQL does not support CREATE TYPE IF NOT EXISTS,
--  so enums are created inside DO blocks that swallow the
--  "already exists" error on repeat runs.
-- =============================================================

-- ─── ENUMS ────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'manager', 'customer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'pending', 'confirmed', 'packing', 'shipped',
    'out_for_delivery', 'delivered', 'cancelled', 'returned'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('unpaid', 'pending', 'paid', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cod', 'bkash', 'nagad', 'rocket', 'card');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE delivery_method AS ENUM ('home_delivery', 'store_pickup');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE coupon_type AS ENUM ('percent', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── USERS ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id                 SERIAL PRIMARY KEY,
  name               TEXT NOT NULL,
  email              TEXT NOT NULL UNIQUE,
  password_hash      TEXT NOT NULL,
  phone              TEXT,
  avatar_url         TEXT,
  gender             TEXT,
  birthday           TEXT,
  role               user_role NOT NULL DEFAULT 'customer',
  referral_code      TEXT NOT NULL UNIQUE,
  push_token         TEXT,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  reset_token        TEXT,
  reset_token_expiry TIMESTAMP,
  created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── CATEGORIES ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  name_bn    TEXT,
  slug       TEXT NOT NULL UNIQUE,
  image_url  TEXT,
  parent_id  INTEGER,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── BRANDS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brands (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  logo_url   TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── PRODUCTS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  name_bn        TEXT,
  slug           TEXT NOT NULL UNIQUE,
  description    TEXT,
  price          NUMERIC(12, 2) NOT NULL,
  original_price NUMERIC(12, 2),
  category_id    INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  brand_id       INTEGER REFERENCES brands(id) ON DELETE SET NULL,
  stock          INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  is_fast        BOOLEAN NOT NULL DEFAULT FALSE,
  thumbnail_url  TEXT,
  images         JSONB NOT NULL DEFAULT '[]',
  specifications JSONB,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_variants (
  id             SERIAL PRIMARY KEY,
  product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,
  value          TEXT NOT NULL,
  price_modifier NUMERIC(10, 2) NOT NULL DEFAULT 0,
  stock          INTEGER NOT NULL DEFAULT 0,
  variant_data   JSONB,
  sku            TEXT
);

CREATE TABLE IF NOT EXISTS sub_products (
  id                SERIAL PRIMARY KEY,
  parent_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sub_product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity          INTEGER NOT NULL DEFAULT 1,
  sort_order        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recently_viewed (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  viewed_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── ADDRESSES ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS addresses (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL,
  label        TEXT NOT NULL,
  full_name    TEXT NOT NULL,
  phone        TEXT NOT NULL,
  address_line TEXT NOT NULL,
  district     TEXT NOT NULL,
  area         TEXT NOT NULL,
  postal_code  TEXT,
  is_default   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── CARTS ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS carts (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id                SERIAL PRIMARY KEY,
  cart_id           INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id        INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id        INTEGER,
  product_name      TEXT NOT NULL,
  product_thumbnail TEXT,
  price             NUMERIC(12, 2) NOT NULL,
  quantity          INTEGER NOT NULL DEFAULT 1,
  variant_label     TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── ORDERS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id                      SERIAL PRIMARY KEY,
  user_id                 INTEGER NOT NULL,
  status                  order_status NOT NULL DEFAULT 'pending',
  payment_status          payment_status NOT NULL DEFAULT 'unpaid',
  payment_method          payment_method NOT NULL,
  delivery_method         delivery_method NOT NULL,
  address_id              INTEGER,
  store_id                INTEGER,
  coupon_code             TEXT,
  subtotal                NUMERIC(12, 2) NOT NULL,
  shipping_fee            NUMERIC(10, 2) NOT NULL DEFAULT 0,
  discount                NUMERIC(10, 2) NOT NULL DEFAULT 0,
  coins_used              INTEGER NOT NULL DEFAULT 0,
  total                   NUMERIC(12, 2) NOT NULL,
  notes                   TEXT,
  ssl_session_key         TEXT,
  transaction_id          TEXT,
  sender_number           TEXT,
  consignment_id          INTEGER,
  tracking_code           TEXT,
  courier_service         TEXT,
  carrybee_consignment_id TEXT,
  last_courier_status     TEXT,
  created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id            SERIAL PRIMARY KEY,
  order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    INTEGER NOT NULL,
  variant_id    INTEGER,
  product_name  TEXT NOT NULL,
  thumbnail_url TEXT,
  price         NUMERIC(12, 2) NOT NULL,
  quantity      INTEGER NOT NULL,
  variant_label TEXT
);

CREATE TABLE IF NOT EXISTS order_tracking (
  id        SERIAL PRIMARY KEY,
  order_id  INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status    TEXT NOT NULL,
  note      TEXT,
  lat       NUMERIC(10, 7),
  long      NUMERIC(10, 7),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  amount      NUMERIC(12, 2) NOT NULL,
  status      TEXT NOT NULL,
  gateway_ref TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── PROMOTIONS ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coupons (
  id               SERIAL PRIMARY KEY,
  code             TEXT NOT NULL UNIQUE,
  type             coupon_type NOT NULL,
  value            NUMERIC(10, 2) NOT NULL,
  min_order_amount NUMERIC(12, 2),
  max_uses         INTEGER,
  used_count       INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at       TIMESTAMP,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS banners (
  id             SERIAL PRIMARY KEY,
  title          TEXT NOT NULL,
  image_url      TEXT NOT NULL,
  dominant_color TEXT,
  link_url       TEXT,
  position       INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flash_sales (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  starts_at   TIMESTAMP NOT NULL,
  ends_at     TIMESTAMP NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  product_ids INTEGER[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── REVIEWS ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_reviews (
  id            SERIAL PRIMARY KEY,
  product_id    INTEGER NOT NULL,
  user_id       INTEGER NOT NULL,
  order_item_id INTEGER NOT NULL,
  rating        INTEGER NOT NULL,
  comment       TEXT,
  images        JSONB NOT NULL DEFAULT '[]',
  is_approved   BOOLEAN NOT NULL DEFAULT FALSE,
  admin_reply   TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── NOTIFICATIONS ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'general',
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── SHIPPING ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shipping_zones (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  districts      TEXT[] NOT NULL DEFAULT '{}',
  fee            NUMERIC(10, 2) NOT NULL,
  estimated_days INTEGER NOT NULL DEFAULT 3,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stores (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  address       TEXT NOT NULL,
  lat           NUMERIC(10, 7) NOT NULL,
  long          NUMERIC(10, 7) NOT NULL,
  opening_hours TEXT NOT NULL,
  phone         TEXT NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── GAMIFICATION ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_coins (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL UNIQUE,
  balance    INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coin_transactions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  type        TEXT NOT NULL,
  amount      INTEGER NOT NULL,
  description TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referrals (
  id            SERIAL PRIMARY KEY,
  referrer_id   INTEGER NOT NULL,
  referred_id   INTEGER NOT NULL UNIQUE,
  coins_awarded INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spin_logs (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL,
  prize         TEXT NOT NULL,
  coins_won     INTEGER NOT NULL DEFAULT 0,
  discount_code TEXT,
  spun_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── MESSAGES ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id           SERIAL PRIMARY KEY,
  sender_id    INTEGER NOT NULL,
  recipient_id INTEGER,
  body         TEXT NOT NULL,
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auto_reply_rules (
  id         SERIAL PRIMARY KEY,
  keyword    TEXT NOT NULL,
  response   TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── SETTINGS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_settings (
  id                        SERIAL PRIMARY KEY,
  site_name                 TEXT NOT NULL DEFAULT 'Shohure',
  logo_url                  TEXT,
  currency                  TEXT NOT NULL DEFAULT 'BDT',
  default_language          TEXT NOT NULL DEFAULT 'en',
  enable_free_delivery      BOOLEAN NOT NULL DEFAULT TRUE,
  free_delivery_threshold   NUMERIC(10, 2) NOT NULL DEFAULT 500,
  coin_value                NUMERIC(6, 2) NOT NULL DEFAULT 0.10,
  sslcommerz_store_id       TEXT,
  sslcommerz_store_password TEXT,
  sslcommerz_sandbox        BOOLEAN NOT NULL DEFAULT TRUE,
  promo_cards_json          TEXT,
  primary_color             TEXT NOT NULL DEFAULT '#E91E63',
  smtp_email                TEXT,
  smtp_password             TEXT,
  google_client_id          TEXT,
  google_client_secret      TEXT,
  google_android_client_id  TEXT,
  whatsapp_number           TEXT,
  bkash_number              TEXT,
  nagad_number              TEXT,
  rocket_number             TEXT,
  bkash_enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  nagad_enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  rocket_enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  cod_enabled               BOOLEAN NOT NULL DEFAULT TRUE,
  bkash_logo_url            TEXT,
  nagad_logo_url            TEXT,
  rocket_logo_url           TEXT,
  bkash_number_label        TEXT NOT NULL DEFAULT 'bKash Number',
  nagad_number_label        TEXT NOT NULL DEFAULT 'Nagad Number',
  rocket_number_label       TEXT NOT NULL DEFAULT 'Rocket Number',
  bkash_txn_label           TEXT NOT NULL DEFAULT 'Transaction ID (TrxID)',
  nagad_txn_label           TEXT NOT NULL DEFAULT 'Transaction ID (TrxID)',
  rocket_txn_label          TEXT NOT NULL DEFAULT 'Transaction ID (TrxID)',
  steadfast_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  carrybee_enabled          BOOLEAN NOT NULL DEFAULT FALSE,
  courier_auto_submit       BOOLEAN NOT NULL DEFAULT FALSE,
  active_courier            TEXT,
  carrybee_mode             TEXT NOT NULL DEFAULT 'sandbox',
  carrybee_client_id        TEXT,
  carrybee_client_secret    TEXT,
  carrybee_client_context   TEXT,
  carrybee_store_id         TEXT
);

-- ─── WISHLISTS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wishlists (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── APP CONFIG ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_config (
  id     TEXT PRIMARY KEY DEFAULT 'mobile',
  config JSONB NOT NULL
);

-- ─── EMAIL VERIFICATIONS ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_verifications (
  email      TEXT PRIMARY KEY,
  code       TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified   BOOLEAN NOT NULL DEFAULT FALSE
);

-- ─── DRIZZLE MIGRATIONS TRACKER ───────────────────────────────
-- Drizzle's push-based system needs this table to track which
-- additive migrations have already been applied.

CREATE TABLE IF NOT EXISTS __drizzle_migrations__ (
  id         SERIAL PRIMARY KEY,
  hash       TEXT NOT NULL,
  created_at BIGINT
);
