ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "smtp_host" text;
--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "smtp_port" integer;
--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "smtp_secure" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "google_ios_client_id" text;
