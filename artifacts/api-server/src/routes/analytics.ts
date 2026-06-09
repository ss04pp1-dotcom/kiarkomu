import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, usersTable, productsTable, orderItemsTable, trackingEventsTable } from "@workspace/db";
import { eq, sql, and, gte, inArray, lte, isNotNull } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/analytics/summary", requireAuth, requireRole("owner", "manager"), async (_req, res) => {
  const [rev] = await db.select({ total: sql<number>`coalesce(sum(total::numeric), 0)` }).from(ordersTable).where(eq(ordersTable.paymentStatus, "paid"));
  const [orders] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(ordersTable);
  const [customers] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(usersTable).where(eq(usersTable.role, "customer"));
  const [products] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(productsTable).where(eq(productsTable.isActive, true));
  const [pending] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(ordersTable).where(eq(ordersTable.status, "pending"));
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const [todayRev] = await db.select({ total: sql<number>`coalesce(sum(total::numeric), 0)` }).from(ordersTable).where(and(eq(ordersTable.paymentStatus, "paid"), gte(ordersTable.createdAt, today)));
  const [todayOrders] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(ordersTable).where(gte(ordersTable.createdAt, today));
  const avgOrderValue = orders.count > 0 ? (rev.total ?? 0) / orders.count : 0;
  res.json({
    totalRevenue: rev.total ?? 0, totalOrders: orders.count, totalCustomers: customers.count,
    totalProducts: products.count, pendingOrders: pending.count, averageOrderValue: avgOrderValue,
    revenueToday: todayRev.total ?? 0, ordersToday: todayOrders.count,
  });
});

router.get("/analytics/sales-over-time", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  const { period = "daily" } = req.query as any;
  const groupBy = period === "monthly" ? sql`date_trunc('month', created_at)` : period === "weekly" ? sql`date_trunc('week', created_at)` : sql`date_trunc('day', created_at)`;
  const data = await db.select({ date: groupBy, revenue: sql<number>`coalesce(sum(total::numeric), 0)`, orders: sql<number>`cast(count(*) as int)` }).from(ordersTable).groupBy(groupBy).orderBy(groupBy).limit(30);
  res.json(data.map((d: any) => ({ date: new Date(d.date).toISOString().split("T")[0], revenue: d.revenue, orders: d.orders })));
});

router.get("/analytics/top-products", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  const limit = safeLimit(req.query.limit);
  const data = await db.select({ productId: orderItemsTable.productId, productName: orderItemsTable.productName, thumbnailUrl: orderItemsTable.thumbnailUrl, totalSold: sql<number>`cast(sum(quantity) as int)`, revenue: sql<number>`sum(price::numeric * quantity)` }).from(orderItemsTable).groupBy(orderItemsTable.productId, orderItemsTable.productName, orderItemsTable.thumbnailUrl).orderBy(sql`sum(quantity) desc`).limit(limit);
  res.json(data);
});

router.get("/analytics/top-categories", requireAuth, requireRole("owner", "manager"), async (_req, res) => {
  const { categoriesTable } = await import("@workspace/db");
  const data = await db.select({ categoryId: productsTable.categoryId, totalOrders: sql<number>`cast(count(distinct ${orderItemsTable.orderId}) as int)`, revenue: sql<number>`coalesce(sum(${orderItemsTable.price}::numeric * ${orderItemsTable.quantity}), 0)` }).from(orderItemsTable).leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id)).groupBy(productsTable.categoryId).orderBy(sql`sum(${orderItemsTable.price}::numeric * ${orderItemsTable.quantity}) desc`);
  const cats = await db.select().from(categoriesTable);
  const catMap = Object.fromEntries(cats.map(c => [c.id, c.name]));
  res.json(data.map(d => ({ categoryId: d.categoryId, categoryName: catMap[d.categoryId!] ?? "Unknown", totalOrders: d.totalOrders, revenue: d.revenue })));
});


// ── Feature 7: Advanced Analytics ──

