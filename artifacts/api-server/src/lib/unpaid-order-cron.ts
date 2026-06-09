// ── Unpaid Order Reminders — Cron Job ──
// Runs every 2 hours. Finds orders with payment_status='unpaid' and status='pending'
// created between 1 hour and 24 hours ago, then sends a push notification reminder.
// Register in server startup: setupUnpaidOrderCron()

import { db } from "@workspace/db";
import { ordersTable, usersTable } from "@workspace/db";
import { eq, and, lt, gt, inArray } from "drizzle-orm";
import { sendPushNotification } from "./push.js";
import { logger } from "./logger.js";

const CRON_INTERVAL_MS = 2 * 60 * 60 * 1000; // every 2 hours

async function processUnpaidOrders(): Promise<void> {
  const now = Date.now();
  const oneHourAgo       = new Date(now - 1  * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

  const unpaidOrders = await db
    .select({ id: ordersTable.id, userId: ordersTable.userId })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.paymentStatus, "unpaid"),
        eq(ordersTable.status, "pending"),
        lt(ordersTable.createdAt, oneHourAgo),
        gt(ordersTable.createdAt, twentyFourHoursAgo),
      )
    );

  if (!unpaidOrders.length) return;

  const userIds = unpaidOrders.map(o => o.userId);
  const users = await db
    .select({ id: usersTable.id, pushToken: usersTable.pushToken })
    .from(usersTable)
    .where(inArray(usersTable.id, userIds));

  const pushTokenMap = Object.fromEntries(users.map(u => [u.id, u.pushToken]));

  let notified = 0;
  for (const order of unpaidOrders) {
    const pushToken = pushTokenMap[order.userId];
    if (!pushToken) continue;
    await sendPushNotification(
      pushToken,
      "Complete Your Payment 🛍️",
      `You have a pending order #${order.id}. Please complete your payment to process your order.`,
      { screen: "orders" }
    ).catch(() => {
      // Silently ignore push notification failures — don't crash the cron
    });
    notified++;
  }

  if (notified > 0) {
    logger.info({ count: notified }, "Unpaid order reminder notifications sent");
  }
}

let cronHandle: ReturnType<typeof setInterval> | null = null;

export function setupUnpaidOrderCron(): void {
  if (cronHandle) return; // prevent double-registration
  logger.info("Unpaid order reminder cron started — checking every 2 hours");

  // Run once shortly after startup, then on interval
  setTimeout(
    () => processUnpaidOrders().catch((err) => logger.error({ err }, "Unpaid order cron error")),
    15_000
  );
  cronHandle = setInterval(
    () => processUnpaidOrders().catch((err) => logger.error({ err }, "Unpaid order cron error")),
    CRON_INTERVAL_MS
  );
}

export function stopUnpaidOrderCron(): void {
  if (cronHandle) {
    clearInterval(cronHandle);
    cronHandle = null;
  }
}
