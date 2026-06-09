import { Router } from "express";
import rateLimit from "express-rate-limit";
import { logger } from "../lib/logger.js";
import { db } from "@workspace/db";
import {
  ordersTable, orderItemsTable, orderTrackingTable, cartItemsTable, cartsTable,
  usersTable, addressesTable, appSettingsTable, userCoinsTable, coinTransactionsTable,
  couponsTable, notificationsTable, shippingZonesTable, productVariantsTable, productsTable,
} from "@workspace/db";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/requireAuth.js";
import { enqueueJob } from "../lib/job-queue.js";
import { createCourierOrder, checkDeliveryStatus, type SteadfastStatusResult } from "../lib/steadfast.js";
import { carrybeeCreateOrder, carrybeeGetOrderDetails, carrybeeGetAddressDetails, carrybeeGetStores } from "../lib/carrybee.js";
import { checkFraud } from "../lib/fraud-check.js";
import { fireMetaCapiPurchase } from "../lib/meta-capi.js";

const router = Router();

const orderCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many order requests. Please wait a minute before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

function fmtOrder(o: any, userName: string) {
  return {
    id: o.id, userId: o.userId, userName,
    status: o.status, paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod, deliveryMethod: o.deliveryMethod,
    subtotal: parseFloat(o.subtotal), shippingFee: parseFloat(o.shippingFee),
    discount: parseFloat(o.discount), coinsUsed: o.coinsUsed,
    total: parseFloat(o.total), createdAt: o.createdAt.toISOString(),
    transactionId: o.transactionId ?? null,
    senderNumber: o.senderNumber ?? null,
    notes: o.notes ?? null,
    consignmentId: o.consignmentId ?? null,
    trackingCode: o.trackingCode ?? null,
    courierService: o.courierService ?? null,
    carrybeeConsignmentId: o.carrybeeConsignmentId ?? null,
    payDeliveryCharge: o.payDeliveryCharge ?? false,
    amountPaid: parseFloat(o.amountPaid ?? "0"),
    amountDue: parseFloat(o.amountDue ?? "0"),
  };
}

interface CourierSubmitResult {
  ok: boolean;
  error?: string;
  consignmentId?: string | number | null;
}

/** Normalize a Bangladeshi phone number to the "01XXXXXXXXX" format (11 digits) expected by courier APIs. */
function normalizeBDPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  // Strip everything except digits
  let digits = raw.replace(/\D/g, "");
  // Remove country code prefix: +880 / 880
  if (digits.startsWith("880")) digits = digits.slice(3);
  // Ensure it starts with 0
  if (!digits.startsWith("0") && digits.length === 10) digits = "0" + digits;
  return digits;
}

async function submitToCourier(order: any, courierService: "steadfast" | "carrybee", settings: any): Promise<CourierSubmitResult> {
  // Use amountDue for COD collection: customers who paid delivery upfront only owe the product amount
  const codAmount = parseFloat(order.amountDue ?? order.total);

  if (courierService === "steadfast") {
    if (!order.addressId) return { ok: false, error: "Order has no delivery address" };
    const [addr] = await db.select().from(addressesTable).where(eq(addressesTable.id, order.addressId)).limit(1);
    if (!addr) return { ok: false, error: "Delivery address not found" };
    const recipientAddress = [addr.addressLine, addr.area, addr.district].filter(Boolean).join(", ");
    try {
      const result = await createCourierOrder({
        invoice: order.id,
        recipient_name: addr.fullName,
        recipient_phone: normalizeBDPhone(addr.phone),
        recipient_address: recipientAddress,
        cod_amount: codAmount,
        note: order.notes ?? "",
      });
      if (!result?.consignment) {
        return { ok: false, error: "Steadfast API did not return a consignment. Check your API key and secret in environment variables." };
      }
      await db.update(ordersTable).set({
        consignmentId: String(result.consignment.consignment_id),
        trackingCode: result.consignment.tracking_code ?? null,
        courierService: "steadfast",
        updatedAt: new Date(),
      }).where(eq(ordersTable.id, order.id));
      return { ok: true, consignmentId: result.consignment.consignment_id };
    } catch (err: any) {
      logger.error({ err, orderId: order.id }, "Steadfast submission failed");
      return { ok: false, error: err?.message ?? "Steadfast submission failed" };
    }
  } else if (courierService === "carrybee") {
    if (!order.addressId) return { ok: false, error: "Order has no delivery address" };
    const storeId = settings?.carrybeeStoreId;
    if (!storeId) return { ok: false, error: "Carrybee Store ID is not configured. Go to Settings → Courier Services, enter your Store ID, and save." };
    if (!settings?.carrybeeEnabled) return { ok: false, error: "Carrybee is not enabled in Settings." };
    const [addr] = await db.select().from(addressesTable).where(eq(addressesTable.id, order.addressId)).limit(1);
    if (!addr) return { ok: false, error: "Delivery address not found" };
    const recipientAddress = [addr.addressLine, addr.area, addr.district].filter(Boolean).join(", ");
    const addrQuery = [addr.area, addr.district].filter(Boolean).join(", ");
    let cityId = 14;
    let zoneId = 1;
    if (addrQuery.length >= 10) {
      const details = await carrybeeGetAddressDetails(addrQuery, settings);
      if (details?.cityId) { cityId = details.cityId; zoneId = details.zoneId; }
    }
    try {
      const result = await carrybeeCreateOrder({
        storeId,
        merchantOrderId: String(order.id),
        recipientPhone: normalizeBDPhone(addr.phone),
        recipientName: addr.fullName,
        recipientAddress,
        cityId,
        zoneId,
        collectableAmount: codAmount,
      }, settings);
      if (!result?.consignmentId) {
        return { ok: false, error: "Carrybee API did not return a consignment ID. Check your credentials, Store ID, and mode (sandbox/production) in Settings." };
      }
      await db.update(ordersTable).set({
        carrybeeConsignmentId: result.consignmentId,
        courierService: "carrybee",
        updatedAt: new Date(),
      }).where(eq(ordersTable.id, order.id));
      return { ok: true, consignmentId: result.consignmentId };
    } catch (err: any) {
      logger.error({ err, orderId: order.id }, "Carrybee submission failed");
      return { ok: false, error: err?.message ?? "Carrybee submission failed" };
    }
  }
  return { ok: false, error: "Unknown courier service" };
}

