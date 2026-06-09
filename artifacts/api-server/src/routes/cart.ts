import { Router } from "express";
import { db } from "@workspace/db";
import { cartsTable, cartItemsTable, productsTable, productVariantsTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth.js";

const router = Router();

async function getOrCreateCart(userId: number) {
  let [cart] = await db.select().from(cartsTable).where(eq(cartsTable.userId, userId)).limit(1);
  if (!cart) {
    [cart] = await db.insert(cartsTable).values({ userId }).returning();
  }
  return cart;
}

async function getCartResponse(cartId: number) {
  const items = await db.select().from(cartItemsTable).where(eq(cartItemsTable.cartId, cartId));
  const subtotal = items.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  return { id: cartId, items: items.map(i => ({ ...i, price: parseFloat(i.price) })), subtotal, itemCount };
}

router.get("/cart", requireAuth, async (req: AuthRequest, res) => {
  const cart = await getOrCreateCart(req.userId!);
  res.json(await getCartResponse(cart.id));
});

router.delete("/cart", requireAuth, async (req: AuthRequest, res) => {
  const cart = await getOrCreateCart(req.userId!);
  await db.delete(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
  res.json(await getCartResponse(cart.id));
});

async function touchCart(cartId: number) {
  await db.update(cartsTable).set({ updatedAt: new Date() }).where(eq(cartsTable.id, cartId));
}

router.post("/cart/items", requireAuth, async (req: AuthRequest, res) => {
  // Support single variantId (legacy) OR multiple variantIds (multi-variant products)
  const { productId: rawProductId, quantity, variantId, variantIds } = req.body;
  if (!rawProductId || isNaN(parseInt(rawProductId))) {
    res.status(400).json({ error: "productId is required" });
    return;
  }
  const productId = parseInt(rawProductId);
  const qty = quantity !== undefined ? parseInt(quantity) : 1;
  if (isNaN(qty) || qty < 1) {
    res.status(400).json({ error: "quantity must be a positive integer" });
    return;
  }
  const cart = await getOrCreateCart(req.userId!);
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  // Resolve variant IDs: prefer variantIds array, fall back to single variantId
  const resolvedVariantIds: number[] = Array.isArray(variantIds) && variantIds.length > 0
    ? variantIds
    : variantId ? [variantId] : [];

  // Stock check for non-variant products
  if (resolvedVariantIds.length === 0 && product.stock < qty) {
    res.status(400).json({ error: `Insufficient stock for "${product.name}"` });
    return;
  }

  // Calculate price. priceModifier stores the ABSOLUTE variant price (not a delta).
  // If any selected variant has priceModifier > 0, the highest one is the price.
  let itemPrice = parseFloat(product.price);
  const labelParts: string[] = [];
  let primaryVariantId: number | null = null;
  const absoluteModifiers: number[] = [];

  for (const vid of resolvedVariantIds) {
    const [variant] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, vid)).limit(1);
    if (variant) {
      if (variant.stock < qty) {
        res.status(400).json({ error: `Insufficient stock for "${product.name} (${variant.type}: ${variant.value})"` });
        return;
      }
      const mod = parseFloat(variant.priceModifier);
      if (mod > 0) absoluteModifiers.push(mod);
      labelParts.push(`${variant.type}: ${variant.value}`);
      if (!primaryVariantId) primaryVariantId = variant.id;
    }
  }
  if (absoluteModifiers.length > 0) itemPrice = Math.max(...absoluteModifiers);
  const variantLabel = labelParts.length > 0 ? labelParts.join(", ") : null;

  // Compute a stable key for deduplication: sorted variant IDs joined
  const variantKey = resolvedVariantIds.slice().sort((a, b) => a - b).join("_");

  // Match on productId + same variant combination (via variantLabel as key)
  const variantCondition = primaryVariantId
    ? eq(cartItemsTable.variantId, primaryVariantId)
    : isNull(cartItemsTable.variantId);

  // For multi-variant: use variantLabel to distinguish combinations
  let existing;
  if (variantLabel) {
    const rows = await db.select().from(cartItemsTable)
      .where(and(eq(cartItemsTable.cartId, cart.id), eq(cartItemsTable.productId, productId)))
      .limit(20);
    existing = rows.find(r => r.variantLabel === variantLabel);
  } else {
    [existing] = await db.select().from(cartItemsTable)
      .where(and(eq(cartItemsTable.cartId, cart.id), eq(cartItemsTable.productId, productId), isNull(cartItemsTable.variantId)))
      .limit(1);
  }

  if (existing) {
    const newQty = existing.quantity + qty;
    // Re-check stock against the new combined quantity
    if (resolvedVariantIds.length === 0 && product.stock < newQty) {
      res.status(400).json({ error: `Only ${product.stock} units available for "${product.name}"` });
      return;
    }
    if (primaryVariantId) {
      const [pv] = await db.select({ stock: productVariantsTable.stock }).from(productVariantsTable).where(eq(productVariantsTable.id, primaryVariantId)).limit(1);
      if (pv && pv.stock < newQty) {
        res.status(400).json({ error: `Only ${pv.stock} units available for "${product.name}" with the selected variant` });
        return;
      }
    }
    await db.update(cartItemsTable).set({ quantity: newQty })
      .where(eq(cartItemsTable.id, existing.id));
  } else {
    await db.insert(cartItemsTable).values({
      cartId: cart.id,
      productId,
      quantity: qty,
      variantId: primaryVariantId,
      variantLabel,
      productName: product.name,
      productThumbnail: product.thumbnailUrl,
      price: itemPrice.toFixed(2),
    });
  }
  await touchCart(cart.id);
  res.json(await getCartResponse(cart.id));
});

