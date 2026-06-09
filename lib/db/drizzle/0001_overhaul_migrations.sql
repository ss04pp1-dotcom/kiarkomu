-- ============================================================
-- Migration: Shohure Platform Overhaul
-- Apply after existing 0000 migration
-- ============================================================

-- FIX 3: Persistent email verification table
-- Replaces in-memory Map in verification-store.ts
CREATE TABLE IF NOT EXISTS email_verifications (
  email      TEXT        PRIMARY KEY,
  code       TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified   BOOLEAN     NOT NULL DEFAULT FALSE
);

-- Auto-clean expired records
CREATE INDEX IF NOT EXISTS idx_email_verif_expires ON email_verifications (expires_at);

-- Feature 4: Enable fuzzy search (pg_trgm extension)
-- Provides word_similarity() used in products search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Optimize product name fuzzy search
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_name_bn_trgm
  ON products USING gin (name_bn gin_trgm_ops)
  WHERE name_bn IS NOT NULL;

-- Feature 7: Index for product views analytics
CREATE INDEX IF NOT EXISTS idx_recently_viewed_product
  ON recently_viewed (product_id);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_user
  ON recently_viewed (user_id, viewed_at DESC);

-- Feature 7: Index for top customer analytics
CREATE INDEX IF NOT EXISTS idx_orders_user_payment
  ON orders (user_id, payment_status);

-- FIX 5: Ensure cascade constraints (Drizzle will handle these via schema, but
-- add explicit FK constraints if migrating existing tables)
-- These are safe to run even if FKs already exist — use IF NOT EXISTS guards.

-- cart_items → carts (cascade)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cart_items_cart_id_fk' AND table_name = 'cart_items'
  ) THEN
    ALTER TABLE cart_items
      ADD CONSTRAINT cart_items_cart_id_fk
      FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- order_items → orders (cascade)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'order_items_order_id_fk' AND table_name = 'order_items'
  ) THEN
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_order_id_fk
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
  END IF;
END $$;

-- order_tracking → orders (cascade)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'order_tracking_order_id_fk' AND table_name = 'order_tracking'
  ) THEN
    ALTER TABLE order_tracking
      ADD CONSTRAINT order_tracking_order_id_fk
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
  END IF;
END $$;
