ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "consignment_id" integer;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_code" text;