router.get("/orders", requireAuth, async (req: AuthRequest, res) => {
  const { status, userId, page = "1", limit = "20" } = req.query as any;
  const _p = parseInt(String(page), 10);
  const _l = parseInt(String(limit), 10);
  const pageNum  = isNaN(_p) || _p  < 1   ? 1   : _p;
  const limitNum = isNaN(_l) || _l  < 1   ? 20  : Math.min(_l, 100);
  const offset = (pageNum - 1) * limitNum;

  const isAdmin = ["owner", "manager"].includes(req.userRole!);
  const conditions: any[] = [];
  const validStatuses = ["pending", "confirmed", "packing", "shipped", "out_for_delivery", "delivered", "cancelled", "returned"];
  if (!isAdmin) conditions.push(eq(ordersTable.userId, req.userId!));
  if (status && validStatuses.includes(status)) conditions.push(eq(ordersTable.status, status));
  const parsedUserId = userId ? parseInt(userId) : NaN;
  if (userId && isAdmin && !isNaN(parsedUserId)) conditions.push(eq(ordersTable.userId, parsedUserId));

  const where = conditions.length ? and(...conditions) : undefined;
  const [{ total }] = await db.select({ total: sql<number>`cast(count(*) as int)` }).from(ordersTable).where(where);
  const orders = await db.select().from(ordersTable).where(where).limit(limitNum).offset(offset).orderBy(desc(ordersTable.createdAt));
  const userIds = [...new Set(orders.map(o => o.userId))];
  const users = userIds.length ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));
  res.json({ orders: orders.map(o => fmtOrder(o, userMap[o.userId] ?? "Customer")), total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
});

