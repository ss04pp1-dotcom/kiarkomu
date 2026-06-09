import { Router } from "express";
import { db } from "@workspace/db";
import { messagesTable, usersTable, autoReplyRulesTable } from "@workspace/db";
import { eq, or, and, inArray, desc } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/messages", requireAuth, async (req: AuthRequest, res) => {
  const { conversationUserId } = req.query as any;
  const isAdmin = ["owner", "manager"].includes(req.userRole!);
  let messages;
  if (isAdmin && conversationUserId) {
    const uid = parseInt(conversationUserId, 10);
    if (isNaN(uid)) { res.status(400).json({ error: "Invalid user ID" }); return; }
    messages = await db.select().from(messagesTable)
      .where(or(eq(messagesTable.senderId, uid), eq(messagesTable.recipientId, uid)))
      .orderBy(messagesTable.createdAt);
  } else {
    messages = await db.select().from(messagesTable)
      .where(or(eq(messagesTable.senderId, req.userId!), eq(messagesTable.recipientId, req.userId!)))
      .orderBy(messagesTable.createdAt);
  }
  const userIds = [...new Set(messages.map(m => m.senderId))];
  const users = userIds.length ? await db.select({ id: usersTable.id, name: usersTable.name, role: usersTable.role }).from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const uMap = Object.fromEntries(users.map(u => [u.id, u]));
  res.json(messages.map(m => ({ ...m, senderName: uMap[m.senderId]?.name ?? "User", senderRole: uMap[m.senderId]?.role ?? "customer", createdAt: m.createdAt.toISOString() })));
});

router.post("/messages", requireAuth, async (req: AuthRequest, res) => {
  const { body, toUserId } = req.body;
  const [msg] = await db.insert(messagesTable).values({ senderId: req.userId!, recipientId: toUserId ?? null, body }).returning();
  const [sender] = await db.select({ name: usersTable.name, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  const senderRole = sender?.role ?? "customer";

  res.status(201).json({ ...msg, senderName: sender?.name ?? "User", senderRole, createdAt: msg.createdAt.toISOString() });

  // Fire-and-forget auto-reply — runs after the response is sent.
  // Wrapped in try/catch so errors are silently discarded and never reach
  // the Express error handler (headers are already sent at this point).
  if (!["owner", "manager"].includes(senderRole)) {
    try {
      const rules = await db.select().from(autoReplyRulesTable).where(eq(autoReplyRulesTable.isActive, true));
      const lowerBody = body.toLowerCase();
      const matched = rules.find(r => lowerBody.includes(r.keyword.toLowerCase()));
      if (matched) {
        const [admin] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "owner")).limit(1);
        if (admin) {
          await db.insert(messagesTable).values({
            senderId: admin.id,
            recipientId: req.userId!,
            body: matched.response,
          });
        }
      }
    } catch {
      // Silently ignore auto-reply failures — the customer's message was already saved.
    }
  }
});

