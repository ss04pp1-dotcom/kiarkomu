// ── Feature 3: Abandoned Cart Recovery — Cron Job ──
// Runs every hour, finds carts not updated for 24h, sends push notification.
// Register this in your main server startup file: setupAbandonedCartCron();

import { db } from "@workspace/db";
import { cartsTable, cartItemsTable, usersTable } from "@workspace/db";
import { eq, lt, gt, sql, inArray } from "drizzle-orm";
import { sendPushNotification } from "./push.js";
import { logger } from "./logger.js";

const ABANDONED_THRESHOLD_HOURS = 24;
const CRON_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function processAbandonedCarts(): Promise<void> {
  const cutoff = new Date(Date.now() - ABANDONED_THRESHOLD_HOURS * 60 * 60 * 1000);

  // Find carts that have items and were last updated before the cutoff
  const abandonedCarts = await db
    .select({
      cartId: cartsTable.id,
      userId: cartsTable.userId,
      updatedAt: cartsTable.updatedAt,
      itemCount: sql<number>`cast(count(${cartItemsTable.id}) as int)`,
    })
    .from(cartsTable)
    .leftJoin(cartItemsTable, eq(cartItemsTable.cartId, cartsTable.id))
    .where(lt(cartsTable.updatedAt, cutoff))
    .groupBy(cartsTable.id, cartsTable.userId, cartsTable.updatedAt)
    .having(gt(sql<number>`count(${cartItemsTable.id})`, 0));

  if (!abandonedCarts.length) return;

  const userIds = abandonedCarts.map(c => c.userId);
  const users = await db
    .select({ id: usersTable.id, name: usersTable.name, pushToken: usersTable.pushToken })
    .from(usersTable)
    .where(inArray(usersTable.id, userIds));

  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  for (const cart of abandonedCarts) {
    const user = userMap[cart.userId];
    if (!user?.pushToken) continue;

    const itemWord = cart.itemCount === 1 ? "item" : "items";
    await sendPushNotification(
      user.pushToken,
      "You left something behind! 🛒",
      `Hey ${user.name?.split(" ")[0] ?? "there"}! You have ${cart.itemCount} ${itemWord} waiting in your cart. Complete your order before they sell out!`,
      { screen: "cart" }
    ).catch(() => {
      // Silently ignore push notification failures — don't crash the cron
    });
  }

  logger.info({ count: abandonedCarts.length }, "Abandoned cart notifications sent");
}

let cronHandle: ReturnType<typeof setInterval> | null = null;

export function setupAbandonedCartCron(): void {
  if (cronHandle) return; // prevent double-registration
  logger.info("Abandoned cart cron started — checking every hour");

  // Run once shortly after startup, then on interval
  setTimeout(() => processAbandonedCarts().catch((err) => logger.error({ err }, "Abandoned cart cron error")), 5000);
  cronHandle = setInterval(() => processAbandonedCarts().catch((err) => logger.error({ err }, "Abandoned cart cron error")), CRON_INTERVAL_MS);
}

export function stopAbandonedCartCron(): void {
  if (cronHandle) {
    clearInterval(cronHandle);
    cronHandle = null;
  }
}