router.post("/orders", requireAuth, orderCreateLimiter, async (req: AuthRequest, res) => {
  const { addressId, storeId, deliveryMethod, paymentMethod, couponCode, coinsToUse, notes, buyNowItems, district, payDeliveryCharge } = req.body;

  // Validate delivery method input
  if (!["home_delivery", "store_pickup"].includes(deliveryMethod)) {
    res.status(400).json({ error: "Invalid deliveryMethod. Must be 'home_delivery' or 'store_pickup'" });
    return;
  }

  // payDeliveryCharge only makes sense with online payment methods
  if (payDeliveryCharge && paymentMethod === "cod") {
    res.status(400).json({ error: "payDeliveryCharge cannot be used with cash on delivery" });
    return;
  }
  if (!["cod", "bkash", "nagad", "rocket", "card"].includes(paymentMethod)) {
    res.status(400).json({ error: "Invalid paymentMethod" });
    return;
  }

  // For store pickup, storeId is required and must exist
  if (deliveryMethod === "store_pickup") {
    if (!storeId) {
      res.status(400).json({ error: "storeId is required for store pickup orders" });
      return;
    }
    const { storesTable } = await import("@workspace/db");
    const [store] = await db.select({ id: storesTable.id }).from(storesTable).where(eq(storesTable.id, storeId)).limit(1);
    if (!store) {
      res.status(400).json({ error: "Invalid storeId — store not found" });
      return;
    }
  }

  // For home delivery, addressId is required and must belong to this user
  // We also fetch the district here so the shipping fee calculation is authoritative
  // (never trust the client-sent district value).
  let resolvedDistrict: string | undefined;
  let fraudCheckPhone: string | null = null;
  if (deliveryMethod === "home_delivery") {
    if (!addressId) {
      res.status(400).json({ error: "addressId is required for home delivery orders" });
      return;
    }
    const [addr] = await db
      .select({ id: addressesTable.id, district: addressesTable.district, phone: addressesTable.phone })
      .from(addressesTable)
      .where(and(eq(addressesTable.id, addressId), eq(addressesTable.userId, req.userId!)))
      .limit(1);
    if (!addr) {
      res.status(404).json({ error: "Address not found or does not belong to you" });
      return;
    }
    resolvedDistrict = addr.district ?? undefined;
    fraudCheckPhone = addr.phone ?? null;
  }

  let items: { productId: number; variantId?: number | null; productName: string; productThumbnail?: string | null; price: string; quantity: number; variantLabel?: string | null }[] = [];

  const { productsTable, productVariantsTable } = await import("@workspace/db");

  if (buyNowItems && Array.isArray(buyNowItems) && buyNowItems.length > 0) {
    // ── BUY NOW: validate stock before proceeding ──
    for (const item of buyNowItems) {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId)).limit(1);
      if (!product) { res.status(400).json({ error: `Product ${item.productId} not found` }); return; }
      if (product.stock < (item.quantity ?? 1)) {
        res.status(400).json({ error: `Insufficient stock for "${product.name}"` });
        return;
      }
      let price = parseFloat(product.price);
      const labelParts: string[] = [];
      let primaryVariantId: number | null = null;

      // Support variantIds (array) or single variantId
      const resolvedVariantIds: number[] = Array.isArray(item.variantIds) && item.variantIds.length > 0
        ? item.variantIds
        : item.variantId ? [item.variantId] : [];

      const absoluteModifiers: number[] = [];
      for (const vid of resolvedVariantIds) {
        const [variant] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, vid)).limit(1);
        if (variant) {
          // Validate variant-level stock
          if (variant.stock < (item.quantity ?? 1)) {
            res.status(400).json({ error: `Insufficient stock for "${product.name}" (${variant.type}: ${variant.value})` });
            return;
          }
          const mod = parseFloat(variant.priceModifier);
          if (mod > 0) absoluteModifiers.push(mod);
          labelParts.push(`${variant.type}: ${variant.value}`);
          if (!primaryVariantId) primaryVariantId = variant.id;
        }
      }
      // priceModifier stores the absolute variant price (not a delta)
      if (absoluteModifiers.length > 0) price = Math.max(...absoluteModifiers);
      const variantLabel = labelParts.length > 0 ? labelParts.join(", ") : null;
      items.push({ productId: product.id, variantId: primaryVariantId, productName: product.name, productThumbnail: product.thumbnailUrl, price: price.toFixed(2), quantity: item.quantity ?? 1, variantLabel });
    }
  } else {
    const [cart] = await db.select().from(cartsTable).where(eq(cartsTable.userId, req.userId!)).limit(1);
    if (!cart) { res.status(400).json({ error: "Cart is empty" }); return; }
    const cartItems = await db.select().from(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
    if (!cartItems.length) { res.status(400).json({ error: "Cart is empty" }); return; }
    items = cartItems.map(i => ({ productId: i.productId!, variantId: i.variantId, productName: i.productName!, productThumbnail: i.productThumbnail, price: i.price, quantity: i.quantity, variantLabel: i.variantLabel }));

    // ── CART: validate stock for every item before any mutation ──
    for (const item of items) {
      const [product] = await db.select({ stock: productsTable.stock, name: productsTable.name })
        .from(productsTable).where(eq(productsTable.id, item.productId)).limit(1);
      if (!product || product.stock < item.quantity) {
        res.status(400).json({ error: `Insufficient stock for "${product?.name ?? `product ${item.productId}`}"` });
        return;
      }
      if (item.variantId) {
        const [variant] = await db.select({ stock: productVariantsTable.stock })
          .from(productVariantsTable).where(eq(productVariantsTable.id, item.variantId)).limit(1);
        if (!variant || variant.stock < item.quantity) {
          res.status(400).json({ error: `Insufficient variant stock for "${product.name}"` });
          return;
        }
      }
    }
  }

  const subtotal = items.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0);

  // ── Dynamic shipping fee: authoritative server-side lookup ──
  // Uses the district fetched from the saved address (not the client-sent value).
  // Matches zone by name first, then by any district in the zone's districts array —
  // mirroring the same logic used in the mobile checkout UI.
  let shippingFee = 0;
  if (deliveryMethod !== "store_pickup") {
    shippingFee = 60; // default fallback
    if (resolvedDistrict) {
      const zones = await db.select().from(shippingZonesTable);
      const matched = zones.find(z =>
        z.name.toLowerCase() === resolvedDistrict!.toLowerCase() ||
        (z.districts as string[]).some(d => d.toLowerCase() === resolvedDistrict!.toLowerCase())
      );
      if (matched) shippingFee = parseFloat(matched.fee);
    }
  }

  let discount = 0;

  const [settings] = await db.select().from(appSettingsTable).limit(1);
  // ── Use freeDeliveryThreshold + enableFreeDelivery from app_settings ──
  if (settings && settings.enableFreeDelivery && subtotal >= parseFloat(settings.freeDeliveryThreshold)) shippingFee = 0;

  // ── Pre-validate coupon (read-only checks) before entering the transaction ──
  let validatedCoupon: typeof couponsTable.$inferSelect | null = null;
  if (couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(and(eq(couponsTable.code, couponCode), eq(couponsTable.isActive, true))).limit(1);
    if (coupon) {
      if (coupon.expiresAt && coupon.expiresAt < new Date()) {
        res.status(400).json({ error: "Coupon has expired" });
        return;
      }
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        res.status(400).json({ error: "Coupon usage limit has been reached" });
        return;
      }
      // Bug fix: enforce minOrderAmount at order creation, not just at validation
      if (coupon.minOrderAmount && subtotal < parseFloat(coupon.minOrderAmount)) {
        res.status(400).json({ error: `Minimum order amount for this coupon is ৳${coupon.minOrderAmount}` });
        return;
      }
      validatedCoupon = coupon;
      if (coupon.type === "percent") discount = subtotal * parseFloat(coupon.value) / 100;
      else discount = parseFloat(coupon.value);
    }
  }

  // ── Pre-read coin balance (actual deduction happens inside transaction) ──
  let coinDiscount = 0;
  let coinsActuallyUsed = 0;
  if (coinsToUse && coinsToUse > 0 && settings) {
    const [userCoins] = await db.select().from(userCoinsTable).where(eq(userCoinsTable.userId, req.userId!)).limit(1);
    const available = userCoins?.balance ?? 0;
    coinsActuallyUsed = Math.min(coinsToUse, available);
    coinDiscount = coinsActuallyUsed * parseFloat(settings.coinValue);
  }

  const total = Math.max(0, subtotal + shippingFee - discount - coinDiscount);
  const initialPaymentStatus = paymentMethod === "cod" ? "unpaid" : "pending";

  // ── Fraud check — runs before the DB transaction ──────────────────────────
  // Checks IP rate limiting (>2 orders per IP in 5 min), user rate limiting,
  // and phone format validation. Flagged orders are still persisted but CAPI
  // and courier dispatch are suppressed.
  const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? null;
  const fraudResult = checkFraud({ ip: clientIp, userId: req.userId!, phone: fraudCheckPhone });

  // Calculate payment breakdown
  let amountPaid: number;
  let amountDue: number;
  if (paymentMethod === "cod") {
    amountPaid = 0;
    amountDue = total;
  } else if (payDeliveryCharge) {
    // User paid delivery fee upfront; product cost still due on delivery
    amountPaid = shippingFee;
    amountDue = total - shippingFee;
  } else {
    // Full online payment (bkash / nagad / rocket / card)
    amountPaid = total;
    amountDue = 0;
  }

  // ── Atomic transaction: stock decrement + coin deduction + coupon increment + order insert ──
  // All side-effects are inside so a stock race-condition rolls everything back.
  let order: any;
  await db.transaction(async (tx) => {
    // Atomic stock decrement with optimistic lock check
    for (const item of items) {
      const result = await tx
        .update(productsTable)
        .set({ stock: sql`stock - ${item.quantity}` })
        .where(and(eq(productsTable.id, item.productId), sql`stock >= ${item.quantity}`))
        .returning({ id: productsTable.id });

      if (!result.length) {
        throw new Error(`Race condition: insufficient stock for product ${item.productId}`);
      }

      // Also decrement variant stock if variant is specified (with optimistic lock)
      if (item.variantId) {
        const variantResult = await tx
          .update(productVariantsTable)
          .set({ stock: sql`stock - ${item.quantity}` })
          .where(and(eq(productVariantsTable.id, item.variantId), sql`stock >= ${item.quantity}`))
          .returning({ id: productVariantsTable.id });

        if (!variantResult.length) {
          throw new Error(`Race condition: insufficient variant stock for product ${item.productId}`);
        }
      }
    }

    // Coin deduction inside transaction so it rolls back on failure
    if (coinsActuallyUsed > 0) {
      await tx.update(userCoinsTable)
        .set({ balance: sql`balance - ${coinsActuallyUsed}` })
        .where(and(eq(userCoinsTable.userId, req.userId!), sql`balance >= ${coinsActuallyUsed}`));
      await tx.insert(coinTransactionsTable).values({ userId: req.userId!, type: "redeem", amount: -coinsActuallyUsed, description: "Used for order" });
    }

    // Coupon increment inside transaction — conditional WHERE prevents race condition
    // where two concurrent orders both pass the pre-check and both use the last slot.
    if (validatedCoupon) {
      const couponResult = await tx
        .update(couponsTable)
        .set({ usedCount: sql`used_count + 1` })
        .where(
          and(
            eq(couponsTable.id, validatedCoupon.id),
            validatedCoupon.maxUses
              ? sql`used_count < ${validatedCoupon.maxUses}`
              : sql`TRUE`,
          ),
        )
        .returning({ id: couponsTable.id });
      if (!couponResult.length) {
        throw new Error("Coupon usage limit reached — please try again without the coupon.");
      }
    }

    [order] = await tx.insert(ordersTable).values({
      userId: req.userId!, paymentMethod, deliveryMethod, addressId, storeId,
      couponCode, subtotal: subtotal.toString(), shippingFee: shippingFee.toString(),
      discount: (discount + coinDiscount).toString(), coinsUsed: coinsActuallyUsed,
      total: total.toString(), notes,
      paymentStatus: initialPaymentStatus,
      payDeliveryCharge: !!payDeliveryCharge,
      amountPaid: amountPaid.toFixed(2),
      amountDue: amountDue.toFixed(2),
      fraudFlag: fraudResult.isFraud,
    }).returning();

    await tx.insert(orderItemsTable).values(items.map(i => ({
      orderId: order.id, productId: i.productId, variantId: i.variantId,
      productName: i.productName, thumbnailUrl: i.productThumbnail,
      price: i.price, quantity: i.quantity, variantLabel: i.variantLabel,
    })));
    await tx.insert(orderTrackingTable).values({ orderId: order.id, status: "pending" });

    // Clear cart inside the transaction — if this is a normal cart order and something
    // crashes after commit, the cart stays empty (consistent) rather than full.
    if (!buyNowItems || !buyNowItems.length) {
      const [cart] = await tx.select().from(cartsTable).where(eq(cartsTable.userId, req.userId!)).limit(1);
      if (cart) await tx.delete(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
    }
  });

  if (!order) {
    res.status(500).json({ error: "Failed to create order. Please try again." });
    return;
  }
  try {
    await db.insert(notificationsTable).values({ userId: req.userId!, title: "Order placed!", body: `Your order #${order.id} has been placed.`, type: "order" });
  } catch (err) {
    logger.error({ err, orderId: order.id }, "Failed to insert order notification — order still created");
  }

  const [user] = await db.select({ name: usersTable.name, email: usersTable.email, phone: usersTable.phone, pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (user?.pushToken) {
    enqueueJob("push", { token: user.pushToken, title: "Order placed!", body: `Your order #${order.id} has been received.`, data: { orderId: order.id } }).catch((err) => logger.error({ err }, "Push enqueue failed"));
  }

  // ── Meta Conversions API — fire-and-forget, only for clean orders ──────────
  if (!fraudResult.isFraud && settings?.facebookPixelId && settings?.metaAccessToken) {
    fireMetaCapiPurchase({
      pixelId: settings.facebookPixelId,
      accessToken: settings.metaAccessToken,
      testEventCode: settings.metaTestEventCode ?? undefined,
      orderId: order.id,
      value: total,
      currency: settings.currency ?? "BDT",
      clientIp,
      clientUserAgent: req.headers["user-agent"] ?? null,
      userEmail: user?.email ?? null,
      userPhone: user?.phone ?? fraudCheckPhone ?? null,
      userName: user?.name ?? null,
    });
  }

  if (fraudResult.isFraud) {
    logger.warn({ orderId: order.id, reason: fraudResult.reason, ip: clientIp }, "Order flagged as fraud — CAPI suppressed");
  }

  res.status(201).json(fmtOrder(order, user?.name ?? "Customer"));
});

router.get("/orders/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Not found" }); return; }
  const isAdmin = ["owner", "manager"].includes(req.userRole!);
  if (!isAdmin && order.userId !== req.userId) { res.status(403).json({ error: "Forbidden" }); return; }

  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, order.userId)).limit(1);
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
  const address = order.addressId ? (await db.select().from(addressesTable).where(eq(addressesTable.id, order.addressId)).limit(1))[0] ?? null : null;
  const tracking = await db.select().from(orderTrackingTable).where(eq(orderTrackingTable.orderId, id)).orderBy(orderTrackingTable.timestamp);

  const { productReviewsTable } = await import("@workspace/db");
  const itemIds = items.map(i => i.id);
  const reviews = itemIds.length
    ? await db.select({ orderItemId: productReviewsTable.orderItemId }).from(productReviewsTable).where(inArray(productReviewsTable.orderItemId, itemIds))
    : [];
  const reviewedItemIds = new Set(reviews.map(r => r.orderItemId));

  const { storesTable } = await import("@workspace/db");
  const storeName = order.storeId
    ? ((await db.select({ name: storesTable.name }).from(storesTable).where(eq(storesTable.id, order.storeId)).limit(1))[0]?.name ?? null)
    : null;

  res.json({
    ...fmtOrder(order, user?.name ?? "Customer"),
    items: items.map(i => ({ ...i, price: parseFloat(i.price), hasReview: reviewedItemIds.has(i.id) })),
    address, tracking: tracking.map(t => ({ ...t, lat: t.lat ? parseFloat(t.lat) : null, long: t.long ? parseFloat(t.long) : null, timestamp: t.timestamp.toISOString() })),
    storeId: order.storeId, storeName, couponCode: order.couponCode,
  });
});