// Conversion Rate: (total orders / total product views)
router.get("/analytics/conversion-rate", requireAuth, requireRole("owner", "manager"), async (_req, res) => {
  const { recentlyViewedTable } = await import("@workspace/db");
  const [orderCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(ordersTable);
  const [viewCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(recentlyViewedTable);
  const rate = viewCount.count > 0 ? (orderCount.count / viewCount.count) * 100 : 0;
  res.json({
    totalOrders: orderCount.count,
    totalViews: viewCount.count,
    conversionRate: parseFloat(rate.toFixed(2)),
  });
});

// Most Viewed Products with low sales (high views, low purchases)
router.get("/analytics/high-view-low-sale", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  const { recentlyViewedTable } = await import("@workspace/db");
  const limit = safeLimit(req.query.limit);

  const viewData = await db
    .select({
      productId: recentlyViewedTable.productId,
      viewCount: sql<number>`cast(count(*) as int)`,
    })
    .from(recentlyViewedTable)
    .groupBy(recentlyViewedTable.productId)
    .orderBy(sql`count(*) desc`)
    .limit(limit * 2); // fetch extra so we can sort by view:sale ratio

  if (!viewData.length) { res.json([]); return; }

  const productIds = viewData.map(v => v.productId);
  const salesData = await db
    .select({
      productId: orderItemsTable.productId,
      totalSold: sql<number>`cast(sum(quantity) as int)`,
    })
    .from(orderItemsTable)
    .where(inArray(orderItemsTable.productId, productIds))
    .groupBy(orderItemsTable.productId);

  const salesMap = Object.fromEntries(salesData.map(s => [s.productId, s.totalSold]));

  const products = await db
    .select({ id: productsTable.id, name: productsTable.name, thumbnailUrl: productsTable.thumbnailUrl, price: productsTable.price })
    .from(productsTable)
    .where(inArray(productsTable.id, productIds));
  const productMap = Object.fromEntries(products.map(p => [p.id, p]));

  const result = viewData
    .map(v => ({
      productId: v.productId,
      name: productMap[v.productId]?.name ?? "Unknown",
      thumbnailUrl: productMap[v.productId]?.thumbnailUrl ?? null,
      price: productMap[v.productId]?.price ? parseFloat(productMap[v.productId]!.price) : 0,
      viewCount: v.viewCount,
      totalSold: salesMap[v.productId] ?? 0,
      viewToSaleRatio: v.viewCount / Math.max(1, salesMap[v.productId] ?? 0),
    }))
    .sort((a, b) => b.viewToSaleRatio - a.viewToSaleRatio)
    .slice(0, limit);

  res.json(result);
});

// Top customers by total spend on paid orders
router.get("/analytics/top-customers", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  const limit = safeLimit(req.query.limit);

  const data = await db
    .select({
      userId: ordersTable.userId,
      totalSpend: sql<number>`cast(sum(total::numeric) as float)`,
      orderCount: sql<number>`cast(count(*) as int)`,
    })
    .from(ordersTable)
    .where(eq(ordersTable.paymentStatus, "paid"))
    .groupBy(ordersTable.userId)
    .orderBy(sql`sum(total::numeric) desc`)
    .limit(limit);

  if (!data.length) { res.json([]); return; }

  const userIds = data.map(d => d.userId);
  const users = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(inArray(usersTable.id, userIds));
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  res.json(data.map((d, i) => ({
    rank: i + 1,
    userId: d.userId,
    name: userMap[d.userId]?.name ?? "Unknown",
    email: userMap[d.userId]?.email ?? "",
    avatarUrl: userMap[d.userId]?.avatarUrl ?? null,
    totalSpend: parseFloat(d.totalSpend.toFixed(2)),
    orderCount: d.orderCount,
  })));
});

