import app from "./app";
import { logger } from "./lib/logger";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { setupAbandonedCartCron } from "./lib/abandoned-cart-cron.js";
import { setupCourierStatusCron } from "./lib/courier-status-cron.js";
import { setupDeliveryReviewCron } from "./lib/delivery-review-cron.js";
import { setupScheduledNotificationCron } from "./lib/scheduled-notification-cron.js";
import { setupKeepAlive } from "./lib/keep-alive.js";
import { setupNotificationCleanup } from "./lib/notification-cleanup.js";
import { setupUnpaidOrderCron } from "./lib/unpaid-order-cron.js";
import { setupJobQueue } from "./lib/job-queue.js";

const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

async function runMigrations() {
  const { pool, db } = await import("@workspace/db");

  // Check whether the Drizzle migrations journal table already exists.
  // If it does, the migrator owns the schema and will only run any new entries.
  const { rows: journalRows } = await pool.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT FROM pg_tables
      WHERE schemaname = 'public' AND tablename = '__drizzle_migrations'
    ) AS exists
  `);

  if (journalRows[0]?.exists) {
    // Migrator-managed DB — run normally; drizzle skips already-applied migrations.
    try {
      await migrate(db, { migrationsFolder });
      logger.info("Database migrations applied successfully");
    } catch (err) {
      logger.error({ err }, "Failed to run database migrations");
      process.exit(1);
    }
    return;
  }

  // No journal table found. Check whether the schema was bootstrapped via
  // `drizzle push` (users table exists but no migration journal).
  const { rows: usersRows } = await pool.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'users'
    ) AS exists
  `);

  if (!usersRows[0]?.exists) {
    // Completely fresh database — run full migration suite from scratch.
    try {
      await migrate(db, { migrationsFolder });
      logger.info("Database migrations applied successfully");
    } catch (err) {
      logger.error({ err }, "Failed to run database migrations");
      process.exit(1);
    }
    return;
  }

  // Push-initialized DB: users table exists but no migration journal.
  // Migrations 0001, 0002, and 0003 all use IF NOT EXISTS throughout, so they
  // are safe to apply directly as raw SQL without risking duplicate-object errors.
  logger.info("Push-initialized database detected — applying additive migrations");

  for (const tag of [
    "0001_overhaul_migrations",
    "0002_mfs_payment",
    "0003_missing_tables",
    "0004_salty_warhawk",
    "0005_steadfast_courier",
    "0006_courier_status_poll",
    "0007_smtp_google_ios",
    "0008_web_announcement",
  ]) {
    try {
      const sqlPath = path.join(migrationsFolder, `${tag}.sql`);
      const sqlContent = readFileSync(sqlPath, "utf8");
      const statements = sqlContent
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);

      for (const stmt of statements) {
        try {
          await pool.query(stmt);
        } catch (stmtErr: any) {
          // Ignore "already exists" errors — safe to skip for push-initialized DBs.
          if (
            stmtErr?.code === "42P07" || // relation already exists
            stmtErr?.code === "42710" || // type already exists
            stmtErr?.code === "42P06" || // schema already exists
            stmtErr?.message?.includes("already exists")
          ) {
            continue;
          }
          throw stmtErr;
        }
      }
      logger.info({ tag }, "Applied migration to push-initialized database");
    } catch (err: any) {
      logger.warn({ err, tag }, "Could not fully apply migration — continuing");
    }
  }
}

async function ensureAdminUser() {
  try {
    const { db } = await import("@workspace/db");
    const { usersTable } = await import("@workspace/db");
    const { hashPassword, generateReferralCode } = await import("./lib/auth.js");

    // Read credentials from env vars; fall back to safe defaults only for local dev.
    const adminEmail = (process.env["ADMIN_EMAIL"] ?? "admin@shohure.com").trim().toLowerCase();
    const adminPassword = process.env["ADMIN_PASSWORD"];
    if (!adminPassword) {
      logger.warn("ADMIN_PASSWORD env var is not set — skipping default admin creation for safety. Set ADMIN_PASSWORD to create the admin user.");
      return;
    }

    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where((await import("drizzle-orm")).eq(usersTable.email, adminEmail))
      .limit(1);

    if (existing.length === 0) {
      const passwordHash = await hashPassword(adminPassword);
      await db.insert(usersTable).values({
        name: "Admin",
        email: adminEmail,
        passwordHash,
        role: "owner",
        referralCode: generateReferralCode(),
        isActive: true,
      });
      logger.info({ email: adminEmail }, "Default admin user created");
    }
  } catch (err) {
    logger.error({ err }, "Failed to ensure admin user");
  }
}

// ── Fail fast: validate required environment variables before binding the port ──
const REQUIRED_ENV_VARS = ["SESSION_SECRET", "DATABASE_URL", "ADMIN_JWT_SECRET"] as const;
for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    logger.error(`Missing required environment variable: ${key}. Set it and restart.`);
    process.exit(1);
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  runMigrations()
    .then(() => ensureAdminUser())
    .then(() => setupAbandonedCartCron())
    .then(() => setupCourierStatusCron())
    .then(() => setupUnpaidOrderCron())
    .then(() => setupNotificationCleanup())
    .then(() => setupDeliveryReviewCron())
    .then(() => setupScheduledNotificationCron())
    .then(() => setupKeepAlive())
    .then(() => setupJobQueue());
});