// POST /orders/:id/cancel — customer self-service cancel (pending or confirmed only)
router.post("/orders/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid order ID" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const isAdmin = ["owner", "manager"].includes(req.userRole!);
  if (!isAdmin && order.userId !== req.userId) { res.status(403).json({ error: "Forbidden" }); return; }

  if (!["pending", "confirmed"].includes(order.status)) {
    res.status(400).json({ error: "This order can no longer be cancelled. Only pending or confirmed orders can be cancelled." });
    return;
  }

  await db.update(ordersTable).set({ status: "cancelled", updatedAt: new Date() }).where(eq(ordersTable.id, id));

  const cancelledItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
  for (const item of cancelledItems) {
    await db.update(productsTable)
      .set({ stock: sql`stock + ${item.quantity}` })
      .where(eq(productsTable.id, item.productId));
    if (item.variantId) {
      await db.update(productVariantsTable)
        .set({ stock: sql`stock + ${item.quantity}` })
        .where(eq(productVariantsTable.id, item.variantId));
    }
  }
  await db.insert(orderTrackingTable).values({ orderId: id, status: "cancelled" });
  await db.insert(notificationsTable).values({
    userId: order.userId,
    title: "Order Cancelled",
    body: `Your order #${id} has been cancelled.`,
    type: "order",
  });

  req.log.info({ orderId: id, userId: req.userId }, "Order cancelled by customer");
  res.json({ message: "Order cancelled successfully." });
});

