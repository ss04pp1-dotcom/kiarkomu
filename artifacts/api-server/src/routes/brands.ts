import { Router } from "express";
import { db } from "@workspace/db";
import { brandsTable, productsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/brands", async (_req, res) => {
  const brands = await db.select().from(brandsTable).orderBy(brandsTable.name);
  const counts = await db.select({
    brandId: productsTable.brandId,
    count: sql<number>`cast(count(*) as int)`,
  }).from(productsTable).where(eq(productsTable.isActive, true)).groupBy(productsTable.brandId);
  const countMap = Object.fromEntries(counts.filter(c => c.brandId).map(c => [c.brandId!, c.count]));
  res.json(brands.map(b => ({ ...b, productCount: countMap[b.id] ?? 0 })));
});

router.post("/brands", requireAuth, requireRole("owner"), async (req, res) => {
  const [brand] = await db.insert(brandsTable).values({ name: req.body.name, logoUrl: req.body.logoUrl }).returning();
  res.status(201).json({ ...brand, productCount: 0 });
});

router.patch("/brands/:id", requireAuth, requireRole("owner"), async (req, res) => {
  const brandId = parseInt(req.params.id as string, 10);
  if (isNaN(brandId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [brand] = await db.update(brandsTable)
    .set({ ...(req.body.name && { name: req.body.name }), ...(req.body.logoUrl !== undefined && { logoUrl: req.body.logoUrl }) })
    .where(eq(brandsTable.id, brandId)).returning();
  res.json({ ...brand, productCount: 0 });
});

router.delete("/brands/:id", requireAuth, requireRole("owner"), async (req, res) => {
  const brandDelId = parseInt(req.params.id as string, 10);
  if (isNaN(brandDelId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(brandsTable).where(eq(brandsTable.id, brandDelId));
  res.json({ success: true });
});

export default router;
