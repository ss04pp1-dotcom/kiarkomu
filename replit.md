# Shohure

A Bangladeshi e-commerce **website** (Next.js) backed by an Express API hosted on Render. This Replit environment runs the **web storefront only** — the admin panel and mobile app are not part of this Replit project.

---

## CRITICAL: Read Before Making Any Changes

### What runs here
| Artifact | Description | Active? |
|---|---|---|
| `artifacts/web` | Next.js 15 customer-facing website | ✅ YES — the only active artifact |
| `artifacts/api-server` | Express 5 backend (source code only) | ❌ NOT running here — deployed on Render |

The website calls the **live Render API** at `https://shohure-api.onrender.com`. There is no local API server running in this environment.

### The only workflow you should touch
| Workflow name | Command | Port |
|---|---|---|
| `Web Storefront` | `pnpm --filter @workspace/web run dev` | 5000 (internal), 80 (external) |

**Do not create, modify, or restart** `artifacts/admin: web`, `artifacts/mobile: expo`, or `artifacts/api-server: API Server` workflows — those artifacts no longer exist in this environment and will always fail.

### CRITICAL: Dual-port proxy — do not change the dev script
The Replit `.replit` config maps **two** local ports to external port 80:
- `localPort = 5000` → `externalPort = 80`
- `localPort = 23744` → `externalPort = 80`

Both must be alive or the proxy will 502 on every other request. The `dev` script in `artifacts/web/package.json` handles this by:
1. Starting Next.js on **port 5000** (the `waitForPort` target for the workflow)
2. Starting a lightweight Node.js HTTP proxy on **port 23744** that forwards all traffic to port 5000

**Never change the `dev` script** in `artifacts/web/package.json` to a plain `next dev` call — doing so removes the port 23744 proxy and causes intermittent 502 errors for users on mobile and external browsers.

Current dev script (do not modify):
```
node -e "const h=require('http');h.createServer(...).listen(23744)" & next dev --port 5000 --hostname 0.0.0.0
```

### API URL — never change this
`NEXT_PUBLIC_API_URL` is set to `https://shohure-api.onrender.com` in shared env vars. The Next.js app reads it via `artifacts/web/src/lib/config.ts`. **Never set it to localhost or an empty string.**

### Environment variables
- **Never edit `.replit` directly** — it is write-protected. Use `setEnvVars` / `deleteEnvVars` / `viewEnvVars` in the `code_execution` sandbox (see `environment-secrets` skill).

| Variable | Where set | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | shared env | Must be `https://shohure-api.onrender.com` |
| `VITE_API_URL` | shared env | Legacy — kept for compatibility, same value |
| `DATABASE_URL` | secret | Postgres connection string (not used locally) |
| `SESSION_SECRET` | secret | Express session signing (not used locally) |
| `CONFIG_ENCRYPTION_KEY` | shared env | For api-server only — not needed here |

---

## Run & Operate

```bash
# Start the website (only command you need)
pnpm --filter @workspace/web run dev

# Typecheck the web package
pnpm --filter @workspace/web run typecheck

# Build for production
pnpm --filter @workspace/web run build
```

Do not run `pnpm run dev` at the workspace root — there is no root dev script.

---

## Stack

- **Runtime**: Node.js 20, TypeScript 5.9, pnpm workspaces
- **Website**: Next.js 15 (App Router), React 19, Tailwind CSS v4, TanStack Query v5
- **API** (on Render, not here): Express 5, PostgreSQL, Drizzle ORM, Zod

---

## Where things live

```
artifacts/
  web/                Next.js website
    src/
      app/            File-based routing (App Router)
      components/     Shared UI components
      context/        React context providers
      lib/
        config.ts     API base URL — reads NEXT_PUBLIC_API_URL
    package.json      Contains the critical dual-port dev script
    next.config.ts    Allows all *.replit.dev origins

  api-server/         Express API source code (not run here — on Render)
    src/
      routes/         API route handlers
      middlewares/    Auth, logging, etc.
      lib/            crypto.ts, mailer.ts, etc.

lib/
  db/                 Drizzle ORM schema (source of truth for DB)
  api-spec/           OpenAPI 3.1 contract (openapi.yaml)
  api-client-react/   Generated TanStack Query hooks (from codegen)
  api-zod/            Generated Zod schemas (from codegen)
```

