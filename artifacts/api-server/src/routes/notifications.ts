import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable, usersTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/requireAuth.js";
import { sendPushNotification, sendPushNotifications } from "../lib/push.js";

const router = Router();

router.get("/notifications", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { limit = "50" } = req.query as any;
    const parsedLimit = parseInt(limit, 10);
    const limitNum = Math.min(100, isNaN(parsedLimit) ? 50 : parsedLimit);

    const { desc } = await import("drizzle-orm");
    const list = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, req.userId!))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(limitNum);

    res.json(list.map((n: any) => ({ ...n, createdAt: n.createdAt.toISOString() })));
  } catch (err) {
    req.log.error(err, "GET /notifications failed");
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.patch("/notifications/:id/read", requireAuth, async (req: AuthRequest, res) => {
  const notifId = parseInt(req.params.id as string, 10);
  if (isNaN(notifId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  try {
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(
        and(
          eq(notificationsTable.id, notifId),
          eq(notificationsTable.userId, req.userId!)
        )
      );
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "PATCH /notifications/:id/read failed");
    res.status(500).json({ error: "Failed to mark notification read" });
  }
});

router.patch("/notifications/read-all", requireAuth, async (req: AuthRequest, res) => {
  try {
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.userId, req.userId!));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "PATCH /notifications/read-all failed");
    res.status(500).json({ error: "Failed to mark all notifications read" });
  }
});

router.post("/notifications/broadcast", requireAuth, requireRole("owner", "manager"), async (req: AuthRequest, res) => {
  try {
    const { title, body, type = "general" } = req.body as { title: string; body: string; type?: string };

    if (!title?.trim() || !body?.trim()) {
      res.status(400).json({ error: "title and body are required" });
      return;
    }

    const allUsers = await db.select({ id: usersTable.id, pushToken: usersTable.pushToken })
      .from(usersTable)
      .where(eq(usersTable.isActive, true));

    if (allUsers.length === 0) {
      res.json({ sent: 0, message: "No active users found" });
      return;
    }

    const insertValues = allUsers.map((u: any) => ({
      userId: u.id,
      title,
      body,
      type,
      read: false,
    }));

    const BATCH_SIZE = 500;
    for (let i = 0; i < insertValues.length; i += BATCH_SIZE) {
      await db.insert(notificationsTable).values(insertValues.slice(i, i + BATCH_SIZE));
    }

    const pushTokens = allUsers.map((u: any) => u.pushToken).filter(Boolean);
    if (pushTokens.length > 0) {
      sendPushNotifications(pushTokens as string[], title, body, { type }).catch(() => {});
    }

    res.json({ sent: allUsers.length, pushSent: pushTokens.length });
  } catch (err) {
    req.log.error(err, "POST /notifications/broadcast failed");
    res.status(500).json({ error: "Failed to broadcast notification" });
  }
});

// POST /notifications/send — single or multi-user
// Accepts either { userId: number, ... } for backward-compat or
// { userIds: number[], ... } to send to multiple users in one call.
router.post("/notifications/send", requireAuth, requireRole("owner", "manager"), async (req: AuthRequest, res) => {
  try {
    const { userId, userIds: userIdsRaw, title, body, type = "general" } = req.body as {
      userId?: number;
      userIds?: number[];
      title: string;
      body: string;
      type?: string;
    };

    // Normalise to array — accept both forms
    const ids: number[] = Array.isArray(userIdsRaw) && userIdsRaw.length > 0
      ? userIdsRaw.map(Number)
      : userId ? [Number(userId)]
      : [];

    if (ids.length === 0 || !title?.trim() || !body?.trim()) {
      res.status(400).json({ error: "userIds (or userId), title and body are required" });
      return;
    }

    // Fetch all requested users in one query
    const users = await db
      .select({ id: usersTable.id, pushToken: usersTable.pushToken })
      .from(usersTable)
      .where(inArray(usersTable.id, ids));

    if (users.length === 0) {
      res.status(404).json({ error: "No users found" });
      return;
    }

    // Insert in-app notifications for all users (batched)
    const BATCH = 100;
    const insertValues = users.map(u => ({ userId: u.id, title, body, type, read: false }));
    for (let i = 0; i < insertValues.length; i += BATCH) {
      await db.insert(notificationsTable).values(insertValues.slice(i, i + BATCH));
    }

    // Fire push notifications to users who have a push token
    const pushTokens = users.map(u => u.pushToken).filter((t): t is string => !!t);
    if (pushTokens.length === 1) {
      sendPushNotification(pushTokens[0], title, body, { type }).catch(() => {});
    } else if (pushTokens.length > 1) {
      sendPushNotifications(pushTokens, title, body, { type }).catch(() => {});
    }

    res.json({ sent: users.length, pushSent: pushTokens.length });
  } catch (err) {
    req.log.error(err, "POST /notifications/send failed");
    res.status(500).json({ error: "Failed to send notification" });
  }
});

router.delete("/notifications/:id", requireAuth, async (req: AuthRequest, res) => {
  const deleteId = parseInt(req.params.id as string, 10);
  if (isNaN(deleteId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  try {
    await db
      .delete(notificationsTable)
      .where(
        and(
          eq(notificationsTable.id, deleteId),
          eq(notificationsTable.userId, req.userId!)
        )
      );
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "DELETE /notifications/:id failed");
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

export default router;
