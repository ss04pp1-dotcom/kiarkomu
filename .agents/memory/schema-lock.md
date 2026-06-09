---
name: Schema lock
description: The Shohure DB schema is final and locked. No future migrations are allowed without explicit owner approval.
---

# Database Schema — Locked

**Why:** Project owner explicitly locked the schema on June 2, 2026. All 33 tables were applied in a single migration. Future work must adapt to this schema, not change it.

**How to apply:** Before any feature work, verify the required data can be stored in the existing tables. It almost always can. Never run drizzle-kit, ALTER TABLE, or any migration tooling without the owner's explicit instruction.

## What was applied
- Full migration from `lib/db/drizzle/0000_windy_sauron.sql` (31 tables)
- Plus 2 tables missing from the migration file: `job_queue`, `scheduled_notifications`
- Plus 1 column missing from the migration file: `welcome_coupon_code` on `app_settings`

## 33 final tables
addresses, app_config, app_settings, auto_reply_rules, banners, brands, cart_items, carts, categories, coin_transactions, coupons, email_verifications, flash_sales, job_queue, messages, notifications, order_items, order_tracking, orders, product_reviews, product_variants, products, recently_viewed, referrals, scheduled_notifications, shipping_zones, spin_logs, stores, sub_products, transactions, user_coins, users, wishlists
