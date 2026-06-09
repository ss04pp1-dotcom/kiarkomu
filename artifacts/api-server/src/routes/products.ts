import { Router } from "express";
import { db } from "@workspace/db";
import {
  productsTable, categoriesTable, brandsTable,
  productVariantsTable, productReviewsTable, recentlyViewedTable, subProductsTable,
} from "@workspace/db";
import { eq, and, ilike, sql, inArray, gte, lte, asc, desc } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/requireAuth.js";
import { ordersTable, orderItemsTable, appSettingsTable } from "@workspace/db";
import { fireGa4ViewItem } from "../lib/ga4.js";

const router = Router();

// Helper to safely parse numbers and prevent NaN crashes
const safeFloat = (value: any, defaultValue = 0): number => {
  if (value === null || value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Helper to safely format dates
const safeDate = (date: Date | string | null | undefined): string => {
  if (!date) return new Date().toISOString();
  try {
    const d = new Date(date);
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
};

function formatProduct(p: any, catName?: string, brandName?: string | null, avgRating?: number | null, reviewCount?: number) {
  const price = safeFloat(p.price);
  const originalPrice = p.originalPrice ? safeFloat(p.originalPrice) : null;
  
  let discountPercent = null;
  if (originalPrice && price > 0 && originalPrice > price) {
    discountPercent = Math.round((1 - price / originalPrice) * 100);
  }

  return {
    id: p.id,
    name: p.name || "Unnamed Product",
    nameBn: p.nameBn || null,
    slug: p.slug || "",
    price,
    originalPrice,
    discountPercent,
    thumbnailUrl: p.thumbnailUrl || null,
    categoryId: p.categoryId,
    categoryName: catName || "Uncategorized",
    brandId: p.brandId,
    brandName: brandName || null,
    stock: p.stock ?? 0,
    isActive: !!p.isActive,
    isFast: !!p.isFast,
    avgRating: avgRating ? safeFloat(avgRating) : null,
    reviewCount: reviewCount || 0,
    createdAt: safeDate(p.createdAt),
  };
}

router.get("/products", async (req, res) => {
  try {
    const { categoryId, categoryIds, brandId, search, flashSale, page = "1", limit = "20", sortBy, minPrice, maxPrice, inStock } = req.query as any;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, parseInt(limit, 10));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [eq(productsTable.isActive, true)];
    if (categoryIds) {
      const ids = String(categoryIds).split(",").map(Number).filter(n => !isNaN(n) && n > 0);
      if (ids.length > 0) conditions.push(inArray(productsTable.categoryId, ids));
    } else if (categoryId) {
      conditions.push(eq(productsTable.categoryId, parseInt(categoryId, 10)));
    }
    if (brandId) conditions.push(eq(productsTable.brandId, parseInt(brandId, 10)));
    
    if (flashSale === "true") {
      const now = new Date();
      const { flashSalesTable } = await import("@workspace/db");
      const [activeSale] = await db
        .select()
        .from(flashSalesTable)
        .where(and(eq(flashSalesTable.isActive, true), lte(flashSalesTable.startsAt, now), gte(flashSalesTable.endsAt, now)))
        .limit(1);
      const saleProductIds: number[] = activeSale?.productIds ?? [];
      if (!saleProductIds.length) {
        return void res.json({ products: [], total: 0, page: pageNum, totalPages: 0 });
      }
      conditions.push(inArray(productsTable.id, saleProductIds));
    }

    if (search) {
      conditions.push(sql`(
        (
          setweight(to_tsvector('english', coalesce(${productsTable.name}, '')), 'A') ||
          setweight(to_tsvector('english', coalesce((SELECT name FROM categories WHERE id = ${productsTable.categoryId}), '')), 'B') ||
          setweight(to_tsvector('english', coalesce((SELECT name FROM brands WHERE id = ${productsTable.brandId}), '')), 'B') ||
          setweight(to_tsvector('english', coalesce(${productsTable.description}, '')), 'C')
        ) @@ websearch_to_tsquery('english', ${search})
        OR similarity(coalesce(${productsTable.name}, ''), ${search}) > 0.2
        OR similarity(coalesce((SELECT name FROM categories WHERE id = ${productsTable.categoryId}), ''), ${search}) > 0.2
        OR similarity(coalesce((SELECT name FROM brands WHERE id = ${productsTable.brandId}), ''), ${search}) > 0.2
      )`);
    }
    if (minPrice) conditions.push(gte(productsTable.price, minPrice.toString()));
    if (maxPrice) conditions.push(lte(productsTable.price, maxPrice.toString()));
    if (inStock === "true") conditions.push(gte(productsTable.stock, 1));

    const orderClause =
      search ? sql`GREATEST(
        ts_rank(
          setweight(to_tsvector('english', coalesce(${productsTable.name}, '')), 'A') ||
          setweight(to_tsvector('english', coalesce((SELECT name FROM categories WHERE id = ${productsTable.categoryId}), '')), 'B') ||
          setweight(to_tsvector('english', coalesce((SELECT name FROM brands WHERE id = ${productsTable.brandId}), '')), 'B') ||
          setweight(to_tsvector('english', coalesce(${productsTable.description}, '')), 'C'),
          websearch_to_tsquery('english', ${search})
        ),
        similarity(coalesce(${productsTable.name}, ''), ${search})
      ) DESC, ${productsTable.createdAt} DESC` :
      sortBy === "price_asc" ? asc(productsTable.price) :
      sortBy === "price_desc" ? desc(productsTable.price) :
      desc(productsTable.createdAt);

    const where = and(...conditions);
    const [{ total }] = await db.select({ total: sql<number>`cast(count(*) as int)` }).from(productsTable).where(where);
    const products = await db.select().from(productsTable).where(where).limit(limitNum).offset(offset).orderBy(orderClause);
    
    const catIds = [...new Set(products.map(p => p.categoryId))];
    const brandIds = [...new Set(products.map(p => p.brandId).filter(Boolean))] as number[];
    const [cats, brands, reviewStats] = await Promise.all([
      catIds.length ? db.select().from(categoriesTable).where(inArray(categoriesTable.id, catIds)) : [],
      brandIds.length ? db.select().from(brandsTable).where(inArray(brandsTable.id, brandIds)) : [],
      products.length ? db.select({
        productId: productReviewsTable.productId,
        avg: sql<number>`avg(rating)`,
        count: sql<number>`cast(count(*) as int)`,
      }).from(productReviewsTable).where(and(inArray(productReviewsTable.productId, products.map(p => p.id)), eq(productReviewsTable.isApproved, true))).groupBy(productReviewsTable.productId) : []
    ]);

    const catMap = Object.fromEntries(cats.map(c => [c.id, c.name]));
    const brandMap = Object.fromEntries(brands.map(b => [b.id, b.name]));
    const reviewMap = Object.fromEntries(reviewStats.map(r => [r.productId, { avg: r.avg, count: r.count }]));

    res.json({
      products: products.map(p => formatProduct(p, catMap[p.categoryId], p.brandId ? brandMap[p.brandId] : null, reviewMap[p.id]?.avg, reviewMap[p.id]?.count)),
      total, page: pageNum, totalPages: Math.ceil(total / limitNum),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch products: " + err.message });
  }
});

router.post("/products", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  try {
    const { name, nameBn, slug, description, price, originalPrice, categoryId, brandId, stock, isActive, isFast, thumbnailUrl, images, specifications } = req.body;
    if (!name?.trim() || !slug?.trim() || price === undefined || !categoryId) {
      return void res.status(400).json({ error: "name, slug, price, and categoryId are required" });
    }
    const [p] = await db.insert(productsTable).values({ name, nameBn, slug, description, price: String(price), originalPrice: originalPrice ? String(originalPrice) : null, categoryId, brandId, stock, isActive: isActive !== false, isFast: isFast ?? false, thumbnailUrl, images: images ?? [], specifications }).returning();
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, p.categoryId)).limit(1);
    res.status(201).json(formatProduct(p, cat?.name, null, null, 0));
  } catch (err: any) {
    if (err?.code === "23505" && err?.constraint?.includes("slug")) {
      return void res.status(409).json({ error: "A product with this slug already exists. Please use a unique slug." });
    }
    res.status(500).json({ error: "Failed to create product: " + err.message });
  }
});

router.get("/products/recommended", requireAuth, async (req: AuthRequest, res) => {
  try {
    const viewed = await db.select().from(recentlyViewedTable).where(eq(recentlyViewedTable.userId, req.userId!)).orderBy(desc(recentlyViewedTable.viewedAt)).limit(10);
    const productIds = viewed.map(v => v.productId);
    const catIds = productIds.length ? (await db.select({ categoryId: productsTable.categoryId }).from(productsTable).where(inArray(productsTable.id, productIds))).map(p => p.categoryId) : [];
    const products = catIds.length
      ? await db.select().from(productsTable).where(and(eq(productsTable.isActive, true), inArray(productsTable.categoryId, catIds))).limit(10)
      : await db.select().from(productsTable).where(eq(productsTable.isActive, true)).limit(10);
    const cats = await db.select().from(categoriesTable);
    const catMap = Object.fromEntries(cats.map(c => [c.id, c.name]));
    res.json(products.map(p => formatProduct(p, catMap[p.categoryId], null, null, 0)));
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch recommendations: " + err.message });
  }
});

router.get("/products/suggestions", async (req, res) => {
  try {
    const { q } = req.query as any;
    if (!q || String(q).trim().length < 2) {
      return void res.json([]);
    }
    const term = String(q).trim();
    const suggestions = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        slug: productsTable.slug,
        thumbnailUrl: productsTable.thumbnailUrl,
        categoryName: categoriesTable.name,
      })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .where(
        and(
          eq(productsTable.isActive, true),
          sql`(
            ${productsTable.name} ILIKE ${term + "%"} OR
            ${productsTable.name} ILIKE ${"% " + term + "%"} OR
            ${categoriesTable.name} ILIKE ${term + "%"}
          )`
        )
      )
      .orderBy(
        sql`CASE WHEN ${productsTable.name} ILIKE ${term + "%"} THEN 0 ELSE 1 END`,
        productsTable.name
      )
      .limit(10);
    res.json(suggestions);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch suggestions: " + err.message });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return void res.status(400).json({ error: "Invalid product ID" });

    const [p] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
    if (!p) return void res.status(404).json({ error: "Product not found" });

    const [cat, brand, variants, reviews] = await Promise.all([
      db.select().from(categoriesTable).where(eq(categoriesTable.id, p.categoryId)).limit(1),
      p.brandId ? db.select().from(brandsTable).where(eq(brandsTable.id, p.brandId)).limit(1) : Promise.resolve([]),
      db.select().from(productVariantsTable).where(eq(productVariantsTable.productId, id)),
      db.select().from(productReviewsTable).where(and(eq(productReviewsTable.productId, id), eq(productReviewsTable.isApproved, true))),
    ]);

    const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

    res.json({
      ...formatProduct(p, cat[0]?.name, brand[0]?.name, avgRating, reviews.length),
      description: p.description || "",
      specifications: p.specifications || {},
      images: Array.isArray(p.images) ? p.images : [],
      variants: variants.map(v => ({ ...v, priceModifier: safeFloat(v.priceModifier) })),
      reviews: reviews.map(r => ({ ...r, createdAt: safeDate(r.createdAt) })),
    });

    // ── GA4 view_item — fire-and-forget after response is sent ────────────────
    db.select({ googleTagId: appSettingsTable.googleTagId, gaApiSecret: appSettingsTable.gaApiSecret })
      .from(appSettingsTable).limit(1)
      .then(([s]) => {
        if (!s?.googleTagId || !s?.gaApiSecret) return;
        const utmSource = (req.headers["x-utm-source"] as string | undefined) ?? null;
        // @ts-ignore — req may or may not have userId depending on auth middleware
        const userId: number | null = (req as any).userId ?? null;
        fireGa4ViewItem({
          measurementId: s.googleTagId,
          apiSecret: s.gaApiSecret,
          userId,
          productId: p.id,
          productName: p.name,
          price: safeFloat(p.price),
          categoryName: cat[0]?.name ?? null,
          utmSource,
        });
      })
      .catch(() => {});
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch product details: " + err.message });
  }
});