---

## Architecture

- **Contract-first API**: `lib/api-spec/openapi.yaml` is the single source of truth. Run `pnpm --filter @workspace/api-spec run codegen` after any spec change to regenerate hooks and schemas.
- **External API**: The website calls `https://shohure-api.onrender.com` directly. There is no local proxy — all `/api/` calls go straight to Render.
- **No SSR API calls**: All data fetching uses TanStack Query on the client side, hitting the Render API.

---

## ⛔ DATABASE SCHEMA — LOCKED & FINAL

The database schema is **complete and production-ready**. It must never be changed.

**The following are strictly prohibited for any agent, developer, automation, or deployment process:**
- Generating new migrations with `drizzle-kit generate` or `drizzle-kit push`
- Running `ALTER TABLE`, `DROP TABLE`, `CREATE TABLE`, or `DROP COLUMN` on the live DB
- Resetting, wiping, or re-seeding the database
- Adding, removing, or renaming columns in any schema `.ts` file
- Changing enum values in any `pgEnum`
- Running any migration tool automatically or on startup

**Before adding any feature:** verify it can be implemented using the existing schema. It almost certainly can.

**If you believe a schema change is truly needed:** stop immediately and ask the project owner explicitly. Do not proceed unilaterally.

### Final schema — 33 tables

| Table | Purpose |
|---|---|
| `users` | Customers, managers, owners |
| `categories` | Product categories (nested via `parent_id`) |
| `brands` | Product brands |
| `products` | Product catalogue |
| `product_variants` | SKU variants with `variant_data` JSONB |
| `sub_products` | Bundle/kit relationships between products |
| `recently_viewed` | Per-user product view history |
| `orders` | Customer orders |
| `order_items` | Line items per order |
| `order_tracking` | Status history per order |
| `transactions` | Payment transaction records |
| `addresses` | Saved delivery addresses per user |
| `carts` | One cart per user |
| `cart_items` | Items in a cart |
| `banners` | Homepage/promotional banners |
| `coupons` | Discount codes |
| `flash_sales` | Time-limited sale events |
| `product_reviews` | User reviews tied to order items |
| `notifications` | In-app notifications per user |
| `scheduled_notifications` | Cron-style push notification schedules |
| `shipping_zones` | Delivery zones with fees |
| `stores` | Physical store/pickup locations |
| `coin_transactions` | Loyalty coin earn/spend ledger |
| `user_coins` | Current coin balance per user |
| `referrals` | Referral relationships between users |
| `spin_logs` | Spin-wheel prize history |
| `messages` | Customer-support chat messages |
| `auto_reply_rules` | Keyword-triggered chat auto-replies |
| `app_settings` | Global site/payment/courier configuration |
| `app_config` | Encrypted mobile app config (Firebase, OAuth, storage) |
| `wishlists` | Per-user saved products |
| `email_verifications` | Email OTP verification state |
| `job_queue` | Background job queue (email, push) |

---

## Gotchas

- The `Web Storefront` workflow has `waitForPort = 5000`. If Next.js doesn't bind to port 5000 within 60s, the workflow fails. Never change Next.js off port 5000.
- If you get intermittent 502 errors, the port 23744 proxy in the dev script has been removed or broken. Restore the full dev script from the "Current dev script" section above.
- `drizzle-kit push` requires a TTY. Run migrations with `executeSql` in the code execution sandbox instead.
- After changing `openapi.yaml`, always run codegen before typechecking — stale generated files cause widespread TS errors.

---

## User preferences

- Do not use `console.log` in server code — use `req.log` in route handlers and the singleton `logger` elsewhere.
- SMTP provider is Brevo only — never add Gmail or other SMTP options.
- Keep `type` and `value` columns on `product_variants` alongside `variant_data` for mobile backward-compat.
