import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable, productsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/categories", async (_req, res) => {
  const cats = await db.select().from(categoriesTable).orderBy(categoriesTable.position);
  const counts = await db.select({
    categoryId: productsTable.categoryId,
    count: sql<number>`cast(count(*) as int)`,
  }).from(productsTable).where(eq(productsTable.isActive, true)).groupBy(productsTable.categoryId);
  const countMap = Object.fromEntries(counts.map(c => [c.categoryId, c.count]));
  res.json(cats.map(c => ({ ...c, productCount: countMap[c.id] ?? 0 })));
});

router.post("/categories", requireAuth, requireRole("owner"), async (req, res) => {
  const { name, nameBn, slug, imageUrl, parentId } = req.body;
  const [cat] = await db.insert(categoriesTable).values({
    name,
    nameBn,
    slug,
    imageUrl,
    parentId: parentId ? Number(parentId) : null,
  }).returning();
  res.status(201).json({ ...cat, productCount: 0 });
});

router.get("/categories/:id", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id)).limit(1);
  if (!cat) { res.status(404).json({ error: "Not found" }); return; }
  const [{ count }] = await db.select({ count: sql<number>`cast(count(*) as int)` })
    .from(productsTable).where(eq(productsTable.categoryId, id));
  const children = await db.select().from(categoriesTable).where(eq(categoriesTable.parentId, id));
  res.json({ ...cat, productCount: count, children });
});

router.patch("/categories/:id", requireAuth, requireRole("owner"), async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { name, nameBn, slug, imageUrl, parentId } = req.body;
  const [cat] = await db.update(categoriesTable)
    .set({
      ...(name && { name }),
      ...(nameBn !== undefined && { nameBn }),
      ...(slug && { slug }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(parentId !== undefined && { parentId: parentId === null ? null : Number(parentId) }),
    })
    .where(eq(categoriesTable.id, id)).returning();
  res.json({ ...cat, productCount: 0 });
});

router.delete("/categories/:id", requireAuth, requireRole("owner"), async (req, res) => {
  const catDelId = parseInt(req.params.id as string, 10);
  if (isNaN(catDelId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(categoriesTable).where(eq(categoriesTable.id, catDelId));
  res.json({ success: true });
});

export default router;
