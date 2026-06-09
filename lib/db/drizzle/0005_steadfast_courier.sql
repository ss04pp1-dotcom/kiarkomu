-- Courier service settings in app_settings
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS steadfast_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS carrybee_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS courier_auto_submit boolean NOT NULL DEFAULT false;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS active_courier text;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS carrybee_mode text NOT NULL DEFAULT 'sandbox';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS carrybee_client_id text;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS carrybee_client_secret text;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS carrybee_client_context text;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS carrybee_store_id text;

-- Multi-courier fields on orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_service text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrybee_consignment_id text;

-- Note field on order_tracking
ALTER TABLE order_tracking ADD COLUMN IF NOT EXISTS note text;

-- Steadfast courier fields on orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "consignment_id" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_code" text;