router.patch("/products/:id", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return void res.status(400).json({ error: "Invalid product ID" });

    const body = req.body;
    const update: any = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.nameBn !== undefined) update.nameBn = body.nameBn;
    if (body.description !== undefined) update.description = body.description;
    if (body.price !== undefined) update.price = String(body.price);
    if (body.originalPrice !== undefined) update.originalPrice = body.originalPrice ? String(body.originalPrice) : null;
    if (body.categoryId !== undefined) update.categoryId = body.categoryId;
    if (body.brandId !== undefined) update.brandId = body.brandId;
    if (body.stock !== undefined) update.stock = body.stock;
    if (body.isActive !== undefined) update.isActive = body.isActive;
    if (body.isFast !== undefined) update.isFast = body.isFast;
    if (body.slug !== undefined) update.slug = body.slug;
    if (body.thumbnailUrl !== undefined) update.thumbnailUrl = body.thumbnailUrl;
    if (body.images !== undefined) update.images = body.images;
    if (body.specifications !== undefined) update.specifications = body.specifications;
    update.updatedAt = new Date();
    
    const [p] = await db.update(productsTable).set(update).where(eq(productsTable.id, id)).returning();
    if (!p) return void res.status(404).json({ error: "Product not found" });

    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, p.categoryId)).limit(1);
    res.json(formatProduct(p, cat?.name, null, null, 0));
  } catch (err: any) {
    if (err?.code === "23505" && err?.constraint?.includes("slug")) {
      return void res.status(409).json({ error: "A product with this slug already exists. Please use a unique slug." });
    }
    res.status(500).json({ error: "Failed to update product: " + err.message });
  }
});

