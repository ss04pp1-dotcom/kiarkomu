import { db } from "@workspace/db";
import { orderTrackingTable, orderItemsTable, ordersTable, usersTable, productReviewsTable } from "@workspace/db";
import { eq, and, gte, lt, inArray, notExists } from "drizzle-orm";
import { sendPushNotification } from "./push.js";
import { logger } from "./logger.js";

const CRON_INTERVAL_MS = 60 * 60 * 1000;

async function processDeliveryReviewReminders(): Promise<void> {
  const now = Date.now();
  const oneHourAgo = new Date(now - 1 * 60 * 60 * 1000);
  const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);

  const recentlyDelivered = await db
    .select({ orderId: orderTrackingTable.orderId })
    .from(orderTrackingTable)
    .where(
      and(
        eq(orderTrackingTable.status, "delivered"),
        gte(orderTrackingTable.timestamp, twoHoursAgo),
        lt(orderTrackingTable.timestamp, oneHourAgo)
      )
    );

  if (!recentlyDelivered.length) return;

  const orderIds = recentlyDelivered.map((r) => r.orderId);

  const ordersWithUsers = await db
    .select({ orderId: ordersTable.id, userId: ordersTable.userId })
    .from(ordersTable)
    .where(inArray(ordersTable.id, orderIds));

  if (!ordersWithUsers.length) return;

  const userIds = ordersWithUsers.map((o) => o.userId);
  const users = await db
    .select({ id: usersTable.id, pushToken: usersTable.pushToken })
    .from(usersTable)
    .where(inArray(usersTable.id, userIds));

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const orderUserMap = Object.fromEntries(ordersWithUsers.map((o) => [o.orderId, o.userId]));

  let sent = 0;

  for (const { orderId } of recentlyDelivered) {
    const userId = orderUserMap[orderId];
    if (!userId) continue;

    const user = userMap[userId];
    if (!user?.pushToken) continue;

    const unreviewedItems = await db
      .select({ id: orderItemsTable.id })
      .from(orderItemsTable)
      .where(
        and(
          eq(orderItemsTable.orderId, orderId),
          notExists(
            db
              .select({ id: productReviewsTable.id })
              .from(productReviewsTable)
              .where(eq(productReviewsTable.orderItemId, orderItemsTable.id))
          )
        )
      )
      .limit(1);

    if (!unreviewedItems.length) continue;

    await sendPushNotification(
      user.pushToken,
      "Share Your Experience! ⭐",
      `Your order #${orderId} has been delivered. Please share your feedback and write a review!`,
      { screen: "order", orderId }
    ).catch(() => {});

    sent++;
  }

  if (sent > 0) {
    logger.info({ count: sent }, "Delivery review reminder notifications sent");
  }
}

let cronHandle: ReturnType<typeof setInterval> | null = null;

export function setupDeliveryReviewCron(): void {
  if (cronHandle) return;
  logger.info("Delivery review reminder cron started — checking every 1 hour");
  setTimeout(
    () => processDeliveryReviewReminders().catch((err) => logger.error({ err }, "Delivery review cron error")),
    10_000
  );
  cronHandle = setInterval(
    () => processDeliveryReviewReminders().catch((err) => logger.error({ err }, "Delivery review cron error")),
    CRON_INTERVAL_MS
  );
}

export function stopDeliveryReviewCron(): void {
  if (cronHandle) {
    clearInterval(cronHandle);
    cronHandle = null;
  }
}