router.get("/orders/:id/tracking", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid order ID" });
    return;
  }

  const [order] = await db
    .select({
      id: ordersTable.id,
      userId: ordersTable.userId,
      consignmentId: ordersTable.consignmentId,
      trackingCode: ordersTable.trackingCode,
      deliveryMethod: ordersTable.deliveryMethod,
      courierService: ordersTable.courierService,
      carrybeeConsignmentId: ordersTable.carrybeeConsignmentId,
    })
    .from(ordersTable)
    .where(eq(ordersTable.id, id))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const isAdmin = ["owner", "manager"].includes(req.userRole!);
  if (!isAdmin && order.userId !== req.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const localTracking = await db
    .select()
    .from(orderTrackingTable)
    .where(eq(orderTrackingTable.orderId, id))
    .orderBy(orderTrackingTable.timestamp);

  let steadfast: SteadfastStatusResult | null = null;
  if (order.consignmentId !== null && order.consignmentId !== undefined) {
    steadfast = await checkDeliveryStatus(id);
  }

  let carrybee: { transferStatus: string } | null = null;
  if (order.carrybeeConsignmentId) {
    const [settings] = await db.select().from(appSettingsTable).limit(1);
    carrybee = await carrybeeGetOrderDetails(order.carrybeeConsignmentId, settings ?? {});
  }

  res.json({
    orderId: id,
    consignmentId: order.consignmentId ?? null,
    trackingCode: order.trackingCode ?? null,
    courierService: order.courierService ?? null,
    carrybeeConsignmentId: order.carrybeeConsignmentId ?? null,
    localTracking: localTracking.map((t) => ({
      id: t.id,
      orderId: t.orderId,
      status: t.status,
      lat: t.lat !== null ? parseFloat(t.lat as string) : null,
      long: t.long !== null ? parseFloat(t.long as string) : null,
      timestamp: t.timestamp.toISOString(),
    })),
    steadfast,
    carrybee,
  });
});