router.delete("/products/:id", requireAuth, requireRole("owner"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) return void res.status(400).json({ error: "Invalid product ID" });
    await db.delete(productsTable).where(eq(productsTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete product: " + err.message });
  }
});

router.get("/products/:id/can-review", requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = parseInt(req.params.id as string, 10);
    if (isNaN(productId)) return void res.status(400).json({ error: "Invalid ID" });
    const userId = req.userId!;
    
    const deliveredItems = await db
      .select({ id: orderItemsTable.id })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
      .where(and(eq(ordersTable.userId, userId), eq(ordersTable.status, "delivered"), eq(orderItemsTable.productId, productId)))
      .limit(5);
      
    if (!deliveredItems.length) { return void res.json({ eligible: false, orderItemId: null }); }
    
    const reviewed = await db
      .select({ orderItemId: productReviewsTable.orderItemId })
      .from(productReviewsTable)
      .where(inArray(productReviewsTable.orderItemId, deliveredItems.map(i => i.id)));
      
    const reviewedIds = new Set(reviewed.map(r => r.orderItemId));
    const unreviewed = deliveredItems.find(i => !reviewedIds.has(i.id));
    res.json({ eligible: !!unreviewed, orderItemId: unreviewed?.id ?? null });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to check review eligibility: " + err.message });
  }
});

