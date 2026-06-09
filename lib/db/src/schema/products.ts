import { pgTable, serial, text, timestamp, boolean, integer, numeric, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { categoriesTable } from "./categories.js";
import { brandsTable } from "./brands.js";
import { usersTable } from "./users.js";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameBn: text("name_bn"),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  originalPrice: numeric("original_price", { precision: 12, scale: 2 }),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id, { onDelete: "cascade" }),
  brandId: integer("brand_id").references(() => brandsTable.id, { onDelete: "set null" }),
  stock: integer("stock").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  isFast: boolean("is_fast").notNull().default(false),
  thumbnailUrl: text("thumbnail_url"),
  images: jsonb("images").$type<string[]>().notNull().default([]),
  specifications: jsonb("specifications").$type<Record<string, string>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const productVariantsTable = pgTable("product_variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  value: text("value").notNull(),
  priceModifier: numeric("price_modifier", { precision: 10, scale: 2 }).notNull().default("0"),
  stock: integer("stock").notNull().default(0),
  variantData: jsonb("variant_data").$type<Record<string, string>>(),
  sku: text("sku"),
});

export const subProductsTable = pgTable("sub_products", {
  id: serial("id").primaryKey(),
  parentProductId: integer("parent_product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  subProductId: integer("sub_product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const recentlyViewedTable = pgTable("recently_viewed", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewed_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("recently_viewed_user_product_unique").on(t.userId, t.productId),
]);

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
