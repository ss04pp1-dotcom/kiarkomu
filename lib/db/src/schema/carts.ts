import { pgTable, serial, integer, timestamp, numeric, text, index } from "drizzle-orm/pg-core";
import { productsTable } from "./products.js";

export const cartsTable = pgTable("carts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const cartItemsTable = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  cartId: integer("cart_id").notNull().references(() => cartsTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  variantId: integer("variant_id"),
  productName: text("product_name").notNull(),
  productThumbnail: text("product_thumbnail"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  variantLabel: text("variant_label"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("cart_items_product_id_idx").on(t.productId),
]);

export type Cart = typeof cartsTable.$inferSelect;
export type CartItem = typeof cartItemsTable.$inferSelect;