router.post("/products/:id/reviews", requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = parseInt(req.params.id as string, 10);
    if (isNaN(productId)) return void res.status(400).json({ error: "Invalid ID" });
    const userId = req.userId!;
    const { orderItemId, rating, comment, images } = req.body;
    
    const [item] = await db
      .select({ id: orderItemsTable.id })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
      .where(and(eq(orderItemsTable.id, parseInt(orderItemId, 10)), eq(ordersTable.userId, userId), eq(ordersTable.status, "delivered"), eq(orderItemsTable.productId, productId)))
      .limit(1);
      
    if (!item) { return void res.status(403).json({ error: "Not eligible to review this product" }); }
    
    const existing = await db.select({ id: productReviewsTable.id }).from(productReviewsTable).where(eq(productReviewsTable.orderItemId, parseInt(orderItemId, 10))).limit(1);
    if (existing.length) { return void res.status(409).json({ error: "Already reviewed" }); }
    
    const [review] = await db.insert(productReviewsTable).values({
      productId, userId, orderItemId: parseInt(orderItemId, 10),
      rating: Math.min(5, Math.max(1, parseInt(rating, 10))),
      comment: comment?.trim() || null,
      images: images || [],
      isApproved: false,
    }).returning();
    res.status(201).json(review);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to submit review: " + err.message });
  }
});

