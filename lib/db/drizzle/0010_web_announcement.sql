ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "web_announcement_text" text;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "web_announcement_active" boolean NOT NULL DEFAULT true;
