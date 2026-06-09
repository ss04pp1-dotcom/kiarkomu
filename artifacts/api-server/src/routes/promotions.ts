import { Router } from "express";
import { db } from "@workspace/db";
import { couponsTable, bannersTable, flashSalesTable } from "@workspace/db";
import { eq, and, lte, gte, isNull } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";
import { adminAuth } from "../middlewares/adminAuth.js";
import { extractDominantColor } from "../lib/extract-color.js";

const router = Router();

// Coupons
router.get("/coupons", requireAuth, requireRole("owner", "manager"), async (_req, res) => {
  const coupons = await db.select().from(couponsTable).orderBy(couponsTable.createdAt);
  res.json(coupons.map(c => ({ ...c, value: parseFloat(c.value), minOrderAmount: c.minOrderAmount ? parseFloat(c.minOrderAmount) : null, expiresAt: c.expiresAt?.toISOString() ?? null })));
});

router.post("/coupons", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  const { code, type, value, minOrderAmount, maxUses, isActive, expiresAt } = req.body;
  if (!code || !type || value === undefined) {
    res.status(400).json({ error: "code, type, and value are required" });
    return;
  }
  let expiresAtDate: Date | null = null;
  if (expiresAt) {
    expiresAtDate = new Date(expiresAt);
    if (isNaN(expiresAtDate.getTime())) {
      res.status(400).json({ error: "Invalid expiresAt date format" });
      return;
    }
  }
  const [c] = await db.insert(couponsTable).values({ code, type, value: value.toString(), minOrderAmount: minOrderAmount?.toString(), maxUses, isActive: isActive !== false, expiresAt: expiresAtDate }).returning();
  res.status(201).json({ ...c, value: parseFloat(c.value), minOrderAmount: c.minOrderAmount ? parseFloat(c.minOrderAmount) : null, expiresAt: c.expiresAt?.toISOString() ?? null });
});

