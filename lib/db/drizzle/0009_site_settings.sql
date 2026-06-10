ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "support_address" text;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "support_email" text;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "support_phone" text;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "social_facebook" text;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "social_instagram" text;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "social_twitter" text;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "social_youtube" text;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "web_announcement_speed" integer NOT NULL DEFAULT 60;
