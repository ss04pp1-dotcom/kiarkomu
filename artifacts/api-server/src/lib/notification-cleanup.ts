import { db } from "@workspace/db";
import { notificationsTable, messagesTable, appSettingsTable } from "@workspace/db";
import { lt } from "drizzle-orm";
import { logger } from "./logger.js";

const DEFAULT_RETENTION_DAYS = 7;
const CRON_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function getRetentionDays(): Promise<number> {
  try {
    const [s] = await db.select({ days: appSettingsTable.notificationRetentionDays }).from(appSettingsTable).limit(1);
    return s?.days ?? DEFAULT_RETENTION_DAYS;
  } catch {
    return DEFAULT_RETENTION_DAYS;
  }
}

async function cleanupOldRecords(): Promise<void> {
  const retentionDays = await getRetentionDays();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const deletedNotifs = await db
    .delete(notificationsTable)
    .where(lt(notificationsTable.createdAt, cutoff));

  const deletedMsgs = await db
    .delete(messagesTable)
    .where(lt(messagesTable.createdAt, cutoff));

  logger.info(
    { cutoff, notifications: (deletedNotifs as any).rowCount ?? 0, messages: (deletedMsgs as any).rowCount ?? 0 },
    "7-day cleanup: deleted old notifications and messages"
  );
}

let cronHandle: ReturnType<typeof setInterval> | null = null;

export function setupNotificationCleanup(): void {
  if (cronHandle) return;
  logger.info("Notification/message cleanup cron started — running every 24 hours");

  cleanupOldRecords().catch((err) => logger.error({ err }, "Notification cleanup error on startup"));
  cronHandle = setInterval(
    () => cleanupOldRecords().catch((err) => logger.error({ err }, "Notification cleanup cron error")),
    CRON_INTERVAL_MS
  );
}

export function stopNotificationCleanup(): void {
  if (cronHandle) {
    clearInterval(cronHandle);
    cronHandle = null;
  }
}
