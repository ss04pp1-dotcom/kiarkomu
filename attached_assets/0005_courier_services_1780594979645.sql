ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS steadfast_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS carrybee_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS courier_auto_submit boolean NOT NULL DEFAULT false;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS active_courier text;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS carrybee_mode text NOT NULL DEFAULT 'sandbox';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS carrybee_client_id text;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS carrybee_client_secret text;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS carrybee_client_context text;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS carrybee_store_id text;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_service text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrybee_consignment_id text;

ALTER TABLE order_tracking ADD COLUMN IF NOT EXISTS note text;