router.patch("/cart/items/:itemId", requireAuth, async (req: AuthRequest, res) => {
  const { quantity } = req.body;
  if (quantity === undefined || isNaN(parseInt(quantity))) {
    res.status(400).json({ error: "quantity is required and must be a number" });
    return;
  }
  const qty = parseInt(quantity);
  const itemId = parseInt(req.params.itemId as string);
  const cart = await getOrCreateCart(req.userId!);

  if (qty <= 0) {
    await db.delete(cartItemsTable).where(and(eq(cartItemsTable.id, itemId), eq(cartItemsTable.cartId, cart.id)));
  } else {
    // Fetch the cart item first so we can validate stock
    const [item] = await db.select()
      .from(cartItemsTable)
      .where(and(eq(cartItemsTable.id, itemId), eq(cartItemsTable.cartId, cart.id)))
      .limit(1);
    if (!item) { res.status(404).json({ error: "Cart item not found" }); return; }

    // Validate product stock
    const [product] = await db
      .select({ stock: productsTable.stock, name: productsTable.name })
      .from(productsTable)
      .where(eq(productsTable.id, item.productId))
      .limit(1);
    if (!product) { res.status(404).json({ error: "Product not found" }); return; }

    if (product.stock < qty) {
      res.status(400).json({ error: `Only ${product.stock} units available for "${product.name}"` });
      return;
    }

    // Validate variant stock if applicable
    if (item.variantId) {
      const [variant] = await db
        .select({ stock: productVariantsTable.stock, type: productVariantsTable.type, value: productVariantsTable.value })
        .from(productVariantsTable)
        .where(eq(productVariantsTable.id, item.variantId))
        .limit(1);
      if (variant && variant.stock < qty) {
        res.status(400).json({ error: `Only ${variant.stock} units available for "${product.name} (${variant.type}: ${variant.value})"` });
        return;
      }
    }

    await db.update(cartItemsTable).set({ quantity: qty }).where(and(eq(cartItemsTable.id, itemId), eq(cartItemsTable.cartId, cart.id)));
  }
  await touchCart(cart.id);
  res.json(await getCartResponse(cart.id));
});

router.delete("/cart/items/:itemId", requireAuth, async (req: AuthRequest, res) => {
  const cart = await getOrCreateCart(req.userId!);
  await db.delete(cartItemsTable).where(and(eq(cartItemsTable.id, parseInt(req.params.itemId as string)), eq(cartItemsTable.cartId, cart.id)));
  await touchCart(cart.id);
  res.json(await getCartResponse(cart.id));
});

export default router;