router.get("/products/:id/frequently-bought-together", async (req, res) => {
  try {
    const productId = parseInt(req.params.id as string, 10);
    if (isNaN(productId)) return void res.status(400).json({ error: "Invalid ID" });
    const limit = Math.min(8, parseInt((req.query.limit as string) ?? "6", 10));

    const ordersWithProduct = await db
      .selectDistinct({ orderId: orderItemsTable.orderId })
      .from(orderItemsTable)
      .where(eq(orderItemsTable.productId, productId));

    if (!ordersWithProduct.length) {
      const [main] = await db.select({ categoryId: productsTable.categoryId }).from(productsTable).where(eq(productsTable.id, productId)).limit(1);
      if (!main) { return void res.json([]); }
      
      const fallback = await db.select().from(productsTable)
        .where(and(eq(productsTable.categoryId, main.categoryId), eq(productsTable.isActive, true), sql`${productsTable.id} != ${productId}`))
        .orderBy(desc(productsTable.createdAt)).limit(limit);
        
      const cats = await db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable).where(inArray(categoriesTable.id, fallback.map(p => p.categoryId)));
      const catMap = Object.fromEntries(cats.map(c => [c.id, c.name]));
      return void res.json(fallback.map(p => formatProduct(p, catMap[p.categoryId] ?? "", null, null, 0)));
    }

    const orderIds = ordersWithProduct.map(o => o.orderId);
    const coItems = await db
      .select({ productId: orderItemsTable.productId, count: sql<number>`cast(count(*) as int)` })
      .from(orderItemsTable)
      .where(and(inArray(orderItemsTable.orderId, orderIds), sql`${orderItemsTable.productId} != ${productId}`))
      .groupBy(orderItemsTable.productId)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    if (!coItems.length) { return void res.json([]); }

    const productIds = coItems.map(i => i.productId);
    const products = await db.select().from(productsTable)
      .where(and(inArray(productsTable.id, productIds), eq(productsTable.isActive, true)));

    const cats = await db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable)
      .where(inArray(categoriesTable.id, [...new Set(products.map(p => p.categoryId))]));
    const catMap = Object.fromEntries(cats.map(c => [c.id, c.name]));

    const sorted = coItems
      .map(i => products.find(p => p.id === i.productId))
      .filter(Boolean);

    res.json(sorted.map(p => formatProduct(p, catMap[p!.categoryId] ?? "", null, null, 0)));
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch related products: " + err.message });
  }
});

router.post("/products/:id/track-view", requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = parseInt(req.params.id as string, 10);
    if (isNaN(productId)) return void res.status(400).json({ error: "Invalid ID" });
    const userId = req.userId!;
    
    await db.insert(recentlyViewedTable)
      .values({ userId, productId })
      .onConflictDoUpdate({
        target: [recentlyViewedTable.userId, recentlyViewedTable.productId],
        set: { viewedAt: sql`now()` },
      });

    const oldest = await db
      .select({ id: recentlyViewedTable.id })
      .from(recentlyViewedTable)
      .where(eq(recentlyViewedTable.userId, userId))
      .orderBy(desc(recentlyViewedTable.viewedAt))
      .offset(50);
      
    if (oldest.length) {
      await db.delete(recentlyViewedTable).where(inArray(recentlyViewedTable.id, oldest.map(r => r.id)));
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to track view: " + err.message });
  }
});

router.get("/products/:id/variants", async (req, res) => {
  try {
    const productId = parseInt(req.params.id as string, 10);
    if (isNaN(productId)) return void res.status(400).json({ error: "Invalid ID" });
    const variants = await db.select().from(productVariantsTable).where(eq(productVariantsTable.productId, productId));
    res.json(variants.map(v => ({ ...v, priceModifier: safeFloat(v.priceModifier) })));
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch variants: " + err.message });
  }
});