router.patch("/orders/:id", requireAuth, requireRole("owner", "manager"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const { status, paymentStatus, clearPaymentInfo } = req.body;

  const updateData: any = { updatedAt: new Date() };
  if (status) updateData.status = status;
  if (paymentStatus) updateData.paymentStatus = paymentStatus;
  if (clearPaymentInfo) {
    updateData.transactionId = null;
    updateData.senderNumber = null;
  }

  const [currentOrder] = await db.select({ status: ordersTable.status }).from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!currentOrder) { res.status(404).json({ error: "Order not found" }); return; }

  const [order] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, id)).returning();
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  if (status === "cancelled" || status === "returned") {
    const previousStatus = currentOrder.status;
    const nonFulfilledStatuses = ["pending", "confirmed", "packing", "shipped", "out_for_delivery"];
    if (nonFulfilledStatuses.includes(previousStatus)) {
      const itemsToRestore = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
      for (const item of itemsToRestore) {
        await db.update(productsTable)
          .set({ stock: sql`stock + ${item.quantity}` })
          .where(eq(productsTable.id, item.productId));
        if (item.variantId) {
          await db.update(productVariantsTable)
            .set({ stock: sql`stock + ${item.quantity}` })
            .where(eq(productVariantsTable.id, item.variantId));
        }
      }
    }
  }

  // Only add tracking event when order status changes (not just payment status)
  if (status) {
    const statusSequence = ["pending", "confirmed", "packing", "shipped", "out_for_delivery", "delivered"];
    const newIdx = statusSequence.indexOf(status);

    if (newIdx > -1) {
      // Fetch already-recorded statuses to avoid duplicate intermediate entries
      const existingTracking = await db
        .select({ status: orderTrackingTable.status })
        .from(orderTrackingTable)
        .where(eq(orderTrackingTable.orderId, id));
      const recordedStatuses = new Set(existingTracking.map((t) => t.status));

      // Insert all missing intermediate steps leading up to (but not including) the target
      const now = new Date();
      const intermediates = statusSequence
        .slice(0, newIdx)
        .filter((s) => !recordedStatuses.has(s))
        .map((s) => ({ orderId: id, status: s, timestamp: now }));

      if (intermediates.length > 0) {
        await db.insert(orderTrackingTable).values(intermediates);
      }
    }

    // Always insert the new target status as a fresh event
    await db.insert(orderTrackingTable).values({ orderId: id, status });
  }

  const [user] = await db.select({ name: usersTable.name, pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, order.userId)).limit(1);

  if (status) {
    const statusLabels: Record<string, string> = {
      pending: "Order received",
      confirmed: "Order confirmed",
      packing: "Packing your order",
      shipped: "Order shipped",
      out_for_delivery: "Out for delivery",
      delivered: "Order delivered!",
      cancelled: "Order cancelled",
      returned: "Order returned",
    };
    const statusLabel = statusLabels[status] ?? status;
    const notifBody = `Your order #${id} — ${statusLabel.toLowerCase()}.`;
    await db.insert(notificationsTable).values({ userId: order.userId, title: statusLabel, body: notifBody, type: "order" });
    if (user?.pushToken) {
      enqueueJob("push", { token: user.pushToken, title: statusLabel, body: notifBody, data: { orderId: id, status } }).catch((err) => logger.error({ err }, "Push enqueue failed"));
    }
  }

  if (paymentStatus === "paid") {
    const notifBody = `Payment for order #${id} has been verified and confirmed.`;
    await db.insert(notificationsTable).values({ userId: order.userId, title: "Payment Verified ✓", body: notifBody, type: "order" });
    if (user?.pushToken) {
      enqueueJob("push", { token: user.pushToken, title: "Payment Verified ✓", body: notifBody, data: { orderId: id } }).catch((err) => logger.error({ err }, "Push enqueue failed"));
    }
  }

  // Auto-submit to courier when order is confirmed (only if not already submitted)
  if (status === "confirmed" && order.deliveryMethod === "home_delivery" && !order.courierService && !order.consignmentId && !order.carrybeeConsignmentId) {
    const [settings] = await db.select().from(appSettingsTable).limit(1);
    if (settings?.courierAutoSubmit) {
      const courier = settings.activeCourier as "steadfast" | "carrybee" | null;
      if (courier === "steadfast" && settings.steadfastEnabled) {
        submitToCourier(order, "steadfast", settings).catch((e) => {
          logger.error({ err: e }, "Auto-submit to Steadfast failed");
        });
      } else if (courier === "carrybee" && settings.carrybeeEnabled) {
        submitToCourier(order, "carrybee", settings).catch((e) => {
          logger.error({ err: e }, "Auto-submit to Carrybee failed");
        });
      }
    }
  }

  res.json(fmtOrder(order, user?.name ?? "Customer"));
});