// ── Internal event tracking (no auth — called from web storefront) ──
router.post("/analytics/track", (req, res) => {
  const { eventType, productId, productName, value, sessionId,
          utmSource, utmMedium, utmCampaign, utmContent, utmTerm } = req.body;

  // Bug fix #1: validate inputs synchronously, before any async work
  const validTypes = ["view_content", "add_to_cart", "initiate_checkout", "purchase"];
  if (!eventType || !validTypes.includes(eventType)) {
    res.status(400).json({ error: "Invalid event type" });
    return;
  }

  // Task 2 — strict numeric sanitization: accepts only finite numbers in a
  // reasonable monetary range. Rejects strings like "abc", "Infinity",
  // NaN, negative values, and anything above 10 million to prevent DB
  // numeric cast failures or wildly inflated revenue figures.
  const safeValue = safeNumericValue(value);

  // Bug fix #5: discard SSR-generated session IDs — only real browser sessions matter
  const safeSessionId = (sessionId && sessionId !== "ssr") ? String(sessionId).slice(0, 64) : null;

  // Bug fix #1 (main): respond immediately — DB write is fire-and-forget
  // The storefront does not need to wait for the insert to complete.
  res.json({ ok: true });

  db.insert(trackingEventsTable).values({
    eventType,
    productId: productId ? String(productId).slice(0, 64) : null,
    productName: productName ? String(productName).slice(0, 256) : null,
    value: safeValue,
    sessionId: safeSessionId,
    utmSource:   utmSource   ? String(utmSource).slice(0, 128)   : null,
    utmMedium:   utmMedium   ? String(utmMedium).slice(0, 128)   : null,
    utmCampaign: utmCampaign ? String(utmCampaign).slice(0, 256) : null,
    utmContent:  utmContent  ? String(utmContent).slice(0, 256)  : null,
    utmTerm:     utmTerm     ? String(utmTerm).slice(0, 256)     : null,
  }).catch(() => {
    // Silently swallow — a failed tracking write must never affect the storefront
  });
});

// ── Safe days parser — Bug fix #2: NaN from parseInt crashes setDate ──
function safeDays(raw: any, defaultDays = 30, max = 365): number {
  const n = parseInt(String(raw), 10);
  if (isNaN(n) || n < 1) return defaultDays;
  return Math.min(n, max);
}

// ── Safe limit parser — Bug fix #3: NaN from parseInt crashes .limit() ──
function safeLimit(raw: any, defaultLimit = 10, max = 100): number {
  const n = parseInt(String(raw), 10);
  if (isNaN(n) || n < 1) return defaultLimit;
  return Math.min(n, max);
}

// ── Task 2: Strict numeric value sanitizer ───────────────────────────────────
// Accepts only finite, non-negative numbers up to 10 000 000 (BDT cap).
// Returns a fixed-decimal string ready for the numeric DB column, or null.
function safeNumericValue(raw: any): string | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return null;
  return n.toFixed(2);
}

// ── Task 4: Date range parser — supports ?days=N or ?startDate=&endDate= ────
// When startDate + endDate are both valid ISO date strings and startDate ≤ endDate,
// use them directly. Otherwise fall back to the rolling-N-days window.
function parseDateRange(query: any): { since: Date; until: Date } {
  const { startDate, endDate } = query;
  if (startDate && endDate) {
    // Append time so dates are treated as local midnight / end-of-day
    const since = new Date(`${startDate}T00:00:00`);
    const until = new Date(`${endDate}T23:59:59.999`);
    if (!isNaN(since.getTime()) && !isNaN(until.getTime()) && since <= until) {
      return { since, until };
    }
  }
  const numDays = safeDays(query.days);
  const since = new Date();
  since.setDate(since.getDate() - numDays);
  return { since, until: new Date() };
}

// Helper: build a platform filter clause from ?platform=mobile|web query param.
// mobile → utm_source = 'mobile_app'
// web    → utm_source IS NULL OR utm_source != 'mobile_app'
// all / missing → null (no filter added)
function platformFilter(platform: unknown) {
  if (platform === "mobile") return sql`utm_source = 'mobile_app'`;
  if (platform === "web")    return sql`(utm_source IS NULL OR utm_source != 'mobile_app')`;
  return undefined;
}

