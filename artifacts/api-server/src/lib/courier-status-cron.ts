import { db } from "@workspace/db";
import { ordersTable, usersTable, notificationsTable, appSettingsTable } from "@workspace/db";
import { eq, and, isNotNull, inArray, notInArray } from "drizzle-orm";
import { checkDeliveryStatus } from "./steadfast.js";
import { carrybeeGetOrderDetails } from "./carrybee.js";
import { sendPushNotification } from "./push.js";
import { logger } from "./logger.js";

const POLL_INTERVAL_MS = 30 * 60 * 1000; // every 30 minutes

const TERMINAL = ["delivered", "cancelled", "returned"];

const STEADFAST_LABELS: Record<string, string> = {
  in_review:         "In Review",
  confirmed:         "Confirmed",
  processing:        "Processing",
  shipped:           "Shipped",
  delivered:         "Delivered",
  cancelled:         "Cancelled",
  partial_delivered: "Partially Delivered",
  partial_cancelled: "Partially Cancelled",
};

async function pollCourierStatuses(): Promise<void> {
  const activeOrders = await db
    .select({
      id:                      ordersTable.id,
      userId:                  ordersTable.userId,
      status:                  ordersTable.status,
      courierService:          ordersTable.courierService,
      consignmentId:           ordersTable.consignmentId,
      carrybeeConsignmentId:   ordersTable.carrybeeConsignmentId,
      lastCourierStatus:       (ordersTable as any).lastCourierStatus,
    })
    .from(ordersTable)
    .where(
      and(
        isNotNull(ordersTable.courierService),
        notInArray(ordersTable.status, TERMINAL as any)
      )
    );

  if (!activeOrders.length) return;

  const [settings] = await db.select().from(appSettingsTable).limit(1);

  const userIds = [...new Set(activeOrders.map((o) => o.userId))];
  const users = await db
    .select({ id: usersTable.id, name: usersTable.name, pushToken: usersTable.pushToken })
    .from(usersTable)
    .where(inArray(usersTable.id, userIds));
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  let notified = 0;

  for (const order of activeOrders) {
    try {
      let newStatus: string | null = null;
      let statusLabel: string | null = null;

      if (order.courierService === "steadfast" && order.consignmentId != null) {
        const apiKey = process.env["STEADFAST_API_KEY"];
        const secretKey = process.env["STEADFAST_SECRET_KEY"];
        if (!apiKey || !secretKey) {
          logger.warn({ orderId: order.id }, "Skipping Steadfast poll — API keys not configured");
          continue;
        }
        const result = await checkDeliveryStatus(order.id);
        if (result?.delivery_status) {
          newStatus = result.delivery_status;
          statusLabel = STEADFAST_LABELS[newStatus] ?? newStatus;
        }
      } else if (order.courierService === "carrybee" && order.carrybeeConsignmentId) {
        const result = await carrybeeGetOrderDetails(order.carrybeeConsignmentId, settings ?? {});
        if (result?.transferStatus) {
          newStatus = result.transferStatus;
          statusLabel = newStatus;
        }
      }

      // Skip if no new status or unchanged
      if (!newStatus || newStatus === order.lastCourierStatus) continue;

      // Build update payload
      const updateData: Record<string, any> = {
        lastCourierStatus: newStatus,
        updatedAt: new Date(),
      };

      // Auto-advance order status to "delivered" if courier confirms it
      const courierDelivered =
        (order.courierService === "steadfast" && newStatus === "delivered") ||
        (order.courierService === "carrybee" && newStatus === "Delivered");
      if (courierDelivered && order.status !== "delivered") {
        updateData.status = "delivered";
      }

      await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, order.id));

      // Insert in-app notification
      try {
        await db.insert(notificationsTable).values({
          userId: order.userId,
          title: "Courier Update 🚚",
          body: `Order #${order.id} — ${statusLabel}`,
          type: "order",
          read: false,
        });
      } catch (notifErr) {
        logger.warn({ err: notifErr, orderId: order.id }, "Failed to insert courier notification");
      }

      // Push notification (fire-and-forget)
      const user = userMap[order.userId];
      if (user?.pushToken) {
        sendPushNotification(
          user.pushToken,
          "Courier Update 🚚",
          `Order #${order.id}: ${statusLabel}`,
          { orderId: order.id }
        ).catch(() => {});
      }

      logger.info(
        { orderId: order.id, courier: order.courierService, prev: order.lastCourierStatus, next: newStatus },
        "Courier status changed — notified customer"
      );
      notified++;
    } catch (err) {
      logger.error({ err, orderId: order.id }, "Courier status poll failed for order");
    }
  }

  if (notified > 0) {
    logger.info({ notified }, "Courier status cron: notifications sent");
  }
}

let cronHandle: ReturnType<typeof setInterval> | null = null;

export function setupCourierStatusCron(): void {
  if (cronHandle) return;
  logger.info("Courier status cron started — polling every 30 minutes");
  // First check 15 seconds after startup (let migrations and settings load)
  setTimeout(
    () => pollCourierStatuses().catch((err) => logger.error({ err }, "Courier status cron error")),
    15_000
  );
  cronHandle = setInterval(
    () => pollCourierStatuses().catch((err) => logger.error({ err }, "Courier status cron error")),
    POLL_INTERVAL_MS
  );
}

export function stopCourierStatusCron(): void {
  if (cronHandle) {
    clearInterval(cronHandle);
    cronHandle = null;
  }
}