// Manual courier submission by admin
router.post("/orders/:id/submit-courier", requireAuth, requireRole("owner", "manager"), async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const { courier } = req.body;
  if (!["steadfast", "carrybee"].includes(courier)) {
    res.status(400).json({ error: "courier must be 'steadfast' or 'carrybee'" });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.deliveryMethod !== "home_delivery") {
    res.status(400).json({ error: "Courier submission only for home delivery orders" });
    return;
  }
  const [settings] = await db.select().from(appSettingsTable).limit(1);
  const submitResult = await submitToCourier(order, courier as "steadfast" | "carrybee", settings);
  if (!submitResult.ok) {
    res.status(400).json({ error: submitResult.error ?? "Courier submission failed" });
    return;
  }
  const [updated] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, order.userId)).limit(1);
  res.json(fmtOrder(updated, user?.name ?? "Customer"));
});

// MFS manual payment submission — user submits their Transaction ID and sender number
router.patch("/orders/:id/submit-payment", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const { transactionId, senderNumber } = req.body;

  if (!transactionId?.trim()) {
    res.status(400).json({ error: "Transaction ID is required" });
    return;
  }
  if (!senderNumber?.trim()) {
    res.status(400).json({ error: "Sender mobile number is required" });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.userId !== req.userId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!["bkash", "nagad", "rocket"].includes(order.paymentMethod)) {
    res.status(400).json({ error: "Manual payment submission only for MFS orders (bKash/Nagad/Rocket)" });
    return;
  }
  if (order.paymentStatus === "paid") {
    res.status(400).json({ error: "Payment already verified" });
    return;
  }

  const [updated] = await db.update(ordersTable)
    .set({ transactionId: transactionId.trim(), senderNumber: senderNumber.trim(), paymentStatus: "pending", updatedAt: new Date() })
    .where(eq(ordersTable.id, id))
    .returning();

  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  res.json(fmtOrder(updated, user?.name ?? "Customer"));
});

router.post("/orders/:id/tracking", requireAuth, requireRole("owner", "manager"), async (req, res) => {
  const { status, lat, long } = req.body;
  const [t] = await db.insert(orderTrackingTable).values({ orderId: parseInt(req.params.id as string), status, lat: lat?.toString(), long: long?.toString() }).returning();
  res.status(201).json({ ...t, lat: t.lat ? parseFloat(t.lat) : null, long: t.long ? parseFloat(t.long) : null, timestamp: t.timestamp.toISOString() });
});

router.post("/orders/:id/initiate-payment", requireAuth, async (req, res) => {
  const { method } = req.body;
  res.json({ gatewayUrl: `https://sandbox.sslcommerz.com/pay?order=${req.params.id}&method=${method}`, sessionKey: `sess_${Date.now()}` });
});

