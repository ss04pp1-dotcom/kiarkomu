import { Router } from "express";
import { db } from "@workspace/db";
import { scheduledNotificationsTable, usersTable, notificationsTable } from "@workspace/db";
import { eq, lte, and, inArray, count, or, ilike, gte } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/requireAuth.js";
import { sendPushNotifications } from "../lib/push.js";

const router = Router();

export function computeNextRunAt(s: {
  scheduleType: string;
  scheduleTime: string;
  scheduleDayOfWeek?: number | null;
  scheduleDayOfMonth?: number | null;
  scheduledAt?: Date | null;
}): Date {
  const now = new Date();
  const parts = (s.scheduleTime ?? "09:00").split(":");
  const h = parseInt(parts[0] ?? "9", 10);
  const m = parseInt(parts[1] ?? "0", 10);

  if (s.scheduleType === "once" && s.scheduledAt) {
    return new Date(s.scheduledAt);
  }
  if (s.scheduleType === "daily") {
    const next = new Date(now);
    next.setHours(h, m, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }
  if (s.scheduleType === "weekly" && s.scheduleDayOfWeek != null) {
    const next = new Date(now);
    next.setHours(h, m, 0, 0);
    const diff = (s.scheduleDayOfWeek - now.getDay() + 7) % 7;
    next.setDate(next.getDate() + (diff === 0 && next <= now ? 7 : diff === 0 ? 0 : diff));
    return next;
  }
  if (s.scheduleType === "monthly" && s.scheduleDayOfMonth != null) {
    const next = new Date(now);
    next.setDate(s.scheduleDayOfMonth);
    next.setHours(h, m, 0, 0);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(s.scheduleDayOfMonth);
    }
    return next;
  }
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

function serializeSchedule(s: any) {
  return {
    ...s,
    scheduledAt: s.scheduledAt?.toISOString() ?? null,
    lastRunAt: s.lastRunAt?.toISOString() ?? null,
    nextRunAt: s.nextRunAt?.toISOString() ?? null,
    createdAt: s.createdAt?.toISOString() ?? null,
  };
}

// ── Analytics ──────────────────────────────────────────────────────────────────
router.get("/admin/notifications/analytics", requireAuth, requireRole("owner", "manager"), async (req: AuthRequest, res) => {
  try {
    const { pool } = await import("@workspace/db");
    const days = Math.min(90, Math.max(7, parseInt((req.query.days as string) ?? "30", 10)));

    const [dailyResult, summaryResult, activeCnt] = await Promise.all([
      pool.query<{ date: Date; sent: number; read_count: number }>(`
        SELECT
          DATE(created_at AT TIME ZONE 'UTC') AS date,
          COUNT(*)::int AS sent,
          SUM(CASE WHEN read THEN 1 ELSE 0 END)::int AS read_count
        FROM notifications
        WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
        GROUP BY DATE(created_at AT TIME ZONE 'UTC')
        ORDER BY date ASC
      `, [days]),
      pool.query<{ total_sent: number; total_read: number }>(`
        SELECT
          COUNT(*)::int AS total_sent,
          SUM(CASE WHEN read THEN 1 ELSE 0 END)::int AS total_read
        FROM notifications
        WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
      `, [days]),
      db.select({ c: count() }).from(scheduledNotificationsTable).where(eq(scheduledNotificationsTable.isActive, true)),
    ]);

    const daily = dailyResult.rows.map(r => ({
      date: r.date.toISOString().slice(0, 10),
      sent: r.sent,
      read: r.read_count,
      openRate: r.sent > 0 ? Math.round((r.read_count / r.sent) * 100) : 0,
    }));

    const s = summaryResult.rows[0] ?? { total_sent: 0, total_read: 0 };

    res.json({
      daily,
      summary: {
        totalSent: s.total_sent ?? 0,
        totalRead: s.total_read ?? 0,
        avgOpenRate: (s.total_sent ?? 0) > 0 ? Math.round(((s.total_read ?? 0) / (s.total_sent ?? 0)) * 100) : 0,
        activeCampaigns: Number(activeCnt[0]?.c ?? 0),
      },
    });
  } catch (err) {
    req.log.error(err, "GET /admin/notifications/analytics failed");
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ── History ───────────────────────────────────────────────────────────────────
router.get("/admin/notifications/history", requireAuth, requireRole("owner", "manager"), async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
    const limit = Math.min(50, Math.max(5, parseInt((req.query.limit as string) ?? "20", 10)));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string)?.trim() ?? "";
    const type = (req.query.type as string)?.trim() ?? "";
    const readFilter = req.query.read as string;
    const fromDate = req.query.from as string;
    const toDate = req.query.to as string;

    const conditions: any[] = [];
    if (search) conditions.push(or(ilike(notificationsTable.title, `%${search}%`), ilike(notificationsTable.body, `%${search}%`)));
    if (type) conditions.push(eq(notificationsTable.type, type));
    if (readFilter === "true") conditions.push(eq(notificationsTable.read, true));
    if (readFilter === "false") conditions.push(eq(notificationsTable.read, false));
    if (fromDate) conditions.push(gte(notificationsTable.createdAt, new Date(fromDate)));
    if (toDate) conditions.push(lte(notificationsTable.createdAt, new Date(toDate + "T23:59:59Z")));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const { desc } = await import("drizzle-orm");

    const [rows, countResult] = await Promise.all([
      db.select({
        id: notificationsTable.id,
        userId: notificationsTable.userId,
        title: notificationsTable.title,
        body: notificationsTable.body,
        type: notificationsTable.type,
        read: notificationsTable.read,
        createdAt: notificationsTable.createdAt,
        userName: usersTable.name,
        userEmail: usersTable.email,
      })
        .from(notificationsTable)
        .leftJoin(usersTable, eq(notificationsTable.userId, usersTable.id))
        .where(where)
        .orderBy(desc(notificationsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ c: count() }).from(notificationsTable).where(where),
    ]);

    const total = Number(countResult[0]?.c ?? 0);
    res.json({
      notifications: rows.map(r => ({ ...r, createdAt: r.createdAt?.toISOString() ?? null })),
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    });
  } catch (err) {
    req.log.error(err, "GET /admin/notifications/history failed");
    res.status(500).json({ error: "Failed to fetch notification history" });
  }
});

// ── CRUD ───────────────────────────────────────────────────────────────────────
router.get("/admin/scheduled-notifications", requireAuth, requireRole("owner", "manager"), async (req: AuthRequest, res) => {
  try {
    const { desc } = await import("drizzle-orm");
    const list = await db.select().from(scheduledNotificationsTable).orderBy(desc(scheduledNotificationsTable.createdAt));
    res.json(list.map(serializeSchedule));
  } catch (err) {
    req.log.error(err, "GET /admin/scheduled-notifications failed");
    res.status(500).json({ error: "Failed to fetch scheduled notifications" });
  }
});

router.post("/admin/scheduled-notifications", requireAuth, requireRole("owner", "manager"), async (req: AuthRequest, res) => {
  try {
    const {
      title, body, type = "general",
      scheduleType, scheduleTime, scheduleDayOfWeek, scheduleDayOfMonth, scheduledAt,
      target = "all", targetUserIds = [],
    } = req.body as any;

    if (!title?.trim() || !body?.trim() || !scheduleType || !scheduleTime) {
      res.status(400).json({ error: "title, body, scheduleType and scheduleTime are required" });
      return;
    }

    const nextRunAt = computeNextRunAt({
      scheduleType, scheduleTime,
      scheduleDayOfWeek: scheduleDayOfWeek ?? null,
      scheduleDayOfMonth: scheduleDayOfMonth ?? null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    });

    const [created] = await db.insert(scheduledNotificationsTable).values({
      title: title.trim(), body: body.trim(), type, scheduleType, scheduleTime,
      scheduleDayOfWeek: scheduleDayOfWeek ?? null,
      scheduleDayOfMonth: scheduleDayOfMonth ?? null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      target: target === "specific" ? "specific" : "all",
      targetUserIds: JSON.stringify(Array.isArray(targetUserIds) ? targetUserIds.map(Number) : []),
      isActive: true, nextRunAt,
    }).returning();

    res.status(201).json(serializeSchedule(created));
  } catch (err) {
    req.log.error(err, "POST /admin/scheduled-notifications failed");
    res.status(500).json({ error: "Failed to create scheduled notification" });
  }
});

router.patch("/admin/scheduled-notifications/:id", requireAuth, requireRole("owner", "manager"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  try {
    const {
      title, body, type, scheduleType, scheduleTime,
      scheduleDayOfWeek, scheduleDayOfMonth, scheduledAt, isActive,
      target, targetUserIds,
    } = req.body as any;

    const [existing] = await db.select().from(scheduledNotificationsTable).where(eq(scheduledNotificationsTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    const merged = {
      scheduleType: scheduleType ?? existing.scheduleType,
      scheduleTime: scheduleTime ?? existing.scheduleTime,
      scheduleDayOfWeek: scheduleDayOfWeek !== undefined ? scheduleDayOfWeek : existing.scheduleDayOfWeek,
      scheduleDayOfMonth: scheduleDayOfMonth !== undefined ? scheduleDayOfMonth : existing.scheduleDayOfMonth,
      scheduledAt: scheduledAt !== undefined ? (scheduledAt ? new Date(scheduledAt) : null) : existing.scheduledAt,
    };
    const nextRunAt = computeNextRunAt(merged);

    const updates: Record<string, any> = { nextRunAt };
    if (title !== undefined) updates.title = title.trim();
    if (body !== undefined) updates.body = body.trim();
    if (type !== undefined) updates.type = type;
    if (scheduleType !== undefined) updates.scheduleType = scheduleType;
    if (scheduleTime !== undefined) updates.scheduleTime = scheduleTime;
    if (scheduleDayOfWeek !== undefined) updates.scheduleDayOfWeek = scheduleDayOfWeek;
    if (scheduleDayOfMonth !== undefined) updates.scheduleDayOfMonth = scheduleDayOfMonth;
    if (scheduledAt !== undefined) updates.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (isActive !== undefined) updates.isActive = isActive;
    if (target !== undefined) updates.target = target;
    if (targetUserIds !== undefined) updates.targetUserIds = JSON.stringify(Array.isArray(targetUserIds) ? targetUserIds.map(Number) : []);

    const [updated] = await db.update(scheduledNotificationsTable).set(updates).where(eq(scheduledNotificationsTable.id, id)).returning();
    res.json(serializeSchedule(updated));
  } catch (err) {
    req.log.error(err, "PATCH /admin/scheduled-notifications/:id failed");
    res.status(500).json({ error: "Failed to update scheduled notification" });
  }
});

router.delete("/admin/scheduled-notifications/:id", requireAuth, requireRole("owner", "manager"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  try {
    await db.delete(scheduledNotificationsTable).where(eq(scheduledNotificationsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "DELETE /admin/scheduled-notifications/:id failed");
    res.status(500).json({ error: "Failed to delete scheduled notification" });
  }
});

// ── Fire helper (used by cron) ─────────────────────────────────────────────────
export async function fireScheduledNotification(schedule: any, log: any) {
  let targetUsers: { id: number; pushToken: string | null }[];

  if (schedule.target === "specific") {
    let ids: number[] = [];
    try { ids = JSON.parse(schedule.targetUserIds ?? "[]"); } catch {}
    if (ids.length === 0) { log.warn({ scheduleId: schedule.id }, "Specific target with empty userIds — skipping"); return; }
    targetUsers = await db.select({ id: usersTable.id, pushToken: usersTable.pushToken })
      .from(usersTable)
      .where(and(eq(usersTable.isActive, true), inArray(usersTable.id, ids)));
  } else {
    targetUsers = await db.select({ id: usersTable.id, pushToken: usersTable.pushToken })
      .from(usersTable)
      .where(eq(usersTable.isActive, true));
  }

  if (targetUsers.length === 0) return;

  const BATCH = 500;
  const insertValues = targetUsers.map(u => ({
    userId: u.id, title: schedule.title, body: schedule.body, type: schedule.type, read: false,
  }));
  for (let i = 0; i < insertValues.length; i += BATCH) {
    await db.insert(notificationsTable).values(insertValues.slice(i, i + BATCH));
  }

  const tokens = targetUsers.map(u => u.pushToken).filter(Boolean) as string[];
  if (tokens.length > 0) {
    sendPushNotifications(tokens, schedule.title, schedule.body, { type: schedule.type }).catch(() => {});
  }

  log.info({ scheduleId: schedule.id, target: schedule.target, users: targetUsers.length, push: tokens.length }, "Fired scheduled notification");
}

export default router;