router.put("/products/:id/variants", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  try {
    const productId = parseInt(req.params.id as string, 10);
    if (isNaN(productId)) return void res.status(400).json({ error: "Invalid ID" });
    
    const { variants } = req.body as {
      variants: Array<{
        id?: number; type: string; value: string; priceModifier: number; stock: number; variantData?: Record<string, string>; sku?: string;
      }>;
    };

    if (!Array.isArray(variants)) { return void res.status(400).json({ error: "variants must be an array" }); }

    const incomingIds = variants.filter(v => v.id).map(v => v.id!);
    const existing = await db.select({ id: productVariantsTable.id }).from(productVariantsTable).where(eq(productVariantsTable.productId, productId));
    const toDelete = existing.filter(e => !incomingIds.includes(e.id)).map(e => e.id);
    
    if (toDelete.length) {
      await db.delete(productVariantsTable).where(and(eq(productVariantsTable.productId, productId), inArray(productVariantsTable.id, toDelete)));
    }

    const result = [];
    for (const v of variants) {
      const fields = {
        type: v.type, value: v.value, priceModifier: String(v.priceModifier), stock: v.stock, variantData: v.variantData ?? null, sku: v.sku ?? null,
      };
      if (v.id) {
        const [updated] = await db.update(productVariantsTable).set(fields).where(and(eq(productVariantsTable.id, v.id), eq(productVariantsTable.productId, productId))).returning();
        if (updated) result.push({ ...updated, priceModifier: safeFloat(updated.priceModifier) });
      } else {
        const [inserted] = await db.insert(productVariantsTable).values({ productId, ...fields }).returning();
        result.push({ ...inserted, priceModifier: safeFloat(inserted.priceModifier) });
      }
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update variants: " + err.message });
  }
});

router.get("/products/:id/sub-products", async (req, res) => {
  try {
    const productId = parseInt(req.params.id as string, 10);
    if (isNaN(productId)) return void res.status(400).json({ error: "Invalid product ID" });

    const subs = await db
      .select({
        id: subProductsTable.id,
        subProductId: subProductsTable.subProductId,
        quantity: subProductsTable.quantity,
        sortOrder: subProductsTable.sortOrder,
        name: productsTable.name,
        price: productsTable.price,
        thumbnailUrl: productsTable.thumbnailUrl,
        slug: productsTable.slug,
      })
      .from(subProductsTable)
      .leftJoin(productsTable, eq(productsTable.id, subProductsTable.subProductId))
      .where(eq(subProductsTable.parentProductId, productId))
      .orderBy(asc(subProductsTable.sortOrder));

    res.json(subs.map(s => ({ 
      ...s, 
      name: s.name || "Unknown Product",
      price: safeFloat(s.price),
      slug: s.slug || ""
    })));
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch sub-products: " + err.message });
  }
});

router.put("/products/:id/sub-products", requireAuth, requireRole("owner", "manager"), async (req: AuthRequest, res) => {
  try {
    const productId = parseInt(req.params.id as string, 10);
    if (isNaN(productId)) return void res.status(400).json({ error: "Invalid ID" });
    
    const { subProducts } = req.body as { subProducts: Array<{ subProductId: number; quantity?: number; sortOrder?: number }> };
    await db.delete(subProductsTable).where(eq(subProductsTable.parentProductId, productId));
    
    if (Array.isArray(subProducts) && subProducts.length) {
      await db.insert(subProductsTable).values(
        subProducts.map((s, i) => ({
          parentProductId: productId,
          subProductId: s.subProductId,
          quantity: s.quantity ?? 1,
          sortOrder: s.sortOrder ?? i,
        }))
      );
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update sub-products: " + err.message });
  }
});

router.post("/products/:id/variants", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  try {
    const productId = parseInt(req.params.id as string, 10);
    if (isNaN(productId)) return void res.status(400).json({ error: "Invalid ID" });
    
    const { type, value, priceModifier = 0, stock = 0 } = req.body;
    if (!type || !value) { return void res.status(400).json({ error: "type and value are required" }); }
    
    const [v] = await db.insert(productVariantsTable)
      .values({ productId, type, value, priceModifier: String(priceModifier), stock })
      .returning();
    res.status(201).json({ ...v, priceModifier: safeFloat(v.priceModifier) });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create variant: " + err.message });
  }
});

router.delete("/products/:id/variants/:variantId", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  try {
    const productId = parseInt(req.params.id as string, 10);
    const variantId = parseInt(req.params.variantId as string, 10);
    if (isNaN(productId) || isNaN(variantId)) return void res.status(400).json({ error: "Invalid IDs" });
    
    await db.delete(productVariantsTable).where(and(eq(productVariantsTable.id, variantId), eq(productVariantsTable.productId, productId)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete variant: " + err.message });
  }
});

export default router;