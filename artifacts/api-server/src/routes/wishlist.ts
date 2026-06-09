import { Router } from "express";
import { db } from "@workspace/db";
import { wishlistsTable, productsTable, categoriesTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/wishlist", requireAuth, async (req: AuthRequest, res) => {
  const items = await db
    .select()
    .from(wishlistsTable)
    .where(eq(wishlistsTable.userId, req.userId!))
    .orderBy(wishlistsTable.createdAt);

  if (items.length === 0) return void res.json([]);

  const productIds = items.map((i) => i.productId);
  const products = await db
    .select()
    .from(productsTable)
    .where(inArray(productsTable.id, productIds));

  const catIds = [...new Set(products.map((p) => p.categoryId))];
  const cats = catIds.length
    ? await db.select().from(categoriesTable).where(inArray(categoriesTable.id, catIds))
    : [];
  const catMap = Object.fromEntries(cats.map((c) => [c.id, c.name]));
  const prodMap = Object.fromEntries(products.map((p) => [p.id, p]));

  const result = items
    .filter((i) => prodMap[i.productId])
    .map((i) => {
      const p = prodMap[i.productId];
      return {
        id: i.id,
        productId: p.id,
        name: p.name,
        price: parseFloat(p.price),
        originalPrice: p.originalPrice ? parseFloat(p.originalPrice) : null,
        thumbnailUrl: p.thumbnailUrl,
        categoryName: catMap[p.categoryId] ?? null,
        stock: p.stock,
        createdAt: i.createdAt.toISOString(),
      };
    });

  res.json(result);
});

router.post("/wishlist/:productId", requireAuth, async (req: AuthRequest, res) => {
  const productId = parseInt(req.params.productId as string);
  if (isNaN(productId)) return void res.status(400).json({ error: "Invalid product id" });

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1);
  if (!product) return void res.status(404).json({ error: "Product not found" });

  // Use onConflictDoNothing so a race-condition double-tap never crashes with a unique-key error.
  // If there's a conflict the insert returns no rows; fall back to fetching the existing row.
  let [item] = await db
    .insert(wishlistsTable)
    .values({ userId: req.userId!, productId })
    .onConflictDoNothing()
    .returning();

  if (!item) {
    [item] = await db
      .select()
      .from(wishlistsTable)
      .where(and(eq(wishlistsTable.userId, req.userId!), eq(wishlistsTable.productId, productId)))
      .limit(1) as any;
  }

  res.json({
    id: item.id,
    productId: product.id,
    name: product.name,
    price: parseFloat(product.price),
    originalPrice: product.originalPrice ? parseFloat(product.originalPrice) : null,
    thumbnailUrl: product.thumbnailUrl,
    stock: product.stock,
    createdAt: item.createdAt.toISOString(),
  });
});

router.delete("/wishlist/:productId", requireAuth, async (req: AuthRequest, res) => {
  const productId = parseInt(req.params.productId as string);
  if (isNaN(productId)) return void res.status(400).json({ error: "Invalid product id" });

  await db
    .delete(wishlistsTable)
    .where(and(eq(wishlistsTable.userId, req.userId!), eq(wishlistsTable.productId, productId)));

  res.json({ ok: true });
});

export default router;
