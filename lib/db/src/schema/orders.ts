import { pgTable, serial, text, timestamp, integer, numeric, pgEnum, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users.js";
import { addressesTable } from "./addresses.js";
import { storesTable } from "./shipping.js";

export const orderStatusEnum = pgEnum("order_status", [
  "pending", "confirmed", "packing", "shipped", "out_for_delivery", "delivered", "cancelled", "returned"
]);
export const paymentStatusEnum = pgEnum("payment_status", ["unpaid", "pending", "paid", "failed", "refunded"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cod", "bkash", "nagad", "rocket", "card"]);
export const deliveryMethodEnum = pgEnum("delivery_method", ["home_delivery", "store_pickup"]);

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: orderStatusEnum("status").notNull().default("pending"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("unpaid"),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  deliveryMethod: deliveryMethodEnum("delivery_method").notNull(),
  addressId: integer("address_id").references(() => addressesTable.id, { onDelete: "set null" }),
  storeId: integer("store_id").references(() => storesTable.id, { onDelete: "set null" }),
  couponCode: text("coupon_code"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  shippingFee: numeric("shipping_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  coinsUsed: integer("coins_used").notNull().default(0),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  sslSessionKey: text("ssl_session_key"),
  // MFS manual payment fields
  transactionId: text("transaction_id"),
  senderNumber: text("sender_number"),
  // Steadfast courier fields (text — some couriers return alphanumeric IDs)
  consignmentId: text("consignment_id"),
  trackingCode: text("tracking_code"),
  // Multi-courier fields
  courierService: text("courier_service"),
  carrybeeConsignmentId: text("carrybee_consignment_id"),
  // Last known courier status — used by the cron to detect changes and fire push notifications
  lastCourierStatus: text("last_courier_status"),
  // Pay Delivery Charge mode: user pays only the shipping fee upfront via MFS; rest is COD
  payDeliveryCharge: boolean("pay_delivery_charge").notNull().default(false),
  // Payment breakdown: how much was paid upfront vs. to be collected on delivery
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
  amountDue: numeric("amount_due", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("orders_user_id_idx").on(t.userId),
]);

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull(),
  variantId: integer("variant_id"),
  productName: text("product_name").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  variantLabel: text("variant_label"),
}, (t) => [
  index("order_items_order_id_idx").on(t.orderId),
  index("order_items_product_id_idx").on(t.productId),
]);

export const orderTrackingTable = pgTable("order_tracking", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  note: text("note"),
  lat: numeric("lat", { precision: 10, scale: 7 }),
  long: numeric("long", { precision: 10, scale: 7 }),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (t) => [
  index("order_tracking_order_id_idx").on(t.orderId),
]);

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull(),
  gatewayRef: text("gateway_ref"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("transactions_order_id_idx").on(t.orderId),
  index("transactions_user_id_idx").on(t.userId),
]);

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
