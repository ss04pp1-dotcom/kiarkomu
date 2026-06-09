import { pgTable, serial, integer, text, timestamp, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { productsTable } from "./products.js";
import { usersTable } from "./users.js";
import { orderItemsTable } from "./orders.js";

export const productReviewsTable = pgTable("product_reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  orderItemId: integer("order_item_id").notNull().references(() => orderItemsTable.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  images: jsonb("images").$type<string[]>().notNull().default([]),
  isApproved: boolean("is_approved").notNull().default(false),
  adminReply: text("admin_reply"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("product_reviews_product_id_idx").on(t.productId),
  index("product_reviews_user_id_idx").on(t.userId),
]);

export type ProductReview = typeof productReviewsTable.$inferSelect;