router.patch("/coupons/:id", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  const couponId = parseInt(req.params.id as string, 10);
  if (isNaN(couponId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const body = req.body;
  const update: any = {};
  if (body.code !== undefined) update.code = body.code;
  if (body.type !== undefined) update.type = body.type;
  if (body.value !== undefined) update.value = body.value.toString();
  if (body.isActive !== undefined) update.isActive = body.isActive;
  if (body.expiresAt !== undefined) update.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  const [c] = await db.update(couponsTable).set(update).where(eq(couponsTable.id, couponId)).returning();
  res.json({ ...c, value: parseFloat(c.value), minOrderAmount: c.minOrderAmount ? parseFloat(c.minOrderAmount) : null, expiresAt: c.expiresAt?.toISOString() ?? null });
});

router.delete("/coupons/:id", requireAuth, requireRole("owner"), async (req, res) => {
  const couponDelId = parseInt(req.params.id as string, 10);
  if (isNaN(couponDelId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(couponsTable).where(eq(couponsTable.id, couponDelId));
  res.json({ success: true });
});

router.post("/coupons/validate",requireAuth, async (req, res) => {
  const { code, orderAmount } = req.body;
  const [coupon] = await db.select().from(couponsTable).where(and(eq(couponsTable.code, code), eq(couponsTable.isActive, true))).limit(1);
  if (!coupon) { res.json({ valid: false, discount: 0, message: "Invalid coupon code" }); return; }
  if (coupon.expiresAt && coupon.expiresAt < new Date()) { res.json({ valid: false, discount: 0, message: "Coupon expired" }); return; }
  if (coupon.minOrderAmount && orderAmount < parseFloat(coupon.minOrderAmount)) { res.json({ valid: false, discount: 0, message: `Minimum order ৳${coupon.minOrderAmount}` }); return; }
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) { res.json({ valid: false, discount: 0, message: "Coupon fully used" }); return; }
  const discount = coupon.type === "percent" ? orderAmount * parseFloat(coupon.value) / 100 : parseFloat(coupon.value);
  res.json({ valid: true, discount, message: `Saved ৳${discount.toFixed(2)}` });
});

// Banners
router.get("/banners", async (_req, res) => {
  const banners = await db.select().from(bannersTable).where(eq(bannersTable.isActive, true)).orderBy(bannersTable.position);
  res.json(banners);
});

router.post("/banners", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  const { imageUrl, title, subtitle, linkUrl, position, isActive, themeColor, dominantColor: bodyColor } = req.body;
  
  // Use color from request if provided, otherwise extract it from image
  let finalColor = bodyColor || themeColor;
  if (!finalColor && imageUrl) {
    finalColor = await extractDominantColor(imageUrl);
  }

  const [b] = await db.insert(bannersTable).values({ 
    imageUrl, 
    title, 
    subtitle, 
    linkUrl, 
    position: position ?? 0, 
    isActive: isActive !== false, 
    dominantColor: finalColor 
  }).returning();
  
  res.status(201).json(b);
});

router.patch("/banners/:id", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  const bannerId = parseInt(req.params.id as string, 10);
  if (isNaN(bannerId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bBody = req.body;
  const bUpdate: any = {};
  
  if (bBody.imageUrl !== undefined) bUpdate.imageUrl = bBody.imageUrl;
  
  // Prioritize provided color, only auto-extract if image changed and no color was provided
  if (bBody.dominantColor !== undefined || bBody.themeColor !== undefined) {
    bUpdate.dominantColor = bBody.dominantColor || bBody.themeColor;
  } else if (bBody.imageUrl !== undefined) {
    bUpdate.dominantColor = await extractDominantColor(bBody.imageUrl);
  }

  if (bBody.title !== undefined) bUpdate.title = bBody.title;
  if (bBody.subtitle !== undefined) bUpdate.subtitle = bBody.subtitle;
  if (bBody.linkUrl !== undefined) bUpdate.linkUrl = bBody.linkUrl;
  if (bBody.position !== undefined) bUpdate.position = bBody.position;
  if (bBody.isActive !== undefined) bUpdate.isActive = bBody.isActive;
  
  const [b] = await db.update(bannersTable).set(bUpdate).where(eq(bannersTable.id, bannerId)).returning();
  res.json(b);
});

router.delete("/banners/:id", requireAuth, requireRole("owner"), async (req, res) => {
  const bannerDelId = parseInt(req.params.id as string, 10);
  if (isNaN(bannerDelId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(bannersTable).where(eq(bannersTable.id, bannerDelId));
  res.json({ success: true });
});

router.post("/banners/backfill-colors", adminAuth, async (req, res) => {
  const banners = await db.select().from(bannersTable).where(isNull(bannersTable.dominantColor));
  const results: { id: number; color: string | null }[] = [];
  for (const banner of banners) {
    const color = await extractDominantColor(banner.imageUrl);
    if (color) {
      await db.update(bannersTable).set({ dominantColor: color }).where(eq(bannersTable.id, banner.id));
    }
    results.push({ id: banner.id, color });
  }
  res.json({ updated: results.length, results });
});

// Flash Sales
router.get("/flash-sales", async (_req, res) => {
  const sales = await db.select().from(flashSalesTable).orderBy(flashSalesTable.startsAt);
  res.json(sales.map(s => ({ ...s, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() })));
});

router.post("/flash-sales", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  const { title, startsAt, endsAt, isActive, productIds } = req.body;
  const [s] = await db.insert(flashSalesTable).values({ title, startsAt: new Date(startsAt), endsAt: new Date(endsAt), isActive: isActive ?? false, productIds: productIds ?? [] }).returning();
  res.status(201).json({ ...s, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() });
});

router.get("/flash-sales/active", async (_req, res) => {
  const now = new Date();
  const [sale] = await db.select().from(flashSalesTable).where(and(eq(flashSalesTable.isActive, true), lte(flashSalesTable.startsAt, now), gte(flashSalesTable.endsAt, now))).limit(1);
  if (!sale) { res.json(null); return; }
  const { productsTable, categoriesTable } = await import("@workspace/db");
  const { inArray, eq: drizzleEq, and: drizzleAnd } = await import("drizzle-orm");
  const products = sale.productIds?.length
    ? await db.select().from(productsTable).where(drizzleAnd(inArray(productsTable.id, sale.productIds), drizzleEq(productsTable.isActive, true)))
    : [];
  const cats = await db.select().from(categoriesTable);
  const catMap = Object.fromEntries(cats.map((c: any) => [c.id, c.name]));
  res.json({ ...sale, startsAt: sale.startsAt.toISOString(), endsAt: sale.endsAt.toISOString(), products: products.map((p: any) => ({ id: p.id, name: p.name, slug: p.slug, price: parseFloat(p.price), originalPrice: p.originalPrice ? parseFloat(p.originalPrice) : null, discountPercent: null, thumbnailUrl: p.thumbnailUrl, categoryId: p.categoryId, categoryName: catMap[p.categoryId] ?? "", stock: p.stock, isActive: p.isActive, isFast: p.isFast, avgRating: null, reviewCount: 0, createdAt: p.createdAt.toISOString() })) });
});

router.patch("/flash-sales/:id", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  const flashSaleId = parseInt(req.params.id as string, 10);
  if (isNaN(flashSaleId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const body = req.body;
  const update: any = {};
  if (body.title !== undefined) update.title = body.title;
  if (body.isActive !== undefined) update.isActive = body.isActive;
  if (body.productIds !== undefined) update.productIds = body.productIds;
  if (body.startsAt !== undefined) update.startsAt = new Date(body.startsAt);
  if (body.endsAt !== undefined) update.endsAt = new Date(body.endsAt);
  const [s] = await db.update(flashSalesTable).set(update).where(eq(flashSalesTable.id, flashSaleId)).returning();
  res.json({ ...s, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() });
});

router.delete("/flash-sales/:id", requireAuth, requireRole("owner"), async (req, res) => {
  const flashSaleDelId = parseInt(req.params.id as string, 10);
  if (isNaN(flashSaleDelId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(flashSalesTable).where(eq(flashSalesTable.id, flashSaleDelId));
  res.json({ success: true });
});

export default router;