// ── Feature 6: PDF Invoice download ──
router.get("/orders/:id/invoice", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "Not found" }); return; }
  const isAdmin = ["owner", "manager"].includes(req.userRole!);
  if (!isAdmin && order.userId !== req.userId) { res.status(403).json({ error: "Forbidden" }); return; }

  const [user] = await db.select({ name: usersTable.name, email: usersTable.email, phone: usersTable.phone })
    .from(usersTable).where(eq(usersTable.id, order.userId)).limit(1);
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
  const address = order.addressId
    ? (await db.select().from(addressesTable).where(eq(addressesTable.id, order.addressId)).limit(1))[0] ?? null
    : null;

  try {
    const PDFDocument = (await import("pdfkit")).default;
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${id}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(24).font("Helvetica-Bold").text("Shohure", 50, 50);
    doc.fontSize(10).font("Helvetica").fillColor("#666").text("E-Commerce Platform", 50, 78);
    doc.fillColor("#000").fontSize(20).font("Helvetica-Bold").text("INVOICE", 400, 50, { align: "right" });
    doc.fontSize(10).font("Helvetica").text(`#${id}`, 400, 78, { align: "right" });
    doc.fontSize(9).fillColor("#666").text(`Date: ${order.createdAt.toLocaleDateString("en-BD")}`, 400, 92, { align: "right" });

    doc.moveTo(50, 110).lineTo(545, 110).strokeColor("#E0E0E0").stroke();

    // Customer info
    doc.fillColor("#000").fontSize(11).font("Helvetica-Bold").text("Bill To:", 50, 125);
    doc.font("Helvetica").fontSize(10).text(user?.name ?? "Customer", 50, 142);
    if (user?.email) doc.text(user.email, 50, 156);
    if (user?.phone) doc.text(user.phone, 50, 170);
    if (address) {
      const addrLine = [address.addressLine, address.area, address.district].filter(Boolean).join(", ");
      doc.text(addrLine, 50, 184);
    }

    // Order meta
    doc.font("Helvetica-Bold").text("Payment:", 350, 125);
    doc.font("Helvetica").text(order.paymentMethod.toUpperCase(), 350, 142);
    doc.font("Helvetica-Bold").text("Status:", 350, 160);
    doc.font("Helvetica").text(order.status.replace(/_/g, " ").toUpperCase(), 350, 176);

    // Items table header
    const tableTop = 220;
    doc.moveTo(50, tableTop - 5).lineTo(545, tableTop - 5).strokeColor("#E0E0E0").stroke();
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#555");
    doc.text("ITEM", 50, tableTop);
    doc.text("QTY", 360, tableTop, { width: 50, align: "center" });
    doc.text("UNIT PRICE", 410, tableTop, { width: 70, align: "right" });
    doc.text("TOTAL", 480, tableTop, { width: 65, align: "right" });
    doc.moveTo(50, tableTop + 14).lineTo(545, tableTop + 14).strokeColor("#E0E0E0").stroke();

    // Items
    let y = tableTop + 22;
    doc.font("Helvetica").fontSize(9).fillColor("#000");
    const PAGE_BOTTOM = 720; // leave room for totals + footer before page edge
    for (const item of items) {
      // Add a new page if the next row would overflow
      if (y > PAGE_BOTTOM) {
        doc.addPage();
        y = 50;
        // Re-draw column headers on the new page
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#555");
        doc.text("ITEM", 50, y);
        doc.text("QTY", 360, y, { width: 50, align: "center" });
        doc.text("UNIT PRICE", 410, y, { width: 70, align: "right" });
        doc.text("TOTAL", 480, y, { width: 65, align: "right" });
        doc.moveTo(50, y + 14).lineTo(545, y + 14).strokeColor("#E0E0E0").stroke();
        doc.font("Helvetica").fontSize(9).fillColor("#000");
        y += 22;
      }
      const itemTotal = (parseFloat(item.price) * item.quantity).toFixed(2);
      doc.text(item.productName + (item.variantLabel ? ` (${item.variantLabel})` : ""), 50, y, { width: 300 });
      doc.text(String(item.quantity), 360, y, { width: 50, align: "center" });
      doc.text(`BDT ${parseFloat(item.price).toFixed(2)}`, 410, y, { width: 70, align: "right" });
      doc.text(`BDT ${itemTotal}`, 480, y, { width: 65, align: "right" });
      y += 18;
    }

    // Totals
    doc.moveTo(350, y + 5).lineTo(545, y + 5).strokeColor("#E0E0E0").stroke();
    y += 15;
    const addRow = (label: string, value: string, bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
      doc.text(label, 350, y, { width: 130, align: "right" });
      doc.text(value, 480, y, { width: 65, align: "right" });
      y += 16;
    };
    addRow("Subtotal:", `BDT ${parseFloat(order.subtotal).toFixed(2)}`);
    addRow("Shipping:", `BDT ${parseFloat(order.shippingFee).toFixed(2)}`);
    if (parseFloat(order.discount) > 0) addRow("Discount:", `-BDT ${parseFloat(order.discount).toFixed(2)}`);
    doc.moveTo(350, y).lineTo(545, y).strokeColor("#333").stroke(); y += 8;
    addRow("TOTAL:", `BDT ${parseFloat(order.total).toFixed(2)}`, true);
    y += 4;
    doc.moveTo(350, y).lineTo(545, y).strokeColor("#E0E0E0").stroke(); y += 8;
    addRow("Paid Upfront:", `BDT ${parseFloat(order.amountPaid ?? "0").toFixed(2)}`);
    addRow("Due on Delivery (COD):", `BDT ${parseFloat(order.amountDue ?? "0").toFixed(2)}`);

    // Footer
    doc.fontSize(8).fillColor("#999").text("Thank you for shopping with Shohure!", 50, 750, { align: "center", width: 495 });

    doc.end();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate invoice: " + err.message });
    }
  }
});

router.post("/payments/webhook", async (_req, res) => { res.json({ success: true }); });
router.post("/payments/success", async (_req, res) => { res.json({ success: true }); });
router.post("/payments/fail", async (_req, res) => { res.json({ success: false }); });

export default router;

