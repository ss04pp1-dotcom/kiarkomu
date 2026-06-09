-- Add MFS payment fields to orders table
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "transaction_id" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "sender_number" text;

-- Add 'pending' to payment_status enum (for MFS awaiting verification)
ALTER TYPE "payment_status" ADD VALUE IF NOT EXISTS 'pending';

-- Add MFS merchant numbers to app_settings
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "bkash_number" text;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "nagad_number" text;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "rocket_number" text;

-- Add 'rocket' to payment_method enum
ALTER TYPE "payment_method" ADD VALUE IF NOT EXISTS 'rocket';
