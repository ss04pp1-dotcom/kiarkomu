import { Router } from "express";
import { db } from "@workspace/db";
import { productReviewsTable, usersTable, productsTable } from "@workspace/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/requireAuth.js";

const router = Router();

// GET reviews for a product (public — approved only)
router.get("/products/:id/reviews", async (req, res) => {
  const productId = parseInt(req.params.id as string);
  const reviews = await db
    .select()
    .from(productReviewsTable)
    .where(and(eq(productReviewsTable.productId, productId), eq(productReviewsTable.isApproved, true)))
    .orderBy(desc(productReviewsTable.createdAt));

  const userIds = [...new Set(reviews.map(r => r.userId))];
  // Only fetch the users that actually wrote these reviews
  const users = userIds.length
    ? await db
        .select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
        .from(usersTable)
        .where(inArray(usersTable.id, userIds))
    : [];
  const uMap = Object.fromEntries(users.map(u => [u.id, u]));
  res.json(
    reviews.map(r => ({
      ...r,
      userName: uMap[r.userId]?.name ?? "Customer",
      userAvatar: uMap[r.userId]?.avatarUrl ?? null,
      images: r.images as string[],
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

// POST /products/:id/reviews is intentionally only in products.ts
// which enforces the "must have a delivered order" eligibility check.

// Admin: list all reviews
router.get("/reviews", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  const { approved } = req.query as any;
  const conditions: any[] = [];
  if (approved === "true") conditions.push(eq(productReviewsTable.isApproved, true));
  if (approved === "false") conditions.push(eq(productReviewsTable.isApproved, false));

  const reviews = await db
    .select()
    .from(productReviewsTable)
    .where(conditions.length ? and(...conditions) : undefined);

  const userIds = [...new Set(reviews.map(r => r.userId))];
  const productIds = [...new Set(reviews.map(r => r.productId))];

  const users = userIds.length
    ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, userIds))
    : [];
  const products = productIds.length
    ? await db.select({ id: productsTable.id, name: productsTable.name }).from(productsTable).where(inArray(productsTable.id, productIds))
    : [];

  const uMap = Object.fromEntries(users.map(u => [u.id, u]));
  const pMap = Object.fromEntries(products.map(p => [p.id, p]));

  res.json(
    reviews.map(r => ({
      ...r,
      userName: uMap[r.userId]?.name ?? "Customer",
      userAvatar: null,
      productName: pMap[r.productId]?.name ?? null,
      images: r.images as string[],
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

// Admin: approve/reply to a review
router.patch("/reviews/:id", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  const update: any = {};
  if (req.body.isApproved !== undefined) update.isApproved = req.body.isApproved;
  if (req.body.adminReply !== undefined) update.adminReply = req.body.adminReply;

  const [review] = await db
    .update(productReviewsTable)
    .set(update)
    .where(eq(productReviewsTable.id, parseInt(req.params.id as string)))
    .returning();

  if (!review) { res.status(404).json({ error: "Review not found" }); return; }

  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, review.userId)).limit(1);
  const [product] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, review.productId)).limit(1);
  res.json({
    ...review,
    userName: user?.name ?? "Customer",
    userAvatar: null,
    productName: product?.name ?? null,
    images: review.images as string[],
    createdAt: review.createdAt.toISOString(),
  });
});

// Admin: delete a review
router.delete("/reviews/:id", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  await db.delete(productReviewsTable).where(eq(productReviewsTable.id, parseInt(req.params.id as string)));
  res.json({ success: true });
});

export default router;
