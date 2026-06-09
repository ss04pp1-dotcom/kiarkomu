import { db } from "@workspace/db";
import { scheduledNotificationsTable } from "@workspace/db";
import { eq, lte, and } from "drizzle-orm";
import { logger } from "./logger.js";
import { computeNextRunAt, fireScheduledNotification } from "../routes/scheduled-notifications.js";

export function setupScheduledNotificationCron() {
  logger.info("Scheduled notification cron started — checking every minute");

  setInterval(async () => {
    try {
      const now = new Date();

      const due = await db.select()
        .from(scheduledNotificationsTable)
        .where(and(
          eq(scheduledNotificationsTable.isActive, true),
          lte(scheduledNotificationsTable.nextRunAt, now),
        ));

      for (const schedule of due) {
        try {
          await fireScheduledNotification(schedule, logger);

          const isOnce = schedule.scheduleType === "once";
          const nextRunAt = isOnce
            ? schedule.nextRunAt
            : computeNextRunAt({
                scheduleType: schedule.scheduleType,
                scheduleTime: schedule.scheduleTime,
                scheduleDayOfWeek: schedule.scheduleDayOfWeek,
                scheduleDayOfMonth: schedule.scheduleDayOfMonth,
                scheduledAt: schedule.scheduledAt,
              });

          await db.update(scheduledNotificationsTable)
            .set({
              lastRunAt: now,
              nextRunAt,
              isActive: isOnce ? false : true,
            })
            .where(eq(scheduledNotificationsTable.id, schedule.id));
        } catch (err) {
          logger.error({ err, scheduleId: schedule.id }, "Failed to fire scheduled notification");
        }
      }
    } catch (err) {
      logger.error({ err }, "Scheduled notification cron tick failed");
    }
  }, 60_000);
}