router.get("/messages/conversations", requireAuth, async (req: AuthRequest, res) => {
  const isAdmin = ["owner", "manager"].includes(req.userRole!);

  // Admins see ALL messages so they can build every customer conversation.
  // Regular users only see messages they sent or received.
  const msgs = isAdmin
    ? await db.select().from(messagesTable)
        .orderBy(desc(messagesTable.createdAt))
        .limit(500)
    : await db.select().from(messagesTable)
        .where(or(eq(messagesTable.senderId, req.userId!), eq(messagesTable.recipientId, req.userId!)))
        .orderBy(desc(messagesTable.createdAt))
        .limit(500);

  const convMap = new Map<number, { userId: number; lastMessage: string; lastMessageAt: string; unreadCount: number }>();
  for (const m of msgs) {
    // For admin: the "other" user is whoever is not the admin (customer side).
    // Customer messages arrive with recipientId = null, so we always use senderId in that case.
    // For regular users: the "other" user is whoever is not themselves.
    const otherUserId = isAdmin
      ? (m.senderId !== req.userId! ? m.senderId : m.recipientId)
      : (m.senderId === req.userId! ? m.recipientId : m.senderId);

    if (!otherUserId) continue;

    const isFromOther = m.senderId !== req.userId!;
    const isUnread = !m.isRead && isFromOther;
    const existing = convMap.get(otherUserId);
    const accUnread = (existing?.unreadCount ?? 0) + (isUnread ? 1 : 0);
    if (!existing || existing.lastMessageAt < m.createdAt.toISOString()) {
      convMap.set(otherUserId, { userId: otherUserId, lastMessage: m.body, lastMessageAt: m.createdAt.toISOString(), unreadCount: accUnread });
    } else {
      existing.unreadCount = accUnread;
    }
  }
  const userIds = [...convMap.keys()];
  const users = userIds.length ? await db.select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl }).from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const uMap = Object.fromEntries(users.map(u => [u.id, u]));
  const result = [...convMap.values()]
    .map(c => ({ ...c, userName: uMap[c.userId]?.name ?? "User", userAvatar: uMap[c.userId]?.avatarUrl ?? null }))
    .sort((a, b) => (b.unreadCount - a.unreadCount) || (b.lastMessageAt > a.lastMessageAt ? 1 : -1));
  res.json(result);
});

router.patch("/messages/mark-read/:userId", requireAuth, async (req: AuthRequest, res) => {
  const userId = parseInt(String(req.params.userId), 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }
  const isAdmin = ["owner", "manager"].includes(req.userRole!);

  if (isAdmin) {
    // Admin marks all messages from a customer as read.
    // Customer messages may have recipientId = null (sent without a specific addressee),
    // so we match only on senderId to ensure none are missed.
    await db.update(messagesTable)
      .set({ isRead: true })
      .where(and(
        eq(messagesTable.senderId, userId),
        eq(messagesTable.isRead, false),
      ));
  } else {
    // Regular users may only mark messages sent TO them as read.
    await db.update(messagesTable)
      .set({ isRead: true })
      .where(and(
        eq(messagesTable.senderId, userId),
        eq(messagesTable.recipientId, req.userId!),
        eq(messagesTable.isRead, false),
      ));
  }
  res.json({ success: true });
});

// Auto-reply rules (admin only)
router.get("/auto-replies", requireAuth, requireRole("owner", "manager"), async (_req, res) => {
  const rules = await db.select().from(autoReplyRulesTable).orderBy(autoReplyRulesTable.createdAt);
  res.json(rules.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/auto-replies", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  const { keyword, response, isActive = true } = req.body;
  if (!keyword?.trim() || !response?.trim()) {
    res.status(400).json({ error: "keyword and response are required" });
    return;
  }
  const [rule] = await db.insert(autoReplyRulesTable).values({ keyword: keyword.trim(), response: response.trim(), isActive }).returning();
  res.status(201).json({ ...rule, createdAt: rule.createdAt.toISOString() });
});

router.patch("/auto-replies/:id", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(404).json({ error: "Rule not found" }); return; }
  const { keyword, response, isActive } = req.body;
  const update: any = {};
  if (keyword !== undefined) update.keyword = keyword.trim();
  if (response !== undefined) update.response = response.trim();
  if (isActive !== undefined) update.isActive = isActive;
  const [rule] = await db.update(autoReplyRulesTable).set(update).where(eq(autoReplyRulesTable.id, id)).returning();
  if (!rule) { res.status(404).json({ error: "Rule not found" }); return; }
  res.json({ ...rule, createdAt: rule.createdAt.toISOString() });
});

router.delete("/auto-replies/:id", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(autoReplyRulesTable).where(eq(autoReplyRulesTable.id, id));
  res.json({ success: true });
});

router.patch("/messages/:id/read", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  // Only allow the recipient to mark a message as read.
  await db.update(messagesTable)
    .set({ isRead: true })
    .where(and(eq(messagesTable.id, id), eq(messagesTable.recipientId, req.userId!)));
  res.json({ success: true });
});

export default router;