// ── Tracking funnel summary (admin only) ──
router.get("/analytics/tracking-funnel", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  const { since, until } = parseDateRange(req.query);
  const platFilter = platformFilter(req.query.platform);
  const dateFilter = and(
    gte(trackingEventsTable.createdAt, since),
    lte(trackingEventsTable.createdAt, until),
    platFilter,
  );

  const counts = await db
    .select({
      eventType: trackingEventsTable.eventType,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(trackingEventsTable)
    .where(dateFilter)
    .groupBy(trackingEventsTable.eventType);

  const countMap: Record<string, number> = {};
  for (const row of counts) countMap[row.eventType] = row.count;

  // Top products by add_to_cart events
  const topAdded = await db
    .select({
      productId: trackingEventsTable.productId,
      productName: trackingEventsTable.productName,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(trackingEventsTable)
    .where(and(eq(trackingEventsTable.eventType, "add_to_cart"), dateFilter))
    .groupBy(trackingEventsTable.productId, trackingEventsTable.productName)
    .orderBy(sql`count(*) desc`)
    .limit(8);

  // Top products by view_content events
  const topViewed = await db
    .select({
      productId: trackingEventsTable.productId,
      productName: trackingEventsTable.productName,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(trackingEventsTable)
    .where(and(eq(trackingEventsTable.eventType, "view_content"), dateFilter))
    .groupBy(trackingEventsTable.productId, trackingEventsTable.productName)
    .orderBy(sql`count(*) desc`)
    .limit(8);

  const views = countMap["view_content"] ?? 0;
  const addToCart = countMap["add_to_cart"] ?? 0;
  const checkout = countMap["initiate_checkout"] ?? 0;
  const purchase = countMap["purchase"] ?? 0;

  res.json({
    funnel: [
      { step: "View Product", event: "view_content", count: views, pct: 100 },
      { step: "Add to Cart", event: "add_to_cart", count: addToCart, pct: views > 0 ? parseFloat(((addToCart / views) * 100).toFixed(1)) : 0 },
      { step: "Checkout", event: "initiate_checkout", count: checkout, pct: views > 0 ? parseFloat(((checkout / views) * 100).toFixed(1)) : 0 },
      { step: "Purchase", event: "purchase", count: purchase, pct: views > 0 ? parseFloat(((purchase / views) * 100).toFixed(1)) : 0 },
    ],
    topAdded,
    topViewed,
    totalEvents: views + addToCart + checkout + purchase,
  });
});

// ── Traffic sources breakdown (admin only) ──
router.get("/analytics/traffic-sources", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  const { since, until } = parseDateRange(req.query);
  const dateFilter = and(gte(trackingEventsTable.createdAt, since), lte(trackingEventsTable.createdAt, until));

  const bySource = await db
    .select({
      utmSource: trackingEventsTable.utmSource,
      sessions: sql<number>`cast(count(distinct session_id) as int)`,
      purchases: sql<number>`cast(sum(case when event_type = 'purchase' then 1 else 0 end) as int)`,
      revenue: sql<number>`coalesce(sum(case when event_type = 'purchase' then value::numeric else 0 end), 0)`,
    })
    .from(trackingEventsTable)
    .where(dateFilter)
    .groupBy(trackingEventsTable.utmSource)
    .orderBy(sql`count(distinct session_id) desc`)
    .limit(20);

  const byMedium = await db
    .select({
      utmMedium: trackingEventsTable.utmMedium,
      sessions: sql<number>`cast(count(distinct session_id) as int)`,
      purchases: sql<number>`cast(sum(case when event_type = 'purchase' then 1 else 0 end) as int)`,
      revenue: sql<number>`coalesce(sum(case when event_type = 'purchase' then value::numeric else 0 end), 0)`,
    })
    .from(trackingEventsTable)
    .where(dateFilter)
    .groupBy(trackingEventsTable.utmMedium)
    .orderBy(sql`count(distinct session_id) desc`)
    .limit(20);

  const byCampaign = await db
    .select({
      utmSource: trackingEventsTable.utmSource,
      utmMedium: trackingEventsTable.utmMedium,
      utmCampaign: trackingEventsTable.utmCampaign,
      sessions: sql<number>`cast(count(distinct session_id) as int)`,
      purchases: sql<number>`cast(sum(case when event_type = 'purchase' then 1 else 0 end) as int)`,
      revenue: sql<number>`coalesce(sum(case when event_type = 'purchase' then value::numeric else 0 end), 0)`,
    })
    .from(trackingEventsTable)
    .where(and(dateFilter, sql`utm_campaign is not null`))
    .groupBy(trackingEventsTable.utmSource, trackingEventsTable.utmMedium, trackingEventsTable.utmCampaign)
    .orderBy(sql`count(distinct session_id) desc`)
    .limit(20);

  res.json({
    bySource: bySource.map(r => ({
      source: r.utmSource ?? "(direct)",
      sessions: r.sessions,
      purchases: r.purchases,
      revenue: parseFloat(Number(r.revenue).toFixed(2)),
      conversionRate: r.sessions > 0 ? parseFloat(((r.purchases / r.sessions) * 100).toFixed(1)) : 0,
    })),
    byMedium: byMedium.map(r => ({
      medium: r.utmMedium ?? "(none)",
      sessions: r.sessions,
      purchases: r.purchases,
      revenue: parseFloat(Number(r.revenue).toFixed(2)),
      conversionRate: r.sessions > 0 ? parseFloat(((r.purchases / r.sessions) * 100).toFixed(1)) : 0,
    })),
    byCampaign: byCampaign.map(r => ({
      campaign: r.utmCampaign ?? "(not set)",
      source: r.utmSource ?? "(direct)",
      medium: r.utmMedium ?? "(none)",
      sessions: r.sessions,
      purchases: r.purchases,
      revenue: parseFloat(Number(r.revenue).toFixed(2)),
      conversionRate: r.sessions > 0 ? parseFloat(((r.purchases / r.sessions) * 100).toFixed(1)) : 0,
    })),
  });
});

// ── Event counts per day over time (admin only) ──
router.get("/analytics/tracking-timeline", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  const { since, until } = parseDateRange(req.query);
  const platFilter = platformFilter(req.query.platform);

  // Timezone: date_trunc after converting to Asia/Dhaka ensures day boundaries
  // match the local business day (UTC+6), not the DB server's UTC clock.
  const rows = await db
    .select({
      date: sql<string>`date_trunc('day', created_at AT TIME ZONE 'Asia/Dhaka')::date`,
      eventType: trackingEventsTable.eventType,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(trackingEventsTable)
    .where(and(gte(trackingEventsTable.createdAt, since), lte(trackingEventsTable.createdAt, until), platFilter))
    .groupBy(sql`date_trunc('day', created_at AT TIME ZONE 'Asia/Dhaka')::date`, trackingEventsTable.eventType)
    .orderBy(sql`date_trunc('day', created_at AT TIME ZONE 'Asia/Dhaka')::date`);

  // Group into { date, view_content, add_to_cart, initiate_checkout, purchase }
  const byDate: Record<string, any> = {};
  for (const row of rows) {
    const d = String(row.date).slice(0, 10);
    if (!byDate[d]) byDate[d] = { date: d, view_content: 0, add_to_cart: 0, initiate_checkout: 0, purchase: 0 };
    if (row.eventType in byDate[d]) byDate[d][row.eventType] = row.count;
  }

  res.json(Object.values(byDate));
});

// ── Active sessions in the last N minutes (admin only) ──
// Used by the admin dashboard "Live Visitors" widget.
// Returns total active sessions plus a platform breakdown (web vs mobile)
// using the utm_source tag set by each client.
router.get("/analytics/active-sessions", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  // Default window: 30 min. Accept up to 24 hours.
  const minutes = safeDays(req.query.minutes, 30, 1440);
  const since = new Date(Date.now() - minutes * 60 * 1000);
  const baseFilter = and(gte(trackingEventsTable.createdAt, since), isNotNull(trackingEventsTable.sessionId));

  const [result] = await db
    .select({
      uniqueSessions: sql<number>`cast(count(distinct session_id) as int)`,
      totalEvents:    sql<number>`cast(count(*) as int)`,
    })
    .from(trackingEventsTable)
    .where(baseFilter);

  // Mobile sessions are tagged utm_source = 'mobile_app' by the Expo tracking lib.
  const [mobileResult] = await db
    .select({
      uniqueSessions: sql<number>`cast(count(distinct session_id) as int)`,
    })
    .from(trackingEventsTable)
    .where(and(baseFilter, sql`utm_source = 'mobile_app'`));

  // Web sessions: all sessions that are NOT mobile_app
  const [webResult] = await db
    .select({
      uniqueSessions: sql<number>`cast(count(distinct session_id) as int)`,
    })
    .from(trackingEventsTable)
    .where(and(baseFilter, sql`(utm_source IS NULL OR utm_source != 'mobile_app')`));

  res.json({
    activeSessions:        result?.uniqueSessions ?? 0,
    totalEvents:           result?.totalEvents ?? 0,
    windowMinutes:         minutes,
    mobileSessions:        mobileResult?.uniqueSessions ?? 0,
    webSessions:           webResult?.uniqueSessions ?? 0,
  });
});

export default router;